import { X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../ui/Button.jsx';

export function Drawer({ open, title, children, footer, onClose, width = '430px' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('overlay-open');
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('overlay-open');
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay-root" role="presentation">
      <button className="overlay-backdrop" type="button" onClick={onClose} aria-label="Đóng" />
      <section className="drawer" style={{ '--drawer-width': width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer__header">
          <h2>{title}</h2>
          <Button iconOnly variant="ghost" onClick={onClose} aria-label="Đóng">
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
