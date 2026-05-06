"use client";
import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionStep } from "../../../types";

interface OrderScreenProps {
  onGoBack: () => void;
  steps: SessionStep[];
  onStartFromOrder: () => void;
}

export const OrderScreen = ({ onGoBack, steps, onStartFromOrder }: OrderScreenProps) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [order, setOrder] = useState(() => steps.filter(s => s.type === "product").map(s => s.product.code));

  const handleDrop = (i: number) => {
    if (dragIdx === null) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setOrder(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="order-selection">
      <header className="step-header">
        <button className="back-btn" onClick={onGoBack}><FiArrowLeft /> Retour</button>
        <h2>Ordre de passage</h2>
      </header>

      <p className="sub">
        L&apos;animateur vous a peut-être donné un ordre spécifique. <br />
        <strong>Glissez les échantillons</strong> pour refléter cet ordre.
      </p>

      <div className="draggable-list">
        {order.map((code, i) => (
          <div
            key={code}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            className={`draggable-item ${dragIdx === i ? "dragging" : ""} ${overIdx === i && dragIdx !== i ? "drag-over" : ""}`}
          >
            <span className="drag-handle">&#8942;&#8942;</span>
            <span className="rank-pos">{i + 1}</span>
            <span className="rank-code">{code}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button onClick={onStartFromOrder} size="lg">Commencer la séance <FiArrowRight /></Button>
      </div>
    </div>
  );
};
