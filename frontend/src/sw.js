/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */
/**
 * Service Worker — CFC Booking PWA
 *
 * Vai trò:
 *  1. Precache asset (qua Workbox, manifest precache được vite-plugin-pwa inject).
 *  2. Lắng nghe `push` event → hiển thị notification trên OS (kể cả khi app đóng).
 *  3. Lắng nghe `notificationclick` → focus app đang mở hoặc mở app + deep link.
 *
 * Giữ `skipWaiting` + `clients.claim` để tương thích `registerType: 'autoUpdate'`.
 */
import { precacheAndRoute } from 'workbox-precaching';

// Manifest precache được inject lúc build (mảng self.__WB_MANIFEST).
precacheAndRoute(self.__WB_MANIFEST || []);

// Kích hoạt SW mới ngay khi có bản cập nhật (autoUpdate).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * PUSH EVENT — server gửi push → SW hiện notification.
 * Payload JSON từ backend: { title, message, targetUrl, sourceType, sourceId, type }
 *
 * Để tránh duplicate với WebSocket toast khi user đang xem app:
 * nếu có client đang FOCUS (visibilityState === 'visible') thì KHÔNG show.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'CFC Booking', message: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CFC Booking';
  const options = {
    body: payload.message || payload.description || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      url: buildTargetUrl(payload),
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      type: payload.type,
    },
  };

  event.waitUntil(
    (async () => {
      // Chỉ show notification khi KHÔNG có client đang focused → tránh trùng WS toast.
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const hasFocused = clientList.some(
        (client) => client.visibilityState === 'visible' && client.focused
      );
      if (hasFocused) return;

      await self.registration.showNotification(title, options);
    })()
  );
});

/**
 * NOTIFICATIONCLICK — user tap notification.
 * Nếu app đang mở → focus + postMessage để app navigate.
 * Nếu app đóng → mở app mới tới deep link.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Ưu tiên client đã mở cùng origin → focus + yêu cầu navigate.
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }

      // Không có client mở → mở app mới.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

/**
 * Xây deep link URL dựa trên payload notification.
 *  - targetUrl có sẵn → dùng trực tiếp.
 *  - BOOKING_ROOM / BOOKING_CAR với sourceId → vào trang detail approval.
 *  - Fallback → root app.
 */
function buildTargetUrl(payload) {
  if (payload.targetUrl && payload.sourceId && payload.targetUrl.replace(/\/$/, '') === '/admin/approvals') {
    return `/admin/approvals/${payload.sourceId}`;
  }
  if (payload.targetUrl) return payload.targetUrl;
  if ((payload.sourceType === 'BOOKING_ROOM' || payload.sourceType === 'BOOKING_CAR') && payload.sourceId) {
    return `/admin/approvals/${payload.sourceId}`;
  }
  return '/';
}
