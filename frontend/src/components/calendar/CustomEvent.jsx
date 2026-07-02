import React from 'react';
import { format } from 'date-fns';
import { User } from 'lucide-react';

const CustomEvent = ({ event }) => {
  const isApproved = event.status === 'APPROVED';
  const isRejected = event.status === 'REJECTED';
  const isPending = event.status === 'PENDING';

  // Base on Image 3
  let bgClass = "bg-[#7bb3e8]"; 
  if (isPending) bgClass = "bg-[#f6b26b]"; 
  if (isRejected) bgClass = "bg-[#e06666]";

  const isMultiDay = event.start.toDateString() !== event.end.toDateString();
  const timeString = isMultiDay 
    ? `${format(event.start, 'dd/MM')} - ${format(event.end, 'dd/MM')}`
    : `${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`;

  return (
    <div className={`w-full h-full p-1.5 rounded ${bgClass} text-white shadow-sm overflow-hidden flex flex-col hover:brightness-95 transition-all border border-black/5`}>
      <div className="flex items-start gap-1 mb-0.5">
        <div className="w-4 h-4 rounded-full bg-[#a7f3d0] text-teal-700 flex items-center justify-center shrink-0 border border-white/30 relative">
          <span className="text-[8px] font-bold">
            {event.user ? event.user.charAt(0).toUpperCase() : 'U'}
          </span>
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border-2 border-[#7bb3e8]"></div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1 mt-0">
          <span className="text-[10px] font-semibold truncate">
            {event.user}
          </span>
          <User className="w-2.5 h-2.5 shrink-0 opacity-80" />
        </div>
      </div>
      <div className="text-[9.5px] leading-snug opacity-95">
        <div className="truncate">{event.title}</div>
        <div className="truncate">({timeString})</div>
      </div>
    </div>
  );
};

export default CustomEvent;
