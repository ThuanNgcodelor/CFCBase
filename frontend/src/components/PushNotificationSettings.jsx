import { BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function PushNotificationSettings({ className = '' }) {
  const {
    supported,
    permission,
    subscribed,
    loading,
    error,
    needsHomeScreenInstall,
    enableNotifications,
    disableNotifications,
  } = usePushNotifications();

  const disabled = loading || !supported || permission === 'denied' || needsHomeScreenInstall;
  const title = subscribed ? 'Thông báo đẩy đang bật' : 'Thông báo đẩy';
  const message = getStatusMessage({ supported, permission, subscribed, needsHomeScreenInstall });

  const handleToggle = async () => {
    try {
      if (subscribed) {
        await disableNotifications();
      } else {
        await enableNotifications();
      }
    } catch {
      // Hook already exposes the actionable error in UI.
    }
  };

  return (
    <section className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${subscribed ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
            {subscribed ? <BellRing className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`inline-flex min-w-[7rem] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            subscribed
              ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : subscribed ? (
            <BellOff className="h-4 w-4" />
          ) : (
            <BellRing className="h-4 w-4" />
          )}
          {subscribed ? 'Tắt' : 'Bật'}
        </button>
      </div>
    </section>
  );
}

function getStatusMessage({ supported, permission, subscribed, needsHomeScreenInstall }) {
  if (!supported) {
    return 'Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.';
  }
  if (needsHomeScreenInstall) {
    return 'Trên iOS, hãy thêm PWA vào màn hình chính rồi mở từ icon để bật thông báo.';
  }
  if (permission === 'denied') {
    return 'Quyền thông báo đang bị chặn trong cài đặt trình duyệt.';
  }
  if (subscribed) {
    return 'Thiết bị này sẽ nhận thông báo khi PWA đang nền hoặc đã đóng.';
  }
  if (permission === 'granted') {
    return 'Quyền đã được cấp; bật lại để đăng ký thiết bị này.';
  }
  return 'Bật để nhận thông báo hệ điều hành cho các booking liên quan.';
}
