import { CircleCheck, Import, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/StatePanel.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { useAppData } from '../context/AppDataContext.jsx';

export function SupportPage({ type }) {
  const { auditEvents, notify } = useAppData();

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
          description="Kiểm tra dữ liệu trước khi xác nhận, không ghi trực tiếp khi vừa tải tệp."
          actions={<Button variant="secondary" onClick={() => notify('Chưa chọn tệp để kiểm tra.', 'info')}><Import />Chọn tệp</Button>}
        />
        <div className="surface">
          <EmptyState
            title="Chưa có phiên nhập dữ liệu"
            description="Tệp được chọn sẽ đi qua bước xem trước, kiểm tra và xác nhận."
            action={<Button onClick={() => notify('Chức năng chọn tệp sẽ gọi RPC import của server.', 'info')}><Import />Chọn tệp dữ liệu</Button>}
          />
        </div>
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
