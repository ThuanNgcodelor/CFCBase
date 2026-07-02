import React from 'react';
import { format } from 'date-fns';

const CustomDateHeader = ({ date, label }) => {
  const isToday = new Date().toDateString() === date.toDateString();
  return (
    <div className="flex flex-col items-center justify-center py-1.5 pb-2">
      <span className="text-[11px] font-semibold text-[#1e293b] mb-0.5">{format(date, 'EEE')}</span>
      <span className={`text-lg font-medium flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[#1a56d6] text-white' : 'text-[#334155]'}`}>
        {format(date, 'd')}
      </span>
    </div>
  );
};

export default CustomDateHeader;
