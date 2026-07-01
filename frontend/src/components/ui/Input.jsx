import React, { forwardRef } from 'react';

export const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref}
        className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:border-blue-500 transition-colors
          ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-100'}
        `}
        {...props}
      />
      {error && <span className="text-xs text-red-500 mt-0.5">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
