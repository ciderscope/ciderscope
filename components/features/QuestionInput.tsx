"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { TouchSafeSlider } from "../ui/TouchSafeSlider";
import { Question, Product, RadarAxis, AnswerValue, ScaleAnswer, RadarAnswer, RadarNodeAnswer } from "../../types";
import { FiChevronLeft, FiSearch, FiX, FiPlus, FiMinus } from "react-icons/fi";
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import { Radar } from "react-chartjs-2";
import ChartJSDragDataPlugin from "chartjs-plugin-dragdata";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ChartJSDragDataPlugin);
interface QuestionInputProps {
  q: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  products?: Product[];
}

const questionBlockClass = "mb-[26px] last:mb-0";
const questionLabelClass = "mb-3 block text-base font-semibold leading-[1.4]";
const questionTypeBadgeClass = "ml-[7px] align-middle font-mono text-[10px] font-normal uppercase tracking-[.5px] text-[var(--mid)]";
const questionTextClass = "min-h-20 w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-3 text-sm font-[inherit] outline-none transition-colors duration-100 focus:border-[var(--accent)]";
const qcmOptionsClass = "flex flex-col gap-2";
const qcmOptionClass = (selected: boolean) => [
  "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[var(--radius)] border bg-[var(--paper)] px-[17px] py-3.5 transition-colors duration-100 hover:border-[rgba(30,46,46,.25)]",
  selected ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--border)]",
].join(" ");
const qcmDotClass = (selected: boolean) => [
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-100",
  selected ? "border-[var(--accent)] bg-[var(--accent)] after:h-[7px] after:w-[7px] after:rounded-full after:bg-white after:content-['']" : "border-[var(--border)]",
].join(" ");
const scaleWrapClass = "flex flex-col gap-2";
const scaleTrackClass = "flex items-center gap-2.5 max-[480px]:gap-2";
const scaleValueClass = "min-w-7 text-center text-xl font-extrabold text-[var(--accent)]";
const scaleSubcriteriaClass = "mt-1.5 flex flex-col gap-[7px] rounded-md border-l-2 border-[var(--t-scale)] bg-[var(--paper2)] px-3 py-2.5";
const scaleSubcriterionClass = "flex items-center gap-[7px] max-[480px]:flex-wrap max-[480px]:gap-x-1.5 max-[480px]:gap-y-1";
const scaleSubLabelClass = "min-w-[100px] font-mono text-[11px] font-medium text-[var(--ink)] max-[480px]:min-w-0 max-[480px]:flex-auto xl:min-w-[150px]";
const scaleTrackSubClass = "flex flex-1 items-center gap-2.5 max-[480px]:order-3 max-[480px]:flex-[1_1_100%]";
const scaleSubValueClass = "min-w-[26px] text-center text-sm font-extrabold text-[var(--accent)]";
const scaleSubRemoveClass = "flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-transparent text-sm leading-none text-[var(--mid)] transition-all duration-100 hover:border-[var(--danger)] hover:bg-[rgba(168,50,40,.06)] hover:text-[var(--danger)] max-[480px]:order-2";
const triangleGridClass = "grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[11px] max-[480px]:grid-cols-2 max-[480px]:gap-2 min-[481px]:max-[720px]:grid-cols-[repeat(auto-fit,minmax(100px,1fr))] min-[721px]:max-[900px]:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]";
const triangleChoiceClass = (selected: boolean) => [
  "cursor-pointer rounded-[var(--radius)] border-[1.5px] bg-[var(--paper)] px-4 py-7 text-center transition-[border-color,background,box-shadow] duration-100 hover:border-[rgba(30,46,46,.3)] hover:shadow-[0_3px_12px_rgba(30,46,46,.07)] max-[480px]:px-2.5 max-[480px]:py-5",
  selected ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--border)]",
].join(" ");
const triangleCodeClass = (selected: boolean) => [
  "font-mono text-2xl font-semibold text-[var(--ink)]",
  selected ? "text-[var(--accent)]" : "",
].join(" ");
const hRankWrapClass = "mt-2";
const hRankHintClass = "mb-1 text-xs text-[var(--mid)]";
const hRankHintTouchClass = "hidden text-[11px] text-[var(--mid)] [@media(hover:none)_and_(pointer:coarse)]:inline";
const hRankListClass = "flex flex-row items-center gap-[5px] overflow-x-auto px-[3px] pt-3 pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]";
const hRankItemClass = (dragging: boolean, dragOver: boolean, selected: boolean) => [
  "h-rank-item flex shrink-0 cursor-grab select-none flex-col items-center justify-center gap-[5px] rounded-lg border bg-[var(--paper)] px-2 py-2.5 transition-[border-color,box-shadow,transform] duration-100 [touch-action:none] active:cursor-grabbing hover:border-[rgba(30,46,46,.28)] hover:shadow-[0_2px_10px_rgba(30,46,46,.08)] max-[480px]:min-h-[82px] max-[480px]:min-w-[72px] max-[480px]:px-2.5 max-[480px]:py-3 [@media(hover:none)_and_(pointer:coarse)]:min-h-24 [@media(hover:none)_and_(pointer:coarse)]:min-w-[72px] [@media(hover:none)_and_(pointer:coarse)]:cursor-pointer",
  dragging ? "scale-[.93] opacity-[.35]" : "",
  dragOver ? "scale-[1.04] border-[var(--accent)] bg-[var(--accent-tint)] shadow-[0_0_0_2px_rgba(191,100,8,.15)]" : "border-[var(--border)]",
  selected ? "border-[var(--accent)] bg-[var(--accent-tint)] shadow-[0_0_0_2px_rgba(191,100,8,.2)]" : "",
].filter(Boolean).join(" ");
const hRankPosClass = "font-mono text-[10px] font-medium text-[var(--mid)]";
const hRankCodeClass = "font-mono text-[15px] font-bold text-[var(--ink)]";
const hRankNavClass = "mt-1.5 hidden gap-1 [@media(hover:none)_and_(pointer:coarse)]:flex";
const hRankNavBtnClass = "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] bg-[var(--paper)] text-xs leading-none text-[var(--ink)] transition-colors duration-100 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)] disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--paper)]";
const hRankSepClass = "flex shrink-0 items-center text-base text-[var(--mid)] opacity-40 max-[480px]:hidden";
const discrimRefClass = "mb-4 rounded-r-md border-l-[3px] border-[var(--accent)] bg-[linear-gradient(to_right,rgba(191,100,8,.06),transparent)] px-4 py-3 text-sm leading-[1.65] text-[var(--ink)] [&_strong]:font-bold [&_strong]:text-[var(--accent)]";
const anonaGridClass = "mt-2.5 flex flex-col gap-2.5";
const anonaRowClass = "flex min-h-14 items-center gap-3.5 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-4 py-3 shadow-[0_1px_3px_rgba(30,46,46,.04)] max-[480px]:flex-wrap max-[480px]:gap-2 max-[480px]:px-3 max-[480px]:py-2.5";
const anonaCodeClass = "min-w-14 font-mono text-[17px] font-bold text-[var(--ink)] max-[480px]:min-w-12";
const anonaChoicesClass = "flex gap-2 max-[480px]:flex-wrap max-[480px]:gap-1.5";
const anonaBtnClass = (selected: boolean, tone: "ok" | "diff") => [
  "min-h-11 cursor-pointer rounded-full border bg-[var(--paper)] px-[22px] py-2.5 font-mono text-sm font-semibold transition-all duration-100 hover:border-[rgba(30,46,46,.3)] max-[480px]:min-h-10 max-[480px]:flex-auto max-[480px]:px-3.5 max-[480px]:py-2",
  selected && tone === "ok" ? "border-[var(--ok)] bg-[var(--ok)] text-white" : "",
  selected && tone === "diff" ? "border-[var(--danger)] bg-[var(--danger)] text-white" : "",
  !selected ? "border-[var(--border)]" : "",
].filter(Boolean).join(" ");
const radarGroupsClass = "flex flex-col gap-[22px]";
const radarGroupBlockParticipantClass = "rounded-[10px] border-l-[3px] border-[var(--t-scale)] bg-[var(--paper2)] px-3.5 pt-3.5 pb-[18px]";
const radarGroupHeaderRowClass = "mb-2.5 flex items-center justify-between gap-2.5";
const radarGroupTitleClass = "m-0 font-mono text-[13px] font-semibold uppercase tracking-[.5px] text-[var(--ink)]";
const radarGroupBodyClass = (showSVG: boolean) => [
  "grid items-start gap-9 max-[720px]:grid-cols-1 max-[480px]:gap-3",
  showSVG ? "grid-cols-[minmax(280px,1fr)_minmax(260px,1fr)]" : "grid-cols-1",
].join(" ");
const radarSearchClass = "relative flex-none";
const radarSearchToggleClass = "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]";
const radarSearchBoxClass = "inline-flex min-w-[220px] max-w-full items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--paper)] px-2 py-1 max-[480px]:min-w-0 max-[480px]:flex-[1_1_100%]";
const radarSearchInputClass = "min-w-0 flex-1 border-0 bg-transparent text-xs text-[var(--ink)] outline-none";
const radarSearchCloseClass = "inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[var(--mid)] hover:text-[var(--danger)]";
const radarSearchResultsClass = "absolute right-0 top-[calc(100%+4px)] z-20 max-h-[260px] min-w-60 max-w-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--paper)] p-1 shadow-[0_4px_16px_rgba(0,0,0,.10)] max-[480px]:left-0 max-[480px]:right-0 max-[480px]:max-w-full";
const radarSearchEmptyClass = `${radarSearchResultsClass} px-3 py-2.5 text-xs italic text-[var(--mid)]`;
const radarSearchResultClass = "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left hover:bg-[var(--paper2)] [&_strong]:text-[13px] [&_strong]:font-semibold [&_strong]:text-[var(--ink)] hover:[&_strong]:text-[var(--accent)]";
const radarSearchCrumbsClass = "font-mono text-[10px] text-[var(--mid)]";
const radarTreeClass = "flex flex-col gap-2.5";
const radarTreeEmptyClass = "rounded-lg border border-dashed border-[var(--border)] bg-white/50 px-3.5 py-[18px] text-center text-xs italic text-[var(--mid)]";
const radarTreeRowClass = "radar-tree-row flex items-center gap-2.5 max-[480px]:flex-wrap max-[480px]:items-center max-[480px]:gap-x-2 max-[480px]:gap-y-1.5";
const radarTreeLabelClass = (depth: number, custom = false) => [
  "radar-tree-label min-w-0 flex-[0_0_108px] font-mono text-xs font-semibold uppercase tracking-[.3px] text-[var(--ink)] max-[480px]:flex-[1_1_100%] max-[480px]:text-xs max-[480px]:leading-tight",
  depth === 1 ? "font-medium normal-case tracking-normal text-[11.5px] text-[var(--ink)] [flex-basis:110px]" : "",
  depth >= 2 ? "font-normal normal-case tracking-normal text-[11px] text-[var(--mid)] [flex-basis:100px]" : "",
  custom ? "radar-tree-label-custom italic text-[var(--mid)]" : "",
].filter(Boolean).join(" ");
const radarTreeValClass = (depth: number) => [
  "radar-tree-val min-w-6 text-center text-sm font-bold text-[var(--accent)] max-[480px]:flex-none",
  depth === 1 ? "text-[13px] text-[var(--ink)]" : "",
  depth >= 2 ? "text-xs text-[var(--mid)]" : "",
].filter(Boolean).join(" ");
const radarTreeNodeClass = (depth: number, isHighlight: boolean, untouchedFlag: boolean) => [
  `radar-tree-node depth-${depth} flex flex-col gap-1.5`,
  depth === 0 ? "[&>.radar-tree-row]:border-b [&>.radar-tree-row]:border-[var(--border)] [&>.radar-tree-row]:px-0 [&>.radar-tree-row]:pt-1.5 [&>.radar-tree-row]:pb-1" : "",
  depth === 1 ? "ml-[22px] rounded-lg border-l-[3px] border-l-[var(--t-scale)] bg-[var(--paper)] px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,.04)] max-[480px]:ml-2 max-[480px]:px-2 max-[480px]:py-1.5" : "",
  depth >= 2 ? "ml-[18px] rounded-md border-l-2 border-l-[rgba(102,102,102,.25)] bg-[var(--paper)] px-2 py-1 max-[480px]:ml-1.5 max-[480px]:px-1.5" : "",
  isHighlight ? "[&>.radar-tree-row]:animate-[radar-highlight-fade_1.8s_ease_forwards] [&>.radar-tree-row]:rounded-md [&>.radar-tree-row]:bg-[var(--lime)]" : "",
  untouchedFlag && depth === 0 ? "radar-tree-node--untouched [&>.radar-tree-row]:rounded-md [&>.radar-tree-row]:border-l-[3px] [&>.radar-tree-row]:border-l-[#c0392b] [&>.radar-tree-row]:bg-[rgba(192,57,43,.08)] [&>.radar-tree-row]:pl-2 [&>.radar-tree-row_.radar-tree-label]:text-[#c0392b]" : "",
].filter(Boolean).join(" ");
const radarTreeToggleClass = (placeholder = false) => [
  "inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--accent)] bg-[var(--paper)] leading-none text-[var(--accent)] shadow-[0_1px_2px_rgba(238,140,0,.10)] transition-[background,color,transform,box-shadow] duration-100 hover:scale-[1.08] hover:bg-[rgba(238,140,0,.12)] hover:text-[var(--accent2)] hover:shadow-[0_2px_6px_rgba(238,140,0,.20)] active:scale-95 max-[480px]:flex-none",
  placeholder ? "pointer-events-none cursor-default border-transparent bg-transparent shadow-none hover:scale-100 hover:bg-transparent hover:shadow-none" : "cursor-pointer",
].join(" ");
const radarTreeChildrenClass = "mt-1.5 flex flex-col gap-1.5 max-[480px]:mt-1";
const radarCustomAddClass = "mt-0.5 flex items-center gap-1.5 py-0.5 pl-4 max-[480px]:pl-2";
const radarCustomInputClass = "min-w-0 flex-1 rounded-md border border-dashed border-[var(--border)] bg-transparent px-2 py-1 text-[11px] text-[var(--mid)] outline-none focus:border-[var(--accent)] focus:border-solid focus:bg-[var(--paper)] focus:text-[var(--ink)]";
const radarCustomBtnClass = "inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-transparent text-[var(--mid)] transition-all duration-100 hover:not-disabled:border-[var(--accent)] hover:not-disabled:border-solid hover:not-disabled:bg-[var(--accent)] hover:not-disabled:text-white disabled:cursor-not-allowed disabled:opacity-40";
const radarWarningClass = "mt-3.5 rounded-md border-l-[3px] border-[#c8820a] bg-[rgba(200,130,10,.10)] px-3.5 py-2.5 text-xs leading-[1.4] text-[var(--ink)] [&_strong]:text-[#8a5a00]";

// Horizontal draggable rank for classement / seuil
const HorizontalRank = React.memo(function HorizontalRank({ items, value, onChange }: { items: string[]; value: AnswerValue; onChange: (v: string[]) => void }) {
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
    <div className={hRankWrapClass}>
      <p className={hRankHintClass}>
        Classez les verres de gauche à droite : le verre le moins intense se place à gauche, le plus intense à droite.
        Chaque verre est <strong>inférieur</strong> (&lt;) à celui qui le suit.
        <span className={hRankHintTouchClass}> Sur tablette : glissez les verres ou appuyez pour intervertir.</span>
      </p>
      <div 
        className={hRankListClass}
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
              className={hRankItemClass(dragIdx === i || touchActive === i, overIdx === i && dragIdx !== i, selectedIdx === i)}
            >
              <span className={hRankPosClass}>{i + 1}</span>
              <span className={hRankCodeClass}>{code}</span>
              <div className={hRankNavClass} aria-hidden="true">
                <button
                  type="button"
                  className={hRankNavBtnClass}
                  onClick={(e) => { e.stopPropagation(); if (i > 0) applyReorder(i, i - 1); }}
                  disabled={i === 0}
                  aria-label="Déplacer à gauche"
                >◀</button>
                <button
                  type="button"
                  className={hRankNavBtnClass}
                  onClick={(e) => { e.stopPropagation(); if (i < ordered.length - 1) applyReorder(i, i + 1); }}
                  disabled={i === ordered.length - 1}
                  aria-label="Déplacer à droite"
                >▶</button>
              </div>
            </div>
            {i < ordered.length - 1 && (
              <div className={hRankSepClass} aria-hidden="true">
                <FiChevronLeft size={16} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});

// ── ScaleInput (extracted to allow hooks usage) ─────────────────────────────
// Answer format: number (no subs) OR { _: number, _subs: string[], [label]: number }
const ScaleInput = React.memo(function ScaleInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const mn = q.min ?? 0;
  const mx = q.max ?? 10;
  const mid = Math.round((mn + mx) / 2);

  // Normalise value → always work as object internally
  const valObj: ScaleAnswer = (() => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as ScaleAnswer;
    if (typeof value === "number") return { _: value, _subs: [], _touched: true };
    return { _: mid, _subs: [] };
  })();

  const mainValue: number = typeof valObj._ === "number" ? valObj._ : mid;
  const activeSubs: string[] = Array.isArray(valObj._subs) ? valObj._subs : [];
  const touched: boolean = valObj._touched === true;

  // Init on mount: if no value yet, seed with admin-defined suggestions.
  // Une valeur numérique brute (ancien format) est considérée comme déjà
  // validée — on stamp `_touched` pour ne pas redemander au jury de re-tap
  // une réponse qu'il avait déjà saisie.
  useEffect(() => {
    if (value == null || typeof value === "number") {
      const defaults = q.subCriteria || [];
      const init: ScaleAnswer = {
        _: typeof value === "number" ? value : mid,
        _subs: [...defaults],
      };
      if (typeof value === "number") init._touched = true;
      defaults.forEach(s => { init[s] = mid; });
      onChange(init);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMain = (v: number) => {
    const next: ScaleAnswer = { ...valObj, _: v, _touched: true };
    activeSubs.forEach(label => {
      const current = next[label];
      if (typeof current === "number" && current > v) next[label] = v;
    });
    onChange(next);
  };

  const validateMain = () => {
    if (valObj._touched) return;
    onChange({ ...valObj, _touched: true });
  };

  const updateSub = (label: string, v: number) => {
    const nextMain = Math.max(valObj._, v);
    onChange({ ...valObj, _: nextMain, _touched: true, [label]: v });
  };

  const removeSub = (label: string) => {
    const newSubs = activeSubs.filter(s => s !== label);
    const next: ScaleAnswer = { ...valObj, _subs: newSubs };
    delete next[label];
    onChange(next);
  };

  const monoCls = "text-[11px] text-[var(--mid)] font-mono";

  return (
    <div className={questionBlockClass}>
      <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>échelle</Badge></span>
      <div className={scaleWrapClass}>
        <div className={scaleTrackClass}>
          <span className={monoCls}>{q.labelMin || mn}</span>
          <TouchSafeSlider
            min={mn}
            max={mx}
            value={mainValue}
            onChange={updateMain}
            onTap={validateMain}
            touched={touched}
            ariaLabel={q.label}
          />
          <span className={monoCls}>{q.labelMax || mx}</span>
          <span className={scaleValueClass}>{mainValue}</span>
        </div>

        {/* Sub-criteria — jury-driven */}
        {activeSubs.length > 0 && (
          <div className={scaleSubcriteriaClass}>
            {activeSubs.map(label => {
              const subVal = typeof valObj[label] === "number" ? valObj[label] : mainValue;
              return (
                <div key={label} className={scaleSubcriterionClass}>
                  <span className={scaleSubLabelClass}>{label}</span>
                  <div className={scaleTrackSubClass}>
                    <span className={`${monoCls} min-w-5`}>{mn}</span>
                    <TouchSafeSlider
                      min={mn}
                      max={mx}
                      value={subVal}
                      onChange={(v) => updateSub(label, v)}
                      ariaLabel={label}
                    />
                    <span className={`${monoCls} min-w-5`}>{mx}</span>
                    <span className={scaleSubValueClass}>{subVal}</span>
                  </div>
                  <button className={scaleSubRemoveClass} onClick={() => removeSub(label)} type="button" title="Retirer">×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ── RadarInput ──────────────────────────────────────────────────────────────
// Answer format: { [axisLabel]: { _: number, _subs: string[], [precision]: number } }
// Représentation visuelle type toile d'araignée (même structure que l'analyse).

// Valeurs par défaut dépendantes du niveau (famille = 5, classes/mots = 0).
interface RadarDefaults { family: number; child: number }

// Convertit récursivement une valeur brute (nouveau format, ancien ScaleAnswer, ou number) en RadarNodeAnswer.
function normalizeRadarNode(raw: unknown, axis: RadarAxis, defaults: RadarDefaults, depth: number = 0): RadarNodeAnswer {
  const defaultValue = depth === 0 ? defaults.family : defaults.child;
  let value = defaultValue;
  let touched = false;
  let childrenRaw: Record<string, unknown> = {};

  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj._ === "number") value = obj._;
    if (typeof obj._touched === "boolean") touched = obj._touched;
    if (typeof obj.children === "object" && obj.children !== null) {
      childrenRaw = obj.children as Record<string, unknown>;
    } else {
      // Legacy ScaleAnswer : { _, _subs, [sub]: number }
      Object.keys(obj).forEach(k => {
        if (k === "_" || k === "_subs" || k === "_touched") return;
        if (typeof obj[k] === "number") childrenRaw[k] = { _: obj[k] };
      });
    }
  }

  const out: RadarNodeAnswer = { _: value };
  if (depth === 0 && touched) out._touched = true;
  const childAxes = axis.children && axis.children.length > 0
    ? axis.children
    : (axis.subCriteria || []).map(l => ({ label: l } as RadarAxis));
  const knownLabels = new Set(childAxes.map(c => c.label));
  const childMap: Record<string, RadarNodeAnswer> = {};
  for (const c of childAxes) {
    childMap[c.label] = normalizeRadarNode(childrenRaw[c.label], c, defaults, depth + 1);
  }
  // Préserver les enfants ajoutés librement par l'utilisateur (termes personnalisés).
  for (const k of Object.keys(childrenRaw)) {
    if (knownLabels.has(k)) continue;
    const raw = childrenRaw[k];
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      const v = typeof obj._ === "number" ? obj._ : defaults.child;
      childMap[k] = { _: v };
    } else if (typeof raw === "number") {
      childMap[k] = { _: raw };
    }
  }
  if (Object.keys(childMap).length > 0) {
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
  if (node._touched) next._touched = true;
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
      // Nœud cible : on applique la nouvelle valeur, on marque comme touché,
      // et on clampe les enfants vers le bas.
      return clampNodeTree({ ...node, _: newValue, _touched: true }, newValue);
    }
    const [h, ...t] = remaining;
    const child = node.children?.[h] ?? { _: 0 };

    const updatedChild = updateNode(child, t);
    // Upward propagation : la valeur du parent doit être AU MOINS égale à celle de l'enfant (uniquement si augmentation).
    const nextVal = Math.max(node._, updatedChild._);

    return {
      ...node,
      _: nextVal,
      _touched: node._touched || (nextVal !== node._), // Marque aussi le parent comme touché si sa valeur a changé
      children: { ...node.children, [h]: updatedChild }
    };
  };

  const updatedRoot = updateNode(rootNode, tail);
  return { ...answer, [head]: updatedRoot };
}

// Marque une famille (axe racine) comme touchée. N'altère ni la valeur ni
// les enfants — sert uniquement à indiquer "le jury a délibérément validé".
function setFamilyTouched(answer: RadarAnswer, axisLabel: string): RadarAnswer {
  const node = answer[axisLabel];
  if (!node || node._touched) return answer;
  return { ...answer, [axisLabel]: { ...node, _touched: true } };
}

// Validation appelée au passage à l'étape suivante (radar uniquement).
// Renvoie deux listes pour le modal :
//   - untouched : familles qui n'ont jamais été interagies (ni drag, ni tap).
//   - emptyChildren : nœuds (familles ou classes) dont la valeur est > min
//     mais dont aucun enfant direct n'a été levé au-dessus de min.
export interface RadarValidationIssues {
  untouched: string[];
  emptyChildren: string[];
}
export function validateRadarAnswer(
  answer: RadarAnswer,
  axes: RadarAxis[],
  min: number
): RadarValidationIssues {
  const out: RadarValidationIssues = { untouched: [], emptyChildren: [] };

  const checkNode = (node: RadarNodeAnswer | undefined, ax: RadarAxis) => {
    // 1. Check if touched (only for root families)
    if (!node || !node._touched) {
      // On ne remonte que les familles racines dans "untouched" pour ne pas
      // polluer le modal, car les enfants ne sont visibles que si le parent est touché/étendu.
      return;
    }

    // 2. Si > min, on vérifie qu'au moins un enfant est aussi > min
    if (node._ > min) {
      const childAxes = ax.children && ax.children.length > 0
        ? ax.children
        : (ax.subCriteria || []).map(l => ({ label: l } as RadarAxis));
      
      if (childAxes.length > 0) {
        const childrenNodes = childAxes.map(c => ({
          ax: c,
          node: node.children?.[c.label]
        }));

        const anyChildAboveMin = childrenNodes.some(c => (c.node?._ ?? min) > min);
        
        if (!anyChildAboveMin) {
          out.emptyChildren.push(ax.label);
        } else {
          // Récursion : on vérifie les enfants qui sont > min
          for (const c of childrenNodes) {
            if (c.node && c.node._ > min) {
              checkNode(c.node, c.ax);
            }
          }
        }
      }
    }
  };

  for (const ax of axes) {
    const node = answer[ax.label];
    if (!node || !node._touched) {
      out.untouched.push(ax.label);
    } else {
      checkNode(node, ax);
    }
  }
  return out;
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

const RadarChart = React.memo(function RadarChart({ axes, values, max, onChange }: {
  axes: RadarAxis[];
  values: number[];   // length = axes.length
  max: number;
  onChange: (axisIdx: number, v: number) => void;
}) {
  const data = useMemo<ChartData<"radar", number[], string>>(() => ({
    labels: axes.map(a => a.label),
    datasets: [
      {
        label: "Valeur",
        data: values.map(v => v ?? 0),
        backgroundColor: "rgba(238, 140, 0, 0.18)",
        borderColor: "rgba(238, 140, 0, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(255, 255, 255, 1)",
        pointBorderColor: "rgba(238, 140, 0, 1)",
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHitRadius: 10,
        dragData: true,
      }
    ]
  }), [axes, values]);

  const options = useMemo<ChartOptions<"radar">>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: max,
        beginAtZero: true,
        ticks: { stepSize: 1, display: false },
        pointLabels: {
          font: { size: 11, family: "ui-monospace, monospace" },
          color: "#2a2a2a",
        }
      }
    },
    plugins: {
      legend: { display: false },
      dragData: {
        round: 0,
        showTooltip: true,
        onDragEnd: (_event, _datasetIndex, index, value) => {
          if (typeof value === "number") onChange(index, value);
        }
      }
    }
  }), [max, onChange]);

  return (
    <div className="mx-auto aspect-square w-full max-w-[420px] select-none [touch-action:none]">
      <Radar data={data} options={options} />
    </div>
  );
});

// Nœud récursif : slider + bouton d'expansion vers ses enfants.
// `pathPrefix` permet d'insérer des segments de chemin cachés (aplatissement famille→classe unique).
const RadarTreeNode = React.memo(function RadarTreeNode({
  axis, nodeAnswer, min, max, path, expandedPaths, togglePath, setPathValue, highlightKey,
  customChildren, onAddCustomChild,
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
  customChildren: Record<string, string[]>;
  onAddCustomChild: (pathKey: string, label: string) => void;
}) {
  const pathKey = path.join("/");

  // Aplatissement : si l'axe possède exactement une classe-fille qui a elle-même des descripteurs,
  // on masque ce niveau intermédiaire en affichant directement les descripteurs (le path de données
  // reste à 3 niveaux : famille → classe cachée → descripteur).
  const singleClass = axis.children && axis.children.length === 1
    && axis.children[0].children && axis.children[0].children.length > 0
    ? axis.children[0]
    : null;

  const displayChildren: Array<{ child: RadarAxis; hiddenMid: string | null }> =
    singleClass
      ? singleClass.children!.map(d => ({ child: d, hiddenMid: singleClass.label }))
      : (axis.children || []).map(c => ({ child: c, hiddenMid: null }));

  const hasDisplayChildren = displayChildren.length > 0;
  const expanded = expandedPaths.has(pathKey);
  const v = nodeAnswer._;
  const isHighlight = highlightKey === pathKey;

  // Une "classe" pour l'UI = un nœud dont les enfants affichés sont des feuilles.
  // (Cas standard : profondeur 2. Cas aplati : profondeur 1 avec classe unique masquée.)
  const childrenAreLeaves = hasDisplayChildren && displayChildren.every(d => !d.child.children || d.child.children.length === 0);
  const customForHere = customChildren[pathKey] || [];

  const untouchedFlag = !nodeAnswer._touched;

  return (
    <div
      className={radarTreeNodeClass(path.length - 1, isHighlight, untouchedFlag)}
      data-path={pathKey}
    >
      <div className={radarTreeRowClass}>
        <span className={radarTreeLabelClass(path.length - 1)}>{axis.label}</span>
        <TouchSafeSlider
          min={min}
          max={max}
          value={v}
          onChange={(nv) => setPathValue(path, nv)}
          onTap={() => setPathValue(path, v)} // Re-valider la valeur courante = marquer comme touché
          touched={!!nodeAnswer._touched}
          ariaLabel={axis.label}
          thumbOnly
        />
        <span className={radarTreeValClass(path.length - 1)}>{v}</span>
        {hasDisplayChildren ? (
          <button
            type="button"
            className={radarTreeToggleClass()}
            onClick={() => togglePath(pathKey)}
            title={expanded ? "Refermer" : "Préciser"}
            aria-expanded={expanded}
          >
            {expanded ? <FiMinus size={12} /> : <FiPlus size={12} />}
          </button>
        ) : (
          <span className={radarTreeToggleClass(true)} aria-hidden="true" />
        )}
      </div>
      {expanded && hasDisplayChildren && (
        <div className={radarTreeChildrenClass}>
          {displayChildren.map(({ child, hiddenMid }) => {
            const midNode = hiddenMid ? nodeAnswer.children?.[hiddenMid] : nodeAnswer;
            const childAnswer = midNode?.children?.[child.label] ?? { _: min };
            const childPath = hiddenMid ? [...path, hiddenMid, child.label] : [...path, child.label];
            return (
              <RadarTreeNode
                key={child.label}
                axis={child}
                nodeAnswer={childAnswer}
                min={min}
                max={max}
                path={childPath}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
                setPathValue={setPathValue}
                highlightKey={highlightKey}
                customChildren={customChildren}
                onAddCustomChild={onAddCustomChild}
              />
            );
          })}
          {childrenAreLeaves && customForHere.map(label => {
            // Les termes personnalisés sont stockés sous le chemin réel (via la classe cachée si présent).
            const realParentPath = singleClass ? [...path, singleClass.label] : path;
            const midNode = singleClass ? nodeAnswer.children?.[singleClass.label] : nodeAnswer;
            const childAnswer = midNode?.children?.[label] ?? { _: min };
            return (
              <div key={`custom:${label}`} className="radar-tree-node depth-custom flex flex-col gap-1.5">
                <div className={`${radarTreeRowClass} pl-4 max-[480px]:pl-2`}>
                  <span className={radarTreeLabelClass(path.length, true)}>{label}</span>
                  <TouchSafeSlider
                    min={min}
                    max={max}
                    value={childAnswer._}
                    onChange={(nv) => setPathValue([...realParentPath, label], nv)}
                    ariaLabel={label}
                  />
                  <span className={radarTreeValClass(path.length)}>{childAnswer._}</span>
                  <span className={radarTreeToggleClass(true)} aria-hidden="true" />
                </div>
              </div>
            );
          })}
          {childrenAreLeaves && (
            <CustomDescriptorAdder onAdd={(label) => onAddCustomChild(pathKey, label)} />
          )}
        </div>
      )}
    </div>
  );
});

function CustomDescriptorAdder({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal("");
  };
  return (
    <div className={radarCustomAddClass}>
      <input
        type="text"
        className={radarCustomInputClass}
        placeholder="Ajouter un terme…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
      />
      <button
        type="button"
        className={radarCustomBtnClass}
        onClick={submit}
        disabled={!val.trim()}
        aria-label="Ajouter"
      ><FiPlus size={12} /></button>
    </div>
  );
}

function RadarGroupBlock({ group, min, max, answer, onChange, showSVG = true }: {
  group: { title: string; axes: RadarAxis[] };
  min: number;
  max: number;
  answer: RadarAnswer;
  onChange: (next: RadarAnswer) => void;
  showSVG?: boolean;
}) {
  const familyDefault = min;
  const values = group.axes.map(a => answer[a.label]?._ ?? familyDefault);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // Descripteurs personnalisés ajoutés par le jury, indexés par pathKey du parent affiché.
  const [customChildren, setCustomChildren] = useState<Record<string, string[]>>({});
  const blockRef = useRef<HTMLDivElement>(null);

  const addCustomChild = (parentPathKey: string, label: string) => {
    setCustomChildren(prev => {
      const existing = prev[parentPathKey] || [];
      if (existing.includes(label)) return prev;
      return { ...prev, [parentPathKey]: [...existing, label] };
    });
    // Initialise la valeur à 0 dans l'arbre de réponses via le chemin réel
    // (si la famille n'a qu'une seule classe, on passe par la classe cachée).
    const segments = parentPathKey.split("/");
    const [familyLabel] = segments;
    const familyAxis = group.axes.find(a => a.label === familyLabel);
    const hiddenMid = familyAxis && familyAxis.children && familyAxis.children.length === 1 && familyAxis.children[0].children && familyAxis.children[0].children.length > 0
      ? familyAxis.children[0].label
      : null;
    const realPath = hiddenMid && segments.length === 1
      ? [...segments, hiddenMid, label]
      : [...segments, label];
    onChange(setNodeAtPath(answer, realPath, 0));
  };

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

  // Combine "marquer la famille comme touchée" + "appliquer la nouvelle valeur"
  // en un seul onChange : sinon le second appel partirait du même snapshot que
  // le premier et écraserait le `_touched` que celui-ci venait de poser.
  const setPathValue = (path: string[], v: number) => {
    let next = answer;
    if (path[0]) next = setFamilyTouched(next, path[0]);
    next = setNodeAtPath(next, path, v);
    onChange(next);
  };

  const setAxis = (i: number, v: number) => {
    const label = group.axes[i].label;
    let next = setFamilyTouched(answer, label);
    next = setNodeAtPath(next, [label], v);
    onChange(next);
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

  // Toutes les familles sont toujours visibles (le filtre des familles à 0 a été retiré
   // pour ne pas masquer un curseur qu'un jury aurait délibérément laissé à zéro).
  const visibleAxes = group.axes;

  return (
    <div className={radarGroupBlockParticipantClass} ref={blockRef}>
      <div className={radarGroupHeaderRowClass}>
        <h4 className={radarGroupTitleClass}>{group.title}</h4>
        <div className={radarSearchClass}>
          {searchOpen ? (
            <div className={radarSearchBoxClass}>
              <FiSearch size={13} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un descripteur…"
                className={radarSearchInputClass}
              />
              <button
                type="button"
                className={radarSearchCloseClass}
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                aria-label="Fermer la recherche"
              ><FiX size={13} /></button>
              {results.length > 0 && (
                <div className={radarSearchResultsClass}>
                  {results.map(r => (
                    <button
                      key={r.path.join("/")}
                      type="button"
                      className={radarSearchResultClass}
                      onClick={() => revealPath(r.path)}
                    >
                      <strong>{r.label}</strong>
                      <span className={radarSearchCrumbsClass}>{r.path.slice(0, -1).join(" › ")}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery && results.length === 0 && (
                <div className={radarSearchEmptyClass}>Aucun résultat.</div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={radarSearchToggleClass}
              onClick={() => setSearchOpen(true)}
              title="Rechercher un descripteur"
              aria-label="Rechercher"
            ><FiSearch size={14} /></button>
          )}
        </div>
      </div>
      <div className={radarGroupBodyClass(showSVG)}>
        {showSVG && (
          <div className="flex justify-center">
            <RadarChart axes={group.axes} values={values} max={max} onChange={setAxis} />
          </div>
        )}
        <div className={radarTreeClass}>
          {visibleAxes.length === 0 ? (
            <div className={radarTreeEmptyClass}>Aucune famille configurée pour cette toile.</div>
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
                  customChildren={customChildren}
                  onAddCustomChild={addCustomChild}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const RadarInput = React.memo(function RadarInput({ q, value, onChange }: { q: Question; value: AnswerValue; onChange: (v: RadarAnswer) => void }) {
  const mn = q.min ?? 0;
  const mx = q.max ?? 10;
  const groups = useMemo(() => q.radarGroups || [], [q.radarGroups]);
  const allAxes = useMemo(() => groups.flatMap(g => g.axes), [groups]);

  // Familles = valeur minimale (0) → toujours visibles au départ.
  // Classes / mots = 0 → visibles dès que la famille parente est dépliée.
  const defaults = useMemo(() => ({ family: mn, child: mn }), [mn]);

  const answer: RadarAnswer = useMemo(
    () => normalizeRadarValue(value, allAxes, defaults),
    [value, allAxes, defaults]
  );

  // L'état "touché" est persisté dans la réponse elle-même (`_touched` posé sur
  // chaque axe racine). Une famille est touchée dès qu'on lui pose un drag ou un
  // tap. Sans Set local, le flag survit aux remounts (changement d'étape, retour
  // au formulaire) et est validable côté FormScreen.
  // init/seed at mount if no value
  useEffect(() => {
    if (value == null || (typeof value === "object" && Object.keys(value).length === 0)) {
      onChange(answer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Familles non touchées = curseurs jamais bougés par le jury (la valeur par défaut
  // peut ne pas refléter son ressenti réel, notamment si l'intensité est en fait nulle).
  const untouchedFamilies = allAxes.filter(a => !answer[a.label]?._touched).map(a => a.label);

  return (
    <div className={questionBlockClass}>
      <span className={questionLabelClass}>
        {q.label}
        <Badge variant="ns" className={questionTypeBadgeClass}>radar</Badge>
      </span>
      <div className={radarGroupsClass}>
        {groups.map(g => (
          <RadarGroupBlock
            key={g.id}
            group={g}
            min={mn}
            max={mx}
            answer={answer}
            onChange={onChange}
            showSVG={false}
          />
        ))}
      </div>

      {untouchedFamilies.length > 0 && (
        <div className={radarWarningClass} role="status">
          <strong>⚠ Curseurs non déplacés :</strong> pensez à vérifier{" "}
          {untouchedFamilies.map((f, i) => (
            <span key={f}>
              <em>{f}</em>{i < untouchedFamilies.length - 1 ? ", " : ""}
            </span>
          ))}
          {" "}— déplacez-les au moins une fois (y compris à 0 si l&apos;intensité est nulle).
        </div>
      )}
    </div>
  );
});

export const QuestionInput = React.memo(({ q, value, onChange, products }: QuestionInputProps) => {
  if (q.type === "scale") {
    return <ScaleInput q={q} value={value} onChange={onChange} />;
  }

  if (q.type === "radar") {
    return <RadarInput q={q} value={value} onChange={onChange} />;
  }

  if (q.type === "text") {
    return (
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>texte</Badge></span>
        <textarea
          className={questionTextClass}
          placeholder={q.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (q.type === "qcm") {
    return (
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>qcm</Badge></span>
        <div className={qcmOptionsClass}>
          {q.options?.map(opt => (
            <label key={opt} className={qcmOptionClass(value === opt)} onClick={() => onChange(opt)}>
              <span className={qcmDotClass(value === opt)}></span>
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
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>{label}</Badge></span>
        {codes.length > 0 ? (
          <HorizontalRank items={codes} value={value} onChange={onChange} />
        ) : (
          <p className="text-[13px] text-[var(--mid)]">Aucun échantillon défini.</p>
        )}
      </div>
    );
  }

  if (q.type === "triangulaire") {
    const options = q.codes || [];
    return (
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label || "Quel échantillon est différent des deux autres ?"}<Badge variant="ns" className={questionTypeBadgeClass}>triangulaire</Badge></span>
        <div className={triangleGridClass}>
          {options.map(opt => (
            <div key={opt} className={triangleChoiceClass(value === opt)} onClick={() => onChange(opt)}>
              <div className={triangleCodeClass(value === opt)}>{opt}</div>
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
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>duo-trio</Badge></span>
        <p className={discrimRefClass}>
          {q.questionText?.trim()
            ? q.questionText
            : <>Vous avez deux verres de référence <strong>{refA}</strong> et <strong>{refB}</strong>. À quel verre le verre <strong>{testCode}</strong> est-il identique ?</>
          }
        </p>
        <div className={triangleGridClass}>
          {[refA, refB].map(opt => (
            <div key={opt} className={triangleChoiceClass(value === opt)} onClick={() => onChange(opt)}>
              <div className={triangleCodeClass(value === opt)}>{opt}</div>
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
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>seuil 3-AFC</Badge></span>
        <p className={discrimRefClass}>
          Pour chaque niveau, identifiez <strong>le verre différent des deux autres</strong>. Les niveaux sont présentés dans l&apos;ordre.
        </p>
        <div className="flex flex-col gap-3">
          {levels.map((lv, idx) => (
            <div key={idx} className="p-3 bg-[var(--paper2)] rounded-lg">
              <div className="text-[11px] text-[var(--mid)] mb-2">
                Niveau {idx + 1} · {lv.label}
              </div>
              <div className={triangleGridClass}>
                {lv.codes.map(code => (
                  <div
                    key={code}
                    className={triangleChoiceClass(currentVal[String(idx)] === code)}
                    onClick={() => onChange({ ...currentVal, [String(idx)]: code })}
                  >
                    <div className={triangleCodeClass(currentVal[String(idx)] === code)}>{code}</div>
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
      <div className={questionBlockClass}>
        <span className={questionLabelClass}>{q.label}<Badge variant="ns" className={questionTypeBadgeClass}>A / non-A</Badge></span>
        <p className={discrimRefClass}>
          {q.questionText?.trim()
            ? q.questionText
            : <>Vous avez un verre de référence <strong>{ref}</strong> devant vous. Dites, pour chacun des verres ci-dessous, s&apos;il est identique ou différent du verre <strong>{ref}</strong>.</>
          }
        </p>
        <div className={anonaGridClass}>
          {codes.map(code => (
            <div key={code} className={anonaRowClass}>
              <span className={anonaCodeClass}>{code}</span>
              <div className={anonaChoicesClass}>
                <button
                  className={anonaBtnClass(currentVal[code] === "A", "ok")}
                  onClick={() => onChange({ ...currentVal, [code]: "A" })}
                  title="Identique à la référence"
                >
                  <span className="text-lg leading-none">=</span>
                </button>
                <button
                  className={anonaBtnClass(currentVal[code] === "non-A", "diff")}
                  onClick={() => onChange({ ...currentVal, [code]: "non-A" })}
                  title="Différent de la référence"
                >
                  <span className="text-lg leading-none">≠</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
});
QuestionInput.displayName = "QuestionInput";
