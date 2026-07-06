import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import RoomBooking from './pages/RoomBooking';
import CarBooking from './pages/CarBooking';
import AdminApprovals from './pages/AdminApprovals';
import BookingDetail from './pages/BookingDetail';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import CreateRoomBooking from './pages/CreateRoomBooking';
import CreateCarBooking from './pages/CreateCarBooking';
import Cookies from 'js-cookie';
import { authApi } from './api/authApi';

// Component bảo vệ Route Đăng nhập (Chưa đăng nhập mới vào được)
const LoginRoute = ({ children }) => {
  const token = Cookies.get('accessToken');
  if (token) {
    return <Navigate to="/" replace />;
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
    authApi.silentRefresh().then((ok) => setStatus(ok ? 'ok' : 'denied'));
  }, [status]);

  if (status === 'refreshing') {
    // Hiện màn hình chờ nhẹ trong khi refresh
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>Đang kiểm tra phiên đăng nhập...</span>
      </div>
    );
  }
  if (status === 'denied') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Component bảo vệ Route chỉ dành cho Admin hoặc Manager (Duyệt yêu cầu)
const ApproverRoute = ({ children }) => {
  const userJson = Cookies.get('user');
  const user = userJson ? JSON.parse(userJson) : {};
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Component bảo vệ Route chỉ dành riêng cho Admin (Quản lý tài nguyên)
const AdminRoute = ({ children }) => {
  const userJson = Cookies.get('user');
  const user = userJson ? JSON.parse(userJson) : {};
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
      <Route path="/login" element={
        <LoginRoute>
          <Login />
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
          {/* Bạn có thể thêm các route quản lý tài nguyên khác vào đây */}
        </Route>
      </Route>
    </Routes>
    </>
  );
}

export default App;
