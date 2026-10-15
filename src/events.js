'use strict';
class Mash {
  constructor(mult) { this.p = 0; this.last = -1; this.mult = mult; this.cap = 13; this.taps = 0; }
  tap(side) {
    const g = (side !== this.last ? 1 : 0.15) * this.mult;
    this.last = side; this.taps++;
    this.p = Math.min(this.cap, this.p + g);
  }
  update(dt) { this.p -= this.p * 0.8 * dt; }
}

class Ev {
  constructor(o) {
    this.o = o; this.mash = new Mash(o.mult); this.msgs = []; this.T = 0; this.done = false;
    this.actLabel = 'ACTION'; this.surface = 'red'; this.timers = []; this.held = false;
  }
  later(ms, fn) { this.timers.push({ t: ms / 1000, fn }); }
  tick(dt) {
    this.T += dt; this.mash.update(dt);
    for (const t of this.timers) { t.t -= dt; if (t.t <= 0 && !t.fired) { t.fired = true; t.fn(); } }
    this.timers = this.timers.filter(t => !t.fired);
    for (const m of this.msgs) m.t += dt;
    this.msgs = this.msgs.filter(m => m.t < m.dur);
  }
  msg(text, color = '#fff', dur = 1.2, sub = '', size = 1) { this.msgs = [{ text, color, dur, t: 0, sub, size }]; }
  finish(res) { if (this.done) return; this.done = true; this.o.onDone(res); }
  runStep(a, dt, cap = 1) {
    const target = this.mash.p * cap;
    a.v += (target - a.v) * Math.min(1, dt * 5);
    a.x += a.v * dt;
    const before = Math.floor(a.ph / Math.PI);
    a.ph += TAU * a.v / 4.4 * dt;
    if (Math.floor(a.ph / Math.PI) !== before && a.v > 1) { SFX.step(); if (a.v > 4) burst(a.x - 0.1, 0.02, a.d, 2, 'rgba(255,190,160,.6)', 1, 0.8, 0.04, 0.35); }
  }
  poseFor(a, carry) { return a.v < 0.35 && !carry ? POSES.stand() : runPose(a.ph, clamp(a.v / 7.5, 0.3, 1), carry); }
  follow(x, dt, k = 6) { R.camX = lerp(R.camX, x, Math.min(1, dt * k)); }
  // --- HUD ---
  hud(ctx, center, opts = {}) {
    const W = R.W, s = clamp(Math.min(W, R.H) / 24, 13, 24), top = Math.max(14, s * 0.9);
    txt(ctx, this.o.name, 14, top, s * 1.05, '#fff', 'left', 900, 'rgba(34,227,255,.6)');
    txt(ctx, opts.sub || this.o.sub, 14, top + s * 1.3, s * 0.68, '#9aa6d6', 'left', 700, null, false);
    txt(ctx, `QUALIFY ${this.o.qualStr}`, 14, top + s * 2.3, s * 0.68, '#ffd23f', 'left', 800, null, false);
    if (center) txt(ctx, center, W / 2, top + s * (R.portrait ? 6.6 : 0.6), s * (R.portrait ? 1.7 : 2.1), '#fff', 'center', 900, 'rgba(34,227,255,.8)');
    if (opts.speed != null) {
      const mw = Math.min(W * 0.42, 260), mh = clamp(s * 0.9, 12, 20);
      meter(ctx, 14, top + s * 3.9, mw, mh, opts.speed / 12.5, opts.speedLabel || 'SPEED');
    }
    txt(ctx, `SCORE ${this.o.score.toLocaleString()}`, W - 64, top + 2, s * 0.72, '#fff', 'right', 800, null, false);
    this.drawMsgs(ctx);
  }
  drawMsgs(ctx) {
    for (const m of this.msgs) {
      const k = Math.min(1, m.t / 0.12), out = Math.min(1, (m.dur - m.t) / 0.25);
      const s = clamp(Math.min(R.W, R.H) / 9, 30, 84) * m.size * (0.7 + 0.3 * k);
      ctx.globalAlpha = Math.max(0, out);
      const y = Math.min(R.H * 0.36, R.groundY - R.TH - s * 1.4);
      txt(ctx, m.text, R.W / 2, y, s, m.color, 'center', 900, m.color);
      if (m.sub) txt(ctx, m.sub, R.W / 2, y + s * 0.85, s * 0.38, '#fff', 'center', 800, null, false);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------- props ----------------
function drawHurdle(ctx, x, d, down, t) {
  const h = 1.067, w = 0.09;
  const pa = proj(x, 0, d - w), pb = proj(x, 0, d + w);
  ctx.lineCap = 'round';
  if (down) {
    const k = clamp(t * 5, 0, 1), hh = lerp(h, 0.12, k), sk = lerp(0, 0.5, k);
    const ta = proj(x + sk, hh, d - w), tb = proj(x + sk, hh, d + w);
    ctx.strokeStyle = '#ccd'; ctx.lineWidth = Math.max(1, 0.035 * pa[2]);
    seg(ctx, pa[0], pa[1], ta[0], ta[1]); seg(ctx, pb[0], pb[1], tb[0], tb[1]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, 0.09 * pa[2]); seg(ctx, ta[0], ta[1], tb[0], tb[1]);
    return;
  }
  const ta = proj(x, h, d - w), tb = proj(x, h, d + w);
  ctx.strokeStyle = '#d7dcff'; ctx.lineWidth = Math.max(1, 0.035 * pa[2]);
  seg(ctx, pa[0], pa[1], ta[0], ta[1]); seg(ctx, pb[0], pb[1], tb[0], tb[1]);
  seg(ctx, pa[0] - 0.25 * pa[2], pa[1], pa[0] + 0.05 * pa[2], pa[1]); seg(ctx, pb[0] - 0.25 * pb[2], pb[1], pb[0] + 0.05 * pb[2], pb[1]);
  const bw = Math.max(3, 0.12 * pa[2]);
  ctx.lineCap = 'butt'; ctx.lineWidth = bw;
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = i % 2 ? '#111' : '#fff';
    seg(ctx, lerp(ta[0], tb[0], i / 5), lerp(ta[1], tb[1], i / 5), lerp(ta[0], tb[0], (i + 1) / 5), lerp(ta[1], tb[1], (i + 1) / 5));
  }
}
function drawFlag(ctx, x, d, color, label) {
  const b = proj(x, 0, d), t = proj(x, 1.3, d);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, b[2] * 0.03); seg(ctx, b[0], b[1], t[0], t[1]);
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0] + b[2] * 0.5, t[1] + b[2] * 0.15); ctx.lineTo(t[0], t[1] + b[2] * 0.3); ctx.fill();
  if (label) txt(ctx, label, t[0], t[1] - b[2] * 0.25, Math.max(10, b[2] * 0.28), color, 'center', 800, null, false);
}
function drawJavelin(ctx, x, y, d, ang, len = 2.6) {
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const a = proj(x - cx * len / 2, y - cy * len / 2, d), b = proj(x + cx * len / 2, y + cy * len / 2, d);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = Math.max(2, a[2] * 0.045); seg(ctx, a[0], a[1], b[0], b[1]);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(3, a[2] * 0.07);
  seg(ctx, lerp(a[0], b[0], 0.46), lerp(a[1], b[1], 0.46), lerp(a[0], b[0], 0.56), lerp(a[1], b[1], 0.56));
  ctx.strokeStyle = '#ff3d8b'; ctx.lineWidth = Math.max(2, a[2] * 0.05);
  seg(ctx, lerp(a[0], b[0], 0.9), lerp(a[1], b[1], 0.9), b[0], b[1]);
}
function grassField(ctx, x0, x1, d0, d1, step = 5) {
  const [v0, v1] = visibleRange(d0);
  const a = Math.max(x0, v0 - 4), b = Math.min(x1, v1 + 8);
  for (let x = Math.floor(a / step) * step; x < b; x += step) {
    groundQuad(ctx, Math.max(x, x0), Math.min(x + step, x1), d0, d1, (Math.floor(x / step) % 2) ? '#1f7a43' : '#23894b');
  }
}
function distanceLines(ctx, origin, from, to, every, d0, d1, labelD) {
  const [v0, v1] = visibleRange(0);
  for (let m = from; m <= to; m += every) {
    const x = origin + m; if (x < v0 - 3 || x > v1 + 6) continue;
    groundLine(ctx, x, d0, d1, 'rgba(255,255,255,.7)', 0.05);
    groundText(ctx, m + '', x + 0.6, labelD, 0.9, 'rgba(255,255,255,.75)');
  }
}

// ---------------- 100m / 110m hurdles ----------------
class Race extends Ev {
  constructor(o, hurdles) {
    super(o);
    this.hurdles = hurdles; this.D = hurdles ? 110 : 100;
    this.actLabel = hurdles ? 'JUMP' : 'DIVE';
    this.surface = hurdles ? 'blue' : 'red';
    this.fs = 0; this.lanesD = [0.16, 0.5, 0.84];
    this.hx = hurdles ? Array.from({ length: 10 }, (_, i) => 13.72 + i * 9.14) : [];
    this.reset();
    R.camX = 2;
  }
  reset() {
    this.mash.p = 0;
    const mk = (d, kit) => ({ x: 0, v: 0, ph: 0, y: 0, d, kit, air: 0, stumble: 0, down: this.hx.map(() => -1), fin: null });
    this.p = mk(this.lanesD[0], 'player');
    const lb = this.o.lowerBetter;
    this.cpus = [mk(this.lanesD[1], 'cpu'), mk(this.lanesD[2], 'cpu2')];
    for (const c of this.cpus) {
      const T = this.o.qual * (0.93 + Math.random() * 0.1);
      c.P = (this.D) / (T - 1.25 + (this.hurdles ? 0.15 : 0)); c.T = T;
    }
    this.state = 'marks'; this.st = 0; this.setDur = 0.9 + Math.random() * 1.4; this.t = 0;
    this.msg('ON YOUR MARKS', '#fff', 1.3, this.fs ? 'One more false start and you are out' : '', 0.6);
    SFX.beep(false);
  }
  run(side) {
    if (this.state === 'marks' || this.state === 'set') return this.falseStart();
    if (this.state === 'go' || this.state === 'fin') { this.mash.tap(side); }
  }
  falseStart() {
    this.fs++; this.state = 'fs'; SFX.foul(); shake(6, 0.3);
    if (this.fs >= 2) {
      this.msg('DISQUALIFIED', '#ff4d5e', 2.2, 'Second false start', 0.8);
      this.later(2000, () => this.finish({ perf: null, foul: true, marks: ['DQ'] }));
    } else {
      this.msg('FALSE START', '#ff4d5e', 1.6, 'Wait for the gun!', 0.8);
      this.later(1700, () => this.reset());
    }
  }
  actDown() {
    const a = this.p;
    if (this.state === 'marks' || this.state === 'set') return this.falseStart();
    if (this.state !== 'go') return;
    if (this.hurdles) {
      if (a.air <= 0 && a.stumble <= 0) { a.air = 0.001; SFX.whoosh(); }
    } else if (!a.dive && a.x > this.D - 3) { a.dive = 0.001; }
  }
  updAthlete(a, dt, cpu) {
    if (cpu) {
      if (this.state === 'go' || this.state === 'fin') {
        const tt = this.t;
        const target = a.fin != null ? Math.max(0, a.v - 6 * dt) : a.P * (1 - Math.exp(-0.8 * tt));
        a.v = a.stumble > 0 ? a.v : target;
        a.x += a.v * dt;
        const before = Math.floor(a.ph / Math.PI);
        a.ph += TAU * a.v / 4.4 * dt; if (Math.floor(a.ph / Math.PI) !== before && a.v > 1 && Math.random() < 0.4) SFX.step();
        if (this.hurdles && a.air <= 0) { for (const h of this.hx) if (h - a.x > 1.6 && h - a.x < 1.6 + a.v * dt + 0.01) a.air = 0.001; }
      }
    } else if (this.state === 'go' || this.state === 'fin') {
      if (a.fin != null) { a.v = Math.max(0, a.v - 5 * dt); a.x += a.v * dt; a.ph += TAU * a.v / 4.4 * dt; }
      else this.runStep(a, dt, this.hurdles ? 0.84 : 1);
    }
    if (a.air > 0) {
      const T = 0.5; a.air += dt; const u = a.air / T;
      a.y = u >= 1 ? 0 : 0.62 * 4 * u * (1 - u);
      if (u >= 1) { a.air = 0; a.y = 0; }
    }
    if (a.stumble > 0) a.stumble -= dt;
    if (a.dive > 0) a.dive += dt;
    // hurdle collisions
    if (this.hurdles) this.hx.forEach((h, i) => {
      if (a.down[i] === -1 && a.x >= h && a.x - a.v * dt < h) {
        if (a.y < 0.38 && !cpu) {
          a.down[i] = 0; a.v *= 0.55; this.mash.p *= 0.55; a.stumble = 0.45; SFX.clank(); shake(5, 0.2);
          burst(h, 0.5, a.d, 8, '#fff', 2, 1.5, 0.05, 0.5);
        } else a.down[i] = -2;
      }
      if (a.down[i] >= 0) a.down[i] += dt;
    });
    if (a.fin == null && a.x >= this.D) {
      a.fin = this.t - (a.x - this.D) / Math.max(1, a.v);
      if (cpu) SFX.tick();
    }
  }
  update(dt) {
    this.tick(dt);
    this.st += dt;
    if (this.state === 'marks' && this.st > 1.4) { this.state = 'set'; this.st = 0; this.msg('SET', '#ffd23f', this.setDur, '', 0.7); SFX.beep(false); }
    else if (this.state === 'set' && this.st > this.setDur) {
      this.state = 'go'; this.st = 0; this.t = 0; this.msg('GO!', '#3dff9a', 0.8, '', 1.1); SFX.gun(); shake(4, 0.15);
    }
    if (this.state === 'go' || this.state === 'fin') this.t += dt;
    this.updAthlete(this.p, dt, false);
    for (const c of this.cpus) this.updAthlete(c, dt, true);
    if (this.state === 'go' && this.p.fin != null) {
      this.state = 'fin';
      const time = this.p.fin;
      const place = 1 + this.cpus.filter(c => c.fin != null && c.fin < time).length + this.cpus.filter(c => c.fin == null && c.x > this.D - 0.5).length;
      const q = time <= this.o.qual;
      this.place = place;
      this.msg(time.toFixed(2), q ? '#3dff9a' : '#ff4d5e', 2.6, ['1ST', '2ND', '3RD'][place - 1] + ' PLACE' + (q ? ' \u00b7 QUALIFIED' : ''), 0.95);
      if (q) SFX.cheer(place === 1); else SFX.sad();
      this.later(2600, () => this.finish({ perf: time, foul: false, marks: [time.toFixed(2) + 's', ['1st', '2nd', '3rd'][place - 1]] }));
    }
    // safety: player gave up
    if (this.state === 'go' && this.t > 40) { this.state = 'fin'; this.finish({ perf: null, foul: true, marks: ['DNF'] }); }
    this.follow(this.p.x + (R.portrait ? 2.5 : 4), dt);
    if (R.shakeT > 0) R.shakeT -= dt;
    updParts(dt);
  }
  pose(a) {
    if (this.state === 'marks' || (this.state === 'fs' && a.x === 0)) return POSES.marks();
    if (this.state === 'set') return POSES.set();
    if (a.stumble > 0) return POSES.stumble();
    if (a.air > 0) return POSES.hurdle();
    if (a.dive > 0 && a.dive < 0.5) { const p = runPose(a.ph, 1); p.lean = 0.7; p.arms = [[-1.2, -1], [-1.4, -1.2]]; return p; }
    if (a.fin != null && a.v < 1.5) {
      return a.kit === 'player' && this.place === 1 ? POSES.celebrate(this.T) : (a.kit === 'player' && this.place != null && this.p.fin > this.o.qual ? POSES.slump() : POSES.stand());
    }
    return this.poseFor(a);
  }
  draw(ctx) {
    const [v0, v1] = visibleRange(0);
    laneLines(ctx, [0, 0.33, 0.67, 1]);
    groundLine(ctx, 0, 0, 1, '#fff', 0.1);
    // finish
    for (let i = 0; i < 12; i++) {
      groundQuad(ctx, this.D, this.D + 0.4, i / 12, (i + 1) / 12, i % 2 ? '#111' : '#fff');
    }
    for (let m = 10; m < this.D; m += 10) if (m > v0 - 2 && m < v1 + 2) {
      groundLine(ctx, m, 0.98, 1, '#fff', 0.06);
      groundText(ctx, m + 'm', m, 0.06, 0.8, 'rgba(255,255,255,.35)');
    }
    groundText(ctx, '1', 1.5, 0.16, 0.9, 'rgba(255,255,255,.5)');
    groundText(ctx, '2', 1.5, 0.5, 0.9, 'rgba(255,255,255,.5)');
    groundText(ctx, '3', 1.5, 0.84, 0.9, 'rgba(255,255,255,.5)');
    // finish gantry
    const fp = proj(this.D + 0.2, 0, 1.05), ft = proj(this.D + 0.2, 3.2, 1.05);
    ctx.strokeStyle = '#99a'; ctx.lineWidth = Math.max(2, fp[2] * 0.08); seg(ctx, fp[0], fp[1], ft[0], ft[1]);
    ctx.fillStyle = '#0a0d26'; ctx.fillRect(ft[0] - fp[2] * 1.2, ft[1] - fp[2] * 0.7, fp[2] * 2.4, fp[2] * 0.8);
    txt(ctx, this.t.toFixed(2), ft[0], ft[1] - fp[2] * 0.3, fp[2] * 0.55, '#ff3d8b', 'center', 900, '#ff3d8b', false);
    // lanes back to front
    const all = [this.cpus[1], this.cpus[0], this.p];
    for (const a of all) {
      this.hx.forEach((h, i) => { if (h > v0 - 2 && h < v1 + 2) drawHurdle(ctx, h, a.d, a.down[i] >= 0, a.down[i]); });
      drawAthlete(ctx, a.x, a.y, a.d, this.pose(a), a.kit);
    }
    drawParts(ctx);
    speedLines(ctx, this.p.v);
    this.hud(ctx, this.state === 'go' || this.state === 'fin' ? (this.p.fin ?? this.t).toFixed(2) : '0.00', { speed: this.p.v, sub: this.o.sub + (this.fs ? ' \u00b7 1 FALSE START' : '') });
  }
}

// ---------------- Field events base ----------------
class Field extends Ev {
  constructor(o, n = 3) { super(o); this.n = n; this.marks = []; this.best = null; }
  get attemptNo() { return this.marks.length + 1; }
  record(val, label) {
    this.marks.push(val);
    if (val != null && (this.best == null || val > this.best)) this.best = val;
    this.later(2400, () => {
      if (this.marks.length >= this.n) this.finish({ perf: this.best, foul: this.best == null, marks: this.marks.map(m => m == null ? 'X' : m.toFixed(2)) });
      else this.newAttempt();
    });
  }
  subLine() { return `${this.o.sub} \u00b7 ATTEMPT ${Math.min(this.attemptNo, this.n)}/${this.n}${this.best != null ? ' \u00b7 BEST ' + this.best.toFixed(2) : ''}`; }
}

// ---------------- Long jump ----------------
class LongJump extends Field {
  constructor(o) { super(o); this.actLabel = 'JUMP'; this.BOARD = 40; this.FOUL = 40.2; this.newAttempt(); }
  newAttempt() {
    this.mash.p = 0;
    this.a = { x: 0, v: 0, ph: 0, y: 0, d: 0.5 };
    this.state = 'ready'; this.ang = 0; this.fl = null; this.land = null; R.camX = 3;
    this.msg('RUN!', '#fff', 1.2, 'Tap RUN alternately \u00b7 JUMP at the board', 0.7);
  }
  run(side) { if (this.state === 'ready') this.state = 'run'; if (this.state === 'run') this.mash.tap(side); }
  actDown() {
    if (this.state !== 'run' || this.a.v < 0.5) return;
    this.state = 'hold'; this.ang = 5; this.tx = this.a.x; this.tv = this.a.v; SFX.tap();
  }
  actUp() { if (this.state === 'hold') this.launch(); }
  launch() {
    const th = this.ang * Math.PI / 180, s = this.tv * 0.9;
    this.state = 'air'; this.fl = { vx: s * Math.cos(th), vy: s * Math.sin(th), t: 0 };
    this.foul = this.tx > this.FOUL; SFX.whoosh();
  }
  update(dt) {
    this.tick(dt);
    const a = this.a;
    if (this.state === 'run') {
      this.runStep(a, dt);
      if (a.x > this.FOUL + 0.4) {
        this.state = 'over'; this.foul = true; SFX.foul(); this.msg('FOUL', '#ff4d5e', 2, 'Ran past the board', 1);
        this.record(null);
      }
    } else if (this.state === 'hold') {
      this.ang = Math.min(80, this.ang + 115 * dt);
      if (this.ang >= 80) this.launch();
    } else if (this.state === 'air') {
      const f = this.fl; f.t += dt;
      a.x += f.vx * dt; f.vy -= 9.81 * dt; a.y += f.vy * dt;
      if (a.y <= 0 && f.vy < 0) {
        a.y = 0; this.state = 'land'; this.landX = a.x + 0.25; this.landT = 0;
        if (this.landX > 41) { SFX.sand(); burst(this.landX, 0.05, a.d, 26, '#e7c98a', 3, 3, 0.07, 1); } else SFX.thud();
        shake(5, 0.2);
        const dist = this.landX - this.FOUL;
        if (this.foul) { this.msg('FOUL', '#ff4d5e', 2.2, 'Stepped over the board', 1); SFX.foul(); this.record(null); }
        else {
          const q = dist >= this.o.qual;
          this.msg(dist.toFixed(2) + ' m', q ? '#3dff9a' : '#ffd23f', 2.2, `${Math.round(this.ang)}\u00b0 \u00b7 ${this.tv.toFixed(1)} m/s${q ? ' \u00b7 QUALIFIED' : ''}`, 1);
          if (q) SFX.cheer(dist > this.o.qual * 1.15);
          this.record(dist);
        }
      }
    } else if (this.state === 'land') {
      this.landT += dt; a.v = 0;
    } else if (this.state === 'over') {
      a.v = Math.max(0, a.v - 10 * dt); a.x += a.v * dt; a.ph += TAU * a.v / 4.4 * dt;
    }
    this.follow(a.x + (this.state === 'air' || this.state === 'land' ? 1.5 : (R.portrait ? 2.5 : 4)), dt);
    if (R.shakeT > 0) R.shakeT -= dt;
    updParts(dt);
  }
  draw(ctx) {
    grassField(ctx, -50, 200, -1.5, 0.3); grassField(ctx, -50, 200, 0.7, 1);
    grassField(ctx, 52, 200, 0.3, 0.7);
    // pit
    groundQuad(ctx, 40.9, 52, 0.26, 0.74, '#5a4a2e');
    groundQuad(ctx, 41, 51.9, 0.28, 0.72, '#e3c27a');
    groundQuad(ctx, this.BOARD, this.FOUL, 0.32, 0.68, '#fff');
    groundQuad(ctx, this.FOUL, this.FOUL + 0.1, 0.32, 0.68, '#7a6a5a');
    for (let m = 3; m <= 10; m++) groundText(ctx, m + '', this.FOUL + m, 0.2, 0.7, 'rgba(255,255,255,.75)');
    for (let m = 3; m <= 10; m++) groundLine(ctx, this.FOUL + m, 0.26, 0.29, '#fff', 0.05);
    groundLine(ctx, this.FOUL + this.o.qual, 0.28, 0.72, 'rgba(255,210,63,.75)', 0.05);
    for (let m = 10; m < 40; m += 10) groundText(ctx, (40 - m) + 'm', m, 0.18, 0.7, 'rgba(255,255,255,.4)');
    if (this.best != null) drawFlag(ctx, this.FOUL + this.best, 0.72, '#22e3ff', 'BEST');
    drawFlag(ctx, this.FOUL + this.o.qual, 0.76, '#ffd23f', 'Q');
    if (this.state === 'land' && !this.foul) {
      const lp = proj(this.landX, 0, 0.5);
      ctx.fillStyle = 'rgba(90,60,30,.5)'; ctx.beginPath(); ctx.ellipse(lp[0], lp[1], lp[2] * 0.3, lp[2] * 0.08, 0, 0, TAU); ctx.fill();
    }
    const a = this.a;
    let pose;
    if (this.state === 'hold') pose = POSES.crouch();
    else if (this.state === 'air') pose = POSES.ljAir(clamp(this.fl.t / Math.max(0.3, 2 * this.fl.vy0 || 0.8), 0, 1));
    else if (this.state === 'land') pose = POSES.sit();
    else pose = this.poseFor(a);
    if (this.state === 'air' && this.fl.vy0 == null) this.fl.vy0 = this.fl.vy / 9.81;
    drawAthlete(ctx, a.x, a.y, a.d, pose, 'player', { rot: this.state === 'land' ? 0 : 0 });
    drawParts(ctx);
    speedLines(ctx, a.v);
    const dist = this.state === 'air' ? Math.max(0, a.x - this.FOUL) : this.state === 'land' && !this.foul ? this.landX - this.FOUL : null;
    this.hud(ctx, dist != null ? dist.toFixed(2) + ' m' : (this.state === 'run' ? (this.BOARD - a.x).toFixed(0) + 'm to board' : ''), { speed: this.state === 'run' ? a.v : (this.tv || 0), sub: this.subLine() });
    if (this.state === 'hold' || (this.state === 'air' && this.fl.t < 0.6)) {
      const r = clamp(R.S * 1.6, 60, 120), p = proj(this.tx, 1, 0.5);
      angleGauge(ctx, Math.min(p[0] + R.S * 0.8, R.W - r - 10), p[1] - R.S * 0.5, r, this.ang, 45);
    }
  }
}

// ---------------- Javelin ----------------
class Javelin extends Field {
  constructor(o) { super(o); this.actLabel = 'THROW'; this.LINE = 32; this.newAttempt(); }
  newAttempt() {
    this.mash.p = 0;
    this.a = { x: 0, v: 0, ph: 0, y: 0, d: 0.5 }; this.thrT = -1;
    this.state = 'ready'; this.ang = 0; this.jav = null; this.foul = false; R.camX = 3;
    this.msg('RUN!', '#fff', 1.2, 'Hold THROW to aim \u00b7 release before the line', 0.7);
  }
  run(side) { if (this.state === 'ready') this.state = 'run'; if (this.state === 'run') this.mash.tap(side); }
  actDown() {
    if (this.state !== 'run' || this.a.v < 0.5) return;
    this.state = 'hold'; this.ang = 8; this.tv = this.a.v; SFX.tap();
  }
  actUp() { if (this.state === 'hold') this.release(); }
  release() {
    const a = this.a, th = this.ang * Math.PI / 180, s = 8 + this.tv * 2.0;
    this.state = 'fly'; this.thrT = 0;
    this.jav = { x: a.x + 0.3, y: 1.9, vx: s * Math.cos(th), vy: s * Math.sin(th), ang: th, stuck: false };
    SFX.whoosh(); SFX.swing(1);
  }
  update(dt) {
    this.tick(dt);
    const a = this.a;
    if (this.state === 'run') {
      this.runStep(a, dt);
      if (a.x > this.LINE) { this.state = 'over'; this.doFoul('Crossed the line'); }
    } else if (this.state === 'hold' || this.state === 'fly' || this.state === 'done' || this.state === 'over') {
      a.v = Math.max(0, a.v - 16 * dt); a.x += a.v * dt; a.ph += TAU * a.v / 6 * dt;
      if (this.state === 'hold') { this.ang = Math.min(80, this.ang + 85 * dt); if (this.ang >= 80) this.release(); }
      if (a.x > this.LINE && !this.foul && this.state !== 'over') this.doFoul('Overstepped the line');
    }
    if (this.thrT >= 0) this.thrT += dt;
    const j = this.jav;
    if (j && !j.stuck) {
      j.x += j.vx * dt; j.vy -= 9.81 * dt; j.y += j.vy * dt; j.ang = Math.atan2(j.vy, j.vx);
      if (j.y <= 0) {
        j.y = 0.35 * Math.sin(-j.ang); j.stuck = true; SFX.thud(); shake(4, 0.15);
        burst(j.x, 0.05, 0.5, 14, '#5f3d1e', 2, 2, 0.06, 0.8);
        if (!this.foul) {
          const dist = j.x - this.LINE;
          if (dist <= 0) this.doFoul('No mark');
          else {
            const q = dist >= this.o.qual;
            this.msg(dist.toFixed(2) + ' m', q ? '#3dff9a' : '#ffd23f', 2.2, `${Math.round(this.ang)}\u00b0 \u00b7 ${this.tv.toFixed(1)} m/s${q ? ' \u00b7 QUALIFIED' : ''}`, 1);
            if (q) SFX.cheer(dist > this.o.qual * 1.12);
            this.state = 'done'; this.record(dist);
          }
        }
      }
    }
    const camT = j && this.state !== 'over' ? j.x + (j.stuck ? 0 : 3) : a.x + (R.portrait ? 2.5 : 4);
    this.follow(camT, dt, j ? 4 : 6);
    if (R.shakeT > 0) R.shakeT -= dt;
    updParts(dt);
  }
  doFoul(why) {
    if (this.foul) return;
    this.foul = true; SFX.foul(); this.msg('FOUL', '#ff4d5e', 2.2, why, 1);
    if (this.state === 'run' || this.state === 'over') { this.state = 'over'; }
    this.record(null);
  }
  draw(ctx) {
    grassField(ctx, -60, 400, -1.5, 0.35); grassField(ctx, -60, 400, 0.65, 1);
    grassField(ctx, this.LINE, 400, 0.35, 0.65);
    groundQuad(ctx, this.LINE - 0.1, this.LINE, 0.33, 0.67, '#fff');
    distanceLines(ctx, this.LINE, 10, 110, 10, 0, 1, 0.08);
    groundLine(ctx, this.LINE + this.o.qual, 0, 1, 'rgba(255,210,63,.8)', 0.08);
    drawFlag(ctx, this.LINE + this.o.qual, 0.9, '#ffd23f', 'Q');
    if (this.best != null) drawFlag(ctx, this.LINE + this.best, 0.8, '#22e3ff', 'BEST');
    groundText(ctx, 'FOUL LINE', this.LINE - 1.5, 0.22, 0.45, 'rgba(255,255,255,.6)');
    const a = this.a;
    let pose, carry = !this.jav;
    if (this.state === 'hold') pose = POSES.javHold();
    else if (this.thrT >= 0 && this.thrT < 0.6) pose = POSES.javThrow(clamp(this.thrT / 0.18, 0, 1));
    else pose = this.poseFor(a, carry);
    const J = drawAthlete(ctx, a.x, a.y, a.d, pose, 'player');
    if (carry) {
      const h = J.hand0, ang = this.state === 'hold' ? this.ang * Math.PI / 180 : 0.18;
      drawJavelin(ctx, h[0] + Math.cos(ang) * 0.4, h[1] + Math.sin(ang) * 0.4, 0.49, ang);
    }
    if (this.jav) drawJavelin(ctx, this.jav.x, this.jav.y, 0.5, this.jav.ang);
    drawParts(ctx);
    speedLines(ctx, this.jav && !this.jav.stuck ? 12 : a.v);
    const j = this.jav;
    const dist = j ? Math.max(0, j.x - this.LINE) : null;
    this.hud(ctx, dist != null && !this.foul ? dist.toFixed(2) + ' m' : (this.state === 'run' ? (this.LINE - a.x).toFixed(0) + 'm to line' : ''), { speed: this.state === 'run' ? a.v : (this.tv || 0), sub: this.subLine() });
    if (this.state === 'hold' || (this.thrT >= 0 && this.thrT < 0.6)) {
      const r = clamp(R.S * 1.6, 60, 120), p = proj(a.x, 1, 0.5);
      angleGauge(ctx, Math.min(p[0] + R.S * 1.2, R.W - r - 10), p[1] - R.S * 0.6, r, this.ang, 45);
    }
  }
}

// ---------------- Hammer ----------------
class Hammer extends Field {
  constructor(o) { super(o); this.actLabel = 'RELEASE'; this.surface = 'red'; this.newAttempt(); }
  newAttempt() {
    this.mash.p = 0; this.mash.cap = 13;
    this.state = 'ready'; this.phi = Math.PI / 2; this.spinT = 0; this.ham = null; this.foul = false; this.lastRev = 0; R.camX = 2;
    this.msg('SPIN!', '#fff', 1.4, 'Tap RUN to spin \u00b7 RELEASE in the green zone', 0.7);
  }
  run(side) { if (this.state === 'ready') this.state = 'spin'; if (this.state === 'spin') this.mash.tap(side); }
  omega() { return TAU * (0.35 + clamp(this.mash.p / 13, 0, 1) * 1.45); }
  errDeg() { let psi = this.phi + Math.PI / 2; psi = Math.atan2(Math.sin(psi), Math.cos(psi)); return psi * 180 / Math.PI; }
  actDown() {
    if (this.state !== 'spin') return;
    const err = this.errDeg(), s = 9 + this.mash.p * 1.4;
    this.relP = this.mash.p; this.relErr = err;
    const hp = this.headPos();
    const th = 42 * Math.PI / 180, ce = Math.cos(err * Math.PI / 180);
    this.state = 'fly'; SFX.whoosh();
    if (Math.abs(err) > 40) {
      this.ham = { x: hp[0], y: hp[1], d: hp[2], vx: s * 0.25 * Math.sign(ce || 1), vy: 2, vd: (err > 0 ? 1 : -1) * 0.8, cage: true };
    } else {
      this.ham = { x: hp[0], y: hp[1], d: 0.5, vx: s * Math.cos(th) * ce, vy: s * Math.sin(th), vd: Math.sin(err * Math.PI / 180) * 0.01, cage: false };
    }
  }
  headPos() { const Rr = 1.9; return [Math.cos(this.phi) * Rr, 1.05 + 0.6 * Math.sin(this.phi), 0.5 + Math.sin(this.phi) * 0.32]; }
  update(dt) {
    this.tick(dt);
    if (this.state === 'spin') {
      this.spinT += dt;
      this.phi += this.omega() * dt;
      const rev = Math.floor(this.phi / TAU);
      if (rev !== this.lastRev) { this.lastRev = rev; SFX.swing(this.mash.p / 13); }
      if (this.spinT > 12) { this.state = 'over'; this.doFoul('Time violation'); }
    }
    const h = this.ham;
    if (h && !h.stuck) {
      h.x += h.vx * dt; h.vy -= 9.81 * dt; h.y += h.vy * dt; h.d += h.vd * dt;
      if (h.cage && (h.d > 1.05 || h.d < 0.05 || Math.abs(h.x) > 3)) { h.vx *= -0.2; h.vd *= -0.2; h.vy = Math.min(h.vy, 0); if (!this.foul) { SFX.clank(); this.doFoul('Hit the cage'); } }
      if (h.y <= 0.12) {
        h.y = 0.12; h.stuck = true; SFX.thud(); shake(6, 0.2); burst(h.x, 0.05, h.d, 18, '#5f3d1e', 2.5, 2.5, 0.07, 0.9);
        if (!this.foul) {
          const dist = h.x - 1.07;
          const q = dist >= this.o.qual;
          this.msg(dist.toFixed(2) + ' m', q ? '#3dff9a' : '#ffd23f', 2.2, `${Math.abs(this.relErr).toFixed(0)}\u00b0 off line${q ? ' \u00b7 QUALIFIED' : ''}`, 1);
          if (q) SFX.cheer(dist > this.o.qual * 1.12);
          this.state = 'done'; this.record(dist);
        }
      }
    }
    if (this.state !== 'spin' && this.state !== 'ready') this.mash.p *= Math.max(0, 1 - dt * 2);
    const camT = h && !h.cage ? h.x + (h.stuck ? 0 : 3) : 1.5;
    this.follow(camT, dt, 4);
    if (R.shakeT > 0) R.shakeT -= dt;
    updParts(dt);
  }
  doFoul(why) {
    if (this.foul) return;
    this.foul = true; SFX.foul(); this.msg('FOUL', '#ff4d5e', 2.2, why, 1); this.record(null);
  }
  drawHead(ctx, J) {
    const hp = this.ham ? [this.ham.x, this.ham.y, this.ham.d] : this.headPos();
    const b = proj(hp[0], hp[1], hp[2]);
    if (!this.ham && J) {
      const hand = proj(J.hand0[0], J.hand0[1], 0.5);
      ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 1.5; seg(ctx, hand[0], hand[1], b[0], b[1]);
    }
    const g = ctx.createRadialGradient(b[0] - b[2] * 0.04, b[1] - b[2] * 0.04, 1, b[0], b[1], b[2] * 0.12);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#5a6280');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b[0], b[1], Math.max(3, b[2] * 0.11), 0, TAU); ctx.fill();
    if (this.ham && !this.ham.stuck && !this.ham.cage) {
      const sp = proj(hp[0], 0, hp[2]);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], sp[2] * 0.15, sp[2] * 0.04, 0, 0, TAU); ctx.fill();
    }
  }
  draw(ctx) {
    grassField(ctx, 3, 400, -1.5, 1);
    distanceLines(ctx, 1.07, 10, 90, 10, 0, 1, 0.08);
    groundLine(ctx, 1.07 + this.o.qual, 0, 1, 'rgba(255,210,63,.8)', 0.08);
    drawFlag(ctx, 1.07 + this.o.qual, 0.9, '#ffd23f', 'Q');
    if (this.best != null) drawFlag(ctx, 1.07 + this.best, 0.8, '#22e3ff', 'BEST');
    // circle
    const c = proj(0, 0, 0.5);
    ctx.fillStyle = '#8a8fa8'; ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2] * 1.07, c[2] * 0.32 * R.TH / R.S * 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // cage (back)
    const cage = (front) => {
      ctx.strokeStyle = 'rgba(200,210,255,.35)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, an = lerp(0.35 * Math.PI, 1.65 * Math.PI, t);
        const d = 0.5 + Math.sin(an) * 0.45, x = Math.cos(an) * 3.2;
        if ((d < 0.5) !== front) continue;
        const b = proj(x, 0, d), tp = proj(x, 5, d);
        ctx.strokeStyle = 'rgba(30,35,60,.9)'; ctx.lineWidth = Math.max(1.5, b[2] * 0.05); seg(ctx, b[0], b[1], tp[0], tp[1]);
      }
      ctx.fillStyle = front ? 'rgba(180,190,230,.08)' : 'rgba(180,190,230,.12)';
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const an = lerp(0.35 * Math.PI, 1.65 * Math.PI, i / 20), d = 0.5 + Math.sin(an) * 0.45; const p = proj(Math.cos(an) * 3.2, 5, d); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      for (let i = 20; i >= 0; i--) { const an = lerp(0.35 * Math.PI, 1.65 * Math.PI, i / 20), d = 0.5 + Math.sin(an) * 0.45; const p = proj(Math.cos(an) * 3.2, 0, d); ctx.lineTo(p[0], p[1]); }
      ctx.fill();
    };
    cage(false);
    const hp = this.headPos(), behind = !this.ham && hp[2] > 0.5;
    let pose = POSES.stand();
    if (this.state === 'spin' || (this.state === 'ready')) {
      const dx = hp[0], dy = hp[1] - 1.45;
      const aa = Math.atan2(dx, -dy);
      pose = { hy: 0.92, lean: -0.15 * Math.sign(dx || 1), legs: [[0.25, 0.1], [-0.25, -0.1]], arms: [[aa, aa], [aa + 0.05, aa + 0.05]] };
      if (this.state === 'ready') pose.arms = [[0.4, 0.6], [0.35, 0.55]];
    } else if (this.state === 'fly' || this.state === 'done' || this.state === 'over') {
      pose = POSES.javThrow(1); pose.arms = [[2.4, 2.4], [2.3, 2.3]];
    }
    if (behind || this.ham) this.drawHead(ctx, null);
    const face = this.state === 'spin' ? (Math.sin(this.phi) > 0 ? -1 : 1) : 1;
    if (this.state === 'spin' && face === -1) { pose.arms = pose.arms.map(([u, f]) => [-u, -f]); pose.lean *= -1; }
    const J = drawAthlete(ctx, 0, 0, 0.5, pose, 'player', { face });
    if (!behind && !this.ham) this.drawHead(ctx, J);
    else if (behind && !this.ham) { const hand = proj(J.hand0[0], J.hand0[1], 0.5), b = proj(hp[0], hp[1], hp[2]); ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 1.5; seg(ctx, hand[0], hand[1], b[0], b[1]); }
    cage(true);
    drawParts(ctx);
    const h = this.ham;
    const dist = h && !h.cage && !this.foul ? Math.max(0, h.x - 1.07) : null;
    this.hud(ctx, dist != null ? dist.toFixed(2) + ' m' : '', { speed: this.state === 'spin' ? this.mash.p : (this.relP || 0), speedLabel: 'SPIN', sub: this.subLine() });
    // release dial
    if (this.state === 'spin' || this.state === 'ready') {
      const r = clamp(R.S * 1.2, 46, 90), cx = R.W - r - 16, cy = Math.max(r + 70, R.groundY - R.TH - r - 20);
      ctx.fillStyle = 'rgba(5,8,30,.7)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,160,255,.4)'; ctx.lineWidth = 1; ctx.stroke();
      // green zone: phi in [-130,-50] deg (front of circle); on dial screen-y down = front
      ctx.fillStyle = 'rgba(61,255,154,.4)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, (90 - 40) * Math.PI / 180, (90 + 40) * Math.PI / 180); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(61,255,154,.8)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, (90 - 10) * Math.PI / 180, (90 + 10) * Math.PI / 180); ctx.closePath(); ctx.fill();
      const px = cx + Math.cos(this.phi) * r * 0.8, py = cy - Math.sin(this.phi) * r * 0.8;
      ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 2; seg(ctx, cx, cy, px, py);
      ctx.fillStyle = Math.abs(this.errDeg()) <= 40 ? '#3dff9a' : '#fff'; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
      txt(ctx, 'FIELD \u2192', cx, cy - r - 12, 12, '#9aa6d6', 'center', 700, null, false);
    }
  }
}

// ---------------- High jump ----------------
class HighJump extends Ev {
  constructor(o) {
    super(o); this.actLabel = 'JUMP';
    this.TO = 17.5; this.BX0 = 16.6; this.BX1 = 21.4; this.BD = 0.56;
    this.bar = Math.round((o.qual - 0.15) * 20) / 20; this.tries = 0; this.best = null; this.log = []; this.cur = '';
    this.newAttempt();
  }
  newAttempt() {
    this.mash.p = 0;
    this.a = { x: 0, v: 0, ph: 0, y: 0, d: 0.2 };
    this.state = 'ready'; this.jt = 0; this.arch = null; this.cleared = null; this.barFall = 0; R.camX = 3;
    this.msg(this.bar.toFixed(2) + ' m', '#fff', 1.4, `Attempt ${this.tries + 1}/3 \u00b7 JUMP at the mark, press again to ARCH`, 0.8);
  }
  run(side) { if (this.state === 'ready') this.state = 'run'; if (this.state === 'run') this.mash.tap(side); }
  actDown() {
    const a = this.a;
    if (this.state === 'run' && a.v > 0.5) {
      this.state = 'air'; this.jt = 0; this.tx = a.x; this.tv = a.v;
      const err = Math.abs(a.x - this.TO);
      this.Hb = 1.2 + 0.095 * Math.min(a.v, 11) - 0.3 * err;
      this.tp = 0.5; SFX.whoosh();
    } else if (this.state === 'air' && this.arch == null) {
      const q = clamp(1 - Math.abs(this.jt - this.tp * 0.9) / 0.2, 0, 1);
      this.arch = 0.16 * q; SFX.tap();
    }
  }
  update(dt) {
    this.tick(dt);
    const a = this.a;
    if (this.state === 'run') {
      this.runStep(a, dt, 0.95);
      if (a.x > this.TO + 1.8) { this.state = 'balk'; SFX.foul(); this.msg('NO JUMP', '#ff4d5e', 1.8, 'Ran past the take-off', 0.9); this.resolve(false); }
    } else if (this.state === 'balk') {
      a.v = Math.max(0, a.v - 12 * dt); a.x += a.v * dt; a.ph += TAU * a.v / 4.4 * dt;
    } else if (this.state === 'air') {
      this.jt += dt; const t = this.jt, tp = this.tp;
      const peak = Math.max(this.Hb, 0.9) + 0.06;
      a.x = this.tx + this.tv * 0.22 * t;
      a.d = t < tp ? lerp(0.2, this.BD, t / tp) : Math.min(0.84, this.BD + (t - tp) * 0.75);
      this.hip = t <= tp ? peak - (peak - 1.0) * Math.pow((t - tp) / tp, 2) : peak - 4.9 * Math.pow(t - tp, 2);
      if (t >= tp && this.cleared == null) {
        const eff = this.Hb + (this.arch || 0);
        this.cleared = eff >= this.bar;
        this.eff = eff;
        if (!this.cleared) { this.barFall = 0.001; SFX.clank(); shake(4, 0.2); }
      }
      if (t > tp && this.hip <= 0.85) {
        this.hip = 0.85; this.state = 'mat'; SFX.thud(); shake(3, 0.15);
        if (this.cleared) { SFX.cheer(this.bar >= this.o.qual); this.msg('CLEARED!', '#3dff9a', 1.8, `${this.bar.toFixed(2)} m${this.arch ? ' \u00b7 ARCH +' + Math.round(this.arch * 100) + 'cm' : ' \u00b7 no arch'}`, 0.9); }
        else { SFX.foul(); this.msg('MISS', '#ff4d5e', 1.8, this.arch == null ? 'Press JUMP again mid-air to arch' : `Short by ${Math.round((this.bar - this.eff) * 100)} cm`, 0.9); }
        this.resolve(this.cleared);
      }
    }
    if (this.barFall > 0) this.barFall = Math.min(1, this.barFall + dt * 2.2);
    this.follow(a.x + (this.state === 'air' || this.state === 'mat' ? 1 : (R.portrait ? 2.5 : 3.5)), dt);
    if (R.shakeT > 0) R.shakeT -= dt;
    updParts(dt);
  }
  resolve(ok) {
    this.cur += ok ? 'O' : 'X';
    if (ok) {
      this.best = this.bar;
      this.log.push(`${this.bar.toFixed(2)} ${this.cur}`); this.cur = ''; this.tries = 0;
      this.bar = Math.round((this.bar + 0.05) * 100) / 100;
      this.later(2200, () => this.bar > 2.7 ? this.end() : this.newAttempt());
    } else {
      this.tries++;
      if (this.tries >= 3) { this.log.push(`${this.bar.toFixed(2)} ${this.cur}`); this.later(2200, () => this.end()); }
      else this.later(2200, () => this.newAttempt());
    }
  }
  end() { this.finish({ perf: this.best, foul: this.best == null, marks: this.log }); }
  drawBar(ctx) {
    const h = this.barFall > 0 ? lerp(this.bar, 0.6, ease(this.barFall)) : this.bar;
    const dd = this.barFall > 0 ? this.barFall * 0.15 : 0;
    const a = proj(this.BX0, h, this.BD + dd), b = proj(this.BX1, this.barFall > 0 ? lerp(this.bar, 0.3, ease(this.barFall)) : h, this.BD + dd);
    ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(3, a[2] * 0.06);
    for (let i = 0; i < 8; i++) { ctx.strokeStyle = i % 2 ? '#ff3d8b' : '#fff'; seg(ctx, lerp(a[0], b[0], i / 8), lerp(a[1], b[1], i / 8), lerp(a[0], b[0], (i + 1) / 8), lerp(a[1], b[1], (i + 1) / 8)); }
  }
  draw(ctx) {
    laneLines(ctx, [0.02, 0.98]);
    groundText(ctx, 'TAKE OFF', this.TO, 0.08, 0.4, 'rgba(255,255,255,.6)');
    groundQuad(ctx, this.TO - 0.06, this.TO + 0.06, 0.12, 0.28, '#ffd23f');
    // mat
    const m0 = 16.2, m1 = 21.8, d0 = 0.62, d1 = 1.0, mh = 0.6;
    const p = [proj(m0, mh, d0), proj(m1, mh, d0), proj(m1, mh, d1), proj(m0, mh, d1)];
    const f0 = proj(m0, 0, d0), f1 = proj(m1, 0, d0);
    ctx.fillStyle = '#123a8a'; ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[0][0], p[0][1]); ctx.fill();
    ctx.fillStyle = '#2a63d6'; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.fill();
    txt(ctx, 'NEO', (f0[0] + f1[0]) / 2, (f0[1] + p[0][1]) / 2, f0[2] * 0.4, 'rgba(255,255,255,.75)', 'center', 900, null);
    // standards
    const stand = (x) => { const b = proj(x, 0, this.BD), t = proj(x, 2.7, this.BD); ctx.strokeStyle = '#d7dcff'; ctx.lineWidth = Math.max(2, b[2] * 0.06); seg(ctx, b[0], b[1], t[0], t[1]); };
    const a = this.a;
    const pose = this.state === 'air' ? (this.arch != null ? POSES.flop() : POSES.flat()) : this.state === 'mat' ? POSES.flat() : this.state === 'ready' ? POSES.stand() : this.poseFor(a);
    const rot = this.state === 'air' ? -Math.PI / 2 * ease(clamp(this.jt / (this.tp * 0.9), 0, 1)) : this.state === 'mat' ? -Math.PI / 2 : 0;
    const y = this.state === 'air' || this.state === 'mat' ? this.hip - pose.hy : 0;
    const behind = a.d > this.BD;
    stand(this.BX0);
    if (behind) drawAthlete(ctx, a.x, y, a.d, pose, 'player', { rot });
    this.drawBar(ctx);
    stand(this.BX1);
    if (!behind) drawAthlete(ctx, a.x, y, a.d, pose, 'player', { rot });
    drawParts(ctx);
    speedLines(ctx, a.v);
    const sub = `${this.o.sub} \u00b7 BAR ${this.bar.toFixed(2)} \u00b7 TRY ${Math.min(3, this.tries + 1)}/3${this.best != null ? ' \u00b7 BEST ' + this.best.toFixed(2) : ''}`;
    this.hud(ctx, this.state === 'run' ? (this.TO - a.x).toFixed(0) + 'm' : '', { speed: this.state === 'run' ? a.v : (this.tv || 0), sub });
  }
}

const EVENT_DEFS = [
  { id: '100m', name: '100M DASH', unit: 's', lower: true, qual: 13.0, wr: 9.58, pts: [25.4347, 18, 1.81], make: o => new Race(o, false),
    how: 'Wait for the gun, then tap RUN left-right as fast as you can. Tapping before GO is a false start (two = disqualified).' },
  { id: 'lj', name: 'LONG JUMP', unit: 'm', qual: 6.0, wr: 8.95, pts: [0.14354, 220, 1.4, 100], make: o => new LongJump(o),
    how: 'Sprint down the runway. Press and HOLD JUMP just before the white board, release at about 45\u00b0. Stepping past the board is a foul. 3 attempts.' },
  { id: 'jav', name: 'JAVELIN', unit: 'm', qual: 55, wr: 98.48, pts: [10.14, 7, 1.08], make: o => new Javelin(o),
    how: 'Build speed, then HOLD THROW to raise the angle and release around 45\u00b0. You keep sliding after the throw \u2014 start a few meters before the foul line. 3 attempts.' },
  { id: '110h', name: '110M HURDLES', unit: 's', lower: true, qual: 16.5, wr: 12.8, pts: [5.74352, 28.5, 1.92], make: o => new Race(o, true),
    how: 'Run like the dash, and tap JUMP about a stride before each hurdle. Clipping one costs a lot of speed.' },
  { id: 'ham', name: 'HAMMER THROW', unit: 'm', qual: 45, wr: 86.74, pts: [13.0449, 7, 1.05], make: o => new Hammer(o),
    how: 'Tap RUN to spin faster. Watch the dial and tap RELEASE when the hammer sweeps through the green zone. Outside it hits the cage. 3 attempts.' },
  { id: 'hj', name: 'HIGH JUMP', unit: 'm', qual: 2.0, wr: 2.45, pts: [0.8465, 75, 1.42, 100], make: o => new HighJump(o),
    how: 'Run up and tap JUMP on the yellow take-off mark, then tap JUMP again near the top to arch over the bar. The bar rises 5 cm each clearance; 3 misses ends it.' },
];
function eventPoints(def, perf) {
  if (perf == null) return 0;
  const [A, B, C, mul] = def.pts;
  const v = def.lower ? B - perf : perf * (mul || 1) - B;
  return v > 0 ? Math.floor(A * Math.pow(v, C)) : 0;
}
