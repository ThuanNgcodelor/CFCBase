import { useEffect, useState } from 'react';
import SEOHead from '../../components/SEOHead';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrReadOnlyNotice } from '../../components/hr/HrUi';
import { hrActivityApi } from '../../api/hrActivityApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, formatHrDateTime, nonEmpty } from '../../utils/hr';

function changedFieldsLabel(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string' && !value.trim().startsWith('{')) return value;
  return 'Chi tiết thay đổi được bảo vệ';
}

export default function HrAudit() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrActivityApi.getAuditEvents({ page, size: 20 }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => { if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải nhật ký HR.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reloadKey]);

  return (
    <div className="w-full">
      <SEOHead title="CFC Base | Nhật ký nhân sự" url="https://cfcbooking.io.vn/manager/hr/audit" />
      <HrPageHeader title="Nhật ký thay đổi" description="Theo dõi actor, hành động, đối tượng và thời gian thao tác trong phân hệ HR." />
      <div className="mb-4"><HrReadOnlyNotice>Nhật ký là append-only. Giao diện không hiển thị payload PII hoặc metadata nhạy cảm.</HrReadOnlyNotice></div>
      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><tr><th className="px-5 py-4">Thời gian</th><th className="px-5 py-4">Người thao tác</th><th className="px-5 py-4">Hành động</th><th className="px-5 py-4">Đối tượng</th><th className="px-5 py-4">Trường thay đổi</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải...</td></tr> : result.content.map((event) => <tr key={event.id} className="align-top hover:bg-gray-50/70"><td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDateTime(event.occurredAt)}</td><td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{nonEmpty(event.actorDisplayName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(event.actorSubject)}</p></td><td className="px-5 py-4 text-sm font-medium text-emerald-700">{event.action}</td><td className="px-5 py-4"><p className="text-sm text-gray-700">{event.entityType}</p><p className="mt-1 max-w-[180px] truncate text-xs text-gray-500">{nonEmpty(event.entityId)}</p></td><td className="max-w-sm px-5 py-4 text-sm text-gray-500">{changedFieldsLabel(event.changedFields)}</td></tr>)}{!loading && result.content.length === 0 && <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có nhật ký phù hợp" /></td></tr>}</tbody></table></div>
      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded-xl border bg-white py-10 text-center text-sm text-gray-500">Đang tải...</div> : result.content.map((event) => (
          <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">{event.action}</p><p className="mt-1 text-xs text-gray-500">{formatHrDateTime(event.occurredAt)}</p></div><span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">{event.entityType}</span></div>
            <p className="mt-3 text-sm font-medium text-gray-900">{nonEmpty(event.actorDisplayName)}</p><p className="mt-1 text-xs text-gray-500">{nonEmpty(event.actorSubject)}</p>
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">Đối tượng: {nonEmpty(event.entityId)}</p>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Chưa có nhật ký phù hợp" />}
      </div>
      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>
    </div>
  );
}
