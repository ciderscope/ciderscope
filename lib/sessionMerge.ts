import type { JurorAnswers, Product, Question, SessionConfig } from "../types";
import { parseANonAAnswer } from "./answers";

export type ProductMatchReason = "code" | "description" | "manual";

export type SessionProductMapping = {
  sourceCode: string;
  targetCode: string | null;
  reason: ProductMatchReason | null;
};

export type SessionQuestionMapping = {
  sourceQuestionId: string;
  targetQuestionId: string;
};

export type SessionMergeCompatibility = {
  compatible: boolean;
  errors: string[];
  questionMappings: SessionQuestionMapping[];
};

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase("fr-FR");

const normalizeDescription = (value: string | undefined) => (
  (value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR")
);

const uniqueCandidate = (products: Product[], predicate: (product: Product) => boolean) => {
  const matches = products.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
};

export const guessSessionProductMappings = (
  targetConfig: SessionConfig,
  sourceConfig: SessionConfig
): SessionProductMapping[] => {
  const guesses = sourceConfig.products.map(sourceProduct => {
    const sourceCode = normalizeCode(sourceProduct.code);
    const sourceDescription = normalizeDescription(sourceProduct.label);
    const codeMatch = uniqueCandidate(
      targetConfig.products,
      targetProduct => normalizeCode(targetProduct.code) === sourceCode
    );
    const descriptionMatch = sourceDescription
      ? uniqueCandidate(
          targetConfig.products,
          targetProduct => normalizeDescription(targetProduct.label) === sourceDescription
        )
      : null;

    if (codeMatch && descriptionMatch && codeMatch.code !== descriptionMatch.code) {
      return { sourceCode: sourceProduct.code, targetCode: null, reason: null };
    }
    if (codeMatch) {
      return { sourceCode: sourceProduct.code, targetCode: codeMatch.code, reason: "code" as const };
    }
    if (descriptionMatch) {
      return { sourceCode: sourceProduct.code, targetCode: descriptionMatch.code, reason: "description" as const };
    }
    return { sourceCode: sourceProduct.code, targetCode: null, reason: null };
  });

  const targetCounts = new Map<string, number>();
  guesses.forEach(guess => {
    if (!guess.targetCode) return;
    targetCounts.set(guess.targetCode, (targetCounts.get(guess.targetCode) || 0) + 1);
  });

  return guesses.map(guess => (
    guess.targetCode && (targetCounts.get(guess.targetCode) || 0) > 1
      ? { ...guess, targetCode: null, reason: null }
      : guess
  ));
};

const mappingToMap = (mappings: SessionProductMapping[]) => new Map(
  mappings
    .filter((mapping): mapping is SessionProductMapping & { targetCode: string } => Boolean(mapping.targetCode))
    .map(mapping => [mapping.sourceCode, mapping.targetCode])
);

const remapCode = (value: string, codeMap: Map<string, string>) => codeMap.get(value) || value;

const remapANonAConfiguration = (value: string | undefined, codeMap: Map<string, string>) => {
  if (value === undefined) return undefined;
  const parsed = parseANonAAnswer(value);
  return Object.fromEntries(
    Object.entries(parsed).map(([code, answer]) => [remapCode(code, codeMap), answer])
  );
};

const canonicalQuestion = (question: Question, codeMap: Map<string, string>) => {
  const canonical: Record<string, unknown> = { ...question };
  delete canonical.id;

  if (question.codes) canonical.codes = question.codes.map(code => remapCode(code, codeMap));
  if (question.correctOrder) canonical.correctOrder = question.correctOrder.map(code => remapCode(code, codeMap));
  if (question.refCode !== undefined) canonical.refCode = remapCode(question.refCode, codeMap);

  if (question.type === "a-non-a") {
    canonical.correctAnswer = remapANonAConfiguration(question.correctAnswer, codeMap);
  } else if (
    question.correctAnswer !== undefined
    && ["triangulaire", "duo-trio", "seuil-bet"].includes(question.type)
  ) {
    canonical.correctAnswer = remapCode(question.correctAnswer, codeMap);
  }

  if (question.betLevels) {
    canonical.betLevels = question.betLevels.map(level => ({
      ...level,
      codes: level.codes.map(code => remapCode(code, codeMap)),
      correctAnswer: remapCode(level.correctAnswer, codeMap),
    }));
  }

  return canonical;
};

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortDeep(entry)])
  );
};

const stableStringify = (value: unknown) => JSON.stringify(sortDeep(value));

export const analyzeSessionMergeCompatibility = (
  targetConfig: SessionConfig,
  sourceConfig: SessionConfig,
  mappings: SessionProductMapping[]
): SessionMergeCompatibility => {
  const errors: string[] = [];
  const sourceCodes = new Set(sourceConfig.products.map(product => product.code));
  const targetCodes = new Set(targetConfig.products.map(product => product.code));
  const mappedSources = mappings.map(mapping => mapping.sourceCode);
  const mappedTargets = mappings.map(mapping => mapping.targetCode).filter(Boolean) as string[];

  if (sourceConfig.products.length !== targetConfig.products.length) {
    errors.push("Les deux séances n'ont pas le même nombre de produits.");
  }
  if (
    mappings.length !== sourceConfig.products.length
    || new Set(mappedSources).size !== sourceConfig.products.length
    || mappedSources.some(code => !sourceCodes.has(code))
  ) {
    errors.push("La correspondance des produits source est incomplète.");
  }
  if (
    mappings.some(mapping => !mapping.targetCode)
    || new Set(mappedTargets).size !== targetConfig.products.length
    || mappedTargets.some(code => !targetCodes.has(code))
  ) {
    errors.push("Chaque produit doit correspondre à un produit principal unique.");
  }

  const codeMap = mappingToMap(mappings);
  if (codeMap.size === sourceConfig.products.length) {
    const remappedSourceOrder = sourceConfig.products.map(product => remapCode(product.code, codeMap));
    const targetOrder = targetConfig.products.map(product => product.code);
    if (stableStringify(remappedSourceOrder) !== stableStringify(targetOrder)) {
      errors.push("L'ordre des produits diffère entre les deux séances.");
    }
  }

  if (sourceConfig.presMode !== targetConfig.presMode) {
    errors.push("Le mode de présentation des produits est différent.");
  }
  if (sourceConfig.questions.length !== targetConfig.questions.length) {
    errors.push("Les deux séances n'ont pas le même nombre de questions.");
  }

  const questionMappings: SessionQuestionMapping[] = [];
  const comparableQuestionCount = Math.min(sourceConfig.questions.length, targetConfig.questions.length);
  for (let index = 0; index < comparableQuestionCount; index++) {
    const sourceQuestion = sourceConfig.questions[index];
    const targetQuestion = targetConfig.questions[index];
    questionMappings.push({
      sourceQuestionId: sourceQuestion.id,
      targetQuestionId: targetQuestion.id,
    });
    if (
      stableStringify(canonicalQuestion(sourceQuestion, codeMap))
      !== stableStringify(canonicalQuestion(targetQuestion, new Map()))
    ) {
      errors.push(`La question ${index + 1} « ${targetQuestion.label} » n'a pas une structure strictement identique.`);
    }
  }

  return { compatible: errors.length === 0, errors, questionMappings };
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const remapQuestionBucket = (value: unknown, questionMap: Map<string, string>) => Object.fromEntries(
  Object.entries(asRecord(value)).map(([questionId, answer]) => [
    questionMap.get(questionId) || questionId,
    answer,
  ])
);

const remapStepKey = (
  key: string,
  codeMap: Map<string, string>,
  questionMap: Map<string, string>
) => {
  const separator = key.indexOf(":");
  if (separator < 0) return key;
  const prefix = key.slice(0, separator);
  const identity = key.slice(separator + 1);
  if (prefix === "product") return `${prefix}:${remapCode(identity, codeMap)}`;
  if (prefix === "ranking" || prefix === "discrim") {
    return `${prefix}:${questionMap.get(identity) || identity}`;
  }
  return key;
};

const remapStepMetadata = (
  value: unknown,
  codeMap: Map<string, string>,
  questionMap: Map<string, string>
) => Object.fromEntries(
  Object.entries(asRecord(value)).map(([key, entry]) => [
    remapStepKey(key, codeMap, questionMap),
    entry,
  ])
);

const remapRankingAnswers = (
  value: unknown,
  codeMap: Map<string, string>,
  questionMap: Map<string, string>
) => Object.fromEntries(
  Object.entries(asRecord(value)).map(([questionId, answer]) => [
    questionMap.get(questionId) || questionId,
    Array.isArray(answer)
      ? answer.map(entry => typeof entry === "string" ? remapCode(entry, codeMap) : entry)
      : answer,
  ])
);

const remapDiscriminationAnswer = (
  answer: unknown,
  question: Question | undefined,
  codeMap: Map<string, string>
) => {
  if (question?.type === "a-non-a") {
    return Object.fromEntries(
      Object.entries(asRecord(answer)).map(([code, status]) => [remapCode(code, codeMap), status])
    );
  }
  if (question?.type === "seuil-bet") {
    return Object.fromEntries(
      Object.entries(asRecord(answer)).map(([level, selectedCode]) => [
        level,
        typeof selectedCode === "string" ? remapCode(selectedCode, codeMap) : selectedCode,
      ])
    );
  }
  return typeof answer === "string" ? remapCode(answer, codeMap) : answer;
};

export const transformJurorAnswersForSessionMerge = (
  answers: JurorAnswers,
  sourceConfig: SessionConfig,
  mappings: SessionProductMapping[],
  questionMappings: SessionQuestionMapping[]
): JurorAnswers => {
  const codeMap = mappingToMap(mappings);
  const questionMap = new Map(
    questionMappings.map(mapping => [mapping.sourceQuestionId, mapping.targetQuestionId])
  );
  const sourceQuestions = new Map(sourceConfig.questions.map(question => [question.id, question]));
  const transformed: Record<string, unknown> = {};

  Object.entries(answers).forEach(([key, value]) => {
    if (codeMap.has(key)) {
      transformed[remapCode(key, codeMap)] = remapQuestionBucket(value, questionMap);
      return;
    }
    if (key === "_global") {
      transformed[key] = remapQuestionBucket(value, questionMap);
      return;
    }
    if (key === "_rank") {
      transformed[key] = remapRankingAnswers(value, codeMap, questionMap);
      return;
    }
    if (key === "_discrim") {
      transformed[key] = Object.fromEntries(
        Object.entries(asRecord(value)).map(([questionId, answer]) => [
          questionMap.get(questionId) || questionId,
          remapDiscriminationAnswer(answer, sourceQuestions.get(questionId), codeMap),
        ])
      );
      return;
    }
    if (key === "_completedSteps" || key === "_timing") {
      transformed[key] = remapStepMetadata(value, codeMap, questionMap);
      return;
    }
    transformed[key] = value;
  });

  return transformed as JurorAnswers;
};
