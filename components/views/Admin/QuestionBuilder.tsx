"use client";
import React, { Dispatch, SetStateAction } from "react";
import { FiPlus } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { AROMA_PRESET } from "../../../lib/aromaPreset";
import type { SessionConfig, Question, QuestionType, Product } from "../../../types";
import { nextId, getDefaultLabel } from "./utils";
import { QuestionEditor } from "./QuestionEditor";

interface QuestionBuilderProps {
  editCfg: SessionConfig;
  onSetEditCfg: Dispatch<SetStateAction<SessionConfig | null>>;
}

export function QuestionBuilder({ editCfg, onSetEditCfg }: QuestionBuilderProps) {
  const products: Product[] = editCfg.products || [];

  const addQuestion = (type: QuestionType) => {
    const id = nextId("q");
    const allCodes = products.map(p => p.code);
    const newQ: Question = {
      id,
      type,
      label: getDefaultLabel(type),
      scope: ["classement", "seuil", "seuil-bet", "triangulaire", "duo-trio", "a-non-a"].includes(type) ? "standalone" : "per-product",
    };
    if (type === "scale") { newQ.min = 0; newQ.max = 10; }
    if (type === "radar") {
      newQ.min = 0; newQ.max = 10;
      newQ.scope = "per-product";
      // Preset arômes chargé par défaut (arbre à 3 niveaux : catégorie → sous-catégorie → descripteur).
      newQ.radarGroups = AROMA_PRESET.map(g => ({
        ...g,
        axes: g.axes.map(ax => ({ ...ax, children: ax.children ? [...ax.children] : undefined })),
      }));
    }
    if (type === "qcm") newQ.options = ["Excellent", "Bon", "Moyen", "Mauvais"];
    if (type === "triangulaire") newQ.codes = allCodes.slice(0, 3);
    if (type === "duo-trio") newQ.codes = allCodes.slice(0, 3);
    if (type === "a-non-a") { newQ.codes = allCodes; newQ.correctAnswer = ""; }
    if (type === "classement" || type === "seuil") { newQ.codes = []; newQ.correctOrder = []; }
    if (type === "seuil-bet") { newQ.betLevels = []; }
    
    onSetEditCfg(prev => prev ? ({ ...prev, questions: [...prev.questions, newQ] }) : prev);
  };

  const updateQ = (i: number, patch: Partial<Question>) => {
    onSetEditCfg(prev => {
      if (!prev) return prev;
      const n = [...prev.questions];
      n[i] = { ...n[i], ...patch };
      return { ...prev, questions: n };
    });
  };

  const duplicateQ = (i: number) => {
    onSetEditCfg(prev => {
      if (!prev) return prev;
      const src: Question = prev.questions[i];
      const copy: Question = {
        ...structuredClone(src),
        id: nextId("q"),
        label: `${src.label} (copie)`,
      };
      const n = [...prev.questions];
      n.splice(i + 1, 0, copy);
      return { ...prev, questions: n };
    });
  };

  const TYPES: QuestionType[] = ["scale", "radar", "classement", "seuil", "seuil-bet", "text", "qcm", "triangulaire", "duo-trio", "a-non-a"];
  const TYPE_LABELS: Record<string, string> = {
    scale: "échelle",
    radar: "radar (toile d'araignée)",
    classement: "classement",
    seuil: "seuil (rang)",
    "seuil-bet": "seuil (3-AFC)",
    text: "texte",
    qcm: "qcm",
    triangulaire: "triangulaire",
    "duo-trio": "duo-trio",
    "a-non-a": "a-non-a"
  };

  return (
    <div>
      {editCfg.questions.map((q: Question, i: number) => (
        <QuestionEditor
          key={q.id}
          q={q}
          index={i}
          products={products}
          typeLabel={TYPE_LABELS[q.type] || q.type}
          onUpdate={(patch) => updateQ(i, patch)}
          onDuplicate={() => duplicateQ(i)}
          onDelete={() => onSetEditCfg(prev => prev ? ({ ...prev, questions: prev.questions.filter((_: Question, idx: number) => idx !== i) }) : prev)}
        />
      ))}

      {/* Add question buttons */}
      <div className="mt-5">
        <div className="builder-section-label">AJOUTER UNE QUESTION</div>
        <div className="flex mt8 flex-wrap">
          {TYPES.map(t => (
            <Button key={t} variant="secondary" size="sm" onClick={() => addQuestion(t)}>
              <FiPlus /> {TYPE_LABELS[t] || t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
