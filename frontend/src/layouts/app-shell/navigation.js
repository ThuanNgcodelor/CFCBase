import {
  ArrowUpDown,
  Clock3,
  ContactRound,
  FileCheck2,
  HardHat,
  LayoutDashboard,
  Library,
  MoreHorizontal,
  TableProperties,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';

export function buildNavigation({ isAdmin, isHrUser = false, pendingRegistrationCount = 0 }) {
  const primaryItems = [];
  const adminItems = [
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
    { name: 'Gửi phiếu lương', path: '/manager/hr/payroll', icon: Send },
    { name: 'Chấm công', path: '/manager/hr/attendance', icon: Clock3 },
    { name: 'Danh mục', path: '/manager/hr/catalogs', icon: Library },
  ];

  // Nhóm nghiệp vụ đặt trước vì đây là khu vực sử dụng hằng ngày.
  // Các công cụ quản trị đặt cuối và có đường phân cách riêng, tránh trộn với HR.
  const sections = [];
  if (isHrUser) sections.push({ label: 'Nhân sự', items: hrItems });
  if (adminItems.length > 0) sections.push({ label: 'Quản trị hệ thống', items: adminItems });

  return { sections, primaryItems, adminItems, hrItems };
}

export function buildMobileNavigation({ isHrUser = false, primaryItems, adminItems, hrItems }) {
  if (isHrUser) {
    return {
      primary: [
        hrItems[0],
        hrItems[1],
        hrItems[2],
        { name: 'Thêm', action: 'more', icon: MoreHorizontal },
      ],
      moreSections: [
        { label: 'Vận hành', items: hrItems.slice(3) },
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
    ['/manager/hr/attendance', 'Chấm công'],
    ['/admin/profile-approvals/', 'Chi tiết hồ sơ'],
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
    '/manager/hr/employees/new',
    '/manager/hr/employees/',
    '/manager/hr/probation/templates/',
    '/manager/hr/general-labor/new',
    '/admin/profile-approvals/',
  ].some((prefix) => pathname.startsWith(prefix));
}
