"use client";
import React from "react";
import { FiCloud, FiLoader, FiAlertCircle } from "react-icons/fi";
import { SaveStatus, SessionStep } from "../../../types";

export const SaveIndicator = ({ status, pendingCount }: { status: SaveStatus; pendingCount: number }) => {
  if (status === "idle" && pendingCount === 0) return null;
  const isWide = status === "pending" || status === "error";
  const map = {
    idle:    { icon: <FiCloud size={13} />, text: `${pendingCount} en attente de synchronisation`, className: "border-[#c8820a33] text-[#c8820a]" },
    saving:  { icon: <FiLoader size={13} className="animate-spin" />, text: "Enregistrement…", className: "border-[color-mix(in_srgb,var(--mid)_20%,transparent)] text-[var(--mid)]" },
    saved:   { icon: <FiCloud size={13} />, text: "Enregistré", className: "border-[#1a6b3a33] text-[#1a6b3a]" },
    pending: { icon: <FiAlertCircle size={13} />, text: `Hors-ligne — ${pendingCount} en file d'attente locale`, className: "border-[#c8820a33] text-[#c8820a]" },
    error:   { icon: <FiAlertCircle size={13} />, text: "Erreur serveur — réessai automatique", className: "border-[#c0392b33] text-[#c0392b]" },
  } as const;
  const m = map[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "save-indicator pointer-events-none fixed right-2.5 bottom-16 left-auto z-50 flex max-w-[calc(100vw-24px)] items-center justify-center gap-1.5 rounded-full border bg-[var(--paper)] px-3 py-1.5 text-[12.5px] font-medium shadow-sm min-[481px]:right-6 min-[481px]:bottom-[86px]",
        isWide ? "save-indicator--wide left-2.5 right-2.5 min-[481px]:left-auto" : "",
        "[&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap",
        m.className,
      ].filter(Boolean).join(" ")}
    >
      {m.icon}<span>{m.text}</span>
    </div>
  );
};

export const stepShortLabel = (step: SessionStep | undefined) => {
  if (!step) return "";
  if (step.type === "product") return step.product.code;
  if (step.type === "ranking") return step.question.type === "seuil" ? "Seuil" : "Rang";
  if (step.type === "discrim") {
    if (step.question.type === "triangulaire") return "△";
    if (step.question.type === "duo-trio") return "D/T";
    if (step.question.type === "a-non-a") return "A/¬A";
    return "Test";
  }
  if (step.type === "global") return "Général";
  return "•";
};
