"use client";
import React from "react";
import { Button } from "./Button";

type DangerGhostButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size">;

export const DangerGhostButton = ({ className = "", ...props }: DangerGhostButtonProps) => <Button variant="ghost" size="sm" className={`!text-[var(--danger)] ${className}`} {...props} />;
export const MutedText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`text-[var(--mid)] ${className}`}>{children}</div>;

export function ConfirmDialog({ title, children, busy, confirmLabel, onCancel, onConfirm }: {
  title: string; children: React.ReactNode; busy?: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  return (
    <div role="dialog" aria-modal="true" onClick={() => { if (!busy) onCancel(); }} className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100]">
      <div onClick={(e) => e.stopPropagation()} className="bg-[var(--paper)] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.2)]" style={{ padding: "32px 36px", maxWidth: 560, width: "92%" }}>
        <div className="font-bold leading-snug" style={{ fontSize: 18, marginBottom: 14 }}>{title}</div>
        <div className="text-[var(--mid)] leading-relaxed" style={{ fontSize: 14, marginBottom: 24 }}>{children}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
