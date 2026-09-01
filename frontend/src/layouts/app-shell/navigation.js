import {
  ArrowUpDown,
  Bell,
  CalendarRange,
  CarFront,
  CheckSquare,
  ContactRound,
  FileCheck2,
  HardHat,
  Home,
  LayoutDashboard,
  Library,
  MoreHorizontal,
  TableProperties,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';

export function buildNavigation({ isAdmin, isManager, isApprover, isHrUser = false, pendingRegistrationCount = 0 }) {
  const primaryItems = isManager
    ? []
    : [
        { name: 'Trang chủ', path: '/', icon: Home, exact: true },
        { name: 'Phòng họp', path: '/rooms', icon: CalendarRange },
        { name: 'Xe công tác', path: '/cars', icon: CarFront },
      ];

  const adminItems = [
    { name: 'Duyệt đặt chỗ', path: '/admin/approvals', icon: CheckSquare, show: isApprover && !isManager },
    { name: 'Duyệt hồ sơ', path: '/admin/profile-approvals', icon: FileCheck2, show: isAdmin },
    {
      name: 'Tài khoản',
      path: '/admin/users',
      icon: Users,
      show: isAdmin,
      badge: pendingRegistrationCount,
    },
  ].filter((item) => item.show);

  const hrItems = [
    { name: 'Tổng quan', path: '/manager/hr', icon: LayoutDashboard, exact: true },
    { name: 'Nhân sự', path: '/manager/hr/employees', icon: ContactRound },
    { name: 'Thử việc', path: '/manager/hr/probation', icon: UserPlus },
    { name: 'LĐ phổ thông', path: '/manager/hr/general-labor', icon: HardHat },
    { name: 'Tăng / Giảm', path: '/manager/hr/movements', icon: ArrowUpDown },
    { name: 'Danh sách tháng', path: '/manager/hr/rosters', icon: TableProperties },
    { name: 'Telegram nhân viên', path: '/manager/hr/telegram', icon: Send },
    { name: 'Gửi phiếu lương', path: '/manager/hr/payroll', icon: Send },
    { name: 'Danh mục', path: '/manager/hr/catalogs', icon: Library },
  ];

  const sections = [];
  if (primaryItems.length > 0) {
    sections.push({ label: isManager ? 'Hệ thống' : 'Điều phối', items: primaryItems });
  }
  if (adminItems.length > 0) sections.push({ label: 'Quản trị hệ thống', items: adminItems });
  if (isHrUser) sections.push({ label: 'Quản lý nhân sự', items: hrItems });

  return { sections, primaryItems, adminItems, hrItems };
}

export function buildMobileNavigation({ isManager, isHrUser = false, primaryItems, adminItems, hrItems }) {
  if (isManager) {
    return {
      primary: [
        hrItems[0],
        hrItems[1],
        hrItems[2],
        { name: 'Thêm', action: 'more', icon: MoreHorizontal },
      ],
      moreSections: [
        { label: 'Vận hành nhân sự', items: hrItems.slice(3) },
        ...(adminItems.length > 0 ? [{ label: 'Quản trị hệ thống', items: adminItems }] : []),
      ],
    };
  }

  return {
    primary: primaryItems.slice(0, 4),
    moreSections: [
      ...(isHrUser ? [{ label: 'Quản lý nhân sự', items: hrItems }] : []),
      ...(adminItems.length > 0 ? [{ label: 'Quản trị hệ thống', items: adminItems }] : []),
    ],
  };
}

export function isNavigationItemActive(item, pathname) {
  if (!item?.path) return false;
  if (item.exact || item.path === '/') return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function getPageTitle(pathname, items) {
  const routeTitles = [
    ['/manager/hr/probation/templates/new', 'Thêm mẫu thử việc'],
    ['/manager/hr/probation/templates/', 'Mẫu thử việc'],
    ['/manager/hr/general-labor/new', 'Thêm lao động phổ thông'],
    ['/manager/hr/employees/new', 'Thêm hồ sơ nhân sự'],
    ['/manager/hr/employees/', 'Chi tiết nhân sự'],
    ['/manager/hr/rosters/', 'Danh sách tháng'],
    ['/manager/hr/telegram', 'Telegram nhân viên'],
    ['/manager/hr/payroll', 'Gửi phiếu lương'],
    ['/admin/profile-approvals/', 'Chi tiết hồ sơ'],
    ['/admin/approvals/', 'Chi tiết đặt chỗ'],
    ['/rooms/create', 'Đặt phòng họp'],
    ['/cars/create', 'Đặt xe công tác'],
    ['/profile', 'Hồ sơ cá nhân'],
  ];
  const specialTitle = routeTitles.find(([prefix]) => pathname.startsWith(prefix));
  if (specialTitle) return specialTitle[1];

  return [...items]
    .filter((item) => isNavigationItemActive(item, pathname))
    .sort((left, right) => right.path.length - left.path.length)[0]?.name || 'CFC Base';
}

export function shouldHideMobileBottomNavigation(pathname) {
  return [
    '/rooms/create',
    '/cars/create',
    '/manager/hr/employees/new',
    '/manager/hr/employees/',
    '/manager/hr/probation/templates/',
    '/manager/hr/general-labor/new',
    '/admin/approvals/',
    '/admin/profile-approvals/',
  ].some((prefix) => pathname.startsWith(prefix));
}
