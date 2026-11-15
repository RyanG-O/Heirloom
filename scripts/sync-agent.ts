// Push agent/prompt.md's system prompt (with the shared glossary injected) and LLM settings to the ElevenLabs agent.
// Usage: npm run sync-agent [-- --dry-run]
// In Claude cloud sessions, prefix with NODE_USE_ENV_PROXY=1 (Node fetch ignores HTTPS_PROXY otherwise).
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { GLOSSARY } from "../shared/glossary";
import { SCENARIOS, buildDynamicVariables, seededRandom } from "../shared/scenarios";

// Temperature trades accuracy against variety. 0.3 made every call sound the same; at 0.6, with the accuracy rules
// and glossary in the prompt, the agent still passes `npm run agent-eval` (see agent/prompt.md).
const TEMPERATURE = 0.6;
// Learners pause a long time while searching for a word; wait this many seconds before the agent re-engages.
const TURN_TIMEOUT = 15;
// Defaults for the dashboard's "Test AI agent" button (the app sends fresh values on every call).
const PLACEHOLDERS = buildDynamicVariables(SCENARIOS[0], seededRandom(1));

const root = new URL("../", import.meta.url);
config({ path: new URL(".env", root), quiet: true, override: true });
const key = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!key || !agentId) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env");

const md = readFileSync(new URL("agent/prompt.md", root), "utf8");
const template = md.split("## System prompt")[1]?.split("```")[1]?.trim();
if (!template) throw new Error("Could not find the ``` block under '## System prompt' in agent/prompt.md");
if (!template.includes("<<GLOSSARY>>")) throw new Error("agent/prompt.md is missing the <<GLOSSARY>> placeholder");
const glossary = GLOSSARY.map((e) => `${e.en[0]} = ${e.vi}`).join("\n");
const prompt = template.replace("<<GLOSSARY>>", glossary);

const url = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
const current = await fetch(url, { headers: { "xi-api-key": key } }).then((r) => r.json());
const before = current.conversation_config?.agent?.prompt ?? {};
const beforeVars = current.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders ?? {};
const beforeTimeout = current.conversation_config?.turn?.turn_timeout;
const varsSame = JSON.stringify(Object.keys(beforeVars).sort()) === JSON.stringify(Object.keys(PLACEHOLDERS).sort());
if (before.prompt === prompt && before.temperature === TEMPERATURE && varsSame && beforeTimeout === TURN_TIMEOUT) {
  console.log("Agent prompt and settings already up to date.");
  process.exit(0);
}
console.log(
  `Prompt ${before.prompt === prompt ? "unchanged" : `differs (${(before.prompt ?? "").length} → ${prompt.length} chars, ${GLOSSARY.length} glossary words)`}; ` +
    `temperature ${before.temperature} → ${TEMPERATURE}; turn timeout ${beforeTimeout} → ${TURN_TIMEOUT}s; ` +
    `dynamic variables ${varsSame ? "unchanged" : `→ ${Object.keys(PLACEHOLDERS).join(", ")}`}.`,
);
if (process.argv.includes("--dry-run")) process.exit(0);

const r = await fetch(url, {
  method: "PATCH",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    conversation_config: {
      agent: {
        prompt: { prompt, temperature: TEMPERATURE },
        dynamic_variables: { dynamic_variable_placeholders: PLACEHOLDERS },
      },
      turn: { turn_timeout: TURN_TIMEOUT },
    },
  }),
});
if (!r.ok) throw new Error(`PATCH failed ${r.status}: ${await r.text()}`);
console.log("Agent updated.");
