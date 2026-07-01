import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import RoomBooking from './pages/RoomBooking';
import CarBooking from './pages/CarBooking';
import AdminApprovals from './pages/AdminApprovals';

function App() {
  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
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
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="rooms" element={<RoomBooking />} />
        <Route path="cars" element={<CarBooking />} />
        
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
  );
}

export default App;
