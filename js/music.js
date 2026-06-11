// DRYFIRE music — a procedurally generated ambient bliptune, synthesized live.
// No files, no loops, no repeats: a pentatonic random walk over a slow drone.
// Reactive: combo and wave make it busier; a starving magazine makes it TENSER —
// faster steps, higher register, a ticking pulse. The soundtrack is a tension
// gauge you hear instead of read.
"use strict";

const Music = (() => {
  const PENTA = [0, 3, 5, 7, 10];          // A minor pentatonic
  const STEP = 0.42;                       // base step at calm (~71 bpm eighths)

  let ctx = null, out = null, timer = null, drone = null;
  let active = false, tension = 0, intensity = 0;
  let step = 0, nextTime = 0, melody = 10, root = 0;

  const freqOf = (semi) => 55 * Math.pow(2, semi / 12);
  const noteAt = (deg) => {
    const oct = Math.floor(deg / 5);
    return freqOf(24 + oct * 12 + root + PENTA[((deg % 5) + 5) % 5]);
  };

  function blip(t, f, dur, vol, type = "triangle") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function tick(t, vol) {                  // dry little woodblock for tense pulses
    blip(t, 1900, 0.03, vol, "square");
  }

  function boot() {
    if (ctx) return true;
    const env = Audio_.context();
    if (!env) return false;
    ctx = env.ctx;
    out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(env.master);
    // the drone: two barely-detuned saws through a dark lowpass, always on,
    // volume ridden by the scheduler
    const g = ctx.createGain();
    g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 220;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = o2.type = "sawtooth";
    o1.frequency.value = freqOf(12);
    o2.frequency.value = freqOf(12) * 1.006;
    o1.connect(f); o2.connect(f);
    f.connect(g).connect(out);
    o1.start(); o2.start();
    drone = { g, o1, o2 };
    timer = setInterval(schedule, 110);
    return true;
  }

  function schedule() {
    if (!ctx) return;
    const silent = !active || Audio_.muted;
    drone.g.gain.setTargetAtTime(silent ? 0 : 0.05 + tension * 0.05, ctx.currentTime, 0.4);
    if (silent) { nextTime = 0; return; }

    const stepDur = STEP / (1 + tension * 0.5);          // tense = faster
    const horizon = ctx.currentTime + 0.35;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;

    while (nextTime < horizon) {
      const t = nextTime;
      if (step % 8 === 0) {                              // bar pulse
        blip(t, noteAt(0), 1.1, 0.14, "sine");
        if (step % 32 === 0) {                           // the key wanders, slowly
          root = [0, -2, 3, 5][Math.floor(Math.random() * 4)];
          drone.o1.frequency.setTargetAtTime(freqOf(12 + root), t, 0.8);
          drone.o2.frequency.setTargetAtTime(freqOf(12 + root) * 1.006, t, 0.8);
        }
      }
      const density = 0.22 + intensity * 0.4 + tension * 0.25;
      if (Math.random() < density) {                     // melody: a random walk
        melody += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        melody = Math.max(5, Math.min(18, melody));
        const deg = melody + (tension > 0.6 ? 5 : 0);    // panic climbs an octave
        const dur = tension > 0.6 ? 0.14 : 0.45 + Math.random() * 0.3;
        blip(t, noteAt(deg), dur, 0.06 + intensity * 0.04);
      }
      if (tension > 0.35 && step % 2 === 0) tick(t, 0.02 + tension * 0.05);
      step++;
      nextTime += stepDur;
    }
  }

  return {
    // Called every frame; cheap. Starts the engine on first active frame
    // (which is always after a user gesture, so the context can run).
    update(isActive, newTension, newIntensity) {
      active = isActive;
      tension = newTension;
      intensity = newIntensity;
      if (active && !ctx) boot();
    },
  };
})();
