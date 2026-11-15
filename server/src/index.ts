import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import express from "express";
import type {
  ApiError,
  ConversationTokenResponse,
  SignedUrlResponse,
} from "../../shared/types";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const app = express();
app.use(express.json({ limit: "2mb" }));

const ELEVEN = "https://api.elevenlabs.io/v1/convai/conversation";
const env = (k: string) => process.env[k]?.trim() || undefined;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    elevenlabs: Boolean(env("ELEVENLABS_API_KEY") && env("ELEVENLABS_AGENT_ID")),
    gemini: Boolean(env("GEMINI_API_KEY")),
    geminiModel: env("GEMINI_MODEL") ?? null,
  });
});

async function elevenGet(path: "token" | "get-signed-url") {
  const key = env("ELEVENLABS_API_KEY");
  const agentId = env("ELEVENLABS_AGENT_ID");
  if (!key || !agentId) throw new Error("ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID not set in .env");
  const r = await fetch(`${ELEVEN}/${path}?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { "xi-api-key": key },
  });
  if (!r.ok) throw new Error(`ElevenLabs ${path} ${r.status}: ${await r.text()}`);
  return (await r.json()) as Record<string, string>;
}

// WebRTC (preferred): client calls startSession({ conversationToken, connectionType: "webrtc" })
app.get("/api/conversation-token", async (_req, res) => {
  try {
    const j = await elevenGet("token");
    res.json({ token: j.token } satisfies ConversationTokenResponse);
  } catch (e) {
    res.status(500).json({ error: String(e) } satisfies ApiError);
  }
});

// WebSocket fallback: client calls startSession({ signedUrl })
app.get("/api/signed-url", async (_req, res) => {
  try {
    const j = await elevenGet("get-signed-url");
    res.json({ signedUrl: j.signed_url } satisfies SignedUrlResponse);
  } catch (e) {
    res.status(500).json({ error: String(e) } satisfies ApiError);
  }
});

// TODO(Session B): Gemini code-switch analysis. See .claude/skills/vi-codeswitch-analysis.
app.post("/api/analyze-turn", (_req, res) => {
  res.status(501).json({ error: "not implemented" } satisfies ApiError);
});

// TODO(Session B): Gemini learning report. See .claude/skills/vi-codeswitch-analysis.
app.post("/api/report", (_req, res) => {
  res.status(501).json({ error: "not implemented" } satisfies ApiError);
});

const port = Number(env("PORT") ?? 8787);
app.listen(port, () => console.log(`server listening on http://localhost:${port}`));
