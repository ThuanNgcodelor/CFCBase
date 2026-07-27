import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';

const STATUS_META = {
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  PENDING: { label: 'Chờ duyệt', tone: 'warning' },
  REJECTED: { label: 'Đã từ chối', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

export function BookingStatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] || { label: status || 'Chưa xác định', tone: 'neutral' };
  return (
    <StatusBadge tone={meta.tone} dot className={className}>
      {meta.label}
    </StatusBadge>
  );
}
