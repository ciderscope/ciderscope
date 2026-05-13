import { SessionConfig, Question } from "../types";
import { isANonAStatus, parseANonAAnswer } from "./answers";

const duplicates = (values: string[]): string[] =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

export const validateQuestion = (q: Question, codes: string[]): string[] => {
  const errs: string[] = [];
  const label = q.label?.trim() || `(question ${q.type})`;
  if (!q.label?.trim()) errs.push(`Une question de type "${q.type}" n'a pas d'intitulé.`);

  if (q.scope === "per-product" && q.codes && q.codes.length > 0) {
    const unknown = q.codes.filter(c => !codes.includes(c));
    if (unknown.length > 0) errs.push(`"${label}" : code(s) inconnu(s) parmi les produits : ${unknown.join(", ")}.`);
  }

  if (q.type === "scale") {
    const mn = q.min ?? 0, mx = q.max ?? 10;
    if (mn >= mx) errs.push(`"${label}" : la borne min (${mn}) doit être inférieure à la borne max (${mx}).`);
  }

  if (q.type === "classement" || q.type === "seuil") {
    const qc = q.codes?.length ? q.codes : codes;
    if (qc.length < 2) errs.push(`"${label}" : au moins 2 échantillons nécessaires.`);
    const duplicateCodes = duplicates(qc);
    if (duplicateCodes.length > 0) errs.push(`"${label}" : code(s) en doublon : ${duplicateCodes.join(", ")}.`);
    if (q.correctOrder && q.correctOrder.length > 0) {
      const setQ = new Set(qc), setC = new Set(q.correctOrder);
      if (setC.size !== setQ.size || [...setC].some(c => !setQ.has(c))) {
        errs.push(`"${label}" : l'ordre correct doit contenir exactement les mêmes codes que la question.`);
      }
    }
  }

  if (q.type === "triangulaire") {
    const qc = q.codes || [];
    if (qc.length !== 3) errs.push(`"${label}" : le test triangulaire requiert exactement 3 codes.`);
    if (duplicates(qc).length > 0) errs.push(`"${label}" : les 3 codes du test triangulaire doivent être distincts.`);
    if (!q.correctAnswer || !qc.includes(q.correctAnswer)) {
      errs.push(`"${label}" : désignez l'échantillon différent (réponse correcte) parmi les 3 codes.`);
    }
  }

  if (q.type === "duo-trio") {
    const qc = q.codes || [];
    if (qc.length !== 3) errs.push(`"${label}" : le duo-trio requiert 2 références + 1 inconnu (3 codes).`);
    if (duplicates(qc).length > 0) errs.push(`"${label}" : les 3 codes du duo-trio doivent être distincts.`);
    if (!q.correctAnswer || ![qc[0], qc[1]].includes(q.correctAnswer)) {
      errs.push(`"${label}" : la référence correcte doit être l'une des deux premières.`);
    }
  }

  if (q.type === "a-non-a") {
    const qc = q.codes || [];
    if (qc.length < 1) errs.push(`"${label}" : au moins 1 code à évaluer.`);
    if (duplicates(qc).length > 0) errs.push(`"${label}" : les codes A / non-A doivent être distincts.`);
    if (!q.refCode) errs.push(`"${label}" : la référence A n'est pas définie.`);
    const parsed = parseANonAAnswer(q.correctAnswer);
    const missing = qc.filter(c => !parsed[c]);
    if (missing.length > 0) errs.push(`"${label}" : le statut A / non-A manque pour ${missing.join(", ")}.`);
    const invalid = Object.entries(parsed).filter(([, answer]) => !isANonAStatus(answer));
    if (invalid.length > 0) errs.push(`"${label}" : statut A / non-A invalide pour ${invalid.map(([code]) => code).join(", ")}.`);
  }

  if (q.type === "seuil-bet") {
    const levels = q.betLevels || [];
    if (levels.length < 2) errs.push(`"${label}" : le seuil BET (3-AFC) requiert au moins 2 niveaux de concentration.`);
    levels.forEach((lv, idx) => {
      const lbl = lv.label?.trim() || `niveau ${idx + 1}`;
      if (!Number.isFinite(lv.concentration)) errs.push(`"${label}" - ${lbl} : concentration non valide.`);
      const codesLv = lv.codes || [];
      if (codesLv.length !== 3 || codesLv.some(c => !c?.trim())) errs.push(`"${label}" - ${lbl} : 3 codes non vides requis.`);
      if (new Set(codesLv).size !== 3) errs.push(`"${label}" - ${lbl} : les 3 codes doivent être distincts.`);
      if (!lv.correctAnswer || !codesLv.includes(lv.correctAnswer)) errs.push(`"${label}" - ${lbl} : désignez la réponse correcte parmi les 3 codes.`);
    });
    for (let i = 1; i < levels.length; i++) {
      if (Number.isFinite(levels[i].concentration) && Number.isFinite(levels[i - 1].concentration) && levels[i].concentration <= levels[i - 1].concentration) {
        errs.push(`"${label}" : les concentrations doivent être strictement croissantes (niveau ${i + 1}).`);
        break;
      }
    }
  }

  if (q.type === "qcm") {
    const trimmedOptions = (q.options || []).map(o => o.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) errs.push(`"${label}" : un QCM doit avoir au moins 2 options non vides.`);
    const duplicateOptions = duplicates(trimmedOptions);
    if (duplicateOptions.length > 0) errs.push(`"${label}" : option(s) QCM en doublon : ${duplicateOptions.join(", ")}.`);
    if (q.correctAnswer && !trimmedOptions.includes(q.correctAnswer)) {
      errs.push(`"${label}" : la bonne réponse QCM doit correspondre à une option existante.`);
    }
  }

  if ((q.type === "classement" || q.type === "seuil") && codes.length > 0) {
    const qc = q.codes || [];
    const unknown = qc.filter(c => !codes.includes(c));
    if (unknown.length > 0) errs.push(`"${label}" : code(s) inconnu(s) parmi les produits : ${unknown.join(", ")}.`);
  }

  return errs;
};

export const validateSession = (cfg: SessionConfig): string[] => {
  const errs: string[] = [];
  if (!cfg.name?.trim()) errs.push("Le nom de la séance est requis.");
  if (!cfg.date?.trim()) errs.push("La date de la séance est requise.");

  const products = cfg.products || [];
  if (products.length === 0) errs.push("Ajoutez au moins un échantillon.");
  const codes = products.map(p => p.code?.trim()).filter(Boolean) as string[];
  const dupCodes = duplicates(codes);
  if (dupCodes.length > 0) errs.push(`Code(s) d'échantillon en doublon : ${dupCodes.join(", ")}.`);
  const emptyCode = products.some(p => !p.code?.trim());
  if (emptyCode) errs.push("Un échantillon a un code vide.");

  const questions = cfg.questions || [];
  if (questions.length === 0) errs.push("Ajoutez au moins une question.");
  const questionIds = questions.map(q => q.id).filter(Boolean);
  const dupQuestionIds = duplicates(questionIds);
  if (dupQuestionIds.length > 0) errs.push(`Identifiant(s) de question en doublon : ${dupQuestionIds.join(", ")}.`);
  questions.forEach(q => errs.push(...validateQuestion(q, codes)));

  return errs;
};
