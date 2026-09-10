import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrDrawer } from './HrUi';
import { hrOcrCaptureApi } from '../../api/hrOcrCaptureApi';
import { authApi } from '../../api/authApi';
import useHrOcrCapture from '../../hooks/useHrOcrCapture';
import { capturePhonePath } from '../../utils/hrOcrCapture';
import { apiErrorMessage } from '../../utils/hr';
import HrOcrCaptureView from './HrOcrCaptureView';

export default function HrGeneralLaborCapture({ id, onSession, isOpen, onClose, onReview, disabled }) {
  const { snapshot, error, terminal, live, accept } = useHrOcrCapture(id);
  const [busy, setBusy] = useState(false);
  const createId = useRef(null);
  const notified = useRef('');
  useEffect(() => {
    if (snapshot?.status === 'READY') {
      const key = `${snapshot.id}:${snapshot.revision}`;
      if (notified.current !== key && !isOpen) toast.success('Điện thoại đã có kết quả OCR. Mở phiên chụp để kiểm tra và điền hồ sơ.');
      notified.current = key;
    }
  }, [snapshot, isOpen]);
  const action = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(apiErrorMessage(e, 'Không thể cập nhật phiên chụp.')); }
    finally { setBusy(false); }
  };
  const open = () => action(async () => {
    createId.current ||= crypto.randomUUID();
    const next = await hrOcrCaptureApi.open(createId.current);
    onSession(next.id);
    createId.current = null;
  });
  const cancel = () => action(async () => {
    if (!window.confirm('Hủy phiên và xóa toàn bộ ảnh/kết quả OCR tạm? Thông tin đã điền vào form vẫn được giữ.')) return;
    await hrOcrCaptureApi.close(id);
    onSession(null);
  });
  const url = id ? `${window.location.origin}${capturePhonePath(id)}` : '';
  return <HrDrawer isOpen={isOpen} onClose={onClose} title="Chụp bằng điện thoại — LĐ phổ thông" description="Hai thiết bị phải đăng nhập cùng tài khoản. Mỗi mã QR chỉ gắn với form này." size="wide">
    <div className="space-y-5 p-5">
      <p className="text-sm text-slate-600">Tài khoản máy tính: {authApi.getUser()?.email || 'Tài khoản đang đăng nhập'}</p>
      {!id && <Button type="button" disabled={busy || disabled} onClick={open}>Tạo mã QR ghép điện thoại</Button>}
      {id && !terminal && <div className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-4">
        <QRCodeSVG value={url} size={200} marginSize={4} title="Quét để chụp hồ sơ trên điện thoại" />
        <p className="text-center text-sm">{snapshot?.paired ? 'Điện thoại đã vào phiên chụp.' : 'Mở camera điện thoại và quét QR.'}</p>
        <Button type="button" variant="secondary" onClick={() => action(async () => {
          if (!navigator.clipboard) throw new Error('Trình duyệt không hỗ trợ sao chép. Hãy quét mã QR.');
          await navigator.clipboard.writeText(url); toast.success('Đã sao chép liên kết.');
        })}>Sao chép liên kết</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {terminal && <Button type="button" variant="secondary" disabled={disabled} onClick={() => onSession(null)}>Bỏ phiên cũ để tạo QR mới</Button>}
      <HrOcrCaptureView snapshot={snapshot} live={live} busy={busy || disabled} readOnly={terminal}
        onRemove={(imageId) => action(async () => accept(await hrOcrCaptureApi.remove(id, imageId)))}
        onScan={() => action(async () => accept(await hrOcrCaptureApi.scan(id, snapshot.revision)))} />
      {!terminal && snapshot?.status === 'READY' && <Button type="button" disabled={busy || disabled} onClick={() => action(async () => {
        const latest = await hrOcrCaptureApi.get(id);
        accept(latest);
        if (latest.status !== 'READY') { toast.error('Ảnh vừa thay đổi. Hãy đọc lại bộ ảnh mới.'); return; }
        onReview(latest.result, { id, revision: latest.revision });
      })}>Kiểm tra và điền vào hồ sơ</Button>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Ẩn bảng — tiếp tục nhận ảnh</Button>
        {id && !terminal && <Button type="button" variant="secondary" disabled={busy || disabled} onClick={cancel}>Hủy phiên chụp</Button>}
      </div>
      <p className="text-xs text-slate-500">Không gửi ảnh CCCD qua liên kết công khai. Ảnh và kết quả chỉ dùng để hỗ trợ nhập liệu, không tự lưu vào kho tài liệu nhân sự.</p>
    </div>
  </HrDrawer>;
}
