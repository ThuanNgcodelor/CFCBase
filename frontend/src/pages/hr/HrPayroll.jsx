import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, ExternalLink, FileUp, Play, RefreshCw, Send, Settings2, TestTube2, Trash2, Unlink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
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
    if (testRecipient?.status !== 'ACTIVE') { toast.error('Hãy liên kết tài khoản nhận thử trước.'); return; }
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

  return <HrPageShell size="wide">
    <SEOHead title="CFC Base | Gửi phiếu lương" url="https://cfcbooking.io.vn/manager/hr/payroll" />
    <HrPageHeader title="Gửi phiếu lương Telegram" description="Gửi thử an toàn, chọn đúng người nhận và theo dõi từng lần gửi."
      actions={<><Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/telegram')}><Settings2 className="mr-1.5 h-4 w-4" />Cấu hình Telegram</Button><Button type="button" variant="secondary" onClick={loadImports}><RefreshCw className="mr-1.5 h-4 w-4" />Tải lại</Button></>} />

    <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">1. Import file lương</h2>
        <p className="mt-1 text-sm text-gray-500">Import chỉ tạo bản xem trước, chưa gửi cho nhân viên.</p>
        <form onSubmit={upload} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => setFile(event.target.files?.[0] || null)} className="block max-w-full text-sm" />
          <Button type="submit" disabled={!file || busy}><FileUp className="mr-1.5 h-4 w-4" />{busy ? 'Đang xử lý...' : 'Import & xem trước'}</Button>
        </form>
      </div>
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-violet-950">Tài khoản nhận thử của tôi</h2><p className="mt-1 text-sm text-violet-700">Dùng chính bot hiện tại; không thay liên kết nhân viên.</p></div><TestTube2 className="h-5 w-5 text-violet-700" /></div>
        {testRecipient?.status === 'ACTIVE'
          ? <div className="mt-4"><p className="font-medium text-emerald-700">Đã liên kết {testRecipient.telegramUsername ? `@${testRecipient.telegramUsername}` : 'tài khoản Telegram nhận thử'}</p><Button className="mt-3" type="button" variant="secondary" disabled={busy} onClick={revokeTestRecipient}><Unlink className="mr-1.5 h-4 w-4" />Ngắt liên kết</Button></div>
          : <div className="mt-4"><Button type="button" disabled={busy} onClick={createTestLink}><ExternalLink className="mr-1.5 h-4 w-4" />{testRecipient?.status === 'PENDING' ? 'Tạo lại link' : 'Liên kết Telegram nhận thử'}</Button>{testRecipient?.linkUrl && <a className="ml-3 text-sm text-violet-700 underline" href={testRecipient.linkUrl} target="_blank" rel="noreferrer">Mở bot và bấm Start</a>}<p className="mt-2 text-xs text-violet-600">Link dùng một lần và hết hạn sau 15 phút.</p></div>}
      </div>
    </section>

    {loading ? <div className="mt-5"><HrLoading /></div> : error ? <div className="mt-5"><HrError message={error} onRetry={loadImports} /></div> : <section className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4"><h2 className="font-semibold text-gray-900">2. Chọn file đã import</h2><p className="text-sm text-gray-500">File xem trước hoặc hàng đợi chưa bấm Bắt đầu gửi có thể xóa. File đã xử lý được giữ để đối soát.</p></div>
      <div className="overflow-x-auto"><table className="min-w-[950px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">File</th><th>Tháng</th><th>Tổng dòng</th><th>Sẵn sàng</th><th>Chưa đủ</th><th>Trạng thái</th><th>Thời gian</th><th className="px-4 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{imports.content.map(item => { const canDelete = ['PREVIEWED', 'QUEUED'].includes(item.status); return <tr key={item.id} onClick={() => { setSelectedRows(new Set()); selectImport(item); }} className={`cursor-pointer hover:bg-emerald-50 ${selected?.id === item.id ? 'bg-emerald-50' : ''}`}><td className="px-4 py-3 font-medium">{item.fileName}</td><td>{item.payrollMonth || '—'}</td><td>{item.totalRows}</td><td className="text-emerald-700">{item.readyRows}</td><td className="text-amber-700">{item.skippedRows}</td><td><HrStatusBadge status={item.status} label={statusLabel(item.status)} /></td><td className="text-xs text-gray-500">{formatHrDateTime(item.createdAt)}</td><td className="px-4 text-right"><Button type="button" variant="danger" size="icon" disabled={busy || !canDelete} title={canDelete ? 'Xóa file và hàng đợi chưa gửi' : 'File đã xử lý nên được giữ để đối soát'} onClick={event => deleteImport(event, item)}><Trash2 className="h-4 w-4" /></Button></td></tr>; })}</tbody></table></div>
      {!imports.content.length && <div className="p-8"><HrEmpty title="Chưa có file lương" description="Chọn file .xlsx ở bước trên để bắt đầu." /></div>}
      <HrPagination page={imports.number} totalPages={imports.totalPages} totalElements={imports.totalElements} onPageChange={setPage} />
    </section>}

    {selected && <section className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">3. Kiểm tra người nhận</h2><p className="text-sm text-gray-500">{selected.fileName} · {selected.readyRows} đủ điều kiện · {selected.skippedRows} cần bổ sung Telegram</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || isRunning(campaign)} onClick={refreshEligibility}><RefreshCw className="mr-1.5 h-4 w-4" />Cập nhật điều kiện</Button><Button variant="secondary" disabled={busy || isRunning(campaign) || !selectedRows.size} onClick={() => createCampaign('SELECTED')}><CheckSquare className="mr-1.5 h-4 w-4" />Gửi chính thức đã chọn ({selectedRows.size})</Button><Button disabled={busy || isRunning(campaign) || !selected.readyRows} onClick={() => createCampaign('ALL_ELIGIBLE')}><Send className="mr-1.5 h-4 w-4" />Gửi tất cả đủ điều kiện</Button></div></div>
      {campaign?.id && <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm"><span>Đợt gần nhất: <HrStatusBadge status={campaign.status} label={statusLabel(campaign.status)} /> · Đã gửi {campaign.sent}/{campaign.total} · Lỗi {campaign.failed} · Bỏ qua {campaign.skipped}</span><div className="flex gap-2">{campaign.status === 'QUEUED' && <Button disabled={busy} onClick={startCampaign}><Play className="mr-1.5 h-4 w-4" />Bắt đầu gửi</Button>}{campaign.failed > 0 && ['COMPLETED_WITH_WARNING', 'COMPLETED'].includes(campaign.status) && <Button variant="secondary" disabled={busy} onClick={retryCampaign}>Thử lại lỗi an toàn</Button>}</div></div>}
      <div className="flex flex-wrap gap-2 border-y bg-gray-50 p-3"><Button size="sm" variant={rowFilter === 'ALL' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('ALL')}>Tất cả</Button><Button size="sm" variant={rowFilter === 'READY' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('READY')}>Đủ điều kiện</Button><Button size="sm" variant={rowFilter === 'SKIPPED' ? 'primary' : 'secondary'} onClick={() => applyRowFilter('SKIPPED')}>Chưa đủ điều kiện</Button><input value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') applyKeyword(); }} placeholder="Tìm mã hoặc tên trong toàn bộ file" className="h-9 min-w-[260px] flex-1 rounded-lg border px-3 text-sm" /><Button size="sm" variant="secondary" onClick={applyKeyword}>Tìm</Button></div>
      <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2"><input type="checkbox" checked={readyOnPage.length > 0 && readyOnPage.every(row => selectedRows.has(row.id))} onChange={togglePage} /></th><th>Mã NV</th><th>Họ tên</th><th>Trạng thái</th><th>Lý do</th><th>Thao tác thử</th></tr></thead><tbody className="divide-y">{visibleRows.map(row => <tr key={row.id}><td className="px-3 py-3"><input type="checkbox" disabled={row.status !== 'READY'} checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} /></td><td className="font-semibold">{row.employeeCode}</td><td>{row.employeeName}</td><td><HrStatusBadge status={row.status} label={statusLabel(row.status)} /></td><td className="text-gray-500">{row.errorMessage || 'Đủ điều kiện gửi chính thức'}</td><td><Button size="sm" variant="secondary" disabled={busyRow === row.id || testRecipient?.status !== 'ACTIVE'} onClick={() => sendTest(row)}><TestTube2 className="mr-1 h-4 w-4" />{busyRow === row.id ? 'Đang gửi...' : 'Gửi thử cho tôi'}</Button></td></tr>)}</tbody></table></div>
      {!visibleRows.length && <div className="p-8"><HrEmpty title="Không có nhân viên phù hợp" description="Đổi bộ lọc hoặc sang trang khác." /></div>}
      <HrPagination page={previewPage} totalPages={preview.totalPages} totalElements={preview.totalElements} onPageChange={p => selectImport(selected, p, rowFilter, keyword)} />
    </section>}
    {campaign?.id && <DeliveryResults key={campaign.id} campaign={campaign} onCampaignChange={setCampaign} />}
  </HrPageShell>;
}

function DeliveryResults({ campaign, onCampaignChange }) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(normalizePage(null));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
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
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    hrPayrollApi.deliveries(campaign.id, { page, size: 50 }, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setRows(normalizePage(result)); })
      .catch(requestError => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không đọc được kết quả gửi.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [campaign.id, campaign.status, campaign.sent, campaign.failed, page, refresh]);
  return <section className="mt-5 rounded-xl border bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Kết quả từng người nhận</h2><p className="text-sm text-gray-500">Gửi lại bản sao chỉ dành cho phiếu đã gửi thành công và bắt buộc ghi lý do.</p></div><Button variant="secondary" onClick={() => setRefresh(value => value + 1)}>Tải lại</Button></div>
    {loading ? <HrLoading /> : error ? <HrError message={error} /> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Trạng thái</th><th>Số lần thử</th><th>Gửi lúc</th><th>Lý do</th><th>Thao tác</th></tr></thead><tbody>{rows.content.map(row => <tr key={row.id} className="border-t"><td className="py-3">{row.employeeCode}</td><td>{row.employeeName}</td><td>{statusLabel(row.status)}</td><td>{row.attemptCount}</td><td>{formatHrDateTime(row.sentAt)}</td><td>{row.lastError || '—'}</td><td className="space-x-2"><Button size="sm" variant="secondary" disabled={busyId === row.id} onClick={() => openMessage(row.id)}>Xem tin</Button>{row.status === 'SENT' && <Button size="sm" variant="secondary" disabled={busyId === row.id || isRunning(campaign)} onClick={() => resend(row)}>Gửi lại bản sao</Button>}</td></tr>)}</tbody></table></div>}
    <HrPagination page={rows.number} totalPages={rows.totalPages} totalElements={rows.totalElements} onPageChange={setPage} />
    {message && <div className="mt-4 rounded-lg border p-4"><div className="flex justify-between"><strong>Nội dung đã đóng băng cho đợt gửi này</strong><Button variant="secondary" onClick={() => setMessage('')}>Đóng</Button></div><pre className="mt-3 whitespace-pre-wrap break-words text-sm">{message}</pre></div>}
  </section>;
}
