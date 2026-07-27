import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationList, useNotificationUnreadCount } from '../../contexts/useNotificationCenter';
import { resolveNotificationTarget } from '../../utils/notificationNavigation';
import { Avatar } from '../../components/ui/Avatar';

export function NotificationMenu({ navigate, dark = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { unreadCount } = useNotificationUnreadCount();

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
        className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition ${dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-[var(--cfc-muted)] hover:bg-slate-100 hover:text-[var(--cfc-ink)]'}`}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className={`absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--cfc-danger)] px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ${dark ? 'ring-[var(--cfc-navy)]' : 'ring-white'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          navigate={navigate}
          unreadCount={unreadCount}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function NotificationDropdown({ navigate, unreadCount, onClose }) {
  const {
    notifications,
    loading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationList();

  const handleNotification = async (notification) => {
    try {
      await markAsRead(notification);
    } catch (errorValue) {
      console.error(errorValue);
    }
    navigate(resolveNotificationTarget(notification));
    onClose();
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      await loadNotifications(0, 10);
    } catch (errorValue) {
      console.error(errorValue);
    }
  };

  return (
    <section className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+58px)] z-[80] overflow-hidden rounded-xl border border-[var(--cfc-border)] bg-white text-left shadow-[var(--cfc-shadow-panel)] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[360px]">
      <header className="flex min-h-14 items-center justify-between border-b border-[var(--cfc-border)] bg-[var(--cfc-surface-muted)] px-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--cfc-ink)]">Thông báo</h2>
          <p className="text-xs text-[var(--cfc-muted)]">{unreadCount} thông báo chưa đọc</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[var(--cfc-cobalt)] hover:bg-blue-50 disabled:text-slate-400"
          disabled={unreadCount === 0}
        >
          Đã đọc tất cả
        </button>
      </header>

      <div className="cfc-scrollbar max-h-[min(390px,65dvh)] overflow-y-auto">
        {loading && <p className="p-5 text-center text-sm text-[var(--cfc-muted)]">Đang tải thông báo...</p>}
        {error && !loading && <p className="p-5 text-center text-sm text-[var(--cfc-danger)]">{error}</p>}
        {notifications.slice(0, 5).map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={() => handleNotification(notification)}
          />
        ))}
        {!notifications.length && !loading && !error && (
          <p className="p-8 text-center text-sm text-[var(--cfc-muted)]">Bạn chưa có thông báo nào.</p>
        )}
      </div>

      <footer className="border-t border-[var(--cfc-border)] bg-[var(--cfc-surface-muted)] p-2">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className="min-h-10 w-full rounded-lg text-sm font-semibold text-[var(--cfc-cobalt)] hover:bg-blue-50"
        >
          Xem tất cả thông báo
        </button>
      </footer>
    </section>
  );
}

function NotificationItem({ notification, onClick }) {
  const senderName = notification.sender?.fullName || 'Hệ thống';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.isRead ? 'bg-white' : 'bg-blue-50/45'}`}
    >
      {notification.sender ? (
        <Avatar src={notification.sender.avatarUrl} name={senderName} size="sm" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[var(--cfc-cobalt)]">
          <Bell className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`truncate text-sm ${notification.isRead ? 'font-medium text-slate-700' : 'font-bold text-[var(--cfc-ink)]'}`}>
            {notification.title}
          </span>
          <time className="shrink-0 text-[10px] text-slate-400">
            {new Date(notification.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </time>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--cfc-muted)]">
          {notification.message || notification.description}
        </span>
      </span>
    </button>
  );
}
