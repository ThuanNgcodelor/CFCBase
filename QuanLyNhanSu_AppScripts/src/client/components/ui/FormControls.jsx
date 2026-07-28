export function Field({ label, required = false, hint, error, className = '', children }) {
  return (
    <label className={`form-field ${className}`}>
      <span className="form-field__label">
        {label}{required ? <b aria-hidden="true"> *</b> : null}
      </span>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? <small className="form-field__error">{error}</small> : null}
    </label>
  );
}

export function TextInput(props) {
  return <input className="form-control" {...props} />;
}

export function SelectInput({ children, ...props }) {
  return (
    <select className="form-control" {...props}>
      {children}
    </select>
  );
}

export function TextArea(props) {
  return <textarea className="form-control form-control--textarea" {...props} />;
}
