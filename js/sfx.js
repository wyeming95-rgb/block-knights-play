'use strict';
/**
 * Tiny synthesized sound effects (WebAudio, no asset files). The AudioContext is
 * created lazily on the first user gesture so browsers don't warn about autoplay.
 */
(() => {
  let ac = null;
  let enabled = true;

  function ctx() {
    if (!enabled) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); } catch (_) { return null; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, dur, { type = 'square', vol = 0.08, slide = 0, delay = 0 } = {}) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.12, delay = 0, lowpass = 0 } = {}) {
    const a = ctx();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    let out = src;
    if (lowpass) {
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      out = f;
    }
    out.connect(g); g.connect(a.destination);
    src.start(a.currentTime + delay);
  }

  /** Line-clear impact: a sine kick dropping in pitch plus a muffled crunch. */
  function thump(power) {
    tone(150 + 20 * power, 0.16, { type: 'sine', slide: -110, vol: 0.18 + 0.04 * power });
    noise(0.07 + 0.02 * power, { vol: 0.16 + 0.03 * power, lowpass: 1400 + 500 * power });
  }

  const SFX = {
    unlock() { ctx(); },
    setEnabled(v) { enabled = !!v; },
    get enabled() { return enabled; },
    /** n = lines (for 'clear') or pitch in Hz (for 'blip'), combo = current combo (raises the chime 2 semitones per step). */
    play(name, n = 1, combo = 1) {
      if (!enabled) return;
      switch (name) {
        case 'pick': tone(520, 0.05, { vol: 0.04 }); break;
        case 'place': tone(180, 0.08, { type: 'triangle', vol: 0.12, slide: -60 }); break;
        case 'bad': tone(140, 0.12, { vol: 0.05 }); break;
        case 'clear': {
          const up = Math.pow(2, (2 * Math.min(8, Math.max(0, combo - 1))) / 12);
          thump(Math.min(4, n) + Math.min(3, combo - 1) * 0.5);
          for (let i = 0; i < Math.min(4, n); i++) tone(440 * up * Math.pow(1.26, i), 0.12, { type: 'triangle', vol: 0.09, delay: 0.03 + i * 0.05 });
          if (combo >= 2) tone(1320 * up, 0.09, { type: 'square', vol: 0.03, delay: 0.03 + Math.min(4, n) * 0.05 });
          break;
        }
        case 'hit': noise(0.08, { vol: 0.15 }); tone(220, 0.08, { slide: -120, vol: 0.06 }); break;
        case 'crit': noise(0.12, { vol: 0.2 }); tone(660, 0.1, { slide: -300, vol: 0.07 }); break;
        case 'hurt': noise(0.18, { vol: 0.2 }); tone(120, 0.2, { type: 'sawtooth', slide: -60, vol: 0.08 }); break;
        case 'block': tone(880, 0.15, { type: 'triangle', vol: 0.08 }); tone(1320, 0.2, { type: 'triangle', vol: 0.05, delay: 0.05 }); break;
        case 'skill': tone(330, 0.3, { type: 'triangle', slide: 660, vol: 0.08 }); break;
        case 'ready': tone(988, 0.08, { type: 'triangle', vol: 0.05 }); tone(1319, 0.12, { type: 'triangle', vol: 0.05, delay: 0.07 }); break;
        case 'corrupt': tone(90, 0.25, { type: 'sawtooth', slide: -30, vol: 0.06 }); break;
        case 'pop': noise(0.25, { vol: 0.2 }); tone(300, 0.3, { slide: -250, vol: 0.08 }); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.08, delay: i * 0.1 })); break;
        case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.08, delay: i * 0.15 })); break;
        // dialogue typing: n = speaker's voice pitch; tiny, soft, a little detuned per blip
        case 'blip': tone(n * (0.94 + Math.random() * 0.12), 0.045, { type: 'sine', vol: 0.035 }); break;
        case 'summon': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.06, delay: i * 0.06 })); break;
        default: break;
      }
    },
  };

  window.SFX = SFX;
})();
