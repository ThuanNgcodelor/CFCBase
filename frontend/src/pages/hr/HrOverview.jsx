import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  CircleDashed,
  ContactRound,
  FileCheck2,
  TableProperties,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { HrError, HrLoading, HrPageHeader, HrPageShell, HrStatusBadge } from '../../components/hr/HrUi';
import { hrEmployeeApi } from '../../api/hrEmployeeApi';
import { formatHrDateTime, formatPeriod, nonEmpty } from '../../utils/hr';

function overviewValue(data, ...paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], data);
    if (value !== undefined && value !== null) return value;
  }
  return 0;
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${colors[color]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, description }) {
  return (
    <Link to={to} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><Icon className="h-5 w-5" /></div>
        <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
    </Link>
  );
}

export default function HrOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    hrEmployeeApi.getOverview({ signal: controller.signal })
      .then(setData)
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.message || 'Không thể tải tổng quan nhân sự.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const latestImport = data?.latestImport || data?.latestImportBatch;
  const currentRoster = data?.currentRoster || data?.latestRoster;

  return (
    <HrPageShell>
      <SEOHead title="CFC Base | Tổng quan nhân sự" url="https://cfcbooking.io.vn/manager/hr" />
      <HrPageHeader
        title="Tổng quan nhân sự"
        description="Theo dõi dữ liệu nhân sự độc lập, tình trạng hồ sơ và lần nhập dữ liệu ban đầu gần nhất."
      />

      {loading ? <HrLoading /> : error ? (
        <HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tổng hồ sơ" value={overviewValue(data, 'totalEmployees', 'employeeCounts.total')} icon={ContactRound} color="blue" />
            <StatCard label="Đang làm việc" value={overviewValue(data, 'activeEmployees', 'employeeCounts.active')} icon={UserCheck} color="emerald" />
            <StatCard label="Bản nháp" value={overviewValue(data, 'draftEmployees', 'employeeCounts.draft')} icon={CircleDashed} color="amber" />
            <StatCard label="Ngừng hoạt động" value={overviewValue(data, 'inactiveEmployees', 'employeeCounts.inactive')} icon={UserMinus} color="gray" />
          </div>

          {/* <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Trạng thái dữ liệu</h2>
                  <p className="mt-1 text-sm text-gray-500">Dữ liệu lấy trực tiếp từ phân hệ HR.</p>
                </div>
                <FileCheck2 className="h-5 w-5 text-gray-400" />
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Import gần nhất</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800">
                    {latestImport ? <HrStatusBadge status={latestImport.status} /> : <span>Chưa có batch import</span>}
                  </dd>
                  {latestImport && <p className="mt-2 text-xs text-gray-500">{formatHrDateTime(latestImport.confirmedAt || latestImport.validatedAt || latestImport.parsedAt)}</p>}
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Danh sách tháng gần nhất</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800">
                    <span className="font-medium">{currentRoster ? formatPeriod(currentRoster.periodStart) : 'Chưa có'}</span>
                    {currentRoster?.status && <HrStatusBadge status={currentRoster.status} />}
                  </dd>
                  {currentRoster && <p className="mt-2 text-xs text-gray-500">{nonEmpty(currentRoster.itemCount)} nhân sự</p>}
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Phòng ban</dt>
                  <dd className="mt-2 text-2xl font-semibold text-gray-900">{overviewValue(data, 'departmentCount', 'catalogCounts.departments')}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Chức vụ</dt>
                  <dd className="mt-2 text-2xl font-semibold text-gray-900">{overviewValue(data, 'positionCount', 'catalogCounts.positions')}</dd>
                </div>
              </dl>
            </div>


          </div> */}

          <h2 className="mb-3 mt-8 text-lg font-semibold text-gray-900">Truy cập nhanh</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickLink to="/manager/hr/employees" icon={ContactRound} title="Danh sách nhân sự" description="Tìm kiếm, lọc và xem hồ sơ theo từng trang." />
            <QuickLink to="/manager/hr/movements" icon={ArrowUpDown} title="Tăng / Giảm" description="Tạo, kiểm tra và xác nhận biến động nhân sự." />
            <QuickLink to="/manager/hr/rosters" icon={TableProperties} title="Danh sách theo tháng" description="Kế thừa, mở và chốt danh sách nhân sự từng tháng." />
            <QuickLink to="/manager/hr/probation" icon={UserPlus} title="Thử việc" description="Quản lý ứng viên thử việc, tạo hợp đồng và chuyển hồ sơ khi đạt." />
          </div>
        </>
      )}
    </HrPageShell>
  );
}
