import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, RefreshCw, ShieldCheck } from 'lucide-react';

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

function shouldRequireMobilePwaPush() {
  return isStandalonePwa() && (isIOS() || isAndroid());
}

export default function RequiredPushNotificationGate({ pushState }) {
  const [required, setRequired] = useState(false);
  const [actionError, setActionError] = useState('');

  const {
    initialized,
    supported,
    permission,
    subscribed,
    loading,
    error,
    enableNotifications,
    refreshState,
  } = pushState;

  useEffect(() => {
    setRequired(shouldRequireMobilePwaPush());
  }, []);

  const isReady = initialized && permission === 'granted' && subscribed;
  if (!required || !initialized || isReady) {
    return null;
  }

  const denied = permission === 'denied';
  const canPrompt = supported && !denied;
  const title = getTitle({ supported, denied, permission });
  const message = getMessage({ supported, denied, permission });

  const handleEnable = async () => {
    setActionError('');
    try {
      await enableNotifications();
    } catch (err) {
      setActionError(err.message || 'Không thể bật thông báo lúc này.');
    }
  };

  const handleRefresh = async () => {
    setActionError('');
    await refreshState();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="required-push-title"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            {denied || !supported ? <AlertTriangle className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
          </div>

          <div className="min-w-0">
            <h2 id="required-push-title" className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-800">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Thông báo là bắt buộc trong PWA để không bỏ lỡ booking, duyệt hoặc từ chối yêu cầu.</span>
          </div>
        </div>

        {(actionError || error) && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError || error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Kiểm tra lại
          </button>

          {canPrompt && (
            <button
              type="button"
              onClick={handleEnable}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <BellRing className="h-4 w-4" />
              {loading ? 'Đang bật...' : permission === 'granted' ? 'Đăng ký thiết bị' : 'Bật thông báo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getTitle({ supported, denied, permission }) {
  if (!supported) {
    return 'Thiết bị chưa hỗ trợ thông báo';
  }
  if (denied) {
    return 'Thông báo đang bị chặn';
  }
  if (permission === 'granted') {
    return 'Cần đăng ký thiết bị';
  }
  return 'Cần bật thông báo';
}

function getMessage({ supported, denied, permission }) {
  if (!supported) {
    return 'PWA này cần Web Push để hoạt động đầy đủ. Hãy cập nhật hệ điều hành hoặc mở bằng trình duyệt hỗ trợ thông báo đẩy.';
  }
  if (denied) {
    return 'Bạn đã chặn quyền thông báo. Hãy mở cài đặt ứng dụng hoặc trình duyệt, cho phép thông báo cho CFC Base, rồi quay lại bấm Kiểm tra lại.';
  }
  if (permission === 'granted') {
    return 'Quyền thông báo đã được cấp, nhưng thiết bị này chưa đăng ký nhận push. Hãy đăng ký thiết bị để tiếp tục.';
  }
  return 'Hãy cho phép CFC Base gửi thông báo trên thiết bị này để tiếp tục sử dụng app.';
}
