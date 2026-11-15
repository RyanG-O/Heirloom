// Smoke-test the Gemini routes against fixtures. Server must be running on :8787.
// Usage: node server/scripts/test-gemini.mjs [turns|reports|edge|all]
import { readFileSync } from "node:fs";

const BASE = process.env.API ?? "http://localhost:8787";
const fx = (name) => JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8"));
const post = async (path, body) => {
  const t0 = Date.now();
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, ms: Date.now() - t0, json: await r.json() };
};
const mode = process.argv[2] ?? "all";

if (mode === "turns" || mode === "all") {
  const s = fx("session.call-ba-ngoai.json");
  const ref = new Map(s.analyses.map((a) => [a.turnId, a]));
  console.log("== analyze-turn (call-ba-ngoai)");
  for (const [i, turn] of s.turns.entries()) {
    if (turn.speaker !== "user") continue;
    const { ms, json } = await post("/api/analyze-turn", { turn, context: s.turns.slice(Math.max(0, i - 4), i), scenarioId: s.scenarioId });
    const got = json.spans.map((x) => `${x.english}→${x.vietnamese}`).join(", ") || "-";
    const exp = (ref.get(turn.id)?.spans ?? []).map((x) => `${x.english}→${x.vietnamese}`).join(", ") || "-";
    console.log(`${String(ms).padStart(5)}ms  "${turn.text}"\n         got: ${got}  (ratio ${json.vietnameseRatio})\n         ref: ${exp}\n         full: ${json.fullVietnamese}`);
  }
}

if (mode === "reports" || mode === "all") {
  for (const id of ["call-ba-ngoai", "order-pho", "tell-parents-news"]) {
    const { status, ms, json } = await post("/api/report", { session: fx(`session.${id}.json`) });
    console.log(`\n== report ${id}: ${status} in ${ms}ms`);
    console.log(JSON.stringify(json, null, 2));
  }
}

if (mode === "edge" || mode === "all") {
  console.log("\n== edge cases");
  const turn = (text) => ({ id: "e1", speaker: "user", text, t: 0 });
  for (const text of ["Dạ con ăn rồi, con nhớ Ngoại lắm.", "I have so much homework to do this week, grandma.", ""]) {
    const r = await post("/api/analyze-turn", { turn: turn(text), context: [], scenarioId: "call-ba-ngoai" });
    console.log(`analyze ${JSON.stringify(text)}: ${r.status} ${r.ms}ms`, JSON.stringify(r.json));
  }
  const r1 = await post("/api/analyze-turn", { nope: 1 });
  console.log("analyze bad body:", r1.status, JSON.stringify(r1.json));
  const r2 = await post("/api/report", { session: { id: "x", scenarioId: "order-pho", startedAt: "", turns: [] } });
  console.log("report empty turns:", r2.status, r2.ms + "ms", JSON.stringify(r2.json));
  const r3 = await post("/api/report", { session: { id: "x", scenarioId: "bogus", startedAt: "", turns: [{ id: "a", speaker: "agent", text: "[happy] Chào con!", t: 0 }, { id: "b", speaker: "user", text: "Hi, I don't know how to say anything.", t: 1 }] } });
  console.log("report English-only, unknown scenario:", r3.status, r3.ms + "ms", JSON.stringify(r3.json));
}
