import { useEffect, useRef } from "react";
import type { Turn, TurnAnalysis } from "../../shared/types";
import { segmentText } from "./lib";

export default function Transcript({
  turns,
  analyses,
  agentName,
  pending,
}: {
  turns: Turn[];
  analyses: Record<string, TurnAnalysis>;
  agentName: string;
  pending: Set<string>;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, Object.keys(analyses).length]);

  if (!turns.length) return <div className="transcript-empty">The conversation will appear here.</div>;

  return (
    <div className="transcript">
      {turns.map((t) => {
        const a = analyses[t.id];
        return (
          <div key={t.id} className={`bubble-row ${t.speaker}`}>
            <div className="bubble-who">{t.speaker === "agent" ? agentName : "Bạn · You"}</div>
            <div className={`bubble ${t.speaker}`}>
              {segmentText(t.text, a?.spans).map((seg, i) =>
                seg.span ? (
                  <span key={i} className="cs" title={seg.span.note ?? `${seg.span.english} → ${seg.span.vietnamese}`}>
                    <span className="cs-en">{seg.text}</span>
                    <span className="cs-vi">{seg.span.vietnamese}</span>
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
              {t.speaker === "user" && pending.has(t.id) && <span className="analyzing">analyzing…</span>}
            </div>
            {t.speaker === "user" && a && a.spans.length > 0 && a.fullVietnamese && (
              <div className="full-vi">
                <span className="full-vi-label">Toàn tiếng Việt:</span> {a.fullVietnamese}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
