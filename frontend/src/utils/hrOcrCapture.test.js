import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOcrSelection, capturePhonePath, isCaptureId, ocrCandidates, ocrLoginPath, ocrLoginTarget } from './hrOcrCapture.js';

const id = 'bf6d6e57-870a-452f-9caa-1d503dab00da';
test('phone QR login returns to only a validated general-labor capture route', () => {
  assert.equal(ocrLoginTarget(ocrLoginPath(capturePhonePath(id)).split('?')[1]), capturePhonePath(id));
  for (const target of ['https://evil.test', '//evil.test', '/manager/hr/employees/new', capturePhonePath('../x'), `${capturePhonePath(id)}?token=x`]) {
    assert.equal(ocrLoginTarget(`ocrReturn=${encodeURIComponent(target)}`), null);
  }
  assert.equal(ocrLoginPath('/manager/hr'), '/login');
  assert.equal(isCaptureId(id), true);
  assert.equal(isCaptureId('null'), false);
});
test('only empty fields are preselected; unknown OCR never erases existing gender', () => {
  const employee = { personal: { fullName: 'Nhập tay', gender: 'MALE', dateOfBirth: '' }, identity: { citizenIdentityNumber: '' } };
  const rows = ocrCandidates(employee, { fullName: 'OCR', gender: 'UNKNOWN', dateOfBirth: '1990-01-01', citizenIdentityNumber: '001234567890' });
  assert.equal(rows.find((r) => r.field === 'fullName').conflict, true);
  assert.equal(rows.some((r) => r.field === 'gender'), false);
  const selected = rows.filter((r) => !r.conflict).map((r) => r.key);
  const next = applyOcrSelection(employee, rows, selected);
  assert.equal(next.personal.fullName, 'Nhập tay');
  assert.equal(next.personal.gender, 'MALE');
  assert.equal(next.personal.dateOfBirth, '1990-01-01');
  assert.equal(next.identity.citizenIdentityNumber, '001234567890');
  assert.equal(employee.identity.citizenIdentityNumber, '');
});
test('explicit conflict selection changes only that field and never employment/code', () => {
  const employee = { personal: { fullName: 'A', employeeCode: 'C123' }, employment: { departmentId: 'd1' } };
  const rows = ocrCandidates(employee, { fullName: 'B', employeeCode: 'WRONG', departmentId: 'd2' });
  const next = applyOcrSelection(employee, rows, rows.map((r) => r.key));
  assert.equal(next.personal.fullName, 'B');
  assert.equal(next.personal.employeeCode, 'C123');
  assert.equal(next.employment.departmentId, 'd1');
});
test('review does not clobber a later manual edit or reapply a result', () => {
  const rows = ocrCandidates({ personal: { fullName: '' } }, { fullName: 'OCR' });
  const newer = { personal: { fullName: 'Mới nhập' } };
  assert.equal(applyOcrSelection(newer, rows, ['personal.fullName']).personal.fullName, 'Mới nhập');
  const applied = applyOcrSelection({ personal: { fullName: '' } }, rows, ['personal.fullName']);
  assert.deepEqual(applyOcrSelection(applied, rows, ['personal.fullName']), applied);
});
test('invalid dates, empty output and unsupported gender cannot be applied', () => {
  assert.deepEqual(ocrCandidates({}, { dateOfBirth: '2026-02-30', issuedDate: 'abc', gender: 'banana', fullName: '  ' }), []);
  assert.equal(ocrCandidates({ personal: { gender: 'UNKNOWN' } }, { gender: 'FEMALE' })[0].conflict, false);
});
