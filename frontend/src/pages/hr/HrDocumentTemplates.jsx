import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { baseApi } from '../../api/baseApi';
import { unwrapApiData } from '../../api/hrApiUtils';
import { Button } from '../../components/ui/Button';
import { HrPageShell, HrPageHeader, HrLoading, HrError } from '../../components/hr/HrUi';
import { HrWordEditButton } from '../../components/hr/HrWordEditButton';
import { apiErrorMessage, formatHrDateTime } from '../../utils/hr';

const KINDS = {
  OFFICE: 'Hợp đồng văn phòng',
  GENERAL_LABOR: 'Hợp đồng lao động phổ thông',
  PROBATION: 'Hợp đồng thử việc',
};

export default function HrDocumentTemplates() {
  const [kind, setKind] = useState('OFFICE');
  return (
    <HrPageShell size="wide">
      <HrPageHeader
        title="Mẫu Word hợp đồng"
        description="Chỉnh sửa và áp dụng mẫu ngay trên web. Hệ thống vẫn giữ lịch sử phiên bản để đối chiếu."
      />
      <label className="block text-sm font-medium text-[var(--cfc-ink)]">
        Loại mẫu
        <select
          className="ml-3 rounded-lg border border-[var(--cfc-border)] bg-white p-2"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <TemplateVersions key={kind} kind={kind} />
    </HrPageShell>
  );
}

function TemplateVersions({ kind }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState('');
  const [revision, setRevision] = useState(0);
  const url = `/hr/document-templates/${kind}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    baseApi.get(url, { params: { page }, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setRows(unwrapApiData(response));
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không tải được lịch sử mẫu.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, page, revision]);

  const restore = async (id, label) => {
    if (!window.confirm(`Khôi phục ${label} làm mẫu đang dùng? Các hợp đồng đã xuất sẽ không bị thay đổi.`)) return;
    setRestoringId(id);
    setError('');
    try {
      await baseApi.post(`${url}/${id}/restore`);
      setRevision((value) => value + 1);
      toast.success('Đã khôi phục mẫu.');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Không khôi phục được mẫu.'));
    } finally {
      setRestoringId('');
    }
  };

  return (
    <section className="mt-5 space-y-5 rounded-xl border border-[var(--cfc-border)] bg-white p-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h2 className="font-semibold text-[var(--cfc-ink)]">Mẫu đang dùng</h2>
        <p className="mb-3 mt-1 text-sm text-[var(--cfc-muted)]">
          Mở trong trình soạn thảo, chỉnh và lưu ngay trên web. Phiên bản mới sẽ tự động được áp dụng sau khi CFCBase nhận file hoàn chỉnh.
        </p>
        <div className="flex flex-wrap gap-2">
          <HrWordEditButton type="TEMPLATE" kind={kind} sourceId="active" label="Sửa mẫu đang dùng" />
          <HrWordEditButton type="TEMPLATE" kind={kind} sourceId="builtin" label="Chỉnh sửa từ mẫu gốc" variant="secondary" />
          <Button variant="secondary" disabled={Boolean(restoringId)} onClick={() => restore('builtin', 'mẫu gốc')}>
            {restoringId === 'builtin' ? 'Đang khôi phục...' : 'Khôi phục mẫu gốc'}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[var(--cfc-ink)]">Lịch sử phiên bản</h2>
        <p className="mt-1 text-sm text-[var(--cfc-muted)]">
          Không cần tải file xuống. Muốn dùng lại nội dung cũ, hãy mở bản đó trên web, chỉnh nếu cần rồi lưu thành phiên bản mới.
        </p>
      </div>

      {loading ? <HrLoading /> : error ? <HrError message={error} /> : rows.length === 0 ? (
        <p className="rounded-lg bg-[var(--cfc-surface-muted)] p-4 text-sm text-[var(--cfc-muted)]">
          Chưa có phiên bản chỉnh sửa. Hệ thống đang sử dụng mẫu gốc.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--cfc-border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <strong className="break-all text-[var(--cfc-ink)]">{row.fileName}</strong>
                {row.active && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Đang dùng</span>}
                <p className="mt-1 text-sm text-[var(--cfc-muted)]">{formatHrDateTime(row.createdAt)} · {row.note}</p>
              </div>
              {!row.active && <div className="flex flex-wrap gap-2">
                <HrWordEditButton type="TEMPLATE" kind={kind} sourceId={row.id} disabled={Boolean(restoringId)} label="Sửa bản này trên web" variant="secondary" />
                <Button variant="secondary" disabled={Boolean(restoringId)} onClick={() => restore(row.id, 'phiên bản này')}>
                  {restoringId === row.id ? 'Đang khôi phục...' : 'Khôi phục'}
                </Button>
              </div>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button variant="secondary" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)}>Trước</Button>
        <span className="text-sm font-medium text-[var(--cfc-ink)]">Trang {page + 1}</span>
        <Button variant="secondary" disabled={loading || rows.length < 20} onClick={() => setPage((value) => value + 1)}>Sau</Button>
      </div>
    </section>
  );
}
