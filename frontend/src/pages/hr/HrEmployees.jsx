import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Filter, PencilLine, Plus, Search, UserRound } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrEmpty, HrError, HrPageHeader, HrPageShell, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, employmentStatusLabel, formatHrDate, nonEmpty } from '../../utils/hr';

const INITIAL_FILTERS = {
  keyword: '',
  status: '',
  departmentId: '',
  positionId: '',
  workingConditionId: '',
  sort: 'employeeCode,asc',
};

function EmployeeAvatar({ employee }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-semibold text-emerald-700">
      {employee.fullName?.trim()?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
    </div>
  );
}

export default function HrEmployees() {
  const navigate = useNavigate();
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
    ]).then(([departments, positions, conditions]) => {
      setCatalogs({
        departments,
        positions,
        conditions,
      });
    }).catch((requestError) => {
      if (!controller.signal.aborted) {
        setCatalogError(apiErrorMessage(requestError, 'Không thể tải đầy đủ danh mục cho bộ lọc. Danh sách nhân sự vẫn có thể tra cứu bằng mã hoặc họ tên.'));
      }
    });
    return () => controller.abort();
  }, [catalogReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = { page, size: 20, sort: filters.sort };
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.status) params.status = filters.status;
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.positionId) params.positionId = filters.positionId;
    if (filters.workingConditionId) params.workingConditionId = filters.workingConditionId;

    hrEmployeeApi.getEmployees(params, { signal: controller.signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh sách nhân sự.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, reloadKey]);

  const hasFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== 'sort' && Boolean(value)),
    [filters],
  );

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setFilters({ ...draftFilters, keyword: draftFilters.keyword.trim() });
  };

  const clearFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPage(0);
  };

  const updateDraft = (field, value) => setDraftFilters((current) => ({ ...current, [field]: value }));

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Danh sách nhân sự" url="https://cfcbooking.io.vn/manager/hr/employees" />
      <HrPageHeader
        title="Danh sách nhân sự"
        description="Tra cứu hồ sơ theo từng trang. Dữ liệu nhạy cảm xem ở trang chi tiết; hồ sơ nháp có thể chỉnh sửa trực tiếp."
        actions={<Button type="button" onClick={() => navigate('/manager/hr/employees/new')}><Plus className="mr-1.5 h-4 w-4" />Thêm hồ sơ nháp</Button>}
      />

      <form onSubmit={applyFilters} className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              value={draftFilters.keyword}
              onChange={(event) => updateDraft('keyword', event.target.value)}
              placeholder="Mã hoặc họ tên nhân sự"
              className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <select value={draftFilters.status} onChange={(event) => updateDraft('status', event.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Hồ sơ nháp</option>
            <option value="ACTIVE">Đang làm</option>
            <option value="INACTIVE">Đã nghỉ</option>
          </select>
          <select value={draftFilters.departmentId} onChange={(event) => updateDraft('departmentId', event.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
            <option value="">Tất cả phòng ban</option>
            {catalogs.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={draftFilters.positionId} onChange={(event) => updateDraft('positionId', event.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
            <option value="">Tất cả chức vụ</option>
            {catalogs.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={draftFilters.workingConditionId} onChange={(event) => updateDraft('workingConditionId', event.target.value)} className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
            <option value="">Tất cả điều kiện</option>
            {catalogs.conditions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select value={draftFilters.sort} onChange={(event) => updateDraft('sort', event.target.value)} className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
            <option value="employeeCode,asc">Mã tăng dần</option>
            <option value="employeeCode,desc">Mã giảm dần</option>
            <option value="fullName,asc">Tên A–Z</option>
            <option value="fullName,desc">Tên Z–A</option>
            <option value="hireDate,desc">Ngày vào làm mới nhất</option>
          </select>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={clearFilters} disabled={!hasFilters && !draftFilters.keyword}>Xóa lọc</Button>
            <Button type="submit"><Filter className="mr-1.5 h-4 w-4" />Áp dụng</Button>
          </div>
        </div>
      </form>

      {catalogError && (
        <div className="mb-4">
          <HrError message={catalogError} onRetry={() => setCatalogReloadKey((value) => value + 1)} />
        </div>
      )}

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}

      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[1040px] divide-y divide-gray-200">
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
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar employee={employee} />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{employee.fullName}</div>
                      <div className="mt-0.5 text-xs text-gray-500">Mã: {employee.employeeCode}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  <div>{nonEmpty(employee.department?.name || employee.departmentName)}</div>
                  <div className="mt-1 text-xs text-gray-500">{nonEmpty(employee.position?.name || employee.positionName)}</div>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatHrDate(employee.hireDate || employee.employment?.hireDate)}</td>
                <td className="whitespace-nowrap px-5 py-4"><HrStatusBadge status={employee.employmentStatus || employee.status} label={employmentStatusLabel(employee.employmentStatus || employee.status)} /></td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {(employee.employmentStatus || employee.status) === 'DRAFT' && (
                      <Button type="button" size="sm" onClick={() => navigate(`/manager/hr/employees/${employee.id}/edit`)}>
                        <PencilLine className="mr-1.5 h-4 w-4" />Sửa nháp
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/manager/hr/employees/${employee.id}`)}>
                      <Eye className="mr-1.5 h-4 w-4" />Chi tiết
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && result.content.length === 0 && (
              <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Không có nhân sự phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">Đang tải danh sách...</div>
        ) : result.content.map((employee) => (
          <div key={employee.id} className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeAvatar employee={employee} />
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-900">{employee.fullName}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{employee.employeeCode}</div>
                </div>
              </div>
              <HrStatusBadge status={employee.employmentStatus || employee.status} label={employmentStatusLabel(employee.employmentStatus || employee.status)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
              <div><span className="text-gray-400">Phòng ban</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(employee.department?.name || employee.departmentName)}</p></div>
              <div><span className="text-gray-400">Chức vụ</span><p className="mt-1 font-medium text-gray-700">{nonEmpty(employee.position?.name || employee.positionName)}</p></div>
              <div><span className="text-gray-400">Ngày vào làm</span><p className="mt-1 font-medium text-gray-700">{formatHrDate(employee.hireDate || employee.employment?.hireDate)}</p></div>
            </div>
            <div className="mt-3 flex gap-2">
              {(employee.employmentStatus || employee.status) === 'DRAFT' && (
                <Button type="button" size="sm" onClick={() => navigate(`/manager/hr/employees/${employee.id}/edit`)}>
                  <PencilLine className="mr-1.5 h-4 w-4" />Sửa nháp
                </Button>
              )}
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/manager/hr/employees/${employee.id}`)}>
                <Eye className="mr-1.5 h-4 w-4" />Chi tiết
              </Button>
            </div>
          </div>
        ))}
        {!loading && result.content.length === 0 && <HrEmpty title="Không có nhân sự phù hợp" description="Hãy thay đổi bộ lọc hoặc thêm hồ sơ nháp mới." />}
      </div>

      <div className="mt-4">
        <HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} />
      </div>
    </HrPageShell>
  );
}
