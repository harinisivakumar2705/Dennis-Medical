import { Calendar } from 'lucide-react';
import { toDisplayDate, fromDisplayDate } from '../utils';

export function UserFriendlyDateInput({ 
  value, 
  onChange, 
  label, 
  required = false,
  placeholder = "DD-MM-YYYY"
}: { 
  value: string; 
  onChange: (val: string) => void; 
  label: string; 
  required?: boolean;
  placeholder?: string;
}) {
  const displayValue = toDisplayDate(value);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative group flex gap-2">
        <input
          required={required}
          type="text"
          placeholder={placeholder}
          className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none bg-white transition-all"
          value={displayValue}
          onChange={e => {
            const val = e.target.value;
            if (val.length <= 10) {
              let formatted = val.replace(/\D/g, '');
              if (formatted.length > 2 && formatted.length <= 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2)}`;
              } else if (formatted.length > 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 4)}-${formatted.slice(4, 8)}`;
              }
              
              if (formatted.match(/^\d{2}-\d{2}-\d{4}$/)) {
                onChange(fromDisplayDate(formatted));
              }
            }
          }}
        />
        <div className="relative">
          <input
            type="date"
            className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          <div className="h-full px-3 flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 italic">Format: DD-MM-YYYY. Use the icon for easier year selection.</p>
    </div>
  );
}
