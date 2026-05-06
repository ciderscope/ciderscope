import type { SessionConfig, AllAnswers, CSVRow, Product, RadarAnswer, JurorAnswers } from "../types";
import { formatVal } from "./utils";

export const downloadCSV = (rows: CSVRow[], name: string) => {
  if (rows.length === 0) return;
  const hd = Object.keys(rows[0]);
  const csv = "﻿" + [hd.join(";"), ...rows.map(r => hd.map(h => r[h] ?? "").join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name + ".csv";
  a.click();
};

export function buildCsvData(anCfg: SessionConfig | null, allAnswers: AllAnswers | null): CSVRow[] {
  if (!anCfg || !allAnswers) return [];
  const rows: CSVRow[] = [];
  const ppQ = anCfg.questions.filter(q => q.scope === "per-product");
  const rkQ = anCfg.questions.filter(q => q.type === "classement" || q.type === "seuil");
  const discQ = anCfg.questions.filter(q => ["triangulaire", "duo-trio", "a-non-a", "seuil-bet"].includes(q.type));
  const glQ = anCfg.questions.filter(q => q.scope === "global" && !["classement", "seuil", "seuil-bet", "triangulaire", "duo-trio", "a-non-a"].includes(q.type));

  // Build positional column keys for ranking/seuil questions (calculé une fois).
  const maxPositions = rkQ.length > 0
    ? Math.max(...rkQ.map(q => q.codes?.length || q.correctOrder?.length || anCfg.products?.length || 0))
    : 0;
  const posKeys = Array.from({ length: maxPositions }, (_, i) => `position ${i + 1}`);
  const corPosKeys = Array.from({ length: maxPositions }, (_, i) => `correct position ${i + 1}`);
  const emptyPos: Record<string, string> = {};
  for (const k of posKeys) emptyPos[k] = "";
  for (const k of corPosKeys) emptyPos[k] = "";

  Object.entries(allAnswers).forEach(([j, jans]: [string, JurorAnswers]) => {
    anCfg.products.forEach((p: Product) => {
      const pa = jans[p.code] || {};
      ppQ.forEach(q => {
        if (q.codes && q.codes.length > 0 && !q.codes.includes(p.code)) return;

        if (q.type === "radar") {
          (q.radarGroups || []).forEach(g => {
            (g.axes || []).forEach(ax => {
              const axAns = (pa[q.id] as RadarAnswer)?.[ax.label];
              const main = (typeof axAns === "object" && axAns !== null) ? axAns._ : axAns;
              rows.push({
                jury: j, produit: p.code, nom_produit: p.label || "", 
                question: ax.label, type: "scale",
                valeur: typeof main === "number" ? String(main) : "",
                correct: "", score: "", ...emptyPos,
              });
            });
          });
          return;
        }
        const val = formatVal(pa[q.id], q.type);
        rows.push({ 
          jury: j, produit: p.code, nom_produit: p.label || "", 
          question: q.label, type: q.type, valeur: val, 
          correct: q.correctAnswer || "", 
          score: (q.correctAnswer && val === q.correctAnswer) ? "1" : "0",
          ...emptyPos 
        });
      });
    });

    const ra = (jans["_rank"] || {}) as Record<string, string[] | undefined>;
    rkQ.forEach(q => {
      const ranked: string[] = Array.isArray(ra[q.id]) ? ra[q.id]! : [];
      const correctOrder: string[] = q.correctOrder || [];
      const row: CSVRow = { 
        jury: j, produit: "_classement", nom_produit: "", 
        question: q.label, type: q.type, valeur: ranked.join(">"), 
        correct: correctOrder.join(">"), 
        score: ranked.join(">") === correctOrder.join(">") ? "1" : "0",
        ...emptyPos 
      };
      for (let idx = 0; idx < posKeys.length; idx++) row[posKeys[idx]] = ranked[idx] || "";
      for (let idx = 0; idx < corPosKeys.length; idx++) row[corPosKeys[idx]] = correctOrder[idx] || "";
      rows.push(row);
    });

    const da = jans["_discrim"] || {};
    discQ.forEach(q => {
      const val = da[q.id];
      let valStr = "";
      let score = "0";

      if (q.type === "a-non-a") {
        try {
          const vObj = val as Record<string, string>;
          const cObj = Object.fromEntries((q.correctAnswer || "").split(",").map(x => x.split(":")));
          valStr = Object.entries(vObj).map(([c, v]) => `${c}:${v}`).join(", ");
          const ok = Object.keys(cObj).every(k => vObj[k] === cObj[k]);
          score = ok ? "1" : "0";
        } catch { valStr = String(val ?? ""); }
      } else if (q.type === "seuil-bet") {
        try {
          const vObj = val as Record<string, string>;
          const levels = q.betLevels || [];
          valStr = levels.map((l, i) => vObj[i] === l.correctAnswer ? "+" : "-").join("");
          score = valStr.includes("-") ? "0" : "1";
        } catch { valStr = String(val ?? ""); }
      } else {
        valStr = String(val ?? "");
        score = valStr === q.correctAnswer ? "1" : "0";
      }

      rows.push({ 
        jury: j, produit: "_test", nom_produit: "", 
        question: q.label, type: q.type, valeur: valStr, 
        correct: q.correctAnswer || "", 
        score,
        ...emptyPos 
      });
    });

    const ga = jans["_global"] || {};
    glQ.forEach(q => rows.push({ 
      jury: j, produit: "_global", nom_produit: "", 
      question: q.label, type: q.type, valeur: formatVal(ga[q.id], q.type), 
      correct: "", score: "", ...emptyPos 
    }));
  });
  return rows;
}
