"use client";
import React from "react";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, OK_TEXT, DANGER_TEXT } from "../../ui/AnalysisPrimitives";
import type { CSVRow } from "../../../types";

interface AnalyseDonneesProps {
  data: CSVRow[];
}

export function AnalyseDonnees({ data }: AnalyseDonneesProps) {
  if (data.length === 0) return <AnalysisEmpty>Aucune donnée.</AnalysisEmpty>;

  // On ordonne les colonnes pour que ce soit plus lisible
  const preferredOrder = ["jury", "produit", "nom_produit", "question", "type", "valeur", "correct", "score"];
  const allKeys = Object.keys(data[0]);
  const headers = [
    ...preferredOrder.filter(k => allKeys.includes(k)),
    ...allKeys.filter(k => !preferredOrder.includes(k))
  ];

  return (
    <Card title="Données brutes">
      <div className="max-h-[600px] overflow-auto border border-[var(--border)] rounded-md">
        <table className="data-table text-[11px] whitespace-nowrap">
          <thead className="sticky top-0 bg-[var(--paper)] shadow-sm z-10">
            <tr>{headers.map(h => <th key={h} className="text-left px-3 py-2 uppercase tracking-wider">{h.replace("_", " ")}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.slice(0, 500).map((r, i) => (
              <tr key={i} className="hover:bg-[var(--bg)] transition-colors">
                {headers.map(h => {
                  const val = r[h];
                  let cellClass = "px-3 py-1.5";
                  if (h === "score") {
                    cellClass += val === "1" ? ` font-bold ${OK_TEXT}` : val === "0" ? ` font-bold ${DANGER_TEXT}` : "";
                  }
                  if (h === "jury" || h === "produit") cellClass += " font-mono";
                  
                  return (
                    <td key={h} className={cellClass}>
                      {h === "score" && val === "1" ? "✓" : h === "score" && val === "0" ? "✗" : val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 500 && (
          <div className="p-3 text-xs text-[var(--text-muted)] bg-[var(--paper2)] border-t border-[var(--border)] italic">
            Affichage des 500 premières lignes sur {data.length}. Utilisez l&apos;export CSV pour l&apos;intégralité des données.
          </div>
        )}
      </div>
    </Card>
  );
}
