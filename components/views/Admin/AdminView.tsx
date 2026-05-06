"use client";
import React, { useState, Dispatch, SetStateAction } from "react";
import dynamic from "next/dynamic";
import { FiEdit2, FiCopy, FiEye, FiEyeOff, FiX, FiArrowLeft, FiPlus, FiBarChart2, FiList, FiPieChart } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { ConfirmDialog, DangerGhostButton } from "../../ui/ViewPrimitives";
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
          <div className="admin-grid">
            <header className="admin-header">
              <div>
                <h2 className="font-extrabold text-[clamp(17px,2.5vw,22px)]">Séances</h2>
                <p className="text-[11px] text-[var(--mid)] mt-1 uppercase tracking-wider font-mono">Panel et configuration</p>
              </div>
              <Button onClick={onNewSession} size="sm">
                <FiPlus /> Nouvelle séance
              </Button>
            </header>

            <div className="sessions-list">
              {sessions.map(s => (
                <Card key={s.id} className="session-item-admin">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{s.name}</h3>
                        {s.active && <Badge variant="ok">Active</Badge>}
                        {!s.active && <Badge variant="ns">Fermée</Badge>}
                      </div>
                      <div className="flex gap-4 text-[13px] text-[var(--mid)]">
                        <span><strong>{s.jurorCount}</strong> jurys</span>
                        <span><strong>{s.productCount}</strong> échantillons</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button className="admin-icon-btn" title="Modifier" onClick={() => onEditSession(s.id)}><FiEdit2 size={16} /></button>
                      <button className="admin-icon-btn" title="Dupliquer" onClick={() => onDuplicateSession(s.id)}><FiCopy size={16} /></button>
                      <button className="admin-icon-btn !text-[var(--danger)]" title="Supprimer" onClick={() => setConfirmingId(s.id)}><FiX size={18} /></button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex gap-3 flex-wrap">
                    <Button
                      variant={s.active ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => onToggleActive(s.id)}
                    >
                      {s.active ? "Fermer la séance" : "Ouvrir la séance"}
                    </Button>
                    
                    <button
                      className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-md hover:bg-[var(--paper2)] transition-colors inline-flex items-center gap-1.5"
                      onClick={() => onToggleResultsVisible(s.id)}
                    >
                      {s.resultsVisible ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                      {s.resultsVisible ? "Résultats visibles" : "Résultats masqués"}
                    </button>
                  </div>
                </Card>
              ))}

              {sessions.length === 0 && (
                <div className="p-12 text-center border-2 border-dashed border-[var(--border)] rounded-2xl text-[var(--mid)]">
                  Aucune séance créée. Commencez par en ajouter une.
                </div>
              )}
            </div>
          </div>
        )}

        {confirmingId && (
          <ConfirmDialog
            title="Supprimer la séance ?"
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
                      onChange={(e) => onSetEditCfg({ ...editCfg, name: e.target.value })}
                      placeholder="Ex: Dégustation Cidres AOC"
                    />
                  </div>
                </div>
              </Card>

              <Card title="Échantillons">
                <p className="text-[11px] text-[var(--mid)] mb-3">
                  Ajoutez les codes des produits à déguster (ex: 402, 781).
                </p>
                <div className="flex flex-col gap-2">
                  {editCfg.products.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input
                        value={p.code}
                        onChange={(e) => {
                          const n = [...editCfg.products];
                          n[i] = { ...n[i], code: e.target.value.toUpperCase() };
                          onSetEditCfg({ ...editCfg, products: n });
                        }}
                        className="w-24 font-mono font-bold text-center"
                        placeholder="Code"
                      />
                      <input
                        value={p.label || ""}
                        onChange={(e) => {
                          const n = [...editCfg.products];
                          n[i] = { ...n[i], label: e.target.value };
                          onSetEditCfg({ ...editCfg, products: n });
                        }}
                        className="flex-1"
                        placeholder="Libellé optionnel (ex: Cidre Brut)"
                      />
                      <button
                        className="chip-x mt-2"
                        onClick={() => onSetEditCfg({ ...editCfg, products: editCfg.products.filter((_, idx) => idx !== i) })}
                      ><FiX /></button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start mt-1"
                    onClick={() => onSetEditCfg({ ...editCfg, products: [...editCfg.products, { code: "" }] })}
                  >
                    <FiPlus /> Ajouter un échantillon
                  </Button>
                </div>
              </Card>

              <Card title="Options avancées">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={editCfg.randomizeOrder}
                    onChange={(e) => onSetEditCfg({ ...editCfg, randomizeOrder: e.target.checked })}
                  />
                  <span>
                    <strong>Williams Design (Carré latin)</strong>
                    <div className="text-[11px] text-[var(--mid)]">Équilibre les effets d&apos;ordre et de report entre jurys.</div>
                  </span>
                </label>
              </Card>

              <div className="py-6">
                <DangerGhostButton onClick={() => onDeleteSession(editSessId!)}>Supprimer définitivement la séance</DangerGhostButton>
              </div>
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
