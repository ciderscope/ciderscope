"use client";
import React, { useState } from "react";
import { Badge } from "../ui/Badge";
import { Question, Product } from "../../types";
import { FiChevronRight } from "react-icons/fi";

interface QuestionInputProps {
  q: Question;
  value: any;
  onChange: (val: any) => void;
  products?: Product[];
}

// Horizontal draggable rank for classement / seuil
function HorizontalRank({ items, value, onChange }: { items: string[]; value: any; onChange: (v: any) => void }) {
  const ordered: string[] = Array.isArray(value) && value.length === items.length
    ? value
    : [...items];

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
        Glissez les échantillons pour les classer du moins (plus faible) au plus selon le critère de la question.
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
                <FiChevronRight size={16} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const QuestionInput = ({ q, value, onChange, products }: QuestionInputProps) => {
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
              onChange={(e) => onChange(parseInt(e.target.value))}
              style={{ opacity: isNR ? 0.4 : 1 }}
            />
            <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "DM Mono, monospace" }}>{q.labelMax || mx}</span>
            <span className="scale-value">{isNR ? "—" : value}</span>
          </div>
          <label className="scale-not-rated">
            <input type="checkbox" checked={isNR} onChange={(e) => onChange(e.target.checked ? null : Math.round((mn + mx) / 2))} /> Non évalué
          </label>
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
          <HorizontalRank items={codes} value={value} onChange={onChange} />
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
                  className={`anona-btn ${currentVal[code] === "A" ? "selected" : ""}`}
                  onClick={() => onChange({ ...currentVal, [code]: "A" })}
                >
                  A
                </button>
                <button
                  className={`anona-btn ${currentVal[code] === "non-A" ? "selected" : ""}`}
                  onClick={() => onChange({ ...currentVal, [code]: "non-A" })}
                >
                  non-A
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
