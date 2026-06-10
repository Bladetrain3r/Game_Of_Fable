# Changelog

All notable changes to DRYFIRE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.1 "The Difficulty Update"

### Planned

- [ ] Difficulty system: gameplay constants (`TOTAL_AMMO`, shell-attraction
      threshold, score multiplier, enemy HP) become per-run settings driven by
      a single difficulty table
- [ ] Difficulty select on the title screen (replaces click-anywhere-to-start)
- [ ] **Practice** — 16 shots, no enemies, no score; a recoil-flight sandbox
- [ ] **Easy** — 12 shots, shells start crawling home at 1 round remaining,
      0.5× score
- [ ] **Normal** — the v1.0 game, unchanged. 1× score
- [ ] **Hard** — 6 shots, 1.5× score
- [ ] **Suicidal** — 4 shots, all enemies +1 HP
- [ ] Per-difficulty best scores (v1.0 best carries over as the Normal best)
- [ ] `Esc` returns to the title screen (so you can leave Practice, or switch
      difficulty after death)
- [ ] HUD shows current difficulty; death screen reports it with the score

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
