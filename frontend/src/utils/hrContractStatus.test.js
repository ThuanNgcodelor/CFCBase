import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractTermLabel } from './hrContractStatus.js';

test('term reminders preserve lifecycle and handle expiry boundaries', () => {
  const contract = { status: 'EFFECTIVE', effectiveFrom: '2026-01-01', effectiveUntil: '2026-10-07' };
  assert.equal(contractTermLabel(contract, '2026-09-07'), 'Còn 30 ngày đến hạn');
  assert.equal(contractTermLabel(contract, '2026-09-06'), 'Trong thời hạn');
  assert.equal(contractTermLabel(contract, '2026-10-07'), 'Còn 0 ngày đến hạn');
  assert.equal(contractTermLabel(contract, '2026-10-08'), 'Đã qua ngày kết thúc');
  assert.equal(contract.status, 'EFFECTIVE');
  assert.equal(contractTermLabel({ ...contract, status: 'VOIDED' }, '2026-09-07'), 'Đã hủy');
  assert.equal(contractTermLabel({ ...contract, effectiveUntil: null }, '2026-09-07'), 'Không xác định thời hạn');
  assert.equal(contractTermLabel(contract, '2025-12-31'), 'Chưa tới ngày bắt đầu');
});
