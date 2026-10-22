import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'output', 'verification');
await fs.mkdir(out, { recursive:true });
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type':mime[path.extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let assertions = 0;
const results = [];
const browsers = [];
const check = (condition, description) => { assert.ok(condition, description); assertions++; };
const game = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const shot = (page, name) => page.screenshot({ path:path.join(out, name + '.png'), fullPage:true, animations:'disabled' });
const engines = (process.env.TEST_BROWSERS || 'chromium').split(',');

async function completeRound(page, touch = false, observedKeys = null) {
  let guard = 0;
  while ((await game(page)).mode !== 'result') {
    check(guard++ < 40, 'Round must terminate after its six tasks');
    const state = await game(page);
    if (state.mode === 'celebrating') { await advance(page, 1500); continue; }
    if (state.mistakeRecoveryMs) { await advance(page, 900); continue; }
    const ch = state.target.nextKey;
    observedKeys?.add(ch);
    if (touch) await page.locator(`#touch-choices [data-key="${ch}"]`).click();
    else await page.keyboard.press(ch);
  }
}

try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit })[engine].launch({ headless:true });
    browsers.push(browser);
    async function scenario(name, fn, options = {}) {
      if (process.env.TEST_MATCH && !name.includes(process.env.TEST_MATCH)) return;
      const context = await browser.newContext({ viewport:{width:1280,height:800}, reducedMotion:'reduce', ...options });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({status:200, contentType:'text/css', body:''}));
      try {
        await fn(page);
        check(errors.length === 0, `${name}: no browser errors: ${errors.join('; ')}`);
        results.push({ engine, scenario:name, status:'passed' });
        console.log(`PASS ${engine}: ${name}`);
      } catch (error) {
        await shot(page, `${engine}-FAIL-${name.replaceAll(/\W+/g, '-')}`).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }

    await scenario('first keys, recovery, pause, reward, replay, persistence', async (page) => {
      await page.goto(origin);
      check((await game(page)).mode === 'home', 'Starts at the child-friendly home');
      await shot(page, `${engine}-home`);
      await page.locator('#btn-start').click();
      check((await game(page)).target.nextKey === 'a', 'First activity starts with A');
      await advance(page, 120000);
      check((await game(page)).target.nextKey === 'a', 'Two minutes idle cannot expire a target');
      check((await game(page)).progress.completed === 0, 'Idle does not grant progress');
      await page.keyboard.press('z');
      check((await game(page)).mistakeRecoveryMs > 0, 'A wrong key starts recovery');
      await page.keyboard.press('a');
      check((await game(page)).progress.notes === 0, 'Immediate correct key is ignored during recovery');
      await advance(page, 900);
      await page.keyboard.down('a');
      await page.keyboard.down('a');
      await page.keyboard.up('a');
      check((await game(page)).progress.notes === 1, 'Holding a key counts only once');
      check((await game(page)).mode === 'celebrating', 'Success has its own celebration');
      await shot(page, `${engine}-celebration`);
      await page.keyboard.press('Escape');
      check((await game(page)).mode === 'paused', 'Escape pauses');
      const before = await game(page);
      await advance(page, 60000);
      await page.keyboard.press('s');
      const frozen = await game(page);
      check(frozen.elapsedMs === before.elapsedMs && frozen.celebrationMs === before.celebrationMs, 'Pause freezes both play time and transitions');
      await page.locator('#btn-resume').click();
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      await advance(page, 1500);
      check((await game(page)).target.nextKey === 's', 'Resume continues at the next task');
      await page.keyboard.press('Control+s');
      check((await game(page)).progress.notes === 1, 'Browser shortcuts are not gameplay');
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {key:'Process',code:'KeyS',isComposing:true,bubbles:true})));
      check((await game(page)).progress.notes === 2, 'A physical letter key works while Japanese IME is active');
      await advance(page, 1500);
      await completeRound(page);
      check((await game(page)).progress.completed === 6, 'All six targets complete');
      check((await page.locator('#result-notes').textContent()).includes('きらきらぼし'), 'The result names the song the child played');
      check(await page.locator('#result-finale').isVisible(), 'Pipi finishes the unfinished phrase after six letters');
      check((await game(page)).stickers.length === 1, 'Finishing with a mistake still earns one sticker');
      await advance(page, 60000);
      check((await game(page)).stickers.length === 1, 'A result cannot award twice');
      await shot(page, `${engine}-result`);
      await page.locator('#btn-listen').click();
      check(!!(await game(page)).playback, 'The child can hear their own notes');
      await advance(page, 7000);
      check((await game(page)).playback === null, 'Playback ends cleanly');
      await page.locator('#btn-listen').click();
      await page.locator('#btn-sound').click();
      check((await game(page)).playback === null && (await game(page)).audio.muted, 'Mute stops current playback');
      await page.reload();
      check((await game(page)).stickers.length === 1 && (await game(page)).settings.muted, 'Reward and sound setting survive a reload');
      await page.locator('#btn-collection').click();
      check(await page.locator('.sticker:not(.locked)').count() === 1, 'Collection shows exactly the earned sticker');
      await shot(page, `${engine}-collection`);
    });

    await scenario('word learning, settings, focus, background pause', async (page) => {
      await page.goto(origin);
      await page.locator('[data-lesson="words"]').click();
      await page.locator('#btn-start').click();
      check((await game(page)).target.word === 'cat', 'The first word is illustrated CAT');
      await page.keyboard.press('c');
      await page.locator('#btn-settings').click();
      const saved = await game(page);
      await advance(page, 30000);
      check((await game(page)).elapsedMs === saved.elapsedMs, 'Settings pause gameplay');
      await page.locator('#setting-lowercase').check();
      await page.locator('#setting-volume').fill('30');
      check((await game(page)).settings.volume === 0.3, 'Volume is persisted as a bounded value');
      await page.locator('#setting-motion').check();
      await page.keyboard.press('Tab');
      check(await page.evaluate(() => !!document.activeElement.closest('dialog')), 'Focus stays inside the modal');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      check((await game(page)).target.typed === 1, 'Changing display keeps typed progress');
      check(await page.locator('.prompt-letter.current').textContent() === 'a', 'Lowercase setting applies to the current target');
      await page.keyboard.press('a');
      check((await game(page)).target.nextKey === 't', 'Typing advances one letter');
      await shot(page, `${engine}-word`);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable:true, get:() => true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      check((await game(page)).dialog === 'pause-dialog', 'Losing page visibility pauses the activity');
      await page.locator('#btn-resume').click();
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      await completeRound(page);
      check((await game(page)).progress.notes === 18, 'The six starter words contain 18 playable letters');
      await page.locator('#btn-result-home').click();
      check((await game(page)).mode === 'home' && (await game(page)).target === null, 'Returning home clears active play state');
      await page.reload();
      check((await game(page)).settings.lowercase && (await game(page)).settings.volume === 0.3, 'All parent settings survive a reload');
    });

    await scenario('free piano, bounded sound, honest rewards, silence', async (page) => {
      await page.goto(origin);
      await page.locator('[data-lesson="free"]').click();
      await page.locator('#btn-start').click();
      check((await page.locator('#keyboard-hint-text').textContent()).includes('どの キーでも'), 'Free play gives a matching keyboard instruction');
      await page.locator('#btn-free-finish').click();
      check((await game(page)).mode === 'home' && (await game(page)).stickers.length === 0, 'An empty free session grants no reward');
      await page.locator('#btn-start').click();
      await page.keyboard.type('asdfghjklqw');
      await page.locator('#btn-free-finish').click();
      check((await game(page)).progress.notes === 11 && (await game(page)).stickers.length === 0, 'A short free session is appreciated without falsely awarding a sticker');
      await page.locator('#btn-again').click();
      await page.keyboard.type('qwertyuiopasdfghjklzxcvbnm'.repeat(3));
      check((await game(page)).progress.notes === 78, 'Every key makes a note in free play');
      check((await game(page)).audio.voices <= 28, 'Rapid input cannot create unbounded audio voices');
      await shot(page, `${engine}-free`);
      await page.locator('#btn-free-finish').click();
      check((await game(page)).stickers.length === 1, 'Twelve or more notes earn one free-play sticker');
      await page.locator('#btn-listen').click();
      await page.locator('#btn-listen').click();
      check((await game(page)).audio.voices === 0, 'Stopping a replay releases scheduled voices');
      await page.locator('#btn-settings').click();
      await page.locator('#setting-volume').fill('0');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      check(await page.locator('#btn-sound').getAttribute('aria-pressed') === 'false', 'Zero volume is represented as sound off');
      await page.locator('#btn-listen').click();
      check((await game(page)).settings.volume > 0 && !!(await game(page)).playback, 'Replay explicitly restores audio from silent volume');
      await page.locator('#btn-result-home').click();
      check((await game(page)).audio.voices === 0 && !(await game(page)).playback, 'Going home stops replay and scheduled audio');
    });

    await scenario('mobile touch flow and responsive layouts', async (page) => {
      await page.goto(origin);
      for (const [width,height] of [[320,568],[390,844],[768,1024],[1280,720],[1440,900]]) {
        await page.setViewportSize({width,height});
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Home has no horizontal overflow at ${width}px`);
        if (width === 1280) {
          const lessons = await page.locator('.lesson-grid').boundingBox();
          check(lessons.y + lessons.height <= height, 'All three lessons are visible on a 720px tall desktop');
        }
        await page.locator('#btn-start').click();
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Play has no horizontal overflow at ${width}px`);
        if (width === 390) {
          check(await page.locator('#touch-choices .keyboard-key').count() === 3, 'Phone shows three large answer keys');
          const keyBox = await page.locator('#touch-choices .next').boundingBox();
          check(keyBox.width >= 70 && keyBox.height >= 60, 'Phone answer keys have generous touch targets');
          await shot(page, `${engine}-mobile-play`);
          await page.locator('#btn-keyboard').click();
          check(await page.locator('#keyboard').isVisible(), 'Full mobile keyboard can be expanded');
          await page.locator('#btn-keyboard').click();
          await completeRound(page, true);
          check((await game(page)).stickers.length === 1, 'Touch input can complete an entire round');
          await shot(page, `${engine}-mobile-result`);
          await page.locator('#btn-result-home').click();
          await shot(page, `${engine}-mobile-home`);
        } else {
          if (width === 1280) {
            const bottom = await page.locator('#keyboard').boundingBox();
            check(bottom.y + bottom.height <= height, 'Desktop keyboard fits a 720px tall viewport');
            await shot(page, `${engine}-desktop-play`);
          }
          await page.locator('#btn-pause').click();
          await page.locator('#btn-leave').click();
        }
      }
      await page.setViewportSize({width:320,height:568});
      await page.locator('#btn-collection').click();
      check(await page.evaluate(() => { const d=document.querySelector('dialog[open]'); return d.scrollWidth <= d.clientWidth; }), 'Sticker collection fits a narrow phone');
    });

    await scenario('songs advance one note per correct key', async (page) => {
      await page.goto(origin);
      check((await game(page)).song === 'twinkle', 'Twinkle is the default song');
      await page.locator('[data-song="mary"]').click();
      await page.locator('#btn-start').click();
      check((await game(page)).song === 'mary' && await page.locator('#play-song-name').textContent() === 'メリーさんの ひつじ', 'The chosen song is shown while playing');
      await page.keyboard.press('q');
      check((await game(page)).songPosition === 0, 'A wrong key does not advance the song');
      await advance(page, 900);
      await page.keyboard.press('a');
      check((await game(page)).songPosition === 1, 'A correct key plays the next song note');
      await page.locator('#btn-pause').click();
      await page.locator('#btn-leave').click();
      await page.reload();
      check((await game(page)).song === 'mary', 'The chosen song is remembered');
      await page.locator('[data-lesson="free"]').click();
      check(await page.locator('#song-section').isHidden(), 'Free piano hides the song picker');
    });

    await scenario('music: instruments, accompaniment, score, song journey, groove', async (page) => {
      await page.goto(origin);
      await page.locator('[data-instrument="marimba"]').click();
      check((await game(page)).instrument === 'marimba', 'An instrument can be chosen');
      await page.locator('#btn-start').click();
      check(await page.locator('#song-staff').isVisible() && await page.locator('#piano-strip').isHidden(), 'Song lessons show the score instead of the piano strip');
      check(await page.locator('.staff-note').count() === 42 && await page.locator('.staff-note.current .solfa').textContent() === 'ど', 'The score shows every note with do-re-mi names');
      await page.keyboard.press('a');
      check(await page.locator('.staff-note.played').count() === 1 && await page.locator('.staff-note.current .solfa').textContent() === 'ど', 'The score advances with each correct key');
      check((await game(page)).audio.voices >= 2, 'A melody note comes with its accompaniment');
      await advance(page, 1500);
      await completeRound(page);
      const first = await game(page);
      check(first.songProgress.twinkle === 7, 'Six notes plus Pipi\'s finale leave the song at the end of the first phrase');
      await page.reload();
      check((await game(page)).instrument === 'marimba' && (await game(page)).songProgress.twinkle === 7, 'Instrument and song progress survive a reload');
      check(Number.parseFloat(await page.locator('[data-song="twinkle"] .chip-progress i').evaluate((el) => el.style.width)) > 0, 'The song chip shows how far the tune has come');
      await page.locator('#btn-start').click();
      check((await game(page)).songPosition === 7 && await page.locator('.staff-note.current .solfa').textContent() === 'ふぁ', 'The next round continues the tune where it stopped');
      await page.locator('#btn-pause').click();
      await page.locator('#btn-leave').click();
      await page.evaluate(() => { const data = JSON.parse(localStorage.getItem('type-sonata:music-room:v1')); data.songProgress.twinkle = 36; localStorage.setItem('type-sonata:music-room:v1', JSON.stringify(data)); });
      await page.reload();
      await page.locator('#btn-start').click();
      await completeRound(page);
      const done = await game(page);
      check(done.songsCompleted.twinkle === 1 && done.songProgress.twinkle === 0, 'Playing the last note completes the song and starts it over');
      check(await page.locator('#result-title').getAttribute('aria-label') === 'さいごまで ひけた！' && await page.locator('#result-song').isVisible(), 'Completing a song gets its own celebration');
      await page.locator('#btn-listen').click();
      check((await game(page)).playback.total === 42, 'A finished song can be heard in full');
      await page.locator('#btn-listen').click();
      await page.locator('#btn-result-home').click();
      check(await page.locator('[data-song="twinkle"]').getAttribute('data-completed') === '★1', 'Finished songs earn a star on the home screen');
      await page.locator('[data-lesson="free"]').click();
      await page.locator('#btn-start').click();
      check((await game(page)).groove === true && await page.locator('#btn-groove').isVisible(), 'Free piano starts with a gentle groove');
      await advance(page, 1300);
      check((await game(page)).audio.voices > 0, 'The groove plays without any key presses');
      await page.locator('#btn-pause').click();
      const paused = (await game(page)).elapsedMs;
      await advance(page, 5000);
      check((await game(page)).elapsedMs === paused, 'Pausing also pauses the groove');
      await page.locator('#btn-resume').click();
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      await page.locator('#btn-groove').click();
      check((await game(page)).groove === false && await page.locator('#groove-label').textContent() === 'リズム OFF', 'The groove can be switched off');
      await page.evaluate(() => AudioEngine.stopAll());
      await advance(page, 2000);
      check((await game(page)).audio.voices === 0, 'With the groove off, silence stays silent');
      await page.keyboard.type('asdf');
      await page.locator('#btn-free-finish').click();
      await page.locator('#btn-result-home').click();
      await page.locator('#btn-start').click();
      check((await game(page)).groove === false, 'The groove choice is remembered');
    });

    await scenario('full motion: reactions, particles and safe exits', async (page) => {
      await page.goto(origin);
      check(await page.locator('.coach-pipi .pp-eyes').count() === 1, 'Pipi is mounted as animatable parts');
      await page.locator('#btn-start').click();
      await page.keyboard.press('q');
      check(await page.locator('.coach-pipi.worry').count() === 1, 'A miss makes Pipi look worried, not punished');
      await advance(page, 900);
      await page.keyboard.press('a');
      check(await page.locator('.coach-pipi.joy').count() === 1, 'A correct key makes Pipi happy');
      check((await game(page)).particles > 0, 'A correct key emits particles');
      // Switch to reduced motion while the old prompt is animating out.
      await advance(page, 1300);
      check(await page.evaluate(() => document.querySelector('#prompt-picture').getAnimations().length > 0), 'The finished prompt is animating out');
      await page.locator('#btn-settings').click();
      await page.locator('#setting-motion').check();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      await advance(page, 400);
      check((await game(page)).target.nextKey === 's', 'The next task begins');
      const opacity = await page.evaluate(() => getComputedStyle(document.querySelector('#prompt-picture')).opacity);
      check(opacity === '1', 'Turning motion off mid-transition never leaves the picture hidden');
      check((await game(page)).particles === 0, 'Turning motion off clears particles at once');
      await page.locator('#btn-settings').click();
      await page.locator('#setting-motion').uncheck();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => { const s = JSON.parse(render_game_to_text()); return !s.dialog && s.mode !== 'paused'; });
      await page.keyboard.press('s');
      await page.waitForFunction(() => JSON.parse(render_game_to_text()).particles === 0, null, { timeout:4000 });
      check(true, 'Particles drain and the canvas loop stops');
      await completeRound(page);
      await page.waitForTimeout(1400);
      check((await game(page)).particles > 0, 'The result celebrates with confetti');
      check(await page.locator('#result-title').getAttribute('aria-label') === 'やったね！ ぜんぶ できた！', 'The animated title keeps one readable label');
      await page.locator('#btn-again').click();
      check((await game(page)).mode === 'playing', 'The glowing replay button stays an easy, still target');
    }, { reducedMotion:'no-preference' });

    await scenario('all sixteen stickers and repeat sessions', async (page) => {
      await page.goto(origin);
      await page.locator('#btn-start').click();
      const observedKeys = new Set();
      for (let round = 0; round < 17; round++) {
        await completeRound(page, false, observedKeys);
        const state = await game(page);
        check(state.stickers.length === Math.min(round + 1, 16), 'Each complete session adds at most one new sticker');
        check(new Set(state.stickers).size === state.stickers.length, 'Collection has no duplicates');
        if (round < 16) await page.locator('#btn-again').click();
      }
      check(observedKeys.size === 26, 'Repeated letter lessons introduce every letter A through Z');
      check(await page.locator('#reward-label').textContent() === 'ピピも はくしゅ！ すてきだったよ。', 'Play continues warmly after the collection is complete');
      await page.locator('#btn-collection').click();
      check(await page.locator('.sticker:not(.locked)').count() === 16, 'All sixteen artwork rewards are visible');
      await shot(page, `${engine}-collection-complete`);
    });

    await scenario('storage and missing audio degrade gracefully', async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(Storage.prototype, 'getItem', {value:() => { throw new Error('storage blocked'); }});
        Object.defineProperty(Storage.prototype, 'setItem', {value:() => { throw new Error('storage blocked'); }});
        Object.defineProperty(window, 'AudioContext', {value:undefined});
        Object.defineProperty(window, 'webkitAudioContext', {value:undefined});
      });
      await page.goto(origin);
      await page.locator('#btn-start').click();
      await completeRound(page);
      check((await game(page)).stickers.length === 1 && !(await game(page)).storageAvailable, 'Blocked storage keeps the game and session reward working');
      check(!(await game(page)).audio.available, 'Unsupported audio is reported honestly');
      check(await page.locator('#system-message').isVisible(), 'A readable fallback message is shown');
    });

    await scenario('malformed saved values are validated', async (page) => {
      await page.addInitScript(() => localStorage.setItem('type-sonata:music-room:v1', JSON.stringify({ stickers:['star','star','unexpected'], rounds:{letters:-30}, settings:{volume:900,lowercase:'yes',muted:false} })));
      await page.goto(origin);
      check((await game(page)).stickers.join(',') === 'star', 'Invalid and duplicate sticker identifiers are ignored');
      check((await game(page)).settings.volume === 1 && !(await game(page)).settings.lowercase, 'Stored settings are type checked and bounded');
      await page.locator('#btn-start').click();
      check((await game(page)).target.nextKey === 'a', 'Invalid history cannot break the next lesson');
    });

    await scenario('classic recital remains playable', async (page) => {
      await page.goto(origin + '/concert.html');
      await page.locator('[data-level="easy"]').click();
      await advance(page, 2700);
      let state = await game(page);
      if (!state.target) { await advance(page, 400); state = await game(page); }
      check(state.mode === 'playing' && state.target, 'Classic countdown starts a live recital');
      await page.locator('#btn-pause').click();
      const paused = await game(page);
      await advance(page, 10000);
      check((await game(page)).target.x === paused.target.x, 'Classic pause freezes moving words');
      await page.locator('#btn-pause').click();
      const target = (await game(page)).target;
      const wrong = target.word[0] === 'z' ? 'x' : 'z';
      await page.keyboard.press(wrong);
      await page.keyboard.press(target.word[0]);
      check((await game(page)).target.typed === 0, 'Classic retains the 850ms error recovery');
      await advance(page, 900);
      let guard = 0;
      while ((await game(page)).mode !== 'result') {
        check(guard++ < 80, 'Classic recital reaches its result');
        const s = await game(page);
        if (!s.target) { await advance(page, 3500); continue; }
        await page.keyboard.type(s.target.word.slice(s.target.typed));
        await advance(page, 100);
      }
      check((await game(page)).progress.resolved === 12, 'Classic still completes all 12 words');
      check(!(await page.locator('#review-list').textContent()).includes('ノーミス'), 'An incorrect keystroke cannot be labeled a no-mistake run');
      await page.locator('#btn-title').click();
      check((await game(page)).mode === 'title', 'Classic text state returns to the title correctly');
    });

    if (engine === 'chromium') {
      await scenario('rendered piano signal and silent mute', async (page) => {
        await page.goto(origin);
        const metrics = await page.evaluate(async () => {
          const offline = new OfflineAudioContext(1, 48000 * 3, 48000);
          window.AudioContext = function () { return offline; };
          AudioEngine.init();
          AudioEngine.playNote(69, { gain:0.32, dur:1.25 });
          const rendered = await offline.startRendering();
          const samples = rendered.getChannelData(0);
          let peak=0, energy=0, tail=0;
          for (let i=0;i<samples.length;i++) { peak=Math.max(peak,Math.abs(samples[i])); energy+=samples[i]*samples[i]; if(i>96000)tail=Math.max(tail,Math.abs(samples[i])); }
          return {peak,rms:Math.sqrt(energy/samples.length),tail,voices:AudioEngine.getStatus().voices};
        });
        check(metrics.peak > 0.01 && metrics.peak < 0.95 && metrics.rms > 0.003, 'Piano produces a non-silent signal with headroom');
        check(metrics.tail < 0.00001 && metrics.voices === 0, 'Piano tails decay and audio nodes are released');
        await page.reload();
        const silence = await page.evaluate(async () => {
          const offline = new OfflineAudioContext(1, 48000, 48000);
          window.AudioContext = function () { return offline; };
          AudioEngine.setMuted(true); AudioEngine.init(); AudioEngine.playNote(60);
          const rendered=await offline.startRendering();
          return rendered.getChannelData(0).every((sample)=>sample===0);
        });
        check(silence, 'Muted piano renders exact silence');
        const sounds = {};
        for (const name of ['piano', 'musicbox', 'marimba', 'flute', 'kick', 'tick', 'shaker']) {
          await page.reload();
          sounds[name] = await page.evaluate(async (name) => {
            const offline = new OfflineAudioContext(1, 48000 * 3, 48000);
            window.AudioContext = function () { return offline; };
            AudioEngine.init();
            if (AudioEngine.timbres.includes(name)) AudioEngine.playNote(64, { timbre:name }); else AudioEngine.playDrum(name);
            const rendered = await offline.startRendering();
            const samples = rendered.getChannelData(0);
            let peak = 0, tail = 0;
            for (let i = 0; i < samples.length; i++) { peak = Math.max(peak, Math.abs(samples[i])); if (i > 120000) tail = Math.max(tail, Math.abs(samples[i])); }
            return { peak, tail, voices:AudioEngine.getStatus().voices };
          }, name);
        }
        for (const [name, m] of Object.entries(sounds)) {
          check(m.peak > 0.005 && m.peak < 0.95, `${name} is audible with headroom (peak ${m.peak.toFixed(3)})`);
          check(m.tail < 0.00001 && m.voices === 0, `${name} decays fully and releases its nodes`);
        }
        await fs.writeFile(path.join(out, 'audio-timbres.json'), JSON.stringify(sounds, null, 2));
        await fs.writeFile(path.join(out, 'audio-metrics.json'), JSON.stringify(metrics, null, 2));
      });
    }
    await browser.close();
  }
  const suffix = process.env.TEST_MATCH ? '-' + process.env.TEST_MATCH.replaceAll(/\W+/g, '-') : '';
  await fs.writeFile(path.join(out, `report-${engines.join('-')}${suffix}.json`), JSON.stringify({ assertions, scenarios:results }, null, 2));
  console.log(`${results.length} scenarios passed; ${assertions} assertions. Screenshots: ${out}`);
} finally {
  await Promise.allSettled(browsers.filter((browser) => browser.isConnected()).map((browser) => browser.close()));
  server.close();
}
