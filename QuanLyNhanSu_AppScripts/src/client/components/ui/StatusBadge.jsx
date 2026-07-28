import { CircleCheck, CircleDot } from 'lucide-react';
import { statusLabel } from '../../lib/format.js';

const toneForStatus = (status) => ({
  ACTIVE: 'success',
  CONFIRMED: 'success',
  LIVE: 'success',
  DRAFT: 'info',
  CONTRACT_CREATED: 'info',
  CONVERTED: 'info',
  IN_PROBATION: 'warning',
  PASSED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  INACTIVE: 'danger',
  BASELINE: 'violet'
}[status] || 'neutral');

export function StatusBadge({ status, label }) {
  const tone = toneForStatus(status);
  const Icon = status === 'CONFIRMED' ? CircleCheck : CircleDot;
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <Icon aria-hidden="true" />
      {label || statusLabel(status)}
    </span>
  );
}
