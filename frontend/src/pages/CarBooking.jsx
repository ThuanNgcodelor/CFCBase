import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { vi } from 'date-fns/locale/vi';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { resourceApi } from '../api/resourceApi';
import { bookingApi } from '../api/bookingApi';
import CustomToolbar from '../components/calendar/CustomToolbar';
import CustomEvent from '../components/calendar/CustomEvent';
import CustomDateHeader from '../components/calendar/CustomDateHeader';
import toast from 'react-hot-toast';

const locales = { 'vi': vi };
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales,
});

const messages = {
  today: 'Hôm nay',
  previous: 'Trước',
  next: 'Tiếp',
  month: 'Tháng',
  week: 'Tuần',
  work_week: 'Tuần làm việc',
  day: 'Ngày',
  agenda: 'Lịch trình',
  date: 'Ngày',
  time: 'Thời gian',
  event: 'Sự kiện',
  noEventsInRange: 'Không có lệnh đặt xe nào trong thời gian này.',
  showMore: total => `+ Xem thêm (${total})`
};

export default function CarBooking() {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedCar, setSelectedCar] = useState('');
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [carsData, bookingsData] = await Promise.all([
          resourceApi.getCars(),
          bookingApi.getCarBookings()
        ]);
        
        setCars(carsData || []);
        if (carsData && carsData.length > 0) {
          setSelectedCar(carsData[0].id);
        }

        const mappedEvents = (bookingsData || []).map(b => ({
          id: b.id,
          title: b.title,
          start: new Date(b.startTime),
          end: new Date(b.endTime),
          user: b.requester?.fullName || 'User',
          avatarUrl: b.requester?.avatarUrl,
          status: b.status,
          vehicleId: b.vehicle?.id
        }));
        setEvents(mappedEvents);
      } catch (err) {
        console.error("Lỗi tải dữ liệu lịch xe:", err);
      }
    };
    fetchData();
  }, []);

  const filteredEvents = events.filter(e => 
    e.status !== 'REJECTED' && e.status !== 'CANCELLED' && 
    (selectedCar ? e.vehicleId === selectedCar : true)
  );

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Calendar Grid */}
      <div className="flex-1 bg-white p-4 sm:px-6 overflow-hidden flex flex-col">
        <CustomToolbar 
          date={date}
          view={view}
          onNavigate={setDate}
          onView={setView}
          resources={cars}
          selectedResource={selectedCar}
          onResourceChange={setSelectedCar}
          resourceType="car"
          onCreateClick={() => navigate('/cars/create')}
        />
        <style>{`
          .rbc-time-view, .rbc-month-view { border: none; }
          .rbc-time-header { border-bottom: 1px solid #f1f5f9; }
          .rbc-time-content { border-top: none; overflow-y: auto; }
          .rbc-time-slot { min-height: 24px; border-bottom: 1px solid #f8fafc; }
          .rbc-timeslot-group { border-bottom: 1px solid #f1f5f9; min-height: 48px; }
          .rbc-day-slot .rbc-time-slot { border-top: none; }
          .rbc-event { 
            background-color: transparent !important; 
            padding: 0 4px 0 0 !important; 
            border: none !important; 
            border-radius: 4px !important;
            box-shadow: none !important;
          }
          .rbc-event:focus { outline: none !important; }
          .rbc-header { padding: 0; border-bottom: none; border-left: 1px solid #f1f5f9; }
          .rbc-header + .rbc-header { border-left: 1px solid #f1f5f9; }
          .rbc-today { background-color: #f8fafc; }
          .rbc-time-gutter .rbc-timeslot-group { border-right: none; }
          .rbc-label { font-size: 0.75rem; color: #64748b; padding: 0 8px; font-weight: 500; }
          .rbc-allday-cell { display: none; } /* Ẩn phần all-day */
          .rbc-day-slot .rbc-events-container { margin-right: 0; }
          .rbc-time-header-content { border-left: 1px solid #f1f5f9; }
          .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #f1f5f9; }
        `}</style>

        <Calendar
          localizer={localizer}
          events={filteredEvents}
          messages={messages}
          defaultView="week"
          views={['month', 'week', 'day']}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          step={30}
          timeslots={2}
          showMultiDayTimes={true}
          selectable
          onSelectSlot={(slotInfo) => {
            if (slotInfo.start < new Date()) {
              toast.error("Không thể đặt lịch trong quá khứ!");
              return;
            }
            navigate('/cars/create', { state: { start: slotInfo.start, end: slotInfo.end } });
          }}
          onSelectEvent={(event) => navigate(`/admin/approvals/${event.id}`)}
          min={new Date(0, 0, 0, 6, 0, 0)}
          max={new Date(0, 0, 0, 22, 0, 0)}
          scrollToTime={new Date(1970, 1, 1, 6)}
          formats={{ 
            timeGutterFormat: "H'h'",
          }}
          toolbar={false}
          components={{
            event: CustomEvent,
            header: CustomDateHeader
          }}
          className="h-full font-sans text-sm"
        />
      </div>
    </div>
  );
}
