import Cookies from 'js-cookie';

export const SESSION_DAYS = 90;
export const ACCESS_TOKEN_DAYS = 1 / 3;

const baseCookieOptions = {
  sameSite: 'Strict',
  secure: window.location.protocol === 'https:',
};

// Cookie chỉ giữ snapshot nhỏ phục vụ khôi phục UI. Avatar base64 có thể dài
// hàng chục KB và làm trình duyệt từ chối toàn bộ cookie `user`.
const USER_COOKIE_FIELDS = [
  'id',
  'email',
  'fullName',
  'role',
  'departmentId',
  'departmentName',
  'position',
  'jobPosition',
  'hasPassword',
];

export function createUserCookieSnapshot(user) {
  if (!user || typeof user !== 'object') return null;

  return USER_COOKIE_FIELDS.reduce((snapshot, field) => {
    if (user[field] !== undefined && user[field] !== null) {
      snapshot[field] = user[field];
    }
    return snapshot;
  }, {});
}

export function getStoredUser() {
  const value = Cookies.get('user');
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      Cookies.remove('user', baseCookieOptions);
      return null;
    }
    return parsed;
  } catch {
    // Cookie cũ/hỏng không được phép làm crash toàn bộ route tree.
    Cookies.remove('user', baseCookieOptions);
    return null;
  }
}

export function setAuthCookies({ accessToken, refreshToken, user }) {
  if (accessToken) {
    Cookies.set('accessToken', accessToken, { ...baseCookieOptions, expires: ACCESS_TOKEN_DAYS });
  }
  if (refreshToken) {
    Cookies.set('refreshToken', refreshToken, { ...baseCookieOptions, expires: SESSION_DAYS });
  }
  if (user) {
    const snapshot = createUserCookieSnapshot(user);
    Cookies.set('user', JSON.stringify(snapshot), { ...baseCookieOptions, expires: SESSION_DAYS });
  }
}

export function clearAuthCookies() {
  Cookies.remove('accessToken', baseCookieOptions);
  Cookies.remove('refreshToken', baseCookieOptions);
  Cookies.remove('user', baseCookieOptions);
}

export function isInvalidRefreshError(error) {
  const httpStatus = error.response?.status;
  const apiStatus = error.response?.data?.status;
  return error.code === 'NO_REFRESH_TOKEN' || httpStatus === 401 || apiStatus === 401;
}
