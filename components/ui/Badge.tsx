import React from 'react';

interface BadgeProps {
  variant?: 'active' | 'inactive' | 'sig' | 'ns' | 'ok';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ variant = 'ok', children, className = '' }: BadgeProps) => {
  const badgeClass = variant === 'active'
    ? 'ml-2 inline-block rounded-full bg-[rgba(98,141,23,.10)] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.02em] text-[var(--primary)]'
    : variant === 'inactive'
      ? 'ml-2 inline-block rounded-full bg-[var(--paper3)] px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.02em] text-[var(--mid)]'
      : {
          sig: 'inline-block rounded-full bg-[rgba(198,40,40,.10)] px-[9px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.02em] text-[var(--danger)]',
          ns: 'inline-block rounded-full bg-[var(--paper3)] px-[9px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.02em] text-[var(--mid)]',
          ok: 'inline-block rounded-full bg-[rgba(98,141,23,.10)] px-[9px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.02em] text-[var(--primary)]',
        }[variant];
  return (
    <span className={`${badgeClass} ${className}`}>
      {children}
    </span>
  );
};
