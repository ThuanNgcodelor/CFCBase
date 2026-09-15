import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckSquare, ExternalLink, FileSpreadsheet, FileText, Play, RefreshCw, Search, Send, Settings2, TestTube2, Trash2, Unlink, UploadCloud, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrDrawer, HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrPayrollApi } from '../../api/hrPayrollApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime } from '../../utils/hr';

const STATUS_LABELS = {
  PREVIEWED: 'Đã xem trước', QUEUED: 'Đang chờ gửi', SENDING: 'Đang gửi', PENDING: 'Chờ gửi',
  COMPLETED: 'Đã gửi xong', COMPLETED_WITH_WARNING: 'Có cảnh báo', FAILED: 'Thất bại',
  READY: 'Sẵn sàng', SKIPPED: 'Chưa đủ điều kiện', SENT: 'Đã gửi', RETRY: 'Đang thử lại',
};
const statusLabel = status => STATUS_LABELS[status] || status || '—';
const isRunning = campaign => ['QUEUED', 'SENDING'].includes(campaign?.status);

export default function HrPayroll() {
  const navigate = useNavigate();
  const [imports, setImports] = useState(normalizePage(null));
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(normalizePage(null));
  const [campaign, setCampaign] = useState(null);
  const [testRecipient, setTestRecipient] = useState(null);
  const [file, setFile] = useState(null);
  const [page, setPage] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [rowFilter, setRowFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState('');
  const [testRecipientOpen, setTestRecipientOpen] = useState(false);
  const [error, setError] = useState('');
  const selectionRequest = useRef(0);

  const loadImports = useCallback(async () => {
    setLoading(true); setError('');
    try { setImports(normalizePage(await hrPayrollApi.listImports({ page, size: 20 }))); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'Không thể tải danh sách file lương.')); }
    finally { setLoading(false); }
  }, [page]);

  const loadTestRecipient = useCallback(async () => {
    try {
      const result = await hrPayrollApi.testRecipient();
      setTestRecipient(current => result?.status === 'PENDING' && current?.linkUrl
        ? { ...result, linkUrl: current.linkUrl }
        : result);
    } catch { /* link card remains available */ }
  }, []);

  useEffect(() => { loadImports(); }, [loadImports]);
  useEffect(() => { loadTestRecipient(); }, [loadTestRecipient]);
  useEffect(() => {
    if (testRecipient?.status !== 'PENDING') return undefined;
    const timer = window.setInterval(loadTestRecipient, 2000);
    return () => window.clearInterval(timer);
  }, [testRecipient?.status, loadTestRecipient]);

  const selectImport = async (item, requestedPage = 0, requestedFilter = rowFilter, requestedKeyword = keyword) => {
    const request = ++selectionRequest.current;
    setSelected(item); setCampaign(null); setPreview(normalizePage(null)); setBusy(true); setPreviewPage(requestedPage);
    try {
      const [result, existing] = await Promise.all([
        hrPayrollApi.preview(item.id, { page: requestedPage, size: 50, status: requestedFilter === 'ALL' ? undefined : requestedFilter, keyword: requestedKeyword.trim() || undefined }),
        hrPayrollApi.campaignForImport(item.id),
      ]);
      if (request !== selectionRequest.current) return;
      setPreview(normalizePage(result.rows)); setCampaign(existing?.id ? existing : null);
      if (result.batch) setSelected(result.batch);
    } catch (requestError) {
      if (request === selectionRequest.current) toast.error(apiErrorMessage(requestError, 'Không thể đọc bản xem trước.'));
    } finally { if (request === selectionRequest.current) setBusy(false); }
  };

  const upload = async event => {
    event.preventDefault();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { toast.error('Chỉ nhận file Excel .xlsx.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('File không được vượt quá 15 MB.'); return; }
    setBusy(true);
    try {
      const result = await hrPayrollApi.upload(file);
      setFile(null); setSelectedRows(new Set()); event.target.reset();
      toast.success('Đã đọc file lương, hãy kiểm tra dữ liệu.');
      await loadImports(); await selectImport(result);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể import file lương.')); }
    finally { setBusy(false); }
  };

  const deleteImport = async (event, item) => {
    event.stopPropagation();
    if (!window.confirm(`Xóa file "${item.fileName}"${item.status === 'QUEUED' ? ' và hàng đợi chưa gửi' : ''}? Thao tác này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      await hrPayrollApi.deleteImport(item.id);
      if (selected?.id === item.id) {
        selectionRequest.current += 1; setSelected(null); setCampaign(null); setPreview(normalizePage(null));
      }
      toast.success('Đã xóa file nháp.'); await loadImports();
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể xóa file nháp.')); }
    finally { setBusy(false); }
  };

  const refreshEligibility = async () => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      const updated = await hrPayrollApi.refreshEligibility(selected.id);
      await selectImport(updated, previewPage, rowFilter, keyword); await loadImports();
      toast.success(`Đã cập nhật: ${updated.readyRows} người đủ điều kiện.`);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể cập nhật điều kiện nhận.')); }
    finally { setBusy(false); }
  };

  const createCampaign = async mode => {
    if (!selected?.id) return;
    const ids = mode === 'ALL_ELIGIBLE' ? [] : [...selectedRows];
    if (mode !== 'ALL_ELIGIBLE' && !ids.length) { toast.error('Hãy chọn ít nhất một nhân viên.'); return; }
    const label = mode === 'ALL_ELIGIBLE' ? `${selected.readyRows} người đủ điều kiện` : `${ids.length} người đã chọn`;
    if (!window.confirm(`GỬI CHÍNH THỨC phiếu lương tháng ${selected.payrollMonth || ''} cho ${label}?`)) return;
    setBusy(true);
    try {
      const result = await hrPayrollApi.createCampaign(selected.id, ids.length === 1 ? 'SINGLE' : mode, ids);
      setCampaign(result); toast.success('Đã tạo hàng đợi chính thức. Hãy bấm Bắt đầu gửi.');
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể tạo hàng đợi gửi.')); }
    finally { setBusy(false); }
  };

  const startCampaign = async () => {
    if (!campaign?.id || !window.confirm(`Bắt đầu gửi chính thức ${campaign.total} phiếu lương qua Telegram?`)) return;
    setBusy(true);
    try { setCampaign(await hrPayrollApi.start(campaign.id)); toast.success('Đã bắt đầu gửi qua Telegram.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể bắt đầu gửi.')); }
    finally { setBusy(false); }
  };

  const retryCampaign = async () => {
    if (!campaign?.id || !window.confirm('Chỉ thử lại các lỗi Telegram xác định là an toàn?')) return;
    setBusy(true);
    try { setCampaign(await hrPayrollApi.retry(campaign.id)); toast.success('Đã xếp lại các dòng lỗi an toàn.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể gửi lại.')); }
    finally { setBusy(false); }
  };

  const createTestLink = async () => {
    setBusy(true);
    try {
      const result = await hrPayrollApi.createTestRecipientLink(); setTestRecipient(result);
      window.open(result.linkUrl, '_blank', 'noopener,noreferrer');
      toast.success('Đã mở bot. Hãy bấm Start trong Telegram trong 15 phút.');
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể tạo liên kết nhận thử.')); }
    finally { setBusy(false); }
  };

  const revokeTestRecipient = async () => {
    if (!window.confirm('Ngắt tài khoản Telegram nhận thử này?')) return;
    setBusy(true);
    try { await hrPayrollApi.revokeTestRecipient(); await loadTestRecipient(); toast.success('Đã ngắt tài khoản nhận thử.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể ngắt liên kết.')); }
    finally { setBusy(false); }
  };

  const sendTest = async row => {
    if (testRecipient?.status !== 'ACTIVE') { setTestRecipientOpen(true); toast.error('Hãy liên kết tài khoản nhận thử trước.'); return; }
    if (!window.confirm(`Gửi BẢN TEST dữ liệu của ${row.employeeCode} - ${row.employeeName} về tài khoản của bạn?`)) return;
    setBusyRow(row.id);
    try { await hrPayrollApi.sendTest(selected.id, row.id); toast.success('Đã gửi bản test. Trạng thái gửi chính thức không thay đổi.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể gửi bản test.')); }
    finally { setBusyRow(''); }
  };

  useEffect(() => {
    if (!isRunning(campaign)) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const result = await hrPayrollApi.campaign(campaign.id);
        if (!cancelled) setCampaign(current => current?.id === result.id ? result : current);
      } catch { /* retain progress during a transient polling failure */ }
    }, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [campaign]);

  const visibleRows = useMemo(() => preview.content.filter(row => {
    if (rowFilter !== 'ALL' && row.status !== rowFilter) return false;
    const needle = keyword.trim().toLowerCase();
    return !needle || row.employeeCode?.toLowerCase().includes(needle) || row.employeeName?.toLowerCase().includes(needle);
  }), [preview.content, rowFilter, keyword]);
  const readyOnPage = visibleRows.filter(row => row.status === 'READY');
  const toggleRow = id => setSelectedRows(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const togglePage = () => setSelectedRows(current => {
    const next = new Set(current); const allSelected = readyOnPage.every(row => next.has(row.id));
    readyOnPage.forEach(row => allSelected ? next.delete(row.id) : next.add(row.id)); return next;
  });
  const applyRowFilter = next => {
    setRowFilter(next);
    if (selected?.id) selectImport(selected, 0, next, keyword);
  };
  const applyKeyword = () => selected?.id && selectImport(selected, 0, rowFilter, keyword);
  const workflowStep = selected ? (campaign?.id ? 4 : 3) : imports.content.length ? 2 : 1;
  const campaignProgress = campaign?.total ? Math.min(100, Math.round(((campaign.sent || 0) + (campaign.failed || 0) + (campaign.skipped || 0)) * 100 / campaign.total)) : 0;

  return <HrPageShell size="wide">
    <SEOHead title="CFC Base | Gửi phiếu lương" url="https://cfcbooking.io.vn/manager/hr/payroll" />
    <HrPageHeader title="Gửi phiếu lương Telegram" description="Kiểm tra dữ liệu, gửi thử và theo dõi từng phiếu lương trong một quy trình an toàn."
      actions={<><Button type="button" variant="secondary" onClick={() => setTestRecipientOpen(true)}><TestTube2 className="h-4 w-4" /><span>Nhận thử</span><span className={`h-2 w-2 rounded-full ${testRecipient?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'}`} aria-hidden="true" /></Button><Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/telegram')}><Settings2 className="h-4 w-4" />Liên kết nhân viên</Button><Button type="button" variant="secondary" size="icon" title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" onClick={loadImports}><RefreshCw className="h-4 w-4" /></Button></>} />

    <section className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0">
        {[[1, 'Nhập file', 'Tạo bản xem trước'], [2, 'Chọn file', 'Chọn kỳ cần gửi'], [3, 'Kiểm tra', 'Rà soát người nhận'], [4, 'Gửi & theo dõi', 'Kiểm soát kết quả']].map(([step, label, hint]) => <div key={step} className={`flex min-h-[82px] items-center gap-3 px-4 py-3 ${workflowStep === step ? 'bg-emerald-50' : ''}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${workflowStep > step ? 'bg-emerald-600 text-white' : workflowStep === step ? 'border-2 border-emerald-600 bg-white text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{workflowStep > step ? <Check className="h-4 w-4" /> : step}</span><span><b className={`block text-sm ${workflowStep >= step ? 'text-gray-900' : 'text-gray-400'}`}>{label}</b><span className="hidden text-xs text-gray-500 xl:block">{hint}</span></span></div>)}
      </div>
    </section>

    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UploadCloud className="h-5 w-5" /></span><div><h2 className="font-semibold text-gray-900">Nhập file lương Excel</h2><p className="mt-1 text-sm text-gray-500">Hệ thống chỉ đọc và tạo bản xem trước. Chưa có tin nhắn nào được gửi ở bước này.</p></div></div>
        <form onSubmit={upload} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm transition hover:border-blue-400 hover:bg-blue-50/40 sm:min-w-[300px]">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-gray-500" /><span className="min-w-0"><span className="block truncate font-medium text-gray-800">{file?.name || 'Chọn file .xlsx'}</span><span className="block text-xs text-gray-500">Tối đa 15 MB</span></span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => setFile(event.target.files?.[0] || null)} className="sr-only" />
          </label>
          <Button type="submit" disabled={!file || busy}><UploadCloud className="h-4 w-4" />{busy ? 'Đang đọc file...' : 'Import & xem trước'}</Button>
        </form>
      </div>
    </section>

    {loading ? <div className="mt-5"><HrLoading /></div> : error ? <div className="mt-5"><HrError message={error} onRetry={loadImports} /></div> : <section className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5"><div><h2 className="font-semibold text-gray-900">File lương đã nhập</h2><p className="mt-1 text-sm text-gray-500">Chọn một file để kiểm tra người nhận. File đã xử lý được giữ lại để đối soát.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{imports.totalElements} file</span></div>
      <div className="overflow-x-auto"><table className="min-w-[950px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">File / kỳ lương</th><th>Tổng dòng</th><th>Sẵn sàng</th><th>Cần bổ sung</th><th>Trạng thái</th><th>Thời gian</th><th className="px-5 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{imports.content.map(item => { const canDelete = ['PREVIEWED', 'QUEUED'].includes(item.status); return <tr key={item.id} onClick={() => { setSelectedRows(new Set()); selectImport(item); }} className={`cursor-pointer transition hover:bg-emerald-50/60 ${selected?.id === item.id ? 'bg-emerald-50' : ''}`}><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected?.id === item.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}><FileSpreadsheet className="h-4 w-4" /></span><span><b className="block text-gray-900">{item.fileName}</b><span className="text-xs text-gray-500">Kỳ lương {item.payrollMonth || 'chưa xác định'}</span></span></div></td><td>{item.totalRows}</td><td className="font-semibold text-emerald-700">{item.readyRows}</td><td className="font-semibold text-amber-700">{item.skippedRows}</td><td><HrStatusBadge status={item.status} label={statusLabel(item.status)} /></td><td className="text-xs text-gray-500">{formatHrDateTime(item.createdAt)}</td><td className="px-5 text-right"><Button type="button" variant="ghost" size="icon" disabled={busy || !canDelete} title={canDelete ? 'Xóa file và hàng đợi chưa gửi' : 'File đã xử lý nên được giữ để đối soát'} onClick={event => deleteImport(event, item)}><Trash2 className={`h-4 w-4 ${canDelete ? 'text-red-600' : ''}`} /></Button></td></tr>; })}</tbody></table></div>
      {!imports.content.length && <div className="p-8"><HrEmpty title="Chưa có file lương" description="Chọn file .xlsx ở bước trên để bắt đầu." /></div>}
      <HrPagination page={imports.number} totalPages={imports.totalPages} totalElements={imports.totalElements} onPageChange={setPage} />
    </section>}

    {selected && <section className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-5 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-900">Kiểm tra người nhận</h2><HrStatusBadge status={selected.status} label={statusLabel(selected.status)} /></div><p className="mt-1 text-sm text-gray-500">{selected.fileName} · kỳ lương {selected.payrollMonth || '—'}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || isRunning(campaign)} onClick={refreshEligibility}><RefreshCw className="h-4 w-4" />Cập nhật liên kết</Button><Button variant="secondary" disabled={busy || isRunning(campaign) || !selectedRows.size} onClick={() => createCampaign('SELECTED')}><CheckSquare className="h-4 w-4" />Gửi người đã chọn ({selectedRows.size})</Button><Button disabled={busy || isRunning(campaign) || !selected.readyRows} onClick={() => createCampaign('ALL_ELIGIBLE')}><Send className="h-4 w-4" />Gửi tất cả đủ điều kiện</Button></div></div>
      <div className="grid grid-cols-2 border-b border-gray-100 bg-gray-50/60 md:grid-cols-4"><SummaryMetric label="Tổng nhân viên" value={selected.totalRows || 0} icon={<Users className="h-4 w-4" />} /><SummaryMetric label="Đủ điều kiện" value={selected.readyRows || 0} tone="green" /><SummaryMetric label="Cần bổ sung" value={selected.skippedRows || 0} tone="amber" /><SummaryMetric label="Đang chọn" value={selectedRows.size} tone="blue" /></div>
      {campaign?.id && <div className="m-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><span>Đợt gửi gần nhất</span><HrStatusBadge status={campaign.status} label={statusLabel(campaign.status)} /></div><p className="mt-1 text-xs text-gray-600">Đã gửi {campaign.sent}/{campaign.total} · Lỗi {campaign.failed} · Bỏ qua {campaign.skipped}</p></div><div className="flex gap-2">{campaign.status === 'QUEUED' && <Button disabled={busy} onClick={startCampaign}><Play className="h-4 w-4" />Bắt đầu gửi</Button>}{campaign.failed > 0 && ['COMPLETED_WITH_WARNING', 'COMPLETED'].includes(campaign.status) && <Button variant="secondary" disabled={busy} onClick={retryCampaign}>Thử lại lỗi an toàn</Button>}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${campaignProgress}%` }} /></div></div>}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center"><div className="flex flex-wrap gap-2"><Button size="sm" variant={rowFilter === 'ALL' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('ALL')}>Tất cả</Button><Button size="sm" variant={rowFilter === 'READY' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('READY')}>Đủ điều kiện</Button><Button size="sm" variant={rowFilter === 'SKIPPED' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('SKIPPED')}>Cần bổ sung</Button></div><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') applyKeyword(); }} placeholder="Tìm mã hoặc tên trong toàn bộ file" className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" /></div><Button size="sm" variant="secondary" onClick={applyKeyword}>Tìm kiếm</Button></div>
      <div className="max-h-[620px] overflow-auto"><table className="min-w-[940px] w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_#e5e7eb]"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Chọn tất cả người đủ điều kiện trên trang" checked={readyOnPage.length > 0 && readyOnPage.every(row => selectedRows.has(row.id))} onChange={togglePage} /></th><th className="py-3">Nhân viên</th><th>Khả năng gửi</th><th>Thông tin kiểm tra</th><th className="px-4 text-right">Gửi thử</th></tr></thead><tbody className="divide-y divide-gray-100">{visibleRows.map(row => <tr key={row.id} className={`transition hover:bg-gray-50 ${selectedRows.has(row.id) ? 'bg-blue-50/50' : ''}`}><td className="px-4 py-3"><input type="checkbox" aria-label={`Chọn ${row.employeeCode}`} disabled={row.status !== 'READY'} checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} /></td><td className="py-3"><b className="block text-gray-900">{row.employeeCode}</b><span className="text-xs text-gray-500">{row.employeeName}</span></td><td><HrStatusBadge status={row.status} label={statusLabel(row.status)} /></td><td className="max-w-md text-gray-500">{row.errorMessage || 'Đã xác minh liên kết Telegram'}</td><td className="px-4 text-right"><Button size="sm" variant="ghost" disabled={busyRow === row.id} onClick={() => sendTest(row)}><TestTube2 className="h-4 w-4" />{busyRow === row.id ? 'Đang gửi...' : 'Gửi thử'}</Button></td></tr>)}</tbody></table></div>
      {!visibleRows.length && <div className="p-8"><HrEmpty title="Không có nhân viên phù hợp" description="Đổi bộ lọc hoặc sang trang khác." /></div>}
      <HrPagination page={previewPage} totalPages={preview.totalPages} totalElements={preview.totalElements} onPageChange={p => selectImport(selected, p, rowFilter, keyword)} />
    </section>}
    {campaign?.id && <DeliveryResults key={campaign.id} campaign={campaign} onCampaignChange={setCampaign} />}
    <TestRecipientDrawer open={testRecipientOpen} recipient={testRecipient} busy={busy} onClose={() => setTestRecipientOpen(false)} onCreate={createTestLink} onRevoke={revokeTestRecipient} />
  </HrPageShell>;
}

function SummaryMetric({ label, value, tone = 'slate', icon }) {
  const colors = { slate: 'text-gray-900', green: 'text-emerald-700', amber: 'text-amber-700', blue: 'text-blue-700' };
  return <div className="border-r border-gray-100 px-5 py-4 last:border-r-0"><div className="flex items-center gap-2 text-xs font-medium text-gray-500">{icon}{label}</div><p className={`mt-1 text-xl font-semibold ${colors[tone]}`}>{value}</p></div>;
}

function TestRecipientDrawer({ open, recipient, busy, onClose, onCreate, onRevoke }) {
  const active = recipient?.status === 'ACTIVE';
  return <HrDrawer isOpen={open} onClose={onClose} title="Tài khoản nhận thử" description="Nhận bản thử trên Telegram của bạn trước khi gửi chính thức cho nhân viên.">
    <div className="space-y-5 p-5 sm:p-7">
      <div className={`rounded-xl border p-5 ${active ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 shadow-sm'}`}>{active ? <Check className="h-5 w-5" /> : <TestTube2 className="h-5 w-5" />}</span><div><h3 className="font-semibold text-gray-900">{active ? 'Đã sẵn sàng nhận bản thử' : recipient?.status === 'PENDING' ? 'Đang chờ bạn bấm Start' : 'Chưa liên kết tài khoản'}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{active ? (recipient.telegramUsername ? `Tài khoản @${recipient.telegramUsername} đang được dùng để nhận bản thử.` : 'Tài khoản Telegram của bạn đang được dùng để nhận bản thử.') : 'Liên kết này độc lập và không thay đổi tài khoản Telegram của bất kỳ nhân viên nào.'}</p></div></div>
      </div>
      {!active && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><b>Cách liên kết</b><ol className="mt-2 list-decimal space-y-1 pl-5 text-blue-800"><li>Mở bot Telegram từ nút bên dưới.</li><li>Bấm <b>Start</b> trong vòng 15 phút.</li><li>Quay lại đây; trạng thái sẽ tự cập nhật.</li></ol></div>}
      {active ? <Button type="button" variant="secondary" disabled={busy} onClick={onRevoke}><Unlink className="h-4 w-4" />Ngắt tài khoản nhận thử</Button> : <div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={busy} onClick={onCreate}><ExternalLink className="h-4 w-4" />{recipient?.status === 'PENDING' ? 'Tạo liên kết mới' : 'Mở bot để liên kết'}</Button>{recipient?.linkUrl && <a className="text-sm font-semibold text-blue-700 underline underline-offset-4" href={recipient.linkUrl} target="_blank" rel="noreferrer">Mở lại Telegram</a>}</div>}
      <div className="border-t border-gray-100 pt-5"><h3 className="text-sm font-semibold text-gray-900">Nguyên tắc an toàn</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-gray-600"><li>• Bản gửi thử luôn có cảnh báo và tên nhân viên nguồn.</li><li>• Gửi thử không làm thay đổi trạng thái gửi chính thức.</li><li>• Chỉ tài khoản quản trị đang đăng nhập sử dụng được liên kết này.</li></ul></div>
    </div>
  </HrDrawer>;
}

function DeliveryResults({ campaign, onCampaignChange }) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(normalizePage(null));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const [documentPreview, setDocumentPreview] = useState(null);
  const [busyId, setBusyId] = useState('');
  const openMessage = async id => {
    setBusyId(id); setMessage('');
    try { setMessage(await hrPayrollApi.message(campaign.id, id)); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không có bản tin đã lưu.')); }
    finally { setBusyId(''); }
  };
  const resend = async row => {
    const reason = window.prompt(`Gửi lại bản sao cho ${row.employeeCode} - ${row.employeeName}. Nhập lý do bắt buộc:`);
    if (!reason?.trim()) return;
    if (!window.confirm('Telegram đã báo gửi thành công trước đó. Bạn chắc chắn muốn gửi thêm một bản sao?')) return;
    setBusyId(row.id);
    try { onCampaignChange(await hrPayrollApi.resend(campaign.id, row.id, reason.trim())); toast.success('Đã xếp gửi lại bản sao.'); setRefresh(value => value + 1); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể gửi lại bản sao.')); }
    finally { setBusyId(''); }
  };
  const openDocument = async row => {
    setBusyId(row.id);
    try {
      const blob = await hrPayrollApi.document(campaign.id, row.id);
      setDocumentPreview(current => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: URL.createObjectURL(blob), title: `PDF phiếu lương - ${row.employeeCode}` };
      });
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không có PDF đã lưu cho dòng này.')); }
    finally { setBusyId(''); }
  };
  const closeDocument = () => setDocumentPreview(current => {
    if (current?.url) URL.revokeObjectURL(current.url);
    return null;
  });
  useEffect(() => () => { if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url); }, [documentPreview?.url]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    hrPayrollApi.deliveries(campaign.id, { page, size: 50 }, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setRows(normalizePage(result)); })
      .catch(requestError => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không đọc được kết quả gửi.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [campaign.id, campaign.status, campaign.sent, campaign.failed, page, refresh]);
  return <section className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-gray-900">Kết quả gửi Telegram</h2><HrStatusBadge status={campaign.status} label={statusLabel(campaign.status)} /></div><p className="mt-1 text-sm text-gray-500">Theo dõi trạng thái từng phiếu. Gửi lại bản sao luôn yêu cầu ghi lý do để đối soát.</p></div><Button variant="secondary" onClick={() => setRefresh(value => value + 1)}><RefreshCw className="h-4 w-4" />Cập nhật kết quả</Button></div>
    {loading ? <div className="p-5"><HrLoading /></div> : error ? <div className="p-5"><HrError message={error} /></div> : <div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_#e5e7eb]"><tr><th className="px-5 py-3">Nhân viên</th><th>Trạng thái</th><th>Số lần gửi</th><th>Gửi lúc</th><th>Ghi chú hệ thống</th><th className="px-5 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.content.map(row => <tr key={row.id} className="hover:bg-gray-50"><td className="px-5 py-3"><b className="block text-gray-900">{row.employeeCode}</b><span className="text-xs text-gray-500">{row.employeeName}</span></td><td><HrStatusBadge status={row.status} label={statusLabel(row.status)} /></td><td>{row.attemptCount}</td><td className="text-xs text-gray-500">{formatHrDateTime(row.sentAt)}</td><td className="max-w-md text-gray-500">{row.lastError || 'Không có lỗi'}</td><td className="px-5 text-right"><div className="inline-flex gap-2"><Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => openMessage(row.id)}>Lời nhắn</Button>{row.documentAvailable && <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => openDocument(row)}><FileText className="h-4 w-4" />Xem PDF</Button>}{row.status === 'SENT' && <Button size="sm" variant="secondary" disabled={busyId === row.id || isRunning(campaign)} onClick={() => resend(row)}>Gửi lại</Button>}</div></td></tr>)}</tbody></table></div>}
    {!loading && !error && !rows.content.length && <div className="p-6"><HrEmpty title="Chưa có kết quả gửi" description="Bắt đầu đợt gửi để theo dõi trạng thái từng nhân viên tại đây." /></div>}
    <HrPagination page={rows.number} totalPages={rows.totalPages} totalElements={rows.totalElements} onPageChange={setPage} />
    <HrDrawer isOpen={Boolean(message)} onClose={() => setMessage('')} title="Lời nhắn kèm PDF" description="Lời nhắn và PDF đều được đóng băng theo đúng thời điểm tạo đợt gửi."><div className="p-5 sm:p-7"><div className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-800">{message}</div></div></HrDrawer>
    <HrDrawer isOpen={Boolean(documentPreview)} onClose={closeDocument} title={documentPreview?.title || 'PDF phiếu lương'} description="Bản PDF đã đóng băng; đúng với file được gửi qua Telegram."><div className="h-[72vh] bg-gray-100 p-3"><iframe className="h-full w-full rounded-lg border border-gray-200 bg-white" title={documentPreview?.title || 'PDF phiếu lương'} src={documentPreview?.url} /></div></HrDrawer>
  </section>;
}
