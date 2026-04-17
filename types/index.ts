export type QuestionType = "scale" | "classement" | "seuil" | "seuil-bet" | "text" | "qcm" | "triangulaire" | "duo-trio" | "a-non-a";

// Niveau d'un test de seuil BET (3-AFC) : concentration + 3 codes + réponse correcte.
export interface BetLevel {
  label: string;        // libellé libre (ex. "0,1 g/L")
  concentration: number; // valeur numérique pour calcul BET (unité cohérente dans la série)
  codes: [string, string, string];
  correctAnswer: string; // code de l'échantillon "différent"
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  scope: "per-product" | "global" | "standalone";
  min?: number;
  max?: number;
  labelMin?: string;
  labelMax?: string;
  placeholder?: string;
  options?: string[];
  multiple?: boolean;
  rankInstruction?: string;
  correctOrder?: string[];
  codes?: string[];
  correctAnswer?: string;
  refCode?: string;
  betLevels?: BetLevel[];
  subCriteria?: string[];   // scale: sous-critères pour évaluation fine
  questionText?: string;    // duo-trio, a-non-a: consigne personnalisée
}

export interface Product {
  code: string;
  label?: string;
}

export interface SessionConfig {
  name: string;
  date: string;
  animateur?: string;
  password?: string;
  products: Product[];
  questions: Question[];
  presMode: "fixed" | "latin" | "random";
}

export interface SessionListItem {
  id: string;
  name: string;
  date: string;
  active: boolean;
  jurorCount: number;
  productCount?: number;
  questionCount?: number;
}

export type AnswerValue = number | string | string[] | Record<string, string> | null;

// Structure logique des réponses d'un jury.
// Les clés "_rank", "_discrim", "_global", "_timing" sont réservées ; les autres sont des codes échantillon.
export type JurorAnswers = {
  [key: string]: Record<string, AnswerValue | number | string[]>;
};
