import { useCallback, useEffect, useState } from "react";
import type { Report, ReportRequest, Session } from "../../shared/types";
import { getScenario } from "../../shared/scenarios";
import { IS_MOCK, getSampleReport, postJson } from "./lib";

export default function ReportView({
  session,
  onPractice,
  onHome,
}: {
  session: Session;
  onPractice: (scenarioId: string) => void;
  onHome: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scenario = getScenario(session.scenarioId);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    postJson<Report>("/api/report", { session } satisfies ReportRequest, ctrl.signal)
      .then((r) => {
        setReport(r);
        setIsSample(false);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        if (IS_MOCK) {
          setReport(getSampleReport(session.scenarioId));
          setIsSample(true);
        } else setError(e.message);
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [session]);

  useEffect(() => load(), [load]);

  const userTurns = session.turns.filter((t) => t.speaker === "user").length;
  const minutes = Math.max(1, Math.round((Date.parse(session.endedAt ?? "") - Date.parse(session.startedAt)) / 60000) || 1);

  return (
    <main className="page report-page">
      <section className="report-hero">
        <div className="section-label">Báo cáo học tập · Learning report</div>
        <h1>{scenario?.titleVi ?? "Your conversation"}</h1>
        <div className="report-meta">
          {userTurns} turns · ~{minutes} min
          {isSample && <span className="pill pill-mock">Sample report</span>}
        </div>
      </section>

      {loading && (
        <section className="card loading-card">
          <div className="spinner" />
          <div>
            <strong>Đang viết báo cáo…</strong>
            <div className="muted">Gemini is reviewing your conversation.</div>
          </div>
        </section>
      )}

      {error && !loading && (
        <section className="card">
          <div className="alert alert-error">Couldn't generate the report: {error}</div>
          <div className="row-gap">
            <button className="btn btn-primary" onClick={load}>
              Retry
            </button>
            <button className="btn btn-ghost" onClick={onHome}>
              Back to scenarios
            </button>
          </div>
        </section>
      )}

      {report && !loading && (
        <>
          <section className="card summary-card">
            <p className="summary">{report.summary}</p>
            <div className="meter-label">
              <span>Tiếng Việt</span>
              <strong>{Math.round((report.vietnameseRatio ?? 0) * 100)}%</strong>
            </div>
            <div className="meter">
              <div className="meter-fill" style={{ width: `${Math.round((report.vietnameseRatio ?? 0) * 100)}%` }} />
            </div>
            <div className="meter-caption muted">of what you said was in Vietnamese</div>
          </section>

          {report.missingWords?.length > 0 && (
            <section className="card">
              <h2>Từ bạn cần · Words you reached for</h2>
              <div className="words">
                {report.missingWords.map((w, i) => (
                  <div className="word-row" key={i}>
                    <div className="word-en">{w.english}</div>
                    <div className="word-arrow">→</div>
                    <div>
                      <div className="word-vi">
                        {w.vietnamese}
                        {w.count > 1 && <span className="count">×{w.count}</span>}
                      </div>
                      <div className="word-ex">{w.example}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="two-col">
            {report.wins?.length > 0 && (
              <section className="card">
                <h2>🌟 Giỏi lắm · Wins</h2>
                <ul className="list">
                  {report.wins.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
            {report.pronunciationTips?.length > 0 && (
              <section className="card">
                <h2>🗣️ Phát âm · Pronunciation</h2>
                <ul className="list">
                  {report.pronunciationTips.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {report.corrections?.length > 0 && (
            <section className="card">
              <h2>✏️ Sửa lại · Small fixes</h2>
              {report.corrections.map((c, i) => (
                <div className="correction" key={i}>
                  <div>
                    <span className="said">{c.said}</span> → <span className="better">{c.better}</span>
                  </div>
                  <div className="muted">{c.why}</div>
                </div>
              ))}
            </section>
          )}

          {report.nextSteps?.length > 0 && (
            <section className="card">
              <h2>Lần sau · Next time</h2>
              <ul className="list">
                {report.nextSteps.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="row-gap report-actions">
            {report.nextScenarioSuggestion && getScenario(report.nextScenarioSuggestion) && (
              <button className="btn btn-primary" onClick={() => onPractice(report.nextScenarioSuggestion!)}>
                Next: {getScenario(report.nextScenarioSuggestion)!.titleVi} →
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => onPractice(session.scenarioId)}>
              Practice this again
            </button>
            <button className="btn btn-ghost" onClick={onHome}>
              All scenarios
            </button>
          </div>
        </>
      )}
    </main>
  );
}
