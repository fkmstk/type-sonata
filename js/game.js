// ═══════════════ TYPE SONATA — game core ═══════════════
(() => {
  const $ = (s) => document.querySelector(s);

  const LEVELS = {
    easy:   { name: "初級", speed: 55,  spawnGap: 3.2, accel: 1.6, gapDecay: 0.985 },
    normal: { name: "中級", speed: 70,  spawnGap: 3.0, accel: 2.0, gapDecay: 0.982 },
    hard:   { name: "上級", speed: 85,  spawnGap: 2.8, accel: 2.4, gapDecay: 0.980 },
  };

  const FAIL_X = 20;   // ここを過ぎたらミス(演奏ラインの位置はCSSから取得)
  const MAX_LIVES = 5;

  // ── DOM ──
  const screens = {
    title: $("#screen-title"),
    game: $("#screen-game"),
    result: $("#screen-result"),
  };
  const staffEl = $("#staff");
  const hitLineEl = $(".hit-line");
  const bigWordEl = $("#big-word");
  const meaningEl = $("#word-meaning");
  const judgementEl = $("#judgement");
  const hud = {
    score: $("#hud-score"), combo: $("#hud-combo"),
    acc: $("#hud-acc"), wpm: $("#hud-wpm"), lives: $("#hud-lives"),
  };

  // ── state ──
  let state = null;
  let rafId = null;
  let lastTime = 0;

  function newState(levelKey) {
    const lv = LEVELS[levelKey];
    const pool = WORD_BANK[levelKey].slice();
    shuffle(pool);
    return {
      levelKey, lv,
      queue: pool,
      qi: 0,
      words: [],            // 譜面上の単語 {en, ja, el, x, typed, chord, seq, done}
      speed: lv.speed,
      spawnGap: lv.spawnGap,
      spawnTimer: 0.6,      // 最初はすぐ出す
      score: 0,
      combo: 0, maxCombo: 0,
      typedOk: 0, typedNg: 0,
      wordsDone: 0,
      lives: MAX_LIVES,
      missed: [],           // 復習リスト
      startedAt: 0,
      playing: false,
      glyphAlt: 0,
    };
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  // ── screen control ──
  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ── piano strip ──
  const pianoKeys = {}; // midi -> element
  function buildPiano() {
    const piano = $("#piano");
    piano.innerHTML = "";
    const BLACK = new Set([1, 3, 6, 8, 10]);
    // C3(48) 〜 B6(95)
    for (let midi = 48; midi <= 95; midi++) {
      const pc = midi % 12;
      if (BLACK.has(pc)) continue;
      const wk = document.createElement("div");
      wk.className = "wkey";
      piano.appendChild(wk);
      pianoKeys[midi] = wk;
      // 直後の黒鍵を白鍵の右肩に載せる
      if ([0, 2, 5, 7, 9].includes(pc) && midi + 1 <= 95) {
        const bk = document.createElement("div");
        bk.className = "bkey";
        wk.appendChild(bk);
        pianoKeys[midi + 1] = bk;
      }
    }
  }
  function flashKey(midi) {
    const el = pianoKeys[midi];
    if (!el) return;
    el.classList.remove("lit");
    void el.offsetWidth;
    el.classList.add("lit");
  }

  // ── keyboard guide(運指の色分け)──
  const FINGER = {
    q: "lp", a: "lp", z: "lp",
    w: "lr", s: "lr", x: "lr",
    e: "lm", d: "lm", c: "lm",
    r: "li", f: "li", v: "li", t: "li", g: "li", b: "li",
    y: "ri", h: "ri", n: "ri", u: "ri", j: "ri", m: "ri",
    i: "rm", k: "rm",
    o: "rr", l: "rr",
    p: "rp",
  };
  const keyEls = {};
  function buildKeyboard() {
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const guide = $("#kbd-guide");
    guide.innerHTML = "";
    rows.forEach((row, ri) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kbd-row r" + ri;
      for (const ch of row) {
        const k = document.createElement("div");
        k.className = "kbd-key f-" + FINGER[ch];
        k.textContent = ch;
        if ("fj".includes(ch)) k.classList.add("homing");
        // スマホ:タップでも入力できる
        k.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (!state || !state.playing) return;
          handleChar(ch);
        });
        rowEl.appendChild(k);
        keyEls[ch] = k;
      }
      guide.appendChild(rowEl);
    });
  }
  function setNextKey(ch) {
    document.querySelectorAll(".kbd-key.next").forEach((k) => k.classList.remove("next"));
    if (ch && keyEls[ch]) keyEls[ch].classList.add("next");
  }
  function pressKeyFx(ch, ok) {
    const el = keyEls[ch];
    if (!el) return;
    const cls = ok ? "hit" : "bad";
    el.classList.remove("hit", "bad");
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ── word spawning ──
  const GLYPHS = ["♪", "♩", "♫", "♬"];
  function spawnWord() {
    const st = state;
    if (st.qi >= st.queue.length) { shuffle(st.queue); st.qi = 0; }
    const [en, ja] = st.queue[st.qi++];
    const { triad, seq } = Melody.nextWordChord();

    const el = document.createElement("div");
    el.className = "note-word";
    const glyph = GLYPHS[st.glyphAlt++ % GLYPHS.length];
    el.innerHTML =
      `<span class="glyph">${glyph}</span><span class="letters">` +
      en.split("").map((c) => `<span>${c}</span>`).join("") +
      `</span>`;
    const lane = [-34, -17, 0, 17, 34][Math.floor(Math.random() * 5)];
    el.style.setProperty("--lane", lane + "px");
    staffEl.appendChild(el);

    const staffW = staffEl.clientWidth;
    const word = {
      en, ja, el,
      x: staffW + 20,
      typed: 0,
      triad, seq,
      letterEls: [...el.querySelectorAll(".letters span")],
      width: el.offsetWidth,
    };
    el.style.transform = `translate(${word.x}px, calc(-50% + var(--lane)))`;
    st.words.push(word);
    refreshTarget();
  }

  // ── target(先頭の単語)──
  function target() { return state.words[0] || null; }

  function refreshTarget() {
    state.words.forEach((w, i) => w.el.classList.toggle("target", i === 0));
    const t = target();
    if (t) {
      renderBigWord(t);
      meaningEl.textContent = t.ja;
      setNextKey(t.en[t.typed]);
    } else {
      bigWordEl.innerHTML = `<span class="placeholder">♪ 単語を待っています…</span>`;
      meaningEl.innerHTML = "&nbsp;";
      setNextKey(null);
    }
  }

  function renderBigWord(w) {
    bigWordEl.innerHTML = w.en
      .split("")
      .map((c, i) => {
        const cls = i < w.typed ? "done" : i === w.typed ? "cur" : "";
        return `<span class="${cls}">${c}</span>`;
      })
      .join("");
  }

  // ── judgement popup ──
  function judge(text, cls) {
    judgementEl.textContent = text;
    judgementEl.className = "judgement show " + cls;
    clearTimeout(judge._t);
    judge._t = setTimeout(() => judgementEl.classList.remove("show"), 750);
  }

  // ── input ──
  function onKeyDown(e) {
    if (!state || !state.playing) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const ch = e.key.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return;
    e.preventDefault();
    handleChar(ch);
  }

  // 物理キーとタップの両方から呼ばれる
  function handleChar(ch) {
    const t = target();
    if (!t) return;

    if (ch === t.en[t.typed]) {
      // 正打:旋律を一音進める
      const midi = t.seq[Math.min(t.typed, t.seq.length - 1)];
      AudioEngine.playNote(midi);
      flashKey(midi);
      pressKeyFx(ch, true);

      t.letterEls[t.typed].classList.add("done");
      t.typed++;
      state.typedOk++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += Math.round(10 * (1 + state.combo / 50));

      if (t.typed >= t.en.length) {
        completeWord(t);
      } else {
        renderBigWord(t);
        setNextKey(t.en[t.typed]);
      }
    } else {
      // ミスタッチ
      AudioEngine.playError();
      pressKeyFx(ch, false);
      state.typedNg++;
      state.combo = 0;
      state.score = Math.max(0, state.score - 5);
      t.el.classList.remove("shake");
      void t.el.offsetWidth;
      t.el.classList.add("shake");
    }
    updateHud();
  }

  function completeWord(w) {
    const st = state;
    st.wordsDone++;

    // タイミング評価:演奏ライン付近で完成できたか
    const center = w.x + w.width / 2;
    const dist = Math.abs(center - hitLineEl.offsetLeft);
    let mult = 1, label = "Bravo", cls = "good";
    if (dist < 70) { mult = 2; label = "Bravissimo!"; cls = "perfect"; }
    st.score += Math.round(50 * mult * (1 + st.combo / 60));

    AudioEngine.playChord([...w.triad.map((n) => n + 12), w.triad[0] + 24]);
    w.triad.forEach((n) => flashKey(n + 12));
    judge(label, cls);

    // 意味を金色でフラッシュ(学習の定着)
    meaningEl.classList.remove("flash");
    void meaningEl.offsetWidth;
    meaningEl.classList.add("flash");

    // 単語は舞い上がって消える
    w.el.classList.add("complete");
    setTimeout(() => w.el.remove(), 900);
    st.words.shift();

    // 進行に応じてテンポアップ
    st.speed += st.lv.accel;
    st.spawnGap = Math.max(1.1, st.spawnGap * st.lv.gapDecay);

    refreshTarget();
  }

  function missWord(w) {
    const st = state;
    st.combo = 0;
    st.lives--;
    st.missed.push([w.en, w.ja]);
    AudioEngine.playMiss();
    judge("miss…", "miss");

    w.el.classList.add("missed");
    setTimeout(() => w.el.remove(), 700);
    st.words.shift();
    refreshTarget();
    renderLives();
    updateHud();

    if (st.lives <= 0) endGame();
  }

  // ── HUD ──
  function renderLives() {
    hud.lives.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i++) {
      const s = document.createElement("span");
      s.textContent = "♪";
      if (i >= state.lives) s.classList.add("lost");
      hud.lives.appendChild(s);
    }
  }

  function accuracy() {
    const total = state.typedOk + state.typedNg;
    return total === 0 ? 100 : Math.round((state.typedOk / total) * 100);
  }

  function wpm() {
    const mins = (performance.now() - state.startedAt) / 60000;
    return mins <= 0 ? 0 : Math.round(state.typedOk / 5 / mins);
  }

  function updateHud() {
    hud.score.textContent = state.score.toLocaleString();
    hud.combo.textContent = state.combo;
    hud.acc.textContent = accuracy() + "%";
    hud.wpm.textContent = wpm();
  }

  // ── main loop ──
  function loop(now) {
    if (!state || !state.playing) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // spawn
    state.spawnTimer -= dt;
    const lastWord = state.words[state.words.length - 1];
    const staffW = staffEl.clientWidth;
    const roomOk = !lastWord || lastWord.x + lastWord.width < staffW - 60;
    if (state.spawnTimer <= 0 && roomOk) {
      spawnWord();
      state.spawnTimer = state.spawnGap;
    }

    // move(狭い画面では譜面の横断時間が同じになるよう減速)
    const sc = Math.min(1, Math.max(0.45, staffEl.clientWidth / 1100));
    for (const w of state.words) {
      w.x -= state.speed * sc * dt;
      w.el.style.transform = `translate(${w.x}px, calc(-50% + var(--lane)))`;
    }

    // miss 判定(先頭のみ処理すれば十分:先頭が最も左にいる)
    const t = target();
    if (t && t.x < FAIL_X) missWord(t);

    if (state && state.playing) {
      updateHud();
      rafId = requestAnimationFrame(loop);
    }
  }

  // ── game flow ──
  function startGame(levelKey) {
    AudioEngine.init();
    Melody.reset();
    state = newState(levelKey);
    staffEl.querySelectorAll(".note-word").forEach((el) => el.remove());
    renderLives();
    updateHud();
    refreshTarget();
    showScreen("game");
    state.playing = true;
    state.startedAt = performance.now();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
    // 開幕の一音
    AudioEngine.playChord([48, 55, 64, 72], 0.25);
  }

  function endGame() {
    state.playing = false;
    cancelAnimationFrame(rafId);

    $("#rs-score").textContent = state.score.toLocaleString();
    $("#rs-combo").textContent = state.maxCombo;
    $("#rs-acc").textContent = accuracy() + "%";
    $("#rs-wpm").textContent = wpm();
    $("#rs-words").textContent = state.wordsDone;
    $("#result-rank").textContent = rankFor();

    const box = $("#review-box");
    const list = $("#review-list");
    list.innerHTML = "";
    if (state.missed.length === 0) {
      box.classList.add("empty");
      list.innerHTML = `<li class="perfect-run">ノーミス!すべての単語を演奏しきりました 🎩</li>`;
    } else {
      box.classList.remove("empty");
      // 重複を除いて表示
      const seen = new Set();
      for (const [en, ja] of state.missed) {
        if (seen.has(en)) continue;
        seen.add(en);
        const li = document.createElement("li");
        li.innerHTML = `<b>${en}</b><i>${ja}</i>`;
        list.appendChild(li);
      }
    }
    showScreen("result");
  }

  function rankFor() {
    const a = accuracy(), w = wpm();
    if (a >= 97 && w >= 40) return "維持されるべき栄誉 — Maestro";
    if (a >= 92) return "見事な演奏 — Virtuoso";
    if (a >= 80) return "良い響きでした — Sonata";
    return "練習あるのみ — Étude";
  }

  // ── wire up ──
  document.querySelectorAll(".level-btn").forEach((btn) => {
    btn.addEventListener("click", () => startGame(btn.dataset.level));
  });
  $("#btn-quit").addEventListener("click", () => endGame());
  $("#btn-retry").addEventListener("click", () => startGame(state.levelKey));
  $("#btn-title").addEventListener("click", () => showScreen("title"));
  window.addEventListener("keydown", onKeyDown);

  buildPiano();
  buildKeyboard();
})();
