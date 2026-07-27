import React from 'react';

export function Surface({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component className={`cfc-app-surface ${className}`} {...props}>
      {children}
    </Component>
  );
}
