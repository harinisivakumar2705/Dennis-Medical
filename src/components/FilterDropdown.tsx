export function FilterDropdown({ 
  value, 
  onChange, 
  options, 
  label = "Filter by Status" 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { value: string; label: string }[],
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-clinic-primary/20 transition-all"
      >
        <option value="all">All Statuses</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
