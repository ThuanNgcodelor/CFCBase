import { useCallback, useEffect, useState } from 'react';

const normalizePath = (value) => {
  const withoutHash = String(value || '').replace(/^#/, '');
  if (!withoutHash || withoutHash === '/') return '/overview';
  return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`;
};

export const navigate = (path, { replace = false } = {}) => {
  const nextHash = `#${normalizePath(path)}`;
  if (replace) {
    globalThis.history.replaceState(null, '', nextHash);
    globalThis.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  globalThis.location.hash = nextHash;
};

export function useHashRoute() {
  const [path, setPath] = useState(() => normalizePath(globalThis.location.hash));

  useEffect(() => {
    if (!globalThis.location.hash) navigate('/overview', { replace: true });
    const handleHashChange = () => setPath(normalizePath(globalThis.location.hash));
    globalThis.addEventListener('hashchange', handleHashChange);
    return () => globalThis.removeEventListener('hashchange', handleHashChange);
  }, []);

  const go = useCallback((nextPath, options) => navigate(nextPath, options), []);
  return { path, navigate: go };
}

export const matchRoute = (path, pattern) => {
  const pathParts = normalizePath(path).split('/').filter(Boolean);
  const patternParts = normalizePath(pattern).split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathParts[index]);
    } else if (patternPart !== pathParts[index]) {
      return null;
    }
  }
  return params;
};
