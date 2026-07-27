import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  const baseStyle = [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cfc-cobalt)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  ].join(' ');

  const variants = {
    primary: 'border border-[var(--cfc-cobalt)] bg-[var(--cfc-cobalt)] text-white shadow-sm hover:border-[var(--cfc-cobalt-dark)] hover:bg-[var(--cfc-cobalt-dark)]',
    secondary: 'border border-[var(--cfc-border)] bg-white text-[var(--cfc-ink)] shadow-sm hover:border-[var(--cfc-border-strong)] hover:bg-[var(--cfc-surface-muted)]',
    outline: 'border border-[var(--cfc-cobalt)] bg-white text-[var(--cfc-cobalt)] hover:bg-blue-50',
    success: 'border border-[var(--cfc-emerald)] bg-[var(--cfc-emerald)] text-white shadow-sm hover:border-[var(--cfc-emerald-dark)] hover:bg-[var(--cfc-emerald-dark)]',
    danger: 'border border-[var(--cfc-danger)] bg-[var(--cfc-danger)] text-white shadow-sm hover:border-[var(--cfc-danger-dark)] hover:bg-[var(--cfc-danger-dark)]',
    ghost: 'border border-transparent text-[var(--cfc-muted)] hover:bg-slate-100 hover:text-[var(--cfc-ink)]',
  };

  const sizes = {
    sm: 'min-h-9 px-3 py-1.5 text-xs',
    md: 'min-h-11 px-4 py-2 text-sm',
    lg: 'min-h-12 px-5 py-2.5 text-sm',
    icon: 'h-11 w-11 p-0',
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
