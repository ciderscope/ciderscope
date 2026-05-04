import React from 'react';

interface SessionCardProps {
  name: string;
  date: string;
  jurorCount: number;
  onClick: () => void;
  productCount?: number;
  questionCount?: number;
}

export const SessionCard = ({ name, date, jurorCount, onClick, productCount = 0, questionCount = 0 }: SessionCardProps) => (
  <div className="session-card" onClick={onClick}>
    <h3>{name}</h3>
    <div className="meta">{date}</div>
    <div className="counts">
      <div className="count-badge">
        <strong>{productCount}</strong>
        <span>{productCount > 1 ? "échantillons" : "échantillon"}</span>
      </div>
      <div className="count-badge">
        <strong>{questionCount}</strong>
        <span>{questionCount > 1 ? "questions" : "question"}</span>
      </div>
      <div className="count-badge count-badge--live" title="Participants ayant répondu">
        <strong>{jurorCount}</strong>
        <span>{jurorCount > 1 ? "participants" : "participant"}</span>
      </div>
    </div>
  </div>
);
