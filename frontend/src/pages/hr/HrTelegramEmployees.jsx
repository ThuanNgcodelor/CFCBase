import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Check, Clock3, Copy, Download, ExternalLink, MessageCircle, PlugZap, Printer, RefreshCw, Save, Settings2, ShieldCheck, Users, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrDrawer, HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
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
  const [status, setStatus] = useState('VERIFIED');
  const [viewMode, setViewMode] = useState('employees');
  const [keyword, setKeyword] = useState('');
  const [registrations, setRegistrations] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const selectStatus = (nextStatus, nextView = viewMode) => {
    setViewMode(nextView);
    setStatus(nextStatus);
    setPage(0);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await hrTelegramApi.updateSettings(form);
      setSettings(updated);
      setForm({ botUsername: updated.botUsername || '', enabled: Boolean(updated.enabled) });
      setSettingsOpen(false);
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
    setBusyId(item.id || item.employeeId);
    try {
      if (action === 'verify') await hrTelegramApi.verify(item.id);
      else await hrTelegramApi.reject(item.id, note || '');
      toast.success(action === 'verify' ? 'Đã xác minh đăng ký.' : 'Đã từ chối đăng ký.');
      setReloadKey((value) => value + 1);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể cập nhật đăng ký.')); }
    finally { setBusyId(''); }
  };

  const revoke = async () => {
    const item = revokeTarget;
    const reason = revokeReason.trim();
    if (!item?.employeeId) return;
    if (!reason) {
      toast.error('Vui lòng nhập lý do thu hồi liên kết.');
      return;
    }
    setBusyId(item.id || item.employeeId);
    try {
      await hrTelegramApi.revoke(item.employeeId, reason);
      toast.success('Đã ngắt liên kết. Nhân viên sẽ không nhận các phiếu lương gửi sau thao tác này.');
      setRevokeTarget(null);
      setRevokeReason('');
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
        description="Quản lý đăng ký, xác minh và trạng thái nhận phiếu lương Telegram của nhân viên."
        actions={<><Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}><Settings2 className="h-4 w-4" />Cấu hình bot</Button><Button type="button" variant="secondary" size="icon" title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="h-4 w-4" /></Button></>}
      />

      <section className="grid overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}><Bot className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-900">{settings?.enabled ? 'Bot đang nhận đăng ký' : 'Bot đang tạm dừng đăng ký'}</h2><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${settings?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${settings?.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />{settings?.enabled ? 'Đang hoạt động' : 'Đang tắt'}</span></div><p className="mt-1 text-sm text-gray-500">@{String(settings?.botUsername || 'chưa_cấu_hình').replace(/^@/, '')}</p></div></div><Button type="button" size="sm" variant="secondary" disabled={testing} onClick={testConnection}><PlugZap className="h-4 w-4" />{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</Button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{[[MessageCircle, '1. Nhân viên', 'Quét QR và bấm Start'], [Users, '2. Khai báo', 'Chia sẻ SĐT và mã NV'], [ShieldCheck, '3. HR xác minh', 'Cho phép nhận phiếu lương']].map(([Icon, title, text]) => <div key={title} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><Icon className="h-4 w-4 text-emerald-700" /><b className="mt-2 block text-sm text-gray-900">{title}</b><span className="mt-1 block text-xs leading-5 text-gray-500">{text}</span></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs"><ConfigState ok={settings?.botTokenConfigured} label="Bot token" /><ConfigState ok={settings?.webhookSecretConfigured} label="Webhook" /><ConfigState ok={settings?.enabled} label="Đăng ký" /></div>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/70 p-5 xl:border-l xl:border-t-0"><div className="flex items-center gap-4"><div className="shrink-0 rounded-xl border border-gray-200 bg-white p-2">{commonLink ? <QRCodeSVG value={commonLink} size={126} /> : <div className="flex h-[126px] w-[126px] items-center justify-center text-center text-xs text-gray-400">Chưa có QR</div>}</div><div className="min-w-0"><h2 className="font-semibold text-gray-900">QR đăng ký dùng chung</h2><p className="mt-1 text-sm leading-5 text-gray-500">Gửi mã này cho nhân viên. Mỗi người tự đăng ký trên Telegram.</p><div className="mt-3 flex flex-wrap gap-2">{commonLink && <><Button type="button" size="sm" onClick={() => window.open(commonLink, '_blank', 'noopener,noreferrer')}><ExternalLink className="h-4 w-4" />Mở bot</Button><Button type="button" size="sm" variant="secondary" onClick={copyLink}><Copy className="h-4 w-4" />Sao chép</Button><Button type="button" size="sm" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />In QR</Button></>}</div></div></div></div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ['', 'Tất cả đăng ký', summary?.total, 'registrations'],
        ['PENDING_REVIEW', 'Chờ xác minh', summary?.pendingReview, 'registrations'],
        ['VERIFIED', 'Đang liên kết', summary?.verified, 'employees'],
        ['REJECTED', 'Từ chối', summary?.rejected, 'registrations'],
        ['REVOKED', 'Đã thu hồi', summary?.revoked, 'employees'],
      ].map(([cardStatus, label, value, cardView]) => <button type="button" key={label} onClick={() => selectStatus(cardStatus, cardView)} className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow ${status === cardStatus && viewMode === cardView ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 bg-white'}`}><p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value ?? '—'}</p><p className="mt-1 text-xs text-gray-500">Bấm để xem danh sách</p></button>)}</div>

      <section className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5"><div><h2 className="font-semibold text-gray-900">Quản lý tài khoản nhận lương</h2><p className="mt-1 text-sm text-gray-500">Xác minh đăng ký mới, kiểm tra người đang liên kết hoặc tra cứu lịch sử.</p></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant={viewMode === 'registrations' && status === 'PENDING_REVIEW' ? 'primary' : 'secondary'} onClick={() => selectStatus('PENDING_REVIEW', 'registrations')}><Clock3 className="h-4 w-4" />Cần xác minh ({summary?.pendingReview ?? 0})</Button><Button type="button" size="sm" variant={viewMode === 'employees' && status === 'VERIFIED' ? 'primary' : 'secondary'} onClick={() => selectStatus('VERIFIED', 'employees')}><Users className="h-4 w-4" />Đang liên kết ({summary?.verified ?? 0})</Button><Button type="button" size="sm" variant={viewMode === 'registrations' && status === '' ? 'primary' : 'secondary'} onClick={() => selectStatus('', 'registrations')}><Clock3 className="h-4 w-4" />Lịch sử ({summary?.total ?? 0})</Button></div></div>
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 p-4 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(0); setReloadKey((value) => value + 1); } }} placeholder="Tìm mã nhân viên, họ tên hoặc số điện thoại" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).filter(([value]) => viewMode === 'employees' || !['NOT_REGISTERED', 'REVOKED'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button type="button" size="sm" variant="secondary" onClick={() => hrTelegramApi.exportRegistrations(viewMode === 'employees' ? undefined : status || undefined)}><Download className="h-4 w-4" />Xuất Excel</Button></div>
        <div className="max-h-[640px] overflow-auto">
          <table className="min-w-[1040px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_#e5e7eb]"><tr><th className="px-5 py-3">Nhân viên</th><th className="px-4 py-3">Liên hệ</th><th className="px-4 py-3">Telegram</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thời gian xử lý</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{registrations.content.map((item) => <tr key={item.id || item.employeeId} className="transition hover:bg-gray-50">
              <td className="px-5 py-3"><b className="block text-gray-900">{item.employeeCode || 'Chưa có mã NV'}</b><span className="text-xs text-gray-500">{item.employeeName || 'Chưa xác định nhân viên'}</span></td>
              <td className="px-4 py-3">{item.phoneNumber || '—'}</td>
              <td className="px-4 py-3"><span className="block text-gray-700">{item.telegramUsername ? `@${item.telegramUsername}` : 'Không có username'}</span><span className="text-xs text-gray-400">ID: {item.telegramUserId || '—'}</span></td>
              <td className="px-4 py-3"><HrStatusBadge status={item.status} label={statusLabel(item.status)} />{item.reviewNote && <p className="mt-1 max-w-xs truncate text-xs text-gray-500" title={item.reviewNote}>Ghi chú: {item.reviewNote}</p>}{item.revokedReason && <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={item.revokedReason}>Thu hồi: {item.revokedReason}</p>}</td>
              <td className="px-4 py-3 text-xs text-gray-500"><div>Đăng ký: {formatHrDateTime(item.createdAt || item.registeredAt)}</div>{item.reviewedAt && <div className="mt-1 text-emerald-700">Xác minh: {formatHrDateTime(item.reviewedAt)}</div>}{item.revokedAt && <div className="mt-1 text-red-600">Thu hồi: {formatHrDateTime(item.revokedAt)}</div>}</td>
              <td className="px-5 py-3 text-right"><div className="inline-flex gap-2">{viewMode === 'registrations' && item.status === 'PENDING_REVIEW' && <><Button type="button" size="sm" disabled={busyId === item.id} onClick={() => review(item, 'verify')}><ShieldCheck className="h-4 w-4" />Xác minh</Button><Button type="button" size="sm" variant="secondary" disabled={busyId === item.id} onClick={() => review(item, 'reject')}><XCircle className="h-4 w-4 text-red-600" />Từ chối</Button></>}{viewMode === 'employees' && item.status === 'VERIFIED' && <Button type="button" size="sm" variant="secondary" disabled={busyId === (item.id || item.employeeId)} onClick={() => { setRevokeTarget(item); setRevokeReason(''); }}><XCircle className="h-4 w-4 text-red-600" />Ngắt liên kết</Button>}{viewMode === 'employees' && item.status === 'REVOKED' && <span className="text-xs text-gray-500">Chờ đăng ký lại qua Start</span>}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!loading && registrations.content.length === 0 && <div className="p-8"><HrEmpty title={status ? `Không có hồ sơ ${statusLabel(status).toLowerCase()}` : viewMode === 'employees' ? 'Chưa có nhân viên đang làm việc' : 'Chưa có lượt đăng ký'} description={status ? 'Hãy chọn “Tất cả trạng thái” để xem các hồ sơ khác.' : viewMode === 'employees' ? 'Danh sách sẽ hiển thị nhân viên có trạng thái Telegram.' : 'Khi nhân viên hoàn tất Start, chia sẻ số điện thoại và nhập mã, hồ sơ sẽ xuất hiện ở đây.'} /></div>}
        <HrPagination page={registrations.number} totalPages={registrations.totalPages} totalElements={registrations.totalElements} onPageChange={setPage} />
      </section>

      <HrDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Cấu hình bot Telegram" description="Thiết lập bot dùng chung để nhân viên đăng ký nhận phiếu lương.">
        <form onSubmit={saveSettings} className="space-y-6 p-5 sm:p-7">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">Token bot và webhook secret được quản lý an toàn ở backend, không hiển thị hoặc thay đổi trên màn hình này.</div>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-gray-700">Bot username</span><input value={form.botUsername} onChange={(event) => setForm((current) => ({ ...current, botUsername: event.target.value }))} placeholder="PhieuLuongThang_bot" className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /><span className="mt-1.5 block text-xs text-gray-500">Có thể nhập có hoặc không có ký tự @.</span></label>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 p-4"><span><b className="block text-sm text-gray-900">Cho phép nhân viên đăng ký</b><span className="mt-1 block text-xs leading-5 text-gray-500">Khi tắt, QR vẫn tồn tại nhưng bot không tiếp nhận đăng ký mới.</span></span><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} className="mt-1 h-5 w-5 accent-emerald-600" /></label>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-gray-200 p-4"><span className="text-xs text-gray-500">Bot token</span><ConfigState ok={settings?.botTokenConfigured} label={settings?.botTokenConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'} /></div><div className="rounded-xl border border-gray-200 p-4"><span className="text-xs text-gray-500">Webhook secret</span><ConfigState ok={settings?.webhookSecretConfigured} label={settings?.webhookSecretConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'} /></div></div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={saving} onClick={() => setSettingsOpen(false)}>Hủy</Button><Button type="button" variant="secondary" disabled={testing} onClick={testConnection}><PlugZap className="h-4 w-4" />{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</Button><Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</Button></div>
        </form>
      </HrDrawer>

      {revokeTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setRevokeTarget(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="telegram-revoke-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-3"><div className="rounded-full bg-red-100 p-2 text-red-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 id="telegram-revoke-title" className="text-lg font-bold text-gray-900">Ngắt liên kết Telegram?</h2><p className="mt-1 text-sm text-gray-600">{revokeTarget.employeeCode} · {revokeTarget.employeeName}</p></div></div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>Nhân viên sẽ không nhận các phiếu lương gửi sau thao tác này.</p><p className="mt-1">Tin nhắn đã gửi không bị xóa. Muốn liên kết lại, nhân viên phải bấm Start và được HR xác minh lại.</p></div>
          <label className="mt-4 block"><span className="mb-1 block text-sm font-semibold text-gray-700">Lý do thu hồi <span className="text-red-600">*</span></span><textarea autoFocus value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} maxLength={500} rows={3} placeholder="Ví dụ: Nhân viên đổi tài khoản Telegram" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
          <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setRevokeTarget(null)}>Hủy</Button><Button type="button" variant="danger" disabled={Boolean(busyId) || !revokeReason.trim()} onClick={revoke}>{busyId ? 'Đang thu hồi...' : 'Xác nhận ngắt liên kết'}</Button></div>
        </section>
      </div>}
    </HrPageShell>
  );
}

function ConfigState({ ok, label }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{label}</span>;
}
