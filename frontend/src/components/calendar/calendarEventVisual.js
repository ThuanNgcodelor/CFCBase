export function getCalendarEventVisual(event, now = new Date()) {
  const start = event?.start instanceof Date ? event.start : new Date(event?.start);
  const end = event?.end instanceof Date ? event.end : new Date(event?.end);
  const status = event?.status;
  const isPast = end < now;
  const isInProgress = start <= now && end >= now;
  const isOverduePending = status === 'PENDING' && isPast;
  const isCar = event?.resourceType === 'car';

  if (isOverduePending) {
    return {
      state: 'overdue',
      label: 'Quá hạn',
      containerClass: 'border-orange-300 bg-orange-50 text-orange-900 ring-1 ring-orange-200',
      avatarClass: 'bg-orange-100 text-orange-700 border-orange-200',
      dotClass: 'bg-orange-500',
      monthClass: 'border border-orange-300 bg-orange-50 text-orange-900',
      badgeClass: 'bg-orange-100 text-orange-700',
    };
  }

  if (isInProgress) {
    return {
      state: 'active',
      label: 'Đang diễn ra',
      containerClass: isCar
        ? 'border-teal-300 bg-teal-50 text-teal-950 ring-1 ring-teal-100'
        : 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-100',
      dotClass: isCar ? 'bg-teal-600' : 'bg-blue-600',
      monthClass: isCar
        ? 'border border-teal-300 bg-teal-50 text-teal-950'
        : 'border border-blue-300 bg-blue-50 text-blue-950',
      badgeClass: isCar ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800',
    };
  }

  if (isPast) {
    return {
      state: 'past',
      label: 'Đã qua',
      containerClass: 'border-gray-300 bg-gray-100 text-gray-600',
      avatarClass: 'bg-gray-200 text-gray-600 border-gray-300',
      dotClass: 'bg-gray-400',
      monthClass: 'border border-gray-300 bg-gray-100 text-gray-600',
      badgeClass: 'bg-gray-200 text-gray-600',
    };
  }

  if (status === 'PENDING') {
    return {
      state: 'pending',
      label: 'Chờ duyệt',
      containerClass: 'border-amber-300 bg-amber-50 text-amber-950',
      dotClass: 'bg-amber-500',
      monthClass: 'border border-amber-300 bg-amber-50 text-amber-950',
      badgeClass: 'bg-amber-100 text-amber-800',
    };
  }

  return {
    state: 'approved',
    label: '',
    containerClass: isCar
      ? 'border-teal-300 bg-teal-50 text-teal-950'
      : 'border-blue-300 bg-blue-50 text-blue-950',
    dotClass: isCar ? 'bg-teal-600' : 'bg-blue-600',
    monthClass: isCar
      ? 'border border-teal-300 bg-teal-50 text-teal-950'
      : 'border border-blue-300 bg-blue-50 text-blue-950',
    badgeClass: isCar ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800',
  };
}
