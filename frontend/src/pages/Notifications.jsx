import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, XCircle, ArrowRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/notificationApi';
import { authApi } from '../api/authApi';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const navigate = useNavigate();
  const user = authApi.getUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (user?.id) {
      notificationApi.getNotifications(user.id, currentPage - 1, itemsPerPage)
        .then(data => {
            if (data && data.content) {
                setNotifications(data.content);
                setTotalElements(data.totalElements);
            } else if (Array.isArray(data)) {
                setNotifications(data);
                setTotalElements(data.length);
            }
        })
        .catch(err => console.error(err));
    }
  }, [user?.id, currentPage]);

  useEffect(() => {
    if (!user?.id) return;
    const wsUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api/v1', '/ws') : 'http://localhost:8080/ws';
    const socket = new SockJS(wsUrl);
    const stompClient = Stomp.over(socket);
    stompClient.debug = () => {};
    stompClient.connect({}, () => {
      stompClient.subscribe(`/topic/notifications/${user.id}`, (message) => {
        const newNotif = JSON.parse(message.body);
        setNotifications(prev => [newNotif, ...prev]);
        setTotalElements(prev => prev + 1);
      });
    });
    return () => {
      if (stompClient.connected) {
        stompClient.disconnect();
      }
    };
  }, [user?.id]);

  const getSystemIcon = (title) => {
    if (title.toLowerCase().includes('được duyệt')) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (title.toLowerCase().includes('từ chối')) return <XCircle className="w-5 h-5 text-red-500" />;
    if (title.toLowerCase().includes('mới')) return <Clock className="w-5 h-5 text-amber-500" />;
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const handleNotificationClick = async (notif) => {
    // Mark as read
    if (!notif.isRead) {
      try {
        await notificationApi.markAsRead(notif.id);
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch (e) {
        console.error(e);
      }
    }

    // Navigate based on type/title
    if (user?.role === 'ADMIN' && (notif.title.toLowerCase().includes('mới') || notif.title.toLowerCase().includes('chờ duyệt'))) {
      navigate('/admin/approvals');
    } else if (notif.title.toLowerCase().includes('phòng')) {
      navigate('/rooms');
    } else if (notif.title.toLowerCase().includes('xe')) {
      navigate('/cars');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    for (const notif of unread) {
      try {
        await notificationApi.markAsRead(notif.id);
      } catch (e) {
        console.error(e);
      }
    }
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const filteredNotifications = notifications.filter(notif => {
    const titleMatch = notif.title.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = notif.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const senderMatch = notif.sender?.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || descMatch || senderMatch;
  });

  const totalPages = Math.ceil(totalElements / itemsPerPage);
  const displayNotifications = filteredNotifications;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tất cả thông báo</h1>
          <p className="text-gray-500 mt-1">Cập nhật trạng thái các yêu cầu đặt lịch của bạn.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm thông báo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button onClick={handleMarkAllAsRead} className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg transition-colors">
            Đánh dấu đã đọc tất cả
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-1 overflow-y-auto">
        {displayNotifications.map(notif => {
          // Xử lý hiển thị Avatar người gửi hoặc Icon hệ thống
          const hasSender = !!notif.sender;
          const senderName = notif.sender?.fullName || 'Hệ thống';
          const avatarUrl = notif.sender?.avatarUrl;

          return (
            <div 
              key={notif.id} 
              onClick={() => handleNotificationClick(notif)}
              className={`p-5 sm:p-6 flex gap-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group ${notif.isRead ? 'opacity-70' : 'bg-blue-50/20'}`}
            >
              <div className="shrink-0 mt-1">
                {hasSender ? (
                  avatarUrl ? (
                    <img src={avatarUrl} alt={senderName} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {senderName.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notif.isRead ? 'bg-gray-100' : 'bg-blue-50'}`}>
                    {getSystemIcon(notif.title)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-1 sm:gap-4 mb-1">
                  <h3 className={`text-base font-semibold truncate ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                    {notif.title}
                  </h3>
                  <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                    {new Date(notif.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">
                  {notif.description}
                </p>
                {hasSender && (
                  <p className="text-xs text-gray-400 mt-2">Từ: <span className="font-medium text-gray-500">{senderName}</span></p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end justify-center">
                {!notif.isRead && (
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mb-2"></div>
                )}
                <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          );
        })}
        {displayNotifications.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500">
            <Bell className="w-12 h-12 text-gray-200 mb-4" />
            <p className="font-medium">
              {searchQuery ? 'Không tìm thấy thông báo nào phù hợp.' : 'Bạn chưa có thông báo nào.'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 mb-2 px-1">
          <p className="text-sm text-gray-500">
            Hiển thị <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalElements)}</span> trong tổng số <span className="font-medium">{totalElements}</span> thông báo
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
