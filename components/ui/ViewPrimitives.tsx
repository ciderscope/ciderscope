"use client";
import React from "react";
import { Button } from "./Button";

type DangerGhostButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size">;

export const DangerGhostButton = ({ className = "", ...props }: DangerGhostButtonProps) => <Button variant="dangerGhost" size="sm" className={className} {...props} />;
export const MutedText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`text-[var(--mid)] ${className}`}>{children}</div>;

export function ConfirmDialog({ title, children, busy, confirmLabel, onCancel, onConfirm }: {
  title: string; children: React.ReactNode; busy?: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  return (
    <div role="dialog" aria-modal="true" onClick={() => { if (!busy) onCancel(); }} className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100]">
      <div onClick={(e) => e.stopPropagation()} className="w-[92%] max-w-[560px] rounded-xl bg-[var(--paper)] px-9 py-8 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="mb-3.5 text-lg font-bold leading-snug">{title}</div>
        <div className="mb-6 text-sm leading-relaxed text-[var(--mid)]">{children}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
