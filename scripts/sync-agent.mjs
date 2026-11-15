// Push agent/prompt.md's system prompt to the ElevenLabs agent in .env (ELEVENLABS_AGENT_ID).
// Usage: node scripts/sync-agent.mjs [--dry-run]
// In Claude cloud sessions, prefix with NODE_USE_ENV_PROXY=1 (Node fetch ignores HTTPS_PROXY otherwise).
import { readFileSync } from "node:fs";
import { config } from "dotenv";

const root = new URL("../", import.meta.url);
config({ path: new URL(".env", root), quiet: true });
const key = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!key || !agentId) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env");

const md = readFileSync(new URL("agent/prompt.md", root), "utf8");
const prompt = md.split("## System prompt")[1]?.split("```")[1]?.trim();
if (!prompt) throw new Error("Could not find the ``` block under '## System prompt' in agent/prompt.md");

const url = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
const current = await fetch(url, { headers: { "xi-api-key": key } }).then((r) => r.json());
const before = current.conversation_config?.agent?.prompt?.prompt ?? "";
if (before === prompt) {
  console.log("Agent prompt already up to date.");
  process.exit(0);
}
console.log(`Prompt differs (${before.length} → ${prompt.length} chars).`);
if (process.argv.includes("--dry-run")) process.exit(0);

const r = await fetch(url, {
  method: "PATCH",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({ conversation_config: { agent: { prompt: { prompt } } } }),
});
if (!r.ok) throw new Error(`PATCH failed ${r.status}: ${await r.text()}`);
console.log("Agent prompt updated.");
