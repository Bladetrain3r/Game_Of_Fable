// DRYFIRE pickups — utility only, all temporal. The one hard rule: pickups
// NEVER create ammo. Conservation is the game's one sacred law.
"use strict";

const PICKUP_KINDS = {
  // The empty-mag mercy, weaponized as a reward: floor shells sprint to you.
  lodestone:    { color: "#53e0ff", label: "LODESTONE" },
  // Next shot pierces everything (shields included) and kicks twice as hard.
  overpressure: { color: "#ffffff", label: "OVERPRESSURE" },
  // One heart back. Rare, wave-clear only.
  patchkit:     { color: "#ff4f6d", label: "+♥" },
};

const MAX_FLOOR_PICKUPS = 2;
const PICKUP_LIFE = 12;          // seconds on the floor, blinking near the end
const LODESTONE_TIME = 5;
const LODESTONE_CRAWL = 260;     // vs the 70 px/s empty-mag mercy crawl

function makePickup(kind, x, y) {
  return { kind, x, y, r: 10, life: PICKUP_LIFE, bob: rand(0, Math.PI * 2), dead: false };
}

function updatePickups(pickups, p, dt, events) {
  for (const k of pickups) {
    k.life -= dt;
    k.bob += dt * 3;
    if (k.life <= 0) { k.dead = true; continue; }
    const rr = p.r + k.r + 6;
    if (dist2(p, k) < rr * rr) {
      k.dead = true;
      events.push({ type: "collect", kind: k.kind, x: k.x, y: k.y });
    }
  }
}

function applyPickup(g, kind, x, y) {
  const def = PICKUP_KINDS[kind];
  if (kind === "lodestone") g.lodestone = LODESTONE_TIME;
  if (kind === "overpressure") g.player.overpressure = true;
  if (kind === "patchkit") g.player.hp = Math.min(3, g.player.hp + 1);
  g.floaters.push(makeFloater(x, y, def.label, def.color));
  for (let i = 0; i < 10; i++) g.particles.push(makeParticle(x, y, def.color, 200, rand(0.3, 0.6)));
  Audio_.play(kind === "patchkit" ? "heal" : "power");
}

const floorPickups = (g) => g.pickups.filter((k) => !k.dead).length;

// HOT kills have a shot at dropping a toy right where the body fell.
function rollHotDrop(g, x, y) {
  if (floorPickups(g) >= MAX_FLOOR_PICKUPS) return;
  if (Math.random() < 0.15) {
    g.pickups.push(makePickup(Math.random() < 0.5 ? "lodestone" : "overpressure", x, y));
  }
}

// Wave clears can drop a patch kit if you're hurting, else maybe a utility.
function rollWaveDrop(g) {
  if (floorPickups(g) >= MAX_FLOOR_PICKUPS) return;
  const x = rand(WALL + 60, W - WALL - 60), y = rand(WALL + 60, H - WALL - 60);
  const r = Math.random();
  if (g.player.hp < 3 && r < 0.4) {
    g.pickups.push(makePickup("patchkit", x, y));
  } else if (r < 0.75) {
    g.pickups.push(makePickup(Math.random() < 0.5 ? "lodestone" : "overpressure", x, y));
  }
}

function drawPickups(ctx, pickups, t) {
  for (const k of pickups) {
    if (k.life < 3 && Math.floor(k.life * 6) % 2 === 0) continue;  // expiry blink
    const def = PICKUP_KINDS[k.kind];
    const y = k.y + Math.sin(k.bob) * 3;
    ctx.save();
    ctx.translate(k.x, y);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = def.color;
    ctx.fillStyle = def.color;
    if (k.kind === "lodestone") {           // ring and core: a magnet's promise
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (k.kind === "overpressure") { // four-point star: barely contained
      ctx.rotate(t * 1.5);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 11 : 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    } else {                                // patch kit: the universal plus
      ctx.fillRect(-9, -3, 18, 6);
      ctx.fillRect(-3, -9, 6, 18);
    }
    ctx.restore();
  }
}
