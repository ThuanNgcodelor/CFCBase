import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { baseApi } from '../../api/baseApi';
import { unwrapApiData } from '../../api/hrApiUtils';
import { Button } from '../../components/ui/Button';
import { HrPageShell, HrPageHeader, HrLoading, HrError } from '../../components/hr/HrUi';
import { HrWordPreview } from '../../components/hr/HrWordPreview';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';
import { apiErrorMessage, formatHrDateTime } from '../../utils/hr';

const KINDS = { OFFICE: 'Hợp đồng văn phòng', GENERAL_LABOR: 'Hợp đồng lao động phổ thông', PROBATION: 'Hợp đồng thử việc' };
export default function HrDocumentTemplates() {
  const [kind, setKind] = useState('OFFICE');
  return <HrPageShell size="wide"><HrPageHeader title="Mẫu Word hợp đồng" description="Tải mẫu, chỉnh bằng Word, xem trước và áp dụng phiên bản mới. Các bản hợp đồng đã xuất không bị ghi đè." />
    <label className="block">Loại mẫu<select className="ml-3 rounded-lg border p-2" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <TemplateVersions key={kind} kind={kind} />
  </HrPageShell>;
}
function TemplateVersions({ kind }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const url = `/hr/document-templates/${kind}`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    baseApi.get(url, { params: { page }, signal: controller.signal }).then(r => { if (!controller.signal.aborted) setRows(unwrapApiData(r)); })
      .catch(e => { if (!controller.signal.aborted) setError(apiErrorMessage(e, 'Không tải được mẫu.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, page, revision]);
  const run = async (action) => {
    setBusy(true);
    try { await action(); } catch (e) { toast.error(apiErrorMessage(e, 'Không thực hiện được thao tác.')); }
    finally { setBusy(false); }
  };
  const open = (id) => run(async () => {
    setPreview(null); setPreviewId(null);
    const r = await baseApi.get(`${url}/${id}/download`, { responseType: 'blob' });
    setPreview(r.data); setPreviewId(id);
  });
  const download = (id) => run(async () => downloadResponseBlob(await baseApi.get(`${url}/${id}/download`, { responseType: 'blob' }), 'mau-hop-dong.docx'));
  const activate = (id) => run(async () => {
    if (!window.confirm('Áp dụng mẫu này cho các hợp đồng được tạo từ bây giờ? Bản cũ sẽ được giữ nguyên.')) return;
    await baseApi.post(`${url}/${id}/activate`); setRevision(v => v + 1); toast.success('Đã áp dụng mẫu.');
  });
  const upload = e => {
    e.preventDefault(); const form = e.currentTarget;
    run(async () => {
      if (!file || !file.name.toLowerCase().endsWith('.docx') || file.size > 15 * 1024 * 1024) throw new Error('Chọn file .docx tối đa 15 MB.');
      const body = new FormData(); body.append('file', file); body.append('note', note);
      const id = unwrapApiData(await baseApi.post(url, body));
      setFile(null); setNote(''); form.reset(); setPage(0); setRevision(v => v + 1);
      setPreview(null); setPreviewId(null);
      const r = await baseApi.get(`${url}/${id}/download`, { responseType: 'blob' }); setPreview(r.data); setPreviewId(id);
      toast.success('Đã lưu mẫu. Kiểm tra bản xem trước rồi chọn Áp dụng.');
    });
  };
  return <section className="mt-5 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => download('active')}>Tải mẫu đang dùng</Button><Button variant="secondary" disabled={busy} onClick={() => open('builtin')}>Xem mẫu gốc</Button><Button variant="secondary" disabled={busy || previewId !== 'builtin'} onClick={() => activate('builtin')}>Dùng lại mẫu gốc</Button></div>
    <form onSubmit={upload} className="my-5 space-y-3"><p className="text-sm text-gray-600">Giữ nguyên các biến dạng {'{{FULL_NAME}}'} khi chỉnh bố cục. Upload chỉ lưu phiên bản, chưa thay mẫu đang dùng.</p><input type="file" required accept=".docx" onChange={e => setFile(e.target.files?.[0] || null)} /><input required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thay đổi" aria-label="Ghi chú thay đổi" className="block w-full rounded-lg border p-2" /><Button disabled={busy || !file || !note.trim()}>Lưu phiên bản mẫu</Button></form>
    {loading ? <HrLoading /> : error ? <HrError message={error} /> : <ul className="divide-y">{rows.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="break-all">{r.fileName}</strong>{r.active && <span className="ml-2 text-emerald-700">Đang dùng</span>}<p className="text-sm text-gray-500">{formatHrDateTime(r.createdAt)} · {r.note}</p></div><div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => open(r.id)}>Xem trước</Button><Button variant="secondary" disabled={busy} onClick={() => download(r.id)}>Tải</Button><Button disabled={busy || r.active || previewId !== r.id} onClick={() => activate(r.id)}>Áp dụng</Button></div></li>)}</ul>}
    <div className="mt-3 flex gap-3"><Button variant="secondary" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Trước</Button><span>Trang {page + 1}</span><Button variant="secondary" disabled={loading || rows.length < 20} onClick={() => setPage(p => p + 1)}>Sau</Button></div>
    <HrWordPreview blob={preview} />
  </section>;
}
