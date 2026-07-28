import { ChevronDown } from 'lucide-react';

export function LongFormSection({ icon: Icon, title, open, onToggle, children }) {
  return (
    <section className={`long-form-section ${open ? 'long-form-section--open' : ''}`}>
      <button type="button" className="long-form-section__header" onClick={onToggle}>
        <span><Icon aria-hidden="true" /></span>
        <h2>{title}</h2>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className="long-form-section__body">{children}</div>
    </section>
  );
}
