'use strict';
// World units are meters. d = depth across the track (0 = front, 1 = back).
const R = {
  W: 0, H: 0, dpr: 1, S: 60, groundY: 0, TH: 120, anchor: 0.38, camX: 0, shakeT: 0, shakeA: 0,
  portrait: false, ctrlH: 0, t: 0, crowdTile: null, flashes: [],
};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function layout(cv, showPads) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  R.W = W; R.H = H; R.dpr = dpr; R.portrait = H > W;
  const pad = clamp(Math.min(W, H) * (R.portrait ? 0.24 : 0.2), 70, 116);
  document.documentElement.style.setProperty('--pad', pad + 'px');
  R.ctrlH = showPads && R.portrait ? pad * 1.3 + 30 : 0;
  R.S = Math.min(W / (R.portrait ? 7 : 16), H * 0.13);
  R.groundY = H - (R.ctrlH ? R.ctrlH + H * 0.04 : H * (showPads ? 0.13 : 0.12));
  R.TH = clamp(R.S * (R.portrait ? 3.4 : 2.1), 60, H * 0.26);
  R.anchor = R.portrait ? 0.3 : 0.36;
  buildCrowdTile();
}

function proj(x, y, d) {
  const s = R.S * (1 - 0.3 * d);
  const sh = R.shakeT > 0 ? (Math.random() - 0.5) * R.shakeA : 0;
  return [R.W * R.anchor + (x - R.camX) * s, R.groundY - d * R.TH - y * s + sh, s];
}
function shake(a, t) { R.shakeA = a; R.shakeT = t; }

function horizonY() { return R.groundY - R.TH * 1.0 - R.S * 0.25; }

function buildCrowdTile() {
  const h = Math.max(40, Math.round(Math.min(horizonY() - R.H * 0.08, R.H * (R.portrait ? 0.28 : 0.3))));
  const w = 900;
  const c = document.createElement('canvas');
  c.width = w * R.dpr; c.height = h * R.dpr;
  const g = c.getContext('2d'); g.scale(R.dpr, R.dpr);
  const r = rng(7);
  // tiers
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0d1238'); grad.addColorStop(1, '#1a1f52');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const rows = Math.max(6, Math.floor(h / 9));
  const cols = ['#ff3d8b', '#22e3ff', '#ffd23f', '#ffffff', '#7a5cff', '#ff8a3d', '#3dff9a', '#c9d3ff'];
  for (let row = 0; row < rows; row++) {
    const y = h - 6 - row * (h - 10) / rows;
    const sz = 2.4 + (rows - row) / rows * 2.2;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + sz * 0.7, w, 1.5);
    for (let x = 2; x < w; x += sz * 1.55 + r() * 1.5) {
      if (r() < 0.12) continue;
      const shade = 0.35 + 0.65 * (1 - row / rows) * 0.6 + r() * 0.2;
      g.globalAlpha = clamp(shade, 0.25, 0.95);
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.beginPath(); g.arc(x, y - sz * 0.9, sz * 0.45, 0, TAU); g.fill();
      g.fillRect(x - sz * 0.5, y - sz * 0.5, sz, sz * 0.9);
    }
  }
  g.globalAlpha = 1;
  // aisles
  for (let x = 140; x < w; x += 300) { g.fillStyle = 'rgba(5,8,25,.75)'; g.fillRect(x, 0, 10, h); }
  R.crowdTile = { c, w, h };
}

function drawBackground(ctx, surface) {
  const { W, H } = R;
  const hz = horizonY();
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#05061a'); sky.addColorStop(0.6, '#141a4a'); sky.addColorStop(1, '#2a1f5c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  // stars
  const r = rng(3);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    const x = ((r() * W * 1.5 - R.camX * R.S * 0.02) % (W * 1.5) + W * 1.5) % (W * 1.5);
    const y = r() * hz * 0.5;
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(R.t * (0.5 + r()) + i));
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  // floodlight towers
  const tw = Math.max(W * 0.7, 500), off = -(R.camX * R.S * 0.12) % tw;
  const crowd = R.crowdTile, standTop = hz - crowd.h;
  for (let x = off - tw; x < W + tw; x += tw) {
    const bx = x + tw * 0.5, top = Math.max(18, standTop - H * 0.12);
    const glow = ctx.createRadialGradient(bx, top, 2, bx, top, H * 0.35);
    glow.addColorStop(0, 'rgba(220,235,255,.55)'); glow.addColorStop(0.15, 'rgba(160,190,255,.18)'); glow.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(bx - H * 0.35, top - H * 0.35, H * 0.7, H * 0.7);
    ctx.fillStyle = '#0a0d26'; ctx.fillRect(bx - 3, top, 6, standTop - top + 4);
    ctx.fillStyle = '#e8f0ff';
    for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(bx + i * 9 - 3, top - 8 + j * 7, 6, 5);
  }
  // crowd
  const cx = -((R.camX * R.S * 0.32) % crowd.w);
  for (let x = cx - crowd.w; x < W; x += crowd.w) ctx.drawImage(crowd.c, x, standTop, crowd.w, crowd.h);
  // roof line glow
  ctx.fillStyle = 'rgba(34,227,255,.35)'; ctx.fillRect(0, standTop - 2, W, 2);
  // camera flashes
  if (Math.random() < 0.18) R.flashes.push({ x: Math.random() * W, y: standTop + Math.random() * crowd.h, l: 1 });
  for (const f of R.flashes) {
    ctx.globalAlpha = f.l; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(f.x, f.y, 2 + f.l * 3, 0, TAU); ctx.fill();
    f.l -= 0.12;
  }
  ctx.globalAlpha = 1; R.flashes = R.flashes.filter(f => f.l > 0);
  // ad boards
  const ah = Math.max(10, R.S * 0.42), ay = hz - ah * 0.2;
  ctx.fillStyle = '#060818'; ctx.fillRect(0, ay - ah, W, ah + R.S * 0.25 + 4);
  const bw = R.S * 0.7 * 7, boff = -((R.camX * R.S * 0.7) % bw);
  const ads = ['TRACK & FIELD', 'NEO ARCADE', 'GO FOR GOLD', 'HYPER SPORTS'];
  ctx.font = `900 italic ${Math.round(ah * 0.62)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let k = Math.floor((R.camX * R.S * 0.7) / bw);
  for (let x = boff - bw; x < W + bw; x += bw, k++) {
    const idx = ((k % 4) + 4) % 4;
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    const c1 = ['#1aa3ff', '#ff3d8b', '#ffd23f', '#7a5cff'][idx];
    g.addColorStop(0, c1); g.addColorStop(1, '#0b0f2a');
    ctx.fillStyle = g; ctx.fillRect(x + 2, ay - ah + 2, bw - 4, ah - 4);
    ctx.fillStyle = '#fff'; ctx.fillText(ads[idx], x + bw / 2, ay - ah / 2);
  }
  // infield / track band
  const top = R.groundY - R.TH;
  ctx.fillStyle = '#123d2a'; ctx.fillRect(0, ay, W, top - ay + 1);
  const trk = ctx.createLinearGradient(0, top, 0, H);
  const blue = surface === 'blue';
  trk.addColorStop(0, blue ? '#1d4fa0' : '#b2442c'); trk.addColorStop(1, blue ? '#163a7a' : '#8f3320');
  ctx.fillStyle = trk; ctx.fillRect(0, top, W, H - top);
  // stripes for texture
  ctx.globalAlpha = 0.07; ctx.fillStyle = '#000';
  for (let i = 0; i < 8; i++) { const y = top + (H - top) * i / 8; ctx.fillRect(0, y, W, 1); }
  ctx.globalAlpha = 1;
}

function laneLines(ctx, ds) {
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  for (const d of ds) {
    const y = R.groundY - d * R.TH;
    ctx.lineWidth = Math.max(1, R.S * 0.05 * (1 - 0.3 * d));
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(R.W, y); ctx.stroke();
  }
}
function groundLine(ctx, x, d0, d1, color, w = 0.08) {
  const a = proj(x, 0, d0), b = proj(x, 0, d1);
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * a[2]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function groundQuad(ctx, x0, x1, d0, d1, fill) {
  const p = [proj(x0, 0, d0), proj(x1, 0, d0), proj(x1, 0, d1), proj(x0, 0, d1)];
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath(); ctx.fill();
}
function groundText(ctx, str, x, d, size, color) {
  const p = proj(x, 0, d);
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, 0.45);
  ctx.font = `900 ${Math.round(size * p[2])}px system-ui,sans-serif`; ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0); ctx.restore();
}
function visibleRange(d = 0) { const s = R.S * (1 - 0.3 * d); return [R.camX - (R.W * R.anchor) / s - 2, R.camX + (R.W * (1 - R.anchor)) / s + 2]; }

// ---------- athlete ----------
const KITS = {
  player: { kit: '#22e3ff', kit2: '#0b5f9e', shorts: '#0b1f4a', skin: '#c68a5b', hair: '#1a1210', shoe: '#ffd23f' },
  cpu: { kit: '#ff3d8b', kit2: '#8a0f42', shorts: '#2a0b1f', skin: '#8d5a3b', hair: '#0d0d0d', shoe: '#ffffff' },
  cpu2: { kit: '#ffd23f', kit2: '#9a6c00', shorts: '#2a210b', skin: '#e0b48c', hair: '#5a3a1a', shoe: '#22e3ff' },
};
const POSES = {
  stand: () => ({ hy: 0.98, lean: 0.02, legs: [[0.05, 0.03], [-0.05, -0.06]], arms: [[0.12, 0.3], [-0.1, 0.1]] }),
  marks: () => ({ hy: 0.52, lean: 1.3, legs: [[1.2, -0.3], [0.15, -1.45]], arms: [[0.02, 0], [0.06, 0]] }),
  set: () => ({ hy: 0.78, lean: 1.2, legs: [[0.75, -0.5], [-0.25, -1.3]], arms: [[0.02, 0], [0.06, 0]] }),
  crouch: () => ({ hy: 0.74, lean: 0.45, legs: [[0.95, -0.45], [-0.35, -0.8]], arms: [[-1.0, -0.6], [-0.8, -0.4]] }),
  ljAir: t => ({ hy: 0.95, lean: lerp(-0.15, 0.55, t), legs: [[lerp(0.6, 1.55, t), lerp(-0.2, 1.4, t)], [lerp(-0.5, 1.45, t), lerp(-1.2, 1.3, t)]], arms: [[lerp(2.8, 1.4, t), lerp(2.9, 1.5, t)], [lerp(2.6, 1.3, t), lerp(2.7, 1.4, t)]] }),
  sit: () => ({ hy: 0.3, lean: 0.35, legs: [[1.5, 1.45], [1.45, 1.35]], arms: [[1.0, 1.2], [0.9, 1.1]] }),
  hurdle: () => ({ hy: 1.0, lean: 0.55, legs: [[1.55, 1.5], [-0.3, -1.9]], arms: [[1.5, 1.7], [-0.6, 0.2]] }),
  stumble: () => ({ hy: 0.82, lean: 0.95, legs: [[0.6, -0.2], [-0.7, -1.2]], arms: [[1.6, 1.8], [1.3, 1.6]] }),
  celebrate: t => ({ hy: 0.98 + Math.abs(Math.sin(t * 7)) * 0.08, lean: 0, legs: [[0.08, 0.04], [-0.08, -0.05]], arms: [[2.7 + Math.sin(t * 7) * 0.2, 3.0], [-2.7 - Math.sin(t * 7) * 0.2, -3.0]] }),
  slump: () => ({ hy: 0.94, lean: 0.35, legs: [[0.1, 0.05], [-0.06, -0.06]], arms: [[0.15, 0.2], [0.05, 0.1]] }),
  javHold: () => ({ hy: 0.94, lean: -0.32, legs: [[0.6, 0.45], [-0.45, -0.6]], arms: [[-1.75, -1.6], [1.4, 1.2]] }),
  javThrow: t => ({ hy: 0.95, lean: lerp(-0.3, 0.55, t), legs: [[0.5, 0.4], [-0.5, -0.9]], arms: [[lerp(-1.6, 2.2, t), lerp(-1.5, 1.9, t)], [lerp(1.3, -0.6, t), lerp(1.1, -0.3, t)]] }),
  flop: () => ({ hy: 0.95, lean: 0, legs: [[-0.5, -1.6], [-0.4, -1.5]], arms: [[-0.3, -0.2], [0.2, 0.4]] }),
  flat: () => ({ hy: 0.95, lean: 0, legs: [[0.3, 0.6], [0.2, 0.5]], arms: [[-0.2, 0], [0.1, 0.2]] }),
};
function runPose(ph, amp, carry) {
  const legs = [], arms = [];
  for (let i = 0; i < 2; i++) {
    const p = ph + i * Math.PI;
    const thigh = 0.12 + 0.82 * Math.sin(p) * amp;
    const flex = 0.18 + 1.55 * Math.max(0, Math.cos(p - 0.35)) * amp;
    legs.push([thigh, thigh - flex]);
    const u = -0.85 * Math.sin(p) * amp + 0.1;
    arms.push([u, u + 1.25 + 0.2 * amp]);
  }
  const pose = { hy: 0.93 + 0.05 * Math.cos(2 * ph) * amp, lean: 0.08 + 0.2 * amp, legs, arms };
  if (carry) pose.arms[0] = [-1.75, -1.55];
  return pose;
}
function limb(ctx, x, y, a, L) { return [x + Math.sin(a) * L, y - Math.cos(a) * L]; }

// Draws an athlete; returns key joints (world meters) for attaching props.
function drawAthlete(ctx, x, y, d, pose, kitName, opts = {}) {
  const k = KITS[kitName] || KITS.player;
  const [sx, sy, s] = proj(x, 0, d);
  const face = opts.face || 1;
  // shadow
  const sh = 1 / (1 + Math.max(0, y) * 0.8);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * sh})`;
  ctx.beginPath(); ctx.ellipse(sx, sy, s * 0.45 * sh, s * 0.1 * sh, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy - y * s);
  ctx.scale(s * face, -s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const hx = 0, hy = pose.hy;
  if (opts.rot) { ctx.translate(hx, hy); ctx.rotate(opts.rot); ctx.translate(-hx, -hy); }
  const T = 0.62;
  const sxh = hx + Math.sin(pose.lean) * T, syh = hy + Math.cos(pose.lean) * T;
  const joints = {};
  const drawLeg = (i, dark) => {
    const [ta, sa] = pose.legs[i];
    const kn = limb(ctx, hx, hy, ta, 0.46), an = limb(ctx, kn[0], kn[1], sa, 0.46);
    ctx.strokeStyle = dark ? shadeC(k.skin, -0.25) : k.skin;
    ctx.lineWidth = 0.13; seg(ctx, hx, hy, kn[0], kn[1]);
    ctx.lineWidth = 0.105; seg(ctx, kn[0], kn[1], an[0], an[1]);
    ctx.strokeStyle = dark ? shadeC(k.shorts, -0.2) : k.shorts; ctx.lineWidth = 0.17;
    const mid = [lerp(hx, kn[0], 0.45), lerp(hy, kn[1], 0.45)]; seg(ctx, hx, hy, mid[0], mid[1]);
    const fa = sa + Math.PI / 2;
    const toe = [an[0] + Math.sin(fa) * 0.17, an[1] - Math.cos(fa) * 0.17];
    ctx.strokeStyle = dark ? shadeC(k.shoe, -0.3) : k.shoe; ctx.lineWidth = 0.09; seg(ctx, an[0], an[1], toe[0], toe[1]);
  };
  const drawArm = (i, dark) => {
    const [ua, fa] = pose.arms[i];
    const el = limb(ctx, sxh, syh - 0.04, ua, 0.31), hd = limb(ctx, el[0], el[1], fa, 0.29);
    ctx.strokeStyle = dark ? shadeC(k.skin, -0.25) : k.skin;
    ctx.lineWidth = 0.09; seg(ctx, sxh, syh - 0.04, el[0], el[1]);
    ctx.lineWidth = 0.08; seg(ctx, el[0], el[1], hd[0], hd[1]);
    joints['hand' + i] = hd; joints['elbow' + i] = el;
  };
  drawLeg(1, true); drawArm(1, true);
  // torso
  ctx.strokeStyle = k.kit; ctx.lineWidth = 0.27; seg(ctx, hx, hy + 0.06, sxh, syh - 0.06);
  ctx.strokeStyle = k.kit2; ctx.lineWidth = 0.07;
  seg(ctx, lerp(hx, sxh, 0.25) + 0.08 * Math.cos(pose.lean), lerp(hy, syh, 0.25) - 0.08 * Math.sin(pose.lean), lerp(hx, sxh, 0.85) + 0.08 * Math.cos(pose.lean), lerp(hy, syh, 0.85) - 0.08 * Math.sin(pose.lean));
  // head
  const hl = pose.lean + (pose.head || 0);
  const nx = sxh + Math.sin(hl) * 0.2, ny = syh + Math.cos(hl) * 0.2;
  ctx.fillStyle = k.skin; ctx.beginPath(); ctx.arc(nx, ny, 0.125, 0, TAU); ctx.fill();
  ctx.fillStyle = k.hair; ctx.beginPath(); ctx.arc(nx - 0.02, ny + 0.02, 0.125, Math.PI * 0.35 + hl * 0, Math.PI * 1.25); ctx.fill();
  ctx.fillStyle = k.kit; ctx.fillRect(nx - 0.13, ny + 0.03, 0.2, 0.035);
  drawLeg(0, false); drawArm(0, false);
  ctx.restore();
  // map joints back to world space
  const out = {};
  const rot = opts.rot || 0, c = Math.cos(rot), sn = Math.sin(rot);
  for (const key in joints) {
    let [jx, jy] = joints[key];
    jx -= hx; jy -= hy;
    const rx = jx * c - jy * sn, ry = jx * sn + jy * c;
    out[key] = [x + (rx + hx) * face, y + ry + hy];
  }
  return out;
}
function seg(ctx, a, b, c, d) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
function shadeC(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ---------- particles ----------
const PARTS = [];
function burst(x, y, d, n, col, spd = 3, up = 2, size = 0.06, life = 0.8) {
  for (let i = 0; i < n; i++) PARTS.push({ x, y, d, vx: (Math.random() - 0.5) * spd * 2, vy: Math.random() * up + 0.5, life, max: life, col, size: size * (0.5 + Math.random()) });
}
function updParts(dt) {
  for (const p of PARTS) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 9.8 * dt; if (p.y < 0) { p.y = 0; p.vx *= 0.5; p.vy *= -0.2; } p.life -= dt; }
  for (let i = PARTS.length - 1; i >= 0; i--) if (PARTS[i].life <= 0) PARTS.splice(i, 1);
}
function drawParts(ctx) {
  for (const p of PARTS) {
    const [sx, sy, s] = proj(p.x, p.y, p.d);
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, p.size * s), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function speedLines(ctx, v) {
  if (v < 7) return;
  const a = clamp((v - 7) / 6, 0, 1) * 0.35;
  ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.5;
  const r = rng(Math.floor(R.t * 30));
  for (let i = 0; i < 14; i++) {
    const y = r() * R.groundY * 0.95, x = r() * R.W, l = 40 + r() * 120 * a * 3;
    seg(ctx, x, y, x + l, y);
  }
}

// ---------- HUD text ----------
function txt(ctx, s, x, y, size, color = '#fff', align = 'center', weight = 900, glow = null, italic = true) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px system-ui,-apple-system,sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.5; }
  ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = 'rgba(0,0,20,.7)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function meter(ctx, x, y, w, h, frac, label) {
  ctx.fillStyle = 'rgba(5,8,30,.7)'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,160,255,.4)'; ctx.lineWidth = 1; ctx.stroke();
  const n = 20, gap = 2, cw = (w - 8 - gap * (n - 1)) / n, lit = Math.round(clamp(frac, 0, 1) * n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    ctx.fillStyle = i < lit ? `hsl(${190 - t * 190},100%,${55 + t * 5}%)` : 'rgba(255,255,255,.07)';
    ctx.fillRect(x + 4 + i * (cw + gap), y + 4, cw, h - 8);
  }
  if (label) txt(ctx, label, x, y - h * 0.55, h * 0.75, '#9aa6d6', 'left', 800, null, false);
}
function angleGauge(ctx, cx, cy, r, deg, best = 45) {
  ctx.fillStyle = 'rgba(5,8,30,.65)';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
  // sweet zone
  ctx.fillStyle = 'rgba(61,255,154,.28)';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -(best + 6) * Math.PI / 180, -(best - 6) * Math.PI / 180); ctx.closePath(); ctx.fill();
  const a = -deg * Math.PI / 180;
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  seg(ctx, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  txt(ctx, Math.round(deg) + '\u00b0', cx + r * 0.55, cy - r * 0.25, r * 0.3, '#fff');
}
