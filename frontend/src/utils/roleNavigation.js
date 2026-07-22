export const MANAGER_HR_HOME = '/manager/hr';

export function getRoleLandingPath(role) {
  return role === 'MANAGER' ? MANAGER_HR_HOME : '/';
}
