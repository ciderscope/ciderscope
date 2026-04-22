"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Question, Product, RadarAxis, AnswerValue, ScaleAnswer, RadarAnswer } from "../../types";
import { FiChevronLeft } from "react-icons/fi";
interface QuestionInputProps {
  q: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  products?: Product[];
}

// Horizontal draggable rank for classement / seuil
function HorizontalRank({ items, value, onChange }: { items: string[]; value: AnswerValue; onChange: (v: string[]) => void }) {
  const hasValue = Array.isArray(value) && value.length === items.length;
  const ordered: string[] = hasValue ? value : items;

  // Commit the initial order (already randomized by buildSteps)
  useEffect(() => {
    if (!hasValue) onChange(items);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
              <div className="h-rank-nav" aria-hidden="true">
                <button
                  type="button"
                  className="h-rank-nav-btn"
                  onClick={(e) => { e.stopPropagation(); if (i > 0) applyReorder(i, i - 1); }}
                  disabled={i === 0}
                  aria-label="Déplacer à gauche"
                >◀</button>
                <button
                  type="button"
                  className="h-rank-nav-btn"
                  onClick={(e) => { e.stopPropagation(); if (i < ordered.length - 1) applyReorder(i, i + 1); }}
                  disabled={i === ordered.length - 1}
                  aria-label="Déplacer à droite"
                >▶</button>
              </div>
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

// ── ScaleInput (extracted to allow hooks usage) ─────────────────────────────
// Answer format: number (no subs) OR { _: number, _subs: string[], [label]: number }
function ScaleInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const mn = q.min ?? 0;
  const mx = q.max ?? 10;
  const mid = Math.round((mn + mx) / 2);
  const [newLabel, setNewLabel] = useState("");

  // Normalise value → always work as object internally
  const valObj: ScaleAnswer = (() => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as ScaleAnswer;
    if (typeof value === "number") return { _: value, _subs: [] };
    return { _: mid, _subs: [] };
  })();

  const mainValue: number = typeof valObj._ === "number" ? valObj._ : mid;
  const activeSubs: string[] = Array.isArray(valObj._subs) ? valObj._subs : [];

  // Init on mount: if no value yet, seed with admin-defined suggestions
  useEffect(() => {
    if (value == null || typeof value === "number") {
      const defaults = q.subCriteria || [];
      const init: ScaleAnswer = { _: typeof value === "number" ? value : mid, _subs: [...defaults] };
      defaults.forEach(s => { init[s] = mid; });
      onChange(init);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMain = (v: number) => {
    const next: ScaleAnswer = { ...valObj, _: v };
    activeSubs.forEach(label => {
      const current = next[label];
      if (typeof current === "number" && current > v) next[label] = v;
    });
    onChange(next);
  };

  const updateSub = (label: string, v: number) => {
    const clamped = Math.min(v, mainValue);
    onChange({ ...valObj, [label]: clamped });
  };

  const removeSub = (label: string) => {
    const newSubs = activeSubs.filter(s => s !== label);
    const next: ScaleAnswer = { ...valObj, _subs: newSubs };
    delete next[label];
    onChange(next);
  };

  const addSub = () => {
    const label = newLabel.trim();
    if (!label || activeSubs.includes(label)) return;
    onChange({ ...valObj, _subs: [...activeSubs, label], [label]: mid });
    setNewLabel("");
  };

  const monoStyle: React.CSSProperties = { fontSize: "11px", color: "var(--mid)", fontFamily: "DM Mono, monospace" };

  return (
    <div className="q-block">
      <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">échelle</Badge></span>
      <div className="scale-wrap">
        <div className="scale-track">
          <span style={monoStyle}>{q.labelMin || mn}</span>
          <input
            type="range"
            min={mn}
            max={mx}
            value={mainValue}
            onChange={(e) => updateMain(parseInt(e.target.value))}
            style={{ cursor: "pointer" }}
          />
          <span style={monoStyle}>{q.labelMax || mx}</span>
          <span className="scale-value">{mainValue}</span>
        </div>

        {/* Sub-criteria — jury-driven */}
        <div className="scale-subcriteria">
          {activeSubs.length > 0 && (
            <p className="scale-subs-hint">
              Pour la catégorisation des sous-catégories, vous ne pouvez pas aller plus haut que le critère évalué.
            </p>
          )}
          {activeSubs.map(label => {
            const subVal = typeof valObj[label] === "number" ? valObj[label] : mid;
            return (
              <div key={label} className="scale-subcriterion">
                <span className="scale-sub-label">{label}</span>
                <div className="scale-track scale-track-sub">
                  <span style={{ ...monoStyle, minWidth: "20px" }}>{mn}</span>
                  <input
                    type="range"
                    min={mn}
                    max={mainValue}
                    value={Math.min(subVal, mainValue)}
                    onChange={(e) => updateSub(label, parseInt(e.target.value))}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ ...monoStyle, minWidth: "20px" }}>{mainValue}</span>
                  <span className="scale-value scale-value-sub">{Math.min(subVal, mainValue)}</span>
                </div>
                <button className="scale-sub-remove" onClick={() => removeSub(label)} type="button" title="Retirer">×</button>
              </div>
            );
          })}

          {/* Add row */}
          <div className="scale-add-sub">
            <input
              type="text"
              className="scale-add-sub-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
              placeholder="Préciser (ex : agrumes, fruits rouges…)"
            />
            <button
              className="scale-add-sub-btn"
              onClick={addSub}
              type="button"
              disabled={!newLabel.trim() || activeSubs.includes(newLabel.trim())}
            >
              + Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RadarInput ──────────────────────────────────────────────────────────────
// Answer format: { [axisLabel]: { _: number, _subs: string[], [precision]: number } }
// Représentation visuelle type toile d'araignée (même structure que l'analyse).

function normalizeRadarValue(value: AnswerValue, axes: RadarAxis[], mid: number): RadarAnswer {
  const out: RadarAnswer = {};
  const src: Record<string, unknown> = (typeof value === "object" && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
  axes.forEach(a => {
    const cur = src[a.label];
    if (typeof cur === "object" && cur !== null) {
      const curObj = cur as Record<string, unknown>;
      const subs: string[] = Array.isArray(curObj._subs) ? (curObj._subs as string[]) : (a.subCriteria || []);
      const entry: ScaleAnswer = { _: typeof curObj._ === "number" ? (curObj._ as number) : mid, _subs: subs };
      subs.forEach(s => { entry[s] = typeof curObj[s] === "number" ? (curObj[s] as number) : mid; });
      out[a.label] = entry;
    } else if (typeof cur === "number") {
      const subs = a.subCriteria || [];
      const entry: ScaleAnswer = { _: cur, _subs: [...subs] };
      subs.forEach(s => { entry[s] = mid; });
      out[a.label] = entry;
    } else {
      const subs = a.subCriteria || [];
      const entry: ScaleAnswer = { _: mid, _subs: [...subs] };
      subs.forEach(s => { entry[s] = mid; });
      out[a.label] = entry;
    }
  });
  return out;
}

function RadarSVG({ axes, values, max, onChange }: {
  axes: RadarAxis[];
  values: number[];   // length = axes.length
  max: number;
  onChange: (axisIdx: number, v: number) => void;
}) {
  const N = axes.length;
  const cx = 200, cy = 200, R = 140;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const angleFor = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / N;
  const pointFor = (i: number, v: number) => {
    const a = angleFor(i);
    const r = (Math.max(0, Math.min(max, v)) / max) * R;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const gridLevels = 5;
  const gridPolys = Array.from({ length: gridLevels }, (_, k) => {
    const lvl = (k + 1) / gridLevels;
    return axes.map((_, i) => {
      const a = angleFor(i);
      return `${cx + lvl * R * Math.cos(a)},${cy + lvl * R * Math.sin(a)}`;
    }).join(" ");
  });

  const valuePoly = axes.map((_, i) => {
    const p = pointFor(i, values[i] ?? 0);
    return `${p.x},${p.y}`;
  }).join(" ");

  // Projette les coordonnées SVG d'un pointer sur l'axe i pour obtenir la valeur correspondante
  const valueFromPointer = (i: number, clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 0;
    const loc = pt.matrixTransform(ctm.inverse());
    const a = angleFor(i);
    const dx = loc.x - cx, dy = loc.y - cy;
    const proj = dx * Math.cos(a) + dy * Math.sin(a); // projection sur l'axe radial
    const v = (proj / R) * max;
    return Math.max(0, Math.min(max, Math.round(v)));
  };

  const handlePointerDown = (i: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    setDragIdx(i);
    onChange(i, valueFromPointer(i, e.clientX, e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (dragIdx === null) return;
    onChange(dragIdx, valueFromPointer(dragIdx, e.clientX, e.clientY));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (dragIdx === null) return;
    try { (e.target as SVGCircleElement).releasePointerCapture(e.pointerId); } catch {}
    setDragIdx(null);
  };

  // Clic sur l'axe (en dehors de la poignée) pour positionner directement
  const handleAxisClick = (i: number) => (e: React.MouseEvent<SVGLineElement>) => {
    onChange(i, valueFromPointer(i, e.clientX, e.clientY));
  };

  return (
    <svg ref={svgRef} viewBox="0 0 400 400" className="radar-svg" role="img">
      {/* grille concentrique */}
      {gridPolys.map((pts, k) => (
        <polygon key={k} points={pts} className="radar-grid" />
      ))}
      {/* axes */}
      {axes.map((_, i) => {
        const a = angleFor(i);
        const ex = cx + R * Math.cos(a);
        const ey = cy + R * Math.sin(a);
        return (
          <line
            key={`ax${i}`}
            x1={cx} y1={cy} x2={ex} y2={ey}
            className="radar-axis"
            onClick={handleAxisClick(i)}
            style={{ cursor: "pointer" }}
          />
        );
      })}
      {/* polygone valeurs */}
      <polygon points={valuePoly} className="radar-value" />
      {/* poignées */}
      {axes.map((_, i) => {
        const p = pointFor(i, values[i] ?? 0);
        return (
          <circle
            key={`h${i}`}
            cx={p.x} cy={p.y} r={9}
            className={`radar-handle ${dragIdx === i ? "dragging" : ""}`}
            onPointerDown={handlePointerDown(i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        );
      })}
      {/* labels */}
      {axes.map((ax, i) => {
        const a = angleFor(i);
        const lx = cx + (R + 22) * Math.cos(a);
        const ly = cy + (R + 22) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
        return (
          <text key={`l${i}`} x={lx} y={ly} className="radar-label" textAnchor={anchor} dominantBaseline="middle">
            {ax.label}
          </text>
        );
      })}
      {/* valeur centrale (texte) */}
      {axes.map((_, i) => {
        const p = pointFor(i, values[i] ?? 0);
        const a = angleFor(i);
        const tx = p.x + 14 * Math.cos(a);
        const ty = p.y + 14 * Math.sin(a);
        return (
          <text key={`v${i}`} x={tx} y={ty} className="radar-value-text" textAnchor="middle" dominantBaseline="middle">
            {values[i] ?? 0}
          </text>
        );
      })}
    </svg>
  );
}

function RadarGroupBlock({ group, min, max, answer, onChange }: {
  group: { title: string; axes: RadarAxis[] };
  min: number;
  max: number;
  answer: RadarAnswer;
  onChange: (next: RadarAnswer) => void;
}) {
  const values = group.axes.map(a => answer[a.label]?._ ?? Math.round((min + max) / 2));

  const setAxis = (i: number, v: number) => {
    const axisLabel = group.axes[i].label;
    const cur: ScaleAnswer = answer[axisLabel] || { _: v, _subs: [] };
    const next: ScaleAnswer = { ...cur, _: v };
    // clamp des précisions éventuelles
    (cur._subs || []).forEach((s: string) => {
      const currentSub = next[s];
      if (typeof currentSub === "number" && currentSub > v) next[s] = v;
    });
    onChange({ ...answer, [axisLabel]: next });
  };

  const setSub = (axisLabel: string, sub: string, v: number) => {
    const cur = answer[axisLabel] || { _: Math.round((min + max) / 2), _subs: [] };
    const clamped = Math.min(v, cur._);
    onChange({ ...answer, [axisLabel]: { ...cur, [sub]: clamped } });
  };

  const addSub = (axisLabel: string, label: string) => {
    const cleaned = label.trim();
    if (!cleaned) return;
    const cur = answer[axisLabel] || { _: Math.round((min + max) / 2), _subs: [] };
    if (cur._subs.includes(cleaned)) return;
    onChange({ ...answer, [axisLabel]: { ...cur, _subs: [...cur._subs, cleaned], [cleaned]: Math.min(cur._, Math.round((min + max) / 2)) } });
  };

  const removeSub = (axisLabel: string, sub: string) => {
    const cur = answer[axisLabel];
    if (!cur) return;
    const next: ScaleAnswer = { ...cur, _subs: cur._subs.filter((s: string) => s !== sub) };
    delete next[sub];
    onChange({ ...answer, [axisLabel]: next });
  };

  const [newSubFor, setNewSubFor] = useState<{ axis: string; label: string } | null>(null);
  const [openAxis, setOpenAxis] = useState<string | null>(null);

  return (
    <div className="radar-group-block-participant">
      <h4 className="radar-group-title">{group.title}</h4>
      <div className="radar-group-body">
        <div className="radar-svg-wrap">
          <RadarSVG axes={group.axes} values={values} max={max} onChange={setAxis} />
        </div>
        <div className="radar-sliders">
          {group.axes.map((ax, i) => {
            const v = values[i];
            const axisAnswer = answer[ax.label] || { _: v, _subs: [] };
            const isOpen = openAxis === ax.label;
            return (
              <div key={ax.label} className="radar-slider-row">
                <div className="radar-slider-main">
                  <span className="radar-slider-label">{ax.label}</span>
                  <input
                    type="range" min={min} max={max} value={v}
                    onChange={(e) => setAxis(i, parseInt(e.target.value))}
                  />
                  <span className="radar-slider-val">{v}</span>
                  <button
                    type="button"
                    className="radar-precise-toggle"
                    onClick={() => setOpenAxis(isOpen ? null : ax.label)}
                    title="Préciser"
                  >{isOpen ? "−" : "+"}</button>
                </div>
                {isOpen && (
                  <div className="radar-subs">
                    {(axisAnswer._subs || []).map((s: string) => (
                      <div key={s} className="radar-sub-row">
                        <span className="radar-sub-label">{s}</span>
                        <input
                          type="range" min={min} max={v}
                          value={Math.min(typeof axisAnswer[s] === "number" ? (axisAnswer[s] as number) : v, v)}
                          onChange={(e) => setSub(ax.label, s, parseInt(e.target.value))}
                        />
                        <span className="radar-sub-val">{Math.min(typeof axisAnswer[s] === "number" ? (axisAnswer[s] as number) : v, v)}</span>
                        <button type="button" className="scale-sub-remove" onClick={() => removeSub(ax.label, s)}>×</button>
                      </div>
                    ))}
                    <div className="scale-add-sub">
                      <input
                        type="text"
                        className="scale-add-sub-input"
                        value={newSubFor?.axis === ax.label ? newSubFor.label : ""}
                        onChange={(e) => setNewSubFor({ axis: ax.label, label: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newSubFor?.axis === ax.label) {
                              addSub(ax.label, newSubFor.label);
                              setNewSubFor(null);
                            }
                          }
                        }}
                        placeholder="Préciser (saisie libre)"
                      />
                      <button
                        type="button"
                        className="scale-add-sub-btn"
                        onClick={() => {
                          if (newSubFor?.axis === ax.label) {
                            addSub(ax.label, newSubFor.label);
                            setNewSubFor(null);
                          }
                        }}
                        disabled={!newSubFor || newSubFor.axis !== ax.label || !newSubFor.label.trim()}
                      >+ Ajouter</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RadarInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: RadarAnswer) => void }) {
  const mn = q.min ?? 0;
  const mx = q.max ?? 10;
  const mid = Math.round((mn + mx) / 2);
  const groups = useMemo(() => q.radarGroups || [], [q.radarGroups]);
  const allAxes = useMemo(() => groups.flatMap(g => g.axes), [groups]);

  const [mode, setMode] = useState<"radar" | "sliders">("radar");

  const answer: RadarAnswer = useMemo(
    () => normalizeRadarValue(value, allAxes, mid),
    [value, allAxes, mid]
  );

  // init/seed at mount if no value
  useEffect(() => {
    if (value == null || (typeof value === "object" && Object.keys(value).length === 0)) {
      onChange(answer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="q-block">
      <span className="q-label">
        {q.label}
        <Badge variant="ns" className="q-type-badge">radar</Badge>
      </span>
      <div className="radar-mode-switch">
        <button
          type="button"
          className={`radar-mode-btn ${mode === "radar" ? "active" : ""}`}
          onClick={() => setMode("radar")}
        >Toile d&apos;araignée</button>
        <button
          type="button"
          className={`radar-mode-btn ${mode === "sliders" ? "active" : ""}`}
          onClick={() => setMode("sliders")}
        >Curseurs</button>
      </div>
      {mode === "radar" ? (
        <div className="radar-groups">
          {groups.map(g => (
            <RadarGroupBlock
              key={g.id}
              group={g}
              min={mn}
              max={mx}
              answer={answer}
              onChange={onChange}
            />
          ))}
        </div>
      ) : (
        <div className="radar-sliders-only">
          {groups.map(g => (
            <div key={g.id} className="radar-group-sliders-section">
              <h4 className="radar-group-title">{g.title}</h4>
              {g.axes.map(ax => {
                const a = answer[ax.label] || { _: mid, _subs: [] };
                return (
                  <div key={ax.label} className="scale-track" style={{ marginBottom: 6 }}>
                    <span className="radar-slider-label">{ax.label}</span>
                    <input
                      type="range" min={mn} max={mx} value={a._}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        const next: ScaleAnswer = { ...a, _: v };
                        (a._subs || []).forEach((s: string) => {
                          const sub = next[s];
                          if (typeof sub === "number" && sub > v) next[s] = v;
                        });
                        onChange({ ...answer, [ax.label]: next });
                      }}
                    />
                    <span className="scale-value">{a._}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const QuestionInput = ({ q, value, onChange, products }: QuestionInputProps) => {
  if (q.type === "scale") {
    return <ScaleInput q={q} value={value} onChange={onChange} />;
  }

  if (q.type === "radar") {
    return <RadarInput q={q} value={value} onChange={onChange} />;
  }

  if (q.type === "text") {
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">texte</Badge></span>
        <textarea
          className="q-text"
          placeholder={q.placeholder}
          value={typeof value === "string" ? value : ""}
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
          {q.questionText?.trim()
            ? q.questionText
            : <>Vous avez deux verres de référence <strong>{refA}</strong> et <strong>{refB}</strong>. À quel verre le verre <strong>{testCode}</strong> est-il identique ?</>
          }
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
    const currentVal: Record<string, string> = (typeof value === "object" && value !== null && !Array.isArray(value)) ? (value as unknown as Record<string, string>) : {};
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
    const currentVal: Record<string, string> = (typeof value === "object" && value !== null && !Array.isArray(value)) ? (value as unknown as Record<string, string>) : {};
    return (
      <div className="q-block">
        <span className="q-label">{q.label}<Badge variant="ns" className="q-type-badge">A / non-A</Badge></span>
        <p className="discrim-ref">
          {q.questionText?.trim()
            ? q.questionText
            : <>Vous avez un verre de référence <strong>{ref}</strong> devant vous. Dites, pour chacun des verres ci-dessous, s&apos;il est identique ou différent du verre <strong>{ref}</strong>.</>
          }
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
