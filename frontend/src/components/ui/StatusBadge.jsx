import React from 'react';

const TONES = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export function StatusBadge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`inline-flex min-w-max items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none ${TONES[tone] || TONES.neutral} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
