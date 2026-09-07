import { baseApi } from './baseApi';
import { unwrapApiData } from './hrApiUtils';

export async function getEmployeeProfilePage(employeeId, section, page, signal) {
  return unwrapApiData(await baseApi.get(`/hr/employees/${employeeId}/${section}`, {
    params: { page, size: 20 }, signal,
  }));
}
