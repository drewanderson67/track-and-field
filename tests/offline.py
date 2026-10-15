import sys, time
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8081/'
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp('http://localhost:29229')
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller', timeout=15000) if False else None
    pg.evaluate("navigator.serviceWorker.ready"); time.sleep(1); pg.reload(); time.sleep(1)
    ctl = pg.evaluate("!!navigator.serviceWorker.controller")
    man = pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json()).then(j=>j.icons.length)")
    ctx.set_offline(True); pg.reload(); time.sleep(1)
    ver = pg.evaluate("document.querySelector('#ver').textContent")
    pg.evaluate("TF.G.def=TF.EVENT_DEFS[0]; TF.G.mode='practice'; TF.begin()"); time.sleep(1)
    print('controlled', ctl, 'icons', man, 'offline ver', ver, 'scene', pg.evaluate('TF.G.scene'), 'errors', errs)
    ctx.close()
