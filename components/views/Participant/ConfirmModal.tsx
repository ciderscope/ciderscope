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
  <div className="modal-overlay" onClick={() => onCancel?.()}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => onCancel?.()} aria-label="Fermer"><FiX /></button>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <div className={`mt-3 text-[13.5px] leading-normal ${tone === "warn" ? "text-[#8a4a00]" : "text-[var(--ink)]"}`}>
        {message}
      </div>
      <div className="flex gap-2 justify-end mt-5 flex-wrap">
        {cancelLabel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel?.()}>{cancelLabel}</Button>
        )}
        <Button size="sm" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
);
