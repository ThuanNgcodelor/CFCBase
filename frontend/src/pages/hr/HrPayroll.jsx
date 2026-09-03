import { useCallback, useEffect, useState } from 'react';
import { FileUp, Play, RefreshCw, Send, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrLoading, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrPayrollApi } from '../../api/hrPayrollApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime } from '../../utils/hr';

const STATUS_LABELS = {
  PREVIEWED: 'Đã xem trước', QUEUED: 'Đang chờ gửi', SENDING: 'Đang gửi',
  COMPLETED: 'Đã gửi xong', COMPLETED_WITH_WARNING: 'Có cảnh báo', FAILED: 'Thất bại',
  READY: 'Sẵn sàng', SKIPPED: 'Bỏ qua', SENT: 'Đã gửi', RETRY: 'Đang thử lại',
};
const statusLabel = (status) => STATUS_LABELS[status] || status || '—';

export default function HrPayroll() {
  const navigate = useNavigate();
  const [imports, setImports] = useState(normalizePage(null));
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(normalizePage(null));
  const [campaign, setCampaign] = useState(null);
  const [file, setFile] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadImports = useCallback(async () => {
    setLoading(true); setError('');
    try { setImports(normalizePage(await hrPayrollApi.listImports({ page, size: 20 }))); }
    catch (requestError) { setError(apiErrorMessage(requestError, 'Không thể tải danh sách file lương.')); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadImports(); }, [loadImports]);

  const selectImport = async (item) => {
    setSelected(item); setCampaign(null); setBusy(true);
    try {
      const result = await hrPayrollApi.preview(item.id, { page: 0, size: 50 });
      setPreview(normalizePage(result.rows));
      if (result.batch) setSelected(result.batch);
    } catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể đọc bản xem trước.')); }
    finally { setBusy(false); }
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { toast.error('Chỉ nhận file Excel .xlsx.'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('File không được vượt quá 15 MB.'); return; }
    setBusy(true);
    try { const result = await hrPayrollApi.upload(file); setFile(null); event.target.reset(); toast.success('Đã đọc file lương, hãy kiểm tra dữ liệu.'); await loadImports(); await selectImport(result); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể import file lương.')); }
    finally { setBusy(false); }
  };

  const createCampaign = async () => {
    if (!selected) return;
    if (!window.confirm(`Tạo hàng đợi gửi phiếu lương tháng ${selected.payrollMonth || ''}? Những dòng chưa xác minh Telegram sẽ được bỏ qua.`)) return;
    setBusy(true);
    try { const result = await hrPayrollApi.createCampaign(selected.id); setCampaign(result); toast.success('Đã tạo hàng đợi gửi.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể tạo hàng đợi gửi.')); }
    finally { setBusy(false); }
  };

  const startCampaign = async () => {
    if (!campaign) return;
    setBusy(true);
    try { setCampaign(await hrPayrollApi.start(campaign.id)); toast.success('Đã bắt đầu gửi qua Telegram.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể bắt đầu gửi.')); }
    finally { setBusy(false); }
  };

  const retryCampaign = async () => {
    if (!campaign || !window.confirm('Gửi lại các dòng thất bại?')) return;
    setBusy(true);
    try { setCampaign(await hrPayrollApi.retry(campaign.id)); toast.success('Đã xếp lại các dòng lỗi.'); }
    catch (requestError) { toast.error(apiErrorMessage(requestError, 'Không thể gửi lại.')); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!campaign || !['QUEUED', 'SENDING'].includes(campaign.status)) return undefined;
    const timer = window.setInterval(async () => {
      try { setCampaign(await hrPayrollApi.campaign(campaign.id)); }
      catch { /* giữ trạng thái hiện tại khi polling tạm thời lỗi */ }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [campaign]);

  return (
    <HrPageShell size="wide">
      <SEOHead title="CFC Base | Gửi phiếu lương" url="https://cfcbooking.io.vn/manager/hr/payroll" />
      <HrPageHeader title="Gửi phiếu lương Telegram" description="Import file lương .xlsx, kiểm tra người nhận và gửi trực tiếp từ CFCBase." actions={<><Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/telegram')}><Settings2 className="mr-1.5 h-4 w-4" />Cấu hình Telegram</Button><Button type="button" variant="secondary" onClick={loadImports}><RefreshCw className="mr-1.5 h-4 w-4" />Tải lại</Button></>} />

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">1. Import file lương</h2>
        <p className="mt-1 text-sm text-gray-500">File .xlsx có dòng tiêu đề tháng và các cột chuẩn (Mã số, Họ và Tên, Tiền lương, Tổng thu, NH chuyển), tối đa 15 MB.</p>
        <form onSubmit={upload} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block max-w-full text-sm" />
          <Button type="submit" disabled={!file || busy}><FileUp className="mr-1.5 h-4 w-4" />{busy ? 'Đang xử lý...' : 'Import & xem trước'}</Button>
        </form>
      </section>

      {loading ? <div className="mt-5"><HrLoading /></div> : error ? <div className="mt-5"><HrError message={error} onRetry={loadImports} /></div> : (
        <section className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4"><h2 className="font-semibold text-gray-900">2. Chọn file đã import</h2></div>
          <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Tháng</th><th className="px-4 py-3">Tổng dòng</th><th className="px-4 py-3">Sẵn sàng</th><th className="px-4 py-3">Bỏ qua</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thời gian</th></tr></thead><tbody className="divide-y divide-gray-100">{imports.content.map((item) => <tr key={item.id} onClick={() => selectImport(item)} className={`cursor-pointer hover:bg-emerald-50 ${selected?.id === item.id ? 'bg-emerald-50' : ''}`}><td className="px-4 py-3 font-medium text-gray-900">{item.fileName}</td><td className="px-4 py-3">{item.payrollMonth || '—'}</td><td className="px-4 py-3">{item.totalRows}</td><td className="px-4 py-3 text-emerald-700">{item.readyRows}</td><td className="px-4 py-3 text-amber-700">{item.skippedRows}</td><td className="px-4 py-3"><HrStatusBadge status={item.status} label={statusLabel(item.status)} /></td><td className="px-4 py-3 text-xs text-gray-500">{formatHrDateTime(item.createdAt)}</td></tr>)}</tbody></table></div>
          {imports.content.length === 0 && <div className="p-8"><HrEmpty title="Chưa có file lương" description="Chọn file .xlsx ở bước trên để bắt đầu." /></div>}
          <HrPagination page={imports.number} totalPages={imports.totalPages} totalElements={imports.totalElements} onPageChange={setPage} />
        </section>
      )}

      {selected && <section className="mt-5 rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4"><div><h2 className="font-semibold text-gray-900">3. Kiểm tra và gửi</h2><p className="text-sm text-gray-500">{selected.fileName} · {selected.readyRows} dòng đủ điều kiện · {selected.skippedRows} dòng sẽ bỏ qua</p></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || Boolean(campaign)} onClick={createCampaign}><Send className="mr-1.5 h-4 w-4" />Tạo hàng đợi</Button>{campaign && <Button type="button" disabled={busy || !['QUEUED'].includes(campaign.status)} onClick={startCampaign}><Play className="mr-1.5 h-4 w-4" />Bắt đầu gửi</Button>}{campaign && campaign.failed > 0 && ['COMPLETED_WITH_WARNING', 'COMPLETED'].includes(campaign.status) && <Button type="button" variant="secondary" disabled={busy} onClick={retryCampaign}>Gửi lại lỗi</Button>}</div></div><div className="p-4">{campaign && <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">Đợt gửi: <HrStatusBadge status={campaign.status} label={statusLabel(campaign.status)} /> <span className="ml-2">Đã gửi {campaign.sent}/{campaign.total} · Lỗi {campaign.failed} · Bỏ qua {campaign.skipped}</span></div>}<div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-2">Mã NV</th><th className="px-3 py-2">Họ tên</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Lý do</th></tr></thead><tbody className="divide-y divide-gray-100">{preview.content.map((row) => <tr key={row.id}><td className="px-3 py-2 font-semibold">{row.employeeCode}</td><td className="px-3 py-2">{row.employeeName}</td><td className="px-3 py-2"><HrStatusBadge status={row.status} label={statusLabel(row.status)} /></td><td className="px-3 py-2 text-sm text-gray-500">{row.errorMessage || '—'}</td></tr>)}</tbody></table></div></div></section>}
    </HrPageShell>
  );
}
