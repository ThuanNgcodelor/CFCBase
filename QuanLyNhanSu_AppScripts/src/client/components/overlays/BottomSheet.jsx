import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../ui/Button.jsx';

export function BottomSheet({ open, title, children, footer, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('overlay-open');
    return () => document.body.classList.remove('overlay-open');
  }, [open]);

  if (!open) return null;
  return (
    <div className="overlay-root overlay-root--sheet">
      <button className="overlay-backdrop" type="button" onClick={onClose} aria-label="Đóng" />
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="bottom-sheet__handle" aria-hidden="true" />
        <header className="bottom-sheet__header">
          <h2>{title}</h2>
          <Button iconOnly variant="ghost" onClick={onClose} aria-label="Đóng">
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
        {footer ? <footer className="bottom-sheet__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
