import SEOHead from '../../components/SEOHead';
import { HrSalaryRaiseImport } from '../../components/hr/HrSalaryRaiseImport';
import { HrPageHeader, HrPageShell } from '../../components/hr/HrUi';

export default function HrSalaryRaises() {
  return (
    <HrPageShell>
      <SEOHead
        title="CFC Base | Nâng lương"
        description="Import và quản lý lịch sử nâng lương nhân viên theo ngày hiệu lực."
        url="https://cfcbooking.io.vn/manager/hr/salary-raises"
      />
      <HrPageHeader
        title="Nâng lương"
        description="Import file nâng lương theo MS, đối chiếu dữ liệu hiện tại và xem trước toàn bộ thay đổi trước khi xác nhận."
      />
      <HrSalaryRaiseImport />
    </HrPageShell>
  );
}
