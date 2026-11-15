// Shared contract between client and server. Change shapes here first, then update both sides.

export type Speaker = "user" | "agent";

/** One utterance in the conversation, as captured from ElevenLabs `onMessage`. */
export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
  /** ms since session start */
  t: number;
}

/** An English word or phrase the user dropped into Vietnamese speech, with the Vietnamese they were missing. */
export interface CodeSwitchSpan {
  /** Exact English substring as it appears in Turn.text (used for highlighting). */
  english: string;
  /** Natural Vietnamese for this context, with full diacritics. */
  vietnamese: string;
  /** Optional short tip: classifier, register, dialect difference, etc. */
  note?: string;
}

/** Gemini's per-turn analysis of a single user turn (live code-switch loop). */
export interface TurnAnalysis {
  turnId: string;
  spans: CodeSwitchSpan[];
  /** 0..1, share of the turn's words that were Vietnamese. */
  vietnameseRatio: number;
  /** The user's sentence rewritten fully in natural Vietnamese. Empty when unavailable. */
  fullVietnamese: string;
  /** Where the translation came from: "glossary" (vetted, instant), a Gemini model id, or "glossary-fallback". */
  source?: string;
}

export interface Scenario {
  id: string;
  title: string;
  titleVi: string;
  description: string;
  /** Who the agent plays, e.g. "Bà Ngoại (maternal grandmother), 78, Southern Vietnamese" */
  persona: string;
  /** How the agent addresses the user / how the user addresses the agent. */
  agentCallsUser: string;
  userCallsAgent: string;
  /** Agent's opening line (Vietnamese). */
  firstMessage: string;
  /** Situation + goals injected into the agent prompt. */
  situation: string;
  targetVocab: { vi: string; en: string }[];
}

export interface Session {
  id: string;
  scenarioId: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  turns: Turn[];
  analyses?: TurnAnalysis[];
}

export interface MissingWord {
  english: string;
  vietnamese: string;
  /** Example Vietnamese sentence using the word, ideally adapted from the user's own turn. */
  example: string;
  count: number;
}

/** End-of-session learning report (Gemini structured output). */
export interface Report {
  summary: string;
  /** 0..1 across all user turns. */
  vietnameseRatio: number;
  missingWords: MissingWord[];
  /** Things the user said well in Vietnamese (quote them). */
  wins: string[];
  /** Grammar, kinship-pronoun, or phrasing corrections. */
  corrections: { said: string; better: string; why: string }[];
  /** Pronunciation/tone tips. ASR output is not reliable for tone errors, so keep these general. */
  pronunciationTips: string[];
  nextSteps: string[];
  nextScenarioSuggestion?: string;
}

// ---- API contracts (Express server, proxied at /api by Vite) ----

/** GET /api/conversation-token  -> WebRTC token for useConversation().startSession({ conversationToken }) */
export interface ConversationTokenResponse {
  token: string;
}
/** GET /api/signed-url  -> WebSocket fallback for startSession({ signedUrl }) */
export interface SignedUrlResponse {
  signedUrl: string;
}
/** POST /api/analyze-turn */
export interface AnalyzeTurnRequest {
  turn: Turn;
  /** Last few turns for context. */
  context: Turn[];
  scenarioId: string;
  /** Spans already shown earlier in this session, so repeated words get the same Vietnamese. */
  known?: CodeSwitchSpan[];
}
export type AnalyzeTurnResponse = TurnAnalysis;
/** POST /api/report */
export interface ReportRequest {
  session: Session;
}
export type ReportResponse = Report;

export interface ApiError {
  error: string;
}
