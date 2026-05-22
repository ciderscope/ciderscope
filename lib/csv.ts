import type { SessionConfig, AllAnswers, CSVRow, Product, RadarAnswer, JurorAnswers, AnswerValue, RadarAxis } from "../types";
import { asRecord } from "./sessionSteps";
import { formatVal } from "./utils";
import { parseANonAAnswer } from "./answers";

const CSV_SEPARATOR = ";";

const isStringRecord = (value: unknown): value is Record<string, string> =>
  !!value
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.values(value).every(item => typeof item === "string");

export const csvCell = (value: unknown, separator = CSV_SEPARATOR): string => {
  const text = String(value ?? "");
  return text.includes(separator) || /["\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export const buildDelimitedText = (
  headers: string[],
  rows: Array<Record<string, unknown>>,
  separator = CSV_SEPARATOR
): string => {
  const lines = [
    headers.map(header => csvCell(header, separator)).join(separator),
    ...rows.map(row => headers.map(header => csvCell(row[header], separator)).join(separator)),
  ];
  return "\uFEFF" + lines.join("\n");
};

export const downloadTextFile = (content: string, filename: string, type = "text/csv;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadCSV = (rows: CSVRow[], name: string) => {
  if (rows.length === 0) return;
  const hd = Object.keys(rows[0]);
  downloadTextFile(buildDelimitedText(hd, rows), name + ".csv");
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

  const pushAnswers = (
    j: string, 
    produitCode: string, 
    produitNom: string, 
    q: typeof anCfg.questions[0], 
    ansObj: Record<string, any>
  ) => {
    const rawVal = ansObj[q.id];

    if (q.type === "radar") {
      const pushRadarNodes = (axes: RadarAxis[], ansNode: any, parentPath: string = "") => {
        axes.forEach(ax => {
          const nodeAns = ansNode?.[ax.label];
          const main = (typeof nodeAns === "object" && nodeAns !== null) ? nodeAns._ : nodeAns;
          const qLabel = parentPath ? `${parentPath} - ${ax.label}` : ax.label;
          
          rows.push({
            jury: j, produit: produitCode, nom_produit: produitNom, 
            question: qLabel, type: "scale",
            valeur: typeof main === "number" ? String(main) : "",
            correct: "", score: "", ...emptyPos,
          });

          if (ax.children && ax.children.length > 0) {
            pushRadarNodes(ax.children, nodeAns?.children, qLabel);
          }
        });
      };

      (q.radarGroups || []).forEach(g => {
        pushRadarNodes(g.axes || [], rawVal);
      });
      return;
    }

    if (q.type === "scale" && typeof rawVal === "object" && rawVal !== null && !Array.isArray(rawVal)) {
      rows.push({
        jury: j, produit: produitCode, nom_produit: produitNom, 
        question: q.label, type: "scale", valeur: String(rawVal._ ?? ""), 
        correct: q.correctAnswer || "", 
        score: "", ...emptyPos 
      });

      if (Array.isArray(q.subCriteria)) {
        q.subCriteria.forEach(sub => {
          const subVal = rawVal[sub];
          let valStr = "";
          if (subVal !== undefined && subVal !== null) {
            if (typeof subVal === "boolean") valStr = subVal ? "Oui" : "Non";
            else if (Array.isArray(subVal)) valStr = subVal.join("|");
            else valStr = String(subVal);
          }
          rows.push({
            jury: j, produit: produitCode, nom_produit: produitNom, 
            question: `${q.label} - ${sub}`, type: "scale-sub", valeur: valStr, 
            correct: "", score: "", ...emptyPos 
          });
        });
      }
      return;
    }

    const val = formatVal(rawVal as AnswerValue, q.type);
    rows.push({ 
      jury: j, produit: produitCode, nom_produit: produitNom, 
      question: q.label, type: q.type, valeur: val, 
      correct: q.correctAnswer || "", 
      score: (q.correctAnswer && val === q.correctAnswer) ? "1" : "0",
      ...emptyPos 
    });
  };

  Object.entries(allAnswers).forEach(([j, jans]: [string, JurorAnswers]) => {
    anCfg.products.forEach((p: Product) => {
      const pa = asRecord(jans[p.code]);
      ppQ.forEach(q => {
        if (q.codes && q.codes.length > 0 && !q.codes.includes(p.code)) return;
        pushAnswers(j, p.code, p.label || "", q, pa);
      });
    });

    const ra = asRecord(jans["_rank"]) as Record<string, string[] | undefined>;
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

    const da = asRecord(jans["_discrim"]);
    discQ.forEach(q => {
      const val = da[q.id] as AnswerValue;
      let valStr = "";
      let score = "0";

      if (q.type === "a-non-a") {
        if (isStringRecord(val)) {
          const vObj = val;
          const cObj = parseANonAAnswer(q.correctAnswer);
          valStr = Object.entries(vObj).map(([c, v]) => `${c}:${v}`).join(", ");
          const correctCodes = Object.keys(cObj);
          const ok = correctCodes.length > 0 && correctCodes.every(k => vObj[k] === cObj[k]);
          score = ok ? "1" : "0";
        } else {
          valStr = String(val ?? "");
        }
      } else if (q.type === "seuil-bet") {
        if (isStringRecord(val)) {
          const vObj = val;
          const levels = q.betLevels || [];
          valStr = levels.map((l, i) => vObj[i] === l.correctAnswer ? "+" : "-").join("");
          score = levels.length > 0 && !valStr.includes("-") ? "1" : "0";
        } else {
          valStr = String(val ?? "");
        }
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

    const ga = asRecord(jans["_global"]);
    glQ.forEach(q => {
      pushAnswers(j, "_global", "", q, ga);
    });
  });
  return rows;
}
