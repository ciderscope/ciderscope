import { FiArrowLeft, FiArrowRight, FiCheck, FiClipboard, FiCheckCircle, FiCloud, FiAlertCircle, FiLoader } from "react-icons/fi";
import { Button } from "../ui/Button";
import { SessionCard } from "../features/SessionCard";
import { Questionnaire } from "../features/Questionnaire";
import { Product } from "../../types";

interface ParticipantViewProps {
  screen: "landing" | "jury" | "form" | "done" | "edit";
  sessions: any[];
  curSess: any;
  jurors: string[];
  cj: string;
  ja: any;
  cs: number;
  saveStatus: "idle" | "saving" | "saved" | "error" | "pending";
  pendingCount: number;
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (ja: any) => void;
  onGoBack: () => void;
  onHome: () => void;
  onReviewAnswers: () => void;
  buildSteps: (cfg: any, name: string) => any[];
  isStepComplete: (idx: number) => boolean;
}

const stepShortLabel = (step: any) => {
  if (!step) return "";
  if (step.type === "product") return step.product.code;
  if (step.type === "ranking") return step.question.type === "seuil" ? "Seuil" : "Rang";
  if (step.type === "discrim") {
    if (step.question.type === "triangulaire") return "△";
    if (step.question.type === "duo-trio") return "D/T";
    if (step.question.type === "a-non-a") return "A/¬A";
    return "Test";
  }
  if (step.type === "global") return "Général";
  return "•";
};

const SaveIndicator = ({ status, pendingCount }: { status: "idle" | "saving" | "saved" | "error" | "pending"; pendingCount: number }) => {
  if (status === "idle" && pendingCount === 0) return null;
  const map = {
    idle:    { icon: <FiCloud size={13} />, text: `${pendingCount} en attente de synchronisation`, color: "#c8820a" },
    saving:  { icon: <FiLoader size={13} style={{ animation: "spin 1s linear infinite" }} />, text: "Enregistrement…", color: "var(--mid)" },
    saved:   { icon: <FiCloud size={13} />, text: "Enregistré", color: "#1a6b3a" },
    pending: { icon: <FiAlertCircle size={13} />, text: `Hors-ligne — ${pendingCount} en file d'attente locale`, color: "#c8820a" },
    error:   { icon: <FiAlertCircle size={13} />, text: "Erreur serveur — réessai automatique", color: "#c0392b" },
  } as const;
  const m = map[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className="save-indicator"
      style={{
        position: "fixed", zIndex: 50,
        display: "flex", alignItems: "center", gap: "6px",
        padding: "6px 10px", background: "var(--paper)", border: `1px solid ${m.color}22`,
        borderRadius: "999px", fontSize: "12px", color: m.color,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {m.icon}<span>{m.text}</span>
    </div>
  );
};

export const ParticipantView = ({
  screen, sessions, curSess, jurors, cj, ja, cs, saveStatus, pendingCount,
  onSelectSession, onLoginJury, onPrevStep, onNextStep, onSetJa, onGoBack, onHome, onReviewAnswers, buildSteps, isStepComplete,
}: ParticipantViewProps) => {
  const activeSessions = sessions.filter(s => s.active);

  if (screen === "landing") {
    return (
      <div className="landing">
        <h1>Bienvenue sur<br /><em>CiderScope</em></h1>
        <p className="sub">Sélectionnez une séance pour participer</p>
        <div id="landingContent">
          {activeSessions.length === 0 ? (
            <div className="no-session">
              <FiClipboard size={36} style={{ margin: "0 auto 8px", display: "block", color: "var(--mid)" }} />
              <strong>Aucune séance active</strong>
            </div>
          ) : (
            activeSessions.map(s => (
              <SessionCard
                key={s.id}
                name={s.name}
                date={s.date}
                jurorCount={s.jurorCount}
                productCount={s.productCount}
                questionCount={s.questionCount}
                onClick={() => onSelectSession(s.id)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  if (screen === "jury") {
    return (
      <div className="jury-login">
        <h2>Identifiez-vous</h2>
        <p className="hint">{curSess?.name}</p>
        <div className="jury-input-wrap">
          <input
            type="text"
            placeholder="Votre prénom…"
            onKeyDown={(e) => e.key === "Enter" && onLoginJury((e.target as HTMLInputElement).value)}
            id="juryNameInput"
          />
        </div>
        <Button onClick={() => onLoginJury((document.getElementById("juryNameInput") as HTMLInputElement).value)}>
          Commencer <FiArrowRight />
        </Button>
        {jurors.length > 0 && (
          <div className="jury-existing">
            <div className="jury-existing-title">Reprendre :</div>
            <div className="jury-existing-grid">
              {jurors.map(n => (
                <button key={n} className="jury-existing-btn" onClick={() => onLoginJury(n)}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="mt16" onClick={onHome}><FiArrowLeft /> Retour</Button>
      </div>
    );
  }

  if (screen === "form" && curSess) {
    const steps = buildSteps(curSess, cj);
    const products: Product[] = curSess.products || [];
    const total = steps.length;
    const done = steps.filter((_, i) => isStepComplete(i)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const canAdvance = isStepComplete(cs);
    return (
      <>
        <div className="form-shell">
          <div className="form-header">
            <div>
              <div className="jury-name">{cj}</div>
              <div className="session-name">{curSess.name}</div>
            </div>
            <div className="form-header-sep"></div>
            <Button variant="ghost" size="sm" onClick={onGoBack}><FiArrowLeft /> Changer</Button>
          </div>

          <div className="form-progress-wrap" style={{ padding: "0 16px", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--mid)", marginBottom: "4px" }}>
              <span>Étape {cs + 1} / {total}</span>
              <span>{done} / {total} complétées ({pct}%)</span>
            </div>
            <div style={{ height: "6px", background: "var(--paper2)", borderRadius: "999px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", width: `${pct}%`, background: "var(--accent)",
                  transition: "width 200ms ease",
                }}
              />
            </div>
            <div className="step-list" style={{ display: "flex", gap: "4px", marginTop: "8px", overflowX: "auto", paddingBottom: "4px" }}>
              {steps.map((s, i) => {
                const complete = isStepComplete(i);
                const active = i === cs;
                const bg = active ? "var(--accent)" : complete ? "#1a6b3a22" : "var(--paper2)";
                const col = active ? "#fff" : complete ? "#1a6b3a" : "var(--mid)";
                return (
                  <div
                    key={i}
                    title={`Étape ${i + 1}${complete ? " — complète" : ""}`}
                    className={`step-item ${active ? "active" : ""} ${complete ? "complete" : ""}`}
                    style={{
                      flex: "0 0 auto", padding: "3px 8px",
                      background: bg, color: col,
                      borderRadius: "999px", fontSize: "10px", fontWeight: active ? 700 : 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stepShortLabel(s)}{complete && !active ? " ✓" : ""}
                  </div>
                );
              })}
            </div>
          </div>

          <Questionnaire
            steps={steps}
            currentStepIdx={cs}
            ja={ja}
            setJa={onSetJa}
            products={products}
            jurorName={cj}
          />
        </div>
        <div className="product-nav">
          <div className="product-nav-info">
            {!canAdvance && (
              <span style={{ fontSize: "11px", color: "#c0392b" }}>Répondez à la question pour continuer.</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onPrevStep} style={{ display: cs === 0 ? "none" : "" }}>
            <FiArrowLeft />
          </Button>
          <Button
            size="sm"
            onClick={onNextStep}
            disabled={!canAdvance}
            style={{ opacity: canAdvance ? 1 : 0.5, cursor: canAdvance ? "pointer" : "not-allowed" }}
          >
            {cs >= steps.length - 1 ? <><FiCheck /> Terminer</> : <>Suivant <FiArrowRight /></>}
          </Button>
        </div>
        <SaveIndicator status={saveStatus} pendingCount={pendingCount} />
      </>
    );
  }

  if (screen === "done") {
    return (
      <div className="done-screen">
        <div className="done-icon"><FiCheckCircle size={48} color="var(--ok)" /></div>
        <h2>Merci !</h2>
        <p>Réponses enregistrées.</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="ghost" size="sm" onClick={onReviewAnswers}>Revoir mes réponses</Button>
          <Button variant="secondary" onClick={onHome}><FiArrowLeft /> Retour</Button>
        </div>
      </div>
    );
  }

  return null;
};
