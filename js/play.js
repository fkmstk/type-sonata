// TYPE SONATA · Music room for a child's first keystrokes.
// DOM-based so letters, focus, zoom, and touch remain native and accessible.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const STORAGE_KEY = 'type-sonata:music-room:v1';
  const ROUND_LENGTH = 6;
  const RECOVERY_MS = 850;
  const CELEBRATION_MS = 1450;
  const IDLE_HINT_MS = 6000;
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const ALL_KEYS = ROWS.join('');
  const LETTER_SETS = ['asdfjk', 'ghruei', 'qwtopy', 'zxcvbn', 'lmasdf'];
  const NOTE_SCALE = [0, 2, 4, 7, 9];
  const BEAT_MS = 430;
  // Public-domain folk melodies, one note per correct key. [midi, beats, phrase end]
  const SONGS = {
    twinkle: { name:'きらきらぼし', notes:[
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2,1],[65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2,1],
      [67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2,1],[67,1],[67,1],[65,1],[65,1],[64,1],[64,1],[62,2,1],
      [60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2,1],[65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2,1]] },
    frog: { name:'かえるのうた', notes:[
      [60,1],[62,1],[64,1],[65,1],[64,1],[62,1],[60,2,1],[64,1],[65,1],[67,1],[69,1],[67,1],[65,1],[64,2,1],
      [60,2],[60,2],[60,2],[60,2,1],[60,.5],[60,.5],[62,.5],[62,.5],[64,.5],[64,.5],[65,.5],[65,.5],[64,1],[62,1],[60,2,1]] },
    mary: { name:'メリーさんの ひつじ', notes:[
      [64,1.5],[62,.5],[60,1],[62,1],[64,1],[64,1],[64,2,1],[62,1],[62,1],[62,2,1],[64,1],[67,1],[67,2,1],
      [64,1.5],[62,.5],[60,1],[62,1],[64,1],[64,1],[64,1],[64,1],[62,1],[62,1],[64,1],[62,1],[60,4,1]] },
    london: { name:'ロンドンばし', notes:[
      [67,1.5],[69,.5],[67,1],[65,1],[64,1],[65,1],[67,2,1],[62,1],[64,1],[65,2],[64,1],[65,1],[67,2,1],
      [67,1.5],[69,.5],[67,1],[65,1],[64,1],[65,1],[67,2,1],[62,2],[67,2],[64,1],[60,3,1]] },
  };
  const KEY_NAMES = { a:'エー', b:'ビー', c:'シー', d:'ディー', e:'イー', f:'エフ', g:'ジー', h:'エイチ', i:'アイ', j:'ジェー', k:'ケー', l:'エル', m:'エム', n:'エヌ', o:'オー', p:'ピー', q:'キュー', r:'アール', s:'エス', t:'ティー', u:'ユー', v:'ブイ', w:'ダブリュー', x:'エックス', y:'ワイ', z:'ゼット' };
  const WORDS = [
    { text:'cat', name:'ねこ', icon:'cat' }, { text:'dog', name:'いぬ', icon:'dog' },
    { text:'sun', name:'おひさま', icon:'sun' }, { text:'egg', name:'たまご', icon:'egg' },
    { text:'bus', name:'ばす', icon:'bus' }, { text:'hat', name:'ぼうし', icon:'hat' },
    { text:'pig', name:'ぶた', icon:'pig' }, { text:'fox', name:'きつね', icon:'fox' },
    { text:'bee', name:'はち', icon:'bee' }, { text:'car', name:'くるま', icon:'car' },
    { text:'star', name:'ほし', icon:'star' }, { text:'moon', name:'つき', icon:'moon' },
    { text:'fish', name:'さかな', icon:'fish' }, { text:'duck', name:'あひる', icon:'duck' },
    { text:'cake', name:'ケーキ', icon:'cake' }, { text:'tree', name:'き', icon:'tree' },
  ];
  const INSTRUMENTS = { piano:'ピアノ', musicbox:'オルゴール', marimba:'もっきん', flute:'ふえ' };
  const SOLFA = ['ど', 'ど', 'れ', 'れ', 'み', 'ふぁ', 'ふぁ', 'そ', 'そ', 'ら', 'ら', 'し'];
  const STAFF_STEP = 40;
  // Free-play groove: a soft four-bar loop (C - Am - F - G) the child plays over.
  const GROOVE_BEAT_MS = 600;
  const GROOVE = [
    { bass:48, chord:[55, 60, 64] }, { bass:45, chord:[55, 60, 64] },
    { bass:41, chord:[57, 60, 65] }, { bass:43, chord:[55, 59, 62] },
  ];
  const SHORT_WORDS = WORDS.filter((word) => word.text.length === 3);
  const LONG_WORDS = WORDS.filter((word) => word.text.length > 3);
  const LETTER_FRIENDS = ['cat', 'dog', 'pig', 'duck', 'fox', 'bee'];
  const LESSON_NAMES = { letters:'1もじ ぽんっ', words:'ことば ぽんぽん', free:'じゆうに ピアノ' };
  const STICKERS = [
    { id:'star', name:'きらきら' }, { id:'pipi', name:'ピピ' }, { id:'flower', name:'おはな' },
    { id:'cat', name:'ねこ' }, { id:'rainbow', name:'にじ' }, { id:'piano', name:'ピアノ' },
    { id:'sun', name:'おひさま' }, { id:'moon', name:'おつきさま' },
    { id:'dog', name:'いぬ' }, { id:'fish', name:'さかな' }, { id:'duck', name:'あひる' },
    { id:'cake', name:'ケーキ' }, { id:'bee', name:'みつばち' }, { id:'fox', name:'きつね' },
    { id:'car', name:'くるま' }, { id:'tree', name:'き' },
  ];
  // Each word friend answers in its own voice and moves in its own way.
  const FRIEND_VOICES = {
    cat:['にゃーん！', 'stretch'], dog:['わんわん！', 'wag'], pig:['ぶーぶー！', 'bounce'], duck:['ガーガー！', 'waddle'],
    fox:['コンコン！', 'hop'], bee:['ブーン！', 'buzz'], fish:['すいすい〜', 'swim'], bus:['ブッブー！', 'drive'],
    car:['ブブーン！', 'drive'], sun:['ぽかぽか〜', 'spin'], moon:['おやすみ〜', 'swing'], star:['きらりん！', 'spin'],
    egg:['ぴよっ！', 'crack'], hat:['ぽんっ！', 'flip'], cake:['いただきます！', 'bounce'], tree:['さわさわ〜', 'swing'],
  };
  const FRIEND_MOVES = {
    stretch:[{ transform:'none' }, { transform:'scale(1.25, .78)', offset:.25 }, { transform:'translateY(-14px) scale(.85, 1.25)', offset:.55 }, { transform:'scale(1.05, .95)', offset:.8 }, { transform:'none' }],
    wag:[{ transform:'none' }, { transform:'rotate(-14deg)', offset:.15 }, { transform:'rotate(14deg)', offset:.35 }, { transform:'rotate(-11deg)', offset:.55 }, { transform:'rotate(9deg)', offset:.75 }, { transform:'none' }],
    bounce:[{ transform:'none' }, { transform:'translateY(-30px) scale(.92, 1.1)', offset:.2 }, { transform:'scale(1.15, .85)', offset:.38 }, { transform:'translateY(-18px)', offset:.58 }, { transform:'scale(1.1, .9)', offset:.76 }, { transform:'none' }],
    waddle:[{ transform:'none' }, { transform:'translateX(-10px) rotate(-12deg)', offset:.2 }, { transform:'translateX(0) rotate(0)', offset:.35 }, { transform:'translateX(10px) rotate(12deg)', offset:.55 }, { transform:'translateX(0) rotate(0)', offset:.7 }, { transform:'translateX(-6px) rotate(-8deg)', offset:.85 }, { transform:'none' }],
    hop:[{ transform:'none' }, { transform:'translate(-8px, -26px) rotate(-10deg)', offset:.25 }, { transform:'translate(0, 0)', offset:.45 }, { transform:'translate(8px, -26px) rotate(10deg)', offset:.7 }, { transform:'none' }],
    buzz:[{ transform:'none' }, { transform:'translate(14px, -12px) rotate(10deg)', offset:.15 }, { transform:'translate(-16px, -4px) rotate(-12deg)', offset:.32 }, { transform:'translate(12px, -20px) rotate(8deg)', offset:.5 }, { transform:'translate(-10px, -10px) rotate(-6deg)', offset:.7 }, { transform:'translate(6px, -4px)', offset:.86 }, { transform:'none' }],
    swim:[{ transform:'none' }, { transform:'translate(-22px, -8px) rotate(-8deg)', offset:.25 }, { transform:'translate(0, 6px) rotate(6deg)', offset:.5 }, { transform:'translate(22px, -8px) rotate(-8deg)', offset:.75 }, { transform:'none' }],
    drive:[{ transform:'none' }, { transform:'translateX(-14px) rotate(3deg)', offset:.2 }, { transform:'translateX(44px) rotate(-2deg)', offset:.5 }, { transform:'translateX(44px) translateY(-6px)', offset:.6 }, { transform:'translateX(-6px) rotate(2deg)', offset:.85 }, { transform:'none' }],
    spin:[{ transform:'none' }, { transform:'scale(1.25) rotate(180deg)', offset:.45 }, { transform:'scale(1.1) rotate(340deg)', offset:.75 }, { transform:'rotate(360deg)' }],
    swing:[{ transform:'none' }, { transform:'rotate(-18deg)', offset:.2 }, { transform:'rotate(15deg)', offset:.45 }, { transform:'rotate(-9deg)', offset:.7 }, { transform:'rotate(4deg)', offset:.88 }, { transform:'none' }],
    crack:[{ transform:'none' }, { transform:'rotate(-6deg)', offset:.1 }, { transform:'rotate(6deg)', offset:.2 }, { transform:'rotate(-6deg)', offset:.3 }, { transform:'rotate(5deg)', offset:.4 }, { transform:'translateY(-22px) scale(1.25)', offset:.65 }, { transform:'none' }],
    flip:[{ transform:'none' }, { transform:'translateY(-34px) rotate(-180deg) scale(1.1)', offset:.45 }, { transform:'translateY(0) rotate(-360deg) scale(1.1, .9)', offset:.8 }, { transform:'rotate(-360deg)' }],
  };
  const POKE_LINES = ['くすぐったい〜！', 'えへへ ♪', 'ぴぴっ！', 'なあに？', 'もっと あそぼ！', 'うふふ ♡', 'ぴょーん！'];
  const POKE_MOVES = [
    [{ transform:'none' }, { transform:'translateY(-34px) rotate(-180deg) scale(.9, 1.1)', offset:.45 }, { transform:'translateY(0) rotate(-360deg) scale(1.12, .88)', offset:.8 }, { transform:'rotate(-360deg)' }],
    [{ transform:'none' }, { transform:'translateX(-5px) rotate(-6deg)', offset:.12 }, { transform:'translateX(5px) rotate(6deg)', offset:.25 }, { transform:'translateX(-5px) rotate(-6deg)', offset:.38 }, { transform:'translateX(5px) rotate(6deg)', offset:.5 }, { transform:'translateX(-3px)', offset:.7 }, { transform:'none' }],
    [{ transform:'none' }, { transform:'scale(1.3, .7)', offset:.25 }, { transform:'translateY(-44px) scale(.85, 1.2)', offset:.55 }, { transform:'scale(1.12, .88)', offset:.82 }, { transform:'none' }],
  ];
  const BALLOON_COLORS = ['#e8786c', '#efb552', '#78af91', '#b4a4c9', '#7fb3c8', '#f2a0b5'];
  const PRAISE = ['いい おと！', 'できたね！', 'その ちょうし！', 'すてきな おと！', 'あと ひとつ！', 'ぜんぶ できた！'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let storageAvailable = true;
  let storageNoticeShown = false;
  let selectedLesson = 'letters';
  let selectedSong = 'twinkle';
  let screen = 'home';
  let state = null;
  let lastFrame = performance.now();
  let messageTimer = null;
  let playback = null;
  let dialogOpener = null;
  const keys = new Map();
  const pianoKeys = new Map();
  const transientTimers = new Set();
  const profile = loadProfile();

  function loadProfile() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
    catch { storageAvailable = false; }
    const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const boundedCount = (value) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000) : 0;
    return {
      stickers: Array.isArray(raw.stickers) ? [...new Set(raw.stickers.filter((id) => STICKERS.some((s) => s.id === id)))] : [],
      rounds: { letters:boundedCount(raw.rounds?.letters), words:boundedCount(raw.rounds?.words), free:boundedCount(raw.rounds?.free) },
      // Where each song was left, so the next round carries the tune onward.
      songProgress: Object.fromEntries(Object.keys(SONGS).map((id) => [id, boundedCount(raw.songProgress?.[id]) % SONGS[id].notes.length])),
      songsCompleted: Object.fromEntries(Object.keys(SONGS).map((id) => [id, boundedCount(raw.songsCompleted?.[id])])),
      settings: {
        volume: typeof settings.volume === 'number' && Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : 0.55,
        muted: settings.muted === true, lowercase: settings.lowercase === true,
        reducedMotion: typeof settings.reducedMotion === 'boolean' ? settings.reducedMotion : reducedMotion.matches,
        song: Object.hasOwn(SONGS, settings.song) ? settings.song : 'twinkle',
        instrument: Object.hasOwn(INSTRUMENTS, settings.instrument) ? settings.instrument : 'piano',
        groove: settings.groove !== false,
      },
    };
  }
  function saveProfile() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); storageAvailable = true; }
    catch {
      storageAvailable = false;
      if (!storageNoticeShown) {
        notify('このブラウザでは シールを ほぞんできないよ。あそぶことは できるよ。');
        storageNoticeShown = true;
      }
    }
  }
  function notify(message) {
    clearTimeout(messageTimer);
    $('#system-message').textContent = message;
    $('#system-message').hidden = false;
    messageTimer = setTimeout(() => { $('#system-message').hidden = true; }, 6500);
  }
  function after(delay, fn) {
    const timer = setTimeout(() => { transientTimers.delete(timer); fn(); }, delay);
    transientTimers.add(timer);
  }
  function clearEffects({ keepParticles = false } = {}) {
    transientTimers.forEach(clearTimeout);
    transientTimers.clear();
    if (!keepParticles) FX.clear();
    document.querySelectorAll('.fx-dom').forEach((el) => el.remove());
    document.querySelectorAll('.pressed, .lit').forEach((el) => el.classList.remove('pressed', 'lit'));
  }
  function displayed(ch) { return profile.settings.lowercase ? ch : ch.toUpperCase(); }
  function icon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `assets/art.svg#${id}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(use);
    return svg;
  }
  function setPicture(selector, id) {
    const use = $(`${selector} use`);
    const href = `assets/art.svg#${id}`;
    // Reassigning an identical external SVG href can flash the picture blank.
    if (use.getAttribute('href') !== href) use.setAttribute('href', href);
  }
  function applySettings() {
    AudioEngine.setVolume(profile.settings.volume);
    AudioEngine.setMuted(profile.settings.muted);
    document.body.classList.toggle('reduce-motion', profile.settings.reducedMotion);
    if (!motionAllowed()) {
      // Stop scripted motion immediately; CSS motion is removed by the body class.
      document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).forEach((a) => a.cancel());
      FX.clear();
      document.querySelectorAll('.fx-dom').forEach((el) => el.remove());
    }
    const audible = !profile.settings.muted && profile.settings.volume > 0;
    $('#btn-sound').setAttribute('aria-pressed', String(audible));
    $('#btn-sound').setAttribute('aria-label', audible ? 'おとを けす' : 'おとを だす');
    $('#btn-sound .sound-icon').textContent = audible ? '♫' : '♩';
    $('#btn-sound .sound-label').textContent = audible ? 'おと' : 'OFF';
    $('#setting-volume').value = Math.round(profile.settings.volume * 100);
    $('#volume-value').textContent = `${Math.round(profile.settings.volume * 100)}%`;
    $('#setting-lowercase').checked = profile.settings.lowercase;
    $('#setting-motion').checked = profile.settings.reducedMotion;
    keys.forEach((el, ch) => { el.textContent = displayed(ch); });
    if (screen === 'play') { renderPrompt(); updateKeys(); }
    if (!audible) { stopPlayback(); AudioEngine.stopAll(); }
    updateListenButton();
  }
  function initAudio() {
    if (!AudioEngine.init()) notify('このブラウザでは おとが でないけれど、もじで あそべるよ。');
  }
  function showScreen(next) {
    screen = next;
    document.body.dataset.screen = next;
    for (const name of ['home', 'play', 'result']) $(`#screen-${name}`).hidden = name !== next;
    window.scrollTo({ top:0, behavior:'instant' });
    const focus = next === 'play' ? $('#play-title') : next === 'result' ? $('#result-title') : $('#btn-start');
    focus.setAttribute('tabindex', next === 'home' ? '0' : '-1');
    focus.focus({ preventScroll:true });
  }
  function selectLesson(lesson) {
    if (!Object.hasOwn(LESSON_NAMES, lesson)) return;
    selectedLesson = lesson;
    document.querySelectorAll('.lesson-card').forEach((button) => {
      const selected = button.dataset.lesson === lesson;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#btn-start').setAttribute('aria-label', `${LESSON_NAMES[lesson]}で あそびに いく`);
    $('#song-section').hidden = lesson === 'free';
  }
  function selectSong(song) {
    if (!Object.hasOwn(SONGS, song)) return;
    selectedSong = song;
    document.querySelectorAll('.song-chip').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.song === song)));
  }
  function updateSongChips() {
    document.querySelectorAll('.song-chip').forEach((button) => {
      const id = button.dataset.song;
      const percent = Math.round((profile.songProgress[id] / SONGS[id].notes.length) * 100);
      button.querySelector('.chip-progress i').style.width = `${percent}%`;
      button.dataset.completed = profile.songsCompleted[id] ? `★${profile.songsCompleted[id]}` : '';
      button.setAttribute('aria-label', `${SONGS[id].name}。${profile.songsCompleted[id] ? `${profile.songsCompleted[id]}かい さいごまで ひけたよ。` : ''}いま ${percent}パーセント`);
    });
  }
  function selectInstrument(instrument) {
    if (!Object.hasOwn(INSTRUMENTS, instrument)) return;
    profile.settings.instrument = instrument;
    document.querySelectorAll('.instrument-chip').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.instrument === instrument)));
  }
  function wordsForRound(round) {
    // First rounds stay with three-letter words; later rounds mix in four letters.
    const pick = (list, count, offset) => Array.from({ length:count }, (_, i) => list[(offset + i) % list.length]);
    if (round < 2) return pick(SHORT_WORDS, ROUND_LENGTH, round * ROUND_LENGTH);
    const words = pick(SHORT_WORDS, 4, round * 4);
    words.splice(2, 0, LONG_WORDS[(round * 2) % LONG_WORDS.length]);
    words.push(LONG_WORDS[(round * 2 + 1) % LONG_WORDS.length]);
    return words;
  }
  function startGame(lesson = selectedLesson) {
    if (!Object.hasOwn(LESSON_NAMES, lesson)) return;
    stopPlayback(); clearEffects(); AudioEngine.stopAll(); initAudio();
    selectedLesson = lesson;
    if (profile.settings.song !== selectedSong) { profile.settings.song = selectedSong; saveProfile(); }
    const round = profile.rounds[lesson];
    const steps = lesson === 'letters'
      ? [...LETTER_SETS[round % LETTER_SETS.length]].map((text, i) => ({ text, name:'', icon:LETTER_FRIENDS[i % LETTER_FRIENDS.length] }))
      : lesson === 'words' ? wordsForRound(round).map((word) => ({ ...word })) : [];
    const song = lesson === 'free' ? null : selectedSong;
    const songPos = song ? profile.songProgress[song] : 0;
    state = { lesson, song, songPos, songStart:songPos, songCompleted:false, groove:lesson === 'free' && profile.settings.groove, grooveClock:0, grooveBeat:0, steps, index:0, typed:0, done:0, correct:0, attempts:0, elapsed:0, recovery:0, celebration:0, phase:'playing', paused:false, notes:[], earnedSticker:null, rewarded:false, streak:0, idle:0, balloonsPopped:0 };
    $('#play-title').textContent = LESSON_NAMES[lesson];
    $('#play-song').hidden = !song;
    if (song) $('#play-song-name').textContent = SONGS[song].name;
    buildStaff();
    $('#btn-groove').hidden = lesson !== 'free';
    updateGrooveButton();
    $('#screen-play').classList.toggle('free-play', lesson === 'free');
    $('#keyboard').parentElement.classList.remove('expanded');
    $('#btn-keyboard').textContent = 'ぜんぶの キーを みる';
    $('#btn-keyboard').setAttribute('aria-expanded', 'false');
    $('#btn-free-finish').hidden = lesson !== 'free';
    $('#keyboard-hint-text').textContent = lesson === 'free' ? 'どの キーでも、すきな おとを ぽんっ' : 'ひかる キーが つぎの おと';
    $('#play-overline').textContent = lesson === 'free' ? 'すきな おとで、すきなだけ' : 'ひとつずつ、じぶんの ペースで';
    $('#play-reassurance').textContent = lesson === 'free' ? '12この おとを ならすと、シールが もらえるよ。' : 'ゆっくりで だいじょうぶ。ピピも まってるよ。';
    $('#screen-play').classList.toggle('has-staff', !!song);
    showScreen('play');
    beginStep();
    animateKeyboardIn();
    lastFrame = performance.now();
  }
  function current() { return state?.steps[state.index] || null; }
  function beginStep() {
    state.typed = 0;
    state.recovery = 0;
    state.idle = 0;
    state.phase = 'playing';
    $('#prompt-card').classList.remove('celebrating', 'recovering');
    $('#coach-text').textContent = state.lesson === 'free' ? 'すきな キーを おしてみよう！' : state.index === 0 ? 'ひかる キーを おしてね' : 'つぎは どの おとかな？';
    state.leaving = false;
    renderPrompt(); renderJourney(); updateKeys();
    animateStepIn();
  }
  function renderPrompt() {
    if (!state) return;
    const free = state.lesson === 'free';
    const item = current();
    const letters = $('#prompt-letters');
    letters.replaceChildren();
    letters.classList.toggle('single', state.lesson === 'letters');
    if (free) {
      setPicture('#prompt-picture', 'piano');
      letters.textContent = state.correct ? `${state.correct} ♪` : '♪ ♫';
      $('#prompt-meaning').textContent = state.correct ? 'きみだけの メロディー' : 'どんな おとに なるかな？';
      $('#prompt-tag').textContent = 'どの キーでも あそべるよ';
      $('#prompt-hint').textContent = 'おしまいの ときは「おしまい」を おしてね';
      $('#word-progress').textContent = '';
      return;
    }
    if (!item) return;
    setPicture('#prompt-picture', item.icon);
    $('#prompt-tag').textContent = state.lesson === 'letters' ? 'おなじ もじを みつけよう' : 'ひだりから ひとつずつ おしてね';
    for (const [index, ch] of [...item.text].entries()) {
      const span = document.createElement('span');
      span.textContent = displayed(ch);
      span.className = `prompt-letter ${index < state.typed ? 'done' : index === state.typed ? 'current' : ''}`;
      letters.appendChild(span);
    }
    letters.setAttribute('aria-label', [...item.text].map(displayed).join(' '));
    $('#prompt-meaning').textContent = state.phase === 'celebrating' ? 'できた！' : item.name;
    $('#prompt-hint').textContent = state.phase === 'celebrating' ? 'いい おとが つながったね ♪' : state.recovery > 0 ? 'だいじょうぶ。ゆっくり もういちど。' : `「${displayed(item.text[state.typed])}」の キーを ぽんっ！`;
    $('#word-progress').textContent = item.text.length > 1 ? '●'.repeat(state.typed) + '○'.repeat(item.text.length - state.typed) : '';
  }
  function renderJourney() {
    const dots = $('#journey-dots');
    dots.replaceChildren();
    const free = state.lesson === 'free';
    const amount = free ? Math.min(6, Math.floor(state.correct / 2)) : state.done;
    for (let i = 0; i < ROUND_LENGTH; i++) {
      const dot = document.createElement('span');
      dot.className = `journey-dot ${i < amount ? 'done' : i === amount ? 'current' : ''}`;
      dot.textContent = i < amount ? '♪' : '·';
      dot.setAttribute('aria-hidden', 'true');
      dots.appendChild(dot);
    }
    const goal = document.createElement('span');
    goal.className = `journey-goal${amount >= ROUND_LENGTH ? ' reached' : amount === ROUND_LENGTH - 1 ? ' near' : ''}`;
    goal.setAttribute('aria-hidden', 'true');
    goal.appendChild(icon('gift'));
    dots.appendChild(goal);
    $('#journey-label').textContent = free ? `${Math.min(state.correct, 12)} / 12 ♪` : `${state.done} / ${ROUND_LENGTH}`;
    $('#journey').setAttribute('aria-label', free ? `${state.correct}この おと` : `6このうち ${state.done}こ できた`);
  }
  function buildKeyboard() {
    const keyboard = $('#keyboard');
    keyboard.replaceChildren();
    for (const row of ROWS) {
      const line = document.createElement('div');
      line.className = 'keyboard-row';
      for (const ch of row) {
        const key = makeKey(ch);
        key.dataset.finger = 'qazp'.includes(ch) ? '1' : 'wsxol'.includes(ch) ? '2' : 'edcik'.includes(ch) ? '3' : '4';
        if ('fj'.includes(ch)) key.classList.add('homing');
        keys.set(ch, key);
        line.appendChild(key);
      }
      keyboard.appendChild(line);
    }
    const strip = $('#piano-strip');
    for (let midi = 48; midi < 84; midi++) {
      if ([1, 3, 6, 8, 10].includes(midi % 12)) continue;
      const white = document.createElement('span');
      white.className = 'piano-white';
      pianoKeys.set(midi, white);
      if ([0, 2, 5, 7, 9].includes(midi % 12)) {
        const black = document.createElement('i');
        black.className = 'piano-black';
        white.appendChild(black);
        pianoKeys.set(midi + 1, black);
      }
      strip.appendChild(white);
    }
  }
  function makeKey(ch) {
    const button = document.createElement('button');
    button.className = 'keyboard-key';
    button.type = 'button';
    button.dataset.key = ch;
    button.textContent = displayed(ch);
    button.setAttribute('aria-label', `${displayed(ch)} のキー`);
    button.addEventListener('click', () => handleChar(ch));
    return button;
  }
  function updateKeys() {
    if (!state) return;
    const available = screen === 'play' && !state.paused && state.phase === 'playing' && state.recovery <= 0;
    const word = current()?.text;
    // Keep the three touch keys in place while celebrating the last letter.
    const next = state.lesson === 'free' ? null : word?.[Math.min(state.typed, word.length - 1)];
    keys.forEach((el, ch) => {
      el.classList.toggle('next', ch === next && state.phase === 'playing');
      el.disabled = !available;
      el.tabIndex = next ? (ch === next ? 0 : -1) : 0;
      el.setAttribute('aria-label', `${displayed(ch)} のキー${ch === next ? '、つぎは これ' : ''}`);
    });
    const choices = $('#touch-choices');
    const previous = choices.dataset.keys || '';
    choices.replaceChildren();
    choices.dataset.keys = '';
    if (next) {
      const index = ALL_KEYS.indexOf(next);
      const alternatives = [ALL_KEYS[(index + 7) % 26], ALL_KEYS[(index + 15) % 26]];
      alternatives.splice((index + state.index + state.typed) % 3, 0, next);
      for (const ch of alternatives) {
        const button = makeKey(ch);
        button.classList.toggle('next', ch === next);
        button.disabled = !available;
        choices.appendChild(button);
      }
      choices.dataset.keys = alternatives.join('');
      if (choices.dataset.keys !== previous && motionAllowed()) {
        [...choices.children].forEach((button, i) => button.animate([{ transform:'translateY(16px) scale(.5)', opacity:0 }, { transform:'scale(1.08)', opacity:1, offset:.65 }, { transform:'none', opacity:1 }], { duration:380, delay:i * 70, easing:'ease-out', fill:'backwards' }));
      }
    }
    lookAt(next ? visibleKey(next) : null);
  }
  function flashKey(ch, midi) {
    document.querySelectorAll(`.keyboard-key[data-key="${ch}"]`).forEach((el) => {
      el.classList.add('pressed');
      after(180, () => el.classList.remove('pressed'));
    });
    const piano = pianoKeys.get(midi);
    if (piano) { piano.classList.add('lit'); after(350, () => piano.classList.remove('lit')); }
  }
  function motionAllowed() { return !profile.settings.reducedMotion && !reducedMotion.matches; }
  // Pipi is inline SVG so wings, eyes and crest can move independently.
  const PIPI_PARTS = `<g class="pp-all">
    <path d="M49 146v12m53-12v12" stroke="#bd8245" stroke-width="8" stroke-linecap="round"/>
    <path class="pp-crest" d="M62 35Q47 8 70 18q14 4 12 25m-2-13Q86 4 101 15q9 15-13 26" fill="#87bba4"/>
    <path d="M31 86C24 35 62 27 88 32c44 5 45 52 38 87-7 31-81 44-99 13-5-10-1-30 4-46" fill="#88bba4"/>
    <ellipse cx="79" cy="110" rx="36" ry="34" fill="#d4e6c6"/>
    <path class="pp-wing-l" d="M29 87Q-1 89 15 118q11 17 29-6" fill="#62a48e"/>
    <path class="pp-wing-r" d="M124 79q30 2 13 27-9 13-22 3" fill="#62a48e"/>
    <g class="pp-look">
      <path class="pp-eyes" d="M57 66v8m42-8v8" stroke="#30564d" stroke-width="7" stroke-linecap="round"/>
      <path class="pp-happy" d="M51 73q6-8 12 0m30 0q6-8 12 0" fill="none" stroke="#30564d" stroke-width="5" stroke-linecap="round"/>
      <path class="pp-sleep" d="M51 69q6 6 12 0m30 0q6 6 12 0" fill="none" stroke="#30564d" stroke-width="5" stroke-linecap="round"/>
    </g>
    <path class="pp-beak" d="m69 80 12-5 12 5-12 11Z" fill="#e8a74c"/>
    <ellipse class="pp-cheek" cx="45" cy="84" rx="9" ry="5" fill="#eaa795"/><ellipse class="pp-cheek" cx="111" cy="84" rx="9" ry="5" fill="#eaa795"/>
    <path d="m65 125 13 5-12 8m28-14-13 6 13 7" fill="#d38b60"/>
    <path class="pp-sweat" d="M130 40q7 9 0 14-7-5 0-14" fill="#9fd0e3"/>
    <g class="pp-zzz" fill="#7f9c8f" font-family="Georgia, serif" font-weight="700"><text x="120" y="42" font-size="20">z</text><text x="137" y="22" font-size="14">z</text></g>
  </g>`;
  function mountPipis() {
    document.querySelectorAll('svg[data-pipi]').forEach((svg) => {
      svg.setAttribute('viewBox', '0 0 160 170');
      svg.innerHTML = PIPI_PARTS;
    });
  }
  // Squash on take-off, stretch in the air, squash on landing.
  const MOODS = {
    hop: { duration:480, face:['joy', 'flap'], hold:520, frames:[
      { transform:'none' }, { transform:'scale(1.1, .88)', offset:.16 }, { transform:'translateY(-20px) scale(.93, 1.08)', offset:.46 },
      { transform:'translateY(0) scale(1.08, .92)', offset:.76 }, { transform:'scale(.98, 1.02)', offset:.9 }, { transform:'none' }] },
    tilt: { duration:820, face:['worry'], hold:RECOVERY_MS, frames:[
      { transform:'none' }, { transform:'translateX(-4px) rotate(-13deg)', offset:.22 }, { transform:'rotate(9deg)', offset:.5 },
      { transform:'rotate(-4deg)', offset:.75 }, { transform:'none' }] },
    dance: { duration:1150, face:['joy', 'flap'], hold:1250, frames:[
      { transform:'none' }, { transform:'scale(1.12, .86)', offset:.1 }, { transform:'translateY(-30px) rotate(-12deg) scale(.92, 1.1)', offset:.3 },
      { transform:'translateY(0) scale(1.1, .9)', offset:.45 }, { transform:'translateY(-26px) rotate(12deg) scale(.94, 1.08)', offset:.62 },
      { transform:'translateY(0) scale(1.1, .9)', offset:.78 }, { transform:'scale(.97, 1.03)', offset:.9 }, { transform:'none' }] },
  };
  function react(mood, targets = document.querySelectorAll('.coach-pipi')) {
    const spec = MOODS[mood];
    targets.forEach((el) => {
      clearTimeout(el.moodTimer);
      el.classList.remove('joy', 'flap', 'worry');
      el.classList.add(...spec.face);
      el.moodTimer = setTimeout(() => el.classList.remove('joy', 'flap', 'worry'), spec.hold);
      if (!motionAllowed()) return;
      el.getAnimations().forEach((animation) => animation.cancel());
      el.animate(spec.frames, { duration:spec.duration, easing:'ease-in-out' });
    });
  }
  function lookAt(target) {
    // Pipi's eyes follow the glowing key, a quiet hint for where to look.
    const look = document.querySelector('.coach-pipi .pp-look');
    const from = look?.closest('svg').getBoundingClientRect();
    const to = target?.getBoundingClientRect();
    if (!look || !from?.width || !to?.width) { if (look) look.style.transform = ''; return; }
    const clamp = (value) => Math.max(-1, Math.min(1, value));
    const dx = clamp((to.left + to.width / 2 - (from.left + from.width / 2)) / 320) * 5;
    const dy = clamp((to.top + to.height / 2 - (from.top + from.height / 2)) / 320) * 4;
    look.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }
  function visibleKey(ch) {
    return [...document.querySelectorAll(`.keyboard-key[data-key="${ch}"]`)].find((el) => el.offsetParent);
  }
  function pop(el, { scale = 1.25, duration = 420, delay = 0 } = {}) {
    if (!motionAllowed() || !el) return;
    el.animate([{ transform:'none' }, { transform:`scale(${scale})`, offset:.4 }, { transform:`scale(${1 - (scale - 1) * 0.3})`, offset:.7 }, { transform:'none' }], { duration, delay, easing:'ease-out' });
  }
  function animateStepIn() {
    const picture = $('#prompt-picture');
    // Always clear the previous exit so a settings change can never leave it hidden.
    picture.getAnimations().forEach((animation) => animation.cancel());
    if (!motionAllowed()) return;
    picture.animate([
      { transform:'translateY(-36px) scale(.3) rotate(-25deg)', opacity:0 },
      { transform:'translateY(5px) scale(1.1, .9) rotate(4deg)', opacity:1, offset:.55 },
      { transform:'scale(.96, 1.04)', offset:.78 }, { transform:'none', opacity:1 }], { duration:620, easing:'ease-out' });
    [...$('#prompt-letters').children].forEach((el, i) => el.animate([
      { transform:'translateY(26px) scale(.5)', opacity:0 }, { transform:'translateY(-6px) scale(1.12)', opacity:1, offset:.6 }, { transform:'none', opacity:1 }],
      { duration:460, delay:140 + i * 80, easing:'ease-out', fill:'backwards' }));
    $('#prompt-meaning').animate([{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], { duration:320, delay:260, fill:'backwards' });
  }
  function animateStepOut() {
    if (!motionAllowed()) return;
    const timing = { duration:240, easing:'ease-in', fill:'forwards' };
    $('#prompt-picture').animate([{ transform:'none', opacity:1 }, { transform:'translateY(-10px) scale(.4) rotate(18deg)', opacity:0 }], timing);
    [...$('#prompt-letters').children].forEach((el, i) => el.animate([{ opacity:1 }, { transform:'translateY(-16px) scale(.6)', opacity:0 }], { ...timing, delay:i * 30 }));
  }
  function animateKeyboardIn() {
    if (!motionAllowed()) return;
    // A left-to-right wave, like fingers running over the keys.
    keys.forEach((el) => {
      const index = ALL_KEYS.indexOf(el.dataset.key);
      const column = index < 10 ? index : index < 19 ? index - 10 + 0.4 : index - 19 + 0.8;
      const row = index < 10 ? 0 : index < 19 ? 1 : 2;
      el.animate([{ transform:'translateY(18px) scale(.6)', opacity:0 }, { transform:'translateY(-4px) scale(1.05)', opacity:1, offset:.65 }, { transform:'none', opacity:1 }],
        { duration:420, delay:120 + column * 28 + row * 40, easing:'ease-out', fill:'backwards' });
    });
  }
  function openGift() {
    const goal = $('.journey-goal');
    if (!goal || !motionAllowed()) return;
    goal.animate([{ transform:'none' }, { transform:'rotate(-14deg) scale(1.15)', offset:.2 }, { transform:'rotate(12deg) scale(1.2)', offset:.4 },
      { transform:'rotate(-8deg) scale(1.3)', offset:.6 }, { transform:'scale(1.6)', opacity:1, offset:.8 }, { transform:'scale(.2)', opacity:0 }], { duration:620, easing:'ease-in-out', fill:'forwards' });
    after(500, () => { FX.burst(goal, { count:26, speed:380, size:18 }); FX.ring(goal, { size:80, color:'#e8786c' }); FX.notes(goal, { count:3 }); });
  }
  function flashWrong(ch) {
    document.querySelectorAll(`.keyboard-key[data-key="${ch}"]`).forEach((el) => {
      el.classList.add('oops');
      after(RECOVERY_MS, () => el.classList.remove('oops'));
    });
  }
  function songNote() {
    const notes = SONGS[state.song].notes;
    const note = notes[state.songPos++ % notes.length];
    if (state.songPos % notes.length === 0) state.songCompleted = true;
    return note;
  }
  function instrument() { return profile.settings.instrument; }
  function chordFor(midi) {
    // Three friendly chords (C, F, G7) cover every note of these folk tunes.
    const pc = midi % 12;
    if ([5, 9].includes(pc)) return { bass:41, pah:[57, 60] };
    if ([2, 11].includes(pc)) return { bass:43, pah:[53, 59] };
    return { bass:48, pah:[52, 55] };
  }
  function accompany(midi, delay = 0, beats = 1) {
    // "Oom-pah": a bass note now, a soft chord just after, so one finger sounds like a band.
    const chord = chordFor(midi);
    AudioEngine.playNote(chord.bass, { gain:0.12, dur:1.1, delay });
    const pah = delay + Math.min(0.24, beats * BEAT_MS / 2000);
    chord.pah.forEach((tone) => AudioEngine.playNote(tone, { gain:0.045, dur:0.5, delay:pah }));
  }
  function diatonic(midi) { return [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][midi % 12] + Math.floor(midi / 12) * 7; }
  function buildStaff() {
    $('#song-staff').hidden = !state.song;
    $('#piano-strip').hidden = !!state.song;
    if (!state.song) return;
    const notes = SONGS[state.song].notes;
    const width = 40 + notes.length * STAFF_STEP + 600;
    const lineY = [12, 20, 28, 36, 44];
    let markup = lineY.map((y) => `<path class="staff-line" d="M0 ${y}H${width}"/>`).join('');
    // Bottom line is E4; each diatonic step is half a line gap (4px).
    notes.forEach(([midi, beats, end], i) => {
      const x = 30 + i * STAFF_STEP;
      const d = diatonic(midi);
      const y = 44 - (d - diatonic(64)) * 4;
      const up = d < diatonic(71);
      const ledger = y >= 52 ? `<path class="staff-line" d="M${x - 10} 52h20"/>` : '';
      const stem = beats >= 4 ? '' : up ? `<path class="stem" d="M${x + 5.3} ${y - 1}V${y - 26}"/>` : `<path class="stem" d="M${x - 5.3} ${y + 1}V${y + 26}"/>`;
      const flag = beats === 0.5 ? `<path class="stem" d="M${x + 5.3} ${y - 26}q8 5 5 14"/>` : '';
      const dot = beats === 1.5 || beats === 3 ? `<circle class="note-dot" cx="${x + 10}" cy="${y - 1}" r="1.8"/>` : '';
      const bar = end ? `<path class="bar-line" d="M${x + STAFF_STEP / 2} 12V44"/>` : '';
      markup += `<g class="staff-note" data-i="${i}">${ledger}${stem}${flag}<ellipse class="head${beats >= 2 ? ' hollow' : ''}" cx="${x}" cy="${y}" rx="5.8" ry="4.2" style="transform-origin:${x}px ${y}px"/>${dot}<text class="solfa" x="${x}" y="68">${SOLFA[midi % 12]}</text></g>${bar}`;
    });
    const svg = $('#staff-notes');
    svg.setAttribute('width', width);
    svg.setAttribute('height', 74);
    svg.setAttribute('viewBox', `0 0 ${width} 74`);
    svg.innerHTML = markup;
    updateStaff(false);
  }
  function updateStaff(animate = true) {
    if (!state?.song) return;
    const notes = SONGS[state.song].notes;
    const pos = state.songPos % notes.length;
    const svg = $('#staff-notes');
    [...svg.querySelectorAll('.staff-note')].forEach((el, i) => {
      el.classList.toggle('played', i < pos);
      el.classList.toggle('current', i === pos);
    });
    // Keep the next note about a third of the way in, so upcoming notes are visible.
    const view = $('.staff-window').clientWidth || 600;
    svg.style.transition = animate ? '' : 'none';
    svg.style.transform = `translateX(${Math.round(view * 0.3 - 30 - pos * STAFF_STEP)}px)`;
    const percent = Math.round((pos / notes.length) * 100);
    $('#song-meter-fill').style.width = `${state.songCompleted && pos === 0 ? 100 : percent}%`;
    if (animate && pos > 0) {
      const played = svg.querySelector(`.staff-note[data-i="${pos - 1}"]`);
      const head = played?.querySelector('.head');
      if (head && motionAllowed()) head.animate([{ transform:'rotate(-20deg)' }, { transform:'rotate(-20deg) scale(1.7)', offset:.4 }, { transform:'rotate(-20deg) scale(.9)', offset:.7 }, { transform:'rotate(-20deg)' }], { duration:380, easing:'ease-out' });
    }
  }
  function updateGrooveButton() {
    const on = !!state?.groove;
    $('#btn-groove').setAttribute('aria-pressed', String(on));
    $('#groove-label').textContent = on ? 'リズム ON' : 'リズム OFF';
  }
  function playGrooveBeat(beat) {
    const bar = GROOVE[Math.floor(beat / 4) % GROOVE.length];
    const inBar = beat % 4;
    if (inBar === 0) {
      AudioEngine.playDrum('kick', { gain:0.22 });
      AudioEngine.playNote(bar.bass, { gain:0.13, dur:1.2 });
      bar.chord.forEach((tone, i) => AudioEngine.playNote(tone, { gain:0.035, dur:2.3, delay:i * 0.012 }));
    } else if (inBar === 2) {
      AudioEngine.playDrum('kick', { gain:0.14 });
      AudioEngine.playNote(bar.bass + 7, { gain:0.09, dur:0.9 });
    }
    AudioEngine.playDrum(inBar % 2 ? 'shaker' : 'tick', { gain:inBar % 2 ? 0.05 : 0.035 });
    AudioEngine.playDrum('tick', { gain:0.02, delay:GROOVE_BEAT_MS / 2000 });
    // Pipi nods along to the beat.
    if (motionAllowed()) $('.coach-pipi')?.animate([{ transform:'none' }, { transform:inBar === 0 ? 'translateY(3px) scale(1.04, .95)' : 'translateY(2px) scale(1.02, .97)', offset:.25 }, { transform:'none' }], { duration:300, easing:'ease-out' });
    $('.groove-dot').classList.toggle('on-beat', inBar === 0);
  }
  function freeNote(keyIndex) {
    // A pentatonic scale has no clashing notes, so any key sounds good over the groove.
    return 48 + NOTE_SCALE[keyIndex % 5] + Math.floor(keyIndex / 5) * 12;
  }
  function handleChar(ch) {
    if (!state || screen !== 'play' || state.paused || state.phase !== 'playing' || state.recovery > 0 || document.querySelector('dialog[open]')) return;
    const free = state.lesson === 'free';
    const item = current();
    state.idle = 0;
    if (!free && ch !== item.text[state.typed]) {
      state.attempts++;
      state.streak = 0;
      state.recovery = RECOVERY_MS;
      $('#prompt-card').classList.add('recovering');
      $('#coach-text').textContent = `だいじょうぶ。「${displayed(item.text[state.typed])}」だよ`;
      AudioEngine.playError();
      flashWrong(ch); react('tilt');
      renderPrompt(); updateKeys();
      return;
    }
    initAudio();
    state.correct++;
    const keyIndex = ALL_KEYS.indexOf(ch) % 15;
    const note = free ? null : songNote();
    const midi = free ? freeNote(keyIndex) : note[0];
    state.notes.push({ midi, at:state.elapsed, beats:note?.[1] });
    if (state.notes.length > 600) state.notes.shift();
    AudioEngine.playNote(midi, { timbre:instrument() });
    if (!free) { accompany(midi, 0, note[1]); updateStaff(); }
    flashKey(ch, midi);
    const keyEl = visibleKey(ch);
    const tint = ['#efb552', '#e8786c', '#78af91', '#b4a4c9', '#7fb3c8'][keyIndex % 5];
    FX.ring(keyEl, { color:free ? tint : '#efb552' });
    FX.burst(keyEl, { count:7, speed:230, size:13, life:.7 });
    FX.notes(free ? keyEl : $('#prompt-picture'), { count:free ? 2 : 1, color:free ? tint : undefined });
    react('hop');
    if (!free && ++state.streak % 5 === 0) celebrateStreak(state.streak);
    if (free) {
      if (state.correct === 12) {
        $('#coach-text').textContent = 'シールが もらえるよ！ まだ あそんでも いいよ';
      }
      renderPrompt(); renderJourney();
      return;
    }
    state.typed++;
    if (state.typed === item.text.length) completeStep();
    else {
      $('#coach-text').textContent = 'いいね！ つぎの もじも ぽんっ';
      renderPrompt(); updateKeys();
    }
    const typedLetter = $('#prompt-letters').children[state.typed - 1];
    typedLetter?.classList.add('pop');
    FX.burst(typedLetter, { count:5, speed:150, size:10, life:.55, gravity:300 });
  }
  function completeStep() {
    state.done++;
    state.phase = 'celebrating';
    state.celebration = CELEBRATION_MS;
    state.recovery = 0;
    $('#prompt-card').classList.remove('recovering');
    $('#prompt-card').classList.add('celebrating');
    $('#coach-text').textContent = PRAISE[state.index];
    renderPrompt(); renderJourney(); updateKeys();
    react('dance');
    friendCheer(current());
    const picture = $('#prompt-picture');
    FX.burst(picture, { count:16, speed:380, size:20 });
    FX.ring(picture, { size:95, color:'#78af91' });
    // A star carries the success up to its place on the path.
    const dot = $('#journey-dots').children[state.done - 1];
    if (dot && motionAllowed()) {
      dot.classList.add('awaiting');
      const finalStep = state.done === ROUND_LENGTH;
      FX.fly(picture, dot, () => {
        dot.classList.remove('awaiting');
        pop(dot, { scale:1.5 });
        FX.burst(dot, { count:9, speed:170, size:12, life:.6 });
        FX.ring(dot, { size:34, color:'#78af91' });
        if (finalStep && screen === 'play') openGift();
      });
    }
  }
  function decorate(className, anchor, { html = '', dx = 0, dy = 0, life = 1200 } = {}) {
    // Short-lived DOM decorations (speech bubbles, rainbows) pinned above an element.
    const box = anchor?.getBoundingClientRect();
    if (!box?.width) return null;
    const el = document.createElement('div');
    el.className = `fx-dom ${className}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    el.style.left = `${box.left + box.width / 2 + dx}px`;
    el.style.top = `${box.top + dy}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), life);
    return el;
  }
  function friendCheer(item) {
    const voice = FRIEND_VOICES[item?.icon];
    if (!voice) return;
    const picture = $('#prompt-picture');
    decorate('friend-voice', picture, { html:voice[0], dx:44, dy:-4, life:1250 });
    if (!motionAllowed()) return;
    picture.animate(FRIEND_MOVES[voice[1]], { duration:950, easing:'ease-in-out' });
  }
  function celebrateStreak(count) {
    const picture = $('#prompt-picture');
    const card = $('#prompt-card');
    decorate('streak-badge', card, { html:`${count}かい れんぞく！`, dy:card.offsetHeight + 34, life:1500 });
    [72, 76, 79, 84].forEach((midi, i) => AudioEngine.playNote(midi, { gain:0.07, dur:0.5, delay:0.06 + i * 0.06, timbre:'musicbox' }));
    if (!motionAllowed()) return;
    const rainbow = decorate('streak-rainbow', card, { dy:-20, life:1500 });
    rainbow?.appendChild(icon('rainbow'));
    FX.burst(picture, { count:14, speed:320, size:15, colors:BALLOON_COLORS });
  }
  function idleHint() {
    // A gentle nudge when a child hesitates: the key hops and Pipi points it out.
    const word = current()?.text;
    const next = state.lesson === 'free' ? ALL_KEYS[Math.floor(Math.random() * ALL_KEYS.length)] : word?.[state.typed];
    const key = next && visibleKey(next);
    if (!key) return;
    $('#coach-text').textContent = state.lesson === 'free' ? `「${displayed(next)}」は どんな おとかな？` : `ここだよ！「${displayed(next)}」が ひかってるよ`;
    react('hop');
    if (!motionAllowed()) return;
    key.animate([{ transform:'none' }, { transform:'translateY(-14px) scale(1.15)', offset:.3 }, { transform:'translateY(0) scale(1.08, .92)', offset:.5 }, { transform:'translateY(-7px)', offset:.7 }, { transform:'none' }], { duration:700, easing:'ease-out' });
    FX.ring(key, { size:60, color:'#efb552' });
  }
  function pokePipi(pipi) {
    initAudio();
    const sleepy = pipi.classList.contains('sleepy');
    const line = sleepy ? 'むにゃ… まだ ねむいよ〜' : POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)];
    // The coach already has a speech bubble above it, so its giggles go to the side.
    const box = pipi.getBoundingClientRect();
    const side = pipi.classList.contains('coach-pipi') ? { dx:box.width * 0.95, dy:box.height * 0.35 } : { dy:-6 };
    decorate('poke-bubble', pipi, { html:line, life:1100, ...side });
    [88, 91].forEach((midi, i) => AudioEngine.playNote(sleepy ? midi - 12 : midi, { gain:0.1, dur:0.25, delay:i * 0.09, timbre:'musicbox' }));
    if (sleepy) return;
    clearTimeout(pipi.moodTimer);
    pipi.classList.remove('worry');
    pipi.classList.add('joy', 'flap');
    pipi.moodTimer = setTimeout(() => pipi.classList.remove('joy', 'flap'), 900);
    if (!motionAllowed()) return;
    pipi.getAnimations().forEach((animation) => animation.cancel());
    pipi.animate(POKE_MOVES[Math.floor(Math.random() * POKE_MOVES.length)], { duration:700, easing:'ease-in-out' });
    FX.hearts(pipi, { count:4 });
  }
  function friendParade(friends) {
    // The round's friends hop across the bottom of the screen, one after another.
    const duration = Math.max(3600, innerWidth * 4.2);
    friends.forEach((id, i) => {
      const friend = document.createElement('div');
      friend.className = 'fx-dom parade-friend';
      friend.setAttribute('aria-hidden', 'true');
      friend.style.animationDelay = `${(i % 2) * 0.2}s`;
      friend.appendChild(icon(id));
      document.body.appendChild(friend);
      const move = friend.animate([{ transform:'translateX(0)' }, { transform:`translateX(${innerWidth + 180}px)` }], { duration, delay:i * 380, easing:'linear', fill:'backwards' });
      move.onfinish = () => friend.remove();
      move.oncancel = () => friend.remove();
    });
  }
  function releaseBalloons() {
    state.balloonsPopped = 0;
    const total = 8;
    for (let i = 0; i < total; i++) {
      const balloon = document.createElement('button');
      balloon.type = 'button';
      balloon.tabIndex = -1;
      balloon.className = 'fx-dom balloon';
      balloon.setAttribute('aria-label', 'ふうせん');
      const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
      balloon.style.setProperty('--balloon', color);
      // Spread across the width, avoiding the exact centre where the buttons sit.
      const lane = (i + 0.5) / total;
      balloon.style.left = `${Math.round((lane < 0.5 ? lane * 0.8 : 0.2 + lane * 0.8) * 100)}%`;
      balloon.innerHTML = '<svg viewBox="0 0 60 90"><path class="balloon-string" d="M30 66q-6 8 0 12t0 11"/><ellipse cx="30" cy="32" rx="24" ry="29"/><path d="m25 60 5 6 5-6Z"/><ellipse class="balloon-shine" cx="21" cy="21" rx="5" ry="8"/></svg>';
      document.body.appendChild(balloon);
      const rise = balloon.animate([
        { transform:'translate(0, 0) rotate(-4deg)' }, { transform:`translate(14px, ${-innerHeight * 0.35}px) rotate(5deg)`, offset:.33 },
        { transform:`translate(-12px, ${-innerHeight * 0.7}px) rotate(-5deg)`, offset:.66 }, { transform:`translate(6px, ${-innerHeight - 180}px) rotate(3deg)` }],
        { duration:7000 + Math.random() * 3000, delay:i * 260 + Math.random() * 300, easing:'ease-in-out', fill:'backwards' });
      rise.onfinish = () => balloon.remove();
      balloon.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const box = balloon.getBoundingClientRect();
        const at = { x:box.left + box.width / 2, y:box.top + box.height * 0.35 };
        balloon.remove();
        initAudio();
        AudioEngine.playNote(72 + NOTE_SCALE[state.balloonsPopped % 5] + (state.balloonsPopped >= 5 ? 12 : 0), { gain:0.2, dur:0.6, timbre:'musicbox' });
        AudioEngine.playDrum('tick', { gain:0.08 });
        FX.burst(at, { count:14, speed:300, size:14, colors:[color, '#fffdf7', color] });
        FX.ring(at, { size:56, color });
        if (++state.balloonsPopped === total && screen === 'result') {
          decorate('poke-bubble', $('.result-pipi'), { html:'ぜんぶ わったね！', dy:-6, life:1600 });
          react('dance', document.querySelectorAll('.result-pipi'));
          FX.confetti();
          AudioEngine.playChord([72, 76, 79, 84], 0.1);
        }
      });
    }
  }
  function choreographResult(eligible, chordDelay) {
    const title = $('#result-title');
    const text = title.textContent;
    title.setAttribute('aria-label', text);
    title.replaceChildren(...[...text].map((ch, i) => {
      const span = document.createElement('span');
      span.className = 'title-char';
      span.textContent = ch;
      span.style.setProperty('--i', i);
      span.setAttribute('aria-hidden', 'true');
      return span;
    }));
    if (!eligible || !motionAllowed()) return;
    const resultPipi = document.querySelectorAll('.result-pipi');
    // The sticker lands at ~0.8s (see .reward-sticker in CSS); celebrate the impact.
    after(800, () => {
      const sticker = $('#reward-sticker');
      FX.burst(sticker, { count:22, speed:430, size:18 });
      FX.ring(sticker, { size:140, color:'#f4c96e' });
      $('.reward-scene').animate([{ transform:'none' }, { transform:'translate(-4px, 3px)', offset:.25 }, { transform:'translate(4px, -2px)', offset:.5 }, { transform:'translate(-2px, 1px)', offset:.75 }, { transform:'none' }], { duration:260 });
    });
    after(950, () => FX.confetti());
    after(Math.max(chordDelay * 1000, 1100), () => { react('dance', resultPipi); FX.notes(resultPipi[0], { count:4 }); });
  }
  function finishGame() {
    if (!state || screen !== 'play') return;
    if (state.lesson === 'free' && state.correct === 0) { goHome(); return; }
    state.phase = 'finished';
    // Let the last sparkles fall across the screen change.
    clearEffects({ keepParticles:true });
    const eligible = state.lesson !== 'free' ? state.done === ROUND_LENGTH : state.correct >= 12;
    if (eligible && !state.rewarded) {
      state.rewarded = true;
      profile.rounds[state.lesson]++;
      const newSticker = STICKERS.find((sticker) => !profile.stickers.includes(sticker.id));
      if (newSticker) { profile.stickers.push(newSticker.id); state.earnedSticker = newSticker; }
      saveProfile();
    }
    const finaleCount = eligible && state.song ? finaleLength() : 0;
    let songJustCompleted = false;
    if (eligible && state.song) {
      // Save where the tune got to; crossing its last note means the whole song was played.
      const length = SONGS[state.song].notes.length;
      const endPos = state.songPos + finaleCount;
      songJustCompleted = endPos >= (Math.floor(state.songStart / length) + 1) * length;
      profile.songProgress[state.song] = endPos % length;
      if (songJustCompleted) profile.songsCompleted[state.song]++;
      state.songCompleted = songJustCompleted;
      saveProfile();
    }
    const reward = state.earnedSticker || STICKERS[1];
    setPicture('#reward-art', reward.id);
    $('#result-title').textContent = songJustCompleted ? 'さいごまで ひけた！' : state.lesson === 'free' ? 'きみだけの おんがく、できた！' : 'やったね！ ぜんぶ できた！';
    const songName = state.song ? SONGS[state.song].name : '';
    const percent = state.song ? Math.round((profile.songProgress[state.song] / SONGS[state.song].notes.length) * 100) : 0;
    $('#result-song').hidden = !state.song || !eligible;
    $('#result-song-text').textContent = songJustCompleted ? `「${songName}」を ぜんぶ ひいたよ！ ${profile.songsCompleted[state.song]}かいめ` : `「${songName}」 ${percent}% まで すすんだよ。つづきは つぎの あそびで！`;
    $('#result-song-fill').style.width = `${songJustCompleted ? 100 : percent}%`;
    $('#screen-result').classList.toggle('song-complete', songJustCompleted);
    $('#result-description').textContent = state.lesson === 'words' ? '6この ことばが、すてきな おんがくに なったね。' : state.lesson === 'free' ? 'すきな おとを つなげて、あそべたね。' : 'ひとつずつ みつけた おとが、メロディーに なったね。';
    $('#reward-sticker').classList.toggle('is-new', !!state.earnedSticker);
    $('#reward-label').textContent = state.earnedSticker ? `「${reward.name}」シールを もらったよ！` : eligible ? 'ピピも はくしゅ！ すてきだったよ。' : 'ピピも きいていたよ！';
    const finaleNotes = finaleCount;
    $('#result-notes').textContent = state.song ? `♪「${SONGS[state.song].name}」を ${state.correct}おと ひいたよ` : `♪ ${state.correct}この おとを ならしたよ`;
    $('#result-finale').hidden = !finaleNotes;
    $('#result-collection').textContent = `シール ${profile.stickers.length} / ${STICKERS.length}`;
    $('#btn-next-lesson').hidden = state.lesson !== 'letters';
    $('#btn-listen').hidden = state.notes.length === 0;
    updateCollection(); updateListenButton();
    showScreen('result');
    let chordDelay = 0;
    if (eligible) {
      chordDelay = playFinale();
      after(chordDelay * 1000, () => { if (screen === 'result' && !playback) { AudioEngine.playChord([60, 64, 67, 72], 0.13); AudioEngine.playNote(36, { gain:0.14, dur:2 }); } });
    }
    choreographResult(eligible, chordDelay);
    if (eligible && motionAllowed()) {
      const friends = state.lesson === 'free' ? ['piano', 'star', 'flower', 'sun', 'rainbow', 'moon'] : [...new Set(state.steps.map((step) => step.icon))];
      after(1700, () => { if (screen === 'result') friendParade(friends); });
      after(2300, () => { if (screen === 'result') releaseBalloons(); });
    }
    if (songJustCompleted && motionAllowed()) after(2600, () => { if (screen === 'result') FX.confetti(); });
  }
  function finaleLength() {
    // Pipi finishes the phrase so every round ends on a resting note.
    if (!state.song || state.notes.length === 0) return 0;
    const notes = SONGS[state.song].notes;
    const last = notes[(state.songPos - 1) % notes.length];
    if (last[2]) return 0;
    let count = 0;
    while (count < notes.length && !notes[(state.songPos + count) % notes.length][2]) count++;
    return count + 1;
  }
  function playFinale() {
    const count = finaleLength();
    if (!count) return 0.35;
    const notes = SONGS[state.song].notes;
    let t = (state.notes[state.notes.length - 1].beats || 1) * BEAT_MS / 1000;
    for (let i = 0; i < count; i++) {
      const [midi, beats] = notes[(state.songPos + i) % notes.length];
      AudioEngine.playNote(midi, { gain:0.27, dur:Math.max(0.9, beats * 0.6), delay:t, timbre:instrument() });
      accompany(midi, t, beats);
      // Pipi visibly plays each note it adds.
      after(t * 1000, () => { if (screen !== 'result') return; react('hop', document.querySelectorAll('.result-pipi')); FX.notes($('.result-pipi'), { count:1 }); });
      state.notes.push({ midi, at:state.elapsed + t * 1000, beats, pipi:true });
      t += beats * BEAT_MS / 1000;
    }
    state.songPos += count;
    return t;
  }
  function goHome() {
    stopPlayback(); AudioEngine.stopAll(); clearEffects();
    state = null;
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    selectLesson(selectedLesson);
    showScreen('home'); updateCollection(); updateSongChips();
  }
  function updateCollection() {
    $('#collection-count').textContent = `${profile.stickers.length} / ${STICKERS.length}`;
    $('#btn-collection').setAttribute('aria-label', `シールちょうを ひらく。${STICKERS.length}このうち ${profile.stickers.length}こ`);
    $('#collection-description').textContent = profile.stickers.length === STICKERS.length ? 'ぜんぶ あつまったね！ きみの たからもの。' : '6こ できたら、シールが ひとつ！';
    const grid = $('#sticker-grid');
    grid.replaceChildren();
    for (const sticker of STICKERS) {
      const collected = profile.stickers.includes(sticker.id);
      const entry = document.createElement('div');
      entry.className = `sticker${collected ? '' : ' locked'}${collected && sticker.id === profile.stickers[profile.stickers.length - 1] && state?.earnedSticker?.id === sticker.id ? ' newest' : ''}`;
      const art = document.createElement('span');
      art.className = 'sticker-image'; art.appendChild(icon(sticker.id));
      const name = document.createElement('small');
      name.textContent = collected ? sticker.name : 'おたのしみ';
      entry.setAttribute('aria-label', collected ? `${sticker.name}、あつめたよ` : 'まだの シール');
      entry.style.setProperty('--i', grid.childElementCount);
      entry.append(art, name); grid.appendChild(entry);
    }
  }
  function openDialog(id) {
    if (document.querySelector('dialog[open]')) return;
    stopPlayback(); AudioEngine.stopAll();
    if (state && screen === 'play') { state.paused = true; updateKeys(); }
    const dialog = $(`#${id}`);
    dialogOpener = document.activeElement;
    dialog.showModal();
  }
  function updateListenButton() {
    const button = $('#btn-listen');
    button.classList.toggle('is-playing', !!playback);
    const tune = state?.song ? `「${SONGS[state.song].name}」を${state.songCompleted ? ' ぜんぶ' : ''}` : 'じぶんの おとを';
    button.textContent = playback ? 'Ⅱ とめる' : profile.settings.muted || profile.settings.volume === 0 ? `♫ おとを だして ${tune} きく` : `♫ ${tune} きく`;
  }
  function stopPlayback() {
    if (!playback) return;
    playback = null;
    AudioEngine.stopAll();
    updateListenButton();
  }
  function startPlayback() {
    if (!state?.notes.length || screen !== 'result') return;
    if (playback) { stopPlayback(); return; }
    if (profile.settings.muted || profile.settings.volume === 0) {
      profile.settings.muted = false;
      if (profile.settings.volume === 0) profile.settings.volume = 0.55;
      applySettings(); saveProfile();
    }
    AudioEngine.stopAll(); initAudio();
    // A finished song replays from its very first note, as a little concert.
    const notes = state.songCompleted ? SONGS[state.song].notes.map(([midi, beats]) => ({ midi, beats })) : state.notes;
    playback = { elapsed:0, index:0, next:0, notes };
    updateListenButton();
  }
  function update(dt) {
    if (playback) {
      playback.elapsed += dt;
      while (playback && playback.index < playback.notes.length && playback.elapsed >= playback.next) {
        const note = playback.notes[playback.index];
        AudioEngine.playNote(note.midi, { gain:0.27, dur:1.1, timbre:instrument() });
        if (note.beats) accompany(note.midi, 0, note.beats);
        react('hop', document.querySelectorAll('.result-pipi'));
        FX.notes($('#btn-listen'), { count:1 });
        playback.index++;
        const following = playback.notes[playback.index];
        // Song notes replay in the tune's own rhythm; free play keeps the child's timing.
        playback.next += !following ? 1400 : note.beats ? note.beats * BEAT_MS : Math.max(180, Math.min(650, following.at - note.at));
      }
      if (playback && playback.index >= playback.notes.length && playback.elapsed >= playback.next) { playback = null; updateListenButton(); }
    }
    if (!state || screen !== 'play' || state.paused) return;
    state.elapsed += dt;
    if (state.groove) {
      // Beats follow game time, so pausing also pauses the band.
      state.grooveClock += dt;
      while (state.grooveClock >= state.grooveBeat * GROOVE_BEAT_MS) playGrooveBeat(state.grooveBeat++);
    }
    if (state.recovery > 0) {
      state.recovery = Math.max(0, state.recovery - dt);
      if (state.recovery === 0) {
        $('#prompt-card').classList.remove('recovering');
        renderPrompt(); updateKeys();
      }
    }
    if (state.phase === 'playing' && state.recovery <= 0) {
      state.idle += dt;
      if (state.idle >= IDLE_HINT_MS) { state.idle = 0; idleHint(); }
    }
    if (state.phase === 'celebrating') {
      state.celebration -= dt;
      if (state.celebration <= 260 && !state.leaving && state.done < ROUND_LENGTH) { state.leaving = true; animateStepOut(); }
      if (state.celebration <= 0) {
        if (state.done === ROUND_LENGTH) finishGame();
        else { state.index++; beginStep(); }
      }
    }
  }
  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]') && !event.target.closest('dialog:not([open])')) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && screen === 'play') { event.preventDefault(); openDialog('pause-dialog'); return; }
    if (screen !== 'play') return;
    // Physical key codes also work with the Japanese IME active (key="Process").
    const ch = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : null;
    if (!ch) return;
    event.preventDefault();
    handleChar(ch);
  }

  document.querySelectorAll('.lesson-card').forEach((button) => button.addEventListener('click', () => {
    selectLesson(button.dataset.lesson);
    pop(button.querySelector('.lesson-icon'), { scale:1.25, duration:480 });
    FX.burst(button.querySelector('.lesson-icon'), { count:8, speed:180, size:12, life:.6 });
  }));
  document.querySelectorAll('.instrument-chip').forEach((button) => button.addEventListener('click', () => {
    selectInstrument(button.dataset.instrument);
    saveProfile();
    pop(button, { scale:1.12 });
    FX.notes(button, { count:2 });
    initAudio();
    AudioEngine.stopAll();
    [60, 64, 67, 72].forEach((midi, i) => AudioEngine.playNote(midi, { gain:0.2, dur:0.9, delay:i * 0.11, timbre:button.dataset.instrument }));
  }));
  $('#btn-groove').addEventListener('click', () => {
    if (!state) return;
    state.groove = !state.groove;
    profile.settings.groove = state.groove;
    saveProfile(); updateGrooveButton();
    // Restart on a downbeat so the loop always begins at the top of a bar.
    state.grooveClock = 0; state.grooveBeat = 0;
  });
  document.querySelectorAll('.song-chip').forEach((button) => button.addEventListener('click', () => {
    selectSong(button.dataset.song);
    pop(button, { scale:1.12 });
    FX.notes(button, { count:3 });
    initAudio();
    // A tiny preview: the first three notes of the tune.
    AudioEngine.stopAll();
    SONGS[button.dataset.song].notes.slice(0, 3).reduce((t, [midi, beats]) => {
      AudioEngine.playNote(midi, { gain:0.2, dur:0.8, delay:t, timbre:instrument() });
      return t + beats * BEAT_MS / 1000 * 0.8;
    }, 0);
  }));
  document.querySelectorAll('svg[data-pipi]').forEach((pipi) => pipi.addEventListener('pointerdown', (event) => { event.preventDefault(); pokePipi(pipi); }));
  $('.hero-art').addEventListener('pointerdown', (event) => {
    // Tapping the garden makes a little sound right where the finger lands.
    initAudio();
    const at = { x:event.clientX, y:event.clientY };
    AudioEngine.playNote(72 + NOTE_SCALE[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0), { gain:0.16, dur:0.7, timbre:'musicbox' });
    FX.notes(at, { count:2 });
    FX.burst(at, { count:8, speed:200, size:12, life:.6 });
  });
  $('#btn-start').addEventListener('click', () => startGame());
  $('#btn-again').addEventListener('click', () => startGame(state.lesson));
  $('#btn-next-lesson').addEventListener('click', () => startGame('words'));
  $('#btn-free-finish').addEventListener('click', finishGame);
  $('#btn-result-home').addEventListener('click', goHome);
  $('#brand-home').addEventListener('click', () => screen === 'play' ? openDialog('pause-dialog') : goHome());
  $('#btn-pause').addEventListener('click', () => openDialog('pause-dialog'));
  $('#btn-resume').addEventListener('click', () => $('#pause-dialog').close());
  $('#btn-leave').addEventListener('click', goHome);
  $('#btn-collection').addEventListener('click', () => { updateCollection(); openDialog('collection-dialog'); });
  $('#btn-settings').addEventListener('click', () => openDialog('settings-dialog'));
  $('#btn-how').addEventListener('click', () => openDialog('how-dialog'));
  $('#btn-listen').addEventListener('click', startPlayback);
  $('#btn-sound').addEventListener('click', () => {
    const audible = !profile.settings.muted && profile.settings.volume > 0;
    profile.settings.muted = audible;
    if (!audible && profile.settings.volume === 0) profile.settings.volume = 0.55;
    applySettings(); saveProfile();
    if (!profile.settings.muted) { initAudio(); AudioEngine.playNote(72, { gain:0.12, dur:0.65 }); }
  });
  $('#btn-keyboard').addEventListener('click', () => {
    const expanded = $('.keyboard-area').classList.toggle('expanded');
    $('#btn-keyboard').textContent = expanded ? '3この キーに もどす' : 'ぜんぶの キーを みる';
    $('#btn-keyboard').setAttribute('aria-expanded', String(expanded));
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((dialog) => {
    // WebKit may otherwise send Tab to browser chrome when full keyboard
    // access is disabled in macOS. Keep all of our controls reachable.
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement);
      const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault();
      controls[next].focus();
    });
    dialog.addEventListener('close', () => {
      // WebKit can leave focus on a control inside the closed dialog, which would
      // swallow the child's next key press. Return focus to where it came from.
      if (dialog.contains(document.activeElement) || document.activeElement === document.body) {
        const target = dialogOpener?.isConnected && dialogOpener.getClientRects().length ? dialogOpener : screen === 'play' ? $('#play-title') : null;
        target?.focus({ preventScroll:true });
      }
      if (state && screen === 'play') {
        state.paused = false;
        lastFrame = performance.now();
        updateKeys();
      }
    });
  });
  $('#setting-volume').addEventListener('input', (event) => {
    profile.settings.volume = Number(event.target.value) / 100;
    if (profile.settings.volume > 0) profile.settings.muted = false;
    applySettings(); saveProfile();
  });
  for (const [id, field] of [['setting-lowercase', 'lowercase'], ['setting-motion', 'reducedMotion']]) {
    $(`#${id}`).addEventListener('change', (event) => {
      profile.settings[field] = event.target.checked;
      applySettings(); saveProfile();
    });
  }
  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (screen === 'play') openDialog('pause-dialog');
    else { stopPlayback(); AudioEngine.stopAll(); }
  });
  window.addEventListener('pagehide', () => { AudioEngine.stopAll(); });

  window.render_game_to_text = () => JSON.stringify({
    mode: screen === 'play' ? (state.paused ? 'paused' : state.phase) : screen,
    coordinates: 'DOM layout; origin top-left, x right, y down. Targets stay still and never expire.',
    lesson: state?.lesson || selectedLesson,
    song: state ? state.song : selectedSong,
    songPosition: state?.song ? state.songPos : null,
    songProgress: { ...profile.songProgress }, songsCompleted: { ...profile.songsCompleted },
    instrument: profile.settings.instrument, groove: state ? !!state.groove : null,
    target: current() ? { word:current().text, meaning:current().name, typed:state.typed, nextKey:state.phase === 'playing' ? current().text[state.typed] : null } : null,
    progress: state ? { completed:state.done, total:state.lesson === 'free' ? null : ROUND_LENGTH, notes:state.correct } : null,
    mistakeRecoveryMs: Math.ceil(state?.recovery || 0),
    elapsedMs: Math.round(state?.elapsed || 0),
    celebrationMs: Math.max(0, Math.ceil(state?.celebration || 0)),
    stickers: profile.stickers.slice(),
    earnedSticker: state?.earnedSticker?.id || null,
    playback: playback ? { played:playback.index, total:playback.notes.length } : null,
    dialog: document.querySelector('dialog[open]')?.id || null,
    settings: { ...profile.settings }, storageAvailable,
    audio: AudioEngine.getStatus(),
    particles: FX.count(),
  });
  window.advanceTime = (ms) => {
    if (!Number.isFinite(ms) || ms < 0) return;
    const duration = Math.min(ms, 600000);
    const steps = Math.max(1, Math.ceil(duration / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(duration / steps);
    lastFrame = performance.now();
  };
  function loop(now) {
    update(Math.max(0, Math.min(now - lastFrame, 50)));
    lastFrame = now;
    requestAnimationFrame(loop);
  }
  mountPipis();
  FX.init($('#fx-canvas'), motionAllowed);
  // The speech bubble springs a little whenever Pipi says something new.
  new MutationObserver(() => {
    if (motionAllowed()) $('.coach-bubble').animate([{ transform:'scale(.93)' }, { transform:'scale(1.04)', offset:.6 }, { transform:'none' }], { duration:320, easing:'ease-out' });
  }).observe($('#coach-text'), { childList:true, characterData:true, subtree:true });
  buildKeyboard(); applySettings(); updateCollection(); selectSong(profile.settings.song); selectInstrument(profile.settings.instrument); updateSongChips(); selectLesson('letters');
  requestAnimationFrame(loop);
})();
