import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Search,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrEmpty } from './HrUi';
import { exportReconcileXlsx, parseNightRewardXlsx, reconcile } from '../../utils/nightRewardReconcile';

const statusText = {
  QUALIFIED: 'Đạt điều kiện',
  QUALIFIED_EXCEPTION: 'Đạt ngoại lệ',
  NOT_QUALIFIED: 'Chưa đạt',
  EXCLUDED: 'Không áp dụng',
  STALE: 'Cần chốt lại',
  DRAFT: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};
const label = (value) => statusText[value] || value || '—';

export function HrNightRewardReconcileModal({ isOpen, onClose, month, systemEmployees }) {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('upload'); // 'upload' | 'result'
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [tabFilter, setTabFilter] = useState('all'); // 'all' | 'diff' | 'match' | 'onlyXn' | 'onlySys'
  const [searchTerm, setSearchTerm] = useState('');

  const reset = () => {
    setStep('upload');
    setFileName('');
    setResult(null);
    setTabFilter('all');
    setSearchTerm('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = async (file) => {
    if (!file || !file.name.match(/\.xlsx?$/i)) {
      toast.error('Vui lòng chọn file định dạng .xlsx hoặc .xls');
      return;
    }
    setParsing(true);
    setFileName(file.name);
    try {
      const xlsRows = await parseNightRewardXlsx(file);
      if (!xlsRows.length) {
        toast.error('File không có dữ liệu nhân viên.');
        setParsing(false);
        return;
      }
      const rec = reconcile(xlsRows, systemEmployees || []);
      setResult(rec);
      setStep('result');
    } catch (err) {
      toast.error(err.message || 'Không đọc được file.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) processFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    try {
      exportReconcileXlsx(result, month);
      toast.success('Đã xuất file đối soát ca đêm!');
    } catch (err) {
      toast.error('Xuất file thất bại: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const filteredMatched = useMemo(() => {
    if (!result) return [];
    let list = result.matched;
    if (tabFilter === 'diff') list = list.filter((r) => !r.caDemMatch);
    if (tabFilter === 'match') list = list.filter((r) => r.caDemMatch);

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.xnMaNV.toLowerCase().includes(q) ||
          r.xnHoTen.toLowerCase().includes(q) ||
          r.sysMaNV?.toLowerCase().includes(q) ||
          r.sysHoTen?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [result, tabFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4" role="presentation">
      <div
        className="fixed inset-0 bg-[var(--cfc-navy)]/50 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <section
        aria-labelledby="reconcile-modal-title"
        aria-modal="true"
        className="relative z-50 flex max-h-[92dvh] w-full max-w-6xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="reconcile-modal-title" className="text-lg font-semibold text-gray-900">
                Rà soát Excel ca đêm — Tháng {month}
              </h2>
              <p className="text-xs text-gray-500">
                So sánh danh sách từ xí nghiệp với hệ thống để phát hiện lệch ca trước khi chốt thưởng
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-slate-100 hover:text-gray-700"
            onClick={handleClose}
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Modal body */}
        <div className="cfc-scrollbar min-h-0 flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-8 sm:p-12">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-gray-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/20'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {parsing ? 'Đang đọc và phân tích file...' : 'Tải lên file Excel từ xí nghiệp'}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Kéo thả file vào đây hoặc bấm để chọn file .xlsx · Cột yêu cầu: MV, Họ và tên, Công ca đêm, Tích 12, Tích 24
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" className="pointer-events-none mt-1">
                  Chọn file từ máy tính
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-5 p-6">
              {/* Stat summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">File xí nghiệp</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {result.summary.total} <span className="text-xs font-normal text-gray-500">người</span>
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-4 ${
                    result.summary.diffCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      result.summary.diffCount > 0 ? 'text-amber-800' : 'text-emerald-800'
                    }`}
                  >
                    Lệch ca đêm
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      result.summary.diffCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {result.summary.diffCount}{' '}
                    <span className="text-xs font-normal opacity-80">người</span>
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-4 ${
                    result.summary.onlyInXN > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-slate-50'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      result.summary.onlyInXN > 0 ? 'text-orange-800' : 'text-gray-500'
                    }`}
                  >
                    Chỉ trong file XN
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      result.summary.onlyInXN > 0 ? 'text-orange-700' : 'text-gray-900'
                    }`}
                  >
                    {result.summary.onlyInXN}{' '}
                    <span className="text-xs font-normal opacity-80">người</span>
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-4 ${
                    result.summary.onlyInSystem > 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-slate-50'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      result.summary.onlyInSystem > 0 ? 'text-blue-800' : 'text-gray-500'
                    }`}
                  >
                    Chỉ trong hệ thống
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      result.summary.onlyInSystem > 0 ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {result.summary.onlyInSystem}{' '}
                    <span className="text-xs font-normal opacity-80">người</span>
                  </p>
                </div>
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setTabFilter('all')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tabFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Tất cả ({result.matched.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabFilter('diff')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tabFilter === 'diff' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    Lệch ca ({result.summary.diffCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabFilter('match')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tabFilter === 'match' ? 'bg-emerald-600 text-white' : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    Khớp ({result.matched.length - result.summary.diffCount})
                  </button>
                  {result.onlyInXN.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTabFilter('onlyXn')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        tabFilter === 'onlyXn' ? 'bg-orange-600 text-white' : 'text-orange-800 hover:bg-orange-50'
                      }`}
                    >
                      Chỉ ở XN ({result.onlyInXN.length})
                    </button>
                  )}
                  {result.onlyInSystem.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTabFilter('onlySys')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        tabFilter === 'onlySys' ? 'bg-blue-600 text-white' : 'text-blue-800 hover:bg-blue-50'
                      }`}
                    >
                      Chỉ ở HT ({result.onlyInSystem.length})
                    </button>
                  )}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm mã NV hoặc họ tên..."
                    className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Main table: Matched rows */}
              {(tabFilter === 'all' || tabFilter === 'diff' || tabFilter === 'match') && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-[960px] w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th colSpan={5} className="bg-slate-100 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 border-r border-gray-200">
                          Xí Nghiệp
                        </th>
                        <th className="w-2 bg-gray-100" />
                        <th colSpan={5} className="bg-blue-50 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-blue-800 border-r border-gray-200">
                          Hệ Thống
                        </th>
                        <th colSpan={2} className="bg-emerald-50 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Đối Soát & Chênh Lệch
                        </th>
                      </tr>
                      <tr className="border-b border-gray-200 bg-gray-50/90 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        <th className="px-3 py-2.5">Mã NV</th>
                        <th className="px-3 py-2.5">Họ và tên</th>
                        <th className="px-3 py-2.5 text-center">Ca đêm</th>
                        <th className="px-3 py-2.5 text-center">Tích 12</th>
                        <th className="px-3 py-2.5 text-center border-r border-gray-200">Tích 24</th>
                        <th className="w-2 bg-gray-100" />
                        <th className="px-3 py-2.5">Mã NV</th>
                        <th className="px-3 py-2.5">Họ và tên</th>
                        <th className="px-3 py-2.5 text-center">Ca đêm</th>
                        <th className="px-3 py-2.5 text-center">Tích 12</th>
                        <th className="px-3 py-2.5 text-center border-r border-gray-200">Tích 24</th>
                        <th className="px-3 py-2.5 text-center">Chênh lệch</th>
                        <th className="px-3 py-2.5">Ghi chú đối soát</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredMatched.map((r) => {
                        const rowCls = r.caDemMatch ? 'hover:bg-slate-50' : 'bg-amber-50/50 hover:bg-amber-50';
                        return (
                          <tr key={r.xnMaNV} className={`${rowCls} transition-colors`}>
                            <td className="px-3 py-2.5 font-medium text-gray-900">{r.xnMaNV}</td>
                            <td className="px-3 py-2.5 text-gray-800">{r.xnHoTen}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-900">
                              {r.xnCaDem ?? <span className="font-normal text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500">
                              {r.xnTich12Rate ? r.xnTich12Rate.toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500 border-r border-gray-200">
                              {r.xnTich24Rate ? r.xnTich24Rate.toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="w-2 bg-gray-100" />
                            <td className="px-3 py-2.5 font-medium text-gray-900">{r.sysMaNV}</td>
                            <td className="px-3 py-2.5 text-gray-800">{r.sysHoTen}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-900">{r.sysCaDem ?? '—'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-700">
                              {r.sysTich12Months ?? '—'}<span className="ml-0.5 text-gray-400"> th</span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-700 border-r border-gray-200">
                              {r.sysTich24Months ?? '—'}<span className="ml-0.5 text-gray-400"> th</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.diffCaDem === null ? (
                                <span className="text-gray-400">—</span>
                              ) : r.diffCaDem === 0 ? (
                                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                  Khớp
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                    r.diffCaDem > 0
                                      ? 'border-amber-300 bg-amber-100 text-amber-800'
                                      : 'border-red-300 bg-red-100 text-red-800'
                                  }`}
                                >
                                  {r.diffCaDem > 0 ? `+${r.diffCaDem}` : r.diffCaDem} ca
                                </span>
                              )}
                            </td>
                            <td className="max-w-[240px] px-3 py-2.5 text-gray-600">{r.note}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!filteredMatched.length && (
                    <div className="p-8">
                      <HrEmpty
                        title="Không tìm thấy nhân viên phù hợp"
                        description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem danh sách."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Only in XN view */}
              {tabFilter === 'onlyXn' && (
                <div className="overflow-x-auto rounded-xl border border-orange-200 bg-white shadow-sm">
                  <div className="border-b border-orange-100 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-semibold text-orange-900">
                      Có trong file xí nghiệp gửi nhưng KHÔNG tìm thấy trong hệ thống ({result.onlyInXN.length} người)
                    </p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">STT</th>
                        <th className="px-4 py-2.5">Mã NV</th>
                        <th className="px-4 py-2.5">Họ và tên</th>
                        <th className="px-4 py-2.5 text-center">Ca đêm</th>
                        <th className="px-4 py-2.5 text-center">Tích 12 (mức)</th>
                        <th className="px-4 py-2.5 text-center">Tích 24 (mức)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.onlyInXN.map((r, i) => (
                        <tr key={r.maNV} className="hover:bg-orange-50/40">
                          <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-orange-900">{r.maNV}</td>
                          <td className="px-4 py-2.5 text-gray-900">{r.hoTen}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-gray-900">{r.caDem ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {r.tich12Rate ? r.tich12Rate.toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-600">
                            {r.tich24Rate ? r.tich24Rate.toLocaleString('vi-VN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Only in System view */}
              {tabFilter === 'onlySys' && (
                <div className="overflow-x-auto rounded-xl border border-blue-200 bg-white shadow-sm">
                  <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold text-blue-900">
                      Có trong hệ thống tháng {month} nhưng KHÔNG có trong file xí nghiệp gửi ({result.onlyInSystem.length} người)
                    </p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">STT</th>
                        <th className="px-4 py-2.5">Mã NV</th>
                        <th className="px-4 py-2.5">Họ và tên</th>
                        <th className="px-4 py-2.5 text-center">Ca đêm HT</th>
                        <th className="px-4 py-2.5 text-center">Tích 12 (tháng)</th>
                        <th className="px-4 py-2.5 text-center">Tích 24 (tháng)</th>
                        <th className="px-4 py-2.5">Trạng thái HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.onlyInSystem.map((r, i) => (
                        <tr key={r.sysMaNV} className="hover:bg-blue-50/40">
                          <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-blue-900">{r.sysMaNV}</td>
                          <td className="px-4 py-2.5 text-gray-900">{r.sysHoTen}</td>
                          <td className="px-4 py-2.5 text-center font-medium text-gray-900">{r.sysCaDem ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center text-gray-700">{r.sysTich12Months ?? '—'} th</td>
                          <td className="px-4 py-2.5 text-center text-gray-700">{r.sysTich24Months ?? '—'} th</td>
                          <td className="px-4 py-2.5 text-gray-600">{label(r.sysStatus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
          <p className="text-xs text-gray-500">
            {result ? (
              <span>
                File: <strong className="text-gray-800">{fileName}</strong> · Tổng cộng <strong>{result.summary.total}</strong> dòng từ xí nghiệp
              </span>
            ) : (
              'Chọn file .xlsx từ xí nghiệp để bắt đầu đối soát'
            )}
          </p>
          <div className="flex gap-2">
            {step === 'result' && (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={reset}>
                  <Upload className="h-4 w-4" />
                  Chọn file khác
                </Button>
                <Button type="button" size="sm" disabled={exporting} onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  {exporting ? 'Đang xuất...' : 'Xuất file đối soát Excel'}
                </Button>
              </>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Đóng
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
