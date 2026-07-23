import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, FileSearch, Upload, Users } from 'lucide-react';
import { hrImportApi } from '../../api/hrImportApi';
import { apiErrorMessage } from '../../utils/hr';
import { Button } from '../ui/Button';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const EXPECTED_FILE_NAME = 'workforce-baseline-339-2026.xlsx';

function confirmationKey() {
  return globalThis.crypto?.randomUUID?.()
    || `workforce-snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function HrWorkforceSnapshotImport({ onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmCount, setConfirmCount] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [busy, setBusy] = useState('');

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setPreview(null);
    setResult(null);
    setConfirmCount('');
    setRequestKey('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Chỉ chấp nhận file Excel .xlsx');
      event.target.value = '';
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File không được vượt quá 10 MB');
      event.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const previewFile = async () => {
    if (!file) return;
    setBusy('preview');
    try {
      const data = await hrImportApi.previewWorkforceSnapshot(file);
      setPreview(data);
      setResult(null);
      setRequestKey(confirmationKey());
      if (data.applicable) {
        toast.success('File hợp lệ: sẵn sàng tạo baseline T6-26 gồm 339 nhân sự.');
      }
      else toast.error('File hoặc trạng thái dữ liệu hiện tại chưa đủ điều kiện nhập.');
    } catch (requestError) {
      setPreview(null);
      toast.error(apiErrorMessage(requestError, `Không thể đọc file. Hãy dùng đúng ${EXPECTED_FILE_NAME}.`));
    } finally {
      setBusy('');
    }
  };

  const confirmImport = async () => {
    if (!file || !preview?.applicable || confirmCount !== '339') {
      toast.error('Hãy xem trước file và nhập đúng số 339 để xác nhận.');
      return;
    }
    const question = 'Tạo và chốt baseline T6-26 gồm 339 nhân sự? Dữ liệu HR hiện tại phải đang trống.';
    if (!window.confirm(question)) return;
    setBusy('confirm');
    try {
      const data = await hrImportApi.confirmWorkforceSnapshot(file, {
        confirmationKey: requestKey || confirmationKey(),
        expectedActiveEmployees: 339,
      });
      setResult(data);
      toast.success('Đã import thành công baseline T6-26 gồm 339 nhân sự.');
      onImported?.();
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể áp dụng file cập nhật 339.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="mb-5 rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Nhập baseline T6-26 · 339 nhân sự</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Dùng đúng file <strong>{EXPECTED_FILE_NAME}</strong>. Đây là dữ liệu lịch sử đúng: T6-26 có 339 nhân sự. Hệ thống chỉ cho import khi miền HR đang trống.
          </p>
          <p className="mt-1 text-xs text-gray-400">Không tạo T7-26, không tự sinh Tăng/Giảm và không có hồ sơ lịch sử giả.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={chooseFile}
            className="block min-w-0 max-w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <Button type="button" variant="secondary" disabled={!file || Boolean(busy)} onClick={previewFile}>
            <FileSearch className="mr-1.5 h-4 w-4" />
            {busy === 'preview' ? 'Đang đối chiếu...' : 'Đọc và đối chiếu'}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['Hiện hoạt động', preview.currentActiveEmployees],
              ['Mục tiêu', preview.targetActiveEmployees],
              ['Dòng cảnh báo', preview.warningRows],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {preview.bootstrap && preview.applicable && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              HR hiện đang trống. Xác nhận sẽ tạo và chốt duy nhất roster T6-26 gồm 339 nhân sự.
            </div>
          )}

          {preview.blockingIssues?.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Chưa thể áp dụng</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{preview.blockingIssues.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {preview.warnings?.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Thông tin cần biết</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}

          {preview.applicable && !result && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 lg:flex-row lg:items-end lg:justify-between">
              <label className="text-sm font-medium text-blue-900">
                Nhập <strong>339</strong> để xác nhận kết quả hoạt động
                <input
                  inputMode="numeric"
                  value={confirmCount}
                  onChange={(event) => setConfirmCount(event.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 block w-40 rounded-lg border border-blue-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="339"
                />
              </label>
              <Button type="button" disabled={Boolean(busy) || confirmCount !== '339'} onClick={confirmImport}>
                <Upload className="mr-1.5 h-4 w-4" />
                {busy === 'confirm' ? 'Đang áp dụng...' : 'Xác nhận nhập 339'}
              </Button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Đã import baseline thành công</p>
            <p className="mt-1 text-sm">
              Đã chốt T6-26 = 339 theo đúng thứ tự trong file; hiện có {result.activeEmployees} người hoạt động và {result.totalEmployees} hồ sơ lịch sử.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
