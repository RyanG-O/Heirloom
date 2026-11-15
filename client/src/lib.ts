import type { Report, Session, Turn, TurnAnalysis, CodeSwitchSpan, Scenario } from "../../shared/types";

export const IS_MOCK = (() => {
  const v = new URLSearchParams(window.location.search).get("mock");
  return v !== null && v !== "0" && v !== "false";
})();

// ---- fixtures (mock mode) ----
const sessionFixtures = import.meta.glob("../../fixtures/session.*.json", { eager: true, import: "default" }) as Record<
  string,
  Session
>;
const reportFixtures = import.meta.glob("../../fixtures/report.*.json", { eager: true, import: "default" }) as Record<
  string,
  Report
>;
export function getFixtureSession(scenarioId: string): Session | undefined {
  return Object.entries(sessionFixtures).find(([p]) => p.endsWith(`session.${scenarioId}.json`))?.[1];
}
export function getSampleReport(scenarioId: string): Report {
  const exact = Object.entries(reportFixtures).find(([p]) => p.endsWith(`report.${scenarioId}.json`))?.[1];
  return exact ?? Object.values(reportFixtures)[0];
}

// ---- helpers ----
export const personaName = (s: Scenario) => s.persona.split(" (")[0].split(",")[0].trim();

export const AUDIO_TAG_RE = /\[[a-z ]+\]\s*/gi;
export const cleanText = (t: string) => t.replace(AUDIO_TAG_RE, "").replace(/\s{2,}/g, " ").trim();

export async function readError(r: Response): Promise<string> {
  const text = await r.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    if (j?.error) return String(j.error);
  } catch {
    /* not json */
  }
  if (r.status === 500 && !text) return "The server isn't responding. Is it running? (npm run dev)";
  return `${r.status} ${r.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`;
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as T;
}

export function coachNote(a: TurnAnalysis) {
  return `Coach note: the learner just used English for: ${a.spans
    .map((s) => `"${s.english}" = "${s.vietnamese}"`)
    .join(", ")}. Use exactly these Vietnamese words when the topic comes up again; don't call them out.`;
}

/** Split text into plain segments and span segments (exact substring, longest first, no overlaps). */
export type Segment = { text: string; span?: CodeSwitchSpan };
export function segmentText(text: string, spans: CodeSwitchSpan[] = []): Segment[] {
  const taken: { start: number; end: number; span: CodeSwitchSpan }[] = [];
  for (const span of [...spans].sort((a, b) => b.english.length - a.english.length)) {
    if (!span.english) continue;
    let from = 0;
    while (from <= text.length) {
      const i = text.indexOf(span.english, from);
      if (i < 0) break;
      const end = i + span.english.length;
      if (!taken.some((t) => i < t.end && end > t.start)) {
        taken.push({ start: i, end, span });
        break;
      }
      from = i + 1;
    }
  }
  taken.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const t of taken) {
    if (t.start > pos) out.push({ text: text.slice(pos, t.start) });
    out.push({ text: text.slice(t.start, t.end), span: t.span });
    pos = t.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

export type { Turn, TurnAnalysis, Session, Report, Scenario };
