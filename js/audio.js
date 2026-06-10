// DRYFIRE audio — every sound synthesized with WebAudio, zero assets.
"use strict";

const Audio_ = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // One enveloped oscillator: type, start freq, end freq, duration, gain.
  function tone(type, f0, f1, dur, vol, when = 0) {
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(filterFreq, t);
    f.frequency.exponentialRampToValueAtTime(100, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const sfx = {
    shot()    { noise(0.16, 0.9, 3500); tone("square", 160, 40, 0.14, 0.5); },
    dry()     { tone("square", 900, 700, 0.03, 0.25); tone("square", 500, 300, 0.03, 0.2, 0.05); },
    pickup()  { tone("sine", 900, 1500, 0.09, 0.35); tone("sine", 1400, 2100, 0.08, 0.25, 0.05); },
    pop()     { noise(0.12, 0.5, 1800); tone("triangle", 320, 60, 0.18, 0.45); },
    bigpop()  { noise(0.3, 0.8, 1200); tone("triangle", 180, 30, 0.35, 0.6); },
    refund()  { for (let i = 0; i < 4; i++) tone("sine", 800 + i * 250, 1200 + i * 250, 0.08, 0.2, i * 0.05); },
    hurt()    { tone("sawtooth", 300, 60, 0.3, 0.55); noise(0.2, 0.4, 900); },
    eat()     { tone("sawtooth", 200, 90, 0.15, 0.3); },
    wave()    { tone("square", 220, 220, 0.1, 0.3); tone("square", 330, 330, 0.12, 0.3, 0.13); },
    bounce()  { tone("triangle", 140, 90, 0.07, 0.18); },
    die()     { tone("sawtooth", 240, 30, 0.9, 0.6); noise(0.6, 0.5, 700, 0.1); },
  };

  return {
    play(name) {
      if (muted || !ensure() || !sfx[name]) return;
      try { sfx[name](); } catch (e) { /* audio is decoration, never fatal */ }
    },
    toggleMute() { muted = !muted; return muted; },
    unlock() { ensure(); },
  };
})();
