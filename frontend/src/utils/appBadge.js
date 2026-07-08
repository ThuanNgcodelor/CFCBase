export async function syncAppBadge(count) {
  if (typeof navigator === 'undefined') {
    return;
  }

  try {
    if (typeof navigator.setAppBadge !== 'function') {
      return;
    }

    const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    if (safeCount > 0) {
      await navigator.setAppBadge(safeCount);
      return;
    }

    if (typeof navigator.clearAppBadge === 'function') {
      await navigator.clearAppBadge();
      return;
    }

    await navigator.setAppBadge(0);
  } catch {
    // Badge API is best-effort and varies by browser/platform.
  }
}

export async function clearAppBadge() {
  await syncAppBadge(0);
}
