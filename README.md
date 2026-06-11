# DRYFIRE

*eight bullets, forever.*

A top-down arena shooter where **your gun is your only engine** and **the world
contains a fixed handful of bullets** — total, permanent, conserved.

**[Play it: open `index.html`. That's the whole install.]**
**Also available at: https://dryfire.zerofuchs.net:444/**

## The idea

Three rules, each of which fights the other two:

1. **There are no movement keys.** Every shot kicks you backwards. Recoil is
   locomotion. You aim where you *don't* want to go.
2. **Every shot ejects a casing onto the floor, and casings are the only ammo
   in the world.** Eight shells on Normal, conserved across the whole run.
   Skate over your spent brass to reload — which means shooting to survive
   propels you *away* from your own ammo supply.
3. **The purple squares don't want you. They want your brass.** Magnets vacuum
   casings off the floor and carry them around inside. Pop one and it refunds
   everything it swallowed. Your economy can be taken hostage.

Two pressure valves keep it fair instead of frustrating:

- **Empty mag?** Your shells slowly crawl home to you — slow enough to be
  terrifying, sure enough that you can never be soft-locked.
- **Pain is propulsion.** Getting hit costs a heart but launches you flying —
  sometimes straight through the brass you needed.

## Controls

| Input | Action |
|-------|--------|
| Mouse | Aim |
| Click / hold | Fire (and therefore: move) |
| `1`–`5` | Pick a difficulty from the menu |
| `P` | Pause |
| `M` | Mute |
| `Esc` | Back to the menu |

Kills chain into a combo (up to ×8). Kills made while moving fast pay a 50%
**HOT** bonus — the game pays you to stay reckless.

## Difficulties

Harder never means "less ammo appears" — it means the universe holds fewer
bullets. Conservation is sacred in every mode.

| Mode | Shells | Twist | Score |
|------|--------|-------|-------|
| Practice | 16 | No enemies; a recoil-flight sandbox with an odometer | — |
| Easy | 12 | Shells start crawling home at 1 round remaining | 0.5× |
| Normal | 8 | The real game | 1× |
| Hard | 6 | | 1.5× |
| Suicidal | 4 | All enemies +1 HP | 1.5× |

Best scores are tracked per difficulty.

## Enemies

- **Triangles (drifters)** — fast, wobbling chasers. Fodder that herds you.
- **Squares (magnets)** — ignore you, eat your casings, grow. Kill = full refund.
- **Hexagons (mass)** — slow, four hits, soak bullets and block lanes.
- **Pentagons (wardens)** — a frontal shield eats bullets. Kill from behind;
  its turn rate loses to a well-flown recoil arc.
- **Diamonds (shrikes)** — keep their distance and spit energy bolts after a
  visible wind-up. Bolts are not brass: never pickupable, gone on impact.

## High score board (optional)

The game is leaderboard-aware but never leaderboard-dependent. On boot it
looks for `hiscores.txt` on the same origin (falling back to a listener on
port `8002`); if neither exists, it quietly stays in local-bests mode and
nothing changes. When the board is live, dying with a qualifying score gets
you the classic three-initials prompt.

To host the board, run the stdlib-only servlet next to your static server:

```sh
python3 server/hiscore_server.py 8002 /path/to/webroot/hiscores.txt
```

- The score file is plain text (`SCORE INITIALS DIFFICULTY` per line) and is
  recreated if missing — a daily `rm` from cron resets the board.
- If the site is served over HTTPS, the `:8002` listener must be too (e.g.
  TLS-terminated at a load balancer), or browsers will block the call as
  mixed content.
- The servlet validates everything and answers `200` with
  `qualified: false` for honest scores that miss the cut.

## Pickups

Utility only — **no pickup ever creates ammo.** HOT kills can drop one where
the body fell; wave clears can drop one somewhere awkward. Two on the floor
max, and they expire if ignored.

- **Lodestone** (cyan ring) — for 5 seconds every floor shell sprints to you.
- **Overpressure** (white star) — next shot pierces everything (shields
  included) and kicks nearly twice as hard. Watch the barrel glow.
- **Patch kit** (red cross) — one heart back. Rare, wave-clear only.

## Running it

It's a static site with zero dependencies and zero build step:

```sh
# any of these:
open index.html                    # works straight from file://
python3 -m http.server             # or any static server
# or push to GitHub Pages and point it at the repo root
```

## Construction

Built Magic Launcher style:

- **No frameworks, no libraries, no build, no assets.** Vanilla JS, Canvas 2D,
  WebAudio (every sound is synthesized at runtime), CSS for the menus.
- **Every file under 500 lines** (largest is `js/main.js` at ~300).
- **Composition over inheritance:** entities are plain objects made by factory
  functions; behavior lives in small update systems that operate on them.
  There is not a single `class` in the codebase.

| File | Role |
|------|------|
| `index.html` | Shell, HUD, title/death/pause screens |
| `style.css` | Theme |
| `js/audio.js` | Synthesized SFX (WebAudio, no files) |
| `js/entities.js` | Factories + update systems (physics, AI, conservation) |
| `js/render.js` | Pure draw functions |
| `js/main.js` | Game state, input, firing, collisions, waves |
