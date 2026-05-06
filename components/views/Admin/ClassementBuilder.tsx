"use client";
import React, { useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import type { Product } from "../../../types";

// ─── Primitive Components ──────────────────────────────────────────────────

export function Chip({ code, active, onClick, onDragStart, removable, onRemove }: {
  code: string;
  active?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("chip-code", code);
    if (onDragStart) onDragStart(e);
  };

  return (
    <div
      className={`admin-chip${active ? " active" : ""}${onDragStart ? " draggable" : ""}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart ? handleDragStart : undefined}
      onClick={onClick}
      title={code}
    >
      <span>{code}</span>
      {removable && (
        <button className="chip-x" onClick={(e) => { e.stopPropagation(); onRemove?.(); }} type="button">
          <FiX size={10} />
        </button>
      )}
    </div>
  );
}

export function SampleToggle({ products, selected, onChange, max }: {
  products: Product[];
  selected: string[];
  onChange: (codes: string[]) => void;
  max?: number;
}) {
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, code]);
    }
  };
  return (
    <div className="chip-pool">
      {products.length === 0 && <span className="pool-hint">Ajoutez d&apos;abord des échantillons dans l&apos;onglet Session.</span>}
      {products.map(p => (
        <Chip key={p.code} code={p.code} active={selected.includes(p.code)} onClick={() => toggle(p.code)} />
      ))}
      {max && <span className="pool-hint">{selected.length}/{max} sélectionnés</span>}
    </div>
  );
}

export function DropSlot({ label, code, onDrop, onRemove, accent }: {
  label: string;
  code: string | null;
  onDrop: (code: string) => void;
  onRemove: () => void;
  accent?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop-slot${over ? " drag-over" : ""}${code ? " filled" : ""}`}
      style={accent ? { borderColor: over || code ? accent : undefined } as React.CSSProperties : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); const c = e.dataTransfer.getData("chip-code"); if (c) onDrop(c); setOver(false); }}
    >
      <div className="drop-slot-label" style={accent ? { color: accent } as React.CSSProperties : undefined}>{label}</div>
      {code
        ? <Chip code={code} active removable onRemove={onRemove} />
        : <span className="drop-slot-hint">Glisser ici</span>}
    </div>
  );
}

export function ChipPool({ codes, label }: { codes: string[]; label?: string }) {
  if (codes.length === 0) return null;
  return (
    <div className="chip-pool-section">
      {label && <span className="pool-hint">{label}</span>}
      <div className="chip-pool">
        {codes.map(code => (
          <Chip
            key={code}
            code={code}
            onDragStart={(e) => e.dataTransfer.setData("chip-code", code)}
          />
        ))}
      </div>
    </div>
  );
}

export function DraggableSerie({ codes, onChange, onRemove, onAdd }: {
  codes: string[];
  onChange: (c: string[]) => void;
  onRemove: (code: string) => void;
  onAdd?: (code: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overEmpty, setOverEmpty] = useState(false);

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const code = e.dataTransfer.getData("chip-code");
    const fromSerie = e.dataTransfer.getData("from-serie");

    if (dragIdx !== null) {
      // Internal move
      if (dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
      const next = [...codes];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      onChange(next);
    } else if (code && fromSerie !== "1" && onAdd) {
      // External add (from pool)
      onAdd(code);
    }
    setDragIdx(null); setOverIdx(null);
  };

  if (codes.length === 0) {
    return (
      <div
        className={`serie-empty${overEmpty ? " drag-over" : ""} border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center transition-all duration-150`}
        onDragOver={(e) => { e.preventDefault(); setOverEmpty(true); }}
        onDragLeave={() => setOverEmpty(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOverEmpty(false);
          const code = e.dataTransfer.getData("chip-code");
          const fromSerie = e.dataTransfer.getData("from-serie");
          if (code && fromSerie !== "1" && onAdd) onAdd(code);
        }}
      >
        Cliquez sur un échantillon ci-dessus pour l&apos;ajouter à la série <br/>
        <span className="text-[11px] text-[var(--mid)]">ou glissez-le ici</span>
      </div>
    );
  }

  return (
    <div className="draggable-list admin-order-list ">
      {codes.map((code, i) => (
        <div
          key={code}
          onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
          onDrop={(e) => handleDrop(e, i)}
          className={`draggable-item${dragIdx === i ? " dragging" : ""}${overIdx === i && dragIdx !== i ? " drag-over" : ""}`}
        >
          <span
            className="drag-handle cursor-grab"
            draggable
            onDragStart={(e) => {
              setDragIdx(i);
              e.dataTransfer.setData("chip-code", code);
              e.dataTransfer.setData("from-serie", "1");
            }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          >&#8942;&#8942;</span>
          <span className="rank-pos">{i + 1}</span>
          <span className="rank-code">{code}</span>
          <button
            className="chip-x ml-auto p-1.5 rounded flex items-center justify-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(code);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            type="button"
            draggable={false}
          >
            <FiX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── ClassementBuilder ──────────────────────────────────────────────────────

interface ClassementBuilderProps {
  type: "classement" | "seuil";
  products: Product[];
  codes: string[];
  correctOrder: string[];
  onChangeCodes: (c: string[]) => void;
  onChangeOrder: (o: string[]) => void;
}

export function ClassementBuilder({ type, products, codes, correctOrder, onChangeCodes, onChangeOrder }: ClassementBuilderProps) {
  const [showCorrectOrder, setShowCorrectOrder] = useState(correctOrder.length > 0);
  const [overPool, setOverPool] = useState(false);
  const poolRef = useRef<HTMLDivElement>(null);

  const pool = products.filter(p => !codes.includes(p.code));

  const addToSerie = (code: string) => {
    onChangeCodes([...codes, code]);
  };

  const removeFromSerie = (code: string) => {
    onChangeCodes(codes.filter(c => c !== code));
    onChangeOrder(correctOrder.filter(c => c !== code));
  };

  return (
    <div>
      {/* Pool — available samples, also accepts drag-back from série */}
      <div className="builder-section-label">
        DISPONIBLES — cliquez pour ajouter · ou glissez ici depuis la série pour retirer
      </div>
      <div
        ref={poolRef}
        className={`chip-pool${overPool ? " drag-over" : ""} min-h-[54px] border-[1.5px] border-dashed border-[var(--border)] rounded-[10px] p-2 transition-[border-color,background] duration-150`}
        onDragOver={(e) => { e.preventDefault(); setOverPool(true); }}
        onDragLeave={(e) => {
          if (poolRef.current && !poolRef.current.contains(e.relatedTarget as Node)) {
            setOverPool(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOverPool(false);
          const code = e.dataTransfer.getData("chip-code");
          const fromSerie = e.dataTransfer.getData("from-serie");
          if (code && fromSerie === "1") removeFromSerie(code);
        }}
      >
        {pool.length === 0 && codes.length > 0
          ? <span className="pool-hint">Glisser ici pour retirer de la série</span>
          : pool.length === 0
            ? <span className="pool-hint">Ajoutez d&apos;abord des échantillons dans l&apos;onglet Session.</span>
            : pool.map(p => (
                <Chip
                  key={p.code}
                  code={p.code}
                  onClick={() => addToSerie(p.code)}
                  onDragStart={(e) => { e.dataTransfer.setData("chip-code", p.code); }}
                />
              ))
        }
      </div>

      <div className="builder-section-label mt-4">
        SÉRIE — {codes.length} échantillon{codes.length > 1 ? "s" : ""} · glissez pour réordonner · × pour retirer
      </div>
      <div className="text-[11px] text-[var(--mid)] italic mb-1.5">
        Position 1 = valeur la plus faible{codes.length > 1 ? ` · Position ${codes.length} = valeur la plus élevée` : ""}
      </div>
      <DraggableSerie codes={codes} onChange={onChangeCodes} onRemove={removeFromSerie} onAdd={addToSerie} />

      {type === "classement" && codes.length > 1 && (
        <div className="mt-4">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showCorrectOrder}
              onChange={(e) => {
                setShowCorrectOrder(e.target.checked);
                if (!e.target.checked) onChangeOrder([]);
              }}
            />
            <span className="builder-section-label !m-0">ORDRE ATTENDU (optionnel) — définir la bonne réponse</span>
          </label>
          {showCorrectOrder && (
            <>
              <div className="text-xs text-[var(--mid)] mt-1.5 mb-2">
                Glissez les échantillons dans l&apos;ordre correct attendu du jury
              </div>
              <DraggableSerie
                codes={correctOrder.length ? correctOrder.filter(c => codes.includes(c)) : [...codes]}
                onChange={onChangeOrder}
                onRemove={(code) => onChangeOrder(correctOrder.filter(c => c !== code))}
                onAdd={(code) => {
                  if (codes.includes(code) && !correctOrder.includes(code)) {
                    onChangeOrder([...correctOrder, code]);
                  }
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
