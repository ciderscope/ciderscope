import type { BetLevel, JurorAnswers, Product, Question, SessionConfig, SessionStep, Poste } from "../types";
import { isANonAStatus } from "./answers";
import { hsh, wlm } from "./utils";

export const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

const hasAnsweredValue = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim() !== "";
  return value !== undefined && value !== null;
};

const isNumberInBounds = (value: number, question: Question): boolean => {
  const min = question.min ?? Number.NEGATIVE_INFINITY;
  const max = question.max ?? Number.POSITIVE_INFINITY;
  return Number.isFinite(value) && value >= min && value <= max;
};

const isScaleAnswered = (value: unknown, question: Question): boolean => {
  if (typeof value === "number") return isNumberInBounds(value, question);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const scale = value as { _?: unknown; _touched?: boolean };
    return scale._touched === true
      && typeof scale._ === "number"
      && isNumberInBounds(scale._, question);
  }
  return false;
};

const isSameStringSet = (value: unknown, required: string[]): boolean => {
  if (!Array.isArray(value) || value.length !== required.length || required.length === 0) return false;
  const expected = new Set(required);
  const actual = new Set(value);
  return actual.size === expected.size
    && value.every(item => typeof item === "string" && expected.has(item));
};

const isQuestionAnswered = (question: Question, value: unknown): boolean => {
  if (question.type === "scale") return isScaleAnswered(value, question);

  if (question.type === "qcm") {
    const options = question.options?.filter(Boolean) || [];
    if (question.multiple) {
      return Array.isArray(value)
        && value.length > 0
        && value.every(item => typeof item === "string" && (options.length === 0 || options.includes(item)));
    }
    return typeof value === "string"
      && value.trim() !== ""
      && (options.length === 0 || options.includes(value));
  }

  return hasAnsweredValue(value);
};

export const isStepDone = (step: SessionStep | undefined, answers: JurorAnswers): boolean => {
  if (!step) return true;

  if (step.type === "product") {
    const productAnswers = asRecord(answers[step.product.code]);
    return step.questions.every(question => {
      return isQuestionAnswered(question, productAnswers[question.id]);
    });
  }

  if (step.type === "ranking") {
    const requiredCodes = step.question.codes || [];
    return isSameStringSet(asRecord(answers["_rank"])[step.question.id], requiredCodes);
  }

  if (step.type === "discrim") {
    const value = asRecord(answers["_discrim"])[step.question.id];

    if (step.question.type === "a-non-a") {
      const codes = step.question.codes || [];
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const responseByCode = value as Record<string, string>;
      return codes.length > 0 && codes.every(code => isANonAStatus(responseByCode[code]));
    }

    if (step.question.type === "seuil-bet") {
      const levels = step.question.betLevels || [];
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const responseByLevel = value as Record<string, string>;
      return levels.length > 0 && levels.every((_: BetLevel, i: number) => {
        const response = responseByLevel[String(i)];
        const codes = levels[i].codes || [];
        return typeof response === "string" && codes.includes(response);
      });
    }

    if (step.question.type === "triangulaire") {
      const codes = step.question.codes || [];
      return typeof value === "string" && codes.length === 3 && codes.includes(value);
    }

    if (step.question.type === "duo-trio") {
      const codes = step.question.codes || [];
      return typeof value === "string" && codes.length === 3 && codes.slice(0, 2).includes(value);
    }

    return value != null && value !== "";
  }

  if (step.type === "global") {
    const globalAnswers = asRecord(answers["_global"]);
    return step.questions.every(question => {
      return isQuestionAnswered(question, globalAnswers[question.id]);
    });
  }

  return true;
};

export const posteToPresentationIndex = (poste: Poste | null): number | null => {
  if (!poste) return null;
  return (poste.day === "jeudi" ? 10 : 0) + (poste.num - 1);
};

export const getJurorIndex = (name: string, jurorList: string[]): number => {
  const idx = jurorList.indexOf(name);
  return idx >= 0 ? idx : jurorList.length;
};

export const getOrderedItems = <T,>(
  items: T[],
  mode: SessionConfig["presMode"] | string,
  name: string,
  jurorList: string[],
  sessionName: string,
  posteIdx?: number | null
): T[] => {
  if (!items || items.length === 0) return [];
  if (mode === "fixed" || !name) return [...items];

  const idx = posteIdx != null ? posteIdx : getJurorIndex(name, jurorList);

  if (mode === "latin") {
    const square = wlm(items.length);
    return square[idx % square.length].map((i: number) => items[i]);
  }

  const next = [...items];
  const seedKey = posteIdx != null ? `poste${posteIdx}` : name;
  let seed = hsh((sessionName || "") + seedKey);
  for (let k = next.length - 1; k > 0; k--) {
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff);
    const swapIdx = seed % (k + 1);
    [next[k], next[swapIdx]] = [next[swapIdx], next[k]];
  }
  return next;
};

export interface BuildSessionStepsOptions {
  jurorName?: string;
  jurorList?: string[];
  poste?: Poste | null;
}

export const buildSessionSteps = (
  config: SessionConfig,
  options: BuildSessionStepsOptions = {}
): SessionStep[] => {
  const steps: SessionStep[] = [];
  const jurorName = options.jurorName ?? "";
  const jurorList = options.jurorList ?? [];
  const mode = config.presMode || "fixed";
  const posteIdx = posteToPresentationIndex(options.poste ?? null);
  const orderItems = <T,>(items: T[], seedSuffix = "") =>
    getOrderedItems(items, mode, jurorName, jurorList, config.name + seedSuffix, posteIdx);

  const perProductQuestions = config.questions.filter(question => question.scope === "per-product");
  const questionsByProduct = new Map<string, Question[]>();

  perProductQuestions.forEach(question => {
    const targetCodes = question.codes?.length ? question.codes : config.products.map(product => product.code);
    targetCodes.forEach(code => {
      const bucket = questionsByProduct.get(code) || [];
      bucket.push(question);
      questionsByProduct.set(code, bucket);
    });
  });

  const activeCodeSet = new Set(questionsByProduct.keys());
  const productCodes = config.products.map(product => product.code);
  const activeCodes = [
    ...productCodes.filter(code => activeCodeSet.has(code)),
    ...Array.from(activeCodeSet).filter(code => !productCodes.includes(code)),
  ];
  const orderedCodes = orderItems(activeCodes);
  orderedCodes.forEach(code => {
    const questions = questionsByProduct.get(code) || [];
    const product: Product = config.products.find(p => p.code === code) || { code };
    steps.push({ type: "product", product, questions });
  });

  const standaloneQuestions = config.questions.filter(question => question.scope !== "per-product");
  const seriesQuestions = standaloneQuestions.filter(question =>
    question.type !== "text" && question.type !== "qcm" && question.scope !== "global"
  );
  const globalQuestions = standaloneQuestions.filter(question =>
    question.type === "text" || question.type === "qcm" || question.scope === "global"
  );

  orderItems(seriesQuestions, "series").forEach(question => {
    const type = question.type === "classement" || question.type === "seuil" ? "ranking" : "discrim";
    let finalCodes = [...(question.codes || [])];
    if (finalCodes.length === 0 && (question.type === "classement" || question.type === "seuil")) {
      finalCodes = config.products.map(product => product.code);
    }

    const orderedQuestion: Question = {
      ...question,
      codes: orderItems(finalCodes, question.id),
    };

    if (question.type === "seuil-bet" && question.betLevels) {
      orderedQuestion.betLevels = question.betLevels.map((level: BetLevel, index: number) => ({
        ...level,
        codes: orderItems([...(level.codes || [])], `${question.id}l${index}`) as [string, string, string],
      }));
    }

    steps.push({ type, question: orderedQuestion });
  });

  if (globalQuestions.length > 0) {
    steps.push({ type: "global", questions: globalQuestions });
  }

  return steps;
};

export const buildAnalysisSteps = (config: SessionConfig): SessionStep[] => buildSessionSteps(config);
