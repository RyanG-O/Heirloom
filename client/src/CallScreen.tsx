import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type {
  AnalyzeTurnRequest,
  ConversationTokenResponse,
  Scenario,
  Session,
  SignedUrlResponse,
  Turn,
  TurnAnalysis,
} from "../../shared/types";
import { IS_MOCK, cleanText, coachNote, getFixtureSession, personaName, postJson, readError } from "./lib";
import Transcript from "./Transcript";

const WS_KEY = "heirloom.useWebSocket";
const MOCK_TURN_MS = 1200;

type Phase = "idle" | "starting" | "live" | "ended";

function micErrorMessage(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was denied. Allow the mic for this site (lock icon in the address bar), then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Plug one in or check your system settings.";
  if (name === "NotReadableError") return "Your microphone is in use by another app. Close it and try again.";
  if (!navigator.mediaDevices?.getUserMedia) return "This browser can't access the microphone here. Use Chrome on http://localhost or an https:// URL.";
  return `Couldn't access the microphone: ${String((e as Error)?.message ?? e)}`;
}

export default function CallScreen({
  scenario,
  onBack,
  onFinish,
}: {
  scenario: Scenario;
  onBack: () => void;
  onFinish: (s: Session) => void;
}) {
  const name = personaName(scenario);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, TurnAnalysis>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [useWs, setUseWs] = useState(() => {
    try {
      return localStorage.getItem(WS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mockSpeaking, setMockSpeaking] = useState(false);
  const useWsRef = useRef(useWs);
  useWsRef.current = useWs;

  const turnsRef = useRef<Turn[]>([]);
  const analysesRef = useRef<Record<string, TurnAnalysis>>({});
  const startedAtRef = useRef<number>(Date.now());
  const startedIsoRef = useRef<string>(new Date().toISOString());
  const mockTimers = useRef<number[]>([]);
  const convRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // ---- live code-switch loop ----
  const analyze = useCallback(
    (turn: Turn) => {
      if (IS_MOCK) return; // mock mode uses fixture analyses
      const context = turnsRef.current.filter((t) => t.id !== turn.id).slice(-4);
      const body: AnalyzeTurnRequest = { turn, context, scenarioId: scenario.id };
      setPending((p) => new Set(p).add(turn.id));
      postJson<TurnAnalysis>("/api/analyze-turn", body)
        .then((a) => {
          const analysis = { ...a, turnId: turn.id };
          analysesRef.current = { ...analysesRef.current, [turn.id]: analysis };
          setAnalyses(analysesRef.current);
          const conv = convRef.current;
          if (analysis.spans?.length && conv?.status === "connected") {
            try {
              conv.sendContextualUpdate(coachNote(analysis));
            } catch {
              /* never break the call */
            }
          }
        })
        .catch(() => {
          /* analysis is best-effort */
        })
        .finally(() =>
          setPending((p) => {
            const n = new Set(p);
            n.delete(turn.id);
            return n;
          }),
        );
    },
    [scenario.id],
  );

  /** Single entry point for transcript turns (live onMessage AND mock replay). */
  const addTurn = useCallback(
    (turn: Turn, opts?: { replaceSameId?: boolean }) => {
      const text = cleanText(turn.text);
      if (!text) return;
      const t = { ...turn, text };
      const prev = turnsRef.current;
      const idx = opts?.replaceSameId ? prev.findIndex((x) => x.id === t.id) : -1;
      turnsRef.current = idx >= 0 ? prev.map((x, i) => (i === idx ? t : x)) : [...prev, t];
      setTurns(turnsRef.current);
      if (t.speaker === "user") analyze(t);
    },
    [analyze],
  );

  const conversation = useConversation({
    onConnect: () => {
      setPhase("live");
      setError(null);
    },
    onDisconnect: (details) => {
      setPhase((p) => (p === "idle" ? p : "ended"));
      if (details.reason === "error") setError(`Call disconnected: ${details.message}`);
      else if (details.reason === "agent") setNotice(`${name} ended the call.`);
    },
    onError: (message) => {
      setPhase((p) => {
        if (p !== "starting") return p;
        // Failed while connecting: reset so the user can retry or switch transport.
        setError(
          `Couldn't connect the call: ${String(message)}` +
            (useWsRef.current ? "" : ". If this keeps happening, tick “Use WebSocket” below and try again."),
        );
        try {
          convRef.current?.endSession();
        } catch {
          /* ignore */
        }
        return "idle";
      });
      setError((e) => e ?? String(message));
    },
    onMessage: ({ message, role, event_id }) => {
      addTurn(
        { id: `${role}-${event_id}`, speaker: role === "user" ? "user" : "agent", text: message, t: Date.now() - startedAtRef.current },
        { replaceSameId: true },
      );
    },
  });
  convRef.current = conversation;

  // End live session / mock timers on unmount
  useEffect(
    () => () => {
      mockTimers.current.forEach(clearTimeout);
      const c = convRef.current;
      if (c && (c.status === "connected" || c.status === "connecting")) c.endSession();
    },
    [],
  );

  const buildSession = (): Session => ({
    id: `s-${startedAtRef.current}`,
    scenarioId: scenario.id,
    startedAt: startedIsoRef.current,
    endedAt: new Date().toISOString(),
    turns: turnsRef.current,
    analyses: Object.values(analysesRef.current),
  });

  // ---- start ----
  async function startLive() {
    setError(null);
    setNotice(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // SDK opens its own stream
    } catch (e) {
      setPhase("idle");
      setError(micErrorMessage(e));
      return;
    }

    const dynamicVariables = {
      persona: scenario.persona,
      situation: scenario.situation,
      agent_calls_user: scenario.agentCallsUser,
      user_calls_agent: scenario.userCallsAgent,
      first_message: scenario.firstMessage,
      target_vocab: scenario.targetVocab.map((v) => `${v.vi} (${v.en})`).join(", "),
    };

    try {
      const url = useWs ? "/api/signed-url" : "/api/conversation-token";
      const r = await fetch(url);
      if (!r.ok) throw new Error(await readError(r));
      startedAtRef.current = Date.now();
      startedIsoRef.current = new Date().toISOString();
      if (useWs) {
        const { signedUrl } = (await r.json()) as SignedUrlResponse;
        conversation.startSession({ signedUrl, stripAudioTags: true, dynamicVariables });
      } else {
        const { token } = (await r.json()) as ConversationTokenResponse;
        conversation.startSession({ conversationToken: token, connectionType: "webrtc", stripAudioTags: true, dynamicVariables });
      }
    } catch (e) {
      setPhase("idle");
      setError(`Couldn't start the call (${useWs ? "signed URL" : "conversation token"}): ${(e as Error).message}`);
    }
  }

  function startMock() {
    const fx = getFixtureSession(scenario.id);
    if (!fx) {
      setError(`No fixture transcript for "${scenario.id}".`);
      return;
    }
    setError(null);
    setPhase("live");
    startedAtRef.current = Date.now();
    startedIsoRef.current = new Date().toISOString();
    const fxAnalyses = Object.fromEntries((fx.analyses ?? []).map((a) => [a.turnId, a]));
    fx.turns.forEach((turn, i) => {
      mockTimers.current.push(
        window.setTimeout(() => {
          setMockSpeaking(turn.speaker === "agent");
          addTurn(turn);
          const a = fxAnalyses[turn.id];
          if (a) {
            mockTimers.current.push(
              window.setTimeout(() => {
                analysesRef.current = { ...analysesRef.current, [turn.id]: a };
                setAnalyses(analysesRef.current);
              }, MOCK_TURN_MS / 2),
            );
          }
        }, 400 + i * MOCK_TURN_MS),
      );
    });
    mockTimers.current.push(
      window.setTimeout(() => {
        setMockSpeaking(false);
        setPhase("ended");
      }, 400 + fx.turns.length * MOCK_TURN_MS + 200),
    );
  }

  function endAndReport() {
    mockTimers.current.forEach(clearTimeout);
    if (!IS_MOCK && (conversation.status === "connected" || conversation.status === "connecting")) conversation.endSession();
    onFinish(buildSession());
  }

  // ---- status line ----
  const status = IS_MOCK ? (phase === "live" ? "connected" : "disconnected") : conversation.status;
  const speaking = IS_MOCK ? mockSpeaking : conversation.isSpeaking;
  let statusText = "Ready when you are";
  let statusClass = "idle";
  if (phase === "starting" || (phase === "live" && status === "connecting")) {
    statusText = "Đang kết nối… · Connecting";
    statusClass = "connecting";
  } else if (phase === "live" && status === "connected") {
    statusText = speaking ? `${name} đang nói… · Speaking` : "Đang nghe bạn… · Listening";
    statusClass = speaking ? "speaking" : "listening";
  } else if (phase === "ended") {
    statusText = "Cuộc gọi đã kết thúc · Call ended";
    statusClass = "ended";
  }

  const userTurns = turns.filter((t) => t.speaker === "user").length;
  const inCall = phase === "starting" || phase === "live";

  return (
    <main className="page call-page">
      <section className="call-card">
        <button className="link-btn back" onClick={onBack}>
          ← Scenarios
        </button>
        <div className="call-head">
          <div className={`orb ${statusClass}`}>
            <span>{name.split(" ").pop()?.[0]}</span>
          </div>
          <div>
            <div className="call-title">{scenario.titleVi}</div>
            <div className="call-sub">{scenario.title}</div>
            <div className="call-persona">{scenario.persona}</div>
          </div>
        </div>

        <div className={`status ${statusClass}`}>
          <span className="dot" /> {statusText}
        </div>

        <div className="call-actions">
          {phase === "idle" && (
            <button className="btn btn-primary btn-big" onClick={IS_MOCK ? startMock : startLive}>
              {IS_MOCK ? "▶ Replay sample call" : `📞 Gọi ${name} · Start call`}
            </button>
          )}
          {inCall && (
            <button className="btn btn-danger btn-big" onClick={endAndReport} disabled={phase === "starting"}>
              {phase === "starting" ? "Connecting…" : "End call & see report"}
            </button>
          )}
          {phase === "ended" && (
            <>
              <button className="btn btn-primary btn-big" onClick={endAndReport} disabled={userTurns === 0}>
                Xem báo cáo · See my report
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  turnsRef.current = [];
                  analysesRef.current = {};
                  setTurns([]);
                  setAnalyses({});
                  setNotice(null);
                  setError(null);
                  setPhase("idle");
                }}
              >
                Start over
              </button>
            </>
          )}
        </div>

        {!IS_MOCK && phase === "idle" && (
          <label className="ws-toggle">
            <input
              type="checkbox"
              checked={useWs}
              onChange={(e) => {
                setUseWs(e.target.checked);
                try {
                  localStorage.setItem(WS_KEY, e.target.checked ? "1" : "0");
                } catch {
                  /* ignore */
                }
              }}
            />
            Use WebSocket instead of WebRTC (try this if the call won't connect on venue Wi-Fi)
          </label>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {notice && !error && <div className="alert alert-info">{notice}</div>}
        {phase === "idle" && !error && (
          <p className="tip">
            Tip: wear headphones. Speak Vietnamese, and when you don't know a word just say it in English. {name} will
            help.
          </p>
        )}
      </section>

      <section className="transcript-card">
        <div className="section-label">Transcript</div>
        <Transcript turns={turns} analyses={analyses} agentName={name} pending={pending} />
      </section>
    </main>
  );
}
