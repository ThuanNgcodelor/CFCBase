import React from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { isNavigationItemActive } from './navigation';

export function MobileMoreSheet({
  isOpen,
  onClose,
  sections,
  pathname,
  navigate,
  onLogout,
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm chức năng"
      description="Truy cập nhanh các công cụ phù hợp với vai trò của bạn."
    >
      <nav className="space-y-5" aria-label="Điều hướng bổ sung">
        {sections.map((section) => (
          <section key={section.label}>
            <h3 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cfc-muted)]">
              {section.label}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavigationItemActive(item, pathname);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`relative flex min-h-20 flex-col justify-between rounded-xl border p-3 text-left transition
                      ${active
                        ? 'border-emerald-300 bg-emerald-50 text-[var(--cfc-emerald-dark)]'
                        : 'border-[var(--cfc-border)] bg-white text-[var(--cfc-ink)] hover:border-[var(--cfc-border-strong)]'}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="mt-3 text-sm font-semibold">{item.name}</span>
                    {item.badge > 0 && (
                      <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--cfc-danger)] px-1.5 text-[10px] font-bold leading-5 text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--cfc-border)] pt-4">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/profile');
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[var(--cfc-border)] bg-white text-sm font-semibold text-[var(--cfc-ink)]"
        >
          <UserRound className="h-5 w-5" />
          Hồ sơ
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-[var(--cfc-danger)]"
        >
          <LogOut className="h-5 w-5" />
          Đăng xuất
        </button>
      </div>
    </BottomSheet>
  );
}
