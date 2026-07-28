export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  iconOnly = false,
  ...props
}) {
  return (
    <button
      className={[
        'cfc-button',
        `cfc-button--${variant}`,
        `cfc-button--${size}`,
        iconOnly ? 'cfc-button--icon' : '',
        className
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
