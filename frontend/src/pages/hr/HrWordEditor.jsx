import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { hrWordEditorApi } from '../../api/hrWordEditorApi';
import { apiErrorMessage } from '../../utils/hr';
import { Button } from '../../components/ui/Button';
import { HrPageShell, HrPageHeader, HrLoading, HrError } from '../../components/hr/HrUi';
import { HrWordPreview } from '../../components/hr/HrWordPreview';

const scripts = new Map();
function loadEditor(url) {
  if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url; script.async = true;
    script.onload = () => resolve(); script.onerror = () => { scripts.delete(url); script.remove(); reject(new Error('Document Server không truy cập được từ trình duyệt.')); };
    document.head.appendChild(script);
  }));
  return scripts.get(url);
}

export default function HrWordEditor() {
  const { id } = useParams();
  return <EditorSession key={id} id={id} />;
}
function EditorSession({ id }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const editor = useRef(null);
  const host = useRef(null);
  const ended = useRef(false);
  const sessionStatus = session?.status;
  const terminal = ['READY', 'UNCHANGED', 'PUBLISHED'].includes(sessionStatus);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const state = await hrWordEditorApi.state(id, controller.signal);
        if (controller.signal.aborted) return;
        setSession(state);
        if (state.status !== 'OPEN' || ended.current) return;
        const result = await hrWordEditorApi.config(id, controller.signal);
        await loadEditor(result.scriptUrl);
        if (controller.signal.aborted || ended.current || !host.current) return;
        // Dedicated child is replaced by ONLYOFFICE; React owns only its parent.
        const child = document.createElement('div'); child.id = `word-${id}`;
        host.current.replaceChildren(child);
        editor.current = new window.DocsAPI.DocEditor(child.id, {
          ...result.config,
          events: {
            onDocumentReady: () => { if (!controller.signal.aborted) setReady(true); },
            onError: () => { if (!controller.signal.aborted) setError('Trình sửa Word báo lỗi. Kiểm tra kết nối Document Server; chưa xác nhận lưu vào CFCBase.'); },
          },
        });
      } catch (e) { if (!controller.signal.aborted) setError(apiErrorMessage(e, 'Không mở được trình sửa Word.')); }
    })();
    return () => { controller.abort(); editor.current?.destroyEditor(); editor.current = null; };
  }, [id]);
  useEffect(() => {
    if (!sessionStatus || terminal) return undefined;
    const controller = new AbortController(); let timer;
    const poll = async () => {
      try { const state = await hrWordEditorApi.state(id, controller.signal); if (!controller.signal.aborted) setSession(state); }
      catch { /* No success shown without backend confirmation. */ }
      if (!controller.signal.aborted) timer = window.setTimeout(poll, 2500);
    };
    poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [id, sessionStatus, terminal, refresh]);
  useEffect(() => {
    if (terminal) { ended.current = true; editor.current?.destroyEditor(); editor.current = null; }
  }, [terminal]);
  useEffect(() => {
    if (terminal) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [terminal]);
  const finish = () => {
    if (!window.confirm('Kết thúc chỉnh sửa để chuyển bản Word về CFCBase? Vui lòng chờ xác nhận lưu ở bước tiếp theo.')) return;
    ended.current = true; setClosing(true); setReady(false);
    editor.current?.destroyEditor(); editor.current = null;
  };
  const publish = async () => {
    setBusy(true); setError('');
    try {
      await hrWordEditorApi.publish(id, note);
      setSession(await hrWordEditorApi.state(id)); toast.success('Đã lưu phiên bản vào kho CFCBase.');
    } catch (e) { setError(apiErrorMessage(e, 'Không lưu được phiên bản. Bản nháp vẫn được giữ.')); }
    finally { setBusy(false); }
  };
  const reopen = async () => {
    setBusy(true);
    try { const next = await hrWordEditorApi.open({ draftId: id }); navigate(`/manager/hr/word-editor/${next.id}`); }
    catch (e) { setError(apiErrorMessage(e, 'Không mở lại được bản nháp.')); }
    finally { setBusy(false); }
  };
  return <HrPageShell size="wide"><HrPageHeader title="Chỉnh sửa Word trực tiếp" description="Chỉnh nội dung, font, bảng và căn lề ngay trên web. Bản gốc không bị ghi đè." />
    {error && <HrError message={error} />}
    {!session && !error && <HrLoading />}
    {session && <>
      <div className="mb-3 rounded-lg border bg-white p-4"><strong>{session.fileName}</strong>
        <p className="mt-2 text-sm">{terminal ? session.status === 'PUBLISHED' ? 'Đã lưu phiên bản vào kho CFCBase.' : 'CFCBase đã nhận bản nháp. Kiểm tra và lưu phiên bản bên dưới.' : closing ? 'Đang chờ Document Server chuyển file về (thường từ 10 giây). Chưa xác nhận lưu.' : 'Đang chỉnh sửa. Save trong Word lưu tại Document Server; chọn Kết thúc chỉnh sửa để chuyển về CFCBase.'}</p>
        {!terminal && !closing && <Button className="mt-3" disabled={!ready} onClick={finish}>Kết thúc chỉnh sửa & nhận bản lưu</Button>}
        {closing && !terminal && <Button variant="secondary" className="mt-3" onClick={() => setRefresh(v => v + 1)}>Kiểm tra trạng thái lưu</Button>}
      </div>
      <div ref={host} className={terminal || closing ? 'hidden' : 'h-[78vh] min-h-[550px] w-full border bg-white'} />
      {terminal && <section className="space-y-3 rounded-lg border bg-white p-4">
        <Button variant="secondary" disabled={busy} onClick={async () => { try { setPreview(await hrWordEditorApi.draft(id)); } catch (e) { setError(apiErrorMessage(e, 'Không tải được bản nháp.')); } }}>Xem bản đã nhận</Button>
        {session.status !== 'PUBLISHED' && <><Button variant="secondary" disabled={busy} onClick={reopen}>Tiếp tục sửa bản nháp</Button><label className="block">Ghi chú phiên bản<input className="mt-1 block w-full rounded border p-2" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label><Button disabled={busy || !note.trim()} onClick={publish}>Lưu phiên bản vào kho</Button></>}
        <p className="text-sm text-gray-600">Mẫu mới chưa tự áp dụng. Sau khi lưu, quay lại kho mẫu để xem và áp dụng. Chỉnh hợp đồng riêng không thay thông tin hồ sơ nhân sự.</p>
        <Link className="block text-emerald-700 underline" to={session.type === 'TEMPLATE' ? '/manager/hr/document-templates' : '/manager/hr/employees'}>Quay về {session.type === 'TEMPLATE' ? 'kho mẫu' : 'nhân sự'}</Link>
        <HrWordPreview blob={preview} />
      </section>}
    </>}
  </HrPageShell>;
}
