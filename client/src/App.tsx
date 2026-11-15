import { useState } from "react";
import { SCENARIOS, getScenario } from "../../shared/scenarios";
import type { Session } from "../../shared/types";
import { IS_MOCK, personaName } from "./lib";
import CallScreen from "./CallScreen";
import ReportView from "./ReportView";

type View = { name: "picker" } | { name: "call"; scenarioId: string; key: number } | { name: "report"; session: Session };

export default function App() {
  const [view, setView] = useState<View>({ name: "picker" });
  const go = (scenarioId: string) => setView({ name: "call", scenarioId, key: Date.now() });

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: "picker" })}>
          <span className="brand-mark">H</span> Heirloom
        </button>
        {IS_MOCK && <span className="pill pill-mock">Mock mode</span>}
      </header>

      {view.name === "picker" && (
        <main className="page">
          <section className="hero">
            <h1>Nói chuyện với gia đình.</h1>
            <p>
              Practice real conversations with your family in Vietnamese. Mix in English whenever you get stuck; your
              relative will gently fill in the words you're missing.
            </p>
          </section>
          <h2 className="section-label">Chọn tình huống · Pick a conversation</h2>
          <div className="scenario-grid">
            {SCENARIOS.map((s) => (
              <button key={s.id} className="scenario-card" onClick={() => go(s.id)} data-scenario={s.id}>
                <div className="scenario-avatar">{personaName(s).split(" ").pop()?.[0]}</div>
                <div className="scenario-body">
                  <div className="scenario-title-vi">{s.titleVi}</div>
                  <div className="scenario-title-en">{s.title}</div>
                  <p className="scenario-desc">{s.description}</p>
                  <div className="vocab-row">
                    {s.targetVocab.slice(0, 4).map((v) => (
                      <span key={v.vi} className="vocab-chip" title={v.en}>
                        {v.vi}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      {view.name === "call" && getScenario(view.scenarioId) && (
        <CallScreen
          key={view.key}
          scenario={getScenario(view.scenarioId)!}
          onBack={() => setView({ name: "picker" })}
          onFinish={(session) => setView({ name: "report", session })}
        />
      )}

      {view.name === "report" && (
        <ReportView session={view.session} onPractice={go} onHome={() => setView({ name: "picker" })} />
      )}
    </div>
  );
}
