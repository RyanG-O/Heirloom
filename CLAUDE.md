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

## 2. Architecture (suggested; adjust as the build evolves)

```
React (Vite) ──► ElevenLabs Agent (WebRTC/WebSocket via @elevenlabs/react `useConversation`)
   │                 └─ onMessage → append to transcript state
   │
   ├──► backend /api/signed-url      → ElevenLabs signed URL (keeps the xi-api-key server-side)
   ├──► backend /api/analyze-turn    → Gemini: code-switch detection for one user turn (live hints)
   └──► backend /api/report          → Gemini: full transcript → structured learning report (JSON)
```

- **Backend**: a small Node/Express (or Vite-proxied serverless) server. **No API keys in the browser.**
- **Live code-switch loop (stretch, high demo value)**: after each user turn, send it to Gemini and get back `{ englishSpans: [{ en, vi, note }] }`. Highlight the spans in the transcript UI and push them to the agent via `sendContextualUpdate` so it naturally models the Vietnamese word in its reply.
- **Report**: call Gemini with a JSON response schema (structured output) so the UI renders reliable fields, for example:
  ```json
  {
    "summary": "...",
    "missingWords": [{ "english": "dinner", "vietnamese": "bữa tối", "example": "..." }],
    "wins": ["..."],
    "toneNotes": ["..."],
    "codeSwitchRatio": 0.35,
    "nextScenarioSuggestion": "..."
  }
  ```
- **Persistence (optional)**: store sessions, transcripts and reports in **Neon Postgres**. This also qualifies the project for the Neon track (see §4). If time is short, use in-memory or localStorage.

### Agent prompt guidelines (ElevenLabs dashboard or overrides)
- Persona: a warm, patient Vietnamese family member or tutor. Use Southern or Northern dialect deliberately and stay consistent.
- Always accept mixed English/Vietnamese input. Never scold or ask the user to "speak Vietnamese only".
- Recast missing words inline, once, then move on. Keep replies short (1–3 sentences) so the user talks more.
- Use correct kinship pronouns (con/bà/mẹ/ba…) for the chosen scenario.
- Use a multilingual voice/model that handles Vietnamese and English in the same utterance.

### Environment variables (`.env`, never committed)
```
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=            # keep the model name configurable
DATABASE_URL=            # Neon, optional
```
Commit a `.env.example` with empty values. Add `.env` to `.gitignore` before the first push.

---

## 3. Hackathon rules that affect how we work

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

## 4. Judging and tracks: what to optimize for

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

## 5. Working conventions for Claude

- **Demo-first.** Priority order: (1) a voice conversation works end to end → (2) live transcript → (3) Gemini report → (4) live code-switch highlighting and agent hints → (5) persistence and polish.
- Build a **fallback path**: if live audio fails on venue Wi-Fi (eduroam/UCSD-Guest), we can replay a saved transcript to generate the report and show the UI.
- Render Vietnamese with full diacritics (UTF-8 everywhere; choose fonts that support Vietnamese).
- Never commit secrets. Keep model names and agent IDs in env vars.
- Keep the commit history inside the event window (see §3). Check `date -u` before any commit late Sunday morning.

## 6. Event reference
- Website: https://hackathon.csesatucsd.com · Devpost: https://sand-hacks-26.devpost.com/ · Communication happens on the event Slack.
- Hacking space: Qualcomm Conference Room, Jacobs Hall. Opening and closing ceremonies are in Warren Lecture Hall 2005.
- Help: event Slack or the Help Desk (staff wear hackathon t-shirts). Emergencies: UCPD (858) 534-4357 or 911.
- Participants must follow the UC San Diego Principles of Community.
