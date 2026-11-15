// Gemini prompts, schemas and normalization for Heirloom's code-switch analysis + learning report.
// See .claude/skills/vi-codeswitch-analysis/SKILL.md. Tune prompts here.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type {
  CodeSwitchSpan,
  Report,
  Scenario,
  Session,
  Turn,
  TurnAnalysis,
} from "../../shared/types";
import { SCENARIOS, getScenario } from "../../shared/scenarios";
import { glossaryLine, glossaryNote, matchGlossary, type GlossaryMatch } from "../../shared/glossary";

// ---------- client ----------
let client: GoogleGenAI | null = null;
function ai() {
  // Lazy: dotenv runs after module imports are evaluated.
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");
  return (client ??= new GoogleGenAI({ apiKey }));
}
// ---------- model fallback (free tier: ~20 requests/day PER MODEL) ----------
// On quota (429) or unavailable-model errors, try the next model. Each model has its own quota bucket.
// Order from testing on Sat night: 3.5-flash-lite answered in ~1–3 s with good Vietnamese; 3.8/3.7-flash returned
// 503 or hung until a 504, so they go last. gemini-2.5-* return 404 for new API users.
// Order from testing on Sat night: the lite models answer in ~1–3 s on the free tier; 3.8/3.7-flash returned 503 or hung
// until the deadline (12–25 s), so they go last. 3.6-flash shares 3.5-flash's quota. gemini-2.5-* return 404 for new users.
// The lite models translate less accurately than 3.5-flash, which is why common words come from the vetted glossary.
const DEFAULT_FALLBACKS = "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-3.7-flash,gemini-flash-lite-latest";
function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACKS).split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}
/** model -> epoch ms until which it's considered exhausted */
const cooldown = new Map<string, number>();
export const exhaustedModels = () => [...cooldown].filter(([, until]) => until > Date.now()).map(([m]) => m);

type GenConfig = NonNullable<Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"]>;

function thinkingFor(model: string, level: ThinkingLevel): GenConfig["thinkingConfig"] {
  // Gemini 2.x uses token budgets; 3.x+ uses levels.
  if (/^gemini-2\./.test(model)) return model.includes("pro") ? undefined : { thinkingBudget: level === ThinkingLevel.MINIMAL ? 0 : 1024 };
  return { thinkingLevel: level };
}

function retryDelayMs(err: unknown): number {
  const m = String((err as Error)?.message ?? err).match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(Number(m[1]) * 1000, 6 * 3600_000) : 60_000;
}

async function generate(contents: string, config: GenConfig, level: ThinkingLevel): Promise<{ text: string; model: string }> {
  const chain = modelChain();
  const available = chain.filter((m) => (cooldown.get(m) ?? 0) <= Date.now());
  let lastErr: unknown = new Error("all Gemini models are rate-limited");
  for (const model of available.length ? available : chain) {
    try {
      const res = await ai().models.generateContent({ model, contents, config: { ...config, thinkingConfig: thinkingFor(model, level) } });
      return { text: res.text ?? "{}", model };
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status === 401 || status === 403) throw e; // bad key: no point trying other models
      if (status === 429) cooldown.set(model, Date.now() + retryDelayMs(e));
      else if (status === 404 || status === 400) cooldown.set(model, Date.now() + 3600_000); // unknown model / unsupported config
      else if (status === 504 || status === 503 || status === undefined) cooldown.set(model, Date.now() + 5 * 60_000); // hung/overloaded/timeout
      console.warn(`[gemini] ${model} failed (${status ?? "timeout/network"}): ${String((e as Error).message).slice(0, 160)}; falling back`);
    }
  }
  throw lastErr;
}

// ---------- helpers ----------
/** ElevenLabs v4 expressive tags, e.g. "[sad]", "[slow]". */
export const stripAudioTags = (s: string) => s.replace(/\[[a-z ]+\]\s*/gi, "").replace(/\s{2,}/g, " ").trim();

const clamp01 = (n: unknown) => {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, x));
};
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

// A plain-ASCII token that can't be a Vietnamese syllable (written without tone marks) is almost certainly English.
const VI_SYLLABLE = /^(ngh|ch|gh|gi|kh|ng|nh|ph|qu|th|tr|[bcdghklmnpqrstvx])?[aeiouy]{1,3}(ch|ng|nh|[cmnpt])?$/;
// Common English words that happen to be shaped like a Vietnamese syllable.
const SHORT_ENGLISH = new Set(
  "bye yay hi hey yes oh the my is it so you your and or of for to go me he an on in at but can not got get him put run sit set cut hot lot bit man men ten top up us am do be we i a".split(
    " ",
  ),
);
// English fillers/interjections that never need a translation.
const FILLERS = new Set("um uh uhm umm er erm ah oh hmm mm mhm like yeah yep yup okay ok so well hey alo wow yay".split(" "));

type Token = { word: string; lower: string; start: number; end: number };
function wordTokens(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu)].map((m) => ({
    word: m[0],
    lower: m[0].toLowerCase(),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}
const isEnglishWord = (w: string) =>
  /^[A-Za-z][A-Za-z'’-]*$/.test(w) && (SHORT_ENGLISH.has(w.toLowerCase()) || !VI_SYLLABLE.test(w.toLowerCase()));
export function hasLikelyEnglish(text: string): boolean {
  return wordTokens(text).some((t) => isEnglishWord(t.word));
}

const fmtTurns = (turns: Turn[]) =>
  turns
    .map((t) => `${t.speaker === "user" ? "Learner" : "Relative"}: ${t.speaker === "agent" ? stripAudioTags(t.text) : t.text}`)
    .join("\n");

const scenarioBlock = (s?: Scenario) =>
  s
    ? `Scenario: ${s.title} (${s.titleVi}). The relative is ${s.persona}. The relative calls the learner "${s.agentCallsUser}"; the learner calls them "${s.userCallsAgent}".`
    : "Scenario: casual family conversation.";

// ---------- per-turn analysis ----------
const TURN_SYSTEM = `You are a Vietnamese heritage-language coach. A second-generation Vietnamese American learner is practicing with a relative and mixes English into Vietnamese (code-switching). For ONE learner utterance, find each English word or phrase they fell back on and give the Vietnamese a native-speaking family member would actually say there.

Accuracy rules (most important):
- Translate the meaning exactly. Never add, drop or change meaning: "fried chicken" is "gà chiên" (not "cơm gà chiên"); "roommate" is "bạn cùng phòng".
- "vietnamese" must be a drop-in replacement for the English span inside the learner's sentence, fitting the Vietnamese words around it. Don't repeat a word that is already there: in "con đi grocery shopping" the span "grocery shopping" becomes "chợ" (the sentence reads "con đi chợ").
- Use the preferred translations given with the utterance unless the context clearly needs a different sense. Reuse the same Vietnamese for a word translated earlier in the conversation.
- Dialect: match the relative in the scenario (Southern unless stated otherwise). Southern words: gà chiên, trễ, kẹt xe, mắc, dĩa, muỗng, ly, tô, bệnh, heo, vô, coi. Northern equivalents (gà rán, muộn, tắc đường, đắt, đĩa, thìa, cốc, bát, ốm, lợn, vào, xem) go in "note" only.
- Register: everyday spoken Vietnamese, not textbook or formal Sino-Vietnamese words. Keep the learner's kinship pronouns (con, Ngoại, Mẹ, Cô...).
- Always write full, correct diacritics.

What to flag:
- Only English words. Never flag Vietnamese words, even without accents (con, ba, trong, nha).
- Copy "english" EXACTLY as written in the utterance (same case and spelling). Group adjacent English words that form one idea into one span ("job interview", "to-go box").
- Flag EVERY English content word; don't skip any.
- Skip fillers and interjections (um, uh, like, yeah, okay, so), names of people, places and brands, and loanwords Vietnamese speakers use as-is (OK, email, internet, video).
- If the utterance contains a whole English clause, flag that clause as one span and translate the whole clause naturally.
- If speech recognition clearly garbled something so it has no sensible meaning, leave it out.

Other fields:
- "note": usually omit it. Include one only for a Northern variant, written exactly as: Northern: <word>. Or for a usage tip about that specific word that quotes the Vietnamese, in ENGLISH, under 12 words. Never write general advice.
- "fullVietnamese": the whole utterance as a native speaker would say it: same meaning and pronouns, fillers removed, consistent with your spans.
- "vietnameseRatio": share of the learner's content words that were Vietnamese (0..1).

Examples:
Utterance: "Ờ, ba người con ăn, ờ, fried chicken á."
{"spans":[{"english":"fried chicken","vietnamese":"gà chiên","note":"Northern: gà rán"}],"vietnameseRatio":0.7,"fullVietnamese":"Ba người, con ăn gà chiên á."}
Utterance: "Con mới move vô apartment mới với roommate."
{"spans":[{"english":"move","vietnamese":"dọn"},{"english":"apartment","vietnamese":"căn hộ"},{"english":"roommate","vietnamese":"bạn cùng phòng"}],"vietnameseRatio":0.6,"fullVietnamese":"Con mới dọn vô căn hộ mới với bạn cùng phòng."}
Utterance: "Hôm qua con đi grocery shopping rồi con nấu dinner cho boyfriend."
{"spans":[{"english":"grocery shopping","vietnamese":"chợ"},{"english":"dinner","vietnamese":"bữa tối"},{"english":"boyfriend","vietnamese":"bạn trai"}],"vietnameseRatio":0.7,"fullVietnamese":"Hôm qua con đi chợ rồi con nấu bữa tối cho bạn trai."}
Utterance: "Dạ con thương Ngoại. Bye Ngoại!"
{"spans":[{"english":"Bye","vietnamese":"Con chào","note":"With elders, say \\"con chào\\" + their title"}],"vietnameseRatio":0.85,"fullVietnamese":"Dạ con thương Ngoại. Con chào Ngoại!"}`;

const TURN_SCHEMA = {
  type: "object",
  properties: {
    spans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          english: { type: "string" },
          vietnamese: { type: "string" },
          note: { type: "string" },
        },
        required: ["english", "vietnamese"],
      },
    },
    vietnameseRatio: { type: "number", minimum: 0, maximum: 1 },
    fullVietnamese: { type: "string" },
  },
  required: ["spans", "vietnameseRatio", "fullVietnamese"],
};

export const emptyAnalysis = (turn: Turn, ratio = 0): TurnAnalysis => ({
  turnId: turn.id,
  spans: [],
  vietnameseRatio: ratio,
  fullVietnamese: "",
});

/** Repair/validate spans: `english` must be an exact substring of the turn text. */
export function normalizeSpans(text: string, raw: unknown): CodeSwitchSpan[] {
  if (!Array.isArray(raw)) return [];
  const out: CodeSwitchSpan[] = [];
  const seen = new Set<string>();
  const lower = text.toLowerCase();
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    let english = typeof s.english === "string" ? s.english.trim() : "";
    const vietnamese = typeof s.vietnamese === "string" ? s.vietnamese.trim() : "";
    if (!english || !vietnamese) continue;
    // Spans must be English: Latin letters only (rejects Vietnamese like "trong vườn" flagged by mistake).
    if (!/^[A-Za-z][A-Za-z0-9'’ ,.?!-]*$/.test(english) || !hasLikelyEnglish(english)) continue;
    if (!text.includes(english)) {
      const i = lower.indexOf(english.toLowerCase());
      if (i < 0 || lower.length !== text.length) continue;
      english = text.slice(i, i + english.length);
    }
    if (seen.has(english)) continue;
    seen.add(english);
    // Notes are for the learner, so they must be in English; drop notes the model wrote in Vietnamese.
    const rawNote = typeof s.note === "string" ? s.note.trim() : "";
    // Keep only word-specific notes: a Northern variant, or a tip that quotes the Vietnamese. Lite models tend to add generic advice.
    const note =
      rawNote.length <= 90 && /^[\x00-\x7F]/.test(rawNote) && (/^Northern\b/i.test(rawNote) || /["“”]/.test(rawNote)) ? rawNote : undefined;
    out.push(note ? { english, vietnamese, note } : { english, vietnamese });
  }
  return out;
}

// ---- glossary fast path ----
const glossarySpan = (m: GlossaryMatch): CodeSwitchSpan => {
  const note = glossaryNote(m.entry);
  return note ? { english: m.english, vietnamese: m.entry.vi, note } : { english: m.english, vietnamese: m.entry.vi };
};
const dedupeSpans = (spans: CodeSwitchSpan[]) => spans.filter((s, i) => spans.findIndex((x) => x.english === s.english) === i);

/** Replace glossary matches in the utterance with their Vietnamese, avoiding doubled words ("đi" + "đi chợ"). */
function substitute(text: string, matches: GlossaryMatch[]): string {
  let out = "";
  let pos = 0;
  for (const m of matches) {
    const before = text.slice(pos, m.start);
    out += before;
    let words = m.entry.vi.split(" ");
    const prevWord = (out.match(/([\p{L}\p{M}]+)\s*$/u)?.[1] ?? "").toLowerCase();
    const nextWord = (text.slice(m.end).match(/^\s*([\p{L}\p{M}]+)/u)?.[1] ?? "").toLowerCase();
    if (words.length > 1 && words[0].toLowerCase() === prevWord) words = words.slice(1);
    if (words.length > 1 && words[words.length - 1].toLowerCase() === nextWord) words = words.slice(0, -1);
    let vi = words.join(" ");
    const startsSentence = /(^|[.!?]\s*)$/.test(out);
    if (startsSentence && /^[A-Z]/.test(m.english)) vi = vi.charAt(0).toUpperCase() + vi.slice(1);
    out += vi;
    pos = m.end;
  }
  return out + text.slice(pos);
}

/**
 * Split an utterance's English into vetted glossary matches and words the glossary doesn't cover.
 * When everything is covered by unambiguous entries we can answer instantly, without the model.
 */
function glossaryPass(text: string) {
  const matches = matchGlossary(text);
  const tokens = wordTokens(text);
  const content = tokens.filter((t) => !FILLERS.has(t.lower));
  const inMatch = (t: Token) => matches.some((m) => t.start >= m.start && t.end <= m.end);
  const english = content.filter((t) => isEnglishWord(t.word) || inMatch(t));
  const uncovered = content.filter((t) => isEnglishWord(t.word) && !inMatch(t));
  const sure = matches.filter((m) => !m.entry.ambiguous);
  const ratio = content.length ? 1 - english.length / content.length : 1;
  return { matches, sure, uncovered, ratio };
}

/** Which source produced the last analysis; logged so quality problems can be traced to a model. */
export type AnalysisSource = "none" | "glossary" | "glossary-fallback" | string;

export async function analyzeTurn(
  turn: Turn,
  context: Turn[],
  scenarioId: string,
  known: CodeSwitchSpan[] = [],
): Promise<TurnAnalysis & { source?: AnalysisSource }> {
  if (turn.speaker !== "user" || !turn.text.trim()) return emptyAnalysis(turn);
  const text = turn.text;
  const g = glossaryPass(text);
  // Nothing English beyond fillers: no model call.
  if (!g.matches.length && !g.uncovered.length) return { ...emptyAnalysis(turn, 1), source: "none" };

  const fromGlossary = (source: AnalysisSource, matches: GlossaryMatch[]) => ({
    turnId: turn.id,
    spans: dedupeSpans(matches.map(glossarySpan)),
    vietnameseRatio: clamp01(g.ratio),
    fullVietnamese: matches.length === g.matches.length && !g.uncovered.length ? substitute(text, matches) : "",
    source,
  });

  // Every English word is a vetted, unambiguous glossary entry: answer instantly, no quota used.
  if (!g.uncovered.length && g.sure.length === g.matches.length) return fromGlossary("glossary", g.sure);

  const hints = g.matches.length
    ? `\nPreferred translations for words in this utterance (vetted; adapt the form to fit the sentence):\n${g.matches
        .map((m) => `- ${glossaryLine(m.entry)}${m.entry.ambiguous ? "  (only if this sense fits the context)" : ""}`)
        .join("\n")}\n`
    : "";
  const earlier = known.length
    ? `\nAlready translated earlier in this conversation (reuse the same Vietnamese for the same English):\n${dedupeSpans(known)
        .slice(-30)
        .map((k) => `- ${k.english} = ${k.vietnamese}`)
        .join("\n")}\n`
    : "";
  const prompt = `${scenarioBlock(getScenario(scenarioId))}

Recent conversation:
${fmtTurns(context.filter((t) => t.id !== turn.id).slice(-4)) || "(start of conversation)"}
${hints}${earlier}
Analyze this learner utterance:
"""${text}"""`;

  try {
    const res = await generate(
      prompt,
      {
        systemInstruction: TURN_SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: TURN_SCHEMA,
        temperature: 0.1,
        httpOptions: { timeout: 12_000 }, // per model attempt (API minimum deadline is 10 s)
      },
      ThinkingLevel.MINIMAL,
    );
    const data = JSON.parse(res.text);
    const spans = normalizeSpans(text, data.spans);
    // The model sometimes skips a word: add vetted glossary matches it missed.
    for (const m of g.sure) {
      const covered = spans.some((s) => {
        const i = text.indexOf(s.english);
        return i >= 0 && m.start < i + s.english.length && m.end > i;
      });
      if (!covered) spans.push(glossarySpan(m));
    }
    return {
      turnId: turn.id,
      spans: dedupeSpans(spans),
      vietnameseRatio: clamp01(data.vietnameseRatio),
      fullVietnamese: typeof data.fullVietnamese === "string" ? data.fullVietnamese.trim() : "",
      source: res.model,
    };
  } catch (e) {
    // All models failed (quota, outage): still show the vetted words rather than nothing.
    console.warn(`[analyze-turn] model unavailable, using glossary only: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
    return fromGlossary("glossary-fallback", g.sure);
  }
}

// ---------- tone sanity check ----------
// Tone marks as NFD combining characters. Vowel-shape marks (circumflex, breve, horn) are not tones.
const TONE_MARKS: Record<string, string> = { huyền: "\u0300", sắc: "\u0301", hỏi: "\u0309", ngã: "\u0303", nặng: "\u0323" };
// Unicode-aware word boundaries (\b breaks on letters like "ã").
const toneWord = (body: string) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, "iu");
const TONE_NAMES: [string, RegExp][] = [
  ["ngang", toneWord("ngang")],
  ["huyền", toneWord("huy[eềê]n")],
  ["sắc", toneWord("s[aắ]c")],
  ["hỏi", toneWord("h[oỏ]i")],
  ["ngã", toneWord("ng[aã]")],
  ["nặng", toneWord("n[aặ]ng")],
];
const MARK_NAMES: [RegExp, string][] = [
  [/circumflex/i, "\u0302"],
  [/breve/i, "\u0306"],
  [/\bhorn\b/i, "\u031B"],
  [/\bgrave\b/i, "\u0300"],
  [/\bacute\b/i, "\u0301"],
  [/\btilde\b/i, "\u0303"],
  [/dot below/i, "\u0323"],
  [/\bhook\b(?! above)?/i, "\u0309"],
];
/** Tones present in a Vietnamese word/phrase, read from its diacritics. */
export function tonesOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const syl of text.normalize("NFD").toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean)) {
    const found = Object.entries(TONE_MARKS).filter(([, m]) => syl.includes(m)).map(([n]) => n);
    if (found.length) found.forEach((n) => out.add(n));
    else if (/[aeiouy]/.test(syl)) out.add("ngang");
  }
  return out;
}
/**
 * Drop a tip that names a tone and quotes a Vietnamese word lacking every tone it names
 * (e.g. "hỏi tone like 'Ngoại'", where Ngoại is nặng). Tips that quote nothing or name no tone pass.
 */
export function toneClaimsAreConsistent(tip: string): boolean {
  // Only look at text near a tone name ("hỏi tone", "dấu hỏi") so "Ngã" as a word in a quote isn't miscounted.
  const named = TONE_NAMES.filter(([, re]) => re.test(tip.replace(/["“”'‘’«»][^"“”'‘’«»]*["“”'‘’«»]/g, " "))).map(([n]) => n);
  const quoted = [...tip.matchAll(/["“”'‘’«»]([^"“”'‘’«»]{1,40})["“”'‘’«»]/g)].map((m) => m[1].trim());
  // Only check quotes that look Vietnamese (non-ASCII letters); English glosses and unaccented words are ignored.
  const vi = quoted.filter((q) => /[^\x00-\x7F]/.test(q));
  if (!vi.every((q) => !named.length || named.some((n) => tonesOf(q).has(n)))) return false;
  // Named diacritics ("circumflex", "hook"...) must appear on at least one quoted word.
  const marks = MARK_NAMES.filter(([re]) => re.test(tip)).map(([, m]) => m);
  return !vi.length || marks.every((m) => vi.some((q) => q.normalize("NFD").includes(m)));
}

// ---------- learning report ----------
const SCENARIO_IDS = SCENARIOS.map((s) => s.id);

const REPORT_SYSTEM = `You are a warm Vietnamese heritage-language coach. A second-generation Vietnamese American learner just finished a practice conversation with an AI playing a Vietnamese relative. The learner mixes English into Vietnamese (code-switching); that is welcome, and your job is to help them need less English next time.
Write a short, encouraging learning report for the learner (address them as "you", in English, with Vietnamese examples). Be specific: quote their actual words from the transcript. Vietnamese must always have full, correct diacritics.
- summary: 2–3 sentences on how the conversation went.
- vietnameseRatio: overall fraction of the learner's content words that were Vietnamese (0..1).
- missingWords: every English word/phrase the learner used where Vietnamese exists (ignore fillers, names, brands). Dedupe across turns, count occurrences, and give an example Vietnamese sentence adapted from what they tried to say.
  Translate the meaning exactly: never add, drop or change meaning ("fried chicken" is "gà chiên", not "cơm gà chiên"). Use the same Vietnamese the learner already saw in the live analysis, and the preferred translations provided, unless one is clearly wrong for the context. Use everyday spoken Vietnamese in the relative's dialect (Southern unless stated otherwise: gà chiên, trễ, kẹt xe, mắc, bệnh, heo); mention the Northern variant in the vietnamese field only when it differs (e.g. "trễ (North: muộn)").
- wins: 2–4 things they said well in Vietnamese, quoted, each with a few words on why it's good.
- corrections: only real issues (grammar, wrong kinship pronoun, unnatural phrasing, impolite register with elders), max 4. "said" quotes the learner exactly. Empty if none.
- pronunciationTips: 1–3 general tone/pronunciation tips for Vietnamese words the learner used. The transcript is speech-recognition output, so you cannot hear their tones: never claim they mispronounced something.
  Tone reference (the mark sits on the main vowel): ngang = no mark (a), huyền = grave (à), sắc = acute (á), hỏi = hook (ả), ngã = tilde (ã), nặng = dot below (ạ). Vowel-shape marks (â, ă, ê, ô, ơ, ư, đ) are NOT tones.
  Describe only marks the quoted word actually has (e.g. "Mẹ" has a dot below but no circumflex).
  Name a word's tone ONLY by reading the tone mark on that exact word as written in the transcript (e.g. "Ngoại" has a dot below → nặng; "khỏe" has a hook → hỏi; "nhớ" has an acute → sắc). Any example word you quote for a tone must actually carry that tone's mark. Put quoted Vietnamese words in double quotes.
- nextSteps: 2–3 concrete suggestions.
- nextScenarioSuggestion: one of: ${SCENARIO_IDS.join(", ")} (pick a different one from the current scenario when sensible).
If the learner said little or nothing, say so kindly and keep lists short or empty.`;

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    vietnameseRatio: { type: "number", minimum: 0, maximum: 1 },
    missingWords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          english: { type: "string" },
          vietnamese: { type: "string" },
          example: { type: "string" },
          count: { type: "integer", minimum: 1 },
        },
        required: ["english", "vietnamese", "example", "count"],
      },
    },
    wins: { type: "array", items: { type: "string" } },
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: { said: { type: "string" }, better: { type: "string" }, why: { type: "string" } },
        required: ["said", "better", "why"],
      },
    },
    pronunciationTips: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    nextScenarioSuggestion: { type: "string", enum: SCENARIO_IDS },
  },
  required: ["summary", "vietnameseRatio", "missingWords", "wins", "corrections", "pronunciationTips", "nextSteps"],
};

export function emptyReport(): Report {
  return {
    summary: "This conversation was too short to analyze. Try saying a few sentences next time; mixing in English is completely fine!",
    vietnameseRatio: 0,
    missingWords: [],
    wins: [],
    corrections: [],
    pronunciationTips: [],
    nextSteps: ["Start a new conversation and answer the first question, even with just a few words."],
  };
}

export function normalizeReport(d: any): Report {
  const obj = (v: unknown): any[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const report: Report = {
    summary: s(d?.summary),
    vietnameseRatio: clamp01(d?.vietnameseRatio),
    missingWords: obj(d?.missingWords)
      .map((w) => ({
        english: s(w.english),
        vietnamese: s(w.vietnamese),
        example: s(w.example),
        count: Math.max(1, Math.round(Number(w.count) || 1)),
      }))
      .filter((w) => w.english && w.vietnamese),
    wins: strArr(d?.wins),
    corrections: obj(d?.corrections)
      .map((c) => ({ said: s(c.said), better: s(c.better), why: s(c.why) }))
      .filter((c) => c.said && c.better),
    pronunciationTips: strArr(d?.pronunciationTips).filter((t) => {
      const ok = toneClaimsAreConsistent(t);
      if (!ok) console.warn(`[report] dropped tip with wrong tone claim: ${t}`);
      return ok;
    }),
    nextSteps: strArr(d?.nextSteps),
  };
  if (SCENARIO_IDS.includes(d?.nextScenarioSuggestion)) report.nextScenarioSuggestion = d.nextScenarioSuggestion;
  return report;
}

export async function generateReport(session: Session): Promise<Report> {
  const turns = (session.turns ?? []).filter((t) => t?.text?.trim());
  if (!turns.some((t) => t.speaker === "user")) return emptyReport();

  const analyses = (session.analyses ?? []).filter((a) => a.spans?.length);
  const live = analyses.length
    ? `\nLive analysis already shown to the learner (stay consistent with these Vietnamese equivalents):\n${analyses
        .flatMap((a) => a.spans.map((sp) => `- "${sp.english}" → ${sp.vietnamese}`))
        .join("\n")}\n`
    : "";

  const seenForms = new Set<string>();
  const vetted = turns
    .filter((t) => t.speaker === "user")
    .flatMap((t) => matchGlossary(t.text))
    .filter((m) => !seenForms.has(m.entry.en[0]) && seenForms.add(m.entry.en[0]));
  const preferred = vetted.length
    ? `\nPreferred translations for English words in this transcript (vetted):\n${vetted
        .map((m) => `- ${glossaryLine(m.entry)}${m.entry.ambiguous ? "  (only if this sense fits the context)" : ""}`)
        .join("\n")}\n`
    : "";

  const prompt = `${scenarioBlock(getScenario(session.scenarioId))}
Current scenario id: ${session.scenarioId}
${live}${preferred}
Transcript:
${fmtTurns(turns)}`;

  const res = await generate(
    prompt,
    {
      systemInstruction: REPORT_SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: REPORT_SCHEMA,
      temperature: 0.3,
      httpOptions: { timeout: 25_000 }, // per model attempt
    },
    ThinkingLevel.LOW,
  );
  console.log(`[report] model=${res.model}`);
  return normalizeReport(JSON.parse(res.text));
}
