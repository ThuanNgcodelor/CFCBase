export const HR_INPUT_CLASS = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:h-10 sm:text-sm';
export const HR_TEXTAREA_CLASS = 'min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';

export function HrFormSection({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function HrField({ label, htmlFor, hint, wide = false, children }) {
  return (
    <label htmlFor={htmlFor} className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-xs leading-5 text-gray-500">{hint}</span>}
    </label>
  );
}

export function HrCatalogSelect({ value, onChange, items, placeholder = 'Chưa chọn', required = false, id }) {
  return (
    <select
      id={id}
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className={HR_INPUT_CLASS}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}
