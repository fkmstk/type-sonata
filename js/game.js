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
  const RECITAL_WORDS = 12;
  const COUNT_IN_MS = 2400;
  const MISTAKE_RECOVERY_MS = 850; // ミスタッチ後、答えを見て立て直すための間

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
  const gaugeEl = $("#reveal-gauge");
  const gaugeBarEl = $("#reveal-gauge i");
  const judgementEl = $("#judgement");
  const wordPanelEl = $(".word-panel");
  const stageEl = $(".stage");
  const overlayEl = $("#stage-overlay");
  const overlayOverEl = $("#overlay-over");
  const overlayTitleEl = $("#overlay-title");
  const overlayHintEl = $("#overlay-hint");
  const pauseBtn = $("#btn-pause");
  const hud = {
    score: $("#hud-score"), combo: $("#hud-combo"),
    acc: $("#hud-acc"), wpm: $("#hud-wpm"), lives: $("#hud-lives"),
    progress: $("#hud-progress"), progressBar: $("#hud-progress-bar"),
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
      totalWords: Math.min(RECITAL_WORDS, pool.length),
      spawnedWords: 0,
      resolvedWords: 0,
      lives: MAX_LIVES,
      missed: [],           // 復習リスト
      startedAt: 0,
      elapsedMs: 0,
      inputLockedUntil: 0,
      countdownMs: COUNT_IN_MS,
      paused: false,
      endReason: null,
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
    if (st.spawnedWords >= st.totalWords) return;
    if (st.qi >= st.queue.length) { shuffle(st.queue); st.qi = 0; }
    const [en, ja] = st.queue[st.qi++];
    const { triad, seq } = Melody.nextWordChord();

    const el = document.createElement("div");
    el.className = "note-word";
    const glyph = GLYPHS[st.glyphAlt++ % GLYPHS.length];
    // リコール方式:スペルは伏せ字で始まり、意味から思い出して打つ
    el.innerHTML =
      `<span class="glyph">${glyph}</span><span class="letters">` +
      en.split("").map(() => `<span>·</span>`).join("") +
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
      revealed: false,
      revealAt: null,   // ターゲットになった時点で締切りを設定
      revealMs: Math.min(6000, 3200 + 260 * en.length),
    };
    el.style.transform = `translate(${word.x}px, calc(-50% + var(--lane)))`;
    st.words.push(word);
    st.spawnedWords++;
    refreshTarget();
  }

  // ── target(先頭の単語)──
  function target() { return state.words[0] || null; }

  function refreshTarget() {
    state.words.forEach((w, i) => w.el.classList.toggle("target", i === 0));
    const t = target();
    if (t) {
      if (!t.revealed && !t.revealAt) t.revealAt = state.elapsedMs + t.revealMs;
      renderBigWord(t);
      meaningEl.textContent = t.ja;
      // 伏せている間は答えになるキーを光らせない(思い出すのが練習)
      setNextKey(t.revealed ? t.en[t.typed] : null);
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
        if (i < w.typed) return `<span class="done">${c}</span>`;
        const shown = w.revealed ? c : "·";
        const cls = (i === w.typed ? "cur " : "") + (w.revealed ? "" : "hid");
        return `<span class="${cls.trim()}">${shown}</span>`;
      })
      .join("");
  }

  // スペルを開示(締切り超過 or 打ち間違い)
  function revealWord(w) {
    if (w.revealed) return;
    w.revealed = true;
    w.letterEls.forEach((el, i) => {
      if (i >= w.typed) {
        el.textContent = w.en[i];
        el.classList.add("flash-in");
      }
    });
    if (w === target()) {
      renderBigWord(w);
      setNextKey(w.en[w.typed]);
    }
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
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return;
    const ch = e.key.toLowerCase();
    if (ch === "f" && e.shiftKey && screens.game.classList.contains("active")) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (!state || !state.playing) return;
    if ((ch === "p" && e.shiftKey) || (e.key === "Escape" && !document.fullscreenElement)) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (state.paused || state.countdownMs > 0) return;
    if (!/^[a-z]$/.test(ch)) return;
    e.preventDefault();
    handleChar(ch);
  }

  // 物理キーとタップの両方から呼ばれる
  function handleChar(ch) {
    const t = target();
    if (!t) return;
    if (state.paused || state.countdownMs > 0) return;
    // ミス直後の連打抜けを防ぎ、開示されたスペルを認識する時間を作る
    if (state.elapsedMs < state.inputLockedUntil) return;

    if (ch === t.en[t.typed]) {
      // 正打:旋律を一音進める(伏せ字でも正しく打てた文字は姿を現す)
      const midi = t.seq[Math.min(t.typed, t.seq.length - 1)];
      AudioEngine.playNote(midi);
      flashKey(midi);
      pressKeyFx(ch, true);

      t.letterEls[t.typed].textContent = t.en[t.typed];
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
        setNextKey(t.revealed ? t.en[t.typed] : null);
      }
    } else {
      // ミスタッチ:伏せ字ならスペルを開示(答え合わせ)
      AudioEngine.playError();
      pressKeyFx(ch, false);
      state.typedNg++;
      state.combo = 0;
      state.score = Math.max(0, state.score - 5);
      revealWord(t);
      state.inputLockedUntil = state.elapsedMs + MISTAKE_RECOVERY_MS;
      wordPanelEl.classList.add("recovering");
      setNextKey(null);
      t.el.classList.remove("shake");
      void t.el.offsetWidth;
      t.el.classList.add("shake");
    }
    updateHud();
  }

  function completeWord(w) {
    const st = state;
    st.wordsDone++;
    st.resolvedWords++;

    // タイミング評価:演奏ライン付近で完成できたか
    const center = w.x + w.width / 2;
    const dist = Math.abs(center - hitLineEl.offsetLeft);
    let mult = 1, label = "Bravo", cls = "good";
    if (dist < 70) { mult = 2; label = "Bravissimo!"; cls = "perfect"; }
    // 暗記ボーナス:スペルを見ずに思い出して打ちきった
    if (!w.revealed) {
      label = "Memoria!"; cls = "memoria";
      st.score += 25 * w.en.length;
    }
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
    finishRecitalIfReady();
  }

  function missWord(w) {
    const st = state;
    st.combo = 0;
    st.lives--;
    st.resolvedWords++;
    st.missed.push([w.en, w.ja]);
    AudioEngine.playMiss();
    judge("miss…", "miss");

    w.el.classList.add("missed");
    setTimeout(() => w.el.remove(), 700);
    st.words.shift();
    refreshTarget();
    renderLives();
    updateHud();

    if (st.lives <= 0) endGame("lives");
    else finishRecitalIfReady();
  }

  function finishRecitalIfReady() {
    if (state.resolvedWords < state.totalWords) return;
    endGame("complete");
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
    const mins = state.elapsedMs / 60000;
    return mins <= 0 ? 0 : Math.round(state.typedOk / 5 / mins);
  }

  function updateHud() {
    hud.score.textContent = state.score.toLocaleString();
    hud.combo.textContent = state.combo;
    hud.acc.textContent = accuracy() + "%";
    hud.wpm.textContent = wpm();
    hud.progress.textContent = `${state.resolvedWords} / ${state.totalWords}`;
    hud.progressBar.style.width = `${state.resolvedWords / state.totalWords * 100}%`;
  }

  function updateStageOverlay() {
    if (state.paused) {
      overlayOverEl.textContent = "intermezzo";
      overlayTitleEl.textContent = "休止中";
      overlayHintEl.textContent = "Esc またはボタンで演奏に戻る";
      overlayEl.hidden = false;
      stageEl.classList.add("paused");
      return;
    }

    stageEl.classList.remove("paused");
    if (state.countdownMs > 0) {
      const movement = { easy: "I. Andante", normal: "II. Moderato", hard: "III. Allegro" };
      overlayOverEl.textContent = movement[state.levelKey];
      overlayTitleEl.textContent = Math.max(1, Math.ceil(state.countdownMs / 800));
      overlayHintEl.textContent = "姿勢を整えて";
      overlayEl.hidden = false;
      return;
    }
    overlayEl.hidden = true;
  }

  function togglePause() {
    if (!state || !state.playing || state.countdownMs > 0) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "▶ 再開" : "Ⅱ 休止";
    pauseBtn.setAttribute("aria-pressed", String(state.paused));
    const t = target();
    setNextKey(state.paused ? null : (t?.revealed ? t.en[t.typed] : null));
    updateStageOverlay();
  }

  function toggleFullscreen() {
    const operation = document.fullscreenElement
      ? document.exitFullscreen?.()
      : document.documentElement.requestFullscreen?.();
    operation?.catch(() => {});
  }

  // ── main loop ──
  function updateGame(dt) {
    if (!state || !state.playing) return;
    if (state.paused) return;

    if (state.countdownMs > 0) {
      state.countdownMs = Math.max(0, state.countdownMs - dt * 1000);
      updateStageOverlay();
      if (state.countdownMs === 0) {
        state.spawnTimer = 0.1;
        state.elapsedMs = 0;
        AudioEngine.playChord([48, 55, 64, 72], 0.25);
      }
      return;
    }

    state.elapsedMs += dt * 1000;

    if (state.inputLockedUntil && state.elapsedMs >= state.inputLockedUntil) {
      state.inputLockedUntil = 0;
      wordPanelEl.classList.remove("recovering");
      const t = target();
      setNextKey(t && t.revealed ? t.en[t.typed] : null);
    }

    // spawn
    state.spawnTimer -= dt;
    const lastWord = state.words[state.words.length - 1];
    const staffW = staffEl.clientWidth;
    const roomOk = !lastWord || lastWord.x + lastWord.width < staffW - 60;
    if (state.spawnedWords < state.totalWords && state.spawnTimer <= 0 && roomOk) {
      spawnWord();
      state.spawnTimer = state.spawnGap;
    }

    // move(狭い画面では譜面の横断時間が同じになるよう減速)
    const sc = Math.min(1, Math.max(0.45, staffEl.clientWidth / 1100));
    for (const w of state.words) {
      w.x -= state.speed * sc * dt;
      w.el.style.transform = `translate(${w.x}px, calc(-50% + var(--lane)))`;
    }

    // リコール締切り:時間切れでスペルを開示、残り時間はゲージに表示
    const t0 = target();
    if (t0 && !t0.revealed && t0.revealAt) {
      const rem = t0.revealAt - state.elapsedMs;
      if (rem <= 0) {
        revealWord(t0);
        gaugeEl.classList.remove("on");
      } else {
        gaugeEl.classList.add("on");
        gaugeBarEl.style.width = (rem / t0.revealMs) * 100 + "%";
      }
    } else {
      gaugeEl.classList.remove("on");
    }

    // miss 判定(先頭のみ処理すれば十分:先頭が最も左にいる)
    const t = target();
    if (t && t.x < FAIL_X) missWord(t);
  }

  function loop(now) {
    if (!state || !state.playing) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    updateGame(dt);

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
    wordPanelEl.classList.remove("recovering");
    pauseBtn.textContent = "Ⅱ 休止";
    pauseBtn.setAttribute("aria-pressed", "false");
    staffEl.querySelectorAll(".note-word").forEach((el) => el.remove());
    renderLives();
    updateHud();
    refreshTarget();
    showScreen("game");
    state.playing = true;
    state.startedAt = performance.now();
    updateStageOverlay();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function endGame(reason = "quit") {
    state.playing = false;
    state.endReason = reason;
    cancelAnimationFrame(rafId);
    overlayEl.hidden = true;
    stageEl.classList.remove("paused");

    $("#rs-score").textContent = state.score.toLocaleString();
    $("#rs-combo").textContent = state.maxCombo;
    $("#rs-acc").textContent = accuracy() + "%";
    $("#rs-wpm").textContent = wpm();
    $("#rs-words").textContent = `${state.resolvedWords} / ${state.totalWords}`;
    $("#result-rank").textContent = rankFor();

    const box = $("#review-box");
    const list = $("#review-list");
    list.innerHTML = "";
    if (state.missed.length === 0 && reason === "complete") {
      box.classList.add("empty");
      list.innerHTML = state.typedNg === 0
        ? `<li class="perfect-run">ノーミス!すべての単語を演奏しきりました 🎩</li>`
        : `<li class="perfect-run">全単語完奏!すべての単語を演奏しきりました 🎩</li>`;
    } else if (state.missed.length === 0) {
      box.classList.add("empty");
      list.innerHTML = `<li class="perfect-run">演奏を途中で終えました。次は終楽章まで。</li>`;
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
    if (state.endReason === "quit") return "演奏を中断 — Intermezzo";
    if (state.endReason === "lives") return "もう一度、最初から — Rehearsal";
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
  pauseBtn.addEventListener("click", () => togglePause());
  $("#btn-quit").addEventListener("click", () => endGame("quit"));
  $("#btn-retry").addEventListener("click", () => startGame(state.levelKey));
  $("#btn-title").addEventListener("click", () => showScreen("title"));
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state?.playing && !state.paused && state.countdownMs <= 0) togglePause();
  });

  // 自動テストとアクセシビリティ用の簡潔なゲーム状態
  window.render_game_to_text = () => {
    if (!state || screens.title.classList.contains("active")) return JSON.stringify({ mode: "title" });
    const t = target();
    return JSON.stringify({
      mode: screens.result.classList.contains("active")
        ? "result"
        : state.paused
          ? "paused"
          : state.countdownMs > 0
            ? "countdown"
            : state.playing ? "playing" : "idle",
      coordinates: "staff origin is top-left; x increases right, words move left",
      level: state.levelKey,
      target: t ? { word: t.en, meaning: t.ja, typed: t.typed, x: Math.round(t.x), revealed: t.revealed } : null,
      queuedWords: state.words.slice(1).map((w) => ({ x: Math.round(w.x), letters: w.en.length })),
      mistakeRecoveryMs: Math.max(0, Math.ceil(state.inputLockedUntil - state.elapsedMs)),
      progress: { resolved: state.resolvedWords, spawned: state.spawnedWords, total: state.totalWords },
      score: state.score,
      combo: state.combo,
      accuracy: accuracy(),
      lives: state.lives,
    });
  };

  window.advanceTime = (ms) => {
    if (!state || !state.playing) return;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const dt = ms / steps / 1000;
    for (let i = 0; i < steps && state.playing; i++) updateGame(dt);
    lastTime = performance.now();
    updateHud();
  };

  buildPiano();
  buildKeyboard();
})();
