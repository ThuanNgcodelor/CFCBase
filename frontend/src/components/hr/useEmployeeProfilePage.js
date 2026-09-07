import { useEffect, useState } from 'react';
import { getEmployeeProfilePage } from '../../api/hrEmployeeProfileApi';
import { normalizePage } from '../../api/hrApiUtils';
import { apiErrorMessage } from '../../utils/hr';

export function useEmployeeProfilePage(employeeId, section) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(normalizePage(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getEmployeeProfilePage(employeeId, section, page, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setData(normalizePage(value)); })
      .catch((err) => { if (!controller.signal.aborted) setError(apiErrorMessage(err, 'Không thể tải dữ liệu hồ sơ.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [employeeId, section, page, revision]);
  return { data, loading, error, setPage, reload: () => setRevision((value) => value + 1) };
}
