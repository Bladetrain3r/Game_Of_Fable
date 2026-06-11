// DRYFIRE — game state, loop, input. Eight bullets, forever.
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

const RECOIL = 300;          // px/s of velocity per shot, opposite to aim
const FIRE_COOLDOWN = 0.16;
const COMBO_WINDOW = 2.5;
const HOT_SPEED = 330;       // kills above this speed pay 50% extra

// The whole difficulty system is this table. The conservation rule is sacred
// in every mode — harder just means the universe holds fewer bullets.
const DIFFICULTIES = {
  practice: { label: "practice", ammo: 16, attractAt: 0, scoreMult: 0,   hpBonus: 0, enemies: false },
  easy:     { label: "easy",     ammo: 12, attractAt: 1, scoreMult: 0.5, hpBonus: 0, enemies: true },
  normal:   { label: "normal",   ammo: 8,  attractAt: 0, scoreMult: 1,   hpBonus: 0, enemies: true },
  hard:     { label: "hard",     ammo: 6,  attractAt: 0, scoreMult: 1.5, hpBonus: 0, enemies: true },
  suicidal: { label: "suicidal", ammo: 4,  attractAt: 0, scoreMult: 1.5, hpBonus: 1, enemies: true },
};

let game = null;
let state = "title";         // title | playing | paused | dead
let mouse = { x: W / 2, y: H / 2, down: false };
let lastTime = 0;
let elapsed = 0;
let lastDiffKey = "normal";
let diedAt = -10;            // swallow frantic clicks right after death

function newGame(diffKey) {
  const diff = DIFFICULTIES[diffKey];
  return {
    diff, diffKey,
    player: makePlayer(diff.ammo),
    bullets: [], casings: [], enemies: [], eshots: [], pickups: [], particles: [], floaters: [], spawns: [],
    trail: [], lodestone: 0,
    wave: 0, waveTimer: 1.2, betweenWaves: true,
    score: 0, combo: 1, comboTimer: 0, kills: 0,
    dist: 0, shake: 0,
  };
}

// ---------- best scores (per difficulty) ----------

const bestKey = (k) => `dryfire-best-${k}`;
{ // one-time migration: the v1.0 best becomes the Normal best
  const old = localStorage.getItem("dryfire-best");
  if (old && !localStorage.getItem(bestKey("normal"))) {
    localStorage.setItem(bestKey("normal"), old);
  }
}

function bestLine() {
  const parts = [];
  for (const k of Object.keys(DIFFICULTIES)) {
    const v = localStorage.getItem(bestKey(k));
    if (v) parts.push(`${DIFFICULTIES[k].label} ${v}`);
  }
  return parts.length ? "best — " + parts.join(" · ") : "";
}

// ---------- input ----------

function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
}

window.addEventListener("mousemove", (ev) => { mouse = { ...mouse, ...canvasPos(ev) }; });
window.addEventListener("mousedown", (ev) => {
  Audio_.unlock();
  mouse = { ...canvasPos(ev), down: true };
  if (state === "dead") {
    // don't let a stray click eat a board-qualifying run, or a click in the form restart
    if (ev.target.closest("#entry") || !$("entry").classList.contains("hidden")) return;
    if (elapsed - diedAt > 0.7) startRun(lastDiffKey);
    return;
  }
  if (state === "playing") {  // fire on the event itself; polling alone can miss fast clicks
    const p = game.player;
    p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    tryFire(game);
  }
});
window.addEventListener("mouseup", () => { mouse.down = false; });
window.addEventListener("contextmenu", (ev) => ev.preventDefault());

window.addEventListener("keydown", (ev) => {
  const k = ev.key.toLowerCase();
  if (k === "m") Audio_.toggleMute();
  if (k === "p" && (state === "playing" || state === "paused")) {
    state = state === "playing" ? "paused" : "playing";
    $("pause").classList.toggle("hidden", state === "playing");
  }
  if (k === "escape" && state !== "title") toTitle();
  if (state === "title" || state === "dead") {
    const keys = Object.keys(DIFFICULTIES);
    const n = parseInt(k, 10);
    if (n >= 1 && n <= keys.length) startRun(keys[n - 1]);
  }
});

function toTitle() {
  game = null;
  state = "title";
  $("pause").classList.add("hidden");
  $("death").classList.add("hidden");
  $("hud").classList.add("hidden");
  $("title").classList.remove("hidden");
  $("title-best").textContent = bestLine();
}

function startRun(diffKey) {
  lastDiffKey = diffKey;
  game = newGame(diffKey);
  game.player.fireCooldown = 0.35;  // the starting click shouldn't waste a shot
  state = "playing";
  $("title").classList.add("hidden");
  $("death").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("hud").classList.remove("hidden");
}

for (const btn of document.querySelectorAll("#diffs button")) {
  btn.addEventListener("click", () => startRun(btn.dataset.diff));
}

// ---------- firing ----------

function tryFire(g) {
  const p = g.player;
  if (p.fireCooldown > 0) return;
  p.fireCooldown = FIRE_COOLDOWN;
  if (p.ammo <= 0) { Audio_.play("dry"); return; }

  const op = p.overpressure;
  p.overpressure = false;
  p.ammo--;
  const b = makeBullet(p.x + Math.cos(p.aim) * 18, p.y + Math.sin(p.aim) * 18, p.aim);
  if (op) { b.pierce = true; b.hits = []; }
  g.bullets.push(b);
  g.casings.push(makeCasing(p, p.aim));
  const kick = RECOIL * (op ? 1.9 : 1);
  p.vx -= Math.cos(p.aim) * kick;
  p.vy -= Math.sin(p.aim) * kick;
  p.recoilKick = op ? 1.6 : 1;
  g.shake = Math.min(1, g.shake + (op ? 0.6 : 0.25));
  Audio_.play(op ? "overshot" : "shot");
}

// ---------- waves ----------

function spawnPointAwayFromPlayer(p) {
  for (let i = 0; i < 30; i++) {
    const x = rand(WALL + 40, W - WALL - 40), y = rand(WALL + 40, H - WALL - 40);
    if (dist2({ x, y }, p) > 220 * 220) return { x, y };
  }
  return { x: WALL + 40, y: WALL + 40 };
}

function queueWave(g) {
  g.wave++;
  const n = g.wave;
  const roster = [];
  for (let i = 0; i < 2 + Math.min(n, 8); i++) roster.push("drifter");
  for (let i = 0; i < Math.min(3, Math.floor(n / 2)); i++) roster.push("magnet");
  for (let i = 0; i < Math.min(2, Math.floor((n - 1) / 3)); i++) roster.push("mass");
  for (let i = 0; i < Math.min(3, Math.floor((n - 1) / 2)); i++) roster.push("warden");   // wave 3+
  for (let i = 0; i < Math.min(3, Math.floor((n - 2) / 2)); i++) roster.push("shrike");   // wave 4+
  for (const kind of roster) {
    const pt = spawnPointAwayFromPlayer(g.player);
    g.spawns.push({ kind, x: pt.x, y: pt.y, timer: rand(0.9, 1.6), total: 1.6 });
  }
  Audio_.play("wave");
  g.floaters.push(makeFloater(W / 2, H / 2 - 60, `WAVE ${n}`, "#53e0ff"));
}

function updateSpawns(g, dt) {
  for (const s of g.spawns) {
    s.timer -= dt;
    if (s.timer <= 0) {
      s.dead = true;
      g.enemies.push(makeEnemy(s.kind, s.x, s.y, g.wave, g.diff.hpBonus));
    }
  }
  sweepDead(g.spawns);
}

// ---------- combat resolution ----------

function burst(g, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) g.particles.push(makeParticle(x, y, color, speed, rand(0.25, 0.6)));
}

function killEnemy(g, e) {
  e.dead = true;
  g.kills++;
  const p = g.player;
  const hot = len(p.vx, p.vy) > HOT_SPEED;
  const points = Math.round(e.score * g.combo * (hot ? 1.5 : 1) * g.diff.scoreMult);
  g.score += points;
  g.combo = Math.min(8, g.combo + 1);
  g.comboTimer = COMBO_WINDOW;
  g.floaters.push(makeFloater(e.x, e.y, (hot ? "HOT " : "") + points, hot ? "#ffc843" : "#cdd6e4"));
  if (hot) rollHotDrop(g, e.x, e.y);
  burst(g, e.x, e.y, e.color, e.kind === "mass" ? 26 : 14, 260);
  g.shake = Math.min(1, g.shake + (e.kind === "mass" ? 0.6 : 0.3));
  Audio_.play(e.kind === "mass" ? "bigpop" : "pop");

  if (e.eaten > 0) {  // the magnet coughs up everything it swallowed
    for (let i = 0; i < e.eaten; i++) {
      const c = makeCasing({ x: e.x, y: e.y, vx: 0, vy: 0 }, rand(0, Math.PI * 2));
      g.casings.push(c);
    }
    Audio_.play("refund");
    g.floaters.push(makeFloater(e.x, e.y - 20, `+${e.eaten} SHELLS`, "#ffc843"));
  }
}

function hurtPlayer(g, e) {
  const p = g.player;
  if (p.iframes > 0) return;
  p.hp--;
  p.iframes = 1.2;
  g.combo = 1;
  g.comboTimer = 0;
  // Pain is propulsion: a hit launches you away — sometimes straight to your shells.
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  p.vx = Math.cos(a) * 420;
  p.vy = Math.sin(a) * 420;
  g.shake = 1;
  burst(g, p.x, p.y, "#ff4f6d", 18, 300);
  Audio_.play("hurt");
  if (p.hp <= 0) endRun(g);
}

function endRun(g) {
  state = "dead";
  diedAt = elapsed;
  Audio_.play("die");
  const best = Math.max(g.score, Number(localStorage.getItem(bestKey(g.diffKey)) || 0));
  if (g.diff.scoreMult > 0) localStorage.setItem(bestKey(g.diffKey), String(best));
  $("death-stats").textContent = `${g.score} pts · ${g.diff.label} · wave ${g.wave} · ${g.kills} kills`;
  $("death-best").textContent = `${g.diff.label} best: ${best}`;
  $("death").classList.remove("hidden");
  $("hud").classList.add("hidden");
  setupDeathBoard(g);
}

// ---------- online leaderboard (absent on static-only hosting) ----------

function renderBoard(highlight) {
  const el = $("board");
  el.innerHTML = "";
  for (const e of Scores.board) {
    const li = document.createElement("li");
    for (const [cls, text] of [["ini", e.initials], ["pts", e.score], ["dif", e.diff]]) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      li.appendChild(span);
    }
    if (highlight && e.initials === highlight.initials && e.score === highlight.score) {
      li.classList.add("fresh");
      highlight = null;  // only flag the first match
    }
    el.appendChild(li);
  }
  el.classList.toggle("hidden", Scores.board.length === 0);
}

async function setupDeathBoard(g) {
  $("entry").classList.add("hidden");
  $("board").classList.add("hidden");
  await Scores.refresh();
  if (state !== "dead" || game !== g) return;  // player already moved on
  if (!Scores.enabled) return;
  renderBoard(null);
  if (g.diff.scoreMult > 0 && Scores.qualifies(g.score)) {
    $("entry-msg").textContent = "you made the board — initials?";
    const input = $("initials");
    input.value = "";
    input.disabled = false;
    $("entry").classList.remove("hidden");
    input.focus();
  }
}

const initialsInput = $("initials");
initialsInput.addEventListener("input", () => {
  initialsInput.value = initialsInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
});
initialsInput.addEventListener("keydown", async (ev) => {
  ev.stopPropagation();  // typing must not trigger global shortcuts (1-5 restarts!)
  if (ev.key === "Escape") { $("entry").classList.add("hidden"); return; }
  if (ev.key !== "Enter" || initialsInput.value.length === 0 || !game) return;
  const g = game;
  initialsInput.disabled = true;
  $("entry-msg").textContent = "etching it in...";
  const res = await Scores.submit(initialsInput.value, g.score, g.diffKey);
  if (state !== "dead" || game !== g) return;
  $("entry").classList.add("hidden");
  if (res.ok) {
    renderBoard(res.qualified ? { initials: initialsInput.value, score: g.score } : null);
    if (res.qualified) Audio_.play("refund");
    $("death-best").textContent += res.qualified
      ? ` · board #${res.rank}` : " · sniped off the board";
  } else {
    $("death-best").textContent += " · board unreachable";
  }
});

function collide(g) {
  const p = g.player;
  // bullets vs enemies
  for (const b of g.bullets) {
    if (b.dead) continue;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const rr = b.r + e.r;
      if (dist2(b, e) < rr * rr) {
        if (b.pierce) {
          if (b.hits.includes(e)) continue;  // overpressure punches through, once each
          b.hits.push(e);
        } else {
          b.dead = true;
          if (e.kind === "warden" && shieldBlocks(e, b.x, b.y)) {
            burst(g, b.x, b.y, "#b8ffd2", 6, 200);
            Audio_.play("clink");
            break;  // shield ate it; the casing already fell where you fired
          }
        }
        e.hp--;
        e.hitFlash = 1;
        e.vx += (b.vx / 950) * 160; e.vy += (b.vy / 950) * 160;  // bullets shove
        if (e.hp <= 0) killEnemy(g, e);
        else { burst(g, b.x, b.y, "#ffffff", 5, 180); Audio_.play("pop"); }
        if (!b.pierce) break;
      }
    }
  }
  // player vs casings: skate over shells to reload
  for (const c of g.casings) {
    if (c.dead || !c.settled) continue;
    const rr = p.r + c.r + 4;
    if (dist2(p, c) < rr * rr) {
      c.dead = true;
      p.ammo++;
      g.floaters.push(makeFloater(c.x, c.y, "+1", "#ffc843"));
      Audio_.play("pickup");
    }
  }
  // player vs enemies
  for (const e of g.enemies) {
    if (e.dead) continue;
    const rr = p.r + e.r;
    if (dist2(p, e) < rr * rr) hurtPlayer(g, e);
  }
  // player vs enemy bolts (they pass through during i-frames rather than vanish)
  for (const s of g.eshots) {
    if (s.dead || p.iframes > 0) continue;
    const rr = p.r + s.r;
    if (dist2(p, s) < rr * rr) {
      s.dead = true;
      burst(g, s.x, s.y, "#ff4fd8", 8, 220);
      hurtPlayer(g, s);
    }
  }
}

// ---------- HUD ----------

function updateHud(g) {
  const p = g.player;
  const maxAmmo = g.diff.ammo;
  $("hearts").textContent = g.diff.enemies
    ? "♥".repeat(p.hp) + "♡".repeat(Math.max(0, 3 - p.hp)) : "";
  const ammoEl = $("ammo");
  if (ammoEl.childElementCount !== maxAmmo) {
    ammoEl.innerHTML = "";
    for (let i = 0; i < maxAmmo; i++) ammoEl.appendChild(document.createElement("div"));
  }
  for (let i = 0; i < maxAmmo; i++) {
    ammoEl.children[i].className = "pip" + (i < p.ammo ? "" : " empty");
  }
  if (g.diff.enemies) {
    $("score").textContent = g.score;
    const tags = [];
    if (p.overpressure) tags.push("OVERPRESSURE");
    if (g.lodestone > 0) tags.push(`lodestone ${Math.ceil(g.lodestone)}`);
    if (g.combo > 1) tags.push(`x${g.combo} combo`);
    $("combo").textContent = tags.join(" · ");
    const waveText = g.betweenWaves && g.wave > 0 ? "wave cleared" : `wave ${g.wave}`;
    $("wave").textContent = `${waveText} · ${g.diff.label}`;
  } else {  // practice: a recoil-flight odometer instead of a score
    $("score").textContent = `${Math.round(g.dist / 48)}m`;
    $("combo").textContent = "";
    $("wave").textContent = "practice · esc exits";
  }
}

// ---------- main loop ----------

function update(g, dt) {
  const p = g.player;
  p.aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  if (mouse.down) tryFire(g);

  updatePlayer(p, dt, () => Audio_.play("bounce"));
  g.dist += len(p.vx, p.vy) * dt;
  g.trail.push({ x: p.x, y: p.y });
  if (g.trail.length > 18) g.trail.shift();

  updateBullets(g.bullets, dt);
  g.lodestone = Math.max(0, g.lodestone - dt);
  const mercy = p.ammo <= g.diff.attractAt && g.bullets.length === 0;
  updateCasings(g.casings, p, dt, g.lodestone > 0 ? LODESTONE_CRAWL : mercy ? 70 : 0);

  const events = [];
  updateEnemies(g.enemies, g.casings, p, dt, events);
  for (const ev of events) {
    if (ev.type === "eat") { Audio_.play("eat"); burst(g, ev.x, ev.y, "#b07cff", 6, 150); }
    if (ev.type === "shoot") { g.eshots.push(makeEnemyShot(ev.x, ev.y, ev.a)); Audio_.play("eshoot"); }
  }
  updateEnemyShots(g.eshots, dt);

  updatePickups(g.pickups, p, dt, events);
  for (const ev of events) {
    if (ev.type === "collect") applyPickup(g, ev.kind, ev.x, ev.y);
  }

  updateSpawns(g, dt);
  updateParticles(g.particles, dt);
  updateFloaters(g.floaters, dt);
  collide(g);

  g.comboTimer -= dt;
  if (g.comboTimer <= 0 && g.combo > 1) g.combo = 1;
  g.shake = Math.max(0, g.shake - dt * 3);

  // wave pacing
  if (g.diff.enemies && g.enemies.length === 0 && g.spawns.length === 0) {
    if (!g.betweenWaves) {
      g.betweenWaves = true;
      g.waveTimer = 2.2;
      if (g.wave > 0) rollWaveDrop(g);
    }
    g.waveTimer -= dt;
    if (g.waveTimer <= 0) { g.betweenWaves = false; queueWave(g); }
  }

  sweepDead(g.bullets);
  sweepDead(g.casings);
  sweepDead(g.enemies);
  sweepDead(g.eshots);
  sweepDead(g.pickups);
  sweepDead(g.particles);
  sweepDead(g.floaters);
  updateHud(g);
}

function frame(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000 || 0.016);
  lastTime = time;
  elapsed += dt;
  if (state === "playing") update(game, dt);
  if (game) render(ctx, game, elapsed);
  else drawArena(ctx, elapsed);
  requestAnimationFrame(frame);
}

$("title-best").textContent = bestLine();
Scores.refresh();  // fire-and-forget probe; offline hosting just stays local
requestAnimationFrame(frame);
