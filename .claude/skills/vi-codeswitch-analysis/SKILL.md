---
name: vi-codeswitch-analysis
description: Gemini prompts, JSON schemas, and Vietnamese language rules for Heirloom's code-switch analysis (/api/analyze-turn) and learning report (/api/report). Use before writing or changing any Gemini call, analysis prompt, report shape, or code that highlights English spans in Vietnamese transcripts.
---

# Vietnamese code-switch analysis with Gemini

Contracts live in `shared/types.ts` (`TurnAnalysis`, `CodeSwitchSpan`, `Report`, `AnalyzeTurnRequest`, `ReportRequest`). **Change the types first, then the schema below, then the UI.** Test against `fixtures/` (no mic or API needed for the UI; `fixtures/report.call-ba-ngoai.json` is a reference report and the fixture `analyses` are reference turn outputs).

## SDK (`@google/genai` v3, verified against installed types)
```ts
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const res = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL!,           // never hardcode; default in .env.example
  contents: prompt,                          // string or Content[]
  config: {
    systemInstruction: SYSTEM,
    responseMimeType: "application/json",
    responseJsonSchema: SCHEMA,              // plain JSON Schema object (type/properties/required/enum/items...)
    temperature: 0.2,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },  // MINIMAL/LOW for per-turn latency; drop for report
  },
});
const data = JSON.parse(res.text ?? "{}");
```
- `responseJsonSchema` takes standard JSON Schema. (`responseSchema` with the `Type` enum also exists, so use one, not both.)
- If a config field is rejected for the chosen model (e.g. thinking options), remove it rather than switching SDKs.
- Wrap in try/catch and return a safe fallback (`{ turnId, spans: [], vietnameseRatio: 0, fullVietnamese: "" }`) so the UI never breaks mid-demo.

## Per-turn analysis (`POST /api/analyze-turn`) must be fast
Only analyze **user** turns. Send the turn plus the last ~4 turns as context. Keep thinking minimal.

System instruction:
```
You are a Vietnamese heritage-language coach analyzing one utterance from a second-generation Vietnamese American learner who mixes English into Vietnamese (code-switching). Identify every English word or phrase they used where a Vietnamese equivalent exists, and give the natural Vietnamese a family member would say in this context.
Rules:
- "english" must be copied EXACTLY (same case/spelling) from the utterance so the UI can highlight it.
- Vietnamese must use full, correct diacritics (UTF-8). Never strip tones.
- Prefer everyday spoken Southern Vietnamese unless context is Northern; mention the other variant in "note" when they differ (phụ/giúp, chén/bát, muỗng/thìa).
- Ignore fillers (um, uh, like), names, and brand names. Ignore loanwords Vietnamese speakers normally use as-is (OK, email). "bye", "yay", "wow" may get a span if a natural Vietnamese alternative exists.
- Use the conversation context and kinship terms (con, bà, mẹ, ba, cô...) to pick the right register.
- "fullVietnamese" rewrites the whole utterance naturally in Vietnamese, keeping the speaker's meaning and pronouns.
- "vietnameseRatio" = fraction of content words that were Vietnamese (0..1).
```
Schema:
```json
{
  "type": "object",
  "properties": {
    "spans": { "type": "array", "items": { "type": "object", "properties": {
      "english": { "type": "string" }, "vietnamese": { "type": "string" }, "note": { "type": "string" } },
      "required": ["english", "vietnamese"] } },
    "vietnameseRatio": { "type": "number", "minimum": 0, "maximum": 1 },
    "fullVietnamese": { "type": "string" }
  },
  "required": ["spans", "vietnameseRatio", "fullVietnamese"]
}
```
Add `turnId` server-side; don't ask the model for it.

## Learning report (`POST /api/report`)
Send the whole transcript as `Speaker: text` lines, the scenario (`getScenario(session.scenarioId)`), and any per-turn `analyses` already computed. Merging them makes the report consistent with what the user saw live.

System instruction additions:
```
Write a short, warm learning report for the learner (address them as "you", in English, with Vietnamese examples). Be encouraging and specific: quote their actual words.
- missingWords: dedupe across turns, count occurrences, give an example sentence adapted from what they tried to say.
- wins: 2–4 things they said well in Vietnamese, quoted.
- corrections: only real issues (grammar, wrong kinship pronoun, unnatural phrasing), max 4.
- pronunciationTips: general tone tips for words they used. The transcript is ASR output, so you cannot hear their tones; never claim they mispronounced something.
- nextScenarioSuggestion: one of the scenario ids: call-ba-ngoai, order-pho, tell-parents-news.
```
Schema: mirror `Report` in `shared/types.ts` exactly (all fields required except `nextScenarioSuggestion`; `corrections` items need `said`, `better`, `why`).

## Highlighting spans in the transcript UI
Spans contain exact substrings. Split `turn.text` on them case-sensitively, longest span first, to avoid partial overlaps. Show English struck through or underlined with the Vietnamese as a tooltip or inline chip. If a span isn't found verbatim, skip it silently.

## Vietnamese quality checklist (review model output against this)
- Diacritics present and correct (e.g. "bài kiểm tra", not "bai kiem tra").
- Kinship pronouns consistent with the scenario (con ↔ Ngoại/Mẹ/Cô).
- Polite particles for elders: "Dạ", "ạ"; goodbye to elders is "Con chào …", not "Bye".
- Natural spoken choices over textbook ones ("ăn cơm chưa?", "học bài").

## Test without a key
`node -e` against the fixtures: POST each user turn of `fixtures/session.call-ba-ngoai.json` and compare spans to that fixture's `analyses` (wording may differ; the English substrings should match).
