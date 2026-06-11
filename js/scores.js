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

// ---------- board UI (death screen) ----------
// References main.js globals (game, state) at call time only.

const byId = (id) => document.getElementById(id);

function renderBoard(highlight) {
  const el = byId("board");
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
  byId("entry").classList.add("hidden");
  byId("board").classList.add("hidden");
  await Scores.refresh();
  if (state !== "dead" || game !== g) return;  // player already moved on
  if (!Scores.enabled) return;
  renderBoard(null);
  if (g.diff.scoreMult > 0 && Scores.qualifies(g.score)) {
    byId("entry-msg").textContent = "you made the board — initials?";
    const input = byId("initials");
    input.value = "";
    input.disabled = false;
    byId("entry").classList.remove("hidden");
    input.focus();
  }
}

const initialsInput = byId("initials");
initialsInput.addEventListener("input", () => {
  initialsInput.value = initialsInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
});
initialsInput.addEventListener("keydown", async (ev) => {
  ev.stopPropagation();  // typing must not trigger global shortcuts (1-6 restarts!)
  if (ev.key === "Escape") { byId("entry").classList.add("hidden"); return; }
  if (ev.key !== "Enter" || initialsInput.value.length === 0 || !game) return;
  const g = game;
  initialsInput.disabled = true;
  byId("entry-msg").textContent = "etching it in...";
  const res = await Scores.submit(initialsInput.value, g.score, g.diffKey);
  if (state !== "dead" || game !== g) return;
  byId("entry").classList.add("hidden");
  if (res.ok) {
    renderBoard(res.qualified ? { initials: initialsInput.value, score: g.score } : null);
    if (res.qualified) Audio_.play("refund");
    byId("death-best").textContent += res.qualified
      ? ` · board #${res.rank}` : " · sniped off the board";
  } else {
    byId("death-best").textContent += " · board unreachable";
  }
});
