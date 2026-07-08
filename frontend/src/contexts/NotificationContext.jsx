import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { notificationApi } from '../api/notificationApi';
import { NotificationContext } from './NotificationContextCore';

const getWsUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '/ws');
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const clientRef = useRef(null);

  const loadNotifications = useCallback(async (page = 0, size = 10, unreadOnly = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationApi.getNotifications(page, size, unreadOnly);
      setNotifications(data?.content || []);
      setUnreadCount(await notificationApi.getUnreadCount());
      return data;
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải thông báo');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await notificationApi.getUnreadCount());
    } catch {
      // Silent background refresh.
    }
  }, []);

  const upsertRealtimeNotification = useCallback((notification) => {
    setNotifications((prev) => {
      if (prev.some((item) => item.id === notification.id)) return prev;
      return [notification, ...prev].slice(0, 20);
    });
    setUnreadCount((prev) => prev + (notification.isRead ? 0 : 1));

    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg`}>
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{notification.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{notification.message || notification.description}</p>
          </div>
        </div>
      </div>
    ));
  }, []);

  useEffect(() => {
    loadNotifications().catch(() => {});
  }, [loadNotifications]);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token || clientRef.current) return undefined;

    const client = new Client({
      webSocketFactory: () => new SockJS(getWsUrl()),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      onConnect: () => {
        client.subscribe('/user/queue/notifications', (message) => {
          upsertRealtimeNotification(JSON.parse(message.body));
        });
      },
      onStompError: () => {
        refreshUnreadCount();
      },
      onWebSocketClose: () => {
        refreshUnreadCount();
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      clientRef.current = null;
      client.deactivate();
    };
  }, [refreshUnreadCount, upsertRealtimeNotification]);

  const markAsRead = useCallback(async (notification) => {
    if (!notification || notification.isRead) return notification;
    const response = await notificationApi.markAsRead(notification.id);
    const updated = response.data;
    setNotifications((prev) => prev.map((item) => item.id === notification.id ? updated : item));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    return updated;
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationApi.markAllAsRead();
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAsRead,
      markAllAsRead,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
