import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { hrWordEditorApi } from '../../api/hrWordEditorApi';
import { apiErrorMessage } from '../../utils/hr';

export function HrWordEditButton({ type, kind, sourceId, disabled = false, label = 'Sửa trực tiếp trên web', variant = 'primary' }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const open = async () => {
    setBusy(true);
    try {
      const session = await hrWordEditorApi.open({ type, kind, sourceId });
      navigate(`/manager/hr/word-editor/${session.id}`);
    } catch (e) { toast.error(apiErrorMessage(e, 'Không mở được trình sửa Word.')); }
    finally { setBusy(false); }
  };
  return <Button type="button" variant={variant} disabled={busy || disabled} onClick={open}>{busy ? 'Đang mở...' : label}</Button>;
}
