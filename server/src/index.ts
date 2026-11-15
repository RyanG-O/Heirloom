import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import express from "express";
import type {
  AnalyzeTurnRequest,
  AnalyzeTurnResponse,
  ApiError,
  ConversationTokenResponse,
  ReportRequest,
  ReportResponse,
  SignedUrlResponse,
} from "../../shared/types";
import { analyzeTurn, emptyAnalysis, exhaustedModels, generateReport } from "./gemini";

// override: the repo .env wins over stale shell variables (e.g. an old ELEVENLABS_AGENT_ID)
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), override: true });

const app = express();
app.use(express.json({ limit: "2mb" }));

const ELEVEN = "https://api.elevenlabs.io/v1/convai/conversation";
const env = (k: string) => process.env[k]?.trim() || undefined;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    elevenlabs: Boolean(env("ELEVENLABS_API_KEY") && env("ELEVENLABS_AGENT_ID")),
    elevenlabsAgentId: env("ELEVENLABS_AGENT_ID") ?? null, // not secret; lets you confirm which agent the app uses
    gemini: Boolean(env("GEMINI_API_KEY")),
    geminiModel: env("GEMINI_MODEL") ?? null,
    geminiRateLimited: exhaustedModels(),
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

// Gemini: code-switch analysis for one user turn. Never fails mid-call: errors → empty analysis (200).
app.post("/api/analyze-turn", async (req, res) => {
  const body = req.body as Partial<AnalyzeTurnRequest>;
  const turn = body?.turn;
  if (!turn || typeof turn.text !== "string" || typeof turn.id !== "string") {
    res.status(400).json({ error: "body must be { turn: Turn, context: Turn[], scenarioId }" } satisfies ApiError);
    return;
  }
  const t0 = Date.now();
  try {
    const out = await analyzeTurn(turn, Array.isArray(body.context) ? body.context : [], String(body.scenarioId ?? ""));
    console.log(`[analyze-turn] ${Date.now() - t0}ms spans=${out.spans.length}`);
    res.json(out satisfies AnalyzeTurnResponse);
  } catch (e) {
    console.error(`[analyze-turn] failed after ${Date.now() - t0}ms:`, e);
    res.json(emptyAnalysis(turn) satisfies AnalyzeTurnResponse);
  }
});

// Gemini: end-of-session learning report. Errors → 502 so the client can offer Retry.
app.post("/api/report", async (req, res) => {
  const session = (req.body as Partial<ReportRequest>)?.session;
  if (!session || !Array.isArray(session.turns)) {
    res.status(400).json({ error: "body must be { session: Session }" } satisfies ApiError);
    return;
  }
  const t0 = Date.now();
  try {
    const report = await generateReport(session);
    console.log(`[report] ${Date.now() - t0}ms missingWords=${report.missingWords.length}`);
    res.json(report satisfies ReportResponse);
  } catch (e) {
    console.error(`[report] failed after ${Date.now() - t0}ms:`, e);
    res.status(502).json({ error: `Report generation failed: ${e instanceof Error ? e.message : String(e)}` } satisfies ApiError);
  }
});

const port = Number(env("PORT") ?? 8787);
app.listen(port, () => console.log(`server listening on http://localhost:${port}`));
