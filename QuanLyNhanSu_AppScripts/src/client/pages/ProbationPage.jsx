import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  FileText,
  PencilLine,
  Play,
  Plus,
  Search,
  UserPlus,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { useAppData } from '../context/AppDataContext.jsx';
import { formatCurrency, formatDateDisplay, initialsOf } from '../lib/format.js';

export function ProbationPage({ navigate, activeTab = 'candidates' }) {
  const {
    candidates,
    jobTemplates,
    loading,
    error,
    reload,
    runProbationAction
  } = useAppData();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [actingId, setActingId] = useState('');
  const [actionError, setActionError] = useState('');

  const executeAction = async (record, action, payload = {}) => {
    setActingId(`${record.id}:${action}`);
    setActionError('');
    try {
      await runProbationAction(record, action, payload);
    } catch (requestError) {
      setActionError(requestError.message || 'Không thể thực hiện thao tác.');
    } finally {
      setActingId('');
    }
  };

  const candidateActions = (candidate, compact = false) => {
    const busy = actingId.startsWith(`${candidate.id}:`);
    if (candidate.status === 'DRAFT') {
      return (
        <div className={compact ? 'probation-actions probation-actions--compact' : 'probation-actions'}>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/probation/candidates/${candidate.id}/edit`)}><PencilLine />Sửa</Button>
          <Button size="sm" disabled={busy} onClick={() => executeAction(candidate, 'GENERATE_DOCUMENT')}><FileText />Sinh HĐ</Button>
        </div>
      );
    }
    if (candidate.status === 'CONTRACT_CREATED') {
      return <Button size="sm" disabled={busy} onClick={() => executeAction(candidate, 'START_PROBATION')}><Play />Bắt đầu</Button>;
    }
    if (candidate.status === 'IN_PROBATION') {
      return (
        <div className={compact ? 'probation-actions probation-actions--compact' : 'probation-actions'}>
          <Button size="sm" disabled={busy} onClick={() => executeAction(candidate, 'MARK_PASSED')}><Check />Đạt</Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              const reason = globalThis.prompt('Nhập lý do không đạt thử việc:');
              if (reason?.trim()) executeAction(candidate, 'MARK_FAILED', { reason: reason.trim() });
            }}
          ><X />Không đạt</Button>
        </div>
      );
    }
    if (candidate.status === 'PASSED') {
      return <Button size="sm" disabled={busy} onClick={() => executeAction(candidate, 'CONVERT')}><UserPlus />Chuyển nhân sự</Button>;
    }
    return <span className="readonly-label">Chỉ xem</span>;
  };

  const departments = useMemo(
    () => [...new Set(jobTemplates.map((template) => template.department).filter(Boolean))],
    [jobTemplates]
  );

  const visibleCandidates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('vi');
    return candidates.filter((candidate) => {
      const searchable = `${candidate.candidateCode || ''} ${candidate.fullName || ''}`
        .toLocaleLowerCase('vi');
      return (!normalized || searchable.includes(normalized))
        && (!status || candidate.status === status)
        && (!department || candidate.department === department);
    });
  }, [candidates, keyword, status, department]);

  const tabs = (
    <nav className="section-tabs" aria-label="Khu vực thử việc">
      <button
        type="button"
        className={activeTab === 'candidates' ? 'section-tabs__item section-tabs__item--active' : 'section-tabs__item'}
        onClick={() => navigate('/probation')}
      >
        Ứng viên <span>{candidates.length}</span>
      </button>
      <button
        type="button"
        className={activeTab === 'templates' ? 'section-tabs__item section-tabs__item--active' : 'section-tabs__item'}
        onClick={() => navigate('/probation/templates')}
      >
        Mẫu công việc thử việc <span>{jobTemplates.length}</span>
      </button>
    </nav>
  );

  return (
    <section className="probation-page">
      <PageHeader
        title="Ứng viên thử việc"
        description="Tạo hồ sơ ứng viên, xuất hợp đồng thử việc, theo dõi kết quả và chuyển ứng viên đạt sang hồ sơ nhân sự."
        actions={(
          <>
            <Button variant="secondary" onClick={() => navigate('/probation/templates')}>
              <FileText aria-hidden="true" />Mẫu công việc
            </Button>
            <Button onClick={() => navigate('/probation/candidates/new')}>
              <UserPlus aria-hidden="true" />Thêm ứng viên
            </Button>
          </>
        )}
      />

      {tabs}

      {actionError ? <p className="form-submit-error" role="alert">{actionError}</p> : null}

      {activeTab === 'candidates' ? (
        <>
          <div className="probation-filter surface">
            <label className="search-control">
              <Search aria-hidden="true" />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã hoặc tên ứng viên" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="CONTRACT_CREATED">Đã tạo HĐ</option>
              <option value="IN_PROBATION">Đang thử việc</option>
              <option value="PASSED">Đạt thử việc</option>
              <option value="FAILED">Không đạt</option>
            </select>
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">Tất cả phòng ban</option>
              {departments.map((item) => <option key={item}>{item}</option>)}
            </select>
            <Button variant="ghost" onClick={() => { setKeyword(''); setStatus(''); setDepartment(''); }}>Xóa lọc</Button>
          </div>

          {error ? <div className="surface"><ErrorState message={error} onRetry={reload} /></div> : (
            <div className="probation-ledger surface">
              <div className="probation-table-wrap">
                <table className="data-table probation-table">
                  <thead>
                    <tr><th>Ứng viên</th><th>Phòng ban / Chức vụ</th><th>Thử việc</th><th>Trạng thái</th><th>Hợp đồng</th><th>Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan="6"><LoadingState label="Đang tải ứng viên thử việc..." /></td></tr> : visibleCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td><div className="employee-identity"><span className="avatar">{initialsOf(candidate.fullName)}</span><span><strong>{candidate.fullName}</strong><small>{candidate.candidateCode}</small></span></div></td>
                        <td><strong>{candidate.department || '—'}</strong><small>{candidate.position || '—'}</small></td>
                        <td><strong>{formatDateDisplay(candidate.probationStartDate)}</strong><small>đến {formatDateDisplay(candidate.probationEndDate)}</small></td>
                        <td><StatusBadge status={candidate.status} /></td>
                        <td>{candidate.latestContract?.contractNo || 'Chưa tạo'}</td>
                        <td>{candidateActions(candidate)}</td>
                      </tr>
                    ))}
                    {!loading && !visibleCandidates.length ? (
                      <tr><td colSpan="6"><EmptyState title="Chưa có ứng viên thử việc" description="Nhấn “+ Thêm ứng viên” để tạo hồ sơ ứng viên thử việc mới." action={<Button onClick={() => navigate('/probation/candidates/new')}><Plus />Thêm ứng viên</Button>} /></td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="probation-mobile-list">
                {visibleCandidates.map((candidate) => (
                  <article key={candidate.id} className="probation-mobile-row probation-mobile-card">
                    <button type="button" className="probation-mobile-card__summary" onClick={() => candidate.status === 'DRAFT' && navigate(`/probation/candidates/${candidate.id}/edit`)}>
                      <span className="avatar">{initialsOf(candidate.fullName)}</span>
                      <span><strong>{candidate.fullName}</strong><small>{candidate.candidateCode}</small><span>{candidate.department}</span></span>
                      <StatusBadge status={candidate.status} />
                      {candidate.status === 'DRAFT' ? <ChevronRight /> : null}
                    </button>
                    {candidateActions(candidate, true)}
                  </article>
                ))}
                {!loading && !visibleCandidates.length ? <EmptyState title="Chưa có ứng viên thử việc" description="Nhấn “Thêm ứng viên” để bắt đầu." action={<Button onClick={() => navigate('/probation/candidates/new')}><Plus />Thêm ứng viên</Button>} /> : null}
              </div>
            </div>
          )}
        </>
      ) : (
        <section className="template-list">
          <div className="template-list__actions">
            <Button onClick={() => navigate('/probation/templates/new')}><Plus />Thêm mẫu công việc</Button>
          </div>
          <div className="surface template-ledger">
            <table className="data-table">
              <thead><tr><th>Mẫu công việc</th><th>Phòng ban / Chức vụ</th><th>Lương</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {jobTemplates.map((template) => (
                  <tr key={template.id}>
                    <td><strong>{template.name}</strong><small>{template.code}</small></td>
                    <td><strong>{template.department}</strong><small>{template.position}</small></td>
                    <td>{formatCurrency(template.baseSalary)}</td>
                    <td><StatusBadge status={template.status} /></td>
                    <td>
                      {template.status === 'DRAFT' ? (
                        <div className="probation-actions">
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/probation/templates/${template.id}/edit`)}><PencilLine />Sửa</Button>
                          <Button size="sm" disabled={actingId.startsWith(`${template.id}:`)} onClick={() => executeAction(template, 'ACTIVATE_TEMPLATE')}><Check />Kích hoạt</Button>
                        </div>
                      ) : <span className="readonly-label">Chỉ xem</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="template-card-list">
              {jobTemplates.map((template) => (
                <article key={template.id} className="template-card">
                  <div><span className="template-card__icon"><BriefcaseBusiness /></span><StatusBadge status={template.status} /></div>
                  <h2>{template.name}</h2>
                  <p>{template.code}</p>
                  <dl><div><dt>Phòng ban</dt><dd>{template.department}</dd></div><div><dt>Chức vụ</dt><dd>{template.position}</dd></div><div><dt>Lương</dt><dd>{formatCurrency(template.baseSalary)}</dd></div></dl>
                  {template.status === 'DRAFT' ? (
                    <div className="probation-actions probation-actions--compact">
                      <Button variant="secondary" onClick={() => navigate(`/probation/templates/${template.id}/edit`)}><PencilLine />Sửa mẫu</Button>
                      <Button disabled={actingId.startsWith(`${template.id}:`)} onClick={() => executeAction(template, 'ACTIVATE_TEMPLATE')}><Check />Kích hoạt</Button>
                    </div>
                  ) : <span className="readonly-label">Mẫu đang sử dụng · Chỉ xem</span>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
