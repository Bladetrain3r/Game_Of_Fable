// DRYFIRE leaderboard client. The game must stay a pure static site:
// every network failure here degrades silently to local-bests-only mode.
"use strict";

const Scores = (() => {
  const FILE_URL = "hiscores.txt";   // same-origin static file, cheap check
  const API_PORT = 8002;             // same host, dedicated listener
  const MAX = 10;

  let enabled = false;
  let board = [];

  function apiBase() {
    if (!/^https?:$/.test(location.protocol)) return null;  // file:// etc: offline
    return `${location.protocol}//${location.hostname}:${API_PORT}`;
  }

  // File format: "SCORE INITIALS DIFF" per line, highest first.
  function parseText(text) {
    const out = [];
    for (const line of text.trim().split(/\n+/)) {
      const [score, initials, diff] = line.trim().split(/\s+/);
      const s = parseInt(score, 10);
      if (Number.isFinite(s) && s > 0 && initials) {
        out.push({ score: s, initials: initials.slice(0, 3).toUpperCase(), diff: diff || "?" });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, MAX);
  }

  async function refresh() {
    if (!apiBase()) return;  // file:// and friends: don't even ask
    try {
      const r = await fetch(FILE_URL, { cache: "no-store" });
      if (r.ok) {
        board = parseText(await r.text());
        enabled = true;
        return;
      }
    } catch (e) { /* fall through */ }
    // File missing (daily wipe?): asking the listener for the board recreates it.
    const base = apiBase();
    if (!base) return;
    try {
      const r = await fetch(`${base}/board`);
      if (r.ok) {
        board = ((await r.json()).board || []).slice(0, MAX);
        enabled = true;
      }
    } catch (e) { /* static-only hosting: stay disabled */ }
  }

  function qualifies(score) {
    if (!enabled || score <= 0) return false;
    return board.length < MAX || score > board[board.length - 1].score;
  }

  async function submit(initials, score, diff) {
    const base = apiBase();
    if (!base) return { ok: false };
    try {
      const r = await fetch(`${base}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials, score, diff }),
      });
      if (!r.ok) return { ok: false };
      const data = await r.json();
      if (data.board) board = data.board.slice(0, MAX);
      return { ok: true, qualified: !!data.qualified, rank: data.rank };
    } catch (e) {
      return { ok: false };
    }
  }

  return {
    refresh, qualifies, submit,
    get enabled() { return enabled; },
    get board() { return board; },
  };
})();
