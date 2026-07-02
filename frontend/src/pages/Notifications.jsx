import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { notificationApi } from '../api/notificationApi';
import { authApi } from '../api/authApi';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const user = authApi.getUser();

  useEffect(() => {
    if (user?.id) {
      notificationApi.getNotifications(user.id)
        .then(data => setNotifications(data || []))
        .catch(err => console.error(err));
    }
  }, [user?.id]);

  const getIcon = (title) => {
    if (title.toLowerCase().includes('được duyệt')) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (title.toLowerCase().includes('từ chối')) return <XCircle className="w-5 h-5 text-red-500" />;
    if (title.toLowerCase().includes('mới')) return <Clock className="w-5 h-5 text-yellow-500" />;
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const handleMarkAsRead = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationApi.markAsRead(notif.id);
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch (e) {
        console.error(e);
      }
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

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Tất cả thông báo</h1>
          <p className="text-gray-500 mt-1">Cập nhật tình trạng các yêu cầu và tài nguyên của bạn.</p>
        </div>
        <button onClick={handleMarkAllAsRead} className="text-sm font-medium text-blue-600 hover:text-blue-800">
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            onClick={() => handleMarkAsRead(notif)}
            className={`p-6 flex gap-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${notif.isRead ? 'opacity-70' : 'bg-blue-50/10'}`}
          >
            <div className="shrink-0 mt-0.5">
              {getIcon(notif.title)}
            </div>
            <div className="flex-1">
              <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-1 sm:gap-4 mb-1">
                <h3 className={`text-base font-semibold ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                  {notif.title}
                </h3>
                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                  {new Date(notif.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{notif.message}</p>
            </div>
            {!notif.isRead && (
              <div className="shrink-0 flex items-center">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Bạn chưa có thông báo nào.
          </div>
        )}
      </div>
    </div>
  );
}
