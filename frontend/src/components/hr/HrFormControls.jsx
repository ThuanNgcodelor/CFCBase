import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export const HR_INPUT_CLASS = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:h-10 sm:text-sm';
export const HR_TEXTAREA_CLASS = 'min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';
export const ID_CARD_ISSUING_AUTHORITIES = [
  'Bộ Công an',
  'Cục cảnh sát QLHC về TTXH',
];

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
  const content = (
    <>
      {htmlFor
        ? <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">{label}</label>
        : <span className="text-sm font-medium text-gray-700">{label}</span>}
      {children}
      {hint && <span className="text-xs leading-5 text-gray-500">{hint}</span>}
    </>
  );

  if (htmlFor) {
    return <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>{content}</div>;
  }

  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>{content}</label>
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

export function normalizeCatalogSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

export function filterCatalogItems(items, query) {
  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return items;
  return items.filter((item) => normalizeCatalogSearch(`${item.name ?? ''} ${item.code ?? ''}`).includes(normalizedQuery));
}

export function HrSearchableCatalogSelect({
  value,
  onChange,
  items,
  placeholder = 'Tìm và chọn',
  required = false,
  id,
}) {
  const generatedId = useId();
  const inputId = id || `hr-catalog-${generatedId.replace(/:/g, '')}`;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedItem = useMemo(() => items.find((item) => String(item.id) === String(value)), [items, value]);
  const filteredItems = useMemo(() => filterCatalogItems(items, query), [items, query]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) setActiveIndex(filteredItems.length ? filteredItems.length - 1 : -1);
  }, [activeIndex, filteredItems.length]);

  const choose = (item) => {
    onChange(String(item.id));
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, filteredItems.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      choose(filteredItems[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
    }
  };

  const displayValue = open ? query : selectedItem?.name || '';

  return (
    <div ref={rootRef} className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-required={required}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          if (value) onChange('');
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        className={`${HR_INPUT_CLASS} appearance-none pl-9 pr-16`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Bỏ lựa chọn"
          onClick={() => {
            onChange('');
            setQuery('');
            setOpen(true);
          }}
          className="absolute right-9 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

      {open && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
          {filteredItems.length ? filteredItems.map((item, index) => {
            const selected = String(item.id) === String(value);
            return (
              <div
                id={`${listboxId}-${index}`}
                key={item.id}
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${index === activeIndex ? 'bg-emerald-50 text-emerald-900' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span className="min-w-0"><span className="block truncate font-medium">{item.name}</span>{item.code && <span className="block truncate text-xs text-gray-500">{item.code}</span>}</span>
                {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />}
              </div>
            );
          }) : <p className="px-3 py-3 text-sm text-gray-500">Không tìm thấy kết quả phù hợp.</p>}
        </div>
      )}
    </div>
  );
}

export function HrIssuingAuthoritySelect({ value, onChange, id, required = false }) {
  const isLegacyValue = value && !ID_CARD_ISSUING_AUTHORITIES.includes(value);
  return (
    <select id={id} value={value} required={required} onChange={(event) => onChange(event.target.value)} className={HR_INPUT_CLASS}>
      <option value="">Chọn nơi cấp CCCD</option>
      {isLegacyValue && <option value={value}>Giá trị hồ sơ cũ: {value}</option>}
      {ID_CARD_ISSUING_AUTHORITIES.map((authority) => <option key={authority} value={authority}>{authority}</option>)}
    </select>
  );
}
