import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, CalendarRange, CarFront, Bell, CheckSquare, Settings, Menu } from 'lucide-react';
import { authApi } from '../api/authApi';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useNotificationCenter } from '../contexts/useNotificationCenter';
import { usePushNotifications } from '../hooks/usePushNotifications';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [imageError, setImageError] = useState(false);
  const [collapsedImageError, setCollapsedImageError] = useState(false);

  // Đọc User thật từ Cookie
  const user = authApi.getUser() || {};
  const isAdmin = user.role === 'ADMIN';
  const isApprover = user.role === 'ADMIN' || user.role === 'MANAGER';

  const {
    notifications,
    unreadCount,
    loading: notificationLoading,
    error: notificationError,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationCenter();
  usePushNotifications({ autoRegister: true });

  // Tự động đóng sidebar trên mobile khi đổi trang
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  // Đóng dropdown thông báo khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type !== 'NAVIGATE' || !event.data.url) return;
      const url = new URL(event.data.url, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(`${url.pathname}${url.search}${url.hash}`);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [navigate]);

  const handleLogout = async () => {
    await authApi.logout();
    navigate('/login');
  };

  const mainNavItems = [
    { name: 'Trang chủ', path: '/', icon: Home, show: true },
    { name: 'Đặt phòng họp', path: '/rooms', icon: CalendarRange, show: true },
    { name: 'Đặt xe', path: '/cars', icon: CarFront, show: true },
  ];

  const adminNavItems = [
    { name: 'Duyệt yêu cầu', path: '/admin/approvals', icon: CheckSquare, show: isApprover },
    { name: 'Tài nguyên', path: '/admin/resources', icon: Settings, show: isAdmin },
  ];

  const handleMarkAsRead = async (notif) => {
    try {
      await markAsRead(notif);
    } catch (e) {
      console.error(e);
    }

    if (notif.targetUrl) {
      navigate(notif.targetUrl);
    } else if (user?.role === 'ADMIN' && (notif.title.toLowerCase().includes('mới') || notif.title.toLowerCase().includes('chờ duyệt'))) {
      navigate('/admin/approvals');
    } else if (notif.title.toLowerCase().includes('phòng')) {
      navigate('/rooms');
    } else if (notif.title.toLowerCase().includes('xe')) {
      navigate('/cars');
    }
    setIsNotifOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      await loadNotifications(0, 10);
    } catch (e) {
      console.error(e);
    }
  };

  const isCalendarRoute = location.pathname.startsWith('/cars') || location.pathname.startsWith('/rooms');
  const unreadBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="flex h-[100dvh] bg-[#F9FAFB] font-sans text-gray-900 overflow-hidden relative">

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 w-54' : '-translate-x-full md:w-20'}
        bg-white border-r border-gray-200 flex flex-col shrink-0
      `}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-blue-700">CFC Booking</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hidden md:block">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          {/* Nhóm chức năng chính */}
          <div className="space-y-1">
            {isSidebarOpen && <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chức năng chính</div>}
            {mainNavItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path) && (item.path !== '/' || location.pathname === '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isSidebarOpen ? item.name : ""}
                  className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 rounded-md text-sm transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  {isSidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>

          {/* Nhóm quản trị */}
          {(isAdmin || isApprover) && (
            <div className="space-y-1">
              {isSidebarOpen && <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Quản trị hệ thống</div>}
              {adminNavItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={!isSidebarOpen ? item.name : ""}
                    className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 rounded-md text-sm transition-colors ${isActive
                      ? 'bg-amber-50 text-amber-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-amber-700' : 'text-gray-400'}`} />
                    {isSidebarOpen && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3 border-t border-gray-200">
          {isSidebarOpen ? (
            <div className="flex flex-col gap-2">
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded-md transition-colors"
                onClick={() => navigate('/profile')}
              >
                {user.avatarUrl && !imageError ? (
                  <img
                    src={user.avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover shadow-sm flex-shrink-0 border border-gray-100"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0 shadow-sm">
                    {user.fullName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate hover:text-blue-700 transition-colors">{user.fullName}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {user.position || (user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 border-t border-gray-100 pt-2">
                <div className="relative flex-1" ref={notifRef}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsNotifOpen(!isNotifOpen); }}
                    className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600 focus:outline-none"
                    title="Thông báo"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 right-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
                        {unreadBadgeLabel}
                      </span>
                    )}
                  </button>

                  {isNotifOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <span className="font-semibold text-gray-900">Thông báo</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAllAsRead();
                          }}
                          className="text-xs font-medium text-blue-600 disabled:text-gray-400"
                          disabled={unreadCount === 0}
                        >
                          Đã đọc tất cả
                        </button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {notificationLoading && (
                          <div className="p-4 text-center text-sm text-gray-500">Đang tải thông báo...</div>
                        )}
                        {notificationError && !notificationLoading && (
                          <div className="p-4 text-center text-sm text-red-500">{notificationError}</div>
                        )}
                        {notifications.slice(0, 5).map(notif => {
                          const hasSender = !!notif.sender;
                          const senderName = notif.sender?.fullName || 'Hệ thống';
                          const avatarUrl = notif.sender?.avatarUrl;

                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleMarkAsRead(notif)}
                              className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${notif.isRead ? 'opacity-70' : 'bg-blue-50/20'}`}
                            >
                              <div className="flex gap-3">
                                <div className="shrink-0 mt-0.5">
                                  {hasSender ? (
                                    avatarUrl ? (
                                      <img src={avatarUrl} alt="Avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        {senderName.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                      <Bell className="w-4 h-4 text-blue-500" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm font-medium truncate ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</span>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">{notif.message || notif.description}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {notifications.length === 0 && !notificationLoading && !notificationError && (
                          <div className="p-4 text-center text-sm text-gray-500">Bạn không có thông báo nào</div>
                        )}
                      </div>
                      <div className="p-2 bg-gray-50/50 border-t border-gray-100">
                        <button 
                          onClick={() => {
                            setIsNotifOpen(false);
                            navigate('/notifications');
                          }}
                          className="w-full py-1.5 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md transition-colors"
                        >
                          Xem tất cả
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center p-2 rounded-md hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/profile')}
                title={user.fullName}
              >
                {user.avatarUrl && !collapsedImageError ? (
                  <img
                    src={user.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover shadow-sm border border-gray-100"
                    referrerPolicy="no-referrer"
                    onError={() => setCollapsedImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold shadow-sm">
                    {user.fullName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>

              <div className="relative w-full flex justify-center" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600 focus:outline-none"
                  title="Thông báo"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
                      {unreadBadgeLabel}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute bottom-full left-12 mb-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <span className="font-semibold text-gray-900">Thông báo</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllAsRead();
                        }}
                        className="text-xs font-medium text-blue-600 disabled:text-gray-400"
                        disabled={unreadCount === 0}
                      >
                        Đã đọc tất cả
                      </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {notificationLoading && (
                        <div className="p-4 text-center text-sm text-gray-500">Đang tải thông báo...</div>
                      )}
                      {notificationError && !notificationLoading && (
                        <div className="p-4 text-center text-sm text-red-500">{notificationError}</div>
                      )}
                      {notifications.slice(0, 5).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkAsRead(notif)}
                          className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${notif.isRead ? 'opacity-70' : 'bg-blue-50/20'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-medium ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</span>
                            <span className="text-xs text-gray-400">{new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm text-gray-500">{notif.message || notif.description}</p>
                        </div>
                      ))}
                      {notifications.length === 0 && !notificationLoading && !notificationError && (
                        <div className="p-4 text-center text-sm text-gray-500">Bạn không có thông báo nào</div>
                      )}
                    </div>
                    <div className="p-2 bg-gray-50/50 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setIsNotifOpen(false);
                          navigate('/notifications');
                        }}
                        className="w-full py-1.5 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md transition-colors"
                      >
                        Xem tất cả
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 rounded-full hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header (Only visible on mobile) */}
        <header className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-medium text-gray-800">
              {[...mainNavItems, ...adminNavItems].find(item => location.pathname.startsWith(item.path) && (item.path !== '/' || location.pathname === '/'))?.name || 'Hệ thống'}
            </h1>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden ${isCalendarRoute ? 'bg-white' : 'bg-[#F9FAFB]'}`}>
          <div className={`flex-1 flex flex-col ${isCalendarRoute ? 'p-0' : 'p-4 sm:p-8'}`}>
            <Outlet />
          </div>
          
          {/* System Footer */}
          <footer className="mt-auto border-t border-gray-200 bg-white px-4 py-6 sm:px-8 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo2.png" alt="CFC Logo" className="h-10 w-auto object-contain" />
              <div>
                <p className="font-semibold text-gray-700 text-sm">CÔNG TY CỔ PHẦN PHÂN BÓN & HÓA CHẤT CẦN THƠ</p>
                <p className="text-xs text-gray-500 mt-0.5">© Bản quyền thuộc về CFC | Cung cấp bởi phòng TCHC</p>
                <p className="text-xs text-gray-500 mt-0.5">Thiết kế và phát triển bởi: <span className="font-medium">Nguyễn Trung Thuận (David Nguyen)</span></p>
              </div>
            </div>
            <div className="text-left md:text-right text-xs text-gray-500 space-y-0.5">
              <p>Trục Chính Khu Công Nghiệp Trà Nóc 1, P. Thới An Đông, Q. Bình Thủy, TP. Cần Thơ</p>
              <p>Điện thoại: <span className="font-medium text-gray-600">1900 5307</span> | Email: <span className="font-medium text-gray-600">info@cfccobay.com</span></p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
