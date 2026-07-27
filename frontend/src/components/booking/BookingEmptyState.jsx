import React from 'react';
import { CalendarClock } from 'lucide-react';

export function BookingEmptyState({
  icon: Icon = CalendarClock,
  title,
  description,
  className = '',
}) {
  return (
    <div className={`flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--cfc-border)] bg-[var(--cfc-surface-muted)] text-[var(--cfc-muted)]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-semibold text-[var(--cfc-ink)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--cfc-muted)]">{description}</p>}
    </div>
  );
}
