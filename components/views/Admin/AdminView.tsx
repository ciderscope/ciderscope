"use client";
import React, { useMemo, useState, Dispatch, SetStateAction } from "react";
import dynamic from "next/dynamic";
import { FiEdit2, FiCopy, FiX, FiCheck, FiArrowLeft, FiPlus, FiBarChart2, FiList, FiPieChart, FiCalendar } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { DangerGhostButton, ConfirmDialog } from "../../ui/ViewPrimitives";
import { SessionConfig, SessionListItem, AllAnswers, CSVRow, AppScreen } from "../../../types";
import { adminFieldGridClass, chipRemoveButtonClass } from "./utils";
import { parseIsoDate, toIsoDate } from "../../../lib/slots/dates";

// Import subcomponents
import { ParticipantsTab } from "./ParticipantsTab";
import { QuestionBuilder } from "./QuestionBuilder";
import { SlotAdminView } from "./SlotAdminView";
import { AdminHelpNotifications } from "./AdminHelpNotifications";

const adminShellClass = "mx-auto max-w-full overflow-x-clip px-[22px] py-7 pb-[60px] sm:max-w-[95%] supports-[not(overflow-x:clip)]:overflow-x-hidden";
const sessionCardClass = "mb-2.5 flex max-w-full min-w-0 flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] px-5 py-[18px] shadow-[var(--shadow)] transition-[box-shadow,border-color] duration-150 hover:border-[rgba(30,46,46,.18)] hover:shadow-[0_3px_16px_rgba(30,46,46,.09)]";
const sessionListClass = "grid gap-2 min-[721px]:grid-cols-2 min-[721px]:gap-2.5 min-[901px]:gap-2 xl:grid-cols-3 min-[1600px]:grid-cols-4";
const adminEditHeaderClass = "sticky top-[60px] z-40 mb-3 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--paper2)] px-0.5 pt-2 pb-3.5 min-[481px]:gap-3.5 min-[481px]:px-1 min-[481px]:pt-2.5 min-[481px]:pb-[18px]";
const editTabsClass = "mb-[22px] flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--paper2)] p-1 min-[481px]:gap-1.5 min-[481px]:p-1.5";
const editTabClass = (active: boolean) => [
  "inline-flex min-h-10 flex-1 basis-auto cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-[9px] text-[13px] font-semibold text-[var(--mid)] transition-[background,color,border-color] duration-100 hover:bg-[var(--paper)] hover:text-[var(--ink)] max-[480px]:min-w-0 max-[480px]:[&>svg]:hidden min-[481px]:min-h-11 min-[481px]:min-w-[140px] min-[481px]:px-4 min-[481px]:py-[11px] min-[481px]:text-sm",
  active ? "border-[var(--border-strong)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_1px_3px_rgba(0,0,0,.08)] [&>svg]:text-[var(--accent)]" : "",
].filter(Boolean).join(" ");

type SaveSessionResult = {
  success: boolean;
  sessionId?: string;
  sessionName?: string;
};

type SlotCreationMode = "none" | "sessionDate" | "range";

const weekdays = [
  { id: 1, label: "Lun." },
  { id: 2, label: "Mar." },
  { id: 3, label: "Mer." },
  { id: 4, label: "Jeu." },
  { id: 5, label: "Ven." },
  { id: 6, label: "Sam." },
  { id: 0, label: "Dim." },
];

const buildRangeDates = (startValue: string, endValue: string, selectedWeekdays: number[]) => {
  const start = parseIsoDate(startValue);
  const end = parseIsoDate(endValue);
  if (!start || !end || selectedWeekdays.length === 0) return [];

  const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day, 12));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day, 12));
  if (startDate.getTime() > endDate.getTime()) return [];

  const dates: string[] = [];
  for (
    let current = new Date(startDate);
    current.getTime() <= endDate.getTime();
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1, 12))
  ) {
    if (selectedWeekdays.includes(current.getUTCDay())) {
      dates.push(toIsoDate(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
    }
  }
  return dates;
};

// AnalyseView (Chart.js, calculs lourds) chargée à la demande.
const AnalyseView = dynamic(() => import("../Analyse/AnalyseView").then(m => m.AnalyseView), {
  ssr: false,
  loading: () => <div className="p-8 text-[var(--mid)]">Chargement de l&apos;analyse…</div>,
});

interface AdminViewProps {
  screen: AppScreen;
  sessions: SessionListItem[];
  editCfg: SessionConfig | null;
  curEditTab: string;
  editSessId: string | null;
  adminSection: "seances" | "creneaux" | "analyse";
  setAdminSection: (v: "seances" | "creneaux" | "analyse") => void;
  onNewSession: () => void;
  onEditSession: (id: string) => void;
  onToggleActive: (id: string) => void;
  onToggleResultsVisible: (id: string) => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSetEditCfg: Dispatch<SetStateAction<SessionConfig | null>>;
  onSetEditTab: (tab: string) => void;
  onSaveEdit: () => Promise<SaveSessionResult | void> | SaveSessionResult | void;
  onGoBack: () => void;
  downloadCSV: (rows: CSVRow[], filename: string) => void;
  listJurorsForSession: (id: string) => Promise<string[]>;
  deleteJury: (sessionId: string, name: string) => Promise<{ success: boolean } | undefined>;
  // Analyse props
  allAnswers: AllAnswers;
  anSessId: string | null;
  anCfg: SessionConfig | null;
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
}

export const AdminView = ({
  screen, sessions, editCfg, curEditTab, editSessId,
  adminSection, setAdminSection,
  onNewSession, onEditSession, onToggleActive, onToggleResultsVisible, onDuplicateSession, onDeleteSession,
  onSetEditCfg, onSetEditTab, onSaveEdit, onGoBack, downloadCSV,
  listJurorsForSession, deleteJury,
  allAnswers, anSessId, anCfg, curAnT, onAnSessChange, onAnTabChange,
}: AdminViewProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [slotMode, setSlotMode] = useState<SlotCreationMode>("none");
  const [slotRangeStart, setSlotRangeStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotRangeEnd, setSlotRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotWeekdays, setSlotWeekdays] = useState<number[]>([2, 4]);
  const [slotMessage, setSlotMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const helpSessionId = screen === "edit" ? editSessId : (adminSection === "analyse" ? anSessId : null);
  const helpSessionName = helpSessionId
    ? (helpSessionId === editSessId ? editCfg?.name : anCfg?.name) || sessions.find(s => s.id === helpSessionId)?.name
    : undefined;

  const pendingSlotDates = useMemo(() => {
    if (!editCfg || slotMode === "none") return [];
    if (slotMode === "sessionDate") return parseIsoDate(editCfg.date) ? [editCfg.date] : [];
    return buildRangeDates(slotRangeStart, slotRangeEnd, slotWeekdays);
  }, [editCfg, slotMode, slotRangeEnd, slotRangeStart, slotWeekdays]);

  const createSlotsForSession = async (sessionId: string, sessionName: string) => {
    if (pendingSlotDates.length === 0) return;
    const response = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotDates: pendingSlotDates,
        sessionId,
        sessionName,
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      created?: unknown[];
      skipped?: unknown[];
    };

    if (!response.ok || !payload.ok) {
      throw new Error(payload.detail || payload.error || "Creation des creneaux impossible.");
    }

    const createdCount = payload.created?.length || 0;
    const skippedCount = payload.skipped?.length || 0;
    setSlotMessage({
      kind: "ok",
      text: skippedCount > 0
        ? `${createdCount} creneau(x) cree(s), ${skippedCount} date(s) deja ouverte(s).`
        : `${createdCount} creneau(x) cree(s).`,
    });
  };

  const handleSaveWithSlots = async () => {
    setSlotMessage(null);
    const result = await onSaveEdit();
    if (!result?.success) return;
    if (slotMode === "none") {
      onGoBack();
      return;
    }
    if (!result.sessionId || !result.sessionName) {
      setSlotMessage({ kind: "error", text: "Seance enregistree, mais impossible de recuperer son identifiant pour creer le creneau." });
      return;
    }
    if (pendingSlotDates.length === 0) {
      setSlotMessage({ kind: "error", text: "Choisissez au moins une date valide pour creer un creneau." });
      return;
    }

    try {
      await createSlotsForSession(result.sessionId, result.sessionName);
    } catch (error) {
      setSlotMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Seance enregistree, mais creation des creneaux impossible.",
      });
    }
  };

  if (screen === "landing") {
    return (
      <>
      <AdminHelpNotifications sessionId={helpSessionId} sessionName={helpSessionName} />
      <div className={adminShellClass}>
        <div className="mb-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={adminSection === "seances" ? "ok" : "secondary"}
            onClick={() => setAdminSection("seances")}
          >
            <FiList /> Séances
          </Button>
          <Button
            size="sm"
            variant={adminSection === "creneaux" ? "ok" : "secondary"}
            onClick={() => setAdminSection("creneaux")}
          >
            <FiCalendar /> Créneaux
          </Button>
          <Button
            size="sm"
            variant={adminSection === "analyse" ? "ok" : "secondary"}
            onClick={() => setAdminSection("analyse")}
          >
            <FiBarChart2 /> Analyse
          </Button>
        </div>

        {adminSection === "analyse" && (
          <AnalyseView
            sessions={sessions}
            anSessId={anSessId}
            anCfg={anCfg}
            allAnswers={allAnswers}
            curAnT={curAnT}
            onAnSessChange={onAnSessChange}
            onAnTabChange={onAnTabChange}
            downloadCSV={downloadCSV}
            onGoBack={onGoBack}
          />
        )}

        {adminSection === "creneaux" && (
          <SlotAdminView sessions={sessions} />
        )}

        {adminSection === "seances" && (
          <>
            <div className="flex items-center gap-3.5 mb-6 flex-wrap">
              <h2 className="font-extrabold text-[22px]">Séances</h2>
              <div className="flex-1"></div>
              <Button size="sm" onClick={onNewSession}>+ Nouvelle</Button>
            </div>
            <div id="sessList" className={sessionListClass}>
              {sessions.length === 0 ? (
                <div className="rounded-[var(--radius)] border-2 border-dashed border-[var(--border)] bg-[var(--paper2)] p-[42px] text-center text-[15px] text-[var(--mid)]">Aucune séance.</div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className={sessionCardClass}>
                    <div className="min-w-0">
                      <div className="text-base font-bold">
                        {s.name}
                        {s.active ? <Badge variant="active">ACTIVE</Badge> : <Badge variant="inactive">INACTIVE</Badge>}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-[var(--mid)]">{s.date} · {s.productCount} éch. · {s.questionCount} Q · {s.jurorCount} jurys</div>
                    </div>
                    <div className="flex-1"></div>
                    <div className="flex flex-wrap gap-[5px]">
                      {s.active
                        ? <Button variant="ghost" size="sm" onClick={() => onToggleActive(s.id)}>Désactiver</Button>
                        : <Button variant="ok" size="sm" onClick={() => onToggleActive(s.id)}>Activer</Button>}
                      <Button
                        variant={s.resultsVisible ? "ok" : "ghost"}
                        size="sm"
                        onClick={() => onToggleResultsVisible(s.id)}
                        title={s.resultsVisible ? "Masquer le résumé aux participants" : "Afficher le résumé aux participants"}
                        aria-label={s.resultsVisible ? "Masquer le résumé aux participants" : "Afficher le résumé aux participants"}
                      >
                        <FiPieChart />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onAnSessChange(s.id);
                          setAdminSection("analyse");
                        }}
                        title="Voir l'analyse"
                        aria-label="Voir l'analyse de la séance"
                      >
                        <FiBarChart2 />
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => onEditSession(s.id)} title="Modifier" aria-label="Modifier la séance"><FiEdit2 /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDuplicateSession(s.id)} title="Dupliquer" aria-label="Dupliquer la séance"><FiCopy /></Button>
                      {confirmingId === s.id ? (
                        <div className="flex gap-1">
                          <Button variant="danger" size="sm" onClick={() => { onDeleteSession(s.id); setConfirmingId(null); }}>Confirmer ?</Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>Annuler</Button>
                        </div>
                      ) : (
                        <DangerGhostButton onClick={() => setConfirmingId(s.id)} title="Supprimer" aria-label="Supprimer la séance"><FiX /></DangerGhostButton>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {confirmingId && (
          <ConfirmDialog
            title="Supprimer la séance ?"
            confirmLabel="Supprimer"
            onCancel={() => setConfirmingId(null)}
            onConfirm={() => { onDeleteSession(confirmingId); setConfirmingId(null); }}
          >
            Toutes les données et les réponses des participants seront définitivement supprimées.
          </ConfirmDialog>
        )}
      </div>
      </>
    );
  }

  if (screen === "edit" && editCfg) {
    const tabs = [
      { id: "session", label: "Session", icon: <FiList /> },
      { id: "questions", label: "Questionnaire", icon: <FiPieChart /> },
      { id: "jurors", label: "Participants", icon: <FiCheck /> },
    ];

    return (
      <>
      <AdminHelpNotifications sessionId={helpSessionId} sessionName={helpSessionName} />
      <div className={adminShellClass}>
        <header className={adminEditHeaderClass}>
          <Button variant="secondary" size="sm" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
          <div className="flex-1">
             <h2 className="truncate text-[17px] font-extrabold leading-[1.2] tracking-[-.2px] min-[481px]:text-xl">{editCfg.name || "Nouvelle séance"}</h2>
          </div>
          <Button onClick={() => void handleSaveWithSlots()}>Enregistrer</Button>
        </header>

        <div className={editTabsClass}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={editTabClass(curEditTab === t.id)}
              onClick={() => onSetEditTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-[18px] pb-8">
          {curEditTab === "session" && (
            <div className="flex flex-col gap-[18px]">
              <Card title="Général">
                <div className={adminFieldGridClass}>
                  <div className="field-wrap full">
                    <label>NOM DE LA SÉANCE</label>
                    <input
                      value={editCfg.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        onSetEditCfg(prev => prev ? { ...prev, name } : prev);
                      }}
                    />
                  </div>
                  <div className="field-wrap">
                    <label>DATE</label>
                    <input
                      type="date"
                      value={editCfg.date}
                      onChange={(e) => {
                        const date = e.target.value;
                        onSetEditCfg(prev => prev ? { ...prev, date } : prev);
                      }}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Creneau d'inscription">
                <div className="grid gap-3 p-[15px]">
                  <div className="grid gap-2 min-[720px]:grid-cols-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm font-semibold">
                      <input
                        type="radio"
                        name="slotMode"
                        checked={slotMode === "none"}
                        onChange={() => setSlotMode("none")}
                      />
                      Aucun creneau
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm font-semibold">
                      <input
                        type="radio"
                        name="slotMode"
                        checked={slotMode === "sessionDate"}
                        onChange={() => setSlotMode("sessionDate")}
                      />
                      Date de seance
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm font-semibold">
                      <input
                        type="radio"
                        name="slotMode"
                        checked={slotMode === "range"}
                        onChange={() => setSlotMode("range")}
                      />
                      Plage de dates
                    </label>
                  </div>

                  {slotMode === "range" && (
                    <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--paper2)] p-3">
                      <div className="grid gap-3 min-[720px]:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Debut</label>
                          <input
                            type="date"
                            value={slotRangeStart}
                            onChange={(event) => setSlotRangeStart(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Fin</label>
                          <input
                            type="date"
                            value={slotRangeEnd}
                            onChange={(event) => setSlotRangeEnd(event.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase text-[var(--mid)]">Jours inclus</div>
                        <div className="flex flex-wrap gap-2">
                          {weekdays.map(day => (
                            <label key={day.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-sm font-semibold">
                              <input
                                type="checkbox"
                                checked={slotWeekdays.includes(day.id)}
                                onChange={() => {
                                  setSlotWeekdays(prev => prev.includes(day.id)
                                    ? prev.filter(item => item !== day.id)
                                    : [...prev, day.id]
                                  );
                                }}
                              />
                              {day.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {slotMode !== "none" && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 text-sm font-medium text-[var(--mid)]">
                      {pendingSlotDates.length > 0
                        ? `${pendingSlotDates.length} creneau(x) sera/seront cree(s) et rattache(s) a cette seance apres enregistrement.`
                        : "Aucune date valide selectionnee pour le moment."}
                    </div>
                  )}

                  {slotMessage && (
                    <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      slotMessage.kind === "ok"
                        ? "border-[rgba(98,141,23,.24)] bg-[rgba(98,141,23,.09)] text-[var(--primary)]"
                        : "border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] text-[var(--danger)]"
                    }`}>
                      {slotMessage.text}
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Échantillons">
                <div className="flex flex-col gap-2">
                  {editCfg.products.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input
                        value={p.code}
                        onChange={(e) => {
                          const code = e.target.value.toUpperCase();
                          onSetEditCfg(prev => prev ? {
                            ...prev,
                            products: prev.products.map((product, idx) =>
                              idx === i ? { ...product, code } : product
                            ),
                          } : prev);
                        }}
                        className="w-24 font-mono font-bold text-left"
                        placeholder="Code"
                      />
                      <input
                        value={p.label || ""}
                        onChange={(e) => {
                          const label = e.target.value;
                          onSetEditCfg(prev => prev ? {
                            ...prev,
                            products: prev.products.map((product, idx) =>
                              idx === i ? { ...product, label } : product
                            ),
                          } : prev);
                        }}
                        className="flex-1"
                        placeholder="Libellé optionnel"
                      />
                      <button
                        className={`${chipRemoveButtonClass} mt-2`}
                        type="button"
                        title="Retirer cet échantillon"
                        aria-label={`Retirer l'échantillon ${p.code || i + 1}`}
                        onClick={() => onSetEditCfg(prev => prev ? {
                          ...prev,
                          products: prev.products.filter((_, idx) => idx !== i),
                        } : prev)}
                      ><FiX /></button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start mt-1"
                    onClick={() => {
                      // Tire un code à 3 chiffres (101–999) non encore utilisé
                      // dans la séance, pour éviter les doublons à la saisie.
                      onSetEditCfg(prev => {
                        if (!prev) return prev;
                        const used = new Set(prev.products.map(p => p.code).filter(Boolean));
                        let code = "";
                        for (let attempt = 0; attempt < 50; attempt++) {
                          const n = 101 + Math.floor(Math.random() * 899);
                          const c = String(n);
                          if (!used.has(c)) { code = c; break; }
                        }
                        return { ...prev, products: [...prev.products, { code }] };
                      });
                    }}
                  >
                    <FiPlus /> Ajouter un échantillon
                  </Button>
                </div>
              </Card>

              {/* Option "Williams Design (Carré latin)" masquée à la demande.
                  La logique reste branchée côté hook (presMode peut valoir
                  "latin"/"fixed"/"random") ; on n'expose juste plus le toggle. */}

              {editSessId && (
                <div className="py-6">
                  <Button
                    variant="dangerGhost"
                    size="sm"
                    onClick={() => onDeleteSession(editSessId)}
                  >
                    <FiX /> Supprimer définitivement la séance
                  </Button>
                </div>
              )}
            </div>
          )}

          {curEditTab === "questions" && (
            <div className="flex flex-col gap-[18px]">
              <QuestionBuilder editCfg={editCfg} onSetEditCfg={onSetEditCfg} />
            </div>
          )}

          {curEditTab === "jurors" && (
            <div className="flex flex-col gap-[18px]">
              <ParticipantsTab
                sessionId={editSessId!}
                config={editCfg!}
                listJurorsForSession={listJurorsForSession}
                deleteJury={deleteJury}
              />
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  return null;
};
