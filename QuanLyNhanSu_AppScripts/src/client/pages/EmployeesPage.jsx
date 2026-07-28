import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RotateCcw,
  Search
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BottomSheet } from '../components/overlays/BottomSheet.jsx';
import { Button } from '../components/ui/Button.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { catalogNames, formatDateDisplay, initialsOf } from '../lib/format.js';

const initialFilters = {
  keyword: '',
  status: '',
  department: '',
  position: '',
  condition: '',
  sort: 'code-asc'
};

function EmployeeFilters({ value, onChange, departments, positions, conditions, compact = false }) {
  return (
    <div className={`employee-filter-fields ${compact ? 'employee-filter-fields--compact' : ''}`}>
      {!compact ? (
        <label className="search-control">
          <Search aria-hidden="true" />
          <input
            value={value.keyword}
            onChange={(event) => onChange({ ...value, keyword: event.target.value })}
            placeholder="Mã hoặc họ tên nhân sự"
          />
        </label>
      ) : null}
      <select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}>
        <option value="">Trạng thái: Tất cả</option>
        <option value="ACTIVE">Đang làm việc</option>
        <option value="DRAFT">Bản nháp</option>
        <option value="INACTIVE">Ngừng hoạt động</option>
      </select>
      <select value={value.department} onChange={(event) => onChange({ ...value, department: event.target.value })}>
        <option value="">Phòng ban: Tất cả</option>
        {departments.map((department) => (
          <option key={department} value={department}>{department}</option>
        ))}
      </select>
      <select value={value.position} onChange={(event) => onChange({ ...value, position: event.target.value })}>
        <option value="">Chức vụ: Tất cả</option>
        {positions.map((position) => <option key={position} value={position}>{position}</option>)}
      </select>
      <select value={value.condition} onChange={(event) => onChange({ ...value, condition: event.target.value })}>
        <option value="">Điều kiện lao động: Tất cả</option>
        {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
      </select>
      <select value={value.sort} onChange={(event) => onChange({ ...value, sort: event.target.value })}>
        <option value="code-asc">Sắp xếp: Mã tăng dần</option>
        <option value="name-asc">Họ tên A–Z</option>
        <option value="join-desc">Ngày vào làm mới nhất</option>
      </select>
    </div>
  );
}

export function EmployeesPage({ navigate }) {
  const { employees, catalogs, loading, error, reload } = useAppData();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const departments = useMemo(() => [...new Set([
    ...catalogNames(catalogs.departments),
    ...employees.map((employee) => employee.department)
  ].filter(Boolean))], [catalogs.departments, employees]);
  const positions = useMemo(() => [...new Set([
    ...catalogNames(catalogs.positions),
    ...employees.map((employee) => employee.position)
  ].filter(Boolean))], [catalogs.positions, employees]);
  const conditions = useMemo(() => [...new Set([
    ...catalogNames(catalogs.conditions),
    ...employees.map((employee) => employee.workingCondition)
  ].filter(Boolean))], [catalogs.conditions, employees]);

  const filtered = useMemo(() => {
    const keyword = filters.keyword.trim().toLocaleLowerCase('vi');
    const result = employees.filter((employee) => {
      const searchable = `${employee.code} ${employee.fullName} ${employee.department} ${employee.position}`
        .toLocaleLowerCase('vi');
      return (!keyword || searchable.includes(keyword))
        && (!filters.status || employee.status === filters.status)
        && (!filters.department || employee.department === filters.department)
        && (!filters.position || employee.position.includes(filters.position))
        && (!filters.condition || employee.workingCondition === filters.condition);
    });
    return result.sort((left, right) => {
      if (filters.sort === 'name-asc') return left.fullName.localeCompare(right.fullName, 'vi');
      if (filters.sort === 'join-desc') return right.joinDate.localeCompare(left.joinDate);
      return left.code.localeCompare(right.code, 'vi', { numeric: true });
    });
  }, [employees, filters]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <section className="employees-page">
      <PageHeader
        title="Danh sách nhân sự"
        actions={(
          <Button onClick={() => navigate('/employees/new')}>
            <Plus aria-hidden="true" />
            <span className="desktop-action-label">Thêm hồ sơ nháp</span>
            <span className="mobile-action-label">Thêm hồ sơ</span>
          </Button>
        )}
      />

      <div className="employee-mobile-search">
        <label className="search-control">
          <Search aria-hidden="true" />
          <input
            value={draftFilters.keyword}
            onChange={(event) => {
              const next = { ...draftFilters, keyword: event.target.value };
              setDraftFilters(next);
              setFilters(next);
              setPage(1);
            }}
            placeholder="Mã hoặc họ tên nhân sự"
          />
        </label>
        <Button variant="neutral" onClick={() => setFilterOpen(true)}>
          <Filter aria-hidden="true" />Bộ lọc
        </Button>
      </div>

      <div className="employee-filter-panel surface">
        <EmployeeFilters value={draftFilters} onChange={setDraftFilters} departments={departments} positions={positions} conditions={conditions} />
        <div className="employee-filter-panel__actions">
          <Button variant="ghost" onClick={resetFilters}>
            <RotateCcw aria-hidden="true" />Xóa lọc
          </Button>
          <Button onClick={applyFilters}>
            <Filter aria-hidden="true" />Áp dụng
          </Button>
        </div>
      </div>

      <p className="mobile-result-count">{filtered.length} kết quả</p>

      {error ? <div className="page-state-wrap surface"><ErrorState message={error} onRetry={reload} /></div> : (
        <div className="employee-ledger surface">
          <div className="employee-table-wrap">
            <table className="data-table employee-table">
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Phòng ban / Chức vụ</th>
                  <th>Ngày vào làm</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><LoadingState label="Đang tải danh sách nhân sự..." /></td></tr>
                ) : visible.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-identity">
                        <span className="avatar">{initialsOf(employee.fullName)}</span>
                        <span><strong>{employee.fullName}</strong><small>{employee.code}</small></span>
                      </div>
                    </td>
                    <td><strong>{employee.department}</strong><small>{employee.position}</small></td>
                    <td>{formatDateDisplay(employee.joinDate)}</td>
                    <td><StatusBadge status={employee.status} /></td>
                    <td>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/employees/${employee.id}`)}>
                        Chi tiết<ChevronRight aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && visible.length === 0 ? (
                  <tr><td colSpan="5"><EmptyState title="Không tìm thấy nhân sự" description="Thử thay đổi từ khóa hoặc xóa bớt bộ lọc." /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="employee-mobile-list">
            {loading ? <LoadingState label="Đang tải danh sách nhân sự..." /> : visible.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className="employee-mobile-row"
                onClick={() => navigate(`/employees/${employee.id}`)}
              >
                <span className="avatar">{initialsOf(employee.fullName)}</span>
                <span className="employee-mobile-row__copy">
                  <strong>{employee.fullName}</strong>
                  <small>{employee.code}</small>
                  <span>{employee.department}</span>
                  <span>{employee.position}</span>
                </span>
                <span className="employee-mobile-row__status">{employee.status === 'ACTIVE' ? 'Đang làm việc' : employee.status === 'DRAFT' ? 'Bản nháp' : 'Ngừng hoạt động'}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
            {!loading && visible.length === 0 ? <EmptyState title="Không tìm thấy nhân sự" description="Thử thay đổi từ khóa hoặc xóa bớt bộ lọc." /> : null}
          </div>

          <footer className="ledger-pagination">
            <span>
              {filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} của ${filtered.length}` : '0 kết quả'}
            </span>
            <div>
              <Button iconOnly variant="neutral" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Trang trước">
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="pagination-current">{page}</span>
              <Button iconOnly variant="neutral" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Trang sau">
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <label>Hiển thị <select value={pageSize} disabled><option>10</option></select></label>
          </footer>
        </div>
      )}

      <BottomSheet
        open={filterOpen}
        title="Bộ lọc nhân sự"
        onClose={() => setFilterOpen(false)}
        footer={(
          <>
            <Button variant="neutral" onClick={resetFilters}>Xóa lọc</Button>
            <Button onClick={applyFilters}>Áp dụng</Button>
          </>
        )}
      >
        <EmployeeFilters value={draftFilters} onChange={setDraftFilters} departments={departments} positions={positions} conditions={conditions} compact />
      </BottomSheet>
    </section>
  );
}
