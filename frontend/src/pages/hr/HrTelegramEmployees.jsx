import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, MessageCircle, PlugZap, Printer, RefreshCw, Save, ShieldCheck, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrTelegramApi } from '../../api/hrTelegramApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime } from '../../utils/hr';

const STATUS_LABELS = {
  STARTED: 'Đã bấm Start',
  PHONE_RECEIVED: 'Đã nhận số',
  CODE_RECEIVED: 'Đã nhận mã',
  PENDING_REVIEW: 'Chờ xác minh',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Từ chối',
  REVOKED: 'Đã thu hồi',
  BLOCKED: 'Đã khóa',
  NOT_REGISTERED: 'Chưa đăng ký',
};

function statusLabel(status) { return STATUS_LABELS[status] || status || 'Chưa đăng ký'; }

export default function HrTelegramEmployees() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ botUsername: '', enabled: false });
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [viewMode, setViewMode] = useState('registrations');
  const [keyword, setKeyword] = useState('');
  const [registrations, setRegistrations] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const [nextSettings, nextSummary, nextRegistrations] = await Promise.all([
      hrTelegramApi.getSettings(),
      hrTelegramApi.getSummary(),
      viewMode === 'employees'
        ? hrTelegramApi.getEmployeeStatuses({ page, size: 20, status: status || undefined, keyword: keyword.trim() || undefined })
        : hrTelegramApi.getRegistrations({ page, size: 20, status: status || undefined, keyword: keyword.trim() || undefined }),
    ]);
    setSettings(nextSettings);
    setForm({ botUsername: nextSettings.botUsername || '', enabled: Boolean(nextSettings.enabled) });
    setSummary(nextSummary);
    setRegistrations(normalizePage(nextRegistrations));
  }, [keyword, page, status, viewMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load().catch((requestError) => {
      if (active) setError(apiErrorMessage(requestError, 'Không thể tải dữ liệu Telegram nhân viên.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, reloadKey]);

  const commonLink = useMemo(() => {
    const username = String(settings?.botUsername || '').trim().replace(/^@/, '');
    return username ? `https://t.me/${username}?start=register` : '';
  }, [settings?.botUsername]);

  const selectStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(0);
  };

  const selectView = (nextView) => {
    setViewMode(nextView);
    setStatus('');
    setPage(0);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await hrTelegramApi.updateSettings(form);
      setSettings(updated);
      setForm({ botUsername: updated.botUsername || '', enabled: Boolean(updated.enabled) });
      toast.success('Đã lưu cấu hình Telegram.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu cấu hình Telegram.'));
    } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await hrTelegramApi.testConnection();
      toast.success(result?.status === 'OK' ? 'Bot Telegram đang kết nối tốt.' : 'Chưa kết nối được bot. Kiểm tra token và webhook.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể kiểm tra kết nối bot.'));
    } finally { setTesting(false); }
  };

  const copyLink = async () => {
    if (!commonLink) return;
    try {
      await navigator.clipboard.writeText(commonLink);
      toast.success('Đã sao chép liên kết đăng ký.');
    } catch {
      toast.error('Không thể sao chép tự động. Hãy bôi đen và sao chép liên kết bên dưới.');
    }
  };

  const review = async (item, action) => {
    const note = action === 'reject' ? window.prompt('Lý do từ chối (có thể bỏ trống):', '') : '';
    if (action === 'reject' && note === null) return;
    if (action === 'verify' && !window.confirm(`Xác minh tài khoản Telegram cho ${item.employeeName || item.employeeCode}?`)) return;
    setBusyId(item.id);
    try {
      if (action === 'verify') await hrTelegramApi.verify(item.id);
      else await hrTelegramApi.reject(item.id, note || '');
      toast.success(action === 'verify' ? 'Đã xác minh đăng ký.' : 'Đã từ chối đăng ký.');
      setReloadKey((value) => value + 1);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể cập nhật đăng ký.')); }
    finally { setBusyId(''); }
  };

  const revoke = async (item) => {
    if (!item.employeeId || !window.confirm(`Thu hồi liên kết Telegram của ${item.employeeName || item.employeeCode}?`)) return;
    setBusyId(item.id);
    try {
      await hrTelegramApi.revoke(item.employeeId, 'Thu hồi từ màn hình HR');
      toast.success('Đã thu hồi liên kết Telegram.');
      setReloadKey((value) => value + 1);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể thu hồi liên kết.')); }
    finally { setBusyId(''); }
  };

  if (loading && !settings) return <HrPageShell size="standard"><HrLoading label="Đang tải cấu hình Telegram..." /></HrPageShell>;
  if (error && !settings) return <HrPageShell size="standard"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></HrPageShell>;

  return (
    <HrPageShell size="wide">
      <SEOHead title="CFC Base | Telegram nhân viên" url="https://cfcbooking.io.vn/manager/hr/telegram" />
      <HrPageHeader
        title="Telegram nhân viên"
        description="Nhân viên quét QR chung, bấm Start, chia sẻ số điện thoại và nhập Mã nhân viên. HR xác minh trước khi gửi phiếu lương."
        actions={<Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="mr-1.5 h-4 w-4" />Tải lại</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><MessageCircle className="h-5 w-5" /></div><div><h2 className="font-semibold text-gray-900">Cấu hình bot</h2><p className="text-sm text-gray-500">Token bot được giữ ở backend, không hiển thị trên web.</p></div></div>
          <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Bot username</span><input value={form.botUsername} onChange={(event) => setForm((current) => ({ ...current, botUsername: event.target.value }))} placeholder="PhieuLuongThang_bot" className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label>
            <label className="flex h-10 items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} /> Cho phép đăng ký</label>
            <Button type="button" variant="secondary" disabled={testing} onClick={testConnection}><PlugZap className="mr-1.5 h-4 w-4" />{testing ? 'Đang kiểm tra...' : 'Kiểm tra bot'}</Button>
            <Button type="submit" disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500"><span>Bot token: {settings?.botTokenConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span><span>Webhook secret: {settings?.webhookSecretConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span><span>Trạng thái: {settings?.enabled ? 'Đang bật' : 'Đang tắt'}</span></div>
        </section>
        <section className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm"><h2 className="font-semibold text-gray-900">QR đăng ký dùng chung</h2>{commonLink ? <QRCodeSVG value={commonLink} size={190} includeMargin /> : <p className="mt-4 text-sm text-gray-500">Nhập username bot để tạo QR.</p>}<p className="mt-2 text-sm font-medium text-gray-700">Quét mã → bấm Start → làm theo hướng dẫn</p><p className="mt-2 break-all text-[11px] text-gray-400">{commonLink || '—'}</p>{commonLink && <div className="mt-3 flex flex-wrap justify-center gap-2"><Button type="button" size="sm" onClick={() => window.open(commonLink, '_blank', 'noopener,noreferrer')}><ExternalLink className="mr-1 h-4 w-4" />Mở Telegram</Button><Button type="button" size="sm" variant="secondary" onClick={copyLink}><Copy className="mr-1 h-4 w-4" />Sao chép link</Button><Button type="button" size="sm" variant="secondary" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />In QR</Button></div>}</section>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ['', 'Tất cả đăng ký', summary?.total], ['PENDING_REVIEW', 'Chờ xác minh', summary?.pendingReview], ['VERIFIED', 'Đã xác minh', summary?.verified], ['REJECTED', 'Từ chối', summary?.rejected], ['REVOKED', 'Đã thu hồi', summary?.revoked],
      ].map(([cardStatus, label, value]) => <button type="button" key={label} onClick={() => selectStatus(cardStatus)} className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow ${status === cardStatus ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 bg-white'}`}><p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value ?? '—'}</p><p className="mt-1 text-xs text-gray-500">Bấm để xem danh sách</p></button>)}</div>

      <section className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-4"><div><h2 className="font-semibold text-gray-900">{viewMode === 'employees' ? 'Toàn bộ nhân viên' : 'Danh sách đăng ký'}</h2><p className="text-sm text-gray-500">{viewMode === 'employees' ? 'Theo dõi trạng thái Telegram của từng nhân viên đang làm việc.' : 'Chỉ hồ sơ đã được HR xác minh mới đủ điều kiện nhận phiếu lương.'}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={viewMode === 'employees' ? 'primary' : 'secondary'} onClick={() => selectView('employees')}>Toàn bộ nhân viên</Button><Button type="button" size="sm" variant={viewMode === 'registrations' ? 'primary' : 'secondary'} onClick={() => selectView('registrations')}>Lượt đăng ký</Button><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(0); setReloadKey((value) => value + 1); } }} placeholder="Tìm mã, tên, số điện thoại" className="h-10 rounded-lg border border-gray-300 px-3 text-sm" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="h-10 rounded-lg border border-gray-300 px-3 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).filter(([value]) => viewMode === 'employees' || value !== 'NOT_REGISTERED').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button type="button" variant="secondary" onClick={() => hrTelegramApi.exportRegistrations(viewMode === 'employees' ? undefined : status || undefined)}><Download className="mr-1.5 h-4 w-4" />Xuất Excel đăng ký</Button></div></div>
        <div className="overflow-x-auto"><table className="min-w-[1120px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Mã NV</th><th className="px-4 py-3">Họ tên</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Telegram</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Đăng ký / duyệt</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{registrations.content.map((item) => <tr key={item.id || item.employeeId}><td className="px-4 py-3 font-semibold text-gray-900">{item.employeeCode || '—'}</td><td className="px-4 py-3">{item.employeeName || 'Chưa xác định'}</td><td className="px-4 py-3">{item.phoneNumber || '—'}</td><td className="px-4 py-3 text-xs text-gray-500">{item.telegramUsername ? `@${item.telegramUsername}` : item.telegramUserId || '—'}</td><td className="px-4 py-3"><HrStatusBadge status={item.status} label={statusLabel(item.status)} />{item.reviewNote && <p className="mt-1 max-w-xs truncate text-xs text-gray-500" title={item.reviewNote}>Ghi chú: {item.reviewNote}</p>}</td><td className="px-4 py-3 text-xs text-gray-500"><div>{formatHrDateTime(item.createdAt || item.registeredAt)}</div>{item.reviewedAt && <div className="mt-1 text-emerald-700">Duyệt: {formatHrDateTime(item.reviewedAt)}</div>}{item.reviewedByActor && <div className="truncate" title={item.reviewedByActor}>Bởi: {item.reviewedByActor}</div>}</td><td className="px-4 py-3"><div className="flex gap-2">{viewMode === 'registrations' && item.status === 'PENDING_REVIEW' && <><Button type="button" size="sm" disabled={busyId === item.id} onClick={() => review(item, 'verify')}><ShieldCheck className="mr-1 h-4 w-4" />Xác minh</Button><Button type="button" size="sm" variant="danger" disabled={busyId === item.id} onClick={() => review(item, 'reject')}><XCircle className="mr-1 h-4 w-4" />Từ chối</Button></>}{viewMode === 'registrations' && item.status === 'VERIFIED' && <Button type="button" size="sm" variant="danger" disabled={busyId === item.id} onClick={() => revoke(item)}>Thu hồi</Button>}</div></td></tr>)}</tbody></table></div>
        {!loading && registrations.content.length === 0 && <div className="p-8"><HrEmpty title={status ? `Không có hồ sơ ${statusLabel(status).toLowerCase()}` : viewMode === 'employees' ? 'Chưa có nhân viên đang làm việc' : 'Chưa có lượt đăng ký'} description={status ? 'Hãy chọn “Tất cả trạng thái” để xem các hồ sơ khác.' : viewMode === 'employees' ? 'Danh sách sẽ hiển thị nhân viên có trạng thái Telegram.' : 'Khi nhân viên hoàn tất Start, chia sẻ số điện thoại và nhập mã, hồ sơ sẽ xuất hiện ở đây.'} /></div>}
        <HrPagination page={registrations.number} totalPages={registrations.totalPages} totalElements={registrations.totalElements} onPageChange={setPage} />
      </section>
    </HrPageShell>
  );
}
