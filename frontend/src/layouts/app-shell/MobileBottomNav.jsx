import React from 'react';
import { Link } from 'react-router-dom';
import { isNavigationItemActive } from './navigation';

export function MobileBottomNav({ items, pathname, hidden, moreActive, onOpenMore }) {
  if (hidden) return null;

  return (
    <nav
      className="cfc-safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--cfc-border)] bg-white/96 shadow-[0_-8px_24px_rgb(6_42_61_/_8%)] backdrop-blur md:hidden"
      aria-label="Điều hướng nhanh"
    >
      <div className="grid min-h-[var(--cfc-mobile-nav-height)] grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.action === 'more'
            ? moreActive
            : isNavigationItemActive(item, pathname);
          const content = (
            <>
              <span className={`mb-1 flex h-7 min-w-9 items-center justify-center rounded-full px-2 transition ${active ? 'bg-emerald-50 text-[var(--cfc-emerald-dark)]' : 'text-slate-400'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className={`max-w-full truncate text-[10px] font-semibold ${active ? 'text-[var(--cfc-emerald-dark)]' : 'text-[var(--cfc-muted)]'}`}>
                {item.name}
              </span>
            </>
          );

          if (item.action === 'more') {
            return (
              <button
                key={item.action}
                type="button"
                onClick={onOpenMore}
                className="flex min-w-0 flex-col items-center justify-center px-1"
                aria-current={active ? 'page' : undefined}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex min-w-0 flex-col items-center justify-center px-1"
              aria-current={active ? 'page' : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
