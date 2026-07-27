import React from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale/vi';

const CustomDateHeader = ({ date }) => {
  const isToday = new Date().toDateString() === date.toDateString();
  return (
    <div className={`flex h-full min-h-14 flex-col items-center justify-center px-2 py-2 ${isToday ? 'bg-emerald-50/70' : ''}`}>
      <span className={`text-xs font-bold capitalize ${isToday ? 'text-[var(--cfc-emerald-dark)]' : 'text-[var(--cfc-ink)]'}`}>
        {format(date, 'EEEE', { locale: vi })}
      </span>
      <span className="mt-0.5 text-xs font-medium text-[var(--cfc-muted)]">
        {format(date, 'dd/MM')}
      </span>
    </div>
  );
};

export default CustomDateHeader;
