// DRYFIRE entities — plain objects + update functions. No classes, no inheritance.
"use strict";

const W = 960, H = 600, WALL = 14;

const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
const len = (x, y) => Math.hypot(x, y) || 1e-9;

// ---------- factories ----------

function makePlayer(startAmmo) {
  return {
    x: W / 2, y: H / 2, vx: 0, vy: 0, r: 12,
    aim: 0, ammo: startAmmo, hp: 3, overpressure: false,
    iframes: 0, recoilKick: 0, fireCooldown: 0,
  };
}

function makeBullet(x, y, angle) {
  return {
    x, y, vx: Math.cos(angle) * 950, vy: Math.sin(angle) * 950, r: 4,
    pierce: false, hits: null, dead: false,
  };
}

// Casings eject out the side port, inheriting some player velocity.
function makeCasing(p, aimAngle) {
  const side = aimAngle + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + rand(-0.5, 0.5);
  const speed = rand(120, 260);
  return {
    x: p.x, y: p.y,
    vx: Math.cos(side) * speed + p.vx * 0.4,
    vy: Math.sin(side) * speed + p.vy * 0.4,
    r: 7, settled: false, age: 0, spin: rand(0, Math.PI * 2), dead: false,
  };
}

const ENEMY_KINDS = {
  // Triangle: fast chaser with a wobble. Fodder, but it herds you.
  drifter: { r: 11, hp: 1, score: 100, color: "#ff4f6d" },
  // Square: ignores you, vacuums your casings off the floor. Kill = full refund.
  magnet:  { r: 16, hp: 2, score: 250, color: "#b07cff" },
  // Hexagon: slow wall of meat that soaks hits and blocks lanes.
  mass:    { r: 26, hp: 4, score: 400, color: "#ff9d3b" },
  // Pentagon: frontal shield eats bullets. Only killable from behind —
  // a recoil-piloting exam, since flying is the only way to flank.
  warden:  { r: 14, hp: 2, score: 350, color: "#4dff88" },
  // Diamond: keeps its distance and spits energy bolts. Bolts are NOT brass
  // and never pickupable — enemy fire stays outside the ammo economy.
  shrike:  { r: 12, hp: 1, score: 300, color: "#ff4fd8" },
};

const SHIELD_ARC = 1.2;      // warden shield half-angle, radians (~69° each side)

function makeEnemy(kind, x, y, wave, hpBonus = 0) {
  const def = ENEMY_KINDS[kind];
  return {
    kind, x, y, vx: 0, vy: 0, r: def.r,
    hp: def.hp + hpBonus, maxHp: def.hp + hpBonus, score: def.score, color: def.color,
    wobble: rand(0, Math.PI * 2), eaten: 0, hitFlash: 0,
    facing: rand(0, Math.PI * 2), fire: rand(1.6, 2.8), windup: 0,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    speedBoost: 1 + Math.min(wave * 0.04, 0.8), dead: false,
  };
}

function makeEnemyShot(x, y, angle) {
  return { x, y, vx: Math.cos(angle) * 270, vy: Math.sin(angle) * 270, r: 6, life: 5, dead: false };
}

function makeParticle(x, y, color, speed, life) {
  const a = rand(0, Math.PI * 2);
  const s = rand(speed * 0.3, speed);
  return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life, maxLife: life, dead: false };
}

function makeFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9, dead: false };
}

// ---------- update systems ----------

function bounceOffWalls(e, restitution, onBounce) {
  let hit = false;
  if (e.x < WALL + e.r) { e.x = WALL + e.r; e.vx = Math.abs(e.vx) * restitution; hit = true; }
  if (e.x > W - WALL - e.r) { e.x = W - WALL - e.r; e.vx = -Math.abs(e.vx) * restitution; hit = true; }
  if (e.y < WALL + e.r) { e.y = WALL + e.r; e.vy = Math.abs(e.vy) * restitution; hit = true; }
  if (e.y > H - WALL - e.r) { e.y = H - WALL - e.r; e.vy = -Math.abs(e.vy) * restitution; hit = true; }
  if (hit && onBounce) onBounce(e);
}

function updatePlayer(p, dt, sfxBounce) {
  const drag = Math.pow(0.5, dt);          // velocity halves every second: long glides
  p.vx *= drag; p.vy *= drag;
  const spd = len(p.vx, p.vy);
  if (spd > 750) { p.vx *= 750 / spd; p.vy *= 750 / spd; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  bounceOffWalls(p, 0.75, spd > 120 ? sfxBounce : null);
  p.iframes = Math.max(0, p.iframes - dt);
  p.recoilKick = Math.max(0, p.recoilKick - dt * 4);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
}

function updateBullets(bullets, dt) {
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < WALL || b.x > W - WALL || b.y < WALL || b.y > H - WALL) {
      // Bullets shatter on walls — the casing already fell where you fired.
      b.dead = true;
    }
  }
}

// Settled casings are inert ammo, unless something makes them crawl home:
// the empty-mag mercy (slow, terrifying, softlock-proof) or a lodestone (fast).
function updateCasings(casings, p, dt, crawlSpeed) {
  for (const c of casings) {
    c.age += dt;
    if (!c.settled) {
      const drag = Math.pow(0.002, dt);    // skid hard, stop fast
      c.vx *= drag; c.vy *= drag;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.spin += dt * 10;
      bounceOffWalls(c, 0.5, null);
      if (len(c.vx, c.vy) < 10 && c.age > 0.25) c.settled = true;
    } else if (crawlSpeed > 0) {
      const dx = p.x - c.x, dy = p.y - c.y, d = len(dx, dy);
      const crawl = crawlSpeed * dt;
      c.x += (dx / d) * crawl; c.y += (dy / d) * crawl;
    }
  }
}

function steerToward(e, tx, ty, speed, dt, turn = 4) {
  const dx = tx - e.x, dy = ty - e.y, d = len(dx, dy);
  const blend = 1 - Math.pow(0.5, dt * turn);
  e.vx += ((dx / d) * speed - e.vx) * blend;
  e.vy += ((dy / d) * speed - e.vy) * blend;
  e.x += e.vx * dt; e.y += e.vy * dt;
}

function nearestSettledCasing(e, casings) {
  let best = null, bd = Infinity;
  for (const c of casings) {
    if (c.dead || !c.settled) continue;
    const d = dist2(e, c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// True if a point (e.g. a bullet) is inside the warden's frontal shield arc.
const shieldBlocks = (e, x, y) =>
  Math.abs(angleDiff(Math.atan2(y - e.y, x - e.x), e.facing)) < SHIELD_ARC;

// Returns events the game loop reacts to (sounds, score, floaters).
function updateEnemies(enemies, casings, p, dt, events) {
  for (const e of enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    e.wobble += dt * 5;
    const boost = e.speedBoost;

    if (e.kind === "warden") {
      // Shield tracks you slowly — a committed recoil arc gets behind it
      // with time to line up the shot, but a lazy orbit doesn't.
      const want = Math.atan2(p.y - e.y, p.x - e.x);
      const turn = 1.1 * dt;
      e.facing += Math.max(-turn, Math.min(turn, angleDiff(want, e.facing)));
      steerToward(e, p.x, p.y, 72 * boost, dt, 3);
    } else if (e.kind === "shrike") {
      // Hold ~250px range, strafing sideways; wind up, then spit a bolt.
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      const tx = p.x + Math.cos(a + e.strafeDir * 0.5) * 250;
      const ty = p.y + Math.sin(a + e.strafeDir * 0.5) * 250;
      steerToward(e, tx, ty, 115 * boost, dt, 4);
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          e.windup = 0;
          e.fire = rand(2.2, 3.2);
          events.push({ type: "shoot", x: e.x, y: e.y, a: Math.atan2(p.y - e.y, p.x - e.x) });
        }
      } else {
        e.fire -= dt;
        if (e.fire <= 0) e.windup = 0.45;
      }
    } else if (e.kind === "drifter") {
      const wob = Math.sin(e.wobble) * 60;
      const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
      steerToward(e, p.x + Math.cos(a) * wob, p.y + Math.sin(a) * wob, 135 * boost, dt);
    } else if (e.kind === "magnet") {
      const c = nearestSettledCasing(e, casings);
      if (c) {
        steerToward(e, c.x, c.y, 95 * boost, dt, 6);
        if (dist2(e, c) < (e.r + c.r) * (e.r + c.r)) {
          c.dead = true; e.eaten++; e.r = Math.min(24, e.r + 1.5);
          events.push({ type: "eat", x: c.x, y: c.y });
        }
      } else {
        steerToward(e, p.x, p.y, 70 * boost, dt, 3);  // nothing to steal: come for you
      }
    } else { // mass
      steerToward(e, p.x, p.y, 48 * boost, dt, 2);
    }
    bounceOffWalls(e, 0.6, null);
  }
}

function updateEnemyShots(shots, dt) {
  for (const s of shots) {
    s.life -= dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.life <= 0 || s.x < WALL || s.x > W - WALL || s.y < WALL || s.y > H - WALL) {
      s.dead = true;  // bolts shatter on walls; they're energy, they leave nothing
    }
  }
}

function updateParticles(particles, dt) {
  for (const pt of particles) {
    pt.life -= dt;
    if (pt.life <= 0) { pt.dead = true; continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.05, dt); pt.vy *= Math.pow(0.05, dt);
  }
}

function updateFloaters(floaters, dt) {
  for (const f of floaters) {
    f.life -= dt;
    f.y -= 35 * dt;
    if (f.life <= 0) f.dead = true;
  }
}

const sweepDead = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dead) arr.splice(i, 1);
};
