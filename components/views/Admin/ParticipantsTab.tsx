"use client";
import React, { useState, useEffect, useCallback } from "react";
import { FiX, FiUserPlus } from "react-icons/fi";
import { Card } from "../../ui/Card";
import { MutedText, ConfirmDialog } from "../../ui/ViewPrimitives";
import { Button } from "../../ui/Button";
import { supabase } from "../../../lib/supabase";
import type { SessionConfig, JurorAnswers, RadarAxis, RadarNodeAnswer, BetLevel } from "../../../types";

interface ParticipantsTabProps {
  sessionId: string | null;
  config: SessionConfig;
  listJurorsForSession: (id: string) => Promise<string[]>;
  deleteJury: (sessionId: string, name: string) => Promise<{ success: boolean } | undefined>;
}

export function ParticipantsTab({ sessionId, config, listJurorsForSession, deleteJury }: ParticipantsTabProps) {
  const [jurors, setJurors] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(async () => {
    if (!sessionId) {
      setJurors([]);
      return;
    }
    const list = await listJurorsForSession(sessionId);
    setJurors(list);
  }, [listJurorsForSession, sessionId]);

  useEffect(() => { 
    void reload(); 
  }, [reload]);

  // Rafraîchit la liste pendant que l'animateur regarde l'onglet, pour voir
  // les arrivées en direct sans devoir réouvrir la séance.
  useEffect(() => {
    if (!sessionId) return;
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
  }, [reload, sessionId]);

  const handleGenerateFakes = async () => {
    if (!sessionId) {
      alert("Veuillez d'abord enregistrer la séance pour pouvoir ajouter des participants.");
      return;
    }
    setGenerating(true);
    try {
      if (!config) {
        alert("Configuration de séance introuvable.");
        return;
      }
      
      const realSessionId = sessionId; 
      
      const newJurorName = `Fictif_${Math.floor(Math.random() * 10000)}`;
      const answers: JurorAnswers = {
        _finished: true,
        _poste: { day: "mardi", num: Math.floor(Math.random() * 10) + 1 },
      };

      const generateScale = () => ({ _: Math.floor(Math.random() * 11), _subs: [], _touched: true });
      const generateRadar = (axes: RadarAxis[]) => {
        const buildNode = (axesList: RadarAxis[]): Record<string, RadarNodeAnswer> => {
          const res: Record<string, RadarNodeAnswer> = {};
          axesList.forEach(ax => {
            const hasChildren = ax.children && ax.children.length > 0;
            // HRATA: Sparsity. 30% chance a judge completely ignores a branch.
            // If they don't ignore it, 80% chance they give a note.
            const isConsidered = Math.random() > 0.3;
            const val = isConsidered ? (Math.random() > 0.2 ? Math.floor(Math.random() * 10) + 1 : 0) : null;
            
            if (val !== null || hasChildren) {
              const childrenAnswers = hasChildren ? buildNode(ax.children!) : undefined;
              // If it has children but they are all empty, and val is null, we can skip it to be truly sparse,
              // but for typing we keep it if it was touched.
              res[ax.label] = {
                _: val !== null ? val : 0, // Fallback to 0 if considered but no value given (or if just opening branch)
                _touched: isConsidered,
                children: childrenAnswers
              };
            }
          });
          return res;
        };
        return buildNode(axes);
      };

      config.questions.forEach(q => {
        if (q.scope === "per-product") {
          const targetCodes = q.codes?.length ? q.codes : config.products.map(p => p.code);
          targetCodes.forEach(code => {
            if (!answers[code]) answers[code] = {};
            const bucket = answers[code] as Record<string, unknown>;
            if (q.type === "scale") bucket[q.id] = generateScale();
            else if (q.type === "radar" && q.radarGroups) {
              const radarAns: Record<string, RadarNodeAnswer> = {};
              q.radarGroups.forEach(g => {
                const groupAns = generateRadar(g.axes);
                Object.assign(radarAns, groupAns);
              });
              bucket[q.id] = radarAns;
            } else if (q.type === "qcm") {
              const opts = q.options || ["Oui", "Non"];
              if (q.multiple) {
                bucket[q.id] = opts.filter(() => Math.random() > 0.5);
                if ((bucket[q.id] as string[]).length === 0) bucket[q.id] = [opts[0]]; // ensure at least 1 if required
              } else {
                bucket[q.id] = opts[Math.floor(Math.random() * opts.length)];
              }
            } else if (q.type === "text") {
              bucket[q.id] = "Commentaire auto " + Math.random().toString(36).substring(7);
            }
          });
        } else if (q.scope === "global") {
          if (!answers["_global"]) answers["_global"] = {};
          const bucket = answers["_global"] as Record<string, unknown>;
          if (q.type === "scale") bucket[q.id] = generateScale();
          else if (q.type === "qcm") {
            const opts = q.options || ["A", "B"];
            bucket[q.id] = q.multiple ? [opts[0], opts[1]].filter(Boolean) : opts[Math.floor(Math.random() * opts.length)];
          } else if (q.type === "text") {
            bucket[q.id] = "Avis global auto";
          }
        } else {
          // standalone series
          if (q.type === "classement" || q.type === "seuil") {
            if (!answers["_rank"]) answers["_rank"] = {};
            const targetCodes = q.codes?.length ? q.codes : config.products.map(p => p.code);
            const shuffled = [...targetCodes].sort(() => Math.random() - 0.5);
            (answers["_rank"] as Record<string, string[]>)[q.id] = shuffled;
          } else {
            if (!answers["_discrim"]) answers["_discrim"] = {};
            const bucket = answers["_discrim"] as Record<string, unknown>;
            if (q.type === "a-non-a") {
              const res: Record<string, string> = {};
              (q.codes || []).forEach(c => {
                res[c] = Math.random() > 0.5 ? "A" : "Non-A";
              });
              bucket[q.id] = res;
            } else if (q.type === "seuil-bet") {
              const res: Record<string, string> = {};
              (q.betLevels || []).forEach((lv: BetLevel, i: number) => {
                res[String(i)] = lv.codes[Math.floor(Math.random() * lv.codes.length)];
              });
              bucket[q.id] = res;
            } else if (q.type === "triangulaire" || q.type === "duo-trio") {
              const codes = q.codes || [];
              bucket[q.id] = codes.length > 0 ? codes[Math.floor(Math.random() * codes.length)] : "A";
            }
          }
        }
      });

      const { error } = await supabase.from("answers").insert({
        session_id: realSessionId,
        juror_name: newJurorName,
        data: answers
      });

      if (error) {
        console.error("Erreur Supabase insert:", error);
        throw new Error(error.message || "Erreur de base de données");
      }
      await reload();

      // Mettre à jour le juror_count de la session
      const { data: allJurors } = await supabase.from("answers").select("juror_name").eq("session_id", realSessionId);
      if (allJurors) {
        await supabase.from("sessions").update({ juror_count: allJurors.length }).eq("id", realSessionId);
      }
      
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      console.error(e);
      alert("Erreur lors de la génération de données: " + message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card title="Participants ayant répondu">
      <div className="mb-4">
        <Button onClick={handleGenerateFakes} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiUserPlus /> {generating ? "Génération..." : "Ajouter participant fictif (Test)"}
        </Button>
      </div>

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
            if (!sessionId || !confirmDelete) return;
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
