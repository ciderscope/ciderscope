import { FiArrowLeft, FiArrowRight, FiCheck, FiClipboard, FiCheckCircle } from "react-icons/fi";
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
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (ja: any) => void;
  onGoBack: () => void;
  onHome: () => void;
  onReviewAnswers: () => void;
  buildSteps: (cfg: any, name: string) => any[];
}

export const ParticipantView = ({
  screen, sessions, curSess, jurors, cj, ja, cs,
  onSelectSession, onLoginJury, onPrevStep, onNextStep, onSetJa, onGoBack, onHome, onReviewAnswers, buildSteps
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
          <Questionnaire
            steps={steps}
            currentStepIdx={cs}
            ja={ja}
            setJa={onSetJa}
            products={products}
          />
        </div>
        <div className="product-nav">
          <div className="product-nav-info"></div>
          <Button variant="ghost" size="sm" onClick={onPrevStep} style={{ display: cs === 0 ? "none" : "" }}>
            <FiArrowLeft />
          </Button>
          <Button size="sm" onClick={onNextStep}>
            {cs >= steps.length - 1 ? <><FiCheck /> Terminer</> : <>Suivant <FiArrowRight /></>}
          </Button>
        </div>
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
