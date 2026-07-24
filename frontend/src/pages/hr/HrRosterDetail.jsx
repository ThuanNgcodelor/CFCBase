import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, FolderOpen, RotateCcw, Trash2 } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, formatPeriod, nonEmpty } from '../../utils/hr';

export default function HrRosterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [roster, setRoster] = useState(() => location.state?.roster || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [showReopen, setShowReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setMetadataError('');
    hrActivityApi.getRosterById(id, { signal: controller.signal })
      .then((item) => {
        if (item) setRoster(item);
        else setMetadataError('Không tìm thấy thông tin của danh sách tháng này.');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setMetadataError(apiErrorMessage(requestError, 'Không thể tải thông tin kỳ nhân sự.'));
        }
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getRosterItems(id, { page, size: 20, sort: 'displayOrder,asc' }, { signal: controller.signal })
      .then((data) => {
        if (data?.roster) setRoster(data.roster);
        setResult(normalizePage(data?.items || data));
      })
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh sách nhân sự tháng.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, page, reloadKey]);

  const finishAction = (updated, message) => {
    if (updated) setRoster(updated);
    setPage(0);
    setReloadKey((value) => value + 1);
    toast.success(message);
  };

  const runAction = async (action) => {
    if (!roster) return;
    if (action === 'open' && !window.confirm(`Mở ${formatPeriod(roster.periodStart)} và áp dụng các biến động đã xác nhận?`)) return;
    if (action === 'close' && !window.confirm(`Chốt ${formatPeriod(roster.periodStart)}? Sau khi chốt, snapshot sẽ không được sửa trực tiếp.`)) return;
    if (action === 'delete' && !window.confirm(`Xóa bản nháp ${formatPeriod(roster.periodStart)}?`)) return;

    setBusy(action);
    try {
      if (action === 'open') {
        finishAction(await hrActivityApi.openRoster(roster.id, roster.rowVersion), 'Đã mở và tạo snapshot tháng.');
      } else if (action === 'close') {
        finishAction(await hrActivityApi.closeRoster(roster.id, roster.rowVersion), 'Đã chốt danh sách nhân sự tháng.');
      } else if (action === 'delete') {
        await hrActivityApi.deleteRoster(roster.id, roster.rowVersion);
        toast.success('Đã xóa danh sách tháng nháp.');
        navigate('/manager/hr/rosters', { replace: true });
      }
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xử lý danh sách tháng.'));
      setReloadKey((value) => value + 1);
    } finally {
      setBusy('');
    }
  };

  const reopenRoster = async (event) => {
    event.preventDefault();
    if (!reopenReason.trim()) {
      toast.error('Vui lòng nhập lý do mở lại.');
      return;
    }
    setBusy('reopen');
    try {
      const updated = await hrActivityApi.reopenRoster(roster.id, roster.rowVersion, reopenReason.trim());
      setShowReopen(false);
      setReopenReason('');
      finishAction(updated, 'Đã mở lại danh sách tháng.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể mở lại danh sách tháng.'));
      setReloadKey((value) => value + 1);
    } finally {
      setBusy('');
    }
  };

  const actionButtons = roster ? (
    <>
      <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách tháng</Button>
      {roster.status === 'DRAFT' && <Button type="button" disabled={Boolean(busy)} onClick={() => runAction('open')}><FolderOpen className="mr-1.5 h-4 w-4" />Mở kỳ</Button>}
      {roster.status === 'DRAFT' && !roster.baseline && <Button type="button" variant="danger" disabled={Boolean(busy)} onClick={() => runAction('delete')}><Trash2 className="mr-1.5 h-4 w-4" />Xóa bản nháp</Button>}
      {roster.status === 'OPEN' && <Button type="button" disabled={Boolean(busy)} onClick={() => runAction('close')}><CheckCircle2 className="mr-1.5 h-4 w-4" />Chốt tháng</Button>}
      {roster.status === 'CLOSED' && !roster.baseline && <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setShowReopen((value) => !value)}><RotateCcw className="mr-1.5 h-4 w-4" />Mở lại</Button>}
    </>
  ) : <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách tháng</Button>;

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Chi tiết danh sách tháng" />
      <HrPageHeader title={roster?.periodStart ? `Danh sách ${formatPeriod(roster.periodStart)}` : 'Chi tiết danh sách tháng'} description={`${loading && roster ? roster.itemCount : result.totalElements} nhân sự trong danh sách`} actions={actionButtons} />
      {roster?.status && <div className="mb-4 flex flex-wrap items-center gap-2"><HrStatusBadge status={roster.status} />{roster.baseline && <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Baseline bất biến</span>}{roster.sourcePeriodStart && <span className="text-xs text-gray-500">Kế thừa từ {formatPeriod(roster.sourcePeriodStart)}</span>}</div>}
      {metadataError && <div className="mb-4"><HrError message={metadataError} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="mb-4"><HrReadOnlyNotice>{roster?.baseline ? 'T6-26 là baseline đã khóa, không thể mở lại hoặc xóa.' : roster?.status === 'OPEN' ? 'Kỳ đang mở. Khi bấm Chốt tháng, hệ thống sẽ dựng lại snapshot từ kỳ nguồn và toàn bộ Tăng/Giảm đã xác nhận.' : 'Danh sách tháng không chứa CCCD, BHXH, BHYT, địa chỉ, điện thoại hoặc lương. Dữ liệu của kỳ đã chốt chỉ được tra cứu.'}</HrReadOnlyNotice></div>
      {roster?.rosterChecksum && <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500"><span className="font-medium text-gray-700">Mã kiểm tra snapshot:</span> <span className="break-all font-mono">{roster.rosterChecksum}</span></div>}
      {showReopen && (
        <form onSubmit={reopenRoster} className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label className="block text-sm font-medium text-amber-900">Lý do mở lại<textarea required rows="3" maxLength="1000" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-gray-800" placeholder="Ví dụ: Bổ sung quyết định phát sinh muộn" /></label>
          <div className="mt-3 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setShowReopen(false); setReopenReason(''); }}>Đóng</Button><Button type="submit" disabled={busy === 'reopen'}>Xác nhận mở lại</Button></div>
        </form>
      )}
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[1120px] divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-3">STT</th><th className="px-4 py-3">Nhân sự</th><th className="px-4 py-3">Phòng ban</th><th className="px-4 py-3">Chức vụ</th><th className="px-4 py-3">Ngày vào làm</th><th className="px-4 py-3">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="6" className="px-4 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((item) => <tr key={item.id} className="hover:bg-gray-50/70"><td className="px-4 py-4 text-sm text-gray-500">{item.displayOrder}</td><td className="px-4 py-4"><p className="text-sm font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode}</p></td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.departmentName)}</td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.positionName)}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{formatHrDate(item.hireDate)}</td><td className="whitespace-nowrap px-4 py-4"><HrStatusBadge status={item.employmentStatus} label={employmentStatusLabel(item.employmentStatus)} /></td></tr>)}
            {!loading && result.content.length === 0 && <tr><td colSpan="6" className="p-5"><HrEmpty title="Snapshot chưa có nhân sự" /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">#{item.displayOrder} · {item.employeeCode}</p></div><HrStatusBadge status={item.employmentStatus} label={employmentStatusLabel(item.employmentStatus)} /></div>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs"><div><dt className="text-gray-400">Phòng ban</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.departmentName)}</dd></div><div><dt className="text-gray-400">Chức vụ</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.positionName)}</dd></div><div><dt className="text-gray-400">Ngày vào làm</dt><dd className="mt-1 font-medium text-gray-700">{formatHrDate(item.hireDate)}</dd></div></dl>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Snapshot chưa có nhân sự" />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </HrPageShell>
  );
}
