"use client";
import React, { useState } from "react";
import { FiX, FiPlus } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { AROMA_PRESET } from "../../../lib/aromaPreset";
import type { Question, RadarGroup, RadarAxis } from "../../../types";
import { nextId, updateAxisAtPath, removeAxisAtPath, addChildAtPath } from "./utils";

function RadarAxisNodeEditor({
  ax, path, depth, onUpdate, onRemove, onAddChild,
}: {
  ax: RadarAxis;
  path: number[];
  depth: number;
  onUpdate: (path: number[], patch: Partial<RadarAxis>) => void;
  onRemove: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
}) {
  const hasChildren = !!ax.children && ax.children.length > 0;
  return (
    <div className={`radar-builder-node depth-${depth}`}>
      <div className="radar-builder-node-row">
        <input
          value={ax.label}
          onChange={(e) => onUpdate(path, { label: e.target.value })}
          placeholder={depth === 0 ? "Catégorie" : depth === 1 ? "Sous-catégorie" : "Descripteur"}
          className="radar-axis-label-input"
        />
        <button
          type="button"
          className="chip-add w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--paper)] inline-flex items-center justify-center cursor-pointer text-[var(--accent)]"
          onClick={() => onAddChild(path)}
          title="Ajouter un enfant"
        >
          <FiPlus size={14} />
        </button>
        <button className="chip-x" onClick={() => onRemove(path)} type="button" title="Supprimer ce nœud">
          <FiX size={12} />
        </button>
      </div>
      {hasChildren && (
        <div className="radar-builder-children">
          {ax.children!.map((child, ci) => (
            <RadarAxisNodeEditor
              key={ci}
              ax={child}
              path={[...path, ci]}
              depth={depth + 1}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RadarBuilderProps {
  q: Question;
  onUpdate: (patch: Partial<Question>) => void;
}

export function RadarBuilder({ q, onUpdate }: RadarBuilderProps) {
  const groups: RadarGroup[] = q.radarGroups || [];
  const [isConfiguring, setIsConfiguring] = useState(false);

  const updateGroup = (gi: number, patch: Partial<RadarGroup>) => {
    const n = groups.map((g, i) => i === gi ? { ...g, ...patch } : g);
    onUpdate({ radarGroups: n });
  };

  const setGroupAxes = (gi: number, axes: RadarAxis[]) => updateGroup(gi, { axes });

  const addGroup = () => {
    const id = nextId("g");
    onUpdate({ radarGroups: [...groups, { id, title: "Nouveau groupe", axes: [{ label: "" }] }] });
  };
  const removeGroup = (gi: number) => onUpdate({ radarGroups: groups.filter((_, i) => i !== gi) });

  const loadPreset = () => {
    onUpdate({
      radarGroups: AROMA_PRESET.map(g => ({
        ...g,
        axes: g.axes.map(ax => ({ ...ax, children: ax.children ? [...ax.children] : undefined })),
      })),
    });
  };

  return (
    <div className="radar-builder">
      <div className="q-fields">
        <div className="field-wrap"><label>MIN</label><input type="number" value={q.min ?? 0} onChange={(e) => onUpdate({ min: +e.target.value })} /></div>
        <div className="field-wrap"><label>MAX</label><input type="number" value={q.max ?? 10} onChange={(e) => onUpdate({ max: +e.target.value })} /></div>
      </div>

      <div className="flex gap-2.5 mt-3 mb-2">
        <Button variant="secondary" size="sm" onClick={() => setIsConfiguring(!isConfiguring)}>
          {isConfiguring ? "Masquer le paramétrage" : "Paramétrer les catégories"}
        </Button>
      </div>

      {isConfiguring && (
        <>
          <p className="text-[11px] text-[var(--mid)] mt-2 mb-1">
            Arbre de décision : catégorie (axe de la toile) → sous-catégorie → descripteur. Le jury ne peut rien ajouter, seulement explorer l&apos;arbre défini ici.
          </p>

          {groups.map((g, gi) => (
            <div key={g.id} className="radar-group-block">
              <div className="radar-group-header">
                <input
                  value={g.title}
                  onChange={(e) => updateGroup(gi, { title: e.target.value })}
                  placeholder="Titre du radar"
                  className="font-semibold flex-1"
                />
                <button className="chip-x" onClick={() => removeGroup(gi)} type="button" title="Supprimer le groupe">
                  <FiX size={12} />
                </button>
              </div>
              <div className="radar-builder-tree">
                {g.axes.map((ax, ai) => (
                  <RadarAxisNodeEditor
                    key={ai}
                    ax={ax}
                    path={[ai]}
                    depth={0}
                    onUpdate={(path, patch) => setGroupAxes(gi, updateAxisAtPath(g.axes, path, a => ({ ...a, ...patch })))}
                    onRemove={(path) => setGroupAxes(gi, removeAxisAtPath(g.axes, path))}
                    onAddChild={(path) => setGroupAxes(gi, addChildAtPath(g.axes, path))}
                  />
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGroupAxes(gi, [...g.axes, { label: "" }])} className="mt-1">
                <FiPlus /> Catégorie racine
              </Button>
            </div>
          ))}

          <div className="flex gap-2 mt-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={addGroup}>
              <FiPlus /> Ajouter un groupe radar
            </Button>
            <Button variant="ghost" size="sm" onClick={loadPreset} title="Recharger l'arbre d'arômes de référence">
              Recharger le preset arômes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
