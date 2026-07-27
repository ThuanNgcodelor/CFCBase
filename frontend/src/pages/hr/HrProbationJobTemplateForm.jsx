import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, BriefcaseBusiness, ClipboardList, FileBadge2, Save } from 'lucide-react';
import SEOHead from '../../components/SEOHead';
import { Button } from '../../components/ui/Button';
import { HrError, HrLoading, HrPageHeader, HrPageShell } from '../../components/hr/HrUi';
import { hrCatalogApi } from '../../api/hrCatalogApi';
import { hrProbationApi } from '../../api/hrProbationApi';
import { apiErrorMessage } from '../../utils/hr';

const INPUT_CLASS = 'h-11 w-full rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:h-10 sm:text-sm';
const TEXTAREA_CLASS = 'min-h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';
const TEMPLATE_LIST_PATH = '/manager/hr/probation?tab=templates';

const EMPTY_TEMPLATE_FORM = {
  code: '',
  name: '',
  description: '',
  departmentId: '',
  positionId: '',
  workingConditionId: '',
  probationContractType: 'Xác định thời hạn 02 tháng',
  jobDescription: '',
  baseSalary: '',
  salaryNote: '',
  departmentRuleNote: '',
  sortOrder: 0,
  status: 'ACTIVE',
  rowVersion: null,
};

function refId(value) {
  return value?.id || '';
}

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function moneyValue(value) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function nullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function templatePayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: nullableText(form.description),
    departmentId: form.departmentId || null,
    positionId: form.positionId || null,
    workingConditionId: form.workingConditionId || null,
    probationContractType: nullableText(form.probationContractType),
    jobDescription: nullableText(form.jobDescription),
    baseSalary: nullableNumber(form.baseSalary),
    salaryNote: nullableText(form.salaryNote),
    departmentRuleNote: nullableText(form.departmentRuleNote),
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function formFromTemplate(template) {
  return {
    code: stringValue(template.code),
    name: stringValue(template.name),
    description: stringValue(template.description),
    departmentId: refId(template.department),
    positionId: refId(template.position),
    workingConditionId: refId(template.workingCondition),
    probationContractType: stringValue(template.probationContractType || 'Xác định thời hạn 02 tháng'),
    jobDescription: stringValue(template.jobDescription),
    baseSalary: moneyValue(template.baseSalary),
    salaryNote: stringValue(template.salaryNote),
    departmentRuleNote: stringValue(template.departmentRuleNote),
    sortOrder: template.sortOrder ?? 0,
    status: template.status || 'ACTIVE',
    rowVersion: template.rowVersion ?? template.version,
  };
}

function Field({ label, wide = false, children }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function FormSection({ icon: Icon, step, title, description, children }) {
  return (
    <section className="rounded-xl border border-[var(--cfc-border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Mục {step}/2</p>
          <h2 className="mt-0.5 font-semibold text-[var(--cfc-ink)]">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-[var(--cfc-muted)]">{description}</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CatalogSelect({ value, onChange, items, placeholder = 'Chưa chọn' }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS}>
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>{item.name}</option>
      ))}
    </select>
  );
}

export default function HrProbationJobTemplateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [catalogs, setCatalogs] = useState({ departments: [], positions: [], conditions: [] });
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      hrCatalogApi.getAllCatalogItems('departments', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('positions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      hrCatalogApi.getAllCatalogItems('working-conditions', { status: 'ACTIVE', sort: 'name,asc' }, { signal: controller.signal }),
      isEdit ? hrProbationApi.getJobTemplate(id, { signal: controller.signal }) : Promise.resolve(null),
    ])
      .then(([departments, positions, conditions, template]) => {
        if (controller.signal.aborted) return;
        setCatalogs({ departments, positions, conditions });
        setForm(template ? formFromTemplate(template) : EMPTY_TEMPLATE_FORM);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'Không thể tải dữ liệu mẫu công việc thử việc.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isEdit, reloadKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = templatePayload(form);
      if (isEdit) {
        await hrProbationApi.updateJobTemplate(id, {
          rowVersion: form.rowVersion,
          template: payload,
          status: form.status,
        });
        toast.success('Đã cập nhật mẫu công việc thử việc');
      } else {
        await hrProbationApi.createJobTemplate(payload);
        toast.success('Đã thêm mẫu công việc thử việc');
      }
      navigate(TEMPLATE_LIST_PATH);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể lưu mẫu công việc thử việc.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPageShell size="readable">
      <SEOHead
        title={`CFC Base | ${isEdit ? 'Chỉnh sửa' : 'Thêm'} mẫu công việc thử việc`}
        url={`https://cfcbooking.io.vn${isEdit ? `/manager/hr/probation/templates/${id}/edit` : '/manager/hr/probation/templates/new'}`}
      />
      <HrPageHeader
        title={isEdit ? 'Chỉnh sửa mẫu công việc thử việc' : 'Thêm mẫu công việc thử việc'}
        description="Mẫu này dùng để tự điền nhanh phòng ban, chức vụ, lương và nội dung công việc khi thêm ứng viên thử việc."
        actions={(
          <Button type="button" variant="secondary" onClick={() => navigate(TEMPLATE_LIST_PATH)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Quay lại danh sách mẫu
          </Button>
        )}
      />

      {loading ? <HrLoading /> : error ? (
        <HrError message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <FileBadge2 className="h-5 w-5 shrink-0 text-emerald-700" />
              <div><p className="text-xs text-[var(--cfc-muted)]">Mã mẫu</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--cfc-ink)]">{form.code || 'Chưa nhập'}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <BriefcaseBusiness className="h-5 w-5 shrink-0 text-emerald-700" />
              <div><p className="text-xs text-[var(--cfc-muted)]">Tên mẫu</p><p className="mt-0.5 truncate text-sm font-semibold text-[var(--cfc-ink)]">{form.name || 'Chưa nhập'}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 shrink-0 text-emerald-700" />
              <div><p className="text-xs text-[var(--cfc-muted)]">Trạng thái</p><p className="mt-0.5 text-sm font-semibold text-[var(--cfc-ink)]">{form.status === 'INACTIVE' ? 'Ngừng hoạt động' : 'Đang hoạt động'}</p></div>
            </div>
          </div>

          <FormSection icon={FileBadge2} step="1" title="Thông tin mẫu">
            <Field label="Mã mẫu *">
              <input required maxLength={32} value={form.code} onChange={(event) => updateForm('code', event.target.value.toUpperCase())} className={INPUT_CLASS} />
            </Field>
            <Field label="Tên mẫu *">
              <input required maxLength={255} value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Phòng ban HR">
              <CatalogSelect value={form.departmentId} onChange={(value) => updateForm('departmentId', value)} items={catalogs.departments} />
            </Field>
            <Field label="Chức vụ HR">
              <CatalogSelect value={form.positionId} onChange={(value) => updateForm('positionId', value)} items={catalogs.positions} />
            </Field>
            <Field label="Điều kiện lao động">
              <CatalogSelect value={form.workingConditionId} onChange={(value) => updateForm('workingConditionId', value)} items={catalogs.conditions} />
            </Field>
            <Field label="Loại hợp đồng">
              <input maxLength={100} value={form.probationContractType} onChange={(event) => updateForm('probationContractType', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Lương thử việc">
              <input type="number" min="0" step="1" value={form.baseSalary} onChange={(event) => updateForm('baseSalary', event.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Thứ tự">
              <input type="number" min="0" value={form.sortOrder} onChange={(event) => updateForm('sortOrder', event.target.value)} className={INPUT_CLASS} />
            </Field>
            {isEdit && (
              <Field label="Trạng thái">
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className={INPUT_CLASS}>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </select>
              </Field>
            )}
            <Field label="Mô tả" wide>
              <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} className={TEXTAREA_CLASS} />
            </Field>
          </FormSection>

          <FormSection
            icon={ClipboardList}
            step="2"
            title="Nội dung công việc và lương"
            description="Các nội dung này sẽ được dùng để điền nhanh cho ứng viên và phục vụ sinh hợp đồng thử việc."
          >
            <Field label="Ghi chú lương" wide>
              <input maxLength={255} value={form.salaryNote} onChange={(event) => updateForm('salaryNote', event.target.value)} placeholder="Ví dụ: /tháng, chưa bao gồm phụ cấp..." className={INPUT_CLASS} />
            </Field>
            <Field label="Công việc phải làm" wide>
              <textarea value={form.jobDescription} onChange={(event) => updateForm('jobDescription', event.target.value)} className={TEXTAREA_CLASS} />
            </Field>
            <Field label="Quy định riêng phòng ban" wide>
              <textarea value={form.departmentRuleNote} onChange={(event) => updateForm('departmentRuleNote', event.target.value)} className={TEXTAREA_CLASS} />
            </Field>
          </FormSection>

          <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate(TEMPLATE_LIST_PATH)} disabled={saving}>Hủy</Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu mẫu công việc'}
            </Button>
          </div>
        </form>
      )}
    </HrPageShell>
  );
}
