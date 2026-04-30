"use client";
import React, { useRef, useState } from "react";

// Délai d'armement tactile : il faut maintenir le doigt appuyé sans bouger
// pendant ce temps avant que la valeur ne change. Évite les ajustements
// involontaires en faisant glisser le doigt sur le questionnaire.
const TOUCH_HOLD_MS = 55;
// Tolérance de mouvement pendant le hold tactile : au-delà, on annule
// (l'utilisateur a glissé pour scroller, pas pour ajuster).
const HOLD_MOVE_TOLERANCE_PX = 8;

export interface TouchSafeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Curseur tactile-safe : sur tactile, exige un appui court (~110 ms) avant que
 * la valeur ne change ; tout mouvement avant l'armement annule la manipulation
 * (le doigt sert alors à scroller). Sur souris, comportement standard.
 *
 * Implémenté en pur DOM (pas de <input type="range">) pour pouvoir contrôler
 * finement le comportement tactile, qu'on ne peut pas désactiver sur l'élément
 * natif sans casser aussi le drag.
 */
export function TouchSafeSlider({
  min, max, step = 1, value, onChange, ariaLabel, className,
}: TouchSafeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [arming, setArming] = useState(false);

  // État du press en cours (évite les stale closures dans le timer).
  const pressRef = useRef<{
    isTouch: boolean;
    armed: boolean;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const ratio = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  const valueFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + r * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  const cancelPress = () => {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    pressRef.current = null;
    setArming(false);
    setDragging(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // bouton souris non-principal : on ignore
    if (e.button !== 0 && e.button !== undefined) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
    const press = {
      isTouch,
      armed: !isTouch, // souris : armé immédiatement
      startX: e.clientX,
      startY: e.clientY,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    pressRef.current = press;

    if (isTouch) {
      // Tactile : on attend le long-press avant tout changement de valeur.
      setArming(true);
      press.timer = setTimeout(() => {
        if (pressRef.current !== press) return;
        press.armed = true;
        setArming(false);
        setDragging(true);
        try { navigator.vibrate?.(12); } catch { /* ignore */ }
        // Au déclenchement, on positionne sur l'endroit de l'appui initial.
        onChange(valueFromClientX(press.startX));
      }, TOUCH_HOLD_MS);
    } else {
      // Souris : drag immédiat ET positionnement sur le clic.
      setDragging(true);
      onChange(valueFromClientX(e.clientX));
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pressRef.current;
    if (!p) return;
    if (!p.armed) {
      // Pendant le hold : si le doigt bouge, on annule (l'utilisateur scrolle).
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (Math.hypot(dx, dy) > HOLD_MOVE_TOLERANCE_PX) cancelPress();
      return;
    }
    onChange(valueFromClientX(e.clientX));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    cancelPress();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = value;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(min, value - step);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(max, value + step);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "PageDown") next = Math.max(min, value - step * 5);
    else if (e.key === "PageUp") next = Math.min(max, value + step * 5);
    else return;
    e.preventDefault();
    onChange(next);
  };

  return (
    <div
      ref={trackRef}
      className={`ts-slider${dragging ? " dragging" : ""}${arming ? " arming" : ""}${className ? ` ${className}` : ""}`}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      // pan-y : laisse le scroll vertical traverser ce contrôle, on ne capture
      // que les gestes horizontaux. Une fois pointer-capture pris, ce setting
      // n'a plus d'effet (on possède le pointeur).
      style={{ touchAction: "pan-y" }}
    >
      <div className="ts-slider-track" />
      <div className="ts-slider-fill" style={{ width: `${ratio * 100}%` }} />
      <div className="ts-slider-thumb" style={{ left: `${ratio * 100}%` }} />
    </div>
  );
}
