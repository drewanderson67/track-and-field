'use strict';
const VERSION = '1.1.0';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cv = $('#cv'), ctx = cv.getContext('2d');
const STORE = 'tf-neo-v1';
const DIFF = { rookie: 1.15, pro: 1.0, legend: 0.88 };
let DB = load();
function load() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { d = {}; }
  d.settings = Object.assign({ diff: 'pro', sound: 'on', touch: 'auto', haptics: 'on' }, d.settings);
  d.hof = d.hof || []; d.pb = d.pb || {};
  return d;
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(DB)); } catch (e) { /* storage full or blocked */ } }

const G = { scene: 'title', mode: null, round: 1, idx: 0, total: 0, ev: null, def: null, paused: false, pendingHS: false, last: null };
const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const showPads = () => DB.settings.touch === 'on' || (DB.settings.touch === 'auto' && coarse);

function qualFor(def, round) {
  const q = def.lower ? def.qual * (1 - 0.03 * (round - 1)) : def.qual * (1 + 0.04 * (round - 1));
  return Math.round(q * 100) / 100;
}
const fmt = (def, v) => v == null ? '\u2014' : def.lower ? v.toFixed(2) + 's' : v.toFixed(2) + ' m';
const better = (def, a, b) => b == null || (a != null && (def.lower ? a < b : a > b));

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== 'scr-' + id));
  const playing = id === null;
  $('#controls').classList.toggle('hidden', !playing || !showPads());
  $('#keyhint').classList.toggle('hidden', !playing || showPads());
  $('#hud-top').classList.toggle('hidden', !playing);
  if (id === 'title') renderTitle();
  if (id === 'practice') renderPractice();
  if (id === 'hof') renderHof();
  if (id === 'howto') renderHowto();
  if (id === 'settings') renderSettings();
}
function renderTitle() {
  const hi = DB.hof[0] ? DB.hof[0].s : 0;
  $('#hi-line').textContent = `HI ${hi.toLocaleString()}`;
  $('#ver').textContent = 'v' + VERSION;
  G.ev = null; G.scene = 'title';
}
function renderPractice() {
  $('#practice-list').innerHTML = EVENT_DEFS.map((d, i) =>
    `<button class="btn" data-ev="${i}">${d.name}<small>Best ${fmt(d, DB.pb[d.id])}</small></button>`).join('');
}
function renderHof() {
  $('#hof-table').innerHTML = DB.hof.length ? `<table><tr><th>#</th><th>Name</th><th>Round</th><th class="n">Score</th></tr>${DB.hof.map((h, i) => `<tr><td>${i + 1}</td><td>${esc(h.n)}</td><td>${h.r}</td><td class="n">${h.s.toLocaleString()}</td></tr>`).join('')}</table>` : '<p class="muted">No scores yet. Play Arcade mode!</p>';
  $('#pb-table').innerHTML = `<table><tr><th>Event</th><th class="n">Best</th><th class="n">WR</th></tr>${EVENT_DEFS.map(d => `<tr><td>${d.name}</td><td class="n">${fmt(d, DB.pb[d.id])}</td><td class="n">${fmt(d, d.wr)}</td></tr>`).join('')}</table>`;
}
function renderHowto() {
  $('#howto-list').innerHTML = EVENT_DEFS.map(d => `<div class="howto-item"><b>${d.name}</b> \u2014 qualify ${fmt(d, d.qual)}<br>${d.how}</div>`).join('');
}
function renderSettings() {
  $$('.seg').forEach(seg => { const k = seg.dataset.set; seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', DB.settings[k] === b.dataset.v)); });
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  $('#install-tip').textContent = ios ? 'Install: open in Safari \u2192 Share \u2192 Add to Home Screen. Plays offline once installed.' : 'Install: use your browser menu \u2192 Install app / Add to Home screen. Plays offline once installed.';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) { SFX.init(); SFX.click(); const g = go.dataset.go; if (g === 'arcade') return startArcade(); return show(g); }
  const ev = e.target.closest('[data-ev]');
  if (ev) { SFX.click(); G.mode = 'practice'; G.idx = +ev.dataset.ev; G.round = 1; G.total = 0; return intro(); }
  const sb = e.target.closest('.seg button');
  if (sb) {
    const k = sb.parentElement.dataset.set; DB.settings[k] = sb.dataset.v; save();
    if (k === 'sound') SFX.setEnabled(sb.dataset.v === 'on');
    SFX.click(); renderSettings(); layout(cv, showPads());
  }
});
$('#btn-reset').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Tap again'; setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Reset'; }, 2500); return; }
  DB.hof = []; DB.pb = {}; save(); b.classList.remove('armed'); b.textContent = 'Done';
});

function startArcade() { G.mode = 'arcade'; G.round = 1; G.idx = 0; G.total = 0; intro(); }
function intro() {
  const d = EVENT_DEFS[G.idx]; G.def = d; G.scene = 'intro'; G.ev = null;
  $('#intro-kicker').textContent = G.mode === 'arcade' ? `ROUND ${G.round} \u00b7 EVENT ${G.idx + 1} / 6` : 'PRACTICE';
  $('#intro-name').textContent = d.name;
  $('#intro-how').textContent = d.how;
  $('#intro-qual').textContent = fmt(d, qualFor(d, G.round));
  $('#intro-wr').textContent = fmt(d, d.wr);
  $('#intro-pb').textContent = fmt(d, DB.pb[d.id]);
  show('intro');
}
function begin() {
  SFX.init();
  const d = G.def, q = qualFor(d, G.round);
  G.scene = 'play'; G.paused = false; PARTS.length = 0;
  show(null);
  layout(cv, showPads());
  const o = {
    name: d.name, sub: G.mode === 'arcade' ? `ROUND ${G.round} \u00b7 ${G.idx + 1}/6` : 'PRACTICE',
    qual: q, qualStr: fmt(d, q), lowerBetter: !!d.lower, mult: DIFF[DB.settings.diff] || 1, score: G.total,
    onDone: res => onDone(res),
  };
  G.ev = d.make(o);
  $('#act-label').textContent = G.ev.actLabel;
  if (coarse && R.portrait) { $('#rotate-tip').classList.remove('hidden'); setTimeout(() => $('#rotate-tip').classList.add('hidden'), 3500); }
}
$('#btn-start').addEventListener('click', begin);
$('#btn-intro-quit').addEventListener('click', () => show('title'));

function onDone(res) {
  const d = G.def, q = qualFor(d, G.round);
  const perf = res.perf;
  const qualified = perf != null && (d.lower ? perf <= q : perf >= q);
  const pts = eventPoints(d, perf);
  const pb = perf != null && better(d, perf, DB.pb[d.id]);
  const wr = perf != null && better(d, perf, d.wr);
  if (pb) { DB.pb[d.id] = perf; save(); }
  let bonus = 0;
  if (G.mode === 'arcade') { G.total += pts; if (qualified && G.idx === 5) { bonus = 1000 * G.round; G.total += bonus; } }
  G.scene = 'result'; G.last = { qualified };
  $('#res-kicker').textContent = G.mode === 'arcade' ? `ROUND ${G.round} \u00b7 EVENT ${G.idx + 1} / 6` : 'PRACTICE';
  $('#res-name').textContent = d.name;
  $('#res-perf').textContent = perf == null ? (res.marks[0] === 'DQ' ? 'DQ' : 'NO MARK') : fmt(d, perf);
  const v = $('#res-verdict');
  v.className = 'verdict ' + (wr ? 'gold' : qualified ? 'ok' : 'bad');
  v.textContent = wr ? 'WORLD RECORD!' : qualified ? (pb ? 'QUALIFIED \u00b7 NEW PB' : 'QUALIFIED') : (pb ? 'NOT QUALIFIED \u00b7 NEW PB' : 'NOT QUALIFIED');
  $('#res-pts').textContent = pts.toLocaleString();
  $('#res-total').textContent = G.mode === 'arcade' ? G.total.toLocaleString() : '\u2014';
  $('#res-qual').textContent = fmt(d, q);
  $('#res-attempts').innerHTML = (res.marks || []).map(m => `<span class="${perf != null && (m === perf.toFixed(2) || m.startsWith(perf.toFixed(2))) ? 'best' : ''}">${esc(m)}</span>`).join('') + (bonus ? `<span class="best">ROUND BONUS +${bonus.toLocaleString()}</span>` : '');
  const btns = [];
  $('#res-entry').classList.add('hidden'); G.pendingHS = false;
  if (G.mode === 'arcade') {
    if (qualified) {
      SFX.fanfare();
      btns.push(`<button class="btn primary big" data-act="next">${G.idx === 5 ? 'Round ' + (G.round + 1) : 'Next event'}</button>`);
      btns.push(`<button class="btn ghost small" data-act="menu">Quit</button>`);
    } else {
      SFX.sad(); haptic([80, 60, 160]);
      v.textContent += ' \u00b7 GAME OVER';
      const rank = DB.hof.filter(h => h.s >= G.total).length;
      if (G.total > 0 && rank < 10) { G.pendingHS = true; $('#res-entry').classList.remove('hidden'); $('#initials').value = DB.lastName || ''; }
      btns.push(`<button class="btn primary" data-act="again">Play again</button>`);
      btns.push(`<button class="btn" data-act="retry">Practice this</button>`);
      btns.push(`<button class="btn ghost" data-act="menu">Menu</button>`);
    }
  } else {
    if (qualified) SFX.fanfare();
    btns.push(`<button class="btn primary" data-act="retry">Retry</button>`);
    btns.push(`<button class="btn" data-act="events">Events</button>`);
    btns.push(`<button class="btn ghost" data-act="menu">Menu</button>`);
  }
  $('#res-buttons').innerHTML = btns.join('');
  show('result');
}
function saveHS() {
  if (!G.pendingHS) return;
  const n = ($('#initials').value || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AAA';
  DB.lastName = n;
  DB.hof.push({ n, s: G.total, r: G.round, t: Date.now() });
  DB.hof.sort((a, b) => b.s - a.s); DB.hof = DB.hof.slice(0, 10); save();
  G.pendingHS = false; $('#res-entry').classList.add('hidden');
}
$('#btn-save-hs').addEventListener('click', saveHS);
$('#initials').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') saveHS(); });
$('#res-buttons').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  SFX.click(); saveHS();
  const a = b.dataset.act;
  if (a === 'next') { if (G.idx === 5) { G.idx = 0; G.round++; } else G.idx++; intro(); }
  else if (a === 'again') startArcade();
  else if (a === 'retry') { G.mode = 'practice'; G.round = 1; intro(); }
  else if (a === 'events') show('practice');
  else show('title');
});

// ---------- pause ----------
function pause() { if (G.scene !== 'play' || G.paused) return; G.paused = true; show('pause'); }
function resume() { G.paused = false; show(null); G.ev && ($('#act-label').textContent = G.ev.actLabel); }
$('#btn-pause').addEventListener('click', pause);
$('#btn-resume').addEventListener('click', resume);
$('#btn-restart').addEventListener('click', () => { G.paused = false; begin(); });
$('#btn-quit').addEventListener('click', () => { G.paused = false; show('title'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- input ----------
function canPlay() { return G.scene === 'play' && !G.paused && G.ev && !G.ev.done; }
function inRun(side) { SFX.init(); if (canPlay()) G.ev.run(side); }
function inActDown() { SFX.init(); if (canPlay()) { G.ev.held = true; G.ev.actDown && G.ev.actDown(); } }
function inActUp() { if (canPlay() && G.ev.held) { G.ev.held = false; G.ev.actUp && G.ev.actUp(); } }
const RUN_L = ['ArrowLeft', 'KeyA', 'KeyZ'], RUN_R = ['ArrowRight', 'KeyD', 'KeyX'], ACT = ['Space', 'ArrowUp', 'KeyW', 'KeyK'];
window.addEventListener('keydown', e => {
  if (G.scene === 'play' && [...RUN_L, ...RUN_R, ...ACT, 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { G.paused ? resume() : pause(); return; }
  if (G.scene === 'intro' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); return begin(); }
  if (G.scene === 'result' && e.code === 'Enter' && document.activeElement !== $('#initials')) { const b = $('#res-buttons .btn'); b && b.click(); return; }
  if (RUN_L.includes(e.code)) inRun(0);
  else if (RUN_R.includes(e.code)) inRun(1);
  else if (ACT.includes(e.code)) inActDown();
});
window.addEventListener('keyup', e => { if (ACT.includes(e.code)) inActUp(); });
$$('.pad.run').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); inRun(+b.dataset.side); });
  const up = () => b.classList.remove('down');
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, up));
});
const act = $('#btn-act');
act.addEventListener('pointerdown', e => { e.preventDefault(); try { act.setPointerCapture(e.pointerId); } catch (_) { } act.classList.add('down'); inActDown(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => act.addEventListener(t, () => { act.classList.remove('down'); inActUp(); }));
['contextmenu', 'dblclick'].forEach(t => document.addEventListener(t, e => { if (e.target.closest('.pad,canvas')) e.preventDefault(); }));
// tap on canvas acts as "start" on intro-less screens; prevent iOS gestures
document.addEventListener('gesturestart', e => e.preventDefault());

const padPrev = {};
function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const prev = padPrev[gp.index] || [];
    const b = gp.buttons.map(x => x.pressed);
    const edge = i => b[i] && !prev[i];
    if (edge(4) || edge(2) || edge(14)) inRun(0);
    if (edge(5) || edge(1) || edge(15)) inRun(1);
    if (edge(0) || edge(12)) { if (G.scene === 'intro') begin(); else inActDown(); }
    if ((prev[0] && !b[0]) || (prev[12] && !b[12])) inActUp();
    if (edge(9)) G.paused ? resume() : pause();
    padPrev[gp.index] = b;
  }
}
function haptic(p) { if (DB.settings.haptics === 'on' && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { } }
const _foul = SFX.foul, _thud = SFX.thud;
SFX.foul = () => { _foul(); haptic(120); };
SFX.thud = () => { _thud(); haptic(30); };

// ---------- attract mode ----------
const attract = { x: 0, ph: 0, c1: -1.5, c2: 1.2 };
function drawAttract(dt) {
  attract.x += 9.5 * dt; attract.ph += TAU * 9.5 / 4.4 * dt;
  R.camX = attract.x + 2;
  drawBackground(ctx, 'blue');
  laneLines(ctx, [0, 0.33, 0.67, 1]);
  const [v0, v1] = visibleRange(0);
  for (let m = Math.ceil(v0 / 10) * 10; m < v1 + 10; m += 10) groundLine(ctx, m, 0.98, 1, '#fff', 0.06);
  drawAthlete(ctx, attract.x + attract.c2 + Math.sin(R.t * 0.7) * 0.6, 0, 0.84, runPose(attract.ph + 1.3, 1), 'cpu2');
  drawAthlete(ctx, attract.x + attract.c1 + Math.sin(R.t * 0.5) * 0.8, 0, 0.5, runPose(attract.ph + 2.1, 1), 'cpu');
  drawAthlete(ctx, attract.x, 0, 0.16, runPose(attract.ph, 1), 'player');
  speedLines(ctx, 10);
}

// ---------- loop ----------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  R.t += dt;
  pollPads();
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  if (G.ev && (G.scene === 'play' || G.scene === 'result')) {
    if (G.scene === 'play' && !G.paused) G.ev.update(dt);
    drawBackground(ctx, G.ev.surface);
    G.ev.draw(ctx);
  } else drawAttract(dt);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => layout(cv, showPads()));
layout(cv, showPads());
SFX.setEnabled(DB.settings.sound === 'on');
show('title');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && document.querySelector('link[rel=manifest]')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
// test hook
window.TF = { G, R, DB, begin, intro, startArcade, EVENT_DEFS };
