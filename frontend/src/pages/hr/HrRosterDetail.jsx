import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, formatPeriod, nonEmpty } from '../../utils/hr';

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

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
  const [leaveModal, setLeaveModal] = useState({ open: false, item: null });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveData, setLeaveData] = useState(null);
  const [leaveForm, setLeaveForm] = useState({ manualOverrideDays: '', note: '' });

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

  const rosterYear = useMemo(() => {
    const year = Number(String(roster?.periodStart || '').slice(0, 4));
    return Number.isFinite(year) ? year : null;
  }, [roster?.periodStart]);

  const closeLeaveModal = () => {
    if (leaveSaving) return;
    setLeaveModal({ open: false, item: null });
    setLeaveData(null);
    setLeaveError('');
    setLeaveForm({ manualOverrideDays: '', note: '' });
  };

  const openLeaveModal = async (item) => {
    if (!rosterYear) {
      toast.error('Không xác định được năm để chỉnh ngày phép.');
      return;
    }
    setLeaveModal({ open: true, item });
    setLeaveLoading(true);
    setLeaveError('');
    try {
      const data = await hrActivityApi.getLeaveEntitlement(item.employeeId, rosterYear);
      setLeaveData(data);
      setLeaveForm({
        manualOverrideDays: data.manualOverrideDays ?? '',
        note: data.note || '',
      });
    } catch (requestError) {
      setLeaveError(apiErrorMessage(requestError, 'Không thể tải số ngày nghỉ phép.'));
    } finally {
      setLeaveLoading(false);
    }
  };

  const saveLeaveEntitlement = async (event) => {
    event.preventDefault();
    if (!leaveModal.item || !leaveData) return;
    setLeaveSaving(true);
    try {
      await hrActivityApi.updateLeaveEntitlement(leaveModal.item.employeeId, {
        leaveYear: leaveData.leaveYear,
        rowVersion: leaveData.rowVersion ?? 0,
        manualOverrideDays: leaveForm.manualOverrideDays === '' ? null : Number(leaveForm.manualOverrideDays),
        note: leaveForm.note.trim() || null,
      });
      toast.success(`Đã cập nhật ngày phép năm ${leaveData.leaveYear}.`);
      closeLeaveModal();
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu ngày nghỉ phép.'));
    } finally {
      setLeaveSaving(false);
    }
  };

  const previewFinalDays = leaveForm.manualOverrideDays === ''
    ? leaveData?.calculatedDays
    : leaveForm.manualOverrideDays;

  const actionButtons = roster ? (
    <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách tháng</Button>
  ) : <Button type="button" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}><ArrowLeft className="mr-1.5 h-4 w-4" />Danh sách tháng</Button>;

  return (
      <HrPageShell>
        <SEOHead title="CFC Base | Chi tiết danh sách tháng" />
      <HrPageHeader title={roster?.periodStart ? `Danh sách ${formatPeriod(roster.periodStart)}` : 'Chi tiết danh sách tháng'} description={`${loading && roster ? roster.itemCount : result.totalElements} nhân sự tính đến cuối tháng`} actions={actionButtons} />
      {roster?.periodStart && <div className="mb-4 flex flex-wrap items-center gap-2"><span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Tự động tính</span>{roster.baseline && <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Nền T6</span>}</div>}
      {metadataError && <div className="mb-4"><HrError message={metadataError} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="mb-4"><HrReadOnlyNotice>Danh sách này được tính tự động từ dữ liệu nền T6-26 và các Tăng/Giảm đã xác nhận theo ngày hiệu lực. Riêng ngày phép năm có thể chỉnh tay theo từng nhân sự; export tháng và export năm sẽ lấy đúng số cuối cùng của năm đó.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hr-responsive-table hr-responsive-table--wide cfc-scrollbar overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1280px] divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-3">STT</th><th className="px-4 py-3">Nhân sự</th><th className="px-4 py-3">Phòng ban</th><th className="px-4 py-3">Chức vụ</th><th className="px-4 py-3">Ngày vào làm</th><th className="px-4 py-3">Ngày phép</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((item) => <tr key={item.id} className="hover:bg-gray-50/70"><td className="px-4 py-4 text-sm text-gray-500">{item.displayOrder}</td><td className="px-4 py-4"><p className="text-sm font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">{item.employeeCode}</p></td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.departmentName)}</td><td className="px-4 py-4 text-sm text-gray-700">{nonEmpty(item.positionName)}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{formatHrDate(item.hireDate)}</td><td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-emerald-700">{nonEmpty(item.leaveDays)}</td><td className="whitespace-nowrap px-4 py-4"><HrStatusBadge status={item.employmentStatus} label={employmentStatusLabel(item.employmentStatus)} /></td><td className="whitespace-nowrap px-4 py-4 text-right"><Button type="button" size="sm" variant="secondary" onClick={() => openLeaveModal(item)}>Sửa phép</Button></td></tr>)}
            {!loading && result.content.length === 0 && <tr><td colSpan="8" className="p-5"><HrEmpty title="Snapshot chưa có nhân sự" /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="hr-responsive-cards hr-responsive-cards--wide space-y-3">
        {loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-gray-900">{item.fullName}</p><p className="mt-1 text-xs text-gray-500">#{item.displayOrder} · {item.employeeCode}</p></div><HrStatusBadge status={item.employmentStatus} label={employmentStatusLabel(item.employmentStatus)} /></div>
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs"><div><dt className="text-gray-400">Phòng ban</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.departmentName)}</dd></div><div><dt className="text-gray-400">Chức vụ</dt><dd className="mt-1 font-medium text-gray-700">{nonEmpty(item.positionName)}</dd></div><div><dt className="text-gray-400">Ngày vào làm</dt><dd className="mt-1 font-medium text-gray-700">{formatHrDate(item.hireDate)}</dd></div><div><dt className="text-gray-400">Ngày phép</dt><dd className="mt-1 font-medium text-emerald-700">{nonEmpty(item.leaveDays)}</dd></div></dl>
            <div className="mt-3 border-t border-gray-100 pt-3"><Button type="button" size="sm" variant="secondary" onClick={() => openLeaveModal(item)}>Sửa ngày phép năm</Button></div>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Snapshot chưa có nhân sự" />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>

      <Modal isOpen={leaveModal.open} onClose={closeLeaveModal} title={leaveModal.item ? `Ngày phép ${leaveModal.item.fullName}` : 'Ngày phép năm'}>
        {leaveLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Đang tải số ngày nghỉ phép...</div>
        ) : leaveError ? (
          <HrError message={leaveError} onRetry={() => leaveModal.item && openLeaveModal(leaveModal.item)} />
        ) : leaveData ? (
          <form onSubmit={saveLeaveEntitlement} className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Năm</p><p className="mt-1 font-semibold text-gray-800">{leaveData.leaveYear}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Điều kiện lao động</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.workingConditionName)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Ngày phép nền</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.baseDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Thâm niên cộng thêm</p><p className="mt-1 font-semibold text-gray-800">{nonEmpty(leaveData.seniorityBonusDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Tự tính</p><p className="mt-1 font-semibold text-emerald-700">{nonEmpty(leaveData.calculatedDays)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-gray-400">Số cuối cùng</p><p className="mt-1 font-semibold text-blue-700">{nonEmpty(previewFinalDays)}</p></div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Chỉnh tay ngày phép</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={leaveForm.manualOverrideDays}
                onChange={(event) => setLeaveForm((current) => ({ ...current, manualOverrideDays: event.target.value }))}
                className={INPUT_CLASS}
                placeholder="Để trống để dùng số tự tính"
              />
              <span className="text-xs text-gray-500">Ví dụ hệ thống tính `16`, bạn có thể nhập `15`. Để trống nếu muốn quay về tự động.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Ghi chú</span>
              <textarea
                value={leaveForm.note}
                onChange={(event) => setLeaveForm((current) => ({ ...current, note: event.target.value }))}
                className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Ví dụ: điều chỉnh theo quyết định nội bộ"
              />
            </label>
            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLeaveForm((current) => ({ ...current, manualOverrideDays: '', note: '' }))}
                disabled={leaveSaving}
              >
                Trả về tự động
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={closeLeaveModal} disabled={leaveSaving}>Hủy</Button>
                <Button type="submit" disabled={leaveSaving}>{leaveSaving ? 'Đang lưu...' : 'Lưu ngày phép'}</Button>
              </div>
            </div>
          </form>
        ) : null}
      </Modal>
    </HrPageShell>
  );
}
