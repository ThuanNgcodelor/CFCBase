import { useState } from 'react';
import { HrDrawer } from './HrUi';
import { Button } from '../ui/Button';
const display = (value) => ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác', UNKNOWN: 'Chưa xác định' }[value] || value || 'Chưa nhập');
export default function HrOcrReview({ candidates, onApply, onClose, busy }) {
  const [selected, setSelected] = useState(() => candidates.filter((r) => !r.conflict).map((r) => r.key));
  return <HrDrawer isOpen onClose={onClose} title="Kiểm tra thông tin OCR" description="Chỉ ô trống được chọn sẵn. Đánh dấu riêng nếu muốn thay nội dung đã nhập." size="wide">
    <div className="space-y-4 p-5">
      {!candidates.length && <p>Không có thông tin mới có thể điền. Hãy kiểm tra độ rõ của ảnh hoặc nhập thủ công.</p>}
      {candidates.map((row) => <label key={row.key} className={`flex gap-3 rounded-lg border p-3 ${row.conflict ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={selected.includes(row.key)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, row.key] : prev.filter((k) => k !== row.key))} />
        <span className="min-w-0 break-words text-sm"><strong>{row.label}</strong><span className="block text-slate-500">Đang có: {display(row.previous)}</span><span className="block">OCR: {display(row.value)}</span></span>
      </label>)}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-white py-3">
        <Button type="button" disabled={busy || !selected.length} onClick={() => onApply(selected)}>Áp dụng {selected.length} trường đã chọn</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Hủy áp dụng</Button>
      </div>
    </div>
  </HrDrawer>;
}
