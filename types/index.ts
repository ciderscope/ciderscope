export type QuestionType = "scale" | "classement" | "seuil" | "text" | "qcm" | "triangulaire" | "duo-trio" | "a-non-a";

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
