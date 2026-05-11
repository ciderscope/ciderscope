"use client";
import { useState, useEffect } from "react";
import { Chart as ChartJS } from "chart.js";
import type { BetLevel, JurorAnswers, Product, Question, RadarAnswer, SessionConfig, SessionStep } from "../../../types";

export const COLORS_LIGHT = ["#c8520a", "#2e6b8a", "#1a6b3a", "#8a4c8a", "#8a6d00", "#5a4030", "#2a5a7a", "#5a6a2a"];
export const COLORS_DARK  = ["#ef7a3c", "#5b9cc1", "#5cab73", "#bb7fbb", "#c0a13a", "#a07a5e", "#5b8db1", "#92a35a"];

export function getChartColors(): string[] {
  if (typeof window === "undefined") return COLORS_LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? COLORS_DARK : COLORS_LIGHT;
}

export function useDarkMode(): boolean {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const cb = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  return dark;
}

export function syncChartDefaults() {
  if (typeof document === "undefined") return;
  const styles = getComputedStyle(document.documentElement);
  const axis = styles.getPropertyValue("--chart-axis").trim() || "#6B7280";
  const grid = styles.getPropertyValue("--chart-grid").trim() || "rgba(0,0,0,.08)";
  const paper = styles.getPropertyValue("--paper").trim() || "#ffffff";
  ChartJS.defaults.color = axis;
  ChartJS.defaults.borderColor = grid;
  if (ChartJS.defaults.scale?.grid) {
    (ChartJS.defaults.scale.grid as { color: string }).color = grid;
  }
  // Radar (radialLinear) : pas de rectangle gris derrière les ticks ;
  // on simule un halo via textStroke pour garder la lisibilité.
  const radial = (ChartJS.defaults.scales as unknown as {
    radialLinear?: { ticks?: Record<string, unknown> };
  })?.radialLinear;
  if (radial) {
    radial.ticks = {
      ...(radial.ticks || {}),
      showLabelBackdrop: false,
      backdropColor: "transparent",
      color: axis,
      textStrokeColor: paper,
      textStrokeWidth: 3,
    };
  }
}

export const pearson = (xs: number[], ys: number[]): number => {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
};

export function wordColor(w: string) {
  let h = 0;
  for (const c of w) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  const palette = getChartColors();
  return palette[h % palette.length];
}

export function flattenRadarAnswers(ans: RadarAnswer, prefix = "", out: Record<string, number> = {}): Record<string, number> {
  if (!ans) return out;
  for (const [label, node] of Object.entries(ans)) {
    const fullLabel = prefix ? `${prefix} > ${label}` : label;
    if (node._ !== undefined && node._ !== null) {
      out[fullLabel] = node._;
    }
    if (node.children) {
      flattenRadarAnswers(node.children, fullLabel, out);
    }
  }
  return out;
}

// Version simplifiée de buildSteps pour l'analyse (sans randomisation/Williams car on veut juste la liste)
export function getSteps(cfg: SessionConfig): SessionStep[] {
  const steps: SessionStep[] = [];
  const ppQuestions = cfg.questions.filter(q => q.scope === "per-product");
  const productMap = new Map<string, Question[]>();
  ppQuestions.forEach(q => {
    const targetCodes = q.codes?.length ? q.codes : cfg.products.map(p => p.code);
    targetCodes.forEach((code: string) => {
      if (!productMap.has(code)) productMap.set(code, []);
      productMap.get(code)!.push(q);
    });
  });
  if (productMap.size > 0) {
    const activeCodes = Array.from(productMap.keys());
    activeCodes.forEach(code => {
      const product: Product = cfg.products.find(p => p.code === code) || { code };
      const questions = productMap.get(code) || [];
      steps.push({ type: "product", product, questions });
    });
  }
  const standaloneQuestions = cfg.questions.filter(q => q.scope !== "per-product");
  const seriesQuestions = standaloneQuestions.filter(q => q.type !== "text" && q.type !== "qcm" && q.scope !== "global");
  const globalQuestions = standaloneQuestions.filter(q => q.type === "text" || q.type === "qcm" || q.scope === "global");

  seriesQuestions.forEach(q => {
    const type = (q.type === "classement" || q.type === "seuil") ? "ranking" : "discrim";
    steps.push({ type, question: q });
  });
  if (globalQuestions.length > 0) {
    steps.push({ type: "global", questions: globalQuestions });
  }
  return steps;
}

const isScaleAnswered = (v: unknown): boolean => {
  if (typeof v === "number") return true;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return (v as { _touched?: boolean })._touched === true;
  }
  return false;
};

const asAnswerBucket = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

export const checkStepDone = (s: SessionStep | undefined, jaState: JurorAnswers): boolean => {
  if (!s) return true;
  if (s.type === "product") {
    const pa = asAnswerBucket(jaState[s.product.code]);
    return s.questions.every(q => {
      if (q.type === "scale") return isScaleAnswered(pa[q.id]);
      return pa[q.id] !== undefined && pa[q.id] !== "" && pa[q.id] !== null;
    });
  }
  if (s.type === "ranking") return Array.isArray(asAnswerBucket(jaState["_rank"])[s.question.id]);
  if (s.type === "discrim") {
    const v = asAnswerBucket(jaState["_discrim"])[s.question.id];
    if (s.question.type === "a-non-a") {
      const codes: string[] = s.question.codes || [];
      if (!v || typeof v !== "object" || Array.isArray(v)) return false;
      const rec = v as unknown as Record<string, string>;
      return codes.length > 0 && codes.every(c => rec[c] != null);
    }
    if (s.question.type === "seuil-bet") {
      const levels = s.question.betLevels || [];
      if (!v || typeof v !== "object" || Array.isArray(v)) return false;
      const rec = v as unknown as Record<string, string>;
      return levels.length > 0 && levels.every((_: BetLevel, i: number) => rec[String(i)] != null && rec[String(i)] !== "");
    }
    return v != null && v !== "";
  }
  if (s.type === "global") {
    const ga = asAnswerBucket(jaState["_global"]);
    return s.questions.every(q => {
      if (q.type === "scale") return isScaleAnswered(ga[q.id]);
      return ga[q.id] !== undefined && ga[q.id] !== "" && ga[q.id] !== null;
    });
  }
  return true;
};


