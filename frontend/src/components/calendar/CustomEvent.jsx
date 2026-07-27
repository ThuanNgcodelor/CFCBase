import React from 'react';
import { format } from 'date-fns';
import { getCalendarEventVisual } from './calendarEventVisual';

const CustomEvent = ({ event }) => {
  const visual = getCalendarEventVisual(event);
  const durationMinutes = Math.max(0, Math.round((event.end - event.start) / 60000));
  const isShortEvent = durationMinutes <= 45;

  const isMultiDay = event.start.toDateString() !== event.end.toDateString();
  const timeString = isMultiDay 
    ? `${format(event.start, 'dd/MM')} - ${format(event.end, 'dd/MM')}`
    : `${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`;

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-md border shadow-sm transition-all hover:brightness-[0.98] ${visual.containerClass}`}>
      <div className={`flex h-full min-h-0 flex-col ${isShortEvent ? 'justify-center px-2 py-0.5' : 'p-2'}`}>
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className="truncate text-[9px] font-semibold leading-tight opacity-80 sm:text-[10px]">
            {timeString}
          </span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${visual.dotClass}`} />
        </div>
        {!isShortEvent && (
          <>
            <div className="mt-1 truncate text-[10px] font-bold leading-tight sm:text-[11px]">{event.title}</div>
            <div className="mt-1 truncate text-[9px] leading-tight opacity-75 sm:text-[10px]">{event.user}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomEvent;
