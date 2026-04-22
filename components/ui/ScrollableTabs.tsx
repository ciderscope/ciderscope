"use client";

import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface ScrollableTabsProps {
  className?: string;
  activeKey?: string;
  children: ReactNode;
  ariaLabel?: string;
}

export const ScrollableTabs = ({ className = "", activeKey, children, ariaLabel }: ScrollableTabsProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(".active");
    if (!active) return;
    const aLeft = active.offsetLeft;
    const aRight = aLeft + active.offsetWidth;
    const vLeft = el.scrollLeft;
    const vRight = vLeft + el.clientWidth;
    if (aLeft < vLeft) el.scrollTo({ left: Math.max(0, aLeft - 12), behavior: "smooth" });
    else if (aRight > vRight) el.scrollTo({ left: aRight - el.clientWidth + 12, behavior: "smooth" });
  }, [activeKey]);

  const scrollBy = (delta: number) => ref.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <div className="scrollable-tabs-wrap">
      <button
        type="button"
        aria-label="Défiler vers la gauche"
        className="scrollable-tabs-arrow left"
        disabled={!canLeft}
        aria-disabled={!canLeft}
        onClick={() => scrollBy(-240)}
      >
        <FiChevronLeft size={16} />
      </button>
      <div ref={ref} className={className} role="tablist" aria-label={ariaLabel}>
        {children}
      </div>
      <button
        type="button"
        aria-label="Défiler vers la droite"
        className="scrollable-tabs-arrow right"
        disabled={!canRight}
        aria-disabled={!canRight}
        onClick={() => scrollBy(240)}
      >
        <FiChevronRight size={16} />
      </button>
    </div>
  );
};
