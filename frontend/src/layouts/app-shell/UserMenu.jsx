import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, LogOut, UserRound } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import HrOcrSettingsModal from '../../components/hr/HrOcrSettingsModal';

const ROLE_LABELS = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Phòng Nhân sự',
  EMPLOYEE: 'Nhân viên',
};

function getUserMeta(user) {
  return user.department?.name
    || user.departmentName
    || user.jobPosition
    || user.position
    || ROLE_LABELS[user.role]
    || 'Người dùng';
}

export function UserMenu({ user, navigate, onLogout, mobile = false, dark = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showOcrSettings, setShowOcrSettings] = useState(false);
  const menuRef = useRef(null);
  const displayName = user.fullName || user.email || 'Người dùng';
  const meta = getUserMeta(user);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-11 items-center rounded-lg transition ${mobile ? 'w-11 justify-center' : 'gap-3 px-2.5'} ${dark ? 'text-white hover:bg-white/10' : 'hover:bg-slate-100'}`}
        aria-label="Mở menu tài khoản"
        aria-expanded={isOpen}
      >
        <Avatar src={user.avatarUrl} name={displayName} size={mobile ? 'sm' : 'md'} className={dark ? 'ring-1 ring-white/25' : 'ring-1 ring-slate-200'} />
        {!mobile && (
          <>
            <span className="min-w-0 max-w-48 text-left">
              <span className="block truncate text-sm font-bold text-[var(--cfc-ink)]">{displayName}</span>
              <span className="block truncate text-xs text-[var(--cfc-muted)]">{meta}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-[var(--cfc-muted)]" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+58px)] z-[80] w-64 overflow-hidden rounded-xl border border-[var(--cfc-border)] bg-white shadow-[var(--cfc-shadow-panel)] md:absolute md:right-0 md:top-full md:mt-3">
          <div className="border-b border-[var(--cfc-border)] px-4 py-3">
            <p className="truncate text-sm font-bold text-[var(--cfc-ink)]">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--cfc-muted)]">{user.email || meta}</p>
          </div>
          <div className="p-2 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/profile');
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--cfc-ink)] hover:bg-slate-100"
            >
              <UserRound className="h-5 w-5 text-[var(--cfc-muted)]" />
              Hồ sơ cá nhân
            </button>
            {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowOcrSettings(true);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--cfc-ink)] hover:bg-slate-100"
              >
                <Bot className="h-5 w-5 text-emerald-600" />
                Cài đặt AI (OCR)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--cfc-danger)] hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      <HrOcrSettingsModal
        isOpen={showOcrSettings}
        onClose={() => setShowOcrSettings(false)}
      />
    </div>
  );
}
