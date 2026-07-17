import type { PosteDay } from "../types";

export const POSTE_DAYS: readonly PosteDay[] = ["mardi", "jeudi"];
export const POSTES_PER_DAY = 12;

export const isPosteDay = (value: unknown): value is PosteDay => (
  value === "mardi" || value === "jeudi"
);
export const isValidPosteNumber = (value: unknown): value is number => (
  typeof value === "number"
  && Number.isInteger(value)
  && value >= 1
  && value <= POSTES_PER_DAY
);
