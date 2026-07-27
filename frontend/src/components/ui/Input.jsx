import React, { forwardRef, useId } from 'react';

export const Input = forwardRef(({ label, error, hint, className = '', inputClassName = '', id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label htmlFor={inputId} className="text-sm font-semibold text-[var(--cfc-ink)]">{label}</label>}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId || hintId}
        className={`min-h-11 rounded-lg border bg-white px-3 py-2 text-sm text-[var(--cfc-ink)] shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:outline-none focus:ring-2
          ${error
            ? 'border-[var(--cfc-danger)] focus:border-[var(--cfc-danger)] focus:ring-red-100'
            : 'border-[var(--cfc-border)] focus:border-[var(--cfc-cobalt)] focus:ring-blue-100'}
          ${inputClassName}
        `}
        {...props}
      />
      {error && <span id={errorId} className="mt-0.5 text-xs text-[var(--cfc-danger)]">{error}</span>}
      {hint && !error && <span id={hintId} className="mt-0.5 text-xs text-[var(--cfc-muted)]">{hint}</span>}
    </div>
  );
});

Input.displayName = 'Input';
