"use client";
import React from "react";
import { FiX, FiPlus } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Chip } from "./ClassementBuilder";
import { adminIconButtonClass, builderSectionLabelClass } from "./utils";
import type { BetLevel } from "../../../types";

interface SeuilBetBuilderProps {
  levels: BetLevel[];
  onChange: (l: BetLevel[]) => void;
}

export function SeuilBetBuilder({ levels, onChange }: SeuilBetBuilderProps) {
  const addLevel = () => {
    onChange([...levels, { label: `Niveau ${levels.length + 1}`, concentration: 0, codes: ["", "", ""], correctAnswer: "" }]);
  };
  const updateLevel = (i: number, patch: Partial<BetLevel>) => {
    const n = [...levels];
    n[i] = { ...n[i], ...patch };
    onChange(n);
  };
  const removeLevel = (i: number) => onChange(levels.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className={builderSectionLabelClass}>NIVEAUX DE SEUIL (ordre croissant de concentration)</div>
      <p className="text-[11px] text-[var(--mid)] mt-1">
        À chaque niveau, 3 codes (2 identiques + 1 différent). Le jury doit identifier le verre différent (3-AFC).
        Le BET individuel est la moyenne géométrique entre les deux concentrations encadrant le premier passage d&apos;erreur → succès (ASTM E679).
      </p>

      {levels.map((lv, i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg p-3 mt-2.5 bg-[var(--paper)]">
          <div className="flex gap-2 items-center mb-2">
            <span className="font-bold text-xs text-[var(--mid)]">#{i + 1}</span>
            <input
              value={lv.label}
              placeholder="Libellé"
              onChange={e => updateLevel(i, { label: e.target.value })}
              className="flex-1 px-2.5 py-1.5 rounded-md border border-[var(--border)] text-[13px]"
            />
            <input
              type="number"
              value={lv.concentration}
              step="any"
              placeholder="conc."
              onChange={e => updateLevel(i, { concentration: parseFloat(e.target.value) || 0 })}
              className="w-[90px] px-2.5 py-1.5 rounded-md border border-[var(--border)] text-[13px]"
              title="Valeur numérique (unité cohérente sur toute la série) utilisée pour le calcul BET"
            />
            <button className={adminIconButtonClass} title="Supprimer le niveau" onClick={() => removeLevel(i)} type="button"><FiX /></button>
          </div>

          <div className="flex gap-2 items-center">
            {[0, 1, 2].map(j => (
              <input
                key={j}
                value={lv.codes[j] || ""}
                placeholder={`Code ${j + 1}`}
                onChange={e => {
                  const newCodes: [string, string, string] = [lv.codes[0], lv.codes[1], lv.codes[2]];
                  newCodes[j] = e.target.value.trim().toUpperCase();
                  updateLevel(i, { codes: newCodes });
                }}
                className="w-20 px-2 py-1.5 rounded-md border border-[var(--border)] text-[13px] font-mono text-center"
              />
            ))}
            <span className="text-[11px] text-[var(--mid)] ml-1.5">différent :</span>
            <div className="flex gap-1">
              {lv.codes.filter(Boolean).map(code => (
                <Chip key={code} code={code} active={lv.correctAnswer === code} onClick={() => updateLevel(i, { correctAnswer: code })} />
              ))}
            </div>
          </div>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addLevel} className="mt-2">
        <FiPlus /> Ajouter un niveau
      </Button>
    </div>
  );
}
