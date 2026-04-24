"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Question, Product, RadarAxis, AnswerValue, ScaleAnswer, RadarAnswer, RadarNodeAnswer } from "../../types";
import { FiChevronLeft, FiSearch, FiX, FiPlus, FiMinus } from "react-icons/fi";
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
  const [touchActive, setTouchActive] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Direct touch drag
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchActive === null) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const item = el?.closest(".h-rank-item");
    if (item && listRef.current) {
      const idx = Array.from(listRef.current.children).filter(c => c.classList.contains("h-rank-item")).indexOf(item);
      if (idx !== -1 && idx !== touchActive) {
        applyReorder(touchActive, idx);
        setTouchActive(idx);
      }
    }
  };

  return (
    <div className="h-rank-wrap">
      <p className="drag-hint">
        Classez les verres de gauche à droite : le verre le moins intense se place à gauche, le plus intense à droite.
        Chaque verre est <strong>inférieur</strong> (&lt;) à celui qui le suit.
        <span className="drag-hint-touch"> Sur tablette : glissez les verres ou appuyez pour intervertir.</span>
      </p>
      <div 
        className="h-rank-list"
        ref={listRef}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setTouchActive(null)}
      >
        {ordered.map((code, i) => (
          <React.Fragment key={code}>
            <div
              draggable
              onDragStart={() => { setDragIdx(i); setSelectedIdx(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onTouchStart={() => setTouchActive(i)}
              onClick={() => handleTap(i)}
              className={[
                "h-rank-item",
                dragIdx === i || touchActive === i ? "dragging" : "",
                overIdx === i && dragIdx !== i ? "drag-over" : "",
                selectedIdx === i ? "h-rank-selected" : "",
              ].filter(Boolean).join(" ")}
              style={{ touchAction: "none" }}
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
    const nextMain = Math.max(valObj._, v);
    onChange({ ...valObj, _: nextMain, [label]: v });
  };

  const removeSub = (label: string) => {
    const newSubs = activeSubs.filter(s => s !== label);
    const next: ScaleAnswer = { ...valObj, _subs: newSubs };
    delete next[label];
    onChange(next);
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
          {activeSubs.map(label => {
            const subVal = typeof valObj[label] === "number" ? valObj[label] : mainValue;
            return (
              <div key={label} className="scale-subcriterion">
                <span className="scale-sub-label">{label}</span>
                <div className="scale-track scale-track-sub">
                  <span style={{ ...monoStyle, minWidth: "20px" }}>{mn}</span>
                  <input
                    type="range"
                    min={mn}
                    max={mx}
                    value={subVal}
                    onChange={(e) => updateSub(label, parseInt(e.target.value))}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ ...monoStyle, minWidth: "20px" }}>{mx}</span>
                  <span className="scale-value scale-value-sub">{subVal}</span>
                </div>
                <button className="scale-sub-remove" onClick={() => removeSub(label)} type="button" title="Retirer">×</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── RadarInput ──────────────────────────────────────────────────────────────
// Answer format: { [axisLabel]: { _: number, _subs: string[], [precision]: number } }
// Représentation visuelle type toile d'araignée (même structure que l'analyse).

// Valeurs par défaut dépendantes du niveau (famille = 5, classes/mots = 0).
interface RadarDefaults { family: number; child: number }

// Convertit récursivement une valeur brute (nouveau format, ancien ScaleAnswer, ou number) en RadarNodeAnswer.
function normalizeRadarNode(raw: unknown, axis: RadarAxis, defaults: RadarDefaults, depth: number = 0): RadarNodeAnswer {
  const defaultValue = depth === 0 ? defaults.family : defaults.child;
  let value = defaultValue;
  let childrenRaw: Record<string, unknown> = {};

  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj._ === "number") value = obj._;
    if (typeof obj.children === "object" && obj.children !== null) {
      childrenRaw = obj.children as Record<string, unknown>;
    } else {
      // Legacy ScaleAnswer : { _, _subs, [sub]: number }
      Object.keys(obj).forEach(k => {
        if (k === "_" || k === "_subs") return;
        if (typeof obj[k] === "number") childrenRaw[k] = { _: obj[k] };
      });
    }
  }

  const out: RadarNodeAnswer = { _: value };
  const childAxes = axis.children && axis.children.length > 0
    ? axis.children
    : (axis.subCriteria || []).map(l => ({ label: l } as RadarAxis));
  if (childAxes.length > 0) {
    const childMap: Record<string, RadarNodeAnswer> = {};
    for (const c of childAxes) {
      childMap[c.label] = normalizeRadarNode(childrenRaw[c.label], c, defaults, depth + 1);
    }
    out.children = childMap;
  }
  return out;
}

function normalizeRadarValue(value: AnswerValue, axes: RadarAxis[], defaults: RadarDefaults): RadarAnswer {
  const src: Record<string, unknown> = (typeof value === "object" && value !== null && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : {};
  const out: RadarAnswer = {};
  for (const ax of axes) {
    out[ax.label] = normalizeRadarNode(src[ax.label], ax, defaults, 0);
  }
  return out;
}

// Clampe récursivement un nœud et ses descendants à `maxAllowed`.
function clampNodeTree(node: RadarNodeAnswer, maxAllowed: number): RadarNodeAnswer {
  const v = Math.min(node._, maxAllowed);
  const next: RadarNodeAnswer = { _: v };
  if (node.children) {
    const c: Record<string, RadarNodeAnswer> = {};
    Object.entries(node.children).forEach(([k, child]) => {
      c[k] = clampNodeTree(child, v);
    });
    next.children = c;
  }
  return next;
}

// Applique un patch sur un chemin dans la map des axes ; propage les augmentations vers le haut et les réductions vers le bas.
function setNodeAtPath(
  answer: RadarAnswer,
  path: string[],
  newValue: number
): RadarAnswer {
  if (path.length === 0) return answer;
  const [head, ...tail] = path;
  const rootNode = answer[head];
  if (!rootNode) return answer;

  const updateNode = (node: RadarNodeAnswer, remaining: string[]): RadarNodeAnswer => {
    if (remaining.length === 0) {
      // Nœud cible : on applique la nouvelle valeur et on clampe les enfants vers le bas.
      return clampNodeTree({ ...node, _: newValue }, newValue);
    }
    const [h, ...t] = remaining;
    const child = node.children?.[h];
    if (!child) return node;

    const updatedChild = updateNode(child, t);
    // Upward propagation : la valeur du parent doit être AU MOINS égale à celle de l'enfant (uniquement si augmentation).
    const nextVal = Math.max(node._, updatedChild._);

    return {
      ...node,
      _: nextVal,
      children: { ...node.children, [h]: updatedChild }
    };
  };

  const updatedRoot = updateNode(rootNode, tail);
  return { ...answer, [head]: updatedRoot };
}

// Récolte tous les nœuds descendants (pour la recherche).
function collectNodes(axes: RadarAxis[], trail: string[] = []): Array<{ path: string[]; label: string }> {
  const out: Array<{ path: string[]; label: string }> = [];
  for (const ax of axes) {
    const path = [...trail, ax.label];
    out.push({ path, label: ax.label });
    if (ax.children && ax.children.length > 0) {
      out.push(...collectNodes(ax.children, path));
    }
  }
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

// Nœud récursif : slider + bouton d'expansion vers ses enfants.
function RadarTreeNode({
  axis, nodeAnswer, min, max, path, expandedPaths, togglePath, setPathValue, highlightKey,
}: {
  axis: RadarAxis;
  nodeAnswer: RadarNodeAnswer;
  min: number;
  max: number;      // global max
  path: string[];
  expandedPaths: Set<string>;
  togglePath: (key: string) => void;
  setPathValue: (path: string[], v: number) => void;
  highlightKey: string | null;
}) {
  const pathKey = path.join("/");
  const hasChildren = !!axis.children && axis.children.length > 0;
  const expanded = expandedPaths.has(pathKey);
  const v = nodeAnswer._;
  const isHighlight = highlightKey === pathKey;

  return (
    <div className={`radar-tree-node depth-${path.length - 1}${isHighlight ? " highlight" : ""}`} data-path={pathKey}>
      <div className="radar-tree-row">
        <span className="radar-tree-label">{axis.label}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={v}
          onChange={(e) => setPathValue(path, parseInt(e.target.value))}
        />
        <span className="radar-tree-val">{v}</span>
        {hasChildren ? (
          <button
            type="button"
            className="radar-tree-toggle"
            onClick={() => togglePath(pathKey)}
            title={expanded ? "Refermer" : "Préciser"}
            aria-expanded={expanded}
          >
            {expanded ? <FiMinus size={12} /> : <FiPlus size={12} />}
          </button>
        ) : (
          <span className="radar-tree-toggle placeholder" aria-hidden="true" />
        )}
      </div>
      {expanded && hasChildren && (
        <div className="radar-tree-children">
          {axis.children!.map(child => {
            // Enfants (classes, mots) : valeur par défaut = min (0) ; always visible quand le parent est déplié.
            const childAnswer = nodeAnswer.children?.[child.label] ?? { _: min };
            return (
              <RadarTreeNode
                key={child.label}
                axis={child}
                nodeAnswer={childAnswer}
                min={min}
                max={max}
                path={[...path, child.label]}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
                setPathValue={setPathValue}
                highlightKey={highlightKey}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RadarGroupBlock({ group, min, max, answer, onChange }: {
  group: { title: string; axes: RadarAxis[] };
  min: number;
  max: number;
  answer: RadarAnswer;
  onChange: (next: RadarAnswer) => void;
}) {
  const familyDefault = Math.round((min + max) / 2);
  const values = group.axes.map(a => answer[a.label]?._ ?? familyDefault);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [forcedVisible, setForcedVisible] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // Accordion : à chaque niveau, un seul frère peut être déplié à la fois.
  // Ouvrir un nœud ferme le frère (et tous ses descendants) ; les valeurs restent inchangées.
  const togglePath = (key: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      const parts = key.split("/");
      const parentPrefix = parts.slice(0, -1).join("/");

      if (next.has(key)) {
        // Refermer : supprime la clé + tous ses descendants
        [...next].forEach(k => {
          if (k === key || k.startsWith(key + "/")) next.delete(k);
        });
        return next;
      }
      // Fermer les frères (même parent, même profondeur) et leurs descendants
      [...next].forEach(existing => {
        if (existing === key) return;
        const eparts = existing.split("/");
        const eparent = eparts.slice(0, -1).join("/");
        if (eparts.length === parts.length && eparent === parentPrefix) {
          [...next].forEach(k => {
            if (k === existing || k.startsWith(existing + "/")) next.delete(k);
          });
        }
      });
      next.add(key);
      return next;
    });
  };

  const setPathValue = (path: string[], v: number) => {
    onChange(setNodeAtPath(answer, path, v));
  };

  const setAxis = (i: number, v: number) => {
    onChange(setNodeAtPath(answer, [group.axes[i].label], v));
  };

  // ── Recherche ────────────────────────────────────────────────────────────
  const allNodes = useMemo(() => collectNodes(group.axes), [group.axes]);
  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allNodes
      .filter(n => n.label.toLowerCase().includes(q))
      .slice(0, 20);
  }, [searchQuery, allNodes]);

  const revealPath = (path: string[]) => {
    // Accordion : on garde uniquement la chaîne jusqu'à la cible (ferme tout le reste).
    setExpandedPaths(() => {
      const next = new Set<string>();
      for (let i = 1; i <= path.length; i++) {
        next.add(path.slice(0, i).join("/"));
      }
      return next;
    });
    // Force la visibilité de la famille racine même si sa valeur est 0.
    setForcedVisible(prev => {
      const next = new Set(prev);
      next.add(path[0]);
      return next;
    });
    const fullKey = path.join("/");
    setHighlightKey(fullKey);
    setSearchOpen(false);
    setSearchQuery("");
    // Scroll dans la vue après rendu
    requestAnimationFrame(() => {
      const el = blockRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(fullKey)}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightKey(null), 1800);
    });
  };

  // Filtre : n'affiche dans la sidebar que les familles non-nulles OU rendues visibles via la recherche.
  const visibleAxes = group.axes.filter(ax => {
    const v = answer[ax.label]?._ ?? min;
    return v > min || forcedVisible.has(ax.label);
  });

  return (
    <div className="radar-group-block-participant" ref={blockRef}>
      <div className="radar-group-header-row">
        <h4 className="radar-group-title">{group.title}</h4>
        <div className="radar-search">
          {searchOpen ? (
            <div className="radar-search-box">
              <FiSearch size={13} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un descripteur…"
                className="radar-search-input"
              />
              <button
                type="button"
                className="radar-search-close"
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                aria-label="Fermer la recherche"
              ><FiX size={13} /></button>
              {results.length > 0 && (
                <div className="radar-search-results">
                  {results.map(r => (
                    <button
                      key={r.path.join("/")}
                      type="button"
                      className="radar-search-result"
                      onClick={() => revealPath(r.path)}
                    >
                      <strong>{r.label}</strong>
                      <span className="radar-search-crumbs">{r.path.slice(0, -1).join(" › ")}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery && results.length === 0 && (
                <div className="radar-search-results empty">Aucun résultat.</div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="radar-search-toggle"
              onClick={() => setSearchOpen(true)}
              title="Rechercher un descripteur"
              aria-label="Rechercher"
            ><FiSearch size={14} /></button>
          )}
        </div>
      </div>
      <div className="radar-group-body">
        <div className="radar-svg-wrap">
          <RadarSVG axes={group.axes} values={values} max={max} onChange={setAxis} />
        </div>
        <div className="radar-tree">
          {visibleAxes.length === 0 ? (
            <div className="radar-tree-empty">
              Faites glisser un point sur la toile pour ajuster finement une famille ici.
            </div>
          ) : (
            visibleAxes.map(ax => {
              const nodeAnswer = answer[ax.label] ?? { _: familyDefault };
              return (
                <RadarTreeNode
                  key={ax.label}
                  axis={ax}
                  nodeAnswer={nodeAnswer}
                  min={min}
                  max={max}
                  path={[ax.label]}
                  expandedPaths={expandedPaths}
                  togglePath={togglePath}
                  setPathValue={setPathValue}
                  highlightKey={highlightKey}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RadarInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: RadarAnswer) => void }) {
  const mn = q.min ?? 0;
  const mx = q.max ?? 10;
  const groups = useMemo(() => q.radarGroups || [], [q.radarGroups]);
  const allAxes = useMemo(() => groups.flatMap(g => g.axes), [groups]);

  const [mode, setMode] = useState<"radar" | "sliders">("radar");

  // Familles = valeur médiane (5 pour 0-10) → toujours visibles au départ.
  // Classes / mots = 0 → visibles dès que la famille parente est dépliée.
  const defaults = useMemo(() => ({ family: Math.round((mn + mx) / 2), child: mn }), [mn, mx]);

  const answer: RadarAnswer = useMemo(
    () => normalizeRadarValue(value, allAxes, defaults),
    [value, allAxes, defaults]
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
                const a = answer[ax.label] ?? { _: defaults.family };
                return (
                  <div key={ax.label} className="scale-track" style={{ marginBottom: 6 }}>
                    <span className="radar-slider-label">{ax.label}</span>
                    <input
                      type="range" min={mn} max={mx} value={a._}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        onChange(setNodeAtPath(answer, [ax.label], v));
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
