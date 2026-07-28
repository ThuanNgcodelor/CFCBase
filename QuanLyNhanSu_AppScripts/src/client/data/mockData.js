export const mockOverview = {
  total: 337,
  active: 337,
  draft: 0,
  inactive: 0
};

export const mockEmployees = [
  {
    id: 'emp-a035',
    code: 'A035',
    fullName: 'Nguyễn Nam Bình',
    gender: 'Nam',
    dob: '15/08/1992',
    department: 'Phòng Công nghệ thông tin',
    position: 'Chuyên viên phát triển',
    workingCondition: 'Bình thường',
    joinDate: '01/03/2021',
    contractType: 'Hợp đồng không xác định thời hạn',
    status: 'ACTIVE',
    phone: '0901 234 567',
    email: 'binh.nn@cfc.com.vn',
    ethnicity: 'Kinh',
    religion: 'Không',
    education: 'Đại học',
    major: 'Quản trị kinh doanh',
    cccd: '012345678901',
    citizenIssuedDate: '12/05/2020',
    citizenIssuedPlace: 'Cục CSQLHC về TTXH',
    bhxh: '0123456789',
    bhyt: 'HC 4 01 012 345 6789',
    insuranceStartDate: '01/03/2021',
    medicalPlace: 'Bệnh viện Quận 1',
    activities: [
      { id: 'act-1', date: '01/03/2021', time: '09:15', title: 'Tăng mới', description: 'Tăng mới nhân sự', actor: 'Phòng Nhân sự', tone: 'success' },
      { id: 'act-2', date: '15/06/2022', time: '10:30', title: 'Thay đổi công việc', description: 'Từ Nhân viên kinh doanh → Chuyên viên kinh doanh', actor: 'Phòng Nhân sự', tone: 'info' },
      { id: 'act-3', date: '01/07/2023', time: '08:45', title: 'Điều chỉnh lương', description: 'Điều chỉnh lương định kỳ', actor: 'Phòng Nhân sự', tone: 'info' }
    ]
  },
  {
    id: 'emp-a057',
    code: 'A057',
    fullName: 'Nguyễn Huỳnh Khánh Linh',
    gender: 'Nữ',
    dob: '11/02/1994',
    department: 'Phòng Tài chính – Kế toán',
    position: 'Kế toán viên',
    workingCondition: 'Bình thường',
    joinDate: '01/07/2022',
    contractType: 'Hợp đồng xác định thời hạn',
    status: 'ACTIVE',
    phone: '0902 345 678',
    email: 'linh.nhk@cfc.com.vn'
  },
  {
    id: 'emp-a061',
    code: 'A061',
    fullName: 'Nguyễn Thị Kim Phượng',
    gender: 'Nữ',
    dob: '23/06/1995',
    department: 'Phòng Nhân sự',
    position: 'Chuyên viên nhân sự',
    workingCondition: 'Bình thường',
    joinDate: '10/08/2022',
    contractType: 'Hợp đồng xác định thời hạn',
    status: 'ACTIVE',
    phone: '0903 456 789',
    email: 'phuong.ntk@cfc.com.vn'
  },
  {
    id: 'emp-a067',
    code: 'A067',
    fullName: 'Nguyễn Thị Yến Hà',
    gender: 'Nữ',
    dob: '04/04/1993',
    department: 'Phòng Kinh doanh',
    position: 'Nhân viên kinh doanh',
    workingCondition: 'Bình thường',
    joinDate: '05/09/2022',
    contractType: 'Hợp đồng không xác định thời hạn',
    status: 'ACTIVE',
    phone: '0904 567 890',
    email: 'ha.nty@cfc.com.vn'
  },
  {
    id: 'emp-a081',
    code: 'A081',
    fullName: 'Nguyễn Tất Thắng',
    gender: 'Nam',
    dob: '18/12/1991',
    department: 'Phòng Kỹ thuật',
    position: 'Kỹ sư cơ khí',
    workingCondition: 'Nặng nhọc',
    joinDate: '12/12/2022',
    contractType: 'Hợp đồng không xác định thời hạn',
    status: 'ACTIVE',
    phone: '0905 678 901',
    email: 'thang.nt@cfc.com.vn'
  },
  {
    id: 'emp-d091',
    code: 'D091',
    fullName: 'Trần Minh Anh',
    gender: 'Nữ',
    dob: '20/10/1998',
    department: 'Phòng Nhân sự',
    position: 'Chuyên viên tuyển dụng',
    workingCondition: 'Bình thường',
    joinDate: '',
    contractType: '',
    status: 'DRAFT',
    phone: '0906 789 012',
    email: 'anh.tm@cfc.com.vn'
  }
];

export const mockMovements = [
  {
    id: 'mov-1',
    employeeId: 'emp-a035',
    code: 'NV000123',
    fullName: 'Nguyễn Văn Lâm',
    type: 'INCREASE',
    effectiveDate: '01/06/2024',
    reason: 'Tuyển dụng mới',
    decisionNo: '15/QĐ-CFC-HCNS',
    status: 'CONFIRMED',
    actor: 'Phòng Nhân sự'
  },
  {
    id: 'mov-2',
    employeeId: 'emp-a057',
    code: 'NV000124',
    fullName: 'Trần Quang Huy',
    type: 'INCREASE',
    effectiveDate: '15/05/2024',
    reason: 'Điều chuyển nội bộ',
    decisionNo: '12/QĐ-CFC-HCNS',
    status: 'CONFIRMED',
    actor: 'Phòng Nhân sự'
  },
  {
    id: 'mov-3',
    employeeId: 'emp-a061',
    code: 'NV000098',
    fullName: 'Phạm Ngọc Anh',
    type: 'DECREASE',
    effectiveDate: '30/04/2024',
    reason: 'Nghỉ việc',
    decisionNo: '08/QĐ-CFC-HCNS',
    status: 'CONFIRMED',
    actor: 'Phòng Nhân sự'
  },
  {
    id: 'mov-4',
    employeeId: 'emp-a067',
    code: 'NV000110',
    fullName: 'Lê Đức Minh',
    type: 'INCREASE',
    effectiveDate: '10/04/2024',
    reason: 'Tuyển dụng mới',
    decisionNo: '07/QĐ-CFC-HCNS',
    status: 'CONFIRMED',
    actor: 'Phòng Nhân sự'
  },
  {
    id: 'mov-5',
    employeeId: 'emp-a081',
    code: 'NV000099',
    fullName: 'Vũ Hoàng Nam',
    type: 'DECREASE',
    effectiveDate: '31/03/2024',
    reason: 'Nghỉ việc',
    decisionNo: '05/QĐ-CFC-HCNS',
    status: 'CONFIRMED',
    actor: 'Phòng Nhân sự'
  }
];

export const mockCandidates = [];

export const mockJobTemplates = [
  {
    id: 'tpl-1',
    code: 'TV-KT',
    name: 'Nhân viên kế toán thử việc',
    department: 'Phòng Tài chính – Kế toán',
    position: 'Kế toán viên',
    baseSalary: 7500000,
    status: 'ACTIVE',
    description: 'Hạch toán chứng từ và hỗ trợ báo cáo theo phân công.'
  },
  {
    id: 'tpl-2',
    code: 'TV-KD',
    name: 'Nhân viên kinh doanh thử việc',
    department: 'Phòng Kinh doanh',
    position: 'Nhân viên kinh doanh',
    baseSalary: 7800000,
    status: 'ACTIVE',
    description: 'Phát triển khách hàng và theo dõi hợp đồng bán hàng.'
  },
  {
    id: 'tpl-3',
    code: 'TV-KTCH',
    name: 'Kỹ sư cơ khí thử việc',
    department: 'Phòng Kỹ thuật',
    position: 'Kỹ sư cơ khí',
    baseSalary: 9000000,
    status: 'ACTIVE',
    description: 'Theo dõi thiết bị, bảo trì và cải tiến kỹ thuật.'
  }
];

export const mockRosters = [
  {
    id: 'roster-2026-07',
    label: 'T7-26',
    range: '01/07/2026 – 31/07/2026',
    employeeCount: 337,
    status: 'LIVE',
    movementCount: 2
  },
  {
    id: 'roster-2026-06',
    label: 'T6-26',
    range: '01/06/2026 – 30/06/2026',
    employeeCount: 337,
    status: 'BASELINE',
    movementCount: 0
  }
];

export const mockCatalogs = {
  departments: [
    { id: 'dep-1', code: 'HR001', name: 'Phòng Nhân sự', description: 'Quản lý chung về công tác nhân sự', status: 'ACTIVE' },
    { id: 'dep-2', code: 'HR002', name: 'Phòng Tuyển dụng', description: 'Tuyển dụng và thu hút nhân tài', status: 'ACTIVE' },
    { id: 'dep-3', code: 'HR003', name: 'Phòng Đào tạo', description: 'Đào tạo và phát triển nguồn nhân lực', status: 'ACTIVE' },
    { id: 'dep-4', code: 'HR004', name: 'Phòng Tiền lương & Phúc lợi', description: 'Quản lý tiền lương, thưởng và phúc lợi', status: 'ACTIVE' },
    { id: 'dep-5', code: 'HR005', name: 'Phòng Quan hệ lao động', description: 'Quan hệ lao động và chế độ chính sách', status: 'ACTIVE' },
    { id: 'dep-6', code: 'HR006', name: 'Phòng Hành chính', description: 'Hành chính văn phòng và quản trị', status: 'ACTIVE' },
    { id: 'dep-7', code: 'HR007', name: 'Phòng An toàn lao động', description: 'An toàn, sức khỏe và môi trường làm việc', status: 'ACTIVE' }
  ],
  positions: [
    { id: 'pos-1', code: 'CV001', name: 'Chuyên viên nhân sự', description: 'Nghiệp vụ nhân sự tổng hợp', status: 'ACTIVE' },
    { id: 'pos-2', code: 'CV002', name: 'Kế toán viên', description: 'Nghiệp vụ tài chính kế toán', status: 'ACTIVE' },
    { id: 'pos-3', code: 'CV003', name: 'Kỹ sư cơ khí', description: 'Vận hành và bảo trì cơ khí', status: 'ACTIVE' }
  ],
  conditions: [
    { id: 'con-1', code: 'DK001', name: 'Bình thường', description: 'Điều kiện lao động bình thường', status: 'ACTIVE' },
    { id: 'con-2', code: 'DK002', name: 'Nặng nhọc', description: 'Điều kiện lao động nặng nhọc', status: 'ACTIVE' },
    { id: 'con-3', code: 'DK003', name: 'Độc hại', description: 'Điều kiện lao động có yếu tố độc hại', status: 'ACTIVE' }
  ]
};

export const mockAuditEvents = [
  { id: 'audit-1', time: '28/07/2026 09:15', actor: 'Phòng Nhân sự', action: 'Xem danh sách nhân sự', target: 'Danh sách nhân sự' },
  { id: 'audit-2', time: '28/07/2026 08:40', actor: 'Phòng Nhân sự', action: 'Xuất báo cáo tháng', target: 'T7-26' },
  { id: 'audit-3', time: '27/07/2026 16:22', actor: 'Phòng Nhân sự', action: 'Xác nhận biến động', target: 'NV000123' }
];
