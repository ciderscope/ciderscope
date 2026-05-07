"use client";
import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { Card } from "../../ui/Card";
import { MutedText, ConfirmDialog } from "../../ui/ViewPrimitives";

interface ParticipantsTabProps {
  sessionId: string;
  listJurorsForSession: (id: string) => Promise<string[]>;
  deleteJury: (sessionId: string, name: string) => Promise<{ success: boolean } | undefined>;
}

export function ParticipantsTab({ sessionId, listJurorsForSession, deleteJury }: ParticipantsTabProps) {
  const [jurors, setJurors] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const list = await listJurorsForSession(sessionId);
    setJurors(list);
  };

  useEffect(() => { 
    void reload(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Rafraîchit la liste pendant que l'animateur regarde l'onglet, pour voir
  // les arrivées en direct sans devoir réouvrir la séance.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void reload();
    };
    const id = setInterval(tick, 8_000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <Card title="Participants ayant répondu">
      {jurors === null ? (
        <MutedText>Chargement…</MutedText>
      ) : jurors.length === 0 ? (
        <MutedText>Aucun participant n&apos;a encore répondu à cette séance.</MutedText>
      ) : (
        <>
          <p className="text-[12px] text-[var(--mid)]" style={{ marginBottom: 36 }}>
            Cliquez sur la croix pour supprimer définitivement les réponses d&apos;un participant.
          </p>
          <div className="participants-list">
            <div className="participants-list-header">
              <span>{jurors.length} participant{jurors.length > 1 ? "s" : ""}</span>
            </div>
            <ul className="participants-list-items">
              {jurors.map(n => (
                <li key={n} className="participants-list-row">
                  <span className="flex-1 font-semibold text-[14px]">{n}</span>
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-all"
                    title="Supprimer ce participant"
                    onClick={() => setConfirmDelete(n)}
                  >
                    <FiX size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer ce participant ?"
          busy={busy}
          confirmLabel={busy ? "Suppression…" : "Supprimer"}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (!confirmDelete) return;
            setBusy(true);
            const res = await deleteJury(sessionId, confirmDelete);
            setBusy(false);
            if (res?.success) {
              setJurors(prev => (prev || []).filter(j => j !== confirmDelete));
            } else {
              alert("Erreur lors de la suppression.");
            }
            setConfirmDelete(null);
          }}
        >
          Toutes les réponses de <strong>{confirmDelete}</strong> seront définitivement supprimées de cette séance.
        </ConfirmDialog>
      )}
    </Card>
  );
}
