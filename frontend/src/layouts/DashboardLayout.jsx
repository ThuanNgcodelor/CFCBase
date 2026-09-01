import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import RequiredPushNotificationGate from '../components/RequiredPushNotificationGate';
import { NotificationProvider } from '../contexts/NotificationContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { AppFooter } from './app-shell/AppFooter';
import { AppSidebar } from './app-shell/AppSidebar';
import { AppTopBar } from './app-shell/AppTopBar';
import { MobileBottomNav } from './app-shell/MobileBottomNav';
import { MobileMoreSheet } from './app-shell/MobileMoreSheet';
import {
  buildMobileNavigation,
  buildNavigation,
  getPageTitle,
  isNavigationItemActive,
  shouldHideMobileBottomNavigation,
} from './app-shell/navigation';

export default function DashboardLayout() {
  return (
    <NotificationProvider>
      <DashboardLayoutContent />
    </NotificationProvider>
  );
}

function DashboardLayoutContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => window.localStorage.getItem('cfc-sidebar-collapsed') !== 'true',
  );
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [user, setUser] = useState(() => authApi.getUser() || {});
  const [pendingRegistrationCount, setPendingRegistrationCount] = useState(0);

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const isApprover = user.role === 'ADMIN' || user.role === 'MANAGER';
  const pushState = usePushNotifications({ autoRegister: true });

  useEffect(() => {
    let active = true;

    userApi.getMe()
      .then((currentUser) => {
        if (!active || !currentUser) return;
        setUser(currentUser);
        authApi.updateUser(currentUser);
      })
      .catch((error) => {
        console.error('Không thể đồng bộ thông tin người dùng:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    userApi.getPendingRegistrationCount()
      .then((count) => setPendingRegistrationCount(Number(count) || 0))
      .catch(() => {});
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [location.pathname]);

  const navigation = useMemo(
    () => buildNavigation({
      isAdmin,
      isManager,
      isApprover,
      isHrUser: true,
      pendingRegistrationCount,
    }),
    [isAdmin, isApprover, isManager, pendingRegistrationCount],
  );
  const mobileNavigation = useMemo(
    () => buildMobileNavigation({
      isManager,
      isHrUser: true,
      primaryItems: navigation.primaryItems,
      adminItems: navigation.adminItems,
      hrItems: navigation.hrItems,
    }),
    [isManager, navigation],
  );

  const allNavigationItems = useMemo(
    () => navigation.sections.flatMap((section) => section.items),
    [navigation.sections],
  );
  const pageTitle = getPageTitle(location.pathname, allNavigationItems);
  const isCalendarRoute = location.pathname.startsWith('/cars')
    || location.pathname.startsWith('/rooms');
  const isBookingDetailRoute = /^\/admin\/approvals\/[^/]+$/.test(location.pathname);
  const isBookingFullBleedRoute = isCalendarRoute || isBookingDetailRoute;
  const isHrRoute = location.pathname.startsWith('/manager/hr');
  const hideMobileNavigation = shouldHideMobileBottomNavigation(location.pathname);
  const moreActive = mobileNavigation.moreSections
    .flatMap((section) => section.items)
    .some((item) => isNavigationItemActive(item, location.pathname));

  const handleSidebarToggle = () => {
    setSidebarExpanded((current) => {
      const next = !current;
      window.localStorage.setItem('cfc-sidebar-collapsed', String(!next));
      return next;
    });
  };

  const handleLogout = async () => {
    await authApi.logout();
    navigate('/login');
  };

  const contentPadding = isBookingFullBleedRoute
    ? 'p-0'
    : isHrRoute
      ? 'px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7 2xl:px-10'
      : 'px-4 py-5 sm:px-6 sm:py-7 xl:px-8';

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-[var(--cfc-canvas)] text-[var(--cfc-ink)]">
      <RequiredPushNotificationGate pushState={pushState} />

      <AppSidebar
        expanded={sidebarExpanded}
        onToggle={handleSidebarToggle}
        sections={navigation.sections}
        pathname={location.pathname}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar
          pageTitle={pageTitle}
          user={user}
          navigate={navigate}
          onLogout={handleLogout}
          onOpenMore={() => setMobileMoreOpen(true)}
          hasMoreItems={mobileNavigation.moreSections.length > 0}
        />

        <main
          className={`cfc-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto
            ${isCalendarRoute ? 'bg-white' : 'bg-[var(--cfc-canvas)]'}
          `}
        >
          <div className={`flex flex-1 flex-col ${contentPadding} ${hideMobileNavigation ? '' : 'pb-[calc(var(--cfc-mobile-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] md:pb-7'}`}>
            <Outlet />
          </div>
          {!isBookingFullBleedRoute && <AppFooter />}
        </main>
      </div>

      <MobileBottomNav
        items={mobileNavigation.primary}
        pathname={location.pathname}
        hidden={hideMobileNavigation}
        moreActive={moreActive}
        onOpenMore={() => setMobileMoreOpen(true)}
      />
      <MobileMoreSheet
        isOpen={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        sections={mobileNavigation.moreSections}
        pathname={location.pathname}
        navigate={navigate}
        onLogout={handleLogout}
      />
    </div>
  );
}
