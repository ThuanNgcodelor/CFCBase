import {
  ArrowLeft,
  CircleUserRound,
  Info,
  LockKeyhole,
  PencilLine
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { hrRpc } from '../api/rpc.js';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatePanel.jsx';
import { formatDateDisplay, initialsOf, normalizeEmployee } from '../lib/format.js';

function DataField({ label, value }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

export function EmployeeDetailPage({ id, navigate }) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    hrRpc.getEmployee(id)
      .then((result) => {
        if (active) setEmployee(normalizeEmployee(result));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Không thể tải hồ sơ nhân sự.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, reloadKey]);

  if (loading) return <section className="surface"><LoadingState label="Đang tải hồ sơ nhân sự..." /></section>;

  if (error) {
    return (
      <section className="surface">
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      </section>
    );
  }

  if (!employee) {
    return (
      <section className="surface">
        <EmptyState
          title="Không tìm thấy hồ sơ"
          description="Hồ sơ có thể đã được lưu trữ hoặc đường dẫn không còn hợp lệ."
          action={<Button onClick={() => navigate('/employees')}>Về danh sách</Button>}
        />
      </section>
    );
  }

  return (
    <section className="employee-detail-page">
      <button className="back-link" type="button" onClick={() => navigate('/employees')}>
        <ArrowLeft aria-hidden="true" />Danh sách
      </button>

      <header className="employee-profile-header">
        <span className="employee-profile-header__avatar">
          {initialsOf(employee.fullName) || <CircleUserRound />}
        </span>
        <div>
          <h1>{employee.fullName}</h1>
          <p>Mã nhân sự: {employee.code}<span /><b>{employee.status === 'ACTIVE' ? 'Đang làm việc' : 'Bản nháp'}</b></p>
        </div>
        {employee.status === 'DRAFT' ? (
          <Button variant="secondary" onClick={() => navigate(`/employees/${employee.id}/edit`)}>
            <PencilLine aria-hidden="true" />Chỉnh sửa
          </Button>
        ) : null}
      </header>

      <div className="detail-info-banner">
        <Info aria-hidden="true" />
        <span>Đây là hồ sơ chính thức và chỉ có tính chất xem. Thay đổi trạng thái được thực hiện qua chức năng Tăng / Giảm.</span>
      </div>

      <div className="employee-detail-layout">
        <div className="employee-detail-main">
          <section className="detail-section">
            <h2>Thông tin chung</h2>
            <div className="detail-grid detail-grid--three">
              <DataField label="Họ và tên" value={employee.fullName} />
              <DataField label="Giới tính" value={employee.gender} />
              <DataField label="Ngày sinh" value={formatDateDisplay(employee.dob)} />
              <DataField label="Dân tộc" value={employee.ethnicity} />
              <DataField label="Tôn giáo" value={employee.religion} />
              <DataField label="Trình độ" value={employee.education} />
              <DataField label="Chuyên ngành" value={employee.major} />
            </div>
          </section>

          <section className="detail-section">
            <h2>Công việc</h2>
            <div className="detail-grid detail-grid--three">
              <DataField label="Phòng ban" value={employee.department} />
              <DataField label="Chức vụ" value={employee.position} />
              <DataField label="Điều kiện lao động" value={employee.workingCondition} />
              <DataField label="Ngày vào làm" value={formatDateDisplay(employee.joinDate)} />
              <DataField label="Loại hợp đồng" value={employee.contractType} />
            </div>
          </section>

          <section className="detail-section">
            <h2>Liên hệ</h2>
            <div className="detail-grid detail-grid--two">
              <DataField label="Điện thoại" value={employee.phone} />
              <DataField label="Email" value={employee.email} />
            </div>
          </section>
        </div>

        <aside className="employee-detail-side">
          <section className="secure-card secure-card--identity">
            <h2>Định danh <LockKeyhole aria-hidden="true" /></h2>
            <DataField label="Số CCCD" value={employee.cccd} />
            <DataField label="Ngày cấp" value={formatDateDisplay(employee.citizenIssuedDate)} />
            <DataField label="Nơi cấp" value={employee.citizenIssuedPlace} />
          </section>

          <section className="secure-card secure-card--insurance">
            <h2>Bảo hiểm <LockKeyhole aria-hidden="true" /></h2>
            <DataField label="Mã số BHXH" value={employee.bhxh} />
            <DataField label="Mã số BHYT" value={employee.bhyt} />
            <DataField label="Ngày tham gia BHXH" value={formatDateDisplay(employee.insuranceStartDate)} />
            <DataField label="Nơi đăng ký KCB ban đầu" value={employee.medicalPlace} />
          </section>

          <section className="activity-timeline">
            <h2>Theo dõi thay đổi</h2>
            {(employee.activities || []).map((activity, index) => (
              <div key={activity.id || `${activity.date}-${index}`} className="activity-timeline__item">
                <span className={activity.tone === 'success' ? 'activity-dot' : 'activity-dot activity-dot--blue'} />
                <time>{formatDateDisplay(activity.date)}<small>{activity.time || ''}</small></time>
                <p><strong>{activity.title || 'Thay đổi hồ sơ'}</strong><span>{activity.description || '—'}</span></p>
                <small>{activity.actor || '—'}</small>
              </div>
            ))}
            {!employee.activities?.length ? (
              <p className="activity-timeline__empty">Chưa có lịch sử thay đổi được trả về từ hệ thống.</p>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
