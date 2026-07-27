import React from 'react';

export function BrandMark({ compact = false, dark = false }) {
  return (
    <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${dark ? 'bg-white/10' : 'bg-white'}`}>
        <img src="/logo2.png" alt="" className="h-[88%] w-[88%] object-contain" aria-hidden="true" />
      </span>
      {!compact && (
        <span className={`min-w-0 leading-tight ${dark ? 'text-white' : 'text-[var(--cfc-ink)]'}`}>
          <span className="block truncate text-sm font-bold tracking-tight">CFC Base</span>
          <span className={`block truncate text-[10px] font-medium uppercase tracking-[0.14em] ${dark ? 'text-white/55' : 'text-[var(--cfc-muted)]'}`}>
            Operations
          </span>
        </span>
      )}
    </div>
  );
}
