import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, CalendarRange, CarFront, Bell, CheckSquare, Settings, Menu } from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);
  
  // Đọc User thật từ Local Storage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

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

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Trang chủ', path: '/', icon: Home, show: true },
    { name: 'Duyệt yêu cầu', path: '/admin/approvals', icon: CheckSquare, show: isAdmin },
    { name: 'Đặt phòng họp', path: '/rooms', icon: CalendarRange, show: true },
    { name: 'Đặt xe', path: '/cars', icon: CarFront, show: true },
    { name: 'Tài nguyên', path: '/admin/resources', icon: Settings, show: isAdmin },
  ];

  const notifications = [
    { id: 1, title: 'Yêu cầu mới', desc: 'Nguyễn Văn A vừa đặt xe đi công tác', time: '5 phút trước', isRead: false },
    { id: 2, title: 'Đã duyệt', desc: 'Phòng họp Hội đồng 1 đã được duyệt', time: '2 giờ trước', isRead: true },
    { id: 3, title: 'Từ chối', desc: 'Yêu cầu đặt xe của bạn đã bị từ chối', time: '1 ngày trước', isRead: true },
  ];

  return (
    <div className="flex h-screen bg-[#F9FAFB] font-sans text-gray-900">
      
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight text-blue-700">BookingBase</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!isSidebarOpen ? item.name : ""}
                className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 rounded-md text-sm transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout (Sidebar Bottom) */}
        <div className="p-4 border-t border-gray-200">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold flex-shrink-0">
                {user.fullName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                <p className="text-xs text-gray-500 truncate">{user.role}</p>
              </div>
            </div>
          ) : (
             <div className="flex justify-center mb-4">
               <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold" title={user.fullName}>
                {user.fullName?.charAt(0) || 'U'}
               </div>
             </div>
          )}
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center ${isSidebarOpen ? 'justify-center gap-2 px-4' : 'justify-center'} py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors`}
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10">
          <h1 className="text-lg font-medium text-gray-800">
            {navItems.find(item => item.path === location.pathname)?.name || 'Hệ thống'}
          </h1>
          
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 focus:outline-none"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <span className="font-semibold text-gray-900">Thông báo</span>
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Đánh dấu đã đọc</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map(notif => (
                      <div key={notif.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${notif.isRead ? 'opacity-70' : 'bg-blue-50/20'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm font-medium ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</span>
                          <span className="text-xs text-gray-400">{notif.time}</span>
                        </div>
                        <p className="text-sm text-gray-500">{notif.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 text-center border-t border-gray-100">
                    <button className="text-sm font-medium text-gray-500 hover:text-gray-700">Xem tất cả</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#F9FAFB] p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
