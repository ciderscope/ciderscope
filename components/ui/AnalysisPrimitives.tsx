"use client";
import type { ReactNode } from "react";

export const ANALYSIS_TOOLBAR = "flex flex-wrap items-center gap-2.5";
export const ANALYSIS_CHART_BOX = "h-80";
export const OK_TEXT = "text-[#1a6b3a]";
export const DANGER_TEXT = "text-[#c0392b]";
export const WARN_TEXT = "text-[#c8820a]";
export const DIM_TEXT = "text-[#888]";

const ANALYSIS_EMPTY = "py-6 text-[var(--text-muted)]";
const ANALYSIS_STACK = "flex flex-col gap-6";
const ANALYSIS_DEEP_STACK = "flex flex-col gap-8";
const ANALYSIS_METRIC_ROW = "flex flex-wrap items-start gap-8";
const ANALYSIS_PANEL = "rounded-lg bg-[var(--bg)] px-3.5 py-3 text-[13px] leading-[1.8]";
const ANALYSIS_PANEL_LOOSE = `${ANALYSIS_PANEL} leading-[1.9]`;
const ANALYSIS_META = "text-[13px] text-[var(--text-muted)]";
const ANALYSIS_TABLE_LABEL = "mb-1 text-xs text-[var(--text-muted)]";
const ANALYSIS_DETAILS = "mt-3.5";
const ANALYSIS_SUMMARY = "cursor-pointer text-xs text-[var(--mid)]";
const ANALYSIS_DETAIL_TABLE = "data-table mt-2";
const ANALYSIS_TOOLBAR_LABEL = "font-mono text-[11px] uppercase tracking-[0.4px] text-[var(--mid)]";

export const answerStateClass = (ok: boolean) => `text-center font-semibold ${ok ? OK_TEXT : DANGER_TEXT}`;
export const significanceClass = (ok: boolean) => `font-bold ${ok ? OK_TEXT : DIM_TEXT}`;
export const confidenceClass = (score: number) => score > 0.6 ? OK_TEXT : score > 0.3 ? WARN_TEXT : DANGER_TEXT;
export const rawResultClass = (result?: string) => {
  if (result === "✓") return "text-center font-bold text-[var(--ok)]";
  if (result === "✗") return "text-center font-bold text-[var(--danger)]";
  if (result === "~") return "text-center font-bold text-[var(--warn)]";
  return "";
};

export const AnalysisEmpty = ({ children }: { children: ReactNode }) => <div className={ANALYSIS_EMPTY}>{children}</div>;
export const AnalysisStack = ({ children, deep = false }: { children: ReactNode; deep?: boolean }) => <div className={deep ? ANALYSIS_DEEP_STACK : ANALYSIS_STACK}>{children}</div>;
export const MetricLayout = ({ children, compact = false }: { children: ReactNode; compact?: boolean }) => <div className={compact ? "flex flex-wrap items-start gap-6" : ANALYSIS_METRIC_ROW}>{children}</div>;
export const AnalysisPanel = ({ children, loose = false, className = "" }: { children: ReactNode; loose?: boolean; className?: string }) => <div className={`${loose ? ANALYSIS_PANEL_LOOSE : ANALYSIS_PANEL} ${className}`}>{children}</div>;
export const TableCaption = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`${ANALYSIS_TABLE_LABEL} ${className}`}>{children}</div>;
export const ToolbarLabel = ({ children }: { children: ReactNode }) => <span className={ANALYSIS_TOOLBAR_LABEL}>{children}</span>;

export function MetricBlock({ value, label, note, minClass = "min-w-[120px]", valueClassName = `text-[clamp(36px,5vw,52px)] font-extrabold ${OK_TEXT}`, noteClassName = "mt-1 text-[11px] italic text-[var(--mid)]" }: {
  value: ReactNode; label: ReactNode; note?: ReactNode; minClass?: string; valueClassName?: string; noteClassName?: string;
}) {
  return <div className={`${minClass} text-center`}><div className={valueClassName}>{value}</div><div className={ANALYSIS_META}>{label}</div>{note && <div className={noteClassName}>{note}</div>}</div>;
}

export function DetailTable({ summary, children, note }: { summary: ReactNode; children: ReactNode; note?: ReactNode }) {
  return <details className={ANALYSIS_DETAILS}><summary className={ANALYSIS_SUMMARY}>{summary}</summary><table className={ANALYSIS_DETAIL_TABLE}>{children}</table>{note && <div className="mt-2 text-[11px] italic text-[var(--mid)]">{note}</div>}</details>;
}
