import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import DashboardLayout from './layouts/DashboardLayout';
import AdminProfileApprovals from './pages/AdminProfileApprovals';
import AdminProfileApprovalDetail from './pages/AdminProfileApprovalDetail';
import AdminUsers from './pages/AdminUsers';
import Profile from './pages/Profile';
import ServiceWorkerNavigateListener from './components/ServiceWorkerNavigateListener';
import Cookies from 'js-cookie';
import { authApi } from './api/authApi';
import { getRoleLandingPath } from './utils/roleNavigation';

const HrOverview = lazy(() => import('./pages/hr/HrOverview'));
const HrEmployees = lazy(() => import('./pages/hr/HrEmployees'));
const HrEmployeeDetail = lazy(() => import('./pages/hr/HrEmployeeDetail'));
const HrEmployeeForm = lazy(() => import('./pages/hr/HrEmployeeForm'));
const HrProbationCandidates = lazy(() => import('./pages/hr/HrProbationCandidates'));
const HrProbationCandidateForm = lazy(() => import('./pages/hr/HrProbationCandidateForm'));
const HrProbationJobTemplateForm = lazy(() => import('./pages/hr/HrProbationJobTemplateForm'));
const HrGeneralLabor = lazy(() => import('./pages/hr/HrGeneralLabor'));
const HrGeneralLaborOnboarding = lazy(() => import('./pages/hr/HrGeneralLaborOnboarding'));
const HrCatalogs = lazy(() => import('./pages/hr/HrCatalogs'));
const HrImports = lazy(() => import('./pages/hr/HrImports'));
const HrMovements = lazy(() => import('./pages/hr/HrMovements'));
const HrRosters = lazy(() => import('./pages/hr/HrRosters'));
const HrRosterDetail = lazy(() => import('./pages/hr/HrRosterDetail'));
const HrAudit = lazy(() => import('./pages/hr/HrAudit'));
const HrTelegramEmployees = lazy(() => import('./pages/hr/HrTelegramEmployees'));
const HrPayroll = lazy(() => import('./pages/hr/HrPayroll'));
const HrAttendance = lazy(() => import('./pages/hr/HrAttendance'));

const SessionCheckScreen = ({ unavailable = false }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ color: '#6b7280', fontSize: '14px' }}>
      {unavailable ? 'Chưa thể kết nối để kiểm tra phiên đăng nhập.' : 'Đang kiểm tra phiên đăng nhập...'}
    </span>
    {unavailable && <button type="button" onClick={() => window.location.reload()}>Thử lại</button>}
  </div>
);

const LOGIN_ROLES = new Set(['ADMIN', 'MANAGER']);

function hasManagementRole() {
  return LOGIN_ROLES.has(authApi.getRole());
}

// Trang login cũng phải khôi phục phiên bằng refresh token, đặc biệt khi iOS mở PWA lại.
const LoginRoute = ({ children }) => {
  const accessToken = Cookies.get('accessToken');
  const refreshToken = Cookies.get('refreshToken');
  const [status, setStatus] = useState(accessToken ? 'authenticated' : refreshToken ? 'refreshing' : 'guest');

  useEffect(() => {
    if (status !== 'refreshing') return;
    authApi.silentRefresh()
      .then((ok) => setStatus(ok ? 'authenticated' : 'guest'))
      .catch(() => setStatus('unavailable'));
  }, [status]);

  if (status === 'refreshing') return <SessionCheckScreen />;
  if (status === 'unavailable') return <SessionCheckScreen unavailable />;
  if (status === 'authenticated' && hasManagementRole()) {
    return <Navigate to={getRoleLandingPath(authApi.getRole())} replace />;
  }
  if (status === 'authenticated') {
    authApi.discardSession();
  }
  return children;
};

// Component bảo vệ Route Chung (Đã đăng nhập mới vào được)
// Nếu accessToken hết hạn nhưng còn refreshToken → tự lấy token mới (silent refresh)
const ProtectedRoute = ({ children }) => {
  const accessToken = Cookies.get('accessToken');
  const refreshToken = Cookies.get('refreshToken');
  const [status, setStatus] = useState(accessToken ? 'ok' : refreshToken ? 'refreshing' : 'denied');

  useEffect(() => {
    if (status !== 'refreshing') return;
    authApi.silentRefresh()
      .then((ok) => setStatus(ok ? 'ok' : 'denied'))
      .catch(() => setStatus('unavailable'));
  }, [status]);

  if (status === 'refreshing') {
    // Hiện màn hình chờ nhẹ trong khi refresh
    return <SessionCheckScreen />;
  }
  if (status === 'unavailable') return <SessionCheckScreen unavailable />;
  if (status === 'denied') {
    return <Navigate to="/login" replace />;
  }
  if (!hasManagementRole()) {
    authApi.discardSession();
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component bảo vệ Route chỉ dành riêng cho Admin.
const AdminRoute = ({ children }) => {
  const role = authApi.getRole();
  if (role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
};

// HR chỉ dành cho ADMIN/MANAGER; backend tiếp tục enforce cùng một quy tắc.
const ManagerRoute = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

const RoleHome = () => {
  return <Navigate to="/manager/hr" replace />;
};

const HrRoute = ({ children }) => (
  <ManagerRoute>
    <Suspense fallback={<div className="py-12 text-center text-sm text-gray-500">Đang tải phân hệ nhân sự...</div>}>
      {children}
    </Suspense>
  </ManagerRoute>
);

function App() {

  return (
    <>
      <ServiceWorkerNavigateListener />
      <Toaster position="top-right" />
      <Routes>
      <Route path="/login" element={
        <LoginRoute>
          <Login />
        </LoginRoute>
      } />
      <Route path="/register" element={
        <LoginRoute>
          <Register />
        </LoginRoute>
      } />
      <Route path="/forgot-password" element={
        <LoginRoute>
          <ForgotPassword />
        </LoginRoute>
      } />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<RoleHome />} />
        <Route path="profile" element={<Profile />} />

        {/* Phân hệ HR dành cho ADMIN và MANAGER. */}
        <Route path="manager/hr" element={<HrRoute><HrOverview /></HrRoute>} />
        <Route path="manager/hr/employees" element={<HrRoute><HrEmployees /></HrRoute>} />
        <Route path="manager/hr/employees/new" element={<HrRoute><HrEmployeeForm /></HrRoute>} />
        <Route path="manager/hr/employees/:id" element={<HrRoute><HrEmployeeDetail /></HrRoute>} />
        <Route path="manager/hr/employees/:id/edit" element={<HrRoute><HrEmployeeForm /></HrRoute>} />
        <Route path="manager/hr/probation" element={<HrRoute><HrProbationCandidates /></HrRoute>} />
        <Route path="manager/hr/probation/candidates/new" element={<HrRoute><HrProbationCandidateForm /></HrRoute>} />
        <Route path="manager/hr/probation/candidates/:id/edit" element={<HrRoute><HrProbationCandidateForm /></HrRoute>} />
        <Route path="manager/hr/probation/templates/new" element={<HrRoute><HrProbationJobTemplateForm /></HrRoute>} />
        <Route path="manager/hr/probation/templates/:id/edit" element={<HrRoute><HrProbationJobTemplateForm /></HrRoute>} />
        <Route path="manager/hr/general-labor" element={<HrRoute><HrGeneralLabor /></HrRoute>} />
        <Route path="manager/hr/general-labor/new" element={<HrRoute><HrGeneralLaborOnboarding /></HrRoute>} />
        <Route path="manager/hr/catalogs" element={<HrRoute><HrCatalogs /></HrRoute>} />
        <Route path="manager/hr/imports" element={<HrRoute><HrImports /></HrRoute>} />
        <Route path="manager/hr/movements" element={<HrRoute><HrMovements /></HrRoute>} />
        <Route path="manager/hr/rosters" element={<HrRoute><HrRosters /></HrRoute>} />
        <Route path="manager/hr/rosters/:id" element={<HrRoute><HrRosterDetail /></HrRoute>} />
        <Route path="manager/hr/audit" element={<HrRoute><HrAudit /></HrRoute>} />
        <Route path="manager/hr/telegram" element={<HrRoute><HrTelegramEmployees /></HrRoute>} />
        <Route path="manager/hr/payroll" element={<HrRoute><HrPayroll /></HrRoute>} />
        <Route path="manager/hr/attendance" element={<HrRoute><HrAttendance /></HrRoute>} />

        {/* Quản trị tài khoản */}
        <Route path="admin">
          <Route path="profile-approvals" element={
            <AdminRoute>
              <AdminProfileApprovals />
            </AdminRoute>
          } />
          <Route path="profile-approvals/:id" element={
            <AdminRoute>
              <AdminProfileApprovalDetail />
            </AdminRoute>
          } />
          <Route path="users" element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          } />
        </Route>

        {/* Booking đã đóng băng: giữ URL cũ không lỗi nhưng đưa về HR. */}
        <Route path="rooms/*" element={<Navigate to="/manager/hr" replace />} />
        <Route path="cars/*" element={<Navigate to="/manager/hr" replace />} />
        <Route path="notifications" element={<Navigate to="/manager/hr" replace />} />
        <Route path="admin/approvals/*" element={<Navigate to="/manager/hr" replace />} />
      </Route>
    </Routes>
    </>
  );
}

export default App;
