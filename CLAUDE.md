# CLAUDE.md — Heirloom

Context for Claude Code working in this repo. Heirloom is a **SanD Hacks Fall 2026** project (UC San Diego, Nov 14–15, 2026). Shipping a working demo before the deadline matters more than anything else here.

---

## 1. Project

### The problem
Many second-generation Vietnamese Americans understand some Vietnamese but can't speak it well enough to hold a real conversation with parents, grandparents, and relatives. Switching between English and Vietnamese mid-sentence feels like failing, so people stop trying, and the language fades within a generation.

### The solution
Heirloom is a voice-first practice partner built on an **ElevenLabs Conversational Agent**. Users speak however comes naturally, **mixing English and Vietnamese freely (code-switching)**. The agent:
- understands mixed-language speech and replies mostly in Vietnamese, pitched to the user's level;
- **gently fills in missing words**: when the user drops into English ("Con muốn ăn… *dinner* với bà"), it echoes the Vietnamese ("…ăn **bữa tối** với bà") without breaking the flow;
- **rehearses real conversations**, such as calling grandma, ordering phở, or telling parents about school, with the agent playing the Vietnamese-speaking relative.

After each session the user gets a **learning report**: words they were missing, phrases they used correctly, tone/diacritic notes, and suggestions for next time.

### Required components
| # | Component | Role |
|---|-----------|------|
| 1 | **React front-end** | Scenario picker, live call UI (mic and agent status), live transcript, report view |
| 2 | **ElevenLabs Conversational Agent** | Real-time bilingual voice conversation; the agent persona is a patient Vietnamese relative or tutor |
| 3 | **Conversation transcript** | Every turn captured with speaker, text and timestamp; shown live and stored for analysis |
| 4 | **Gemini API** | Analyzes the transcript: detects code-switched spans, maps English fill-ins to Vietnamese, and (optionally) feeds live hints back to the agent |
| 5 | **Learning report** | Generated at session end from the Gemini analysis, rendered in the UI |

---

## 2. Repo layout and commands

```
client/          React + Vite (port 5173, proxies /api → 8787)
server/          Express + tsx (port 8787); ElevenLabs token routes + Gemini routes
shared/          types.ts (THE contract: Turn, TurnAnalysis, Report, API shapes), scenarios.ts,
                 glossary.ts (vetted English→Vietnamese words used by BOTH the agent prompt and the Gemini analysis)
fixtures/        session.<scenarioId>.json transcripts (+ reference analyses), report.call-ba-ngoai.json
                 regenerate with `node fixtures/build.mjs`
agent/prompt.md  ElevenLabs agent system prompt + dashboard checklist (source of truth)
.claude/skills/  elevenlabs-agent, vi-codeswitch-analysis (read these before touching those areas)
.claude/hooks/   commit-freeze.mjs (blocks git commit/push outside the hackathon window)
```

```bash
npm install            # once, at the REPO ROOT (npm workspaces; needs Node >= 22.12)
npm run dev            # server + client together → http://localhost:5173
npm run typecheck      # tsc for client + server
npm run build && npm start  # production mode: the server serves the built app + API on one port (8787, or $PORT)
npm run setup-git-hooks  # enable the commit-freeze guard for manual git commits too
npm run sync-agent     # push agent/prompt.md's system prompt (+ glossary) to the ElevenLabs agent
npm run agent-eval     # check the agent's Vietnamese on the tricky sentences in agent/eval-cases.json
npm run agent-variety  # simulate calls and measure how repetitive the agent is
```
**Cloud sessions only:** prefix server/script commands with `NODE_USE_ENV_PROXY=1` (Node `fetch` ignores the container's HTTPS proxy otherwise). The `.env` with real keys exists only in the container where it was created; it's gitignored, so each machine needs its own copy.
`GET /api/health` reports which keys are configured. Keys go in the root `.env` (see `.env.example`).

**Verifying without a mic:** cloud sessions have no audio. Use mock mode (`?mock=1`, replays fixtures) plus a Playwright screenshot. Only a human on a laptop can verify the live voice call.

### Parallel work briefs
- **Session A (client):** scenario picker → call screen (status, mic button, live transcript) → report view. Mock mode replays `fixtures/session.*.json` through the same `addTurn` path as `onMessage`; the report view renders `fixtures/report.call-ba-ngoai.json` until `/api/report` works. Touch only `client/`.
- **Session B (server):** implement `/api/analyze-turn` and `/api/report` with Gemini per the `vi-codeswitch-analysis` skill; test against the fixtures. Touch only `server/`.
- Changes to `shared/types.ts` must be coordinated between the two sessions. Make them in a small separate commit first.

## 3. Architecture

```
React (Vite) ──► ElevenLabs Agent (WebRTC via @elevenlabs/react v1 `useConversation`, inside <ConversationProvider>)
   │                 └─ onMessage → append to transcript state
   │
   ├──► backend /api/conversation-token → ElevenLabs WebRTC token (keeps the xi-api-key server-side)
   ├──► backend /api/signed-url         → WebSocket fallback
   ├──► backend /api/analyze-turn       → Gemini: code-switch detection for one user turn (live hints)
   └──► backend /api/report             → Gemini: full transcript → structured learning report (JSON)
```

- **No API keys in the browser.** All ElevenLabs/Gemini calls that need keys go through `server/`.
- **Live code-switch loop (stretch, high demo value):** after each *user* turn, call `/api/analyze-turn` asynchronously and get a `TurnAnalysis` (`spans: [{ english, vietnamese, note? }]`). Highlight the spans in the transcript and push them to the agent via `sendContextualUpdate` so it models the Vietnamese word in its next reply. Never block the conversation on Gemini.
- **Conversation variety:** every call gets a random opener, 4 shuffled topic ideas and one piece of the persona's own news (`buildDynamicVariables()` in `shared/scenarios.ts`); the agent prompt has "sound like a real person" rules (follow up, don't always ask a question, vary openers, limit nagging). Add more openers/topics/news to a scenario for even more variety.
- **Translation quality:** common words come from the vetted glossary in `shared/glossary.ts` (instant, no Gemini quota); Gemini handles the rest with the glossary as hints. The agent prompt gets the same glossary, so voice and chips agree. Fix a wrong translation by editing the glossary, then `npm run sync-agent`.
- **Report:** `/api/report` returns a `Report` (see `shared/types.ts`) using Gemini structured output (`responseJsonSchema`). `fixtures/report.call-ba-ngoai.json` is the reference example.
- **Persistence (optional)**: store sessions, transcripts and reports in **Neon Postgres**. This also qualifies the project for the Neon track (see §5). If time is short, use in-memory or localStorage.

### Agent prompt
The full system prompt, dynamic variables and dashboard checklist live in `agent/prompt.md`. In short: a warm family persona; always accept mixed English/Vietnamese; recast missing words once, inline; short replies; correct kinship pronouns; high turn-taking patience.

### Environment variables
Root `.env` (gitignored); template in `.env.example`: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL` (optional, Neon), `PORT`.

---

## 4. Hackathon rules that affect how we work

**Timezone: event times are Pacific (PST, UTC−8). The dev container clock is UTC.**

| Milestone | PST | UTC |
|---|---|---|
| Hacking begins (earliest allowed commit) | Sat 11/14 10:30 AM | Sat 11/14 18:30 |
| Qualcomm Room closes for the night | Sat 11/14 9:00 PM | Sun 11/15 05:00 |
| Qualcomm Room re-opens | Sun 11/15 7:00 AM | Sun 11/15 15:00 |
| **Initial Devpost submission** (placeholder OK) | **Sun 11/15 11:00 AM** | Sun 11/15 19:00 |
| **Final submission; code freeze** | **Sun 11/15 12:00 PM** | **Sun 11/15 20:00** |
| Science-fair judging | Sun 12:30–2:30 PM | 20:30–22:30 |
| Closing ceremony | Sun 2:30 PM | 22:30 |

Hard rules:
- ⛔ **No commits before Sat 10:30 AM PST or after Sun 12:00 PM PST.** Either one means **immediate disqualification**. Never commit or push after the freeze, including "small fixes", README edits and rebases that rewrite timestamps. Don't import pre-existing code via commits that carry old author dates.
- The project must be built during the event. Open-AI / open-internet: any libraries, APIs and AI tools are allowed.
- Teams of 1–4, locked at submission.
- Plan to **stop coding around 10:00 AM Sunday**. The organizers recommend reserving about 2 hours for the video and write-up.

### Devpost submission checklist (https://sand-hacks-26.devpost.com/)
- [ ] **3-minute video** (YouTube/Google Drive, visibility **Public**): idea → **live demo (most important)** → tech used
- [ ] Short write-up: problem, solution, challenges, tools used (answered in Devpost prompts)
- [ ] GitHub repository link (public)
- [ ] Live demo link (optional; deploy the front-end if feasible)
- [ ] Select all relevant tracks (multiple are allowed)

---

## 5. Judging and tracks: what to optimize for

Judging is **science-fair style**: 3-minute pitch plus 2 minutes of Q&A per judge, and **the whole team must be at the table** (a missing member means a score of zero).

Criteria (holistic):
1. **Idea**: real problem? creative? practical? The heritage-language loss story is the hook; lead with it.
2. **Demo**: did it work, and does it show off the project? **The live bilingual voice conversation must work reliably.**
3. **Technical complexity**: interesting tech or algorithms. Real-time code-switch detection that feeds back into the agent is the differentiator.
4. **Completion**: does it do everything it claims? Don't advertise features that aren't wired up.
- **Code quality is NOT judged.** Favor speed and a working demo over clean abstractions, tests or comments.

Target tracks:
| Track | Prize | Why we fit |
|---|---|---|
| 🏆 Best Overall Hack | ANC headphones + ElevenLabs Pro credits | Strong social-impact story + polished voice demo |
| **ElevenLabs — Best Project Built with ElevenLabs** | Scale tier credits | Conversational Agent is the core of the product |
| **MLH — Best Use of Gemini API** | MLH swag kits | Gemini powers code-switch analysis and reports |
| Neon — Best Database-Driven / Agent Backend *(optional)* | Track recognition | Only if sessions/reports are stored in Neon |
| Bright Data — Data for Good *(stretch)* | $1,000 / $750 / $500 | Only if we use web data, e.g. scraping real Vietnamese phrases or dialogues for scenarios |
| MLH — Best Domain Name from GoDaddy Registry *(cheap add-on)* | Gift card | Register a domain for the live demo |

MLH track details: https://www.mlh.com/events/sand-hacks/prizes

Credits available: ElevenLabs Creator tier (every participant), Neon promo credits, and $100 Bright Data API credits per team.

---

## 6. Working conventions for Claude

- **Demo-first.** Priority order: (1) a voice conversation works end to end → (2) live transcript → (3) Gemini report → (4) live code-switch highlighting and agent hints → (5) persistence and polish.
- Build a **fallback path**: if live audio fails on venue Wi-Fi (eduroam/UCSD-Guest), we can replay a saved transcript to generate the report and show the UI.
- Render Vietnamese with full diacritics (UTF-8 everywhere; choose fonts that support Vietnamese).
- Never commit secrets. Keep model names and agent IDs in env vars.
- Keep the commit history inside the event window (see §4). Check `date -u` before any commit late Sunday morning.

## 7. Event reference
- Website: https://hackathon.csesatucsd.com · Devpost: https://sand-hacks-26.devpost.com/ · Communication happens on the event Slack.
- Hacking space: Qualcomm Conference Room, Jacobs Hall. Opening and closing ceremonies are in Warren Lecture Hall 2005.
- Help: event Slack or the Help Desk (staff wear hackathon t-shirts). Emergencies: UCPD (858) 534-4357 or 911.
- Participants must follow the UC San Diego Principles of Community.
