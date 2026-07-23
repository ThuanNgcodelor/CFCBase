import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, FileSearch, RotateCcw, ShieldAlert, Upload } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrReadOnlyNotice, HrStatusBadge } from '../../components/hr/HrUi';
import { HrWorkforceSnapshotImport } from '../../components/hr/HrWorkforceSnapshotImport';
import { hrImportApi } from '../../api/hrImportApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime, nonEmpty } from '../../utils/hr';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function batchDate(batch) {
  return batch.confirmedAt || batch.validatedAt || batch.parsedAt || batch.createdAt;
}

function batchTitle(batch) {
  return batch?.importType === 'ROSTER'
    ? 'Cập nhật danh sách T7-26'
    : 'Dữ liệu ban đầu T6-26';
}

function BatchCard({ batch, selected, onSelect }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{batchTitle(batch)}</p>
          <p className="mt-1 truncate text-xs text-gray-500" title={batch.batchId || batch.id}>{batch.batchId || batch.id}</p>
        </div>
        <HrStatusBadge status={batch.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{batch.totalRows ?? 0} dòng</span>
        <span>{formatHrDateTime(batchDate(batch))}</span>
      </div>
    </button>
  );
}

function SummaryNumber({ label, value, tone = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-800', green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800', red: 'bg-red-50 text-red-800', blue: 'bg-blue-50 text-blue-800',
  };
  return <div className={`rounded-lg p-3 ${colors[tone]}`}><p className="text-xs opacity-70">{label}</p><p className="mt-1 text-xl font-semibold">{value ?? 0}</p></div>;
}

export default function HrImports() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [listPage, setListPage] = useState(0);
  const [batches, setBatches] = useState(normalizePage(null));
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [confirmationKey, setConfirmationKey] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [listError, setListError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryBatchId, setRecoveryBatchId] = useState('');
  const [recoveryTotalRows, setRecoveryTotalRows] = useState('');
  const [showLegacyUpload, setShowLegacyUpload] = useState(false);

  const loadList = useCallback((signal) => {
    setLoadingList(true);
    setListError('');
    return hrImportApi.getImports({ page: listPage, size: 20, sort: 'createdAt,desc' }, { signal })
      .then((data) => {
        const normalized = normalizePage(data);
        setBatches(normalized);
        if (!selectedId && normalized.content.length > 0) {
          setSelectedId(normalized.content[0].batchId || normalized.content[0].id);
        }
      })
      .catch((requestError) => {
        if (!signal?.aborted) setListError(apiErrorMessage(requestError, 'Không thể tải lịch sử nhập dữ liệu.'));
      })
      .finally(() => {
        if (!signal?.aborted) setLoadingList(false);
      });
  }, [listPage, selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    loadList(controller.signal);
    return () => controller.abort();
  }, [loadList, reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoadingPreview(true);
    setPreviewError('');
    hrImportApi.getPreview(selectedId, previewPage, 20, { signal: controller.signal })
      .then(setPreview)
      .catch((requestError) => {
        if (!controller.signal.aborted) setPreviewError(apiErrorMessage(requestError, 'Không thể tải dữ liệu xem trước. Nội dung xem trước có thể đã hết thời hạn lưu.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreview(false);
      });
    return () => controller.abort();
  }, [previewPage, selectedId, reloadKey]);

  const selectedBatch = useMemo(() => {
    const previewBatchId = preview?.batch?.batchId || preview?.batch?.id;
    const listedBatch = batches.content.find((batch) => (batch.batchId || batch.id) === selectedId) || null;
    if (preview?.batch && previewBatchId === selectedId) {
      return { ...listedBatch, ...preview.batch };
    }
    return listedBatch;
  }, [batches.content, preview, selectedId]);

  const selectBatch = (batch) => {
    setSelectedId(batch.batchId || batch.id);
    setPreview(null);
    setPreviewPage(0);
    setAcceptWarnings(false);
    setConfirmationKey('');
    setShowRecovery(false);
    setRecoveryBatchId('');
    setRecoveryTotalRows('');
  };

  const chooseFile = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null);
      toast.error('Chỉ chấp nhận file Excel .xlsx');
      event.target.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      toast.error('File không được vượt quá 10 MB');
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file) return;
    setBusyAction('upload');
    try {
      const batch = await hrImportApi.uploadBaseline(file);
      const batchId = batch.batchId || batch.id;
      setSelectedId(batchId);
      setPreview(null);
      setPreviewPage(0);
      setShowRecovery(false);
      setRecoveryBatchId('');
      setRecoveryTotalRows('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast.success('Đã tải file và tạo dữ liệu xem trước. Chưa ghi dữ liệu vào danh sách nhân sự.');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải hoặc đọc file dữ liệu ban đầu.'));
    } finally {
      setBusyAction('');
    }
  };

  const validateBatch = async () => {
    setBusyAction('validate');
    try {
      await hrImportApi.validate(selectedId);
      toast.success('Đã kiểm tra toàn bộ lần nhập');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể kiểm tra lần nhập.'));
    } finally {
      setBusyAction('');
    }
  };

  const confirmBatch = async () => {
    if ((selectedBatch?.warningRows || 0) > 0 && !acceptWarnings) {
      toast.error('Bạn phải xác nhận đã đọc các cảnh báo trước khi import.');
      return;
    }
    const key = confirmationKey || (crypto.randomUUID?.() || `hr-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    setConfirmationKey(key);
    setBusyAction('confirm');
    try {
      await hrImportApi.confirm(selectedId, { confirmationKey: key, acceptWarnings });
      toast.success('Đã xác nhận nhập dữ liệu ban đầu');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xác nhận nhập dữ liệu.'));
    } finally {
      setBusyAction('');
    }
  };

  const rollbackBatch = async () => {
    const matchesBatch = recoveryBatchId.trim() === selectedId;
    const matchesRowCount = recoveryTotalRows.trim() === String(selectedBatch?.totalRows ?? '');
    if (!matchesBatch || !matchesRowCount) {
      toast.error('Mã lần nhập hoặc tổng số dòng xác nhận chưa chính xác.');
      return;
    }
    setBusyAction('rollback');
    try {
      await hrImportApi.rollback(selectedId);
      toast.success('Đã hoàn tác lần nhập và giữ lại nhật ký thay đổi');
      setShowRecovery(false);
      setRecoveryBatchId('');
      setRecoveryTotalRows('');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể hoàn tác lần nhập.'));
    } finally {
      setBusyAction('');
    }
  };

  const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
  const previewTotalPages = Number(preview?.totalPages || 0);
  const previewTotalElements = Number(preview?.totalElements || 0);

  return (
    <div className="w-full">
      <SEOHead title="CFC Base | Nhập dữ liệu nhân sự" url="https://cfcbooking.io.vn/manager/hr/imports" />
      <HrPageHeader title="Nhập dữ liệu nhân sự" description="Dùng file baseline T6-26 · 339 nhân sự để khởi tạo dữ liệu HR lần đầu. Hệ thống luôn kiểm tra file trước khi cho xác nhận." />

      <HrWorkforceSnapshotImport onImported={() => setReloadKey((value) => value + 1)} />

      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Nhập file mẫu cũ hoặc khôi phục nâng cao</h2>
            <p className="mt-1 text-xs text-gray-500">Không dùng mục này cho file <strong>workforce-baseline-339-2026.xlsx</strong>.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowLegacyUpload((current) => !current)}>
            {showLegacyUpload ? 'Ẩn mục nâng cao' : 'Mở mục nâng cao'}
          </Button>
        </div>

        {showLegacyUpload && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Tải file dữ liệu cũ đã khóa</h3>
                <p className="mt-1 text-sm text-gray-500">Chỉ dùng cho template cũ đã được phát hành trước đó. File 339 dùng khung phía trên.</p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} className="block min-w-0 max-w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200" />
                <Button type="button" onClick={upload} disabled={!file || Boolean(busyAction)}><Upload className="mr-1.5 h-4 w-4" />{busyAction === 'upload' ? 'Đang tải...' : 'Tải và đọc file cũ'}</Button>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Lịch sử nhập dữ liệu</h2>
          <p className="mt-1 text-xs text-gray-500">Tối đa 20 lần nhập mỗi trang.</p>
          {listError && <div className="mt-3"><HrError message={listError} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
          <div className="mt-4 space-y-2">
            {loadingList ? <p className="py-8 text-center text-sm text-gray-500">Đang tải...</p> : batches.content.map((batch) => (
              <BatchCard key={batch.batchId || batch.id} batch={batch} selected={(batch.batchId || batch.id) === selectedId} onSelect={() => selectBatch(batch)} />
            ))}
            {!loadingList && batches.content.length === 0 && <HrEmpty title="Chưa có lần nhập dữ liệu" />}
          </div>
          <div className="mt-3"><HrPagination page={listPage} totalPages={batches.totalPages} totalElements={batches.totalElements} loading={loadingList} onPageChange={setListPage} /></div>
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedId ? <HrEmpty title="Chọn một lần nhập để xem" description="Hoặc tải file dữ liệu ban đầu để bắt đầu." /> : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-gray-900">Lần nhập đang chọn</h2>{selectedBatch?.status && <HrStatusBadge status={selectedBatch.status} />}</div>
                    <p className="mt-2 break-all text-xs text-gray-500">{selectedId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedBatch?.importType !== 'ROSTER' && selectedBatch?.status === 'PARSED' && <Button type="button" variant="secondary" disabled={Boolean(busyAction)} onClick={validateBatch}><FileSearch className="mr-1.5 h-4 w-4" />{busyAction === 'validate' ? 'Đang kiểm tra...' : 'Kiểm tra toàn bộ'}</Button>}
                    {selectedBatch?.importType !== 'ROSTER' && selectedBatch?.status === 'VALIDATED' && <Button type="button" disabled={Boolean(busyAction) || (selectedBatch.invalidRows || 0) > 0} onClick={confirmBatch}><CheckCircle2 className="mr-1.5 h-4 w-4" />{busyAction === 'confirm' ? 'Đang xác nhận...' : 'Xác nhận nhập dữ liệu'}</Button>}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <SummaryNumber label="Tổng dòng" value={selectedBatch?.totalRows} />
                  <SummaryNumber label="Hợp lệ" value={selectedBatch?.validRows} tone="green" />
                  <SummaryNumber label="Cảnh báo" value={selectedBatch?.warningRows} tone="amber" />
                  <SummaryNumber label="Không hợp lệ" value={selectedBatch?.invalidRows} tone="red" />
                  <SummaryNumber label="Đã nhập" value={selectedBatch?.importedRows} tone="blue" />
                </div>

                {selectedBatch?.status === 'VALIDATED' && (selectedBatch.warningRows || 0) > 0 && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <input type="checkbox" checked={acceptWarnings} onChange={(event) => setAcceptWarnings(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-600" />
                    <span>Tôi đã xem các dòng cảnh báo và chấp nhận dữ liệu thiếu được giữ là trống; hệ thống không tự bịa giá trị.</span>
                  </label>
                )}

                {selectedBatch?.status === 'CONFIRMED' && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3 text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">{selectedBatch.importType === 'ROSTER' ? 'Cập nhật nhân sự 339 đã được áp dụng' : 'Dữ liệu ban đầu đã được nhập thành công'}</p>
                        <p className="mt-1 text-sm">{selectedBatch.importType === 'ROSTER' ? `Đã áp dụng ${selectedBatch.importedRows ?? 0} biến động Tăng/Giảm. T6-26 vẫn được giữ nguyên.` : `Đã ghi ${selectedBatch.importedRows ?? 0} hồ sơ. Bạn có thể kiểm tra tại Danh sách nhân sự và Danh sách tháng.`}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => navigate('/manager/hr/employees')}>Xem nhân sự</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/manager/hr/rosters')}>Xem danh sách tháng</Button>
                    </div>
                  </div>
                )}
              </div>

              {selectedBatch?.importType !== 'ROSTER' && selectedBatch?.status === 'CONFIRMED' && (
                <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowRecovery((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-red-700"
                    aria-expanded={showRecovery}
                  >
                    <span className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />Khôi phục dữ liệu nâng cao</span>
                    <span className="text-xs font-normal text-gray-500">{showRecovery ? 'Đóng' : 'Mở'}</span>
                  </button>

                  {showRecovery && (
                    <div className="mt-4 border-t border-red-100 pt-4">
                      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <p>Thao tác này có thể xóa toàn bộ hồ sơ do lần nhập tạo ra. Hệ thống chỉ chấp nhận khi chưa có dữ liệu phát sinh phía sau. Hãy nhập đúng mã lần nhập và tổng số dòng để xác nhận.</p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-gray-700">Mã lần nhập</span>
                          <input value={recoveryBatchId} onChange={(event) => setRecoveryBatchId(event.target.value)} placeholder={selectedId} className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-gray-700">Tổng số dòng ({selectedBatch.totalRows ?? 0})</span>
                          <input inputMode="numeric" value={recoveryTotalRows} onChange={(event) => setRecoveryTotalRows(event.target.value.replace(/\D/g, ''))} placeholder={String(selectedBatch.totalRows ?? 0)} className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                        </label>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="danger"
                          disabled={Boolean(busyAction) || recoveryBatchId.trim() !== selectedId || recoveryTotalRows.trim() !== String(selectedBatch.totalRows ?? '')}
                          onClick={rollbackBatch}
                        >
                          <RotateCcw className="mr-1.5 h-4 w-4" />{busyAction === 'rollback' ? 'Đang hoàn tác...' : 'Xác nhận hoàn tác lần nhập'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <HrReadOnlyNotice>
                Bảng xem trước chỉ hiển thị mã, họ tên, phòng ban, chức vụ và lỗi kiểm tra. CCCD, BHXH, BHYT, địa chỉ, điện thoại và lương không xuất hiện trong bảng.
              </HrReadOnlyNotice>

              {previewError && <HrError message={previewError} onRetry={() => setReloadKey((value) => value + 1)} />}

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <tr><th className="px-4 py-3">Dòng</th><th className="px-4 py-3">Nhân sự</th><th className="px-4 py-3">Phòng ban / chức vụ</th><th className="px-4 py-3">Kết quả</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingPreview ? <tr><td colSpan="4" className="px-4 py-12 text-center text-sm text-gray-500">Đang tải xem trước...</td></tr> : previewRows.map((row) => (
                      <tr key={row.sourceRowNumber} className="align-top hover:bg-gray-50/70">
                        <td className="px-4 py-4 text-sm text-gray-500">{row.sourceRowNumber}</td>
                        <td className="px-4 py-4"><p className="text-sm font-medium text-gray-900">{nonEmpty(row.data?.fullName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(row.data?.employeeCode)}</p></td>
                        <td className="px-4 py-4"><p className="text-sm text-gray-700">{nonEmpty(row.data?.departmentName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(row.data?.positionName)}</p></td>
                        <td className="px-4 py-4"><HrStatusBadge status={row.status} />{row.issues?.length > 0 && <ul className="mt-2 max-w-md space-y-1 text-xs text-gray-600">{row.issues.map((issue, index) => <li key={`${issue.code}-${issue.cell}-${index}`}><span className={issue.severity === 'ERROR' ? 'text-red-600' : 'text-amber-700'}>{issue.cell || issue.field || issue.code}:</span> {issue.message}</li>)}</ul>}</td>
                      </tr>
                    ))}
                    {!loadingPreview && previewRows.length === 0 && <tr><td colSpan="4" className="p-5"><HrEmpty title="Không còn dữ liệu xem trước" description="Nội dung xem trước có thể đã được xóa tự động sau thời hạn lưu." /></td></tr>}
                  </tbody>
                </table>
              </div>

              <HrPagination page={previewPage} totalPages={previewTotalPages} totalElements={previewTotalElements} loading={loadingPreview} onPageChange={setPreviewPage} />

              {selectedBatch?.status === 'FAILED' && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><ShieldAlert className="h-5 w-5 shrink-0" /><p>Lần nhập thất bại và không thể xác nhận. Hãy sửa file đúng mẫu rồi tải lại.</p></div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
