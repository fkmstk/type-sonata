// Canvas particle layer: stars, notes, rings and confetti with light physics.
// Drawing only runs while particles are alive, so an idle page costs nothing.
const FX = (() => {
  const MAX = 320;
  const COLORS = ['#efb552', '#e8786c', '#78af91', '#b4a4c9', '#7fb3c8', '#f4c96e'];
  const particles = [];
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let enabled = () => true;

  function init(element, isEnabled) {
    canvas = element;
    ctx = canvas.getContext('2d');
    enabled = isEnabled;
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  function add(p) {
    if (particles.length >= MAX) particles.shift();
    particles.push({ age:0, rot:0, vr:0, g:0, drag:0, vx:0, vy:0, color:COLORS[0], alpha:1, ...p });
    if (!raf && ctx) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  const center = (el) => {
    const box = el?.getBoundingClientRect();
    return box && box.width ? { x:box.left + box.width / 2, y:box.top + box.height / 2 } : null;
  };

  function starPath(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? r * 0.46 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
  }
  function heartPath(r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.4, 0, -r * 0.5);
    ctx.bezierCurveTo(r * 0.6, -r * 1.4, r * 1.6, -r * 0.2, 0, r * 0.9);
    ctx.closePath();
  }
  function draw(p) {
    const t = p.age / p.life;
    // Pop in quickly, hold, then fade in the last 40%.
    const scale = t < 0.18 ? Math.max(0, easeOutBack(t / 0.18)) : 1;
    const alpha = p.alpha * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === 'ring') {
      const r = p.size * (0.25 + 0.75 * (1 - Math.pow(1 - t, 3)));
      ctx.globalAlpha = Math.max(0, p.alpha * (1 - t));
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.strokeStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === 'confetti') {
      ctx.scale(1, Math.cos(p.age * p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
    } else if (p.kind === 'note') {
      ctx.scale(scale, scale);
      ctx.fillStyle = p.color;
      ctx.font = `${p.size}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.glyph, 0, 0);
    } else if (p.kind === 'heart') {
      ctx.scale(scale, scale);
      heartPath(p.size / 2);
      ctx.fillStyle = p.color; ctx.fill();
    } else if (p.kind === 'dot') {
      ctx.scale(scale, scale);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'flyer') {
      ctx.shadowColor = '#f6c45e';
      ctx.shadowBlur = 16;
      ctx.scale(p.scale, p.scale);
      starPath(p.size); ctx.fillStyle = p.color; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#d89b35'; ctx.stroke();
    } else {
      ctx.scale(scale, scale);
      starPath(p.size / 2);
      ctx.fillStyle = p.color; ctx.fill();
    }
    ctx.restore();
  }
  function step(p, dt) {
    p.age += dt;
    if (p.kind === 'flyer') {
      // Quadratic Bézier arc with ease-in-out; leaves a glittering trail.
      const raw = Math.min(1, p.age / p.life);
      const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      const u = 1 - t;
      p.x = u * u * p.from.x + 2 * u * t * p.ctrl.x + t * t * p.to.x;
      p.y = u * u * p.from.y + 2 * u * t * p.ctrl.y + t * t * p.to.y;
      p.rot = t * Math.PI * 2;
      p.scale = 0.7 + Math.sin(t * Math.PI) * 0.6;
      if (Math.random() < 0.8) add({ kind:pick(['star', 'dot']), x:p.x + rand(-6, 6), y:p.y + rand(-6, 6), vx:rand(-30, 30), vy:rand(-20, 40), g:120, drag:2, size:rand(5, 11), life:rand(0.35, 0.6), color:pick(COLORS) });
      if (raw >= 1) { p.age = p.life; p.onArrive?.(); }
      return;
    }
    const drag = Math.exp(-p.drag * dt);
    p.vx *= drag; p.vy *= drag;
    p.vy += p.g * dt;
    // Paper flutters: once falling, it drifts down slowly instead of dropping.
    if (p.maxFall && p.vy > p.maxFall) { p.vy = p.maxFall; p.vx *= Math.exp(-1.5 * dt); }
    if (p.sway) p.vx += Math.sin(p.age * p.sway) * p.swayForce * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  function tick(now) {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      step(p, dt);
      if (p.age >= p.life || p.y > innerHeight + 60) particles.splice(i, 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles.forEach((p) => { if (!(p.delay > 0)) draw(p); });
    raf = particles.length ? requestAnimationFrame(tick) : 0;
    if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  function burst(target, { count = 10, speed = 260, size = 16, kinds = ['star', 'star', 'dot'], colors = COLORS, gravity = 520, spread = Math.PI * 2, angle = -Math.PI / 2, life = 0.9 } = {}) {
    if (!enabled()) return;
    const at = target?.nodeType ? center(target) : target;
    if (!at) return;
    for (let i = 0; i < count; i++) {
      const a = angle + (spread >= Math.PI * 2 ? (i / count) * spread : rand(-spread / 2, spread / 2)) + rand(-0.2, 0.2);
      const v = speed * rand(0.55, 1.1);
      add({ kind:pick(kinds), x:at.x, y:at.y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, g:gravity, drag:3.2, vr:rand(-6, 6), size:size * rand(0.6, 1.15), life:life * rand(0.75, 1.15), color:pick(colors) });
    }
  }
  function ring(target, { color = '#efb552', size = 46 } = {}) {
    if (!enabled()) return;
    const at = target?.nodeType ? center(target) : target;
    if (at) add({ kind:'ring', x:at.x, y:at.y, size, life:0.5, color });
  }
  function notes(target, { count = 3, color } = {}) {
    if (!enabled()) return;
    const at = target?.nodeType ? center(target) : target;
    if (!at) return;
    for (let i = 0; i < count; i++) {
      add({ kind:'note', glyph:pick(['♪', '♫', '♩']), x:at.x + rand(-14, 14), y:at.y - 10, vx:rand(-40, 40), vy:rand(-190, -120), g:-30, drag:1.2, sway:rand(5, 8), swayForce:rand(90, 160), vr:rand(-1.5, 1.5), size:rand(22, 32), life:rand(1.1, 1.5), color:color || pick(COLORS) });
    }
  }
  function hearts(target, { count = 4 } = {}) {
    if (!enabled()) return;
    const at = target?.nodeType ? center(target) : target;
    if (!at) return;
    for (let i = 0; i < count; i++) {
      add({ kind:'heart', x:at.x + rand(-18, 18), y:at.y - 6, vx:rand(-60, 60), vy:rand(-200, -130), g:-20, drag:1.4, sway:rand(4, 7), swayForce:rand(80, 140), vr:rand(-1, 1), size:rand(18, 26), life:rand(1, 1.4), color:pick(['#e8786c', '#edac95', '#f2a0b5']), delay:i * 0.06 });
    }
  }
  function confetti() {
    if (!enabled()) return;
    // Two cannons from the lower corners, then a soft drift back down.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 70; i++) {
        // Tilt from vertical toward the middle of the screen.
        const tilt = rand(0.12, 0.7);
        const v = rand(1100, 1650) * Math.min(1.1, innerHeight / 800);
        add({ kind:i % 7 ? 'confetti' : 'star', x:side < 0 ? -10 : innerWidth + 10, y:innerHeight * 0.95, vx:-side * Math.sin(tilt) * v, vy:-Math.cos(tilt) * v, g:900, drag:0.9, maxFall:rand(110, 190), sway:rand(3, 6), swayForce:rand(60, 140), vr:rand(-9, 9), flip:rand(6, 14), size:rand(9, 15), life:rand(3.8, 4.8), color:pick(COLORS), delay:rand(0, 0.25) });
      }
    }
  }
  function fly(fromEl, toEl, onArrive) {
    const from = center(fromEl);
    const to = center(toEl);
    if (!enabled() || !from || !to) { onArrive?.(); return; }
    const ctrl = { x:(from.x + to.x) / 2 + (to.x < from.x ? -60 : 60), y:Math.min(from.y, to.y) - 140 };
    add({ kind:'flyer', from, to, ctrl, x:from.x, y:from.y, size:17, scale:1, life:0.68, color:'#f6c45e', onArrive });
  }
  function clear() { particles.length = 0; }
  function count() { return particles.length; }
  return { init, burst, ring, notes, hearts, confetti, fly, clear, count };
})();
