import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import HrOcrCaptureView from '../../components/hr/HrOcrCaptureView';
import { hrOcrCaptureApi } from '../../api/hrOcrCaptureApi';
import { authApi } from '../../api/authApi';
import useHrOcrCapture from '../../hooks/useHrOcrCapture';
import { isCaptureId, prepareCaptureImage, ocrLoginPath, captureKindLabel } from '../../utils/hrOcrCapture';
import { apiErrorMessage } from '../../utils/hr';

export default function HrGeneralLaborCapturePhone() {
  const { id } = useParams();
  const { snapshot, error, terminal, live, accept } = useHrOcrCapture(isCaptureId(id) ? id : null);
  const [kind, setKind] = useState('FRONT');
  const [pending, setPending] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const camera = useRef(null);
  const gallery = useRef(null);
  useEffect(() => {
    if (terminal || ['COMPLETED', 'CANCELLED'].includes(snapshot?.status)) setPending(null);
  }, [terminal, snapshot?.status]);
  useEffect(() => {
    if (!isCaptureId(id)) return undefined;
    let stopped = false;
    hrOcrCaptureApi.pair(id).then((s) => { if (!stopped) accept(s); })
      .catch((e) => { if (!stopped) setLocalError(apiErrorMessage(e, 'Chưa ghép được điện thoại.')); });
    return () => { stopped = true; };
  }, [id, accept]);
  useEffect(() => {
    if (!pending) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(pending.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);
  const action = async (fn) => {
    if (busy) return;
    setBusy(true); setLocalError('');
    try { await fn(); } catch (e) { setLocalError(apiErrorMessage(e, e.message || 'Không thể gửi ảnh.')); }
    finally { setBusy(false); }
  };
  const choose = (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    void action(async () => setPending({ file: await prepareCaptureImage(file), kind, clientId: crypto.randomUUID() }));
  };
  const closed = terminal || ['COMPLETED', 'CANCELLED'].includes(snapshot?.status);
  return <main className="cfc-safe-top cfc-safe-bottom mx-auto min-h-screen max-w-2xl space-y-5 bg-white px-4 py-6">
    <h1 className="text-xl font-semibold">Chụp hồ sơ LĐ phổ thông</h1>
    <p className="text-sm text-slate-600">Tài khoản điện thoại: {authApi.getUser()?.email || 'Tài khoản đang đăng nhập'}</p>
    <p className="text-sm text-slate-600">Ảnh sẽ chuyển tới đúng form đã tạo QR trên máy tính. Chỉ chụp giấy tờ của một người trong phiên này.</p>
    {(error || localError || !isCaptureId(id)) && <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <p>{error || localError || 'Mã phiên không hợp lệ.'}</p>
      {terminal && <p>Nếu sai tài khoản, hãy đăng xuất rồi đăng nhập đúng tài khoản của máy tính và quét lại QR. Nếu phiên hết hạn, tạo QR mới.</p>}
      <Link className="underline" to={ocrLoginPath(window.location.pathname)}>Kiểm tra đăng nhập</Link>
      {terminal && <Button type="button" variant="secondary" disabled={busy} onClick={() => action(async () => {
        await authApi.logout();
        window.location.href = ocrLoginPath(window.location.pathname);
      })}>Đăng xuất điện thoại để đổi tài khoản</Button>}
    </div>}
    {!closed && snapshot && <>
      <label className="block text-sm font-medium">Loại giấy tờ
        <select className="mt-2 w-full rounded-lg border border-slate-300 p-3" value={kind} disabled={busy || !!pending} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(captureKindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={choose} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={choose} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => camera.current.click()}>{pending ? 'Chụp lại' : 'Mở camera'}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => gallery.current.click()}>Chọn ảnh có sẵn</Button>
      </div>
      {pending && <div className="space-y-3 rounded-xl border border-emerald-300 p-3">
        <p className="text-sm">Kiểm tra ảnh trước khi gửi · {captureKindLabel[pending.kind]}</p>
        {preview && <img src={preview} alt="Ảnh chuẩn bị gửi" className="max-h-80 w-full object-contain" />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => action(async () => {
            accept(await hrOcrCaptureApi.upload(id, pending));
            setPending(null);
            if (pending.kind === 'FRONT') setKind('BACK');
            toast.success('Đã gửi ảnh tới máy tính.');
          })}>{busy ? 'Đang xử lý…' : 'Gửi ảnh lên máy tính'}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setPending(null)}>Bỏ ảnh chưa gửi</Button>
        </div>
        <p className="text-xs text-slate-500">Gửi lại sau khi mất mạng không tạo ảnh trùng. Gửi lại cùng mặt CCCD sẽ thay ảnh cũ.</p>
      </div>}
    </>}
    <HrOcrCaptureView snapshot={snapshot} live={live} busy={busy || !!pending} readOnly={closed}
      onRemove={(imageId) => action(async () => accept(await hrOcrCaptureApi.remove(id, imageId)))}
      onScan={() => action(async () => accept(await hrOcrCaptureApi.scan(id, snapshot.revision)))} />
    {snapshot?.status === 'READY' && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Đã chuyển kết quả OCR. Hãy kiểm tra và áp dụng trên máy tính.</p>}
    {!closed && snapshot && <Button type="button" variant="secondary" disabled={busy} onClick={() => {
      if (window.confirm('Hủy phiên chụp và xóa ảnh tạm trên cả hai thiết bị?')) void action(async () => { accept(await hrOcrCaptureApi.close(id)); setPending(null); });
    }}>Hủy phiên chụp</Button>}
    <Link to="/manager/hr/general-labor" className="block text-sm text-blue-700 underline">Về LĐ phổ thông</Link>
  </main>;
}
