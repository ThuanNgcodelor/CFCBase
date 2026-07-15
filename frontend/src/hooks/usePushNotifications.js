import { useCallback, useEffect, useRef, useState } from 'react';
import { pushApi } from '../api/pushApi';

/**
 * Module-level single-flight guard cho subscribe.
 * Đảm bảo tại bất kỳ thời điểm nào chỉ có một quá trình subscribe đang chạy,
 * dù nhiều tab, re-render hay PWA lifecycle cùng gọi ensureSubscription.
 */
let _subscribeInProgress = null;

const getPermission = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
};

const isPushSupported = () => (
  typeof window !== 'undefined'
  && 'Notification' in window
  && 'serviceWorker' in navigator
  && 'PushManager' in window
);

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const getDeviceType = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const serializeSubscription = (subscription) => {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime || null,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    deviceType: getDeviceType(),
    userAgent: navigator.userAgent,
  };
};

export function usePushNotifications({ autoRegister = false } = {}) {
  const [initialized, setInitialized] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(getPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const autoRegisteredRef = useRef(false);

  const needsHomeScreenInstall = isIOS() && !isStandalone();

  const refreshState = useCallback(async () => {
    const canUsePush = isPushSupported();
    setSupported(canUsePush);
    setPermission(getPermission());

    if (!canUsePush) {
      setSubscribed(false);
      setInitialized(true);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(subscription));
    } catch {
      setSubscribed(false);
    } finally {
      setInitialized(true);
    }
  }, []);

  const _doEnsureSubscription = useCallback(async ({ promptForPermission }) => {
    if (!isPushSupported()) {
      throw new Error('Trình duyệt không hỗ trợ thông báo đẩy.');
    }
    if (needsHomeScreenInstall) {
      throw new Error('Trên iOS, hãy thêm CFC Booking vào màn hình chính rồi mở từ icon đó.');
    }

    let currentPermission = getPermission();
    if (currentPermission === 'default' && promptForPermission) {
      currentPermission = await window.Notification.requestPermission();
    }
    if (currentPermission !== 'granted') {
      setPermission(currentPermission);
      if (currentPermission === 'default') return false;
      throw new Error('Quyền thông báo đang bị chặn.');
    }

    setPermission(currentPermission);
    const publicKey = await pushApi.getVapidPublicKey();
    if (!publicKey) {
      throw new Error('Backend chưa cấu hình VAPID public key.');
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    const expectedKey = urlBase64ToUint8Array(publicKey);

    if (subscription) {
      const currentKey = subscription.options.applicationServerKey;
      let keyMismatch = false;
      if (currentKey) {
        const currentKeyArray = new Uint8Array(currentKey);
        if (currentKeyArray.length !== expectedKey.length) {
          keyMismatch = true;
        } else {
          for (let i = 0; i < currentKeyArray.length; i++) {
            if (currentKeyArray[i] !== expectedKey[i]) {
              keyMismatch = true;
              break;
            }
          }
        }
      } else {
        keyMismatch = true;
      }

      if (keyMismatch) {
        await pushApi.unsubscribe(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKey,
      });
    }

    await pushApi.subscribe(serializeSubscription(subscription));
    setSubscribed(true);
    return true;
  }, [needsHomeScreenInstall]);

  /**
   * Single-flight wrapper: nếu đang có một quá trình subscribe chạy (từ tab khác,
   * re-render, hay PWA lifecycle), trả về cùng promise thay vì gửi request mới.
   * Reset _subscribeInProgress về null sau khi promise settle (success hoặc error).
   */
  const ensureSubscription = useCallback(async (opts) => {
    if (_subscribeInProgress) {
      return _subscribeInProgress;
    }
    _subscribeInProgress = _doEnsureSubscription(opts).finally(() => {
      _subscribeInProgress = null;
    });
    return _subscribeInProgress;
  }, [_doEnsureSubscription]);

  const enableNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ok = await ensureSubscription({ promptForPermission: true });
      await refreshState();
      return ok;
    } catch (err) {
      setError(err.message || 'Không thể bật thông báo đẩy.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ensureSubscription, refreshState]);

  const disableNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const { endpoint } = subscription;
        await pushApi.unsubscribe(endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err.message || 'Không thể tắt thông báo đẩy.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'hidden') {
        refreshState();
      }
    };

    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!autoRegister || autoRegisteredRef.current || needsHomeScreenInstall) return;
    if (!supported || permission !== 'granted' || subscribed) return;

    autoRegisteredRef.current = true;
    ensureSubscription({ promptForPermission: false })
      .catch(() => {})
      .finally(refreshState);
  }, [autoRegister, ensureSubscription, needsHomeScreenInstall, permission, refreshState, subscribed, supported]);

  return {
    initialized,
    supported,
    permission,
    subscribed,
    loading,
    error,
    needsHomeScreenInstall,
    enableNotifications,
    disableNotifications,
    refreshState,
  };
}
