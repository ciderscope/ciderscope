"use client";

import { useMemo, useState } from "react";
import { FiGitMerge } from "react-icons/fi";
import type { SessionConfig, SessionListItem } from "../../../types";
import {
  analyzeSessionMergeCompatibility,
  type SessionMergeCompatibility,
  type SessionProductMapping,
} from "../../../lib/sessionMerge";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { ConfirmDialog } from "../../ui/ViewPrimitives";

type MergePreview = {
  targetConfig: SessionConfig;
  sourceConfig: SessionConfig;
  mappings: SessionProductMapping[];
  compatibility: SessionMergeCompatibility;
  targetJurorCount: number;
  sourceJurorCount: number;
  duplicateJurors: string[];
};

type MergeResult = {
  ok?: boolean;
  movedAnswers?: number;
  movedSlots?: number;
  error?: string;
  details?: string[];
  duplicateJurors?: string[];
};

const reasonLabel = (reason: SessionProductMapping["reason"]) => {
  if (reason === "code") return "code identique";
  if (reason === "description") return "description identique";
  if (reason === "manual") return "manuel";
  return "à associer";
};

export const SessionMergeCard = ({
  targetSessionId,
  targetSessionName,
  candidates,
  onMerged,
}: {
  targetSessionId: string;
  targetSessionName: string;
  candidates: SessionListItem[];
  onMerged: () => Promise<void> | void;
}) => {
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [mappings, setMappings] = useState<SessionProductMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const compatibility = useMemo(() => (
    preview
      ? analyzeSessionMergeCompatibility(preview.targetConfig, preview.sourceConfig, mappings)
      : null
  ), [mappings, preview]);
  const selectedTargets = useMemo(
    () => new Set(mappings.map(mapping => mapping.targetCode).filter(Boolean)),
    [mappings]
  );
  const sourceSession = candidates.find(session => session.id === sourceSessionId);
  const canMerge = Boolean(
    preview
    && compatibility?.compatible
    && preview.duplicateJurors.length === 0
    && !loading
    && !merging
  );

  const loadPreview = async (sourceId: string) => {
    setSourceSessionId(sourceId);
    setPreview(null);
    setMappings([]);
    setMessage(null);
    setConfirming(false);
    if (!sourceId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/sessions/${encodeURIComponent(targetSessionId)}/merge?sourceSessionId=${encodeURIComponent(sourceId)}`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({})) as MergePreview & { error?: string };
      if (!response.ok || !payload.sourceConfig) {
        throw new Error(payload.error || "Impossible de comparer les séances.");
      }
      setPreview(payload);
      setMappings(payload.mappings);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Impossible de comparer les séances.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (sourceCode: string, targetCode: string) => {
    setMappings(previous => previous.map(mapping => (
      mapping.sourceCode === sourceCode
        ? { ...mapping, targetCode: targetCode || null, reason: targetCode ? "manual" : null }
        : mapping
    )));
  };

  const merge = async () => {
    if (!sourceSessionId || !canMerge) return;
    setMerging(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/sessions/${encodeURIComponent(targetSessionId)}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSessionId,
          mappings: mappings.map(mapping => ({
            sourceCode: mapping.sourceCode,
            targetCode: mapping.targetCode,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({})) as MergeResult;
      if (!response.ok || !payload.ok) {
        const detail = payload.details?.length ? ` ${payload.details.join(" ")}` : "";
        const duplicates = payload.duplicateJurors?.length
          ? ` Noms concernés : ${payload.duplicateJurors.join(", ")}.`
          : "";
        throw new Error(`${payload.error || "La fusion a échoué."}${detail}${duplicates}`);
      }

      setConfirming(false);
      setSourceSessionId("");
      setPreview(null);
      setMappings([]);
      setMessage({
        kind: "ok",
        text: `Fusion terminée : ${payload.movedAnswers || 0} réponse(s) et ${payload.movedSlots || 0} créneau(x) transféré(s).`,
      });
      try {
        await onMerged();
      } catch {
        setMessage({
          kind: "ok",
          text: "Fusion terminée. Rechargez la page pour actualiser la liste des séances.",
        });
      }
    } catch (error) {
      setConfirming(false);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "La fusion a échoué.",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card title="Fusionner une autre séance">
      <div className="grid gap-4">
        <p className="m-0 text-sm leading-relaxed text-[var(--mid)]">
          La séance ouverte conserve ses codes. Enregistrez d&apos;abord les modifications en cours,
          puis choisissez la séance à absorber.
        </p>

        <div className="field-wrap">
          <label>SÉANCE À ABSORBER</label>
          <select
            value={sourceSessionId}
            onChange={event => void loadPreview(event.target.value)}
            disabled={loading || merging}
          >
            <option value="">Sélectionner une séance…</option>
            {candidates.map(session => (
              <option key={session.id} value={session.id}>
                {session.name} — {session.date || "sans créneau"} — {session.jurorCount} jury(s)
              </option>
            ))}
          </select>
        </div>

        {loading && <div className="text-sm text-[var(--mid)]">Comparaison des structures…</div>}

        {preview && compatibility && (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--mid)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-2.5 py-1">
                {preview.targetJurorCount} + {preview.sourceJurorCount} = {preview.targetJurorCount + preview.sourceJurorCount} jurys
              </span>
              <Badge variant={compatibility.compatible ? "ok" : "sig"}>
                {compatibility.compatible ? "structure compatible" : "fusion bloquée"}
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[580px] border-collapse text-left text-sm">
                <thead className="bg-[var(--paper2)] text-xs uppercase text-[var(--mid)]">
                  <tr>
                    <th className="px-3 py-2">Code source</th>
                    <th className="px-3 py-2">Description source</th>
                    <th className="px-3 py-2">Produit conservé</th>
                    <th className="px-3 py-2">Proposition</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(mapping => {
                    const sourceProduct = preview.sourceConfig.products.find(product => product.code === mapping.sourceCode);
                    return (
                      <tr key={mapping.sourceCode} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2 font-mono font-bold">{mapping.sourceCode}</td>
                        <td className="px-3 py-2">{sourceProduct?.label || "—"}</td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping.targetCode || ""}
                            onChange={event => updateMapping(mapping.sourceCode, event.target.value)}
                          >
                            <option value="">À associer…</option>
                            {preview.targetConfig.products.map(product => (
                              <option
                                key={product.code}
                                value={product.code}
                                disabled={selectedTargets.has(product.code) && mapping.targetCode !== product.code}
                              >
                                {product.code}{product.label ? ` — ${product.label}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-[var(--mid)]">{reasonLabel(mapping.reason)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {preview.duplicateJurors.length > 0 && (
              <div className="rounded-lg border border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] px-3 py-2 text-sm text-[var(--danger)]">
                Noms de jurys présents dans les deux séances : {preview.duplicateJurors.join(", ")}.
              </div>
            )}

            {compatibility.errors.length > 0 && (
              <ul className="m-0 grid gap-1 pl-5 text-sm text-[var(--danger)]">
                {compatibility.errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            )}

            <div className="flex justify-end">
              <Button variant="danger" onClick={() => setConfirming(true)} disabled={!canMerge}>
                <FiGitMerge /> Fusionner les séances
              </Button>
            </div>
          </>
        )}

        {message && (
          <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            message.kind === "ok"
              ? "border-[rgba(98,141,23,.24)] bg-[rgba(98,141,23,.09)] text-[var(--primary)]"
              : "border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] text-[var(--danger)]"
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {confirming && preview && (
        <ConfirmDialog
          title="Fusionner définitivement ces séances ?"
          confirmLabel={merging ? "Fusion en cours…" : "Confirmer la fusion"}
          busy={merging}
          onCancel={() => setConfirming(false)}
          onConfirm={merge}
        >
          La séance « {sourceSession?.name || preview.sourceConfig.name} » sera absorbée par « {targetSessionName} » puis supprimée.
          Ses {preview.sourceJurorCount} réponse(s) et ses créneaux seront transférés après traduction des codes.
        </ConfirmDialog>
      )}
    </Card>
  );
};
