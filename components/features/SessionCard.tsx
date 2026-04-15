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
      <div className="count-badge"><strong>{productCount}</strong> éch.</div>
      <div className="count-badge"><strong>{questionCount}</strong> Q</div>
      <div className="count-badge"><strong>{jurorCount}</strong> jurys</div>
    </div>
  </div>
);
