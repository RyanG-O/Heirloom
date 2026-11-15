// Push agent/prompt.md's system prompt (with the shared glossary injected) and LLM settings to the ElevenLabs agent.
// Usage: npm run sync-agent [-- --dry-run]
// In Claude cloud sessions, prefix with NODE_USE_ENV_PROXY=1 (Node fetch ignores HTTPS_PROXY otherwise).
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { GLOSSARY } from "../shared/glossary";

// Low temperature: the agent's recasts must be accurate and repeatable ("fried chicken" must not become "cơm gà chiên").
const TEMPERATURE = 0.3;

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
if (before.prompt === prompt && before.temperature === TEMPERATURE) {
  console.log("Agent prompt and settings already up to date.");
  process.exit(0);
}
console.log(
  `Prompt ${before.prompt === prompt ? "unchanged" : `differs (${(before.prompt ?? "").length} → ${prompt.length} chars, ${GLOSSARY.length} glossary words)`}; temperature ${before.temperature} → ${TEMPERATURE}.`,
);
if (process.argv.includes("--dry-run")) process.exit(0);

const r = await fetch(url, {
  method: "PATCH",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({ conversation_config: { agent: { prompt: { prompt, temperature: TEMPERATURE } } } }),
});
if (!r.ok) throw new Error(`PATCH failed ${r.status}: ${await r.text()}`);
console.log("Agent updated.");
