'use strict';
const SFX = (() => {
  let ac = null, master = null, enabled = true, crowd = null, crowdGain = null, noiseBuf = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = enabled ? 0.7 : 0; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambient crowd bed
    crowd = ac.createBufferSource(); crowd.buffer = noiseBuf; crowd.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    crowdGain = ac.createGain(); crowdGain.gain.value = 0.035;
    crowd.connect(bp); bp.connect(crowdGain); crowdGain.connect(master); crowd.start();
  }
  const now = () => ac.currentTime;
  function tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
    if (!ac) return;
    const t = now() + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, freq = 1000, type = 'lowpass', delay = 0, attack = 0.002) {
    if (!ac) return;
    const t = now() + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function crowdSwell(level = 0.18, dur = 2.2) {
    if (!ac) return;
    const t = now();
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(level, t + 0.25);
    crowdGain.gain.linearRampToValueAtTime(0.035, t + dur);
  }
  return {
    init,
    setEnabled(on) { enabled = on; if (master) master.gain.value = on ? 0.7 : 0; },
    step() { noise(0.05, 0.12, 2200, 'highpass'); },
    tap() { tone(1400, 0.03, 'square', 0.03); },
    beep(hi) { tone(hi ? 1320 : 660, hi ? 0.35 : 0.16, 'square', 0.12); },
    gun() { noise(0.5, 0.9, 3000, 'lowpass', 0, 0.001); tone(120, 0.3, 'sawtooth', 0.25, -80); crowdSwell(0.12, 3); },
    whoosh() { noise(0.45, 0.25, 1200, 'bandpass', 0, 0.08); },
    thud() { noise(0.25, 0.5, 300); tone(90, 0.2, 'sine', 0.3, -40); },
    sand() { noise(0.5, 0.35, 700, 'lowpass', 0, 0.01); },
    clank() { tone(420, 0.12, 'square', 0.15, -200); noise(0.15, 0.3, 1800, 'bandpass'); },
    foul() { tone(220, 0.5, 'sawtooth', 0.18); tone(165, 0.6, 'sawtooth', 0.15, 0, 0.12); },
    tick() { tone(2000, 0.02, 'sine', 0.05); },
    swing(p) { noise(0.18, 0.08 + p * 0.12, 500 + p * 1500, 'bandpass', 0, 0.06); },
    cheer(big) { crowdSwell(big ? 0.4 : 0.22, big ? 4 : 2.5); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.16, 'square', 0.1, 0, i * 0.13)); },
    sad() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.28, 'triangle', 0.14, 0, i * 0.22)); },
    click() { tone(900, 0.04, 'triangle', 0.08); },
  };
})();
