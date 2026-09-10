import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Cookies from 'js-cookie';
import { hrOcrCaptureApi } from '../api/hrOcrCaptureApi';
import { apiErrorMessage } from '../utils/hr';

export default function useHrOcrCapture(id) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState(false);
  const [live, setLive] = useState(false);
  const currentId = useRef(id);
  const deniedId = useRef(null);
  currentId.current = id;
  const accept = useCallback((next) => {
    if (next?.id !== currentId.current || deniedId.current === next.id) return;
    setSnapshot((prev) => !prev || prev.id !== next.id || next.revision >= prev.revision ? next : prev);
    setError('');
  }, []);

  useEffect(() => {
    setSnapshot(null); setError(''); setTerminal(false); setLive(false); deniedId.current = null;
    if (!id) return undefined;
    let stopped = false;
    let busy = false;
    let queued = false;
    let closed = false;
    let client;
    const refresh = async () => {
      if (stopped || closed) return;
      if (busy) { queued = true; return; }
      busy = true;
      try {
        const next = await hrOcrCaptureApi.get(id);
        if (!stopped) {
          accept(next);
          if (['CANCELLED', 'COMPLETED'].includes(next.status)) { closed = true; setTerminal(true); setLive(false); void client?.deactivate(); }
        }
      } catch (e) {
        if (!stopped) {
          setError(apiErrorMessage(e, 'Mất kết nối. Đang thử đồng bộ lại…'));
          if ([401, 403, 404, 410].includes(e.response?.status)) {
            closed = true; deniedId.current = id; setTerminal(true); setSnapshot(null); setLive(false); void client?.deactivate();
          }
        }
      } finally {
        busy = false;
        if (queued) { queued = false; void refresh(); }
      }
    };
    const api = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
    client = new Client({
      webSocketFactory: () => new SockJS(api.replace(/\/api\/v1\/?$/, '/ws')),
      reconnectDelay: 5000, connectionTimeout: 10000,
      heartbeatIncoming: 10000, heartbeatOutgoing: 10000, debug: () => {},
      beforeConnect: async () => {
        // GET uses the existing single-flight refresh interceptor; do not cache an old JWT.
        await refresh();
        if (stopped || closed) { void client.deactivate(); return; }
        client.connectHeaders = { Authorization: `Bearer ${Cookies.get('accessToken') || ''}` };
      },
      onConnect: () => {
        if (stopped) return;
        setLive(true);
        client.subscribe('/user/queue/ocr-capture', (message) => {
          try { if (JSON.parse(message.body).sessionId === id) void refresh(); } catch { /* Ignore invalid event. */ }
        });
        void refresh();
      },
      onWebSocketClose: () => { if (!stopped) setLive(false); },
      onStompError: () => { if (!stopped) setLive(false); },
    });
    client.activate();
    // Also reconciles after a missed event, backend restart, or unsupported WebSocket proxy.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const wake = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      void client.deactivate();
    };
  }, [id, accept]);
  return { snapshot: snapshot?.id === id ? snapshot : null, error, terminal, live, accept };
}
