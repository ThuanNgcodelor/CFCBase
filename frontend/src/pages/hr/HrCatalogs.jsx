import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FilePenLine, Plus, Power, Search } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { HrEmpty, HrError, HrPageHeader, HrPagination, HrStatusBadge } from '../../components/hr/HrUi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage, nonEmpty } from '../../utils/hr';

const TYPES = [
  { key: 'departments', label: 'Phòng ban HR' },
  { key: 'positions', label: 'Chức vụ HR' },
  { key: 'working-conditions', label: 'Điều kiện lao động' },
];

const EMPTY_FORM = { code: '', name: '', description: '', sortOrder: 0, parentId: '', rowVersion: null };
const INPUT_CLASS = 'h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function HrCatalogs() {
  const [type, setType] = useState('departments');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [departmentOptionsError, setDepartmentOptionsError] = useState('');

  const load = useCallback((signal) => {
    setLoading(true);
    setError('');
    const params = { page, size: 20, sort: 'sortOrder,asc' };
    if (keyword.trim()) params.keyword = keyword.trim();
    if (status) params.status = status;
    return hrCatalogApi.getCatalog(type, params, { signal })
      .then((data) => setResult(normalizePage(data)))
      .catch((requestError) => {
        if (!signal?.aborted) setError(apiErrorMessage(requestError, 'Không thể tải danh mục HR.'));
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [keyword, page, status, type]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => {
    if (type !== 'departments') return undefined;
    const controller = new AbortController();
    setDepartmentOptionsError('');
    hrCatalogApi.getAllCatalogItems('departments', { sort: 'name,asc' }, { signal: controller.signal })
      .then(setDepartmentOptions)
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setDepartmentOptionsError(apiErrorMessage(requestError, 'Không thể tải đầy đủ danh sách phòng ban cấp trên.'));
        }
      });
    return () => controller.abort();
  }, [reloadKey, type]);

  const changeType = (nextType) => {
    setType(nextType);
    setPage(0);
    setKeyword('');
    setStatus('');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      sortOrder: item.sortOrder ?? 0,
      parentId: item.parentId || '',
      rowVersion: item.rowVersion ?? item.version,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      ...(type === 'departments' ? { parentId: form.parentId || null } : {}),
      ...(editingId ? { rowVersion: form.rowVersion } : {}),
    };
    try {
      if (editingId) await hrCatalogApi.updateCatalogItem(type, editingId, payload);
      else await hrCatalogApi.createCatalogItem(type, payload);
      toast.success(editingId ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
      setModalOpen(false);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu danh mục.'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (item) => {
    if (!window.confirm(`Ngừng hoạt động “${item.name}”? Dữ liệu lịch sử vẫn được giữ nguyên.`)) return;
    try {
      await hrCatalogApi.updateCatalogItem(type, item.id, {
        code: item.code,
        name: item.name,
        description: item.description || null,
        sortOrder: item.sortOrder ?? 0,
        ...(type === 'departments' ? { parentId: item.parentId || null } : {}),
        status: 'INACTIVE',
        rowVersion: item.rowVersion ?? item.version,
      });
      toast.success('Đã ngừng hoạt động danh mục');
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể ngừng hoạt động danh mục.'));
    }
  };

  const activeTypeLabel = TYPES.find((item) => item.key === type)?.label;

  return (
    <div className="w-full max-w-6xl">
      <SEOHead title="CFC Base | Danh mục nhân sự" url="https://cfcbooking.io.vn/manager/hr/catalogs" />
      <HrPageHeader
        title="Danh mục nhân sự"
        description="Phòng ban, chức vụ và điều kiện lao động thuộc riêng phân hệ nhân sự; không dùng danh mục của BookingBase."
        actions={<Button type="button" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Thêm {activeTypeLabel?.toLowerCase()}</Button>}
      />

      <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TYPES.map((item) => (
          <button key={item.key} type="button" onClick={() => changeType(item.key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${type === item.key ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(0); }} placeholder="Tìm theo mã hoặc tên" className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
      </div>

      {error && <div className="mb-4"><HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} /></div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr><th className="px-5 py-4">Mã</th><th className="px-5 py-4">Tên danh mục</th><th className="hidden px-5 py-4 lg:table-cell">Mô tả / cấp trên</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">Đang tải danh mục...</td></tr>
            ) : result.content.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-emerald-700">{item.code}</td>
                <td className="px-5 py-4"><p className="text-sm font-medium text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-400 lg:hidden">{nonEmpty(item.parentName || item.description)}</p></td>
                <td className="hidden max-w-sm px-5 py-4 text-sm text-gray-500 lg:table-cell">{nonEmpty(item.parentName || item.description)}</td>
                <td className="px-5 py-4"><HrStatusBadge status={item.status} /></td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(item)} aria-label={`Sửa ${item.name}`}><FilePenLine className="h-4 w-4" /></Button>
                    {item.status !== 'INACTIVE' && <Button type="button" size="sm" variant="danger" onClick={() => deactivate(item)} aria-label={`Ngừng ${item.name}`}><Power className="h-4 w-4" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && result.content.length === 0 && <tr><td colSpan="5" className="p-5"><HrEmpty title="Chưa có danh mục phù hợp" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4"><HrPagination page={page} totalPages={result.totalPages} totalElements={result.totalElements} loading={loading} onPageChange={setPage} /></div>

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editingId ? `Sửa ${activeTypeLabel}` : `Thêm ${activeTypeLabel}`}>
        <form onSubmit={save} className="space-y-4">
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-gray-700">Mã *</span><input required maxLength={32} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={INPUT_CLASS} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-gray-700">Tên *</span><input required maxLength={255} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-gray-700">Mô tả</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500" /></label>
          {type === 'departments' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">Phòng ban cấp trên</span>
              <select value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))} className={INPUT_CLASS}>
                <option value="">Không có</option>
                {departmentOptions.filter((item) => item.id !== editingId).map((item) => (
                  <option key={item.id} value={item.id} disabled={item.status === 'INACTIVE'}>
                    {item.name}{item.status === 'INACTIVE' ? ' (đã ngừng)' : ''}
                  </option>
                ))}
              </select>
              {departmentOptionsError && <span className="text-xs text-red-600">{departmentOptionsError}</span>}
            </label>
          )}
          <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-gray-700">Thứ tự hiển thị</span><input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} className={INPUT_CLASS} /></label>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu danh mục'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
