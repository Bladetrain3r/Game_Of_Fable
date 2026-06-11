// DRYFIRE renderer — pure draw functions over a 2D canvas. Reads state, never mutates it.
"use strict";

function drawArena(ctx, t) {
  ctx.fillStyle = "#07090e";
  ctx.fillRect(0, 0, W, H);

  // faint drifting grid so velocity is legible
  ctx.strokeStyle = "rgba(83, 224, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = WALL; x <= W - WALL; x += 48) { ctx.moveTo(x, WALL); ctx.lineTo(x, H - WALL); }
  for (let y = WALL; y <= H - WALL; y += 48) { ctx.moveTo(WALL, y); ctx.lineTo(W - WALL, y); }
  ctx.stroke();

  ctx.strokeStyle = "rgba(83, 224, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
}

function drawCasings(ctx, casings, playerEmpty, t) {
  for (const c of casings) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.settled ? c.spin : c.spin + t * 2);
    const pulse = c.settled ? 0.7 + 0.3 * Math.sin(t * 5 + c.spin * 7) : 1;
    ctx.shadowColor = "#ffc843";
    ctx.shadowBlur = playerEmpty && c.settled ? 18 : 8;
    ctx.fillStyle = `rgba(255, 200, 67, ${pulse})`;
    ctx.fillRect(-5, -3, 10, 6);
    ctx.fillStyle = "rgba(255, 240, 180, 0.9)";
    ctx.fillRect(3, -3, 2, 6);
    ctx.restore();
  }
}

function drawBullets(ctx, bullets) {
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 12;
  for (const b of bullets) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-12, -2, 16, 4);   // tracer streak
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function polygon(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawEnemies(ctx, enemies, t) {
  for (const e of enemies) {
    const flash = e.hitFlash > 0;
    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = flash ? "#ffffff" : e.color;

    if (e.kind === "drifter") {
      const a = Math.atan2(e.vy, e.vx);
      polygon(ctx, e.x, e.y, e.r + 3, 3, a);
      ctx.fill();
    } else if (e.kind === "warden") {
      polygon(ctx, e.x, e.y, e.r, 5, e.facing);
      ctx.fill();
      ctx.strokeStyle = flash ? "#ffffff" : "#b8ffd2";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 7, e.facing - SHIELD_ARC, e.facing + SHIELD_ARC);
      ctx.stroke();
    } else if (e.kind === "shrike") {
      const a = Math.atan2(e.vy, e.vx);
      polygon(ctx, e.x, e.y, e.r, 4, a);
      ctx.fill();
      if (e.windup > 0) {  // telegraph: a tightening ring before each bolt
        ctx.strokeStyle = "#ff4fd8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 14 * e.windup / 0.45 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === "magnet") {
      polygon(ctx, e.x, e.y, e.r, 4, t * 1.5 + e.wobble);
      ctx.fill();
      if (e.eaten > 0) {  // show the hostages rattling inside
        ctx.fillStyle = "#ffc843";
        ctx.shadowColor = "#ffc843";
        for (let i = 0; i < Math.min(e.eaten, 6); i++) {
          const a = (i / 6) * Math.PI * 2 + t * 3;
          ctx.fillRect(e.x + Math.cos(a) * e.r * 0.45 - 2, e.y + Math.sin(a) * e.r * 0.45 - 2, 4, 4);
        }
      }
    } else { // mass
      polygon(ctx, e.x, e.y, e.r, 6, e.wobble * 0.1);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      polygon(ctx, e.x, e.y, e.r * (1 - e.hp / e.maxHp) * 0.8, 6, e.wobble * 0.1);
      ctx.fill();  // damage shows as a growing dark core
    }
    ctx.restore();
  }
}

// Enemy bolts: round magenta energy with a short tail. Deliberately nothing
// like brass — these are never pickups.
function drawEnemyShots(ctx, shots) {
  for (const s of shots) {
    ctx.save();
    ctx.shadowColor = "#ff4fd8";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(255, 79, 216, 0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.fillStyle = "#ff8fe8";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, p, t) {
  if (p.iframes > 0 && Math.floor(t * 20) % 2 === 0) return;  // hurt blink
  const kick = p.recoilKick * 6;
  ctx.save();
  ctx.translate(p.x - Math.cos(p.aim) * kick, p.y - Math.sin(p.aim) * kick);
  ctx.rotate(p.aim);
  ctx.shadowColor = "#53e0ff";
  ctx.shadowBlur = 16;
  // chevron body
  ctx.fillStyle = "#53e0ff";
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-5, 0); ctx.lineTo(-10, -9);
  ctx.closePath();
  ctx.fill();
  // barrel
  ctx.fillStyle = p.ammo > 0 ? "#ffc843" : "#5a6577";
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();

  if (p.recoilKick > 0.5) {  // muzzle flash
    ctx.save();
    ctx.translate(p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24);
    ctx.fillStyle = "rgba(255, 240, 180, 0.9)";
    ctx.shadowColor = "#ffc843";
    ctx.shadowBlur = 20;
    polygon(ctx, 0, 0, 9 * p.recoilKick, 4, t * 30);
    ctx.fill();
    ctx.restore();
  }
}

function drawSpawns(ctx, spawns, t) {
  for (const s of spawns) {
    const k = 1 - s.timer / s.total;
    ctx.strokeStyle = `rgba(255, 79, 109, ${0.3 + 0.7 * k})`;
    ctx.lineWidth = 2;
    polygon(ctx, s.x, s.y, 22 * (1 - k) + 8, 3, t * 4);
    ctx.stroke();
  }
}

function drawParticles(ctx, particles) {
  for (const pt of particles) {
    const a = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = a;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, floaters) {
  ctx.font = "bold 15px 'Courier New', monospace";
  ctx.textAlign = "center";
  for (const f of floaters) {
    ctx.globalAlpha = f.life / f.maxLife;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawTrail(ctx, trail) {
  for (let i = 0; i < trail.length; i++) {
    const a = (i / trail.length) * 0.25;
    ctx.fillStyle = `rgba(83, 224, 255, ${a})`;
    const r = 2 + (i / trail.length) * 6;
    ctx.fillRect(trail[i].x - r / 2, trail[i].y - r / 2, r, r);
  }
}

function render(ctx, g, t) {
  ctx.save();
  if (g.shake > 0) {
    ctx.translate(rand(-1, 1) * g.shake * 8, rand(-1, 1) * g.shake * 8);
  }
  drawArena(ctx, t);
  drawTrail(ctx, g.trail);
  drawCasings(ctx, g.casings, g.player.ammo === 0, t);
  drawSpawns(ctx, g.spawns, t);
  drawEnemies(ctx, g.enemies, t);
  drawEnemyShots(ctx, g.eshots);
  drawBullets(ctx, g.bullets);
  drawPlayer(ctx, g.player, t);
  drawParticles(ctx, g.particles);
  drawFloaters(ctx, g.floaters);
  ctx.restore();
}
