import React from 'react';
import { ChevronLeft, ChevronRight, Search, Filter, Truck, Building2 } from 'lucide-react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { Button } from '../ui/Button';

const CustomToolbar = ({ 
  date, 
  view, 
  onNavigate, 
  onView, 
  resources, 
  selectedResource, 
  onResourceChange, 
  resourceType, 
  onCreateClick 
}) => {
  const goToBack = () => {
    if (view === 'month') onNavigate(subMonths(date, 1));
    else if (view === 'week') onNavigate(subWeeks(date, 1));
    else onNavigate(subDays(date, 1));
  };

  const goToNext = () => {
    if (view === 'month') onNavigate(addMonths(date, 1));
    else if (view === 'week') onNavigate(addWeeks(date, 1));
    else onNavigate(addDays(date, 1));
  };

  const goToCurrent = () => {
    onNavigate(new Date());
  };

  const label = () => {
    if (view === 'month') {
      return format(date, 'MM/yyyy');
    }
    return format(date, 'dd/MM/yyyy');
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between pb-4 border-b border-gray-200 mb-4 bg-white gap-4">
      {/* Trái: Chọn tài nguyên & Lọc */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {resourceType === 'car' ? (
              <Truck className="w-4 h-4 text-gray-400" />
            ) : (
              <Building2 className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <select 
            value={selectedResource}
            onChange={(e) => onResourceChange(e.target.value)}
            className="pl-9 pr-8 py-1.5 border border-gray-200 rounded text-sm text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none min-w-[200px]"
          >
            <option value="">-- Tất cả {resourceType === 'car' ? 'các xe' : 'các phòng'} --</option>
            {resources?.map(res => (
              <option key={res.id} value={res.id}>
                {resourceType === 'car' ? `${res.vehicleType?.name || 'Xe'} - ${res.licensePlate}` : res.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="w-4 h-4 text-gray-400" />
          </div>
          <select className="pl-9 pr-8 py-1.5 border border-gray-200 rounded text-sm text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none">
            <option>Trạng thái: Tất cả</option>
            <option>Đã duyệt</option>
            <option>Chờ duyệt</option>
          </select>
        </div>
        
        <div className="relative hidden sm:block">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="pl-3 pr-9 py-1.5 border border-gray-200 rounded text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
          />
        </div>
      </div>

      {/* Phải: Date Nav, Views & Create Button */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        {/* Date Nav */}
        <div className="flex items-center bg-white border border-gray-200 rounded overflow-hidden">
          <button onClick={goToBack} className="p-1.5 hover:bg-gray-50 border-r border-gray-200 text-gray-600">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-1.5 text-sm font-medium text-gray-700 min-w-[100px] text-center cursor-pointer hover:bg-gray-50" onClick={goToCurrent}>
            {label()}
          </div>
          <button onClick={goToNext} className="p-1.5 hover:bg-gray-50 border-l border-gray-200 text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Views */}
        <div className="flex items-center bg-white border border-gray-200 rounded overflow-hidden text-sm font-medium">
          <button 
            onClick={() => onView('day')} 
            className={`px-4 py-1.5 ${view === 'day' ? 'bg-[#f0f4ff] text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Ngày
          </button>
          <div className="w-px h-5 bg-gray-200"></div>
          <button 
            onClick={() => onView('week')} 
            className={`px-4 py-1.5 ${view === 'week' ? 'bg-[#f0f4ff] text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Tuần
          </button>
          <div className="w-px h-5 bg-gray-200"></div>
          <button 
            onClick={() => onView('month')} 
            className={`px-4 py-1.5 ${view === 'month' ? 'bg-[#f0f4ff] text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Tháng
          </button>
        </div>

        <Button onClick={onCreateClick} className="ml-2 whitespace-nowrap">Tạo lệnh đặt</Button>
      </div>
    </div>
  );
};

export default CustomToolbar;
