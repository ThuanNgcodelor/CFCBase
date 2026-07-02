import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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

function App() {
  const token = Cookies.get('accessToken');
  const user = Cookies.get('user') ? JSON.parse(Cookies.get('user')) : {};

  const isAuthenticated = !!token;
  const userRole = user.role;

  // Component bảo vệ Route theo Role
  const AdminRoute = ({ children }) => {
    if (userRole !== 'ADMIN') {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />

      {/* Protected Routes */}
      <Route path="/" element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
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
            <AdminRoute>
              <AdminApprovals />
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
