import { useState } from 'react';
import SEOHead from '../../components/SEOHead';
import { HrSalaryRaiseImport } from '../../components/hr/HrSalaryRaiseImport';
import { HrSalaryReviewTracker } from '../../components/hr/HrSalaryReviewTracker';
import { HrPageHeader, HrPageShell } from '../../components/hr/HrUi';

export default function HrSalaryRaises() {
  const [tab, setTab] = useState('reviews');
  return (
    <HrPageShell>
      <SEOHead
        title="CFC Base | Nâng lương"
        description="Import và quản lý lịch sử nâng lương nhân viên theo ngày hiệu lực."
        url="https://cfcbooking.io.vn/manager/hr/salary-raises"
      />
      <HrPageHeader
        title="Nâng lương"
        description="Theo dõi người sắp tới hạn, ghi nhận kết quả rà soát và import mức lương mới theo MS."
      />
      <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button type="button" onClick={() => setTab('reviews')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'reviews' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Theo dõi tới hạn</button>
        <button type="button" onClick={() => setTab('imports')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'imports' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Import nâng lương</button>
      </div>
      {tab === 'reviews' ? <HrSalaryReviewTracker /> : <HrSalaryRaiseImport />}
    </HrPageShell>
  );
}
