# Heirloom

**Practice Vietnamese with family, in whatever mix of English and Vietnamese comes out.**

Many second-generation Vietnamese Americans understand their parents' language but can't speak it well enough to hold a conversation. Dropping English words into a Vietnamese sentence feels like failing, so people stop trying, and the language fades within a generation.

Heirloom treats that mixing as the starting point instead of the mistake. You talk out loud to an AI relative, such as Bà Ngoại, Mẹ, or Cô Lan at the phở shop. She answers in natural Southern Vietnamese and works in the words you were missing. After the call you get a learning report.

Built at **SanD Hacks Fall 2026** (UC San Diego).

## What it does

1. **Pick a scenario:** a phone call with Bà Ngoại, ordering at a phở restaurant, or telling Mẹ about an internship offer.
2. **Talk, mixing languages freely.** Say *"Tuần này con có midterm, nên con hơi stressed"* and Ngoại replies in Vietnamese, naturally using *bài thi giữa kỳ* and *căng thẳng*.
3. **Watch the live transcript.** Every English word you used is struck through, with the Vietnamese shown next to it, plus your whole sentence rewritten in Vietnamese.
4. **Read your learning report:**
   - how much of what you said was Vietnamese
   - the words you reached for, with example sentences
   - what you said well
   - corrections
   - tone tips
   - which scenario to try next

Every call is different. The relative opens differently, raises different topics, and has her own news to share: Ngoại's cat just had kittens, or Cô Lan's card machine is broken.

## How it works

```
Browser (React) ──audio──► ElevenLabs Conversational Agent ──► speaks Vietnamese back
      │                     (speech recognition → LLM → Vietnamese voice)
      │
      └──► Express server ──► vetted word list (instant)
                         └──► Gemini API (other words + learning report)
```

- **Voice:** an [ElevenLabs](https://elevenlabs.io) conversational agent handles speech recognition on mixed English/Vietnamese, reply generation, and a Southern Vietnamese voice. The browser connects with a short-lived token from our server, so API keys never reach the browser.
- **Live code-switch detection:** after each thing you say, the server finds the English words.
  - Common words come from a vetted list of 260 English→Vietnamese words in `shared/glossary.ts`, answered instantly.
  - Everything else goes to **Gemini**, which returns structured JSON.
  - The result is shown as chips in the transcript, and it is also passed to the agent as a quiet hint so she reuses the same words.
- **One word list for both sides:** the same list is built into the agent's instructions, so what she says matches what the screen shows.
- **Learning report:** Gemini turns the full transcript into a structured report. Before the report is shown, the server checks it:
  - It fixes or drops any part that comes back in the wrong format.
  - It drops any tone tip that names the wrong tone mark.
- **Variety:** each call gets a random opener, a random set of topics, and a piece of news from the relative's own life.

## Tech stack

React + Vite · Express (TypeScript) · ElevenLabs Conversational AI (`@elevenlabs/react`) · Google Gemini API (`@google/genai`)

## Run it locally

Requires Node 22.12+.

```bash
npm install
cp .env.example .env   # then fill in the keys below
npm run dev            # http://localhost:5173
```

`.env` needs:

| Variable | What it is |
| --- | --- |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | The conversational agent's ID (its instructions are in `agent/prompt.md`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_MODEL` | e.g. `gemini-3.5-flash` |

- **Production mode:** `npm run build && npm start` serves the app and API on one port (8787, or `$PORT`).
- **No microphone?** Open `http://localhost:5173/?mock=1` to replay a recorded conversation through the same screens.

## Project layout

```
client/   React app: scenario picker, call screen, live transcript, report
server/   Express API: ElevenLabs tokens, word analysis, learning report (Gemini)
shared/   Types, scenarios, and the vetted English→Vietnamese word list
agent/    The voice agent's instructions and its accuracy test sentences
scripts/  Sync the agent's instructions; accuracy and variety tests for the agent
```

## Testing the agent

- `npm run sync-agent` pushes `agent/prompt.md` and the word list to the ElevenLabs agent.
- `npm run agent-eval` sends 15 tricky mixed-language sentences to the agent and checks its Vietnamese (15/15 passing).
- `npm run agent-variety` simulates several calls and measures how repetitive the agent is.

## What's next

- Tone feedback from the audio itself, not just the transcript
- Saved sessions, so words you missed come back in later calls
- Your own family's dialect, names, and scenarios
- Other heritage languages: only the word list, the agent's instructions, and the voice are Vietnamese-specific

## How we built it

We built this over the weekend with heavy help from an AI coding assistant (Claude Code), which the hackathon allows. We came up with the idea and the scenarios. We tested live calls ourselves and decided how to improve the translations and the conversation flow.
