/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */
/**
 * Service Worker — CFC Base PWA
 *
 * Vai trò:
 *  1. Precache asset (qua Workbox, manifest precache được vite-plugin-pwa inject).
 *  2. Lắng nghe `push` event → hiển thị notification trên OS (kể cả khi app đóng).
 *  3. Lắng nghe `notificationclick` → focus app đang mở hoặc mở app + deep link.
 *
 * Giữ `skipWaiting` + `clients.claim` để tương thích `registerType: 'autoUpdate'`.
 */
import { precacheAndRoute } from 'workbox-precaching';
import { resolveNotificationTarget } from './utils/notificationNavigation';

const OFFLINE_FALLBACK_URL = '/offline.html';

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

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cachedFallback = await caches.match(OFFLINE_FALLBACK_URL, { ignoreSearch: true });
        return cachedFallback || new Response('Offline', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })()
  );
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
    payload = { title: 'CFC Base', message: event.data ? event.data.text() : '' };
  }

  const title = normalizeNotificationTitle(payload);
  const body = normalizeNotificationBody(payload);
  const badgeCount = normalizeBadgeCount(payload.badgeCount ?? payload.unreadCount);
  const tag = buildNotificationTag(payload);
  const options = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag,
    renotify: true,
    lang: 'vi-VN',
    timestamp: resolveTimestamp(payload.createdAt),
    data: {
      id: payload.id,
      url: buildTargetUrl(payload),
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      type: payload.type,
      badgeCount,
    },
  };

  event.waitUntil(
    (async () => {
      await syncAppBadge(badgeCount);

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
  return resolveNotificationTarget(payload);
}

function normalizeNotificationTitle(payload) {
  const rawTitle = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (rawTitle) {
    return rawTitle;
  }

  switch (payload.type) {
    case 'BOOKING_PENDING_APPROVAL':
      return 'Yeu cau can duyet';
    case 'BOOKING_APPROVED':
      return 'Yeu cau da duoc duyet';
    case 'BOOKING_REJECTED':
      return 'Yeu cau bi tu choi';
    case 'BOOKING_CANCELLED':
      return 'Lich dat da bi huy';
    case 'BOOKING_CREATED':
      return 'Yeu cau dat lich moi';
    default:
      return 'CFC Base';
  }
}

function normalizeNotificationBody(payload) {
  const rawBody = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : typeof payload.description === 'string' && payload.description.trim()
      ? payload.description.trim()
      : '';

  if (rawBody) {
    return rawBody;
  }

  return 'Bạn có thông báo mới từ CFC Base.';
}

function normalizeBadgeCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function buildNotificationTag(payload) {
  if (payload.id) {
    return `notification:${payload.id}`;
  }
  if (payload.sourceType && payload.sourceId && payload.type) {
    return `${payload.type}:${payload.sourceType}:${payload.sourceId}`;
  }
  return `notification:${Date.now()}`;
}

function resolveTimestamp(createdAt) {
  if (!createdAt) {
    return Date.now();
  }

  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

async function syncAppBadge(count) {
  const badgeApi = self.navigator;
  if (!badgeApi || typeof badgeApi.setAppBadge !== 'function') {
    return;
  }

  try {
    if (Number.isFinite(count) && count > 0) {
      await badgeApi.setAppBadge(count);
      return;
    }

    if (typeof badgeApi.clearAppBadge === 'function') {
      await badgeApi.clearAppBadge();
      return;
    }

    await badgeApi.setAppBadge(0);
  } catch {
  }
}
