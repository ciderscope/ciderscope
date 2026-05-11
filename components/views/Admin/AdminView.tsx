"use client";
import React, { useState, Dispatch, SetStateAction } from "react";
import dynamic from "next/dynamic";
import { FiEdit2, FiCopy, FiX, FiCheck, FiArrowLeft, FiPlus, FiBarChart2, FiList, FiPieChart } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { DangerGhostButton, ConfirmDialog } from "../../ui/ViewPrimitives";
import { SessionConfig, SessionListItem, AllAnswers, CSVRow, AppScreen } from "../../../types";

// Import subcomponents
import { ParticipantsTab } from "./ParticipantsTab";
import { QuestionBuilder } from "./QuestionBuilder";

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
  adminSection: "seances" | "analyse";
  setAdminSection: (v: "seances" | "analyse") => void;
  onNewSession: () => void;
  onEditSession: (id: string) => void;
  onToggleActive: (id: string) => void;
  onToggleResultsVisible: (id: string) => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSetEditCfg: Dispatch<SetStateAction<SessionConfig | null>>;
  onSetEditTab: (tab: string) => void;
  onSaveEdit: () => void;
  onHome: () => void;
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
  onSetEditCfg, onSetEditTab, onSaveEdit, onHome, downloadCSV,
  listJurorsForSession, deleteJury,
  allAnswers, anSessId, anCfg, curAnT, onAnSessChange, onAnTabChange,
}: AdminViewProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (screen === "landing") {
    return (
      <div className="admin-shell">
        {/* Sub-nav */}
        <div className="admin-section-nav">
          <button
            className={`admin-section-btn${adminSection === "seances" ? " active" : ""}`}
            onClick={() => setAdminSection("seances")}
          >
            <FiList size={13} /> Séances
          </button>
          <button
            className={`admin-section-btn${adminSection === "analyse" ? " active" : ""}`}
            onClick={() => {
              setAdminSection("analyse");
              if (!anSessId && sessions.length) onAnSessChange(sessions[0].id);
            }}
          >
            <FiBarChart2 size={13} /> Analyse
          </button>
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
          />
        )}

        {adminSection === "seances" && (
          <>
            <div className="flex items-center gap-3.5 mb-6 flex-wrap">
              <h2 className="font-extrabold text-[22px]">Séances</h2>
              <div className="flex-1"></div>
              <Button size="sm" onClick={onNewSession}>+ Nouvelle</Button>
            </div>
            <div id="sessList">
              {sessions.length === 0 ? (
                <div className="no-session">Aucune séance.</div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="sess-list-card">
                    <div>
                      <div className="name">
                        {s.name}
                        {s.active ? <Badge variant="active">ACTIVE</Badge> : <Badge variant="inactive">INACTIVE</Badge>}
                      </div>
                      <div className="info">{s.date} · {s.productCount} éch. · {s.questionCount} Q · {s.jurorCount} jurys</div>
                    </div>
                    <div className="spacer"></div>
                    <div className="actions">
                      {s.active
                        ? <Button variant="ghost" size="sm" onClick={() => onToggleActive(s.id)}>Désactiver</Button>
                        : <Button variant="ok" size="sm" onClick={() => onToggleActive(s.id)}>Activer</Button>}
                      <Button
                        variant={s.resultsVisible ? "ok" : "ghost"}
                        size="sm"
                        onClick={() => onToggleResultsVisible(s.id)}
                        title={s.resultsVisible ? "Masquer le résumé aux participants" : "Afficher le résumé aux participants"}
                      >
                        <FiPieChart /> {s.resultsVisible ? "Résumé visible" : "Partager résumé"}
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
    );
  }

  if (screen === "edit" && editCfg) {
    const tabs = [
      { id: "session", label: "Session", icon: <FiList /> },
      { id: "questions", label: "Questionnaire", icon: <FiPieChart /> },
      { id: "jurors", label: "Participants", icon: <FiCheck /> },
    ];

    return (
      <div className="admin-shell">
        <header className="admin-header edit-mode">
          <button className="back-btn" onClick={onHome}><FiArrowLeft /> Retour</button>
          <div className="flex-1">
             <h2 className="font-extrabold text-xl truncate">{editCfg.name || "Nouvelle séance"}</h2>
          </div>
          <Button onClick={onSaveEdit}>Enregistrer</Button>
        </header>

        <div className="edit-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`edit-tab${curEditTab === t.id ? " active" : ""}`}
              onClick={() => onSetEditTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="edit-content">
          {curEditTab === "session" && (
            <div className="admin-grid-single">
              <Card title="Général">
                <div className="q-fields">
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
                        className="chip-x mt-2"
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
                    variant="secondary"
                    size="sm"
                    className="btn-danger-outline"
                    onClick={() => onDeleteSession(editSessId)}
                  >
                    <FiX /> Supprimer définitivement la séance
                  </Button>
                </div>
              )}
            </div>
          )}

          {curEditTab === "questions" && (
            <div className="admin-grid-single">
              <QuestionBuilder editCfg={editCfg} onSetEditCfg={onSetEditCfg} />
            </div>
          )}

          {curEditTab === "jurors" && (
            <div className="admin-grid-single">
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
    );
  }

  return null;
};
