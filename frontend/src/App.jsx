import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import RoomBooking from './pages/RoomBooking';
import CarBooking from './pages/CarBooking';
import AdminApprovals from './pages/AdminApprovals';
import AdminProfileApprovals from './pages/AdminProfileApprovals';
import AdminProfileApprovalDetail from './pages/AdminProfileApprovalDetail';
import AdminUsers from './pages/AdminUsers';
import BookingDetail from './pages/BookingDetail';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import CreateRoomBooking from './pages/CreateRoomBooking';
import CreateCarBooking from './pages/CreateCarBooking';
import ServiceWorkerNavigateListener from './components/ServiceWorkerNavigateListener';
import Cookies from 'js-cookie';
import { authApi } from './api/authApi';

const SessionCheckScreen = ({ unavailable = false }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ color: '#6b7280', fontSize: '14px' }}>
      {unavailable ? 'Chưa thể kết nối để kiểm tra phiên đăng nhập.' : 'Đang kiểm tra phiên đăng nhập...'}
    </span>
    {unavailable && <button type="button" onClick={() => window.location.reload()}>Thử lại</button>}
  </div>
);

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
  if (status === 'authenticated') return <Navigate to="/" replace />;
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
  return children;
};

// Component bảo vệ Route chỉ dành cho Admin hoặc Manager (Duyệt yêu cầu)
const ApproverRoute = ({ children }) => {
  const role = authApi.getRole();
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return <Navigate to="/" replace />;
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
        <Route index element={<Dashboard />} />
        <Route path="rooms" element={<RoomBooking />} />
        <Route path="rooms/create" element={<CreateRoomBooking />} />
        <Route path="cars" element={<CarBooking />} />
        <Route path="cars/create" element={<CreateCarBooking />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />

        {/* Booking Details (Approvals / Logs) */}
        <Route path="admin/approvals/:id" element={<BookingDetail />} />

        {/* Admin Routes */}
        <Route path="admin">
          <Route path="approvals" element={
            <ApproverRoute>
              <AdminApprovals />
            </ApproverRoute>
          } />
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
          {/* Bạn có thể thêm các route quản lý tài nguyên khác vào đây */}
        </Route>
      </Route>
    </Routes>
    </>
  );
}

export default App;
