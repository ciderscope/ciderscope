"use client";
import React from "react";
import { FiCloud, FiLoader, FiAlertCircle } from "react-icons/fi";
import { SaveStatus, SessionStep } from "../../../types";

export const SaveIndicator = ({ status, pendingCount }: { status: SaveStatus; pendingCount: number }) => {
  if (status === "idle" && pendingCount === 0) return null;
  const isWide = status === "pending" || status === "error";
  const map = {
    idle:    { icon: <FiCloud size={13} />, text: `${pendingCount} en attente de synchronisation`, color: "#c8820a" },
    saving:  { icon: <FiLoader size={13} className="animate-spin" />, text: "Enregistrement…", color: "var(--mid)" },
    saved:   { icon: <FiCloud size={13} />, text: "Enregistré", color: "#1a6b3a" },
    pending: { icon: <FiAlertCircle size={13} />, text: `Hors-ligne — ${pendingCount} en file d'attente locale`, color: "#c8820a" },
    error:   { icon: <FiAlertCircle size={13} />, text: "Erreur serveur — réessai automatique", color: "#c0392b" },
  } as const;
  const m = map[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`save-indicator fixed z-50 flex items-center gap-1.5 py-1.5 px-3 bg-[var(--paper)] rounded-full text-[12.5px] font-medium shadow-sm${isWide ? " save-indicator--wide" : ""}`}
      style={{ border: `1px solid ${m.color}33`, color: m.color }}
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
