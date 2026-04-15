import React from 'react';

interface BadgeProps {
  variant?: 'active' | 'inactive' | 'sig' | 'ns' | 'ok';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ variant = 'ok', children, className = '' }: BadgeProps) => {
  const badgeClass = variant === 'active' ? 'active-badge' : 
                    variant === 'inactive' ? 'inactive-badge' : 
                    `badge badge-${variant}`;
  return (
    <span className={`${badgeClass} ${className}`}>
      {children}
    </span>
  );
};
