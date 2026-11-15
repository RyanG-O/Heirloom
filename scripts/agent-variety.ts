// Measures how repetitive the agent is: runs several simulated multi-turn calls (ElevenLabs agent-testing)
// with a simulated weak-Vietnamese learner, then reports formula metrics within and across calls.
// Usage: npx tsx scripts/agent-variety.ts [--baseline] [--temp <n>] [--runs <n>] [--turns <n>]
//   --baseline  send the old fixed dynamic variables (same opener and checklist every call)
// Cloud sessions: prefix with NODE_USE_ENV_PROXY=1.
import { config } from "dotenv";
import { SCENARIOS, getScenario, buildDynamicVariables, seededRandom } from "../shared/scenarios";

const root = new URL("../", import.meta.url);
config({ path: new URL(".env", root), quiet: true, override: true });
const key = process.env.ELEVENLABS_API_KEY!;
const agentId = process.env.ELEVENLABS_AGENT_ID!;
const API = "https://api.elevenlabs.io/v1/convai";
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const baseline = process.argv.includes("--baseline");
const runsPerScenario = Number(arg("--runs") ?? 3);
const maxTurns = Number(arg("--turns") ?? 8);
const temp = arg("--temp");

const api = async (path: string, init?: RequestInit) => {
  const r = await fetch(`${API}${path}`, { ...init, headers: { "xi-api-key": key, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r.status === 204 ? {} : r.json();
};
const strip = (s: string) => s.replace(/\[[a-z ]+\]\s*/gi, "").replace(/\s{2,}/g, " ").trim();

const SETTING: Record<string, string> = {
  "call-ba-ngoai": "You are on a phone call with your grandmother (Ngoại), who lives far away.",
  "order-pho": "You just walked into a Vietnamese phở restaurant with 2 family members and are ordering from the owner (Cô Lan). Order food and drinks like a normal customer.",
  "tell-parents-news": "You are talking with your mom (Mẹ). You just got an internship offer in another city and want to tell her.",
};
const LEARNER = `You are a 20-year-old Vietnamese American college student. Your Vietnamese is weak but you try: speak mostly simple Vietnamese, use English for 1–2 words per reply when you don't know them, and keep replies to 1 short sentence. Answer what you are asked, sometimes briefly ("Dạ.", "Dạ không."), sometimes with a small detail about your life (classes, roommate, food, work, friends). Never ask more than one question in the whole call.`;

const plan: { scenarioId: string; seed: number }[] = [];
for (const id of ["call-ba-ngoai", "order-pho"]) for (let i = 0; i < runsPerScenario; i++) plan.push({ scenarioId: id, seed: 1000 + i * 7 });

const created: string[] = [];
for (const p of plan) {
  const s = getScenario(p.scenarioId)!;
  const vars = baseline
    ? {
        persona: s.persona,
        situation: s.situation,
        agent_calls_user: s.agentCallsUser,
        user_calls_agent: s.userCallsAgent,
        first_message: s.firstMessage,
        target_vocab: s.targetVocab.map((v) => `${v.vi} (${v.en})`).join(", "),
        topics: "",
        persona_news: "",
      }
    : buildDynamicVariables(s, seededRandom(p.seed));
  const { id } = await api("/agent-testing/create", {
    method: "POST",
    body: JSON.stringify({
      name: `heirloom-variety: ${p.scenarioId} #${p.seed}`,
      type: "simulation",
      simulation_scenario: `${SETTING[p.scenarioId] ?? ""} ${LEARNER}`,
      simulation_max_turns: maxTurns,
      simulated_user_model: "gemini-3.5-flash",
      success_conditions: ["The agent speaks mostly Vietnamese and stays in character."],
      dynamic_variables: vars,
      chat_history: [],
    }),
  });
  created.push(id);
}

const override = temp ? { conversation_config: { agent: { prompt: { temperature: Number(temp) } } }, platform_settings: {} } : undefined;
const inv = await api(`/agents/${agentId}/run-tests`, {
  method: "POST",
  body: JSON.stringify({ tests: created.map((test_id) => ({ test_id })), ...(override ? { agent_config_override: override } : {}) }),
});
let res: any;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  res = await api(`/test-invocations/${inv.id}`);
  if (res.test_runs.every((r: any) => !["pending", "running"].includes(r.status))) break;
}
// Clean up the throwaway tests.
await Promise.all(created.map((id) => api(`/agent-testing/${id}`, { method: "DELETE" }).catch(() => {})));

const TOPICS: [string, RegExp][] = [
  ["eat", /ăn cơm chưa|ăn gì chưa|ăn uống/i],
  ["school", /trường|học|lớp|thi/i],
  ["visit", /về thăm|chừng nào con về|khi nào con về/i],
  ["sleep", /ngủ|thức khuya/i],
  ["health", /khỏe|bệnh/i],
  ["size", /tô lớn|tô nhỏ/i],
  ["herbs", /rau thơm|giá|ngò/i],
  ["drink", /uống gì|trà đá|cà phê/i],
  ["bill", /tính tiền/i],
];
const firstWord = (t: string) => (t.match(/^[\p{L}]+/u)?.[0] ?? "").toLowerCase();

let all: string[] = [];
const firstMsgs: string[] = [];
const sequences: string[] = [];
let praise = 0;
let calls = 0;
for (const [i, run] of res.test_runs.entries()) {
  const msgs = (run.agent_responses ?? []).filter((m: any) => m.message).map((m: any) => ({ role: m.role, text: strip(m.message) }));
  const agent = msgs.filter((m: any) => m.role === "agent").map((m: any) => m.text);
  if (!agent.length) {
    console.log(`run ${i}: no transcript (status ${run.status})`);
    continue;
  }
  calls++;
  firstMsgs.push(agent[0]);
  const replies = agent.slice(1);
  all = all.concat(replies);
  praise += replies.join(" ").match(/giỏi quá|giỏi ghê|ngon quá ta|giỏi quá ta/gi)?.length ?? 0;
  const seq: string[] = [];
  for (const r of agent) for (const [name, re] of TOPICS) if (re.test(r) && !seq.includes(name)) seq.push(name);
  sequences.push(`${plan[i]?.scenarioId}: ${seq.join(" → ")}`);
  console.log(`\n--- run ${i + 1} (${plan[i]?.scenarioId})`);
  for (const m of msgs) console.log(`${m.role === "agent" ? "AGENT" : "  user"}: ${m.text}`);
}
const n = all.length || 1;
const counts = new Map<string, number>();
for (const r of all) counts.set(firstWord(r), (counts.get(firstWord(r)) ?? 0) + 1);
const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
console.log(`\n=== variety metrics  ${baseline ? "BASELINE (fixed vars)" : "randomized vars"}  temp=${temp ?? "(agent default)"}  calls=${calls}  replies=${all.length}`);
console.log(`replies starting with "À": ${pct(counts.get("à") ?? 0)}`);
console.log(`top reply openers: ${top.map(([w, c]) => `${w || "(other)"} ${pct(c)}`).join(", ")}`);
console.log(`replies ending with a question: ${pct(all.filter((r) => /\?\s*$/.test(r)).length)}`);
console.log(`replies containing a "… hả?" echo: ${pct(all.filter((r) => /(?<!\p{L})hả(?!\p{L})/iu.test(r)).length)}`);
console.log(`replies with advice/nagging (ráng, đừng, nhớ … nha/nghe): ${pct(all.filter((r) => /(?<!\p{L})(ráng|đừng)(?!\p{L})|nhớ [^.?!]*(nha|nghe)/iu.test(r)).length)}`);
console.log(`avg reply length: ${(all.reduce((a, r) => a + r.split(/\s+/).length, 0) / n).toFixed(1)} words`);
console.log(`praise phrases per call: ${(praise / Math.max(calls, 1)).toFixed(1)}`);
console.log(`distinct first messages: ${new Set(firstMsgs).size}/${firstMsgs.length}`);
console.log(`topic order per call:\n  ${sequences.join("\n  ")}`);
