export function PageHeader({ title, description, actions, compact = false }) {
  return (
    <header className={`page-header ${compact ? 'page-header--compact' : ''}`}>
      <div className="page-header__copy">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
