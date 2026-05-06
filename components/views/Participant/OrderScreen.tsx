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
        <Button onClick={onStartFromOrder}>J&apos;ai mes échantillons <FiArrowRight /></Button>
      </div>
    </div>
  );
};