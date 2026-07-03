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
    <div className={`w-full h-full rounded ${bgClass} text-white shadow-sm hover:brightness-95 transition-all border border-black/5 relative`}>
      <div className="sticky top-2 z-10 p-1.5 flex flex-col">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
          <div className="relative w-4 h-4 sm:w-5 sm:h-5 shrink-0">
            {event.avatarUrl ? (
              <img src={event.avatarUrl} referrerPolicy="no-referrer" alt={event.user} className="w-full h-full rounded-full object-cover border border-white/30" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#a7f3d0] text-teal-700 flex items-center justify-center border border-white/30">
                <span className="text-[8px] sm:text-[10px] font-bold">
                  {event.user ? event.user.charAt(0).toUpperCase() : 'U'}
                </span>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full border border-[#7bb3e8] sm:border-2"></div>
          </div>
          <div className="flex-1 min-w-[20px] flex items-center gap-0.5 sm:gap-1 mt-0 overflow-hidden">
            <span className="text-[9px] sm:text-[11px] md:text-xs font-semibold truncate">
              {event.user}
            </span>
            <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />
          </div>
        </div>
        <div className="text-[8.5px] sm:text-[10px] md:text-[11px] leading-snug opacity-95">
          <div className="truncate">{event.title}</div>
          <div className="truncate">({timeString})</div>
        </div>
      </div>
    </div>
  );
};

export default CustomEvent;
