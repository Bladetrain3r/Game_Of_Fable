# Changelog

All notable changes to DRYFIRE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.3+ candidates

Feature complete as of v1.2 — these are nice-to-haves, weighed against
diluting the core.

- [ ] Additional enemy types
- [ ] Pickups
- [ ] Procedurally generated ambient music (low-tempo bliptune, WebAudio)

## [1.2.0] - 2026-06-10 — "The Leaderboard Update"

### Added

- Server-side high score board: top 10, stored as a human-readable plain text
  file (`SCORE INITIALS DIFFICULTY` per line) on the host
- `server/hiscore_server.py` — stdlib-only Python servlet (~100 lines) serving
  `GET /board` and `POST /score` on port 8002; recreates the score file if
  absent, so a daily cron wipe just resets the board
- Arcade-style initials entry (3 chars, A–Z/0–9) on death for qualifying
  scores; new entries are highlighted on the board
- Client probe order: static `hiscores.txt` fetch first, then the :8002
  listener as a self-healing fallback; on a fully static host the game
  silently stays in local-bests mode
- Server-side validation: initials format, score bounds, known difficulty;
  valid-but-not-qualifying scores get a 200 with `qualified: false`
- Practice runs (0× score) never prompt for the board

## [1.1.0] - 2026-06-10 — "The Difficulty Update"

### Added

- Difficulty system: ammo count, shell-attraction threshold, score multiplier,
  and enemy HP are per-run settings driven by a single difficulty table
- Difficulty select on the title screen, with number-key shortcuts (`1`–`5`)
- **Practice** — 16 shots, no enemies, no score; a recoil-flight sandbox with
  a distance odometer instead of a score
- **Easy** — 12 shots, shells start crawling home at 1 round remaining,
  0.5× score
- **Normal** — the v1.0 game, unchanged. 1× score
- **Hard** — 6 shots, 1.5× score
- **Suicidal** — 4 shots, all enemies +1 HP, 1.5× score
- Per-difficulty best scores (an existing v1.0 best carries over as the
  Normal best)
- `Esc` returns to the title screen from play, pause, or death
- HUD shows the current difficulty; the death screen reports it with the score

### Changed

- Starting a run is now an explicit difficulty pick rather than
  click-anywhere (clicking the death screen still replays the same difficulty)
- A brief grace period after death swallows frantic clicks so you can't
  accidentally instant-restart

## [1.0.0] - 2026-06-10

### Added

- DRYFIRE: a top-down arena shooter where recoil is the only means of
  locomotion and the world contains exactly 8 bullets, forever
- Conserved ammo economy: every shot ejects a casing; skating over spent
  brass is the only way to reload
- Three enemies: drifters (wobbling chasers), magnets (steal casings off the
  floor, refund them all on death), mass (slow 4-HP tanks)
- Anti-softlock valves: shells crawl home when the mag is empty; getting hit
  knocks the player flying
- Combo system (up to ×8) with a 50% HOT bonus for high-speed kills
- Wave spawner with telegraphed spawn points and per-wave enemy scaling
- Synthesized WebAudio sound effects, canvas-drawn visuals, zero assets,
  zero dependencies, zero build step
- Local best score, pause (`P`), mute (`M`)
