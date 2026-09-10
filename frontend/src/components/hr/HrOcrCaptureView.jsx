import { useEffect, useState } from 'react';
import { hrOcrCaptureApi } from '../../api/hrOcrCaptureApi';
import { Button } from '../ui/Button';
import { captureKindLabel, captureStatusLabel } from '../../utils/hrOcrCapture';

function PrivateImage({ sessionId, item }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setUrl(''); setError(false);
    hrOcrCaptureApi.image(sessionId, item.id, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [sessionId, item.id, retry]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={captureKindLabel[item.kind]} className="h-36 w-full object-contain" /></a>
    : <div className="flex h-36 items-center justify-center text-sm">{error ? <Button type="button" variant="secondary" onClick={() => setRetry((v) => v + 1)}>Tải lại ảnh</Button> : 'Đang tải ảnh…'}</div>;
}

export default function HrOcrCaptureView({ snapshot, live, busy, onRemove, onScan, readOnly = false }) {
  if (!snapshot) return null;
  const closed = ['CANCELLED', 'COMPLETED'].includes(snapshot.status);
  return <div className="space-y-3">
    <p role="status" className="text-sm text-slate-600">{captureStatusLabel[snapshot.status]} · {live ? 'Đã kết nối realtime' : 'Đồng bộ dự phòng mỗi 5 giây'} · {snapshot.images.length}/6 ảnh</p>
    {snapshot.error && <p role="alert" className="text-sm text-red-700">{snapshot.error}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {snapshot.images.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3">
        <PrivateImage sessionId={snapshot.id} item={item} />
        <div className="mt-2 flex items-center justify-between gap-2 text-sm"><span>{captureKindLabel[item.kind]}</span>
          {!closed && !readOnly && <Button type="button" variant="secondary" disabled={busy} onClick={() => onRemove(item.id)}>Bỏ ảnh</Button>}
        </div>
      </div>)}
    </div>
    {!closed && !readOnly && <Button type="button" onClick={onScan} disabled={busy || !snapshot.images.length || ['SCANNING', 'READY'].includes(snapshot.status)}>
      {snapshot.status === 'SCANNING' ? 'Đang đọc…' : 'Chụp xong — Đọc thông tin'}
    </Button>}
    <p className="text-xs text-slate-500">Ảnh chỉ lưu tạm đến {new Date(snapshot.expiresAt).toLocaleTimeString('vi-VN')}. Không tự tạo hoặc lưu hồ sơ nhân sự.</p>
  </div>;
}
