import { useNavigate } from 'react-router-dom';

/**
 * Thanh tab điều hướng chung giữa các màn hình Chấm công
 * @param {'attendance' | 'production' | 'night-rewards'} activeTab
 */
export function HrAttendanceTabs({ activeTab = 'attendance' }) {
  const navigate = useNavigate();

  return (
    <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => navigate('/manager/hr/attendance')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'attendance'
            ? 'bg-emerald-600 text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        Hành chính
      </button>
      <button
        type="button"
        onClick={() => navigate('/manager/hr/attendance/production')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'production'
            ? 'bg-emerald-600 text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        Ca sản xuất
      </button>
      <button
        type="button"
        onClick={() => navigate('/manager/hr/attendance/night-rewards')}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'night-rewards'
            ? 'bg-emerald-600 text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        Thưởng ca đêm
      </button>
    </div>
  );
}
