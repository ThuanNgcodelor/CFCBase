import { AlertCircle, FileSearch, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="state-panel state-panel--compact" role="status">
      <LoaderCircle className="state-panel__spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description = 'Dữ liệu phù hợp sẽ xuất hiện tại đây.',
  action
}) {
  return (
    <div className="state-panel">
      <div className="state-panel__illustration" aria-hidden="true">
        <FileSearch />
        <span />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="state-panel__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertCircle aria-hidden="true" />
      <h2>Không thể tải dữ liệu</h2>
      <p>{message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />Thử lại
        </Button>
      ) : null}
    </div>
  );
}
