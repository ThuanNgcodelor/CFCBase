import React, { useEffect, useState } from 'react';

export function Avatar({ src, name, size = 'md', className = '' }) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };
  const initials = String(name || 'Người dùng')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'U';

  if (src && !hasImageError) {
    return (
      <img
        src={src}
        alt={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
        className={`${sizes[size] || sizes.md} shrink-0 rounded-full border border-white/20 object-cover ${className}`}
        referrerPolicy="no-referrer"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <span
      aria-label={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
      className={`${sizes[size] || sizes.md} inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-[var(--cfc-emerald-dark)] ${className}`}
      role="img"
    >
      {initials}
    </span>
  );
}
