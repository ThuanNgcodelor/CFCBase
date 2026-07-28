import {
  BriefcaseBusiness,
  CircleGauge,
  FolderCog,
  PencilLine,
  Plus,
  Search
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Drawer } from '../components/overlays/Drawer.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field, SelectInput, TextArea, TextInput } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAppData } from '../context/AppDataContext.jsx';

const catalogTabs = [
  { key: 'departments', label: 'Phòng ban', singular: 'phòng ban', icon: FolderCog },
  { key: 'positions', label: 'Chức vụ', singular: 'chức vụ', icon: BriefcaseBusiness },
  { key: 'conditions', label: 'Điều kiện làm việc', singular: 'điều kiện làm việc', icon: CircleGauge }
];

const emptyItem = {
  id: '',
  code: '',
  name: '',
  description: ''
};

export function CatalogsPage() {
  const {
    catalogs,
    loading,
    error,
    reload,
    saveCatalog
  } = useAppData();
  const [activeTab, setActiveTab] = useState('departments');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyItem);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const tab = catalogTabs.find((item) => item.key === activeTab) || catalogTabs[0];
  const ActiveIcon = tab.icon;
  const items = Array.isArray(catalogs?.[activeTab]) ? catalogs[activeTab] : [];
  const visibleItems = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return items.filter((item) => {
      const searchable = `${item.code || ''} ${item.name || ''} ${item.description || ''}`
        .toLocaleLowerCase('vi');
      return (!normalized || searchable.includes(normalized))
        && (!status || item.status === status);
    });
  }, [items, keyword, status]);

  const openCreate = () => {
    setForm(emptyItem);
    setFormError('');
    setDrawerOpen(true);
  };

  const openEdit = (item) => {
    setForm({ ...emptyItem, ...item });
    setFormError('');
    setDrawerOpen(true);
  };

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFormError('');
  };

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Mã và tên danh mục là thông tin bắt buộc.');
      return;
    }
    setSaving(true);
    try {
      await saveCatalog(activeTab, {
        id: form.id,
        code: form.code,
        name: form.name,
        description: form.description
      });
      setDrawerOpen(false);
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể lưu danh mục.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="catalogs-page">
      <PageHeader
        title="Danh mục nhân sự"
        description="Quản lý dữ liệu dùng chung cho hồ sơ nhân sự và biểu mẫu thử việc."
        actions={<Button onClick={openCreate}><Plus />Thêm {tab.singular}</Button>}
      />

      <nav className="catalog-tabs" aria-label="Nhóm danh mục">
        {catalogTabs.map((item) => {
          const Icon = item.icon;
          const count = Array.isArray(catalogs?.[item.key]) ? catalogs[item.key].length : 0;
          return (
            <button
              key={item.key}
              type="button"
              className={activeTab === item.key ? 'catalog-tab catalog-tab--active' : 'catalog-tab'}
              onClick={() => { setActiveTab(item.key); setKeyword(''); setStatus(''); }}
            >
              <Icon aria-hidden="true" />
              <span><strong>{item.label}</strong><small>{count} mục</small></span>
            </button>
          );
        })}
      </nav>

      <div className="catalog-filter surface">
        <label className="search-control">
          <Search aria-hidden="true" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={`Tìm mã hoặc tên ${tab.singular}`} />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang sử dụng</option>
          <option value="INACTIVE">Ngừng sử dụng</option>
        </select>
        <Button variant="ghost" onClick={() => { setKeyword(''); setStatus(''); }}>Xóa lọc</Button>
      </div>

      {error ? (
        <div className="surface"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <div className="catalog-ledger surface">
          <div className="catalog-table-wrap">
            <table className="data-table catalog-table">
              <thead><tr><th>Mã</th><th>Tên {tab.singular}</th><th>Mô tả</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="5"><LoadingState label="Đang tải danh mục..." /></td></tr> : visibleItems.map((item) => (
                  <tr key={item.id || item.code}>
                    <td><strong className="catalog-code">{item.code || '—'}</strong></td>
                    <td><strong>{item.name || '—'}</strong></td>
                    <td>{item.description || '—'}</td>
                    <td><StatusBadge status={item.status} label={item.status === 'ACTIVE' ? 'Đang sử dụng' : undefined} /></td>
                    <td><Button size="sm" variant="secondary" onClick={() => openEdit(item)}><PencilLine />Chỉnh sửa</Button></td>
                  </tr>
                ))}
                {!loading && !visibleItems.length ? (
                  <tr><td colSpan="5"><EmptyState title={`Chưa có ${tab.singular}`} description="Thêm dữ liệu danh mục để sử dụng trong các biểu mẫu nhân sự." action={<Button onClick={openCreate}><Plus />Thêm mới</Button>} /></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="catalog-card-list">
            {loading ? <LoadingState label="Đang tải danh mục..." /> : visibleItems.map((item) => {
              const Icon = tab.icon;
              return (
                <article key={item.id || item.code} className="catalog-card">
                  <span className="catalog-card__icon"><Icon /></span>
                  <div><strong>{item.name || '—'}</strong><small>{item.code || '—'}</small></div>
                  <StatusBadge status={item.status} label={item.status === 'ACTIVE' ? 'Đang sử dụng' : undefined} />
                  <p>{item.description || 'Chưa có mô tả'}</p>
                  <Button variant="secondary" onClick={() => openEdit(item)}><PencilLine />Chỉnh sửa</Button>
                </article>
              );
            })}
            {!loading && !visibleItems.length ? <EmptyState title={`Chưa có ${tab.singular}`} description="Thêm dữ liệu danh mục để sử dụng trong các biểu mẫu nhân sự." /> : null}
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        title={form.id ? `Chỉnh sửa ${tab.singular}` : `Thêm ${tab.singular}`}
        width="500px"
        onClose={() => !saving && setDrawerOpen(false)}
        footer={(
          <>
            <Button variant="neutral" onClick={() => setDrawerOpen(false)} disabled={saving}>Hủy</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu danh mục'}</Button>
          </>
        )}
      >
        <div className="drawer-intro">
          <span><ActiveIcon /></span>
          <div><strong>Dữ liệu dùng chung</strong><p>Thay đổi sẽ được sử dụng trong các biểu mẫu tạo mới sau khi lưu.</p></div>
        </div>
        <div className="drawer-form">
          <Field label="Mã" required><TextInput value={form.code} onChange={update('code')} placeholder="Nhập mã danh mục" /></Field>
          <Field label={`Tên ${tab.singular}`} required><TextInput value={form.name} onChange={update('name')} placeholder={`Nhập tên ${tab.singular}`} /></Field>
          <Field label="Mô tả"><TextArea value={form.description} onChange={update('description')} placeholder="Mô tả ngắn mục đích sử dụng" /></Field>
          <p className="drawer-readonly-note">Trạng thái danh mục được quản lý bằng luồng ngừng sử dụng có kiểm tra tham chiếu, không thay đổi trong biểu mẫu này.</p>
          {formError ? <p className="form-submit-error" role="alert">{formError}</p> : null}
        </div>
      </Drawer>
    </section>
  );
}
