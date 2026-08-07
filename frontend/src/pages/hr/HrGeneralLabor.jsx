import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, HardHat, PencilLine, Plus, Search, TrendingUp } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import {
  HrEmpty,
  HrError,
  HrPageHeader,
  HrPageShell,
  HrPagination,
  HrStatusBadge,
} from '../../components/hr/HrUi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { normalizePage } from '../../api/hrApiUtils';
import {
  apiErrorMessage,
  employmentStatusLabel,
  formatHrDate,
  nonEmpty,
} from '../../utils/hr';

const PAGE_SIZE = 20;

function movementPath(employee) {
  const params = new URLSearchParams({
    create: 'increase',
    employeeId: employee.id,
    effectiveDate: employee.hireDate || '',
  });
  return `/manager/hr/movements?${params.toString()}`;
}

function EmployeeIdentity({ employee }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <HardHat className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{employee.fullName}</p>
        <p className="mt-0.5 text-xs text-gray-500">Mã: {employee.employeeCode}</p>
      </div>
    </div>
  );
}

export default function HrGeneralLabor() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrEmployeeApi.getEmployees({
      page,
      size: PAGE_SIZE,
      keyword: appliedKeyword,
      status,
      workforceGroup: 'GENERAL_LABOR',
      sort: 'employeeCode,asc',
    }, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'Không thể tải danh sách lao động phổ thông.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [appliedKeyword, page, reloadKey, status]);

  const applySearch = (event) => {
    event.preventDefault();
    setPage(0);
    setAppliedKeyword(keyword.trim());
  };

  const clearFilters = () => {
    setKeyword('');
    setAppliedKeyword('');
    setStatus('');
    setPage(0);
  };

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Lao động phổ thông" url="https://cfcbooking.io.vn/manager/hr/general-labor" />
      <HrPageHeader
        title="Lao động phổ thông"
        description="Tạo thẳng hồ sơ nhân sự nháp kèm hợp đồng 1 năm hoặc không xác định thời hạn, sau đó thực hiện Tăng nhân sự để đưa vào danh sách chính thức."
        actions={(
          <Button type="button" onClick={() => navigate('/manager/hr/general-labor/new')}>
            <Plus className="mr-1.5 h-4 w-4" />Thêm lao động phổ thông
          </Button>
        )}
      />

      <form onSubmit={applySearch} className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm mã hoặc họ tên"
            className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <select
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(0); }}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Hồ sơ nháp</option>
          <option value="ACTIVE">Đang làm</option>
          <option value="INACTIVE">Đã nghỉ</option>
        </select>
        <Button type="button" variant="secondary" onClick={clearFilters}>Xóa lọc</Button>
        <Button type="submit"><Search className="mr-1.5 h-4 w-4" />Tìm</Button>
      </form>

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}

      <div className="hr-responsive-table hr-responsive-table--standard cfc-scrollbar overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-5 py-4">Nhân sự</th>
              <th className="px-5 py-4">Phòng ban / chức vụ</th>
              <th className="px-5 py-4">Ngày vào làm</th>
              <th className="px-5 py-4">Trạng thái</th>
              <th className="px-5 py-4"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải danh sách...</td></tr>
            ) : result.content.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50/70">
                <td className="px-5 py-4"><EmployeeIdentity employee={employee} /></td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <p>{nonEmpty(employee.departmentName)}</p>
                  <p className="mt-1 text-xs text-gray-500">{nonEmpty(employee.positionName)}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDate(employee.hireDate)}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  <HrStatusBadge status={employee.employmentStatus} label={employmentStatusLabel(employee.employmentStatus)} />
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {employee.employmentStatus === 'DRAFT' && (
                      <>
                        <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/manager/hr/employees/${employee.id}/edit`)}>
                          <PencilLine className="mr-1 h-4 w-4" />Sửa nháp
                        </Button>
                        <Button type="button" size="sm" onClick={() => navigate(movementPath(employee))}>
                          <TrendingUp className="mr-1 h-4 w-4" />Tạo tăng
                        </Button>
                      </>
                    )}
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/manager/hr/employees/${employee.id}`)}>
                      <Eye className="mr-1 h-4 w-4" />Chi tiết
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && result.content.length === 0 && (
              <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có lao động phổ thông" description="Bấm “Thêm lao động phổ thông” để tạo hồ sơ và chọn loại hợp đồng." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="hr-responsive-cards hr-responsive-cards--standard space-y-3">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">Đang tải danh sách...</div>
        ) : result.content.map((employee) => (
          <article key={employee.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <EmployeeIdentity employee={employee} />
              <HrStatusBadge status={employee.employmentStatus} label={employmentStatusLabel(employee.employmentStatus)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
              <div><span className="text-gray-400">Phòng ban</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(employee.departmentName)}</p></div>
              <div><span className="text-gray-400">Chức vụ</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(employee.positionName)}</p></div>
              <div className="col-span-2"><span className="text-gray-400">Ngày vào làm</span><p className="mt-1 font-medium text-gray-700">{formatHrDate(employee.hireDate)}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {employee.employmentStatus === 'DRAFT' && (
                <Button type="button" size="sm" onClick={() => navigate(movementPath(employee))}><TrendingUp className="mr-1 h-4 w-4" />Tạo tăng</Button>
              )}
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/manager/hr/employees/${employee.id}`)}><Eye className="mr-1 h-4 w-4" />Chi tiết</Button>
            </div>
          </article>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Chưa có lao động phổ thông" description="Bấm “Thêm lao động phổ thông” để tạo hồ sơ và chọn loại hợp đồng." />}
      </div>

      <div className="mt-4">
        <HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} />
      </div>
    </HrPageShell>
  );
}
