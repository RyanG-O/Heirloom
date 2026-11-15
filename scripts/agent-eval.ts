// Accuracy check for the ElevenLabs agent's recasts: sends tricky mixed English/Vietnamese utterances
// (agent/eval-cases.json) as single-turn response tests and checks the reply with regexes.
// Usage: npx tsx scripts/agent-eval.ts [--llm <model>] [--temp <n>] [--only <id,id>]
// Cloud sessions: prefix with NODE_USE_ENV_PROXY=1.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { getScenario } from "../shared/scenarios";

const root = new URL("../", import.meta.url);
config({ path: new URL(".env", root), quiet: true, override: true });
const key = process.env.ELEVENLABS_API_KEY!;
const agentId = process.env.ELEVENLABS_AGENT_ID!;
const API = "https://api.elevenlabs.io/v1/convai";
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);

type Case = { id: string; scenarioId: string; user: string; expect: string[]; reject?: string[] };
let cases: Case[] = JSON.parse(readFileSync(new URL("agent/eval-cases.json", root), "utf8"));
const only = arg("--only")?.split(",");
if (only) cases = cases.filter((c) => only.includes(c.id));

const api = async (path: string, init?: RequestInit) => {
  const r = await fetch(`${API}${path}`, { ...init, headers: { "xi-api-key": key, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r.json();
};

// Tests live in the ElevenLabs workspace; cache their ids locally (gitignored) keyed by case content.
const cacheUrl = new URL(".agent-eval-cache.json", root);
const cache: Record<string, string> = existsSync(cacheUrl) ? JSON.parse(readFileSync(cacheUrl, "utf8")) : {};
const strip = (s: string) => s.replace(/\[[a-z ]+\]\s*/gi, "").replace(/\s{2,}/g, " ").trim();

for (const c of cases) {
  const k = `${c.id}:${c.user}`;
  if (cache[k]) continue;
  const s = getScenario(c.scenarioId)!;
  const { id } = await api("/agent-testing/create", {
    method: "POST",
    body: JSON.stringify({
      name: `heirloom-eval: ${c.id}`,
      type: "llm",
      chat_history: [
        { role: "agent", message: s.firstMessage, time_in_call_secs: 0 },
        { role: "user", message: c.user, time_in_call_secs: 4 },
      ],
      success_condition:
        "The agent replies in natural Vietnamese and accurately uses the Vietnamese equivalent of each English word the user used, without changing its meaning.",
      success_examples: [{ type: "success", response: "À, con muốn ăn gà chiên hả? Tiệm cô chỉ có phở thôi con." }],
      failure_examples: [{ type: "failure", response: "You should say that in Vietnamese." }],
      dynamic_variables: {
        persona: s.persona,
        situation: s.situation,
        agent_calls_user: s.agentCallsUser,
        user_calls_agent: s.userCallsAgent,
        first_message: s.firstMessage,
        target_vocab: s.targetVocab.map((v) => `${v.vi} (${v.en})`).join(", "),
      },
    }),
  });
  cache[k] = id;
  writeFileSync(cacheUrl, JSON.stringify(cache, null, 2));
}

const llm = arg("--llm");
const temp = arg("--temp");
const override =
  llm || temp
    ? {
        conversation_config: { agent: { prompt: { ...(llm ? { llm } : {}), ...(temp ? { temperature: Number(temp) } : {}) } } },
        platform_settings: {},
      }
    : undefined;

const t0 = Date.now();
const inv = await api(`/agents/${agentId}/run-tests`, {
  method: "POST",
  body: JSON.stringify({
    tests: cases.map((c) => ({ test_id: cache[`${c.id}:${c.user}`] })),
    ...(override ? { agent_config_override: override } : {}),
  }),
});
let res: any;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  res = await api(`/test-invocations/${inv.id}`);
  if (res.test_runs.every((r: any) => !["pending", "running"].includes(r.status))) break;
}
let pass = 0;
console.log(`\n=== agent eval  llm=${llm ?? "(agent default)"} temp=${temp ?? "(default)"}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
for (const c of cases) {
  const run = res.test_runs.find((r: any) => r.test_id === cache[`${c.id}:${c.user}`]);
  const reply = strip(
    (run?.agent_responses ?? [])
      .filter((m: any) => m.role === "agent" && m.message)
      .map((m: any) => m.message)
      .join(" "),
  );
  const missing = c.expect.filter((e) => !new RegExp(e, "i").test(reply));
  const bad = (c.reject ?? []).filter((e) => new RegExp(e, "i").test(reply));
  const ok = reply && !missing.length && !bad.length;
  if (ok) pass++;
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${c.id}\n  USER : ${c.user}\n  AGENT: ${reply || `(no reply; status ${run?.status})`}`);
  if (missing.length) console.log(`  missing: ${missing.join("  ;  ")}`);
  if (bad.length) console.log(`  should not contain: ${bad.join("  ;  ")}`);
}
console.log(`\n${pass}/${cases.length} passed`);
