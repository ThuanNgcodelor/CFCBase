import {
  AlertTriangle,
  CircleCheck,
  Database,
  Eye,
  FileSpreadsheet,
  Import,
  RefreshCw,
  Rows3,
  ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, LoadingState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { useAppData } from '../context/AppDataContext.jsx';

const previewCounts = [
  { key: 'totalRows', label: 'Tổng dòng dữ liệu', tone: 'neutral' },
  { key: 'importableRows', label: 'Có thể nhập', tone: 'success' },
  { key: 'duplicateRows', label: 'Trùng, sẽ bỏ qua', tone: 'warning' },
  { key: 'errorRows', label: 'Cần kiểm tra', tone: 'danger' }
];

const sampleValue = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }
  return '—';
};

const warningText = (warning) => {
  if (typeof warning === 'string') return warning;
  return warning?.message || warning?.description || JSON.stringify(warning);
};

function ImportPreview({
  preview,
  confirmed,
  acknowledged,
  onAcknowledge,
  onConfirm,
  confirming
}) {
  const sample = Array.isArray(preview?.sample) ? preview.sample : [];
  const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
  const importableRows = Number(preview?.importableRows || 0);

  return (
    <div className="import-preview">
      <section className="import-source surface">
        <div className="import-source__icon"><FileSpreadsheet aria-hidden="true" /></div>
        <div>
          <span className="import-source__eyebrow">Nguồn dữ liệu đã cấu hình</span>
          <h2>Tab {preview?.sourceSheet || 'không xác định'}</h2>
          <p>Hàng tiêu đề được nhận diện tại dòng {preview?.headerRow || '—'} trong Google Sheet chính.</p>
        </div>
        <span className="import-source__safe"><ShieldCheck />Chỉ đọc khi xem trước</span>
      </section>

      <div className="import-stats">
        {previewCounts.map((item) => (
          <article key={item.key} className={`surface import-stat import-stat--${item.tone}`}>
            <small>{item.label}</small>
            <strong>{Number(preview?.[item.key] || 0).toLocaleString('vi-VN')}</strong>
          </article>
        ))}
      </div>

      {warnings.length ? (
        <section className="import-warnings" aria-labelledby="import-warnings-title">
          <div>
            <AlertTriangle aria-hidden="true" />
            <h2 id="import-warnings-title">Nội dung cần lưu ý trước khi nhập</h2>
          </div>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warningText(warning)}-${index}`}>{warningText(warning)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="surface import-sample">
        <div className="import-section-heading">
          <div><Rows3 aria-hidden="true" /></div>
          <span>
            <h2>Mẫu dữ liệu sẽ được nhập</h2>
            <p>Kiểm tra nhanh mã nhân sự, họ tên, phòng ban và chức vụ đã được ánh xạ.</p>
          </span>
        </div>
        {sample.length ? (
          <div className="import-sample__scroll">
            <table>
              <thead>
                <tr>
                  <th>Dòng nguồn</th>
                  <th>Mã nhân sự</th>
                  <th>Họ và tên</th>
                  <th>Đơn vị / Phòng ban</th>
                  <th>Chức vụ</th>
                </tr>
              </thead>
              <tbody>
                {sample.map((row, index) => (
                  <tr key={`${sampleValue(row, ['employeeCode', 'employee_code', 'code'])}-${index}`}>
                    <td>{sampleValue(row, ['sourceRow', 'source_row', 'rowNumber', 'row_number'])}</td>
                    <td><strong>{sampleValue(row, ['employeeCode', 'employee_code', 'code'])}</strong></td>
                    <td>{sampleValue(row, ['fullName', 'full_name', 'name'])}</td>
                    <td>{sampleValue(row, ['department', 'departmentName', 'department_name'])}</td>
                    <td>{sampleValue(row, ['position', 'positionName', 'position_name'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : importableRows ? (
          <p className="import-sample__empty">
            Đã nhận diện {importableRows.toLocaleString('vi-VN')} dòng hợp lệ.
            Chi tiết hồ sơ không được gửi ra màn hình xem trước để hạn chế lộ dữ liệu nhân sự.
          </p>
        ) : (
          <p className="import-sample__empty">Không có dòng hợp lệ để nhập.</p>
        )}
      </section>

      {confirmed ? (
        <section className="import-complete surface" role="status">
          <CircleCheck aria-hidden="true" />
          <div>
            <h2>Đã hoàn tất nhập dữ liệu</h2>
            <p>
              Đã thêm {Number(confirmed.insertedEmployees || 0).toLocaleString('vi-VN')} hồ sơ,
              bỏ qua {Number(confirmed.skippedEmployees || 0).toLocaleString('vi-VN')} dòng trùng hoặc chưa hợp lệ.
            </p>
            <small>
              Danh mục mới: {Number(confirmed.createdDepartments || 0)} phòng ban ·{' '}
              {Number(confirmed.createdPositions || 0)} chức vụ ·{' '}
              {Number(confirmed.createdWorkingConditions || 0)} điều kiện làm việc.
            </small>
          </div>
        </section>
      ) : (
        <section className="import-confirm surface">
          <div className="import-confirm__copy">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>Xác nhận mới bắt đầu ghi dữ liệu</h2>
              <p>
                Hệ thống thêm dữ liệu vào các bảng chuẩn và bỏ qua hồ sơ trùng.
                Tab nguồn <strong>{preview?.sourceSheet || 'hiện tại'}</strong> không bị xóa, đổi tên hoặc ghi đè.
              </p>
            </div>
          </div>
          <label className="import-confirm__check">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={!preview?.previewToken || !importableRows || confirming}
              onChange={(event) => onAcknowledge(event.target.checked)}
            />
            <span>Tôi đã kiểm tra số liệu xem trước và đồng ý nhập {importableRows.toLocaleString('vi-VN')} hồ sơ hợp lệ.</span>
          </label>
          <Button
            size="lg"
            disabled={!preview?.previewToken || !acknowledged || !importableRows || confirming}
            onClick={onConfirm}
          >
            <Import aria-hidden="true" />
            {confirming ? 'Đang nhập dữ liệu...' : `Xác nhận nhập ${importableRows.toLocaleString('vi-VN')} hồ sơ`}
          </Button>
        </section>
      )}
    </div>
  );
}

export function SupportPage({ type }) {
  const {
    auditEvents,
    previewLegacyImport,
    confirmLegacyImport
  } = useAppData();
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [importStatus, setImportStatus] = useState('idle');
  const [importError, setImportError] = useState('');

  const loadImportPreview = async () => {
    setImportStatus('previewing');
    setImportError('');
    setConfirmed(null);
    setAcknowledged(false);
    try {
      const result = await previewLegacyImport();
      if (!result || typeof result !== 'object') {
        throw new Error('Server không trả về kết quả xem trước hợp lệ.');
      }
      setPreview(result);
    } catch (requestError) {
      setPreview(null);
      setImportError(requestError.message || 'Không thể kiểm tra dữ liệu trong Google Sheet đã cấu hình.');
    } finally {
      setImportStatus('idle');
    }
  };

  const confirmImport = async () => {
    if (!preview?.previewToken || !acknowledged) return;
    setImportStatus('confirming');
    setImportError('');
    try {
      setConfirmed(await confirmLegacyImport(preview.previewToken));
      setAcknowledged(false);
    } catch (requestError) {
      setImportError(requestError.message || 'Không thể xác nhận nhập dữ liệu.');
    } finally {
      setImportStatus('idle');
    }
  };

  if (type === 'notifications') {
    return (
      <section>
        <PageHeader title="Thông báo" description="Các cập nhật mới trong phân hệ nhân sự." />
        <div className="support-ledger surface">
          <EmptyState
            title="Chưa có thông báo"
            description="Các thông báo mới trong phân hệ nhân sự sẽ xuất hiện tại đây."
          />
        </div>
      </section>
    );
  }

  if (type === 'imports') {
    return (
      <section>
        <PageHeader
          title="Nhập dữ liệu"
          description="Đọc trực tiếp tab nhân sự cũ trong Google Sheet đã cấu hình và chuyển sang các bảng chuẩn."
          actions={(
            <Button
              variant={preview ? 'secondary' : 'primary'}
              disabled={importStatus !== 'idle'}
              onClick={loadImportPreview}
            >
              <Eye />
              {importStatus === 'previewing' ? 'Đang kiểm tra...' : preview ? 'Kiểm tra lại' : 'Xem trước dữ liệu'}
            </Button>
          )}
        />
        <section className="import-safety surface">
          <div className="import-safety__icon"><Database aria-hidden="true" /></div>
          <div>
            <strong>Không cần tải lại tệp Excel từ máy</strong>
            <p>
              Dữ liệu được đọc từ Google Sheet đặt trong <code>PRIMARY_SPREADSHEET_ID</code>.
              Bước xem trước hoàn toàn không ghi dữ liệu và không thay đổi tab nguồn.
            </p>
          </div>
        </section>

        {importError ? (
          <section className="import-error surface" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div><strong>Không thể tiếp tục</strong><p>{importError}</p></div>
            <Button variant="secondary" size="sm" onClick={loadImportPreview}><RefreshCw />Thử lại</Button>
          </section>
        ) : null}

        {importStatus === 'previewing' ? (
          <div className="surface"><LoadingState label="Đang đọc và kiểm tra tab dữ liệu cũ..." /></div>
        ) : preview ? (
          <ImportPreview
            preview={preview}
            confirmed={confirmed}
            acknowledged={acknowledged}
            onAcknowledge={setAcknowledged}
            onConfirm={confirmImport}
            confirming={importStatus === 'confirming'}
          />
        ) : (
          <div className="surface">
            <EmptyState
              title="Sẵn sàng kiểm tra dữ liệu nguồn"
              description="Bấm “Xem trước dữ liệu” để nhận diện tab, đối chiếu số dòng hợp lệ, trùng và lỗi trước khi quyết định nhập."
              action={<Button onClick={loadImportPreview}><Eye />Xem trước dữ liệu</Button>}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Nhật ký thay đổi"
        description="Theo dõi các thao tác quan trọng đã được ghi nhận."
        actions={<Button variant="neutral"><RefreshCw />Làm mới</Button>}
      />
      <div className="support-ledger surface">
        <div className="support-ledger__heading">
          <span>Thời gian</span><span>Người thao tác</span><span>Hành động</span><span>Đối tượng</span>
        </div>
        {auditEvents.map((event) => (
          <article key={event.id} className="support-ledger__row support-ledger__row--audit">
            <span className="support-ledger__icon"><ShieldCheck aria-hidden="true" /></span>
            <time>{event.time}</time>
            <strong>{event.actor}</strong>
            <p>{event.action}</p>
            <span>{event.target}</span>
            <CircleCheck className="support-ledger__verified" aria-label="Đã ghi nhận" />
          </article>
        ))}
        {!auditEvents.length ? <EmptyState title="Chưa có nhật ký" description="Các thao tác quan trọng sẽ xuất hiện tại đây." /> : null}
      </div>
    </section>
  );
}
