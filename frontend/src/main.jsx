import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { HelmetProvider } from 'react-helmet-async'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Đăng ký Service Worker PWA — tự reload khi có bản cập nhật mới
registerSW({
  onNeedRefresh() {
    // Tự reload ngay khi có bản mới (không hỏi user)
    // Nếu muốn hỏi user, có thể thêm toast notification ở đây
    window.location.reload();
  },
  onOfflineReady() {
    console.log('[PWA] App đã sẵn sàng hoạt động offline!');
  },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    </HelmetProvider>
  </StrictMode>,
)

