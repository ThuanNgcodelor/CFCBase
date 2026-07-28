import {
  ArrowLeft,
  Bell,
  ChevronDown
} from 'lucide-react';
import { useEffect, useState } from 'react';
import brandLogo from '../../../../frontend/public/logo.png';
import { useAppData } from '../context/AppDataContext.jsx';
import {
  desktopNavigation,
  mobileNavigation,
  moreNavigation,
  routeIsActive
} from './navigation.js';
import { BottomSheet } from './overlays/BottomSheet.jsx';
import { ToastViewport } from './ToastViewport.jsx';

const formRoute = (path) =>
  /\/(new|edit)$/.test(path) || /\/[^/]+\/edit$/.test(path);

const formTitle = (path) => {
  if (path.startsWith('/probation/templates')) return 'Mẫu công việc';
  if (path.startsWith('/probation')) return 'Thử việc';
  return 'Nhân sự';
};

function Sidebar({ path, navigate }) {
  return (
    <aside className="desktop-sidebar">
      <button className="brand brand--desktop" type="button" onClick={() => navigate('/overview')}>
        <img src={brandLogo} alt="" />
        <span>CFC Base</span>
      </button>
      <nav className="desktop-sidebar__nav" aria-label="Điều hướng nhân sự">
        {desktopNavigation.map((item) => {
          const Icon = item.icon;
          const active = routeIsActive(path, item.path);
          return (
            <button
              key={`${item.path}-${item.label}`}
              type="button"
              className={`nav-item ${active ? 'nav-item--active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="desktop-sidebar__crane" aria-hidden="true">
        <span className="crane-line crane-line--one" />
        <span className="crane-line crane-line--two" />
        <span className="crane-line crane-line--three" />
      </div>
    </aside>
  );
}

function DesktopTopbar() {
  return (
    <header className="desktop-topbar">
      <button type="button" className="notification-button" aria-label="Thông báo">
        <Bell aria-hidden="true" />
      </button>
      <span className="topbar-divider" />
      <button type="button" className="profile-button">
        <span className="profile-button__avatar">HR</span>
        <span>Phòng Nhân sự</span>
        <ChevronDown aria-hidden="true" />
      </button>
    </header>
  );
}

function MobileHeader({ path, navigate }) {
  const isForm = formRoute(path);
  return (
    <header className={`mobile-header ${isForm ? 'mobile-header--form' : ''}`}>
      {isForm ? (
        <button type="button" className="mobile-header__back" onClick={() => globalThis.history.back()} aria-label="Quay lại">
          <ArrowLeft aria-hidden="true" />
        </button>
      ) : null}
      <button className="brand brand--mobile" type="button" onClick={() => navigate('/overview')}>
        <img src={brandLogo} alt="" />
        <span>{isForm ? formTitle(path) : 'Nhân sự'}</span>
      </button>
      {!isForm ? (
        <div className="mobile-header__actions">
          <button type="button" className="notification-button" aria-label="Thông báo">
            <Bell aria-hidden="true" />
          </button>
          <span className="profile-button__avatar">HR</span>
        </div>
      ) : null}
    </header>
  );
}

function MobileNav({ path, navigate, onMore }) {
  if (formRoute(path)) return null;
  return (
    <nav className="mobile-nav" aria-label="Điều hướng chính">
      {mobileNavigation.map((item) => {
        const Icon = item.icon;
        const moreActive = moreNavigation.some((moreItem) => routeIsActive(path, moreItem.path));
        const active = item.path === '__more__'
          ? moreActive
          : routeIsActive(path, item.path);
        return (
          <button
            key={item.path}
            type="button"
            className={`mobile-nav__item ${active ? 'mobile-nav__item--active' : ''}`}
            onClick={() => item.path === '__more__' ? onMore() : navigate(item.path)}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MoreSheet({ open, path, navigate, onClose }) {
  return (
    <BottomSheet open={open} title="Thêm chức năng" onClose={onClose}>
      <div className="more-grid">
        {moreNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={`${item.path}-${item.label}`}
              type="button"
              className={`more-grid__item ${routeIsActive(path, item.path) ? 'more-grid__item--active' : ''}`}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

export function AppShell({ path, navigate, children }) {
  const { toasts } = useAppData();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    globalThis.scrollTo({ top: 0, behavior: 'instant' });
  }, [path]);

  return (
    <div className="app-shell">
      <Sidebar path={path} navigate={navigate} />
      <DesktopTopbar />
      <MobileHeader path={path} navigate={navigate} />

      <main className={`app-content ${formRoute(path) ? 'app-content--form-route' : ''}`}>
        {children}
      </main>

      <footer className="desktop-footer">
        <div>
          <img src={brandLogo} alt="" />
          <span><b>CFC Base HRM System</b><small>© 2026 CFC Vietnam. All rights reserved.</small></span>
        </div>
        <span>Phiên bản 1.0.0</span>
      </footer>

      <MobileNav path={path} navigate={navigate} onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} path={path} navigate={navigate} onClose={() => setMoreOpen(false)} />
      <ToastViewport toasts={toasts} />
    </div>
  );
}
