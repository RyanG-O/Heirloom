import { SCENARIOS } from "../../shared/scenarios";

// Placeholder shell. Session A builds: scenario picker -> call screen (live transcript) -> report.
// Mock mode (?mock=1) replays fixtures/session.*.json through the same transcript path.
export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ marginBottom: 4 }}>Heirloom</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Nói chuyện với gia đình — mix English and Vietnamese freely.</p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {SCENARIOS.map((s) => (
          <li key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <strong>{s.titleVi}</strong>
            <div style={{ color: "var(--muted)" }}>{s.title}</div>
            <p style={{ marginBottom: 0 }}>{s.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
