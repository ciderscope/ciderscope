import type { BetLevel, JurorAnswers, Product, Question, SessionConfig, SessionStep } from "../types";

export const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

const hasAnsweredValue = (value: unknown): boolean => {
  return value !== undefined && value !== "" && value !== null;
};

const isScaleAnswered = (value: unknown): boolean => {
  if (typeof value === "number") return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (value as { _touched?: boolean })._touched === true;
  }
  return false;
};

export const isStepDone = (step: SessionStep | undefined, answers: JurorAnswers): boolean => {
  if (!step) return true;

  if (step.type === "product") {
    const productAnswers = asRecord(answers[step.product.code]);
    return step.questions.every(question => {
      if (question.type === "scale") return isScaleAnswered(productAnswers[question.id]);
      return hasAnsweredValue(productAnswers[question.id]);
    });
  }

  if (step.type === "ranking") {
    return Array.isArray(asRecord(answers["_rank"])[step.question.id]);
  }

  if (step.type === "discrim") {
    const value = asRecord(answers["_discrim"])[step.question.id];

    if (step.question.type === "a-non-a") {
      const codes = step.question.codes || [];
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const responseByCode = value as Record<string, string>;
      return codes.length > 0 && codes.every(code => responseByCode[code] != null);
    }

    if (step.question.type === "seuil-bet") {
      const levels = step.question.betLevels || [];
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const responseByLevel = value as Record<string, string>;
      return levels.length > 0 && levels.every((_: BetLevel, i: number) => {
        const response = responseByLevel[String(i)];
        return response != null && response !== "";
      });
    }

    return value != null && value !== "";
  }

  if (step.type === "global") {
    const globalAnswers = asRecord(answers["_global"]);
    return step.questions.every(question => {
      if (question.type === "scale") return isScaleAnswered(globalAnswers[question.id]);
      return hasAnsweredValue(globalAnswers[question.id]);
    });
  }

  return true;
};

export const buildAnalysisSteps = (config: SessionConfig): SessionStep[] => {
  const steps: SessionStep[] = [];
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

  questionsByProduct.forEach((questions, code) => {
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

  seriesQuestions.forEach(question => {
    const type = question.type === "classement" || question.type === "seuil" ? "ranking" : "discrim";
    steps.push({ type, question });
  });

  if (globalQuestions.length > 0) {
    steps.push({ type: "global", questions: globalQuestions });
  }

  return steps;
};
