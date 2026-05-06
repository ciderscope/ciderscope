import { useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck, FiClipboard, FiCheckCircle, FiCloud, FiAlertCircle, FiLoader, FiX, FiPieChart, FiLock } from "react-icons/fi";
import { Button } from "../ui/Button";
import { SessionCard } from "../features/SessionCard";
import { Questionnaire } from "../features/Questionnaire";
import { validateRadarAnswer } from "../features/QuestionInput";
import { Product, SessionListItem, SessionConfig, JurorAnswers, SessionStep, AppScreen, SaveStatus, PosteDay, RadarAnswer, RadarAxis, Question } from "../../types";

interface ParticipantViewProps {
  screen: AppScreen;
  sessions: SessionListItem[];
  curSess: SessionConfig | null;
  curSessId: string | null;
  jurors: string[];
  cj: string;
  ja: JurorAnswers;
  cs: number;
  saveStatus: SaveStatus;
  pendingCount: number;
  takenPostes: Record<string, string>;
  validatedSteps: Set<number>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  onValidateStep: (idx: number) => void;
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (ja: JurorAnswers) => void;
  onGoBack: () => void;
  onHome: () => void;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
  onStartFromOrder: () => void;
  summaryView: React.ReactNode | null;
  steps: SessionStep[];
  completion: boolean[];
  buildSteps: (cfg: SessionConfig, name: string) => SessionStep[];
  isStepComplete: (idx: number) => boolean;
}

const stepShortLabel = (step: SessionStep | undefined) => {
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

const SaveIndicator = ({ status, pendingCount }: { status: SaveStatus; pendingCount: number }) => {
  if (status === "idle" && pendingCount === 0) return null;
  const map = {
    idle:    { icon: <FiCloud size={13} />, text: `${pendingCount} en attente de synchronisation`, color: "#c8820a" },
    saving:  { icon: <FiLoader size={13} className="animate-spin" />, text: "Enregistrement…", color: "var(--mid)" },
    saved:   { icon: <FiCloud size={13} />, text: "Enregistré", color: "#1a6b3a" },
    pending: { icon: <FiAlertCircle size={13} />, text: `Hors-ligne — ${pendingCount} en file d'attente locale`, color: "#c8820a" },
    error:   { icon: <FiAlertCircle size={13} />, text: "Erreur serveur — réessai automatique", color: "#c0392b" },
  } as const;
  const m = map[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className="save-indicator fixed z-50 flex items-center gap-1.5 py-1.5 px-3 bg-[var(--paper)] rounded-full text-[12.5px] font-medium shadow-sm"
      style={{ border: `1px solid ${m.color}33`, color: m.color }}
    >
      {m.icon}<span>{m.text}</span>
    </div>
  );
};

// ─── Sub-components for each screen ──────────────────────────────────────────

const LandingScreen = ({ sessions, onSelectSession }: { sessions: SessionListItem[], onSelectSession: (id: string) => void }) => (
  <div className="landing">
    <h1>Bienvenue sur<br /><em>CiderScope</em></h1>
    <p className="sub">Sélectionnez une séance pour participer</p>
    <div id="landingContent">
      {sessions.length === 0 ? (
        <div className="no-session">
          <FiClipboard size={36} className="block mx-auto mb-2 text-[var(--mid)]" />
          <strong>Aucune séance active</strong>
        </div>
      ) : (
        sessions.map(s => (
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

const ConfirmModal = ({
  title, message, confirmLabel, cancelLabel, onConfirm, onCancel, tone = "default",
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  tone?: "default" | "warn";
}) => (
  <div className="modal-overlay" onClick={() => onCancel?.()}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => onCancel?.()} aria-label="Fermer"><FiX /></button>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <div className={`mt-3 text-[13.5px] leading-normal ${tone === "warn" ? "text-[#8a4a00]" : "text-[var(--ink)]"}`}>
        {message}
      </div>
      <div className="flex gap-2 justify-end mt-5 flex-wrap">
        {cancelLabel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel?.()}>{cancelLabel}</Button>
        )}
        <Button size="sm" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
);

const PosteScreen = ({
  curSess, cj, takenPostes, onSelectPoste, onGoBack,
}: {
  curSess: SessionConfig | null;
  cj: string;
  takenPostes: Record<string, string>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  onGoBack: () => void;
}) => {
  const days: PosteDay[] = ["mardi", "jeudi"];
  const numbers = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div className="poste-screen">
      <h2>Choisissez votre poste</h2>
      <p className="hint">{curSess?.name} — {cj}</p>
      <div className="info-box text-center !border-l-0 !border-b-2 !border-b-[var(--accent)] mt-2 mb-6 shadow-sm">
        Sélectionnez le numéro indiqué sur votre poste.
      </div>
      <div className="poste-grid">
        {days.map(d => (
          <div key={d} className="poste-col">
            <h3 className="poste-col-title">{d.charAt(0).toUpperCase() + d.slice(1)}</h3>
            <div className="poste-list">
              {numbers.map(n => {
                const key = `${d}-${n}`;
                const owner = takenPostes[key];
                const taken = !!owner && owner !== cj;
                const mine = owner === cj;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`poste-btn ${taken ? "taken" : ""} ${mine ? "mine" : ""}`}
                    onClick={() => !taken && onSelectPoste(d, n)}
                    disabled={taken}
                    title={taken ? `Pris par ${owner}` : `Poste ${n}`}
                  >
                    <span className="poste-num">{n}</span>
                    {taken && <span className="poste-owner">{owner}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt16" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
    </div>
  );
};

const JuryLoginScreen = ({ curSess, jurors, onLoginJury, onHome }: { curSess: SessionConfig | null, jurors: string[], onLoginJury: (name: string) => void, onHome: () => void }) => {
  const [name, setName] = useState("");
  const submit = () => { if (name.trim()) onLoginJury(name.trim()); };
  return (
    <div className="jury-login">
      <h2>Identifiez-vous</h2>
      <p className="hint">{curSess?.name}</p>
      <div className="jury-input-wrap">
        <input
          type="text"
          placeholder="Votre prénom…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <Button onClick={submit}>
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
};

// Écran "Ordre de service" — affiché une fois après la sélection du poste,
// avant le questionnaire. Liste l'ordre des codes échantillons personnel au
// jury : un ordre global pour les évaluations multi-produits (radar/scale
// par produit, classement, seuil) puis, séparément, l'ordre spécifique de
// chaque test discriminatif (triangulaire, duo-trio) qui a ses propres codes.
const OrderScreen = ({
  curSess, cj, steps, onStart, onGoBack,
}: {
  curSess: SessionConfig;
  cj: string;
  steps: SessionStep[];
  onStart: () => void;
  onGoBack: () => void;
}) => {
  // Ordre global : codes des "product" steps dans l'ordre, sans doublons.
  const globalOrder: string[] = [];
  for (const s of steps) {
    if (s.type === "product" && !globalOrder.includes(s.product.code)) {
      globalOrder.push(s.product.code);
    }
  }
  // Si aucun "product" step (séance 100 % discrim/global), repli sur l'ordre
  // brut des produits déclarés en config.
  if (globalOrder.length === 0) {
    for (const p of curSess.products || []) globalOrder.push(p.code);
  }

  type SerieOrder = { kind: string; label: string; codes: string[] };
  const serieOrders: SerieOrder[] = [];
  const kindLabel: Record<string, string> = {
    triangulaire: "Triangulaire",
    "duo-trio": "Duo-trio",
    classement: "Classement",
    seuil: "Seuil de perception",
  };
  for (const s of steps) {
    if (s.type === "discrim" || s.type === "ranking") {
      const q = s.question;
      const codes = q.codes || [];
      if (codes.length === 0) continue;
      // Pour classement/seuil dont les codes sont déjà l'ordre global → on saute.
      if ((q.type === "classement" || q.type === "seuil") &&
          codes.length === globalOrder.length &&
          codes.every((c, i) => c === globalOrder[i])) {
        continue;
      }
      serieOrders.push({
        kind: q.type,
        label: `${kindLabel[q.type] || q.type} — ${q.label}`,
        codes,
      });
    }
  }

  const hasMulti = globalOrder.length > 1 || serieOrders.length > 0;

  return (
    <div className="order-screen">
      <h2>Ordre de service</h2>
      <p className="hint">{curSess.name} — {cj}</p>
      <p className="text-[13.5px] text-[var(--mid)] mt-1 mb-5">
        Disposez vos échantillons devant vous dans l&apos;ordre indiqué ci-dessous,
        de gauche à droite.
      </p>

      {!hasMulti ? (
        <div className="order-empty">
          Aucun échantillon multiple à classer dans cette séance.
        </div>
      ) : (
        <>
          {globalOrder.length > 1 && (
            <div className="order-block">
              <div className="order-block-title">Ordre principal</div>
              <ol className="order-list">
                {globalOrder.map((c, i) => (
                  <li key={c} className="order-item">
                    <span className="order-pos">{i + 1}</span>
                    <span className="order-code">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {serieOrders.map((s, idx) => (
            <div key={idx} className="order-block">
              <div className="order-block-title">{s.label}</div>
              <ol className="order-list">
                {s.codes.map((c, i) => (
                  <li key={c + i} className="order-item">
                    <span className="order-pos">{i + 1}</span>
                    <span className="order-code">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}

      <div className="flex gap-3 justify-between flex-wrap mt-5">
        <Button variant="ghost" size="sm" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
        <Button onClick={onStart}>J&apos;ai mes échantillons <FiArrowRight /></Button>
      </div>
    </div>
  );
};

const FormScreen = ({
  curSess, cj, steps, completion, cs, ja, onSetJa, onGoBack, onPrevStep, onNextStep, saveStatus, pendingCount,
  validatedSteps, onValidateStep,
}: {
  curSess: SessionConfig, cj: string, steps: SessionStep[], completion: boolean[], cs: number, ja: JurorAnswers, onSetJa: (ja: JurorAnswers) => void,
  onGoBack: () => void, onPrevStep: () => void, onNextStep: () => void,
  saveStatus: SaveStatus, pendingCount: number,
  validatedSteps: Set<number>, onValidateStep: (idx: number) => void,
}) => {
  const products: Product[] = curSess.products || [];
  const total = steps.length;
  let doneCount = 0;
  for (const c of completion) if (c) doneCount++;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const canAdvance = completion[cs] ?? true;
  const isLastStep = cs >= total - 1;
  const prevAlreadyValidated = cs > 0 && validatedSteps.has(cs - 1);

  const [confirmNext, setConfirmNext] = useState(false);
  const [confirmPrev, setConfirmPrev] = useState(false);
  const [radarIssues, setRadarIssues] = useState<{ untouched: string[]; emptyChildren: string[] } | null>(null);

  // Pour l'étape courante : si elle contient une toile d'araignée, on calcule
  // les familles non touchées / non précisées avant de laisser passer.
  const currentStep = steps[cs];
  const radarValidation = (() => {
    if (!currentStep || currentStep.type !== "product") return null;
    const radarQ: Question | undefined = currentStep.questions.find(q => q.type === "radar");
    if (!radarQ || !radarQ.radarGroups) return null;
    const axes: RadarAxis[] = radarQ.radarGroups.flatMap(g => g.axes);
    const ans = (ja[currentStep.product.code]?.[radarQ.id]) as RadarAnswer | undefined;
    const min = radarQ.min ?? 0;
    return { axes, ans: ans || {}, min };
  })();

  const handleNextClick = () => {
    if (!canAdvance) return;
    if (radarValidation) {
      const issues = validateRadarAnswer(radarValidation.ans, radarValidation.axes, radarValidation.min);
      if (issues.untouched.length > 0 || issues.emptyChildren.length > 0) {
        setRadarIssues(issues);
        return;
      }
    }
    setConfirmNext(true);
  };
  const handleConfirmNext = () => {
    onValidateStep(cs);
    setConfirmNext(false);
    onNextStep();
  };
  const handlePrevClick = () => {
    if (cs === 0) return;
    if (prevAlreadyValidated) {
      setConfirmPrev(true);
    } else {
      onPrevStep();
    }
  };
  const handleConfirmPrev = () => {
    setConfirmPrev(false);
    onPrevStep();
  };

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

        <div className="form-progress-wrap px-4 mt-1">
          <div className="flex justify-between text-[12.5px] text-[var(--mid)] mb-1.5">
            <span><strong className="text-[var(--ink)] font-bold">Étape {cs + 1}</strong> / {total}</span>
            <span>{doneCount} / {total} complétées · {pct}%</span>
          </div>
          <div className="h-2 bg-[var(--paper2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-200 ease-in-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="step-list flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
            {steps.map((s, i) => {
              const complete = completion[i] ?? false;
              const active = i === cs;
              const bg = active ? "var(--accent)" : complete ? "#1a6b3a22" : "var(--paper2)";
              const col = active ? "#fff" : complete ? "#1a6b3a" : "var(--mid)";
              return (
                <div
                  key={i}
                  title={`Étape ${i + 1}${complete ? " — complète" : ""}`}
                  className={`step-item flex-none px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap ${active ? "active font-bold" : "font-semibold"} ${complete ? "complete" : ""}`}
                  style={{ background: bg, color: col }}
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
            <span className="text-[11px] text-[#c0392b]">Répondez à la question pour continuer.</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handlePrevClick} className={cs === 0 ? "invisible" : "visible"}>
          <FiArrowLeft />
        </Button>
        <Button
          size="sm"
          onClick={handleNextClick}
          disabled={!canAdvance}
          className={!canAdvance ? "opacity-50 cursor-not-allowed" : ""}
        >
          {isLastStep ? <><FiCheck /> Terminer</> : <>Valider <FiArrowRight /></>}
        </Button>
      </div>
      <SaveIndicator status={saveStatus} pendingCount={pendingCount} />

      {confirmNext && (
        <ConfirmModal
          tone="warn"
          title={isLastStep ? "Terminer le questionnaire ?" : "Valider cet échantillon ?"}
          message={
            isLastStep ? (
              <>Une fois vos réponses envoyées, vous ne pourrez plus modifier celles de cette séance sans autorisation. Confirmer la validation finale ?</>
            ) : (
              <>Une fois validé, vous passerez à l&apos;échantillon suivant et il <strong>ne sera plus possible de revenir en arrière</strong> sans autorisation. Continuer ?</>
            )
          }
          confirmLabel={isLastStep ? "Terminer" : "Valider et continuer"}
          cancelLabel="Annuler"
          onConfirm={handleConfirmNext}
          onCancel={() => setConfirmNext(false)}
        />
      )}

      {confirmPrev && (
        <ConfirmModal
          tone="warn"
          title="Revenir à l'échantillon précédent ?"
          message={<>Cet échantillon a déjà été validé. Avez-vous reçu l&apos;<strong>autorisation de l&apos;animateur</strong> pour revenir en arrière ?</>}
          confirmLabel="Oui, j'ai l'autorisation"
          cancelLabel="Non, annuler"
          onConfirm={handleConfirmPrev}
          onCancel={() => setConfirmPrev(false)}
        />
      )}

      {radarIssues && (
        <ConfirmModal
          tone="warn"
          title="Toile d'araignée — vérification"
          message={
            <div className="flex flex-col gap-2.5">
              {radarIssues.untouched.length > 0 && (
                <div>
                  <strong>Curseurs jamais validés :</strong>
                  <ul className="mt-1 ml-4 list-disc">
                    {radarIssues.untouched.map(f => <li key={f}><em>{f}</em></li>)}
                  </ul>
                  <p className="text-[12.5px] text-[var(--mid)] mt-1">
                    Touchez le pouce de chaque curseur (au moins une fois) pour confirmer votre évaluation, y compris si l&apos;intensité est nulle.
                  </p>
                </div>
              )}
              {radarIssues.emptyChildren.length > 0 && (
                <div>
                  <strong>Familles évaluées sans aucune classe précisée :</strong>
                  <ul className="mt-1 ml-4 list-disc">
                    {radarIssues.emptyChildren.map(f => <li key={f}><em>{f}</em></li>)}
                  </ul>
                  <p className="text-[12.5px] text-[var(--mid)] mt-1">
                    Si une famille a une intensité &gt; 0, dépliez-la (bouton +) et notez au moins une de ses classes.
                  </p>
                </div>
              )}
            </div>
          }
          confirmLabel="Compris, je corrige"
          onConfirm={() => setRadarIssues(null)}
          onCancel={() => setRadarIssues(null)}
        />
      )}
    </>
  );
};

const DoneScreen = ({
  onReviewAnswers, onHome, onShowSummary, resultsVisible,
}: {
  onReviewAnswers: () => void;
  onHome: () => void;
  onShowSummary: () => void;
  resultsVisible: boolean;
}) => {
  const [confirmReview, setConfirmReview] = useState(false);
  return (
    <div className="done-screen">
      <div className="done-icon"><FiCheckCircle size={48} color="var(--ok)" /></div>
      <h2>Merci !</h2>
      <p>Réponses enregistrées.</p>

      <div className="done-summary-row">
        <button
          type="button"
          className={`done-summary-btn ${resultsVisible ? "done-summary-btn--ready" : "done-summary-btn--locked"}`}
          onClick={() => resultsVisible && onShowSummary()}
          disabled={!resultsVisible}
          aria-disabled={!resultsVisible}
          title={resultsVisible ? "Voir le résumé du panel" : "L'animateur n'a pas encore débloqué le résumé"}
        >
          {resultsVisible ? <FiPieChart size={16} /> : <FiLock size={16} />}
          <span>{resultsVisible ? "Voir le résumé du panel" : "Résumé en attente de l'animateur…"}</span>
        </button>
        {!resultsVisible && (
          <p className="done-summary-hint">Le bouton deviendra cliquable dès que l&apos;animateur l&apos;aura autorisé.</p>
        )}
      </div>

      <div className="flex gap-3 justify-center flex-wrap mt-4">
        <Button variant="ghost" size="sm" onClick={() => setConfirmReview(true)}>Revoir mes réponses</Button>
        <Button variant="secondary" onClick={onHome}><FiArrowLeft /> Retour</Button>
      </div>

      {confirmReview && (
        <ConfirmModal
          tone="warn"
          title="Revoir mes réponses ?"
          message={<>Avez-vous reçu l&apos;<strong>autorisation de l&apos;animateur</strong> pour modifier vos réponses terminées ?</>}
          confirmLabel="Oui, j'ai l'autorisation"
          cancelLabel="Non, annuler"
          onConfirm={() => {
            setConfirmReview(false);
            onReviewAnswers();
          }}
          onCancel={() => setConfirmReview(false)}
        />
      )}
    </div>
  );
};

const SummaryScreen = ({ children, onBack }: { children: React.ReactNode; onBack: () => void }) => (
  <div className="summary-shell">
    <div className="flex items-center gap-2 mb-3">
      <Button variant="ghost" size="sm" onClick={onBack}><FiArrowLeft /> Retour</Button>
    </div>
    {children}
  </div>
);

export const ParticipantView = ({
  screen, sessions, curSess, curSessId, jurors, cj, ja, cs, saveStatus, pendingCount,
  takenPostes, validatedSteps, onSelectPoste, onValidateStep,
  onSelectSession, onLoginJury, onPrevStep, onNextStep, onSetJa, onGoBack, onHome, onReviewAnswers,
  onShowSummary, onStartFromOrder, summaryView,
  steps, completion,
}: ParticipantViewProps) => {
  const activeSessions = sessions.filter(s => s.active);

  // resultsVisible vient de la liste des séances ; on l'extrait ici pour le DoneScreen.
  const currentSession = curSessId ? sessions.find(s => s.id === curSessId) : null;
  const resultsVisible = !!currentSession?.resultsVisible;

  switch (screen) {
    case "landing":
      return <LandingScreen sessions={activeSessions} onSelectSession={onSelectSession} />;
    case "jury":
      return <JuryLoginScreen curSess={curSess} jurors={jurors} onLoginJury={onLoginJury} onHome={onHome} />;
    case "poste":
      return (
        <PosteScreen
          curSess={curSess}
          cj={cj}
          takenPostes={takenPostes}
          onSelectPoste={onSelectPoste}
          onGoBack={onGoBack}
        />
      );
    case "order":
      if (!curSess) return null;
      return (
        <OrderScreen
          curSess={curSess}
          cj={cj}
          steps={steps}
          onStart={onStartFromOrder}
          onGoBack={onGoBack}
        />
      );
    case "form":
      if (!curSess) return null;
      return (
        <FormScreen
          curSess={curSess} cj={cj} steps={steps} completion={completion} cs={cs} ja={ja}
          onSetJa={onSetJa} onGoBack={onGoBack} onPrevStep={onPrevStep} onNextStep={onNextStep}
          saveStatus={saveStatus} pendingCount={pendingCount}
          validatedSteps={validatedSteps} onValidateStep={onValidateStep}
        />
      );
    case "done":
      return (
        <DoneScreen
          onReviewAnswers={onReviewAnswers}
          onHome={onHome}
          onShowSummary={onShowSummary}
          resultsVisible={resultsVisible}
        />
      );
    case "summary":
      return <SummaryScreen onBack={() => onHome()}>{summaryView}</SummaryScreen>;
    default:
      return null;
  }
};