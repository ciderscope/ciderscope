"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/Badge";
import { Question, Product } from "../../types";
import { FiChevronLeft } from "react-icons/fi";
import { hsh } from "../../lib/utils";

interface QuestionInputProps {
  q: Question;
  value: any;
  onChange: (val: any) => void;
  products?: Product[];
  seedKey?: string;
}

// Graine → ordre aléatoire déterministe (anti-ancrage)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let k = a.length - 1; k > 0; k--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (k + 1);
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

// Horizontal draggable rank for classement / seuil
function HorizontalRank({ items, value, onChange, seedKey }: { items: string[]; value: any; onChange: (v: any) => void; seedKey?: string }) {
  const initialOrder = useMemo(
    () => seedKey ? seededShuffle(items, hsh(seedKey)) : [...items],
    [items, seedKey]
  );
  const hasValue = Array.isArray(value) && value.length === items.length;
  const ordered: string[] = hasValue ? value : initialOrder;

  // Commit l'ordre aléatoire initial à la première présentation (lève la gate Suivant)
  useEffect(() => {
    if (!hasValue) onChange(initialOrder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const applyReorder = (from: number, to: number) => {
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    applyReorder(dragIdx, i);
    setDragIdx(null); setOverIdx(null);
  };

  // Tap-to-swap for touch devices
  const handleTap = (i: number) => {
    if (selectedIdx === null) {
      setSelectedIdx(i);
    } else if (selectedIdx === i) {
      setSelectedIdx(null);
    } else {
      applyReorder(selectedIdx, i);
      setSelectedIdx(null);
    }
  };

  return (
    <div className="h-rank-wrap">
      <p className="drag-hint">
        Classez les verres de gauche à droite : le verre le moins intense se place à gauche, le plus intense à droite.
        Chaque verre est <strong>inférieur</strong> (&lt;) à celui qui le suit.
        <span className="drag-hint-touch"> Sur tablette : appuyez sur un verre pour le sélectionner, puis sur sa position cible.</span>
      </p>
      <div className="h-rank-list">
        {ordered.map((code, i) => (
          <React.Fragment key={code}>
            <div
              draggable
              onDragStart={() => { setDragIdx(i); setSelectedIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onClick={() => handleTap(i)}
              className={[
                "h-rank-item",
                dragIdx === i ? "dragging" : "",
                overIdx === i && dragIdx !== i ? "drag-over" : "",
                selectedIdx === i ? "h-rank-selected" : "",
              ].filter(Boolean).join(" ")}
            >
              <span className="h-rank-pos">{i + 1}</span>
              <span className="h-rank-code">{code}</span>
            </div>
            {i < ordered.length - 1 && (
              <div className="h-rank-sep" aria-hidden="true">
                <FiChevronLeft size={16} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const QuestionInput = ({ q, value, onChange, products, seedKey }: QuestionInputProps) => {
  if (q.type === "scale") {
    const mn = q.min ?? 0;
    const mx = q.max ?? 10;
    const isNR = value == null;
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">échelle</Badge></span>
        <div className="scale-wrap">
          <div className="scale-track">
            <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "DM Mono, monospace" }}>{q.labelMin || mn}</span>
            <input
              type="range"
              min={mn}
              max={mx}
              value={isNR ? Math.round((mn + mx) / 2) : value}
              onChange={(e) => { if (!isNR) onChange(parseInt(e.target.value)); }}
              onPointerDown={(e) => { if (isNR) e.preventDefault(); }}
              disabled={isNR}
              style={{ opacity: isNR ? 0.35 : 1, cursor: isNR ? "not-allowed" : "pointer" }}
              aria-disabled={isNR}
            />
            <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "DM Mono, monospace" }}>{q.labelMax || mx}</span>
            <span className="scale-value">{isNR ? "—" : value}</span>
          </div>
          <label className="scale-not-rated">
            <input
              type="checkbox"
              checked={isNR}
              onChange={(e) => onChange(e.target.checked ? null : Math.round((mn + mx) / 2))}
            /> Non évalué
          </label>
          {isNR && (
            <div style={{ fontSize: "11px", color: "var(--mid)", fontStyle: "italic", marginTop: "4px" }}>
              Décochez &laquo;&nbsp;Non évalué&nbsp;&raquo; pour saisir une note.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (q.type === "text") {
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">texte</Badge></span>
        <textarea
          className="q-text"
          placeholder={q.placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (q.type === "qcm") {
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">qcm</Badge></span>
        <div className="qcm-options">
          {q.options?.map(opt => (
            <label key={opt} className={`qcm-option ${value === opt ? "selected" : ""}`} onClick={() => onChange(opt)}>
              <span className="qcm-dot"></span>
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "classement" || q.type === "seuil") {
    const codes = q.codes?.length ? q.codes : (products?.map(p => p.code) || []);
    const label = q.type === "seuil" ? "seuil" : "classement";
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">{label}</Badge></span>
        {codes.length > 0 ? (
          <HorizontalRank items={codes} value={value} onChange={onChange} seedKey={seedKey ? `${seedKey}:${q.id}` : q.id} />
        ) : (
          <p style={{ fontSize: "13px", color: "var(--mid)" }}>Aucun échantillon défini.</p>
        )}
      </div>
    );
  }

  if (q.type === "triangulaire") {
    const options = q.codes || [];
    return (
      <div className="q-block">
        <span className="q-label">{q.label || "Quel échantillon est différent des deux autres ?"}<Badge variant="ns" className="q-type-badge">triangulaire</Badge></span>
        <div className="triangle-grid">
          {options.map(opt => (
            <div key={opt} className={`triangle-choice ${value === opt ? "selected" : ""}`} onClick={() => onChange(opt)}>
              <div className="code">{opt}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "duo-trio") {
    const codes = q.codes || [];
    const refA = codes[0] || "X";
    const refB = codes[1] || "Y";
    const testCode = codes[2] || "Z";
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">duo-trio</Badge></span>
        <p className="discrim-ref">
          Vous avez deux verres de référence <strong>{refA}</strong> et <strong>{refB}</strong>. À quel verre le verre <strong>{testCode}</strong> est-il identique ?
        </p>
        <div className="triangle-grid">
          {[refA, refB].map(opt => (
            <div key={opt} className={`triangle-choice ${value === opt ? "selected" : ""}`} onClick={() => onChange(opt)}>
              <div className="code">{opt}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "seuil-bet") {
    const levels = q.betLevels || [];
    const currentVal: Record<string, string> = (typeof value === "object" && value !== null) ? value : {};
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">seuil 3-AFC</Badge></span>
        <p className="discrim-ref">
          Pour chaque niveau, identifiez <strong>le verre différent des deux autres</strong>. Les niveaux sont présentés dans l&apos;ordre.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {levels.map((lv, idx) => (
            <div key={idx} style={{ padding: "12px", background: "var(--paper2)", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--mid)", marginBottom: "8px" }}>
                Niveau {idx + 1} · {lv.label}
              </div>
              <div className="triangle-grid">
                {lv.codes.map(code => (
                  <div
                    key={code}
                    className={`triangle-choice ${currentVal[String(idx)] === code ? "selected" : ""}`}
                    onClick={() => onChange({ ...currentVal, [String(idx)]: code })}
                  >
                    <div className="code">{code}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "a-non-a") {
    const codes = q.codes || [];
    const ref = q.refCode || "A";
    const currentVal: Record<string, string> = (typeof value === "object" && value !== null) ? value : {};
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">A / non-A</Badge></span>
        <p className="discrim-ref">
          Vous avez un verre de référence <strong>{ref}</strong> devant vous. Dites, pour chacun des verres ci-dessous, s&apos;il est identique ou différent du verre <strong>{ref}</strong>.
        </p>
        <div className="anona-grid">
          {codes.map(code => (
            <div key={code} className="anona-row">
              <span className="anona-code">{code}</span>
              <div className="anona-choices">
                <button
                  className={`anona-btn ${currentVal[code] === "A" ? "selected ok" : ""}`}
                  onClick={() => onChange({ ...currentVal, [code]: "A" })}
                  title="Identique à la référence"
                >
                  <span style={{ fontSize: "18px", lineHeight: 1 }}>=</span>
                </button>
                <button
                  className={`anona-btn ${currentVal[code] === "non-A" ? "selected diff" : ""}`}
                  onClick={() => onChange({ ...currentVal, [code]: "non-A" })}
                  title="Différent de la référence"
                >
                  <span style={{ fontSize: "18px", lineHeight: 1 }}>≠</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};
