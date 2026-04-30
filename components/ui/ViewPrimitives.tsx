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
      <div onClick={(e) => e.stopPropagation()} className="bg-[var(--paper)] rounded-xl px-6 py-[22px] max-w-[380px] w-[90%] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="text-[15px] font-bold mb-2">{title}</div>
        <div className="text-[13px] text-[var(--mid)] mb-[18px]">{children}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
