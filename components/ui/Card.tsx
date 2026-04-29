import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ title, children, className = '' }: CardProps) => (
  <div className={`card ${className}`}>
    {title && <h3>{title}</h3>}
    {children}
  </div>
);
