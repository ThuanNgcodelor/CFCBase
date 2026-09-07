import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrEmpty, HrError, HrLoading, HrPagination, HrStatusBadge } from './HrUi';
import { useEmployeeProfilePage } from './useEmployeeProfilePage';
import { hrEmploymentContractApi } from '../../api/hrEmploymentContractApi';
import { apiErrorMessage, formatHrDate, formatHrDateTime } from '../../utils/hr';
import { contractTypeLabel } from '../../utils/hrOnboarding';
import { contractTermLabel } from '../../utils/hrContractStatus';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';
import { HrWordPreview } from './HrWordPreview';
import { Link } from 'react-router-dom';

const STATUS = { READY: 'Chờ tăng nhân sự', EFFECTIVE: 'Đã kích hoạt', VOIDED: 'Đã hủy' };

function ContractVersions({ employeeId, contract }) {
  const { data, loading, error, setPage, reload } = useEmployeeProfilePage(employeeId, `contracts/${contract.id}/documents`);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [source, setSource] = useState(null);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const open = async (document) => {
    setBusy(true); setPreview(null);
    try { setPreview((await hrEmploymentContractApi.downloadDocument(document.id)).data); }
    catch (err) { toast.error(apiErrorMessage(err, 'Không tải được bản xem trước.')); }
    finally { setBusy(false); }
  };
  const upload = async (event) => {
    event.preventDefault();
    if (!source || !file || !file.name.toLowerCase().endsWith('.docx') || file.size > 15 * 1024 * 1024) {
      toast.error('Chọn file .docx tối đa 15 MB.'); return;
    }
    setBusy(true);
    try {
      await hrEmploymentContractApi.uploadRevision(source.id, file, note);
      setSource(null); setFile(null); setNote(''); setPreview(null); setPage(0); reload();
      toast.success('Đã lưu bản chỉnh sửa riêng, không thay đổi hồ sơ nhân sự.');
    } catch (err) { toast.error(apiErrorMessage(err, 'Không lưu được bản chỉnh sửa.')); }
    finally { setBusy(false); }
  };
  const download = async (document) => {
    setBusy(true);
    try { downloadResponseBlob(await hrEmploymentContractApi.downloadDocument(document.id), document.generatedFileName); }
    catch (err) { toast.error(apiErrorMessage(err, 'Không thể tải bản hợp đồng.')); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    setBusy(true);
    try {
      await hrEmploymentContractApi.generateDocument(contract.id);
      setPage(0); reload();
      toast.success('Đã lưu bản Word mới. Bạn có thể tải bản này trong danh sách.');
    } catch (err) { toast.error(apiErrorMessage(err, 'Không thể tạo bản Word.')); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 rounded-xl border border-emerald-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">Các bản đã xuất · {contract.contractNumber}</h3>
      <Button type="button" disabled={busy || contract.status === 'VOIDED'} onClick={generate}>Tạo bản Word mới</Button>
    </div>
    <p className="mt-2 text-sm text-gray-500">Mỗi bản giữ nguyên nội dung lúc xuất. Bản Word mới lấy thông tin hồ sơ hiện tại. Bản scan đã ký được lưu tại Hồ sơ & giấy tờ.</p>
    {loading ? <HrLoading /> : error ? <HrError message={error} onRetry={reload} /> : <>
      {data.content.length === 0 ? <div className="py-6"><HrEmpty title="Chưa có bản Word đã xuất" description="Chọn Tạo bản Word mới để tạo và lưu bản đầu tiên." /></div> :
        <ul className="mt-4 divide-y divide-gray-100">{data.content.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0"><p className="break-all text-sm font-medium">{document.generatedFileName}</p><p className="mt-1 text-xs text-gray-500">Xuất lúc {formatHrDateTime(document.generatedAt)}</p>
            <details className="mt-1 text-xs text-gray-500"><summary className="cursor-pointer">Thông tin đối chiếu bản xuất</summary><p className="break-all">Mẫu: {document.templateFileName}</p><p className="break-all">Mã bản: {document.id}</p><p className="break-all">SHA-256: {document.generatedFileSha256}</p></details>
          </div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => open(document)}>Xem trước</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => download(document)}>Tải bản này</Button><Button type="button" variant="secondary" disabled={busy || contract.status === 'VOIDED'} onClick={() => { setSource(document); setFile(null); setNote(''); }}>Tải bản đã sửa lên</Button></div>
        </li>)}</ul>}
      <HrPagination page={data.number} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
    </>}
    {source && <form key={source.id} onSubmit={upload} className="mt-4 space-y-3 rounded-lg border p-4"><p>Bản gốc: {source.generatedFileName}. Bản tải lên được giữ riêng, không đồng bộ ngược thông tin vào hồ sơ.</p><input type="file" required accept=".docx" onChange={e => setFile(e.target.files?.[0] || null)} /><input aria-label="Ghi chú chỉnh sửa" required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú chỉnh sửa" className="block w-full rounded-lg border p-2" /><Button disabled={busy || !file || !note.trim()}>Lưu bản chỉnh sửa</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setSource(null)}>Hủy</Button></form>}
    <HrWordPreview blob={preview} />
  </section>;
}

export function HrEmployeeContractsTab({ employeeId }) {
  const { data, loading, error, setPage, reload } = useEmployeeProfilePage(employeeId, 'contracts');
  const [selected, setSelected] = useState(null);
  return <>
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Lịch sử hợp đồng lao động</h2>
      <Link to="/manager/hr/document-templates" className="text-sm text-emerald-700 underline">Quản lý mẫu Word</Link>
      <p className="mt-1 text-sm text-gray-500">Theo ngày bắt đầu mới nhất. Nhắc thời hạn trong 30 ngày; nhắc hạn không tự thay đổi trạng thái hợp đồng hoặc nhân sự.</p>
      {loading ? <HrLoading /> : error ? <HrError message={error} onRetry={reload} /> : <>
        {!data.content.length ? <div className="py-6"><HrEmpty title="Chưa có hợp đồng trong kho" description="Hồ sơ nhập từ Excel có thể chỉ lưu số hợp đồng ở phần Công việc. Hợp đồng tạo qua tiếp nhận lao động hoặc chuyển thử việc sẽ xuất hiện ở đây." /></div> :
          <div className="mt-4 space-y-3">{data.content.map((contract) => <article key={contract.id} className={`rounded-lg border p-4 ${selected?.id === contract.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><strong>{contract.contractNumber}</strong><HrStatusBadge status={contract.status} label={STATUS[contract.status] || contract.status} /></div>
            <p className="mt-2 text-sm">{contractTypeLabel(contract.contractType)} · Ký: {formatHrDate(contract.signDate)}</p>
            <p className="mt-1 text-sm">{formatHrDate(contract.effectiveFrom)} — {contract.effectiveUntil ? formatHrDate(contract.effectiveUntil) : 'Không thời hạn'}</p>
            <p className="mt-2 text-sm font-medium text-amber-800">{contractTermLabel(contract)}</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => setSelected(contract)}>Xem các bản đã xuất</Button>
          </article>)}</div>}
        <HrPagination page={data.number} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={(page) => { setSelected(null); setPage(page); }} />
      </>}
    </section>
    {selected && <ContractVersions key={`${employeeId}/${selected.id}`} employeeId={employeeId} contract={selected} />}
  </>;
}
