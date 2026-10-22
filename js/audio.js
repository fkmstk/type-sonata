// Gentle, bounded Web Audio piano. Shared by the music room and classic recital.
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let volume = 0.55;
  let muted = false;
  let unavailable = false;
  const voices = new Set();
  const MAX_VOICES = 28;

  function init() {
    try {
      if (!ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { unavailable = true; return false; }
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume * 0.65;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 18;
        comp.ratio.value = 5;
        comp.attack.value = 0.004;
        comp.release.value = 0.18;
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    } catch {
      unavailable = true;
      return false;
    }
  }

  function updateGain() {
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(muted ? 0 : volume * 0.65, ctx.currentTime, 0.02);
  }
  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(1, value));
    updateGain();
  }
  function setMuted(value) { muted = Boolean(value); updateGain(); }
  const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function releaseVoice(voice) {
    if (!voices.has(voice)) return;
    voice.oscillators.forEach((osc) => { try { osc.stop(); } catch { /* Already stopped. */ } });
    voice.nodes.forEach((node) => node.disconnect());
    voices.delete(voice);
  }

  // Each timbre: loudness balance, partial ratios/weights, envelope shape, filter brightness.
  // Inharmonic partials make the music box and xylophone ring like real bars.
  const TIMBRES = {
    piano: { level:1, partials:[[1, 1, 'sine'], [2, 0.30, 'sine'], [3, 0.10, 'sine'], [4, 0.04, 'sine'], [1.004, 0.17, 'triangle']], attack:0.009, decay:0.22, sustain:0.24, bright:7, length:1 },
    musicbox: { level:1.45, partials:[[1, 1, 'sine'], [3.01, 0.30, 'sine'], [5.43, 0.12, 'sine'], [8.93, 0.05, 'sine']], attack:0.002, decay:0.07, sustain:0.32, bright:12, length:1.35, octave:12 },
    marimba: { level:1.7, partials:[[1, 1, 'sine'], [3.93, 0.36, 'sine'], [9.8, 0.07, 'sine']], attack:0.003, decay:0.05, sustain:0.2, bright:5, length:0.6 },
    // A little cat voice: each note slides up into pitch and sags at the end, like "nya".
    kitty: { level:0.95, partials:[[1, 1, 'triangle'], [2, 0.22, 'sine'], [3, 0.07, 'sine']], attack:0.025, decay:0.16, sustain:0.45, bright:5, length:0.6, glide:0.88 },
    flute: { level:0.68, partials:[[1, 1, 'sine'], [2, 0.16, 'sine'], [3, 0.05, 'triangle']], attack:0.07, decay:0.3, sustain:0.72, bright:4, length:0.9, vibrato:5.2 },
  };
  function track(nodes, sources) {
    if (voices.size >= MAX_VOICES) releaseVoice(voices.values().next().value);
    const voice = { oscillators:sources, nodes };
    voices.add(voice);
    sources[0].onended = () => releaseVoice(voice);
    return voice;
  }

  function playNote(midi, { gain = 0.32, dur = 1.25, delay = 0, timbre = 'piano' } = {}) {
    if (!ctx || muted || volume === 0 || !Number.isFinite(midi)) return;
    const tone = TIMBRES[timbre] || TIMBRES.piano;
    const t = ctx.currentTime + Math.max(0, delay);
    const length = dur * tone.length;
    gain *= tone.level;
    const f = midiToFreq(midi + (tone.octave || 0));
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + tone.attack);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, gain * tone.sustain), t + tone.attack + tone.decay);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * tone.bright, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + length);
    env.connect(lp);
    lp.connect(master);
    const sources = [];
    const nodes = [env, lp];
    let lfoGain = null;
    if (tone.vibrato) {
      // A gentle, late-arriving vibrato so long flute notes sing.
      const lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.value = tone.vibrato;
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(f * 0.007, t + 0.35);
      lfo.connect(lfoGain);
      lfo.start(t); lfo.stop(t + length + 0.025);
      nodes.push(lfo, lfoGain);
    }
    for (const [mult, weight, type] of tone.partials) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f * mult;
      if (tone.glide) {
        osc.frequency.setValueAtTime(f * mult * tone.glide, t);
        osc.frequency.exponentialRampToValueAtTime(f * mult, t + 0.07);
        osc.frequency.exponentialRampToValueAtTime(f * mult * 0.95, t + length);
      }
      if (lfoGain) lfoGain.connect(osc.frequency);
      partial.gain.value = weight;
      osc.connect(partial);
      partial.connect(env);
      sources.push(osc);
      nodes.push(osc, partial);
      osc.start(t);
      osc.stop(t + length + 0.025);
    }
    track(nodes, sources);
  }

  let noise = null;
  function playDrum(kind, { gain = 0.2, delay = 0 } = {}) {
    if (!ctx || muted || volume === 0) return;
    const t = ctx.currentTime + Math.max(0, delay);
    const env = ctx.createGain();
    env.connect(master);
    if (kind === 'kick') {
      // A soft, round thump: a sine sweeping down in pitch.
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.13);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(env);
      osc.start(t); osc.stop(t + 0.35);
      track([env, osc], [osc]);
      return;
    }
    // A brushed tick from filtered noise.
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = kind === 'shaker' ? 4200 : 7000;
    const length = kind === 'shaker' ? 0.09 : 0.045;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(hp); hp.connect(env);
    src.start(t); src.stop(t + length + 0.02);
    track([env, hp, src], [src]);
  }

  function playChord(midis, gain = 0.16) {
    midis.forEach((midi, i) => playNote(midi, { gain, dur: 1.6, delay: i * 0.055 }));
  }
  function playError() { playNote(60, { gain: 0.07, dur: 0.3 }); }
  function playMiss() { playNote(55, { gain: 0.10, dur: 0.7 }); }
  function stopAll() { [...voices].forEach(releaseVoice); }
  function getStatus() {
    return { available: !unavailable, state: ctx?.state || 'uninitialized', voices: voices.size, muted, volume };
  }
  return { init, playNote, playDrum, playChord, playError, playMiss, setVolume, setMuted, stopAll, getStatus, timbres:Object.keys(TIMBRES) };
})();

// 旋律の設計 — カノン風コード進行を単語ごとに巡回する。
// 各フレーズは和音の輪郭を保ちつつ、隣の和音へ自然に着地させる。
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

  // 短い単語でも歌えるように、毎回ただ上昇するのではなく
  // 跳躍 → 隣接音 → 着地、の輪郭を交互に使う。
  const MOTIFS = [
    [0, 1, 2, 1, 2, 3, 4, 3],
    [1, 2, 1, 0, 1, 2, 4, 2],
    [2, 1, 0, 1, 2, 4, 3, 2],
    [0, 2, 1, 2, 3, 2, 1, 0],
  ];

  function nextWordChord() {
    const index = wordIndex++;
    const triad = PROGRESSION[index % PROGRESSION.length];
    const nextTriad = PROGRESSION[(index + 1) % PROGRESSION.length];
    const palette = [triad[0], triad[1], triad[2], nextTriad[0] + 12, nextTriad[1] + 12];
    const motif = MOTIFS[index % MOTIFS.length];
    const seq = motif.map((step) => palette[step]);
    return { triad, seq };
  }

  function reset() { wordIndex = 0; }

  return { nextWordChord, reset };
})();
