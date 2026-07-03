import React from 'react';
import { authApi } from '../api/authApi';
import AdminDashboard from './AdminDashboard';
import ClientDashboard from './ClientDashboard';

export default function Dashboard() {
  const user = authApi.getUser();
  const isAdmin = user?.role === 'ADMIN';

  // Nếu là Admin, hiển thị AdminDashboard, ngược lại hiển thị ClientDashboard
  if (isAdmin) {
    return <AdminDashboard />;
  }

  return <ClientDashboard />;
}
