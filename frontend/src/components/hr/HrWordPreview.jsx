import { useEffect, useState } from 'react';
import { HrError, HrLoading } from './HrUi';

// Uploaded Word content is rendered in an isolated frame, never in the application DOM.
export function HrWordPreview({ blob }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setHtml(''); setError('');
    if (!blob) return undefined;
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        const body = document.createElement('div');
        const styles = document.createElement('div');
        await renderAsync(blob, body, styles, { useBase64URL: true, breakPages: true });
        if (!cancelled) setHtml(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">${styles.innerHTML}</head><body>${body.innerHTML}</body></html>`);
      } catch { if (!cancelled) setError('Không dựng được bản xem trước. Bạn vẫn có thể tải file để mở bằng Word.'); }
    })();
    return () => { cancelled = true; };
  }, [blob]);
  if (!blob) return null;
  return <div className="mt-4">
    <p className="mb-2 text-sm text-amber-800">Bản xem trước để kiểm tra nội dung; phân trang có thể khác Microsoft Word. Không sửa hồ sơ nhân sự từ bản xem trước.</p>
    {error ? <HrError message={error} /> : !html ? <HrLoading /> : <iframe title="Xem trước Word" sandbox="" srcDoc={html} className="h-[650px] w-full rounded-lg border bg-gray-100" />}
  </div>;
}
