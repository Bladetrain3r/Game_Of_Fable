#!/usr/bin/env python3
"""DRYFIRE high score servlet. Stdlib only, one file, no state but the file.

Usage:  python3 hiscore_server.py [port] [scorefile]
        defaults: port 8002, ./hiscores.txt

Run it with the score file inside the static web root so the game client can
fetch the board as a plain file. The servlet creates the file if it's absent,
so a daily `rm` from cron simply resets the board.

File format (one entry per line, highest first, human-readable):
    SCORE INITIALS DIFFICULTY

API:
    GET  /board   -> {"ok": true, "board": [...]}          (creates file)
    POST /score   <- {"initials": "AAA", "score": 123, "diff": "hard"}
                  -> {"ok": true, "qualified": bool, "rank": int|null, "board": [...]}
                  200 with qualified=false for valid scores that miss the cut.
"""
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
FILE = sys.argv[2] if len(sys.argv) > 2 else "hiscores.txt"
MAX_ENTRIES = 10
MAX_SCORE = 99_999_999
MAX_BODY = 4096
INITIALS_RE = re.compile(r"^[A-Z0-9]{1,3}$")
DIFFICULTIES = {"easy", "normal", "hard", "suicidal", "daily"}


def load():
    if not os.path.exists(FILE):
        save([])
        return []
    board = []
    with open(FILE, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2 and parts[0].isdigit() and INITIALS_RE.match(parts[1]):
                diff = parts[2] if len(parts) > 2 and parts[2] in DIFFICULTIES else "?"
                board.append({"score": int(parts[0]), "initials": parts[1], "diff": diff})
    board.sort(key=lambda e: -e["score"])
    return board[:MAX_ENTRIES]


def save(board):
    with open(FILE, "w", encoding="utf-8") as f:
        for e in board:
            f.write(f"{e['score']} {e['initials']} {e['diff']}\n")


class Handler(BaseHTTPRequestHandler):
    def _reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # CORS preflight: the game runs on the same host, different port
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        self._reply(200, {"ok": True, "board": load()})

    def do_POST(self):
        try:
            length = min(int(self.headers.get("Content-Length", 0)), MAX_BODY)
            data = json.loads(self.rfile.read(length))
            score = int(data["score"])
            initials = str(data["initials"]).strip().upper()
            diff = str(data.get("diff", "")).strip().lower()
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            return self._reply(400, {"ok": False, "error": "bad payload"})
        if not (0 < score <= MAX_SCORE) or not INITIALS_RE.match(initials) \
                or diff not in DIFFICULTIES:
            return self._reply(400, {"ok": False, "error": "invalid entry"})

        board = load()
        entry = {"score": score, "initials": initials, "diff": diff}
        board.append(entry)
        board.sort(key=lambda e: -e["score"])  # stable: ties keep the incumbent ahead
        board = board[:MAX_ENTRIES]
        qualified = entry in board
        if qualified:
            save(board)
        rank = board.index(entry) + 1 if qualified else None
        self._reply(200, {"ok": True, "qualified": qualified, "rank": rank, "board": board})

    def log_message(self, *args):  # quiet; this sits behind an ALB health check
        pass


if __name__ == "__main__":
    print(f"DRYFIRE hiscore servlet on :{PORT}, file: {FILE}")
    HTTPServer(("", PORT), Handler).serve_forever()
