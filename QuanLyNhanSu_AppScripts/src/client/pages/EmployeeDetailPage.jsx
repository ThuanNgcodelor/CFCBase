import {
  ArrowLeft,
  CalendarDays,
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
  const displayValue = value === null || value === undefined || value === '' ? '—' : value;
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}

export function EmployeeDetailPage({ id, navigate }) {
  const currentYear = new Date().getFullYear();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [leaveYear, setLeaveYear] = useState(currentYear);
  const [leaveData, setLeaveData] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveEditing, setLeaveEditing] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ manualOverrideDays: '', note: '' });

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

  useEffect(() => {
    if (!employee?.id || !Number.isFinite(Number(leaveYear))) {
      setLeaveData(null);
      return undefined;
    }
    let active = true;
    setLeaveLoading(true);
    setLeaveError('');
    hrRpc.getLeaveEntitlement(employee.id, leaveYear)
      .then((result) => {
        if (!active) return;
        setLeaveData(result);
        setLeaveForm({
          manualOverrideDays: result.manualOverrideDays ?? '',
          note: result.note || ''
        });
      })
      .catch((requestError) => {
        if (active) {
          setLeaveError(requestError.message || 'Không thể tải ngày phép năm.');
          setLeaveData(null);
        }
      })
      .finally(() => {
        if (active) setLeaveLoading(false);
      });
    return () => { active = false; };
  }, [employee?.id, leaveYear]);

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

  const previewFinalDays = leaveForm.manualOverrideDays === ''
    ? leaveData?.calculatedDays
    : leaveForm.manualOverrideDays;

  const saveLeaveEntitlement = async () => {
    if (!employee?.id || !leaveData) return;
    setLeaveSaving(true);
    setLeaveError('');
    try {
      const updated = await hrRpc.updateLeaveEntitlement(employee.id, {
        leaveYear,
        rowVersion: leaveData.rowVersion,
        manualOverrideDays: leaveForm.manualOverrideDays === '' ? null : Number(leaveForm.manualOverrideDays),
        note: leaveForm.note
      });
      setLeaveData(updated);
      setLeaveForm({
        manualOverrideDays: updated.manualOverrideDays ?? '',
        note: updated.note || ''
      });
      setLeaveEditing(false);
    } catch (requestError) {
      setLeaveError(requestError.message || 'Không thể lưu ngày phép năm.');
    } finally {
      setLeaveSaving(false);
    }
  };

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
              <DataField label="Nơi sinh" value={employee.birthPlace} />
              <DataField label="Thường trú" value={employee.permanentAddress} />
              <DataField label="Chỗ ở hiện tại" value={employee.currentAddress} />
            </div>
          </section>

          <section className="detail-section">
            <h2>Công việc</h2>
            <div className="detail-grid detail-grid--three">
              <DataField label="Phòng ban" value={employee.department} />
              <DataField label="Chức vụ" value={employee.position} />
              <DataField label="Điều kiện lao động" value={employee.workingCondition} />
              <DataField label="Ngày vào làm" value={formatDateDisplay(employee.joinDate)} />
              <DataField label="Mốc tính phép" value={formatDateDisplay(employee.leaveAccrualStartDate)} />
              <DataField label="Loại hợp đồng" value={employee.contractType} />
            </div>
          </section>

          <section className="detail-section">
            <h2>Ngày phép năm</h2>
            <div className="detail-grid detail-grid--three">
              <div className="detail-field">
                <span>Năm áp dụng</span>
                <strong>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={leaveYear}
                    onChange={(event) => setLeaveYear(Number(event.target.value) || currentYear)}
                    className="detail-inline-input"
                  />
                </strong>
              </div>
              <DataField label="Điều kiện lao động" value={leaveLoading ? 'Đang tải...' : leaveData?.workingConditionName} />
              <DataField label="Mốc tính phép" value={leaveLoading ? 'Đang tải...' : formatDateDisplay(leaveData?.accrualStartDate)} />
              <DataField label="Ngày phép nền" value={leaveLoading ? 'Đang tải...' : leaveData?.baseDays} />
              <DataField label="Thâm niên cộng thêm" value={leaveLoading ? 'Đang tải...' : leaveData?.seniorityBonusDays} />
              <DataField label="Tự tính" value={leaveLoading ? 'Đang tải...' : leaveData?.calculatedDays} />
              <DataField label="Chỉnh tay" value={leaveLoading ? 'Đang tải...' : (leaveData?.manualOverrideDays ?? 'Không')} />
              <DataField label="Số cuối cùng" value={leaveLoading ? 'Đang tải...' : leaveData?.finalDays} />
              <DataField label="Ghi chú" value={leaveLoading ? 'Đang tải...' : leaveData?.note} />
            </div>
            {leaveError ? <p className="form-submit-error" role="alert">{leaveError}</p> : null}
            {leaveEditing ? (
              <div className="detail-inline-editor">
                <label>
                  <span>Chỉnh tay ngày phép <CalendarDays aria-hidden="true" /></span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={leaveForm.manualOverrideDays}
                    onChange={(event) => setLeaveForm((current) => ({ ...current, manualOverrideDays: event.target.value }))}
                    className="detail-inline-input"
                    placeholder="Để trống để dùng số tự tính"
                  />
                </label>
                <label>
                  <span>Ghi chú</span>
                  <textarea
                    value={leaveForm.note}
                    onChange={(event) => setLeaveForm((current) => ({ ...current, note: event.target.value }))}
                    className="detail-inline-textarea"
                    placeholder="Ví dụ: điều chỉnh theo quyết định nội bộ"
                  />
                </label>
                <p className="detail-inline-note">Số cuối cùng đang xem trước: <strong>{previewFinalDays === null || previewFinalDays === undefined || previewFinalDays === '' ? '—' : previewFinalDays}</strong></p>
                <div className="detail-inline-actions">
                  <Button variant="neutral" onClick={() => setLeaveForm({ manualOverrideDays: '', note: '' })} disabled={leaveSaving}>Trả về tự động</Button>
                  <div>
                    <Button variant="neutral" onClick={() => {
                      setLeaveEditing(false);
                      setLeaveForm({
                        manualOverrideDays: leaveData?.manualOverrideDays ?? '',
                        note: leaveData?.note || ''
                      });
                    }} disabled={leaveSaving}>Hủy</Button>
                    <Button onClick={saveLeaveEntitlement} disabled={leaveSaving}>{leaveSaving ? 'Đang lưu...' : 'Lưu ngày phép'}</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="detail-inline-actions">
                <p className="detail-inline-note">Hệ thống lấy ngày phép nền từ điều kiện lao động và cộng thêm 1 ngày cho mỗi đủ 5 năm thâm niên.</p>
                <Button onClick={() => setLeaveEditing(true)} disabled={leaveLoading || !leaveData}>Sửa ngày phép năm</Button>
              </div>
            )}
          </section>

          <section className="detail-section">
            <h2>Liên hệ & Khẩn cấp</h2>
            <div className="detail-grid detail-grid--two">
              <DataField label="Điện thoại" value={employee.phone} />
              <DataField label="Email" value={employee.email} />
              <DataField label="Liên hệ khẩn cấp" value={employee.emergencyContactName} />
              <DataField label="SĐT khẩn cấp" value={employee.emergencyContactPhone} />
              <DataField label="Quan hệ" value={employee.emergencyContactRelation} />
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
