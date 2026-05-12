"use client";
import React from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionStep, SessionConfig } from "../../../types";

interface OrderScreenProps {
  curSess: SessionConfig;
  cj: string;
  steps: SessionStep[];
  onStartFromOrder: () => void;
  onGoBack: () => void;
}

export const OrderScreen = ({
  curSess, cj, steps, onStartFromOrder, onGoBack,
}: OrderScreenProps) => {
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
    <div className="mx-auto my-[30px] max-w-[720px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] px-[22px] py-[26px] shadow-[var(--shadow)] max-[480px]:mx-2 max-[480px]:my-3.5 max-[480px]:px-3.5 max-[480px]:py-[18px]">
      <h2 className="mb-1 text-2xl font-bold tracking-normal">Ordre de service</h2>
      <p className="m-0 text-sm text-[var(--mid)]">{curSess.name} — {cj}</p>
      <p className="text-[13.5px] text-[var(--mid)] mt-1 mb-5">
        Disposez vos échantillons devant vous dans l&apos;ordre indiqué ci-dessous,
        de gauche à droite.
      </p>

      {!hasMulti ? (
        <div className="mt-[18px] mb-7 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--paper2)] p-[22px] text-center text-sm text-[var(--mid)]">
          Aucun échantillon multiple à classer dans cette séance.
        </div>
      ) : (
        <>
          {globalOrder.length > 1 && (
            <div className="mt-[18px]">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--primary)]">Ordre principal</div>
              <ol className="flex list-none flex-wrap gap-2 p-0">
                {globalOrder.map((c, i) => (
                  <li key={c} className="inline-flex min-h-[46px] items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--paper)] px-3.5 py-[9px]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{i + 1}</span>
                    <span className="font-mono text-lg font-bold tracking-[0.5px] text-[var(--ink)] max-[480px]:text-xl">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {serieOrders.map((s, idx) => (
            <div key={idx} className="mt-[18px]">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--primary)]">{s.label}</div>
              <ol className="flex list-none flex-wrap gap-2 p-0">
                {s.codes.map((c, i) => (
                  <li key={c + i} className="inline-flex min-h-[46px] items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--paper)] px-3.5 py-[9px]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{i + 1}</span>
                    <span className="font-mono text-lg font-bold tracking-[0.5px] text-[var(--ink)] max-[480px]:text-xl">{c}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}

      <div className="flex gap-3 justify-between flex-wrap mt-10">
        <Button variant="ghost" size="sm" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
        <Button onClick={onStartFromOrder}>J&apos;ai mes échantillons <FiArrowRight /></Button>
      </div>
    </div>
  );
};
