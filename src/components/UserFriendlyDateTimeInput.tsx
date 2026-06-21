import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toDisplayDate, fromDisplayDate } from '../utils';

export function UserFriendlyDateTimeInput({ 
  value, 
  onChange, 
  label, 
  required = false 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  label: string, 
  required?: boolean 
}) {
  // value is YYYY-MM-DDTHH:mm
  const [datePart, timePart] = value.split('T');
  const displayDate = toDisplayDate(datePart);

  const handleDateChange = (newIsoDate: string) => {
    onChange(`${newIsoDate}T${timePart || '09:00'}`);
  };

  const handleTimeChange = (newTime: string) => {
    onChange(`${datePart || format(new Date(), 'yyyy-MM-dd')}T${newTime}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1 group flex gap-2">
          <input
            required={required}
            type="text"
            placeholder="DD-MM-YYYY"
            className="flex-1 p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
            value={displayDate}
            onChange={e => {
              const val = e.target.value;
              let formatted = val.replace(/\D/g, '');
              if (formatted.length > 2 && formatted.length <= 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2)}`;
              } else if (formatted.length > 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 4)}-${formatted.slice(4, 8)}`;
              }
              if (formatted.match(/^\d{2}-\d{2}-\d{4}$/)) {
                handleDateChange(fromDisplayDate(formatted));
              }
            }}
          />
          <div className="relative">
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
              value={datePart || ''}
              onChange={e => handleDateChange(e.target.value)}
            />
            <div className="h-full px-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="relative w-36 group flex gap-2">
          <input
            required={required}
            type="text"
            placeholder="HH:mm"
            className="flex-1 p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
            value={timePart || ''}
            onChange={e => handleTimeChange(e.target.value)}
          />
          <div className="relative">
            <input
              type="time"
              className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
              value={timePart || ''}
              onChange={e => handleTimeChange(e.target.value)}
            />
            <div className="h-full px-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
