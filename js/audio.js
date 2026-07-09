// ピアノ音源 — Web Audio API による加算合成
const AudioEngine = (() => {
  let ctx = null;
  let master = null;

  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      // ホールらしい残響の代わりに軽いコンプ的リミット
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ピアノ一音:基音+倍音+わずかなデチューンで胴鳴りを再現
  function playNote(midi, { gain = 0.45, dur = 1.6 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = midiToFreq(midi);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(gain * 0.3, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(f * 8, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + dur);

    env.connect(lp);
    lp.connect(master);

    const partials = [
      [1, 1.0, "sine"],
      [2, 0.35, "sine"],
      [3, 0.12, "sine"],
      [4, 0.06, "sine"],
      [1.004, 0.25, "triangle"],
    ];
    for (const [mult, g, type] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(env);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  // 和音(単語完成時)— わずかにずらしてアルペジオ気味に
  function playChord(midis, gain = 0.32) {
    if (!ctx) return;
    midis.forEach((m, i) => {
      setTimeout(() => playNote(m, { gain, dur: 2.4 }), i * 35);
    });
  }

  // ミスタッチ:こもった低い打撃音
  function playError() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    o.connect(g); g.connect(lp); lp.connect(master);
    o.start(t); o.stop(t + 0.2);
  }

  // 単語を逃したとき:物悲しい短二度
  function playMiss() {
    if (!ctx) return;
    playNote(52, { gain: 0.22, dur: 1.2 });
    setTimeout(() => playNote(51, { gain: 0.18, dur: 1.6 }), 120);
  }

  return { init, playNote, playChord, playError, playMiss };
})();

// 旋律の設計 — カノン風コード進行を単語ごとに巡回し、
// 文字ごとにその和音のアルペジオを昇っていく
const Melody = (() => {
  // C - G - Am - Em - F - C - F - G(ルートはMIDI、C4=60)
  const PROGRESSION = [
    [60, 64, 67], // C
    [55, 59, 62], // G
    [57, 60, 64], // Am
    [52, 55, 59], // Em
    [53, 57, 60], // F
    [60, 64, 67], // C
    [53, 57, 60], // F
    [55, 59, 62], // G
  ];
  let wordIndex = 0;

  function nextWordChord() {
    const triad = PROGRESSION[wordIndex % PROGRESSION.length];
    wordIndex++;
    // 文字数ぶんの音列:三和音をオクターブ違いで積み上げる
    const seq = [];
    for (let oct = 0; oct < 4; oct++) {
      for (const n of triad) seq.push(n + 12 * oct);
    }
    return { triad, seq };
  }

  function reset() { wordIndex = 0; }

  return { nextWordChord, reset };
})();
