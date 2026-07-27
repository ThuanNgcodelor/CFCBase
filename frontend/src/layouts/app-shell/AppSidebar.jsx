import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { isNavigationItemActive } from './navigation';

function NavigationItem({ item, pathname, expanded }) {
  const Icon = item.icon;
  const active = isNavigationItemActive(item, pathname);

  return (
    <Link
      to={item.path}
      title={expanded ? undefined : item.name}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex min-h-11 items-center rounded-lg text-sm font-medium transition-colors
        ${expanded ? 'gap-3 px-3' : 'justify-center px-2'}
        ${active
          ? 'bg-[var(--cfc-emerald)] text-white shadow-sm'
          : 'text-white/68 hover:bg-white/8 hover:text-white'}
      `}
    >
      {active && <span className="absolute -left-3 h-6 w-1 rounded-r-full bg-white" aria-hidden="true" />}
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-white/55 group-hover:text-white'}`} />
      {expanded && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
      {item.badge > 0 && (
        <span className={`${expanded ? '' : 'absolute -right-1 -top-1'} inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--cfc-danger)] px-1.5 text-[10px] font-bold leading-5 text-white ring-2 ring-[var(--cfc-navy)]`}>
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar({ expanded, onToggle, sections, pathname }) {
  return (
    <aside
      className={`relative hidden h-[100dvh] shrink-0 flex-col overflow-hidden bg-[var(--cfc-navy)] text-white transition-[width] duration-200 md:flex
        ${expanded ? 'w-[var(--cfc-sidebar-expanded)]' : 'w-[var(--cfc-sidebar-collapsed)]'}
      `}
    >
      <div className={`flex h-[var(--cfc-topbar-height)] shrink-0 items-center border-b border-white/10 ${expanded ? 'px-5' : 'justify-center px-3'}`}>
        <BrandMark compact={!expanded} dark />
      </div>

      <nav className="cfc-scrollbar relative z-10 flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Điều hướng chính">
        {sections.map((section) => (
          <section key={section.label}>
            {expanded && (
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
                {section.label}
              </h2>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavigationItem
                  key={item.path}
                  item={item}
                  pathname={pathname}
                  expanded={expanded}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-12 h-44 overflow-hidden opacity-[0.08]" aria-hidden="true">
        <img src="/logo2.png" alt="" className="absolute -bottom-8 left-1/2 w-48 -translate-x-1/2 object-contain grayscale brightness-200" />
      </div>

      <div className="relative z-10 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggle}
          className={`flex min-h-11 w-full items-center rounded-lg text-sm font-medium text-white/62 transition hover:bg-white/8 hover:text-white ${expanded ? 'gap-3 px-3' : 'justify-center'}`}
          aria-label={expanded ? 'Thu gọn thanh điều hướng' : 'Mở rộng thanh điều hướng'}
        >
          {expanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          {expanded && <span>Thu gọn</span>}
        </button>
      </div>
    </aside>
  );
}
