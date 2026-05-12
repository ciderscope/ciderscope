"use client";
import React from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../../ui/Button";

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  tone?: "default" | "warn";
}

export const ConfirmModal = ({
  title, message, confirmLabel, cancelLabel, onConfirm, onCancel, tone = "default",
}: ConfirmModalProps) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 backdrop-blur" onClick={() => onCancel?.()}>
    <div className="relative w-[92%] max-w-[540px] rounded-xl bg-[var(--paper)] px-[34px] py-8 shadow-[0_24px_64px_rgba(0,0,0,.18)] max-[480px]:w-[94%] max-[480px]:px-[22px] max-[480px]:py-6" onClick={(e) => e.stopPropagation()}>
      <button className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--mid)] transition-colors hover:bg-[var(--paper2)] hover:text-[var(--ink)]" onClick={() => onCancel?.()} aria-label="Fermer"><FiX /></button>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <div className={`mt-3 text-[13.5px] leading-normal ${tone === "warn" ? "text-[#8a4a00]" : "text-[var(--ink)]"}`}>
        {message}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {cancelLabel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel?.()}>{cancelLabel}</Button>
        )}
        <Button size="sm" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
);
