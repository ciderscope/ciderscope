"use client";
import React, { useState } from "react";
import { FiX, FiEye, FiEyeOff, FiCopy } from "react-icons/fi";
import { Badge } from "../../ui/Badge";
import { QuestionInput } from "../../features/QuestionInput";
import type { Question, Product, AnswerValue } from "../../../types";
import {
  adminFieldGridClass,
  adminIconButtonClass,
  getDefaultLabel,
  questionBuilderClass,
  questionBuilderHeaderClass,
  questionNumberClass,
  questionTypeBodyClass,
  scopeButtonClass,
} from "./utils";
import { RadarBuilder } from "./RadarBuilder";
import { ClassementBuilder } from "./ClassementBuilder";
import { TriangulaireBuilder, DuoTrioBuilder, ANonABuilder } from "./DiscrimBuilders";
import { QCMOptions } from "./QCMOptions";
import { SeuilBetBuilder } from "./SeuilBetBuilder";

interface QuestionEditorProps {
  q: Question;
  index: number;
  products: Product[];
  typeLabel: string; 
  onUpdate: (patch: Partial<Question>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function QuestionEditor({ q, index, products, typeLabel, onUpdate, onDuplicate, onDelete }: QuestionEditorProps) {
  const [preview, setPreview] = useState(false);
  const [previewVal, setPreviewVal] = useState<AnswerValue>(undefined);
  return (
    <div className={questionBuilderClass(q.type)}>
          <div className={questionBuilderHeaderClass}>
            <span className={questionNumberClass}>Q{index + 1}</span>
            <Badge variant="ns">{typeLabel}</Badge>
            <span className="flex-1" />
            <button
              type="button"
              className={`${adminIconButtonClass} ${preview ? "text-[var(--accent)] hover:text-[var(--accent)]" : ""}`}
              title={preview ? "Masquer l'aperçu" : "Aperçu participant"}
              onClick={() => setPreview(p => !p)}
            >
              {preview ? <FiEyeOff /> : <FiEye />}
            </button>
            <button type="button" className={adminIconButtonClass} title="Dupliquer la question" onClick={onDuplicate}>
              <FiCopy />
            </button>
            <button type="button" className={adminIconButtonClass} title="Supprimer" onClick={onDelete}>
              <FiX />
            </button>
          </div>

          {/* Libellé — always shown */}
          <div className={adminFieldGridClass}>
            <div className="field-wrap full">
              <label>LIBELLÉ</label>
              <input
                value={q.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onBlur={() => {
                  if (!q.label.trim()) onUpdate({ label: getDefaultLabel(q.type) });
                }}
                placeholder={getDefaultLabel(q.type)}
              />
            </div>
          </div>

          {/* Affichage (scope) : pour qcm / texte / échelle */}
          {(q.type === "qcm" || q.type === "text" || q.type === "scale") && (
            <div className={adminFieldGridClass}>
              <div className="field-wrap full">
                <label>AFFICHAGE</label>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    className={scopeButtonClass(q.scope === "per-product")}
                    onClick={() => onUpdate({ scope: "per-product" })}
                  >
                    Pour chaque échantillon
                  </button>
                  <button
                    type="button"
                    className={scopeButtonClass(q.scope !== "per-product")}
                    onClick={() => onUpdate({ scope: "global" })}
                  >
                    Question seule (une fois)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Type-specific UI */}
          <div className={questionTypeBodyClass}>

            {q.type === "scale" && (
              <>
                <div className={adminFieldGridClass}>
                  <div className="field-wrap"><label>MIN</label><input type="number" value={q.min ?? 0} onChange={(e) => onUpdate({ min: +e.target.value })} /></div>
                  <div className="field-wrap"><label>MAX</label><input type="number" value={q.max ?? 10} onChange={(e) => onUpdate({ max: +e.target.value })} /></div>
                  <div className="field-wrap"><label>LABEL MIN</label><input value={q.labelMin || ""} onChange={(e) => onUpdate({ labelMin: e.target.value })} /></div>
                  <div className="field-wrap"><label>LABEL MAX</label><input value={q.labelMax || ""} onChange={(e) => onUpdate({ labelMax: e.target.value })} /></div>
                </div>
              </>
            )}

            {q.type === "radar" && (
              <RadarBuilder q={q} onUpdate={onUpdate} />
            )}

            {(q.type === "classement" || q.type === "seuil") && (
              <ClassementBuilder
                type={q.type}
                products={products}
                codes={q.codes || []}
                correctOrder={q.correctOrder || []}
                onChangeCodes={(c) => onUpdate({ codes: c })}
                onChangeOrder={(o) => onUpdate({ correctOrder: o })}
              />
            )}

            {q.type === "triangulaire" && (
              <TriangulaireBuilder
                products={products}
                codes={q.codes || []}
                correctAnswer={q.correctAnswer || ""}
                onChangeCodes={(c) => onUpdate({ codes: c })}
                onChangeCorrect={(v) => onUpdate({ correctAnswer: v })}
              />
            )}

            {q.type === "duo-trio" && (
              <>
                <div className={`${adminFieldGridClass} mb-3`}>
                  <div className="field-wrap full">
                    <label>CONSIGNE PERSONNALISÉE (laisser vide pour la consigne par défaut)</label>
                    <input
                      value={q.questionText || ""}
                      onChange={(e) => onUpdate({ questionText: e.target.value })}
                      placeholder=""
                    />
                  </div>
                </div>
                <DuoTrioBuilder
                  products={products}
                  codes={q.codes || []}
                  correctAnswer={q.correctAnswer || ""}
                  onChangeCodes={(c) => onUpdate({ codes: c })}
                  onChangeCorrect={(v) => onUpdate({ correctAnswer: v })}
                />
              </>
            )}

            {q.type === "a-non-a" && (
              <>
                <div className={`${adminFieldGridClass} mb-3`}>
                  <div className="field-wrap full">
                    <label>CONSIGNE PERSONNALISÉE (laisser vide pour la consigne par défaut)</label>
                    <input
                      value={q.questionText || ""}
                      onChange={(e) => onUpdate({ questionText: e.target.value })}
                      placeholder=""
                    />
                  </div>
                </div>
                <ANonABuilder
                  products={products}
                  codes={q.codes || []}
                  correctAnswer={q.correctAnswer || ""}
                  refCode={q.refCode || ""}
                  onChangeCodes={(c) => onUpdate({ codes: c })}
                  onChangeCorrect={(v) => onUpdate({ correctAnswer: v })}
                  onChangeRef={(v) => onUpdate({ refCode: v })}
                />
              </>
            )}

            {q.type === "qcm" && (
              <QCMOptions
                options={q.options || []}
                correctAnswer={q.correctAnswer}
                onChange={(o) => onUpdate({ options: o })}
                onChangeCorrect={(v) => onUpdate({ correctAnswer: v })}
              />
            )}

            {q.type === "seuil-bet" && (
              <SeuilBetBuilder
                levels={q.betLevels || []}
                onChange={(l) => onUpdate({ betLevels: l })}
              />
            )}

          </div>

          {preview && (
            <div className="mt-3 p-3.5 bg-[var(--paper2)] border-l-[3px] border-[var(--accent)] rounded-md">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--mid)] mb-2">
                Aperçu participant
              </div>
              <QuestionInput
                q={q}
                value={previewVal}
                onChange={setPreviewVal}
                products={products}
              />
            </div>
          )}
        </div>
  );
}
