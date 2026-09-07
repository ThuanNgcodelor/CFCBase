// Compare date-only values in the company's timezone, independent of the browser timezone.
export function contractTermLabel(contract, today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())) {
  if (contract.status === 'VOIDED') return 'Đã hủy';
  if (contract.effectiveUntil && contract.effectiveUntil < today) return 'Đã qua ngày kết thúc';
  if (contract.effectiveFrom > today) return 'Chưa tới ngày bắt đầu';
  if (!contract.effectiveUntil) return 'Không xác định thời hạn';
  const remaining = (Date.parse(`${contract.effectiveUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return remaining <= 30 ? `Còn ${remaining} ngày đến hạn` : 'Trong thời hạn';
}
