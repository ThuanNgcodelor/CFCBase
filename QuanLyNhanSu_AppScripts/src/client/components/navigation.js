import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  Folder,
  Grid2X2,
  History,
  House,
  Import,
  UsersRound,
  ClipboardCheck
} from 'lucide-react';

export const desktopNavigation = [
  { label: 'Thông báo', path: '/notifications', icon: Bell },
  { label: 'Tổng quan', path: '/overview', icon: House },
  { label: 'Nhân sự', path: '/employees', icon: UsersRound },
  { label: 'Thử việc', path: '/probation', icon: ClipboardCheck },
  { label: 'Tăng / Giảm', path: '/movements', icon: ArrowDownUp },
  { label: 'Danh sách tháng', path: '/rosters', icon: CalendarDays },
  { label: 'Danh mục', path: '/catalogs', icon: Folder },
  { label: 'Nhập dữ liệu', path: '/imports', icon: Import },
  { label: 'Nhật ký thay đổi', path: '/audit', icon: History }
];

export const mobileNavigation = [
  { label: 'Tổng quan', path: '/overview', icon: House },
  { label: 'Nhân sự', path: '/employees', icon: UsersRound },
  { label: 'Thử việc', path: '/probation', icon: ClipboardCheck },
  { label: 'Thêm', path: '__more__', icon: Grid2X2 }
];

export const moreNavigation = desktopNavigation.filter((item) =>
  ['/movements', '/rosters', '/catalogs', '/imports', '/audit'].includes(item.path)
);

export const routeIsActive = (currentPath, targetPath) => {
  if (targetPath === '/overview') return currentPath === '/overview';
  if (targetPath === '/audit') return currentPath === '/audit';
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
};
