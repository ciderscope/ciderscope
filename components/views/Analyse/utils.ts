"use client";
import { useState, useEffect } from "react";
import { Chart as ChartJS } from "chart.js";
import type { RadarAnswer } from "../../../types";
export { buildAnalysisSteps as getSteps, isStepDone as checkStepDone } from "../../../lib/sessionSteps";

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

