---
name: elevenlabs-agent
description: Reference for integrating the ElevenLabs Conversational Agent in Heirloom (@elevenlabs/react v1 + server token routes). Use before writing or debugging any code that starts/ends a voice session, captures transcript messages, sends contextual updates to the agent, passes scenario dynamic variables, or edits agent/prompt.md.
---

# ElevenLabs Conversational Agent: Heirloom integration

Verified against the installed `@elevenlabs/react@1.22.x` / `@elevenlabs/client@1.36.x` type definitions. When unsure, read the types in
`node_modules/@elevenlabs/react/dist/conversation/*.d.ts` and `node_modules/@elevenlabs/client/dist/{types,BaseConversation}.d.ts` and `utils/BaseConnection.d.ts`. Don't rely on memory of the older `@11labs/react` (v0) API.

## v1 gotchas
- **`useConversation()` must be inside `<ConversationProvider>`.** This is already done in `client/src/main.tsx`. Without it, the hook throws.
- `startSession()` returns **void** (not a Promise in the React hook). Track connection via `status` / `onConnect` / `onStatusChange`.
- `onMessage` payload: `{ message: string, role: "user" | "agent", event_id: number, source /* deprecated */ }`. Use `role`, not `source`.
- Status values: `"disconnected" | "connecting" | "connected" | "disconnecting"`. Mode: `"speaking" | "listening"`.
- Request mic permission with `navigator.mediaDevices.getUserMedia({ audio: true })` in the click handler before `startSession`. Browsers require a user gesture, and the deployed site must be HTTPS.

## Session start (private agent)
```tsx
import { useConversation } from "@elevenlabs/react";
import type { Turn } from "../../shared/types";
import { getScenario } from "../../shared/scenarios";

const conversation = useConversation({
  onConnect: ({ conversationId }) => {},
  onDisconnect: (details) => {},            // details.reason: "user" | "agent" | "error"
  onError: (message, ctx) => console.error(message, ctx),
  onMessage: ({ message, role, event_id }) =>
    addTurn({ id: String(event_id), speaker: role, text: message, t: Date.now() - startedAt }),
});

async function start(scenarioId: string) {
  await navigator.mediaDevices.getUserMedia({ audio: true });
  const { token } = await fetch("/api/conversation-token").then((r) => r.json());
  const s = getScenario(scenarioId)!;
  conversation.startSession({
    conversationToken: token,
    connectionType: "webrtc",              // fallback: { signedUrl } from /api/signed-url (websocket)
    stripAudioTags: true,                  // REQUIRED: v4 expressive tags like [sad] [slow] otherwise appear in text
    dynamicVariables: {                    // fills {{...}} in agent/prompt.md
      persona: s.persona,
      situation: s.situation,
      agent_calls_user: s.agentCallsUser,
      user_calls_agent: s.userCallsAgent,
      first_message: s.firstMessage,
      target_vocab: s.targetVocab.map((v) => `${v.vi} (${v.en})`).join(", "),
    },
  });
}
// conversation.endSession(); conversation.status; conversation.isSpeaking
```
The `SessionConfig` union is strict: pass exactly one of `agentId` (public agent), `signedUrl` (websocket), or `conversationToken` (webrtc).

## Server routes (already in server/src/index.ts)
- `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=…` with header `xi-api-key` → `{ token }` → our `/api/conversation-token`.
- `GET …/conversation/get-signed-url?agent_id=…` → `{ signed_url }` → our `/api/signed-url`.
- Keys stay server-side. Never put `ELEVENLABS_API_KEY` in client code or `VITE_*` vars.

## Live code-switch hints → agent
After `/api/analyze-turn` returns spans for a user turn, nudge the agent without making it speak immediately:
```ts
if (analysis.spans.length)
  conversation.sendContextualUpdate(
    `Coach note: the learner just missed: ${analysis.spans.map((s) => `"${s.english}" = "${s.vietnamese}"`).join(", ")}. Model these Vietnamese words naturally in your next reply; don't call them out.`,
  );
```
- `sendContextualUpdate(text, { contextId? })` adds context silently. `sendUserMessage(text)` would make the agent respond, so don't use it for hints.
- Fire analysis asynchronously. **Never block the conversation on Gemini.** Late hints are fine; dropped hints are fine.

## Prompt overrides vs dynamic variables
We use **dynamic variables** (`{{var}}` in the dashboard prompt/first message). `overrides.agent.prompt/firstMessage/language` and `overrides.tts.voiceId` also exist but must be enabled per field in the agent's Security tab. Only use them if dynamic variables aren't enough (e.g. a different voice per scenario).

## Language / voice
- Agent language `vi`, with `en` as an additional language. Language codes include `"vi"` and `"en"`.
- TTS model ids in the SDK types: `eleven_multilingual_v2`, `eleven_v3_conversational`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_v4`, `eleven_v4_turbo`. Check in the dashboard which support Vietnamese.
- **Always pass `stripAudioTags: true` in `startSession`.** The agent uses `eleven_v4_turbo` with expressive mode, so agent text contains tags like `[sad]`, `[slow]` and `[excited]`. Server-side, also strip `/\[[a-z ]+\]/g` from agent turns before sending them to Gemini.

## Mock mode (no mic / cloud sessions)
Claude's cloud container has no microphone. For verification and as the demo fallback, `?mock=1` should replay `fixtures/session.<scenarioId>.json` turns through the **same `addTurn` path** `onMessage` uses, with delays from `turn.t`. Build the UI against that path, not against the SDK directly.

## Changing the agent
The agent was created via the API; its config is recorded in `agent/prompt.md`. To change the prompt, edit `agent/prompt.md` and run `npm run sync-agent` (it injects the word list from `shared/glossary.ts` at `<<GLOSSARY>>` and sets the LLM temperature). Then run `npm run agent-eval`: it sends the tricky mixed-language sentences in `agent/eval-cases.json` to the agent as single-turn tests and checks each reply for the right Vietnamese words (`--llm <model>` and `--temp <n>` try other settings without changing the agent). For other settings, PATCH `https://api.elevenlabs.io/v1/convai/agents/$ELEVENLABS_AGENT_ID` with a partial `conversation_config`, and update the table in `agent/prompt.md`. The OpenAPI spec is at `https://api.elevenlabs.io/openapi.json`. Note that `/simulate-conversation` was removed on 31 Oct 2026; use `/v1/convai/agent-testing/create` + `/v1/convai/agents/{id}/run-tests` + `/v1/convai/test-invocations/{id}`.

**Cloud sessions:** Node's `fetch` ignores `HTTPS_PROXY`. Run the server and scripts with `NODE_USE_ENV_PROXY=1` (e.g. `NODE_USE_ENV_PROXY=1 npm run dev`). This isn't needed on a laptop.

## Debugging checklist
1. `GET /api/health` → `elevenlabs: true`? In a cloud session, `fetch failed` means the server was started without `NODE_USE_ENV_PROXY=1`.
2. `/api/conversation-token` returns 401 → bad key; 404/422 → wrong agent id or the agent isn't private.
3. Connects, then disconnects immediately → check `onDisconnect` details and `onError`; the dashboard's conversation history shows server-side errors.
4. Agent ignores scenario → dynamic variable names must match `{{names}}` in the dashboard exactly.
5. Agent cuts the learner off → raise turn-taking patience in the dashboard.
