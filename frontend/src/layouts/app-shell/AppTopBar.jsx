import React from 'react';
import { Grid2X2 } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { UserMenu } from './UserMenu';

export function AppTopBar({ pageTitle, user, navigate, onLogout, onOpenMore, hasMoreItems }) {
  return (
    <>
      <header className="hidden h-[var(--cfc-topbar-height)] shrink-0 items-center justify-between border-b border-[var(--cfc-border)] bg-white px-6 md:flex xl:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cfc-emerald-dark)]">Hệ thống quản lý nhân sự</p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--cfc-ink)]">{pageTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu user={user} navigate={navigate} onLogout={onLogout} />
        </div>
      </header>

      <header className="cfc-safe-top shrink-0 bg-[var(--cfc-navy)] text-white md:hidden">
        <div className="flex h-[var(--cfc-mobile-bar-height)] items-center gap-2 px-3">
          <BrandMark compact dark />
          <h1 className="min-w-0 flex-1 truncate text-base font-bold">{pageTitle}</h1>
          {hasMoreItems && (
            <button
              type="button"
              onClick={onOpenMore}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Mở thêm chức năng"
            >
              <Grid2X2 className="h-5 w-5" />
            </button>
          )}
          <UserMenu user={user} navigate={navigate} onLogout={onLogout} mobile dark />
        </div>
      </header>
    </>
  );
}
