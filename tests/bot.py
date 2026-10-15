"""Plays every event with a scripted bot and screenshots key moments. Usage: python tests/bot.py [url] [w] [h]"""
import sys, time, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
H = int(sys.argv[3]) if len(sys.argv) > 3 else 720
TAG = f'{W}x{H}'
BOT = r"""
window.__bot = (rate) => {
  const G = TF.G; let side = 0; let holdUntil = 0; let archDone = false;
  clearInterval(window.__bi);
  window.__bi = setInterval(() => {
    const ev = G.ev; if (!ev || ev.done || G.scene !== 'play') return;
    const id = G.def.id, now = performance.now();
    const st = ev.state;
    const mash = () => { ev.run(side); side ^= 1; };
    if (id === '100m' || id === '110h') {
      if (st === 'go') { mash();
        if (id === '110h' && ev.p.air <= 0) { const n = ev.hx.find(h => h > ev.p.x); if (n && n - ev.p.x < 2.4 && n - ev.p.x > 1.5) ev.actDown(); } }
    } else if (id === 'lj' || id === 'jav') {
      const trig = id === 'lj' ? 39.3 : 27.5;
      if (st === 'ready' || st === 'run') { mash(); if (ev.a.x > trig && st === 'run') { ev.actDown(); holdUntil = now + (id === 'lj' ? 340 : 440); } }
      if (st === 'hold' && now > holdUntil) ev.actUp();
    } else if (id === 'ham') {
      if (st === 'ready' || st === 'spin') { mash(); if (ev.spinT > 3 && Math.abs(ev.errDeg()) < 12) ev.actDown(); }
    } else if (id === 'hj') {
      if (st === 'ready' || st === 'run') { archDone = false; mash(); if (ev.a.x >= 17.4 && st === 'run') ev.actDown(); }
      if (st === 'air' && !archDone && ev.jt >= 0.43) { archDone = true; ev.actDown(); }
    }
  }, 1000 / rate);
};
"""
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp('http://localhost:29229')
    ctx = b.new_context(viewport={'width': W, 'height': H}, has_touch=W < H, is_mobile=W < H)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(URL); time.sleep(1)
    pg.screenshot(path=f'/tmp/shots/{TAG}-title.png')
    pg.evaluate(BOT)
    results = {}
    for i, d in enumerate(['100m', 'lj', 'jav', '110h', 'ham', 'hj']):
        pg.evaluate(f"TF.G.mode='practice';TF.G.idx={i};TF.G.round=1;TF.intro()")
        if i == 0: pg.screenshot(path=f'/tmp/shots/{TAG}-intro.png')
        pg.evaluate("TF.begin(); __bot(+(new URLSearchParams(location.search).get('rate')||9))")
        t0 = time.time(); shots = 0
        while time.time() - t0 < 90:
            time.sleep(0.25)
            s = pg.evaluate("[TF.G.scene, TF.G.ev && TF.G.ev.state]")
            el = time.time() - t0
            if shots < 3 and el > [1.0, 3.5, 6.0][shots] + (3 if d in ('100m', '110h') else 0):
                pg.screenshot(path=f'/tmp/shots/{TAG}-{d}-{shots}.png'); shots += 1
            if s[0] == 'result': break
        pg.screenshot(path=f'/tmp/shots/{TAG}-{d}-result.png')
        results[d] = pg.evaluate("[document.querySelector('#res-perf').textContent, document.querySelector('#res-verdict').textContent, document.querySelector('#res-attempts').textContent]")
        print(d, results[d], round(time.time() - t0, 1), 's', flush=True)
    print('scrollW', pg.evaluate('document.documentElement.scrollWidth'), 'errors', errs)
    ctx.close()
