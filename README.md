# Track & Field — Neo Edition

A modern browser remake of the classic arcade Track & Field. Six events (100m, long jump, javelin, 110m hurdles, hammer, high jump), Arcade mode with qualifying marks, Practice mode, Hall of Fame, synthesized audio. Vanilla HTML/CSS/JS + Canvas, installable PWA that works offline.

**Play:** https://drewanderson67.github.io/track-and-field/

## Controls
- Run: alternate ← / → (or A / D), or the on-screen RUN L / RUN R pads, or gamepad LB / RB
- Action (jump / throw / release / dive): Space, ↑, W or K — hold to set the angle
- Pause: Esc or P

## Develop
```
python3 -m http.server 8080 -d src
```
Browser bot test (Playwright over Chrome CDP on :29229): `python tests/bot.py http://localhost:8080/ 390 844`
