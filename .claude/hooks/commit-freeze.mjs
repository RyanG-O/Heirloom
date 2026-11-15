#!/usr/bin/env node
// SanD Hacks commit-window guard.
// Rule: no commits before Sat 11/14 10:30 AM PST or after Sun 11/15 12:00 PM PST -> disqualification.
//
// Used two ways:
//   1. Claude Code PreToolUse hook (Bash): reads hook JSON on stdin, blocks `git commit` / `git push`.
//   2. Git hook (.githooks/pre-commit, pre-push): `node commit-freeze.mjs --git`.
// Exit code 2 = block (Claude Code shows stderr to the model); git treats any non-zero as abort.

const START = Date.parse("2026-11-14T18:30:00Z"); // Sat 10:30 AM PST
const END = Date.parse("2026-11-15T20:00:00Z"); // Sun 12:00 PM PST
const WARN_MS = 30 * 60 * 1000;

const now = Date.now();
const fmt = (ms) => new Date(ms).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";

function check(label) {
  if (now < START || now >= END) {
    console.error(
      `BLOCKED by commit-freeze: ${label} at ${fmt(now)} is outside the SanD Hacks commit window ` +
        `(${fmt(START)} to ${fmt(END)}). Committing outside it means disqualification. Do not retry or bypass this.`,
    );
    process.exit(2);
  }
  if (END - now < WARN_MS) {
    console.error(`commit-freeze: ${Math.ceil((END - now) / 60000)} min until the noon PT code freeze.`);
  }
  process.exit(0);
}

if (process.argv.includes("--git")) check("git operation");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }
  if (/\bgit\b[^|;&]*\b(commit|push|merge|rebase|cherry-pick|am)\b/.test(cmd)) check("this git command");
  process.exit(0);
});
