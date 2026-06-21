import { useState } from 'react';
import { Users, Clock, Activity, CheckCircle2, FileText, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function Insights() {
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clinic Insights</h1>
          <p className="text-slate-500 font-medium">Performance metrics and patient flow analytics</p>
        </div>
        <div className="flex items-center gap-3 bg-clinic-card p-1 rounded-xl border border-slate-200 shadow-sm">
          {(['daily', 'weekly', 'monthly'] as const).map(v => (
            <button 
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all capitalize",
                view === v ? "bg-clinic-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Patients', value: '1,284', trend: '+12%', icon: Users, color: 'text-blue-600' },
          { label: 'Avg Wait Time', value: '14m', trend: '-2m', icon: Clock, color: 'text-amber-600' },
          { label: 'Appt Completion', value: '94%', trend: '+1.2%', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Revenue (NZD)', value: '$12.4k', trend: '+8%', icon: Activity, color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-2xl bg-slate-50", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded-lg",
                stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}>
                {stat.trend}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-slate-900">Patient Volume Over Time</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Filter Data</button>
              <button className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Export PDF</button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
            <p className="text-slate-400 italic">Clinic metrics visualization placeholder</p>
          </div>
        </div>

        <div className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6">
          <h2 className="text-xl font-bold text-slate-900">Management Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Import via CSV', icon: FileText },
              { label: 'Integrate to BI Platform', icon: Activity },
              { label: 'Create New Chart', icon: PlusCircle },
              { label: 'Ask AI for Insights', icon: Activity },
            ].map(btn => (
              <button 
                key={btn.label}
                disabled
                className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-400 cursor-not-allowed group transition-all"
              >
                <btn.icon className="w-5 h-5" />
                <span className="font-bold text-sm">{btn.label}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Display Only</span>
              </button>
            ))}
          </div>
          <div className="mt-auto p-4 bg-clinic-secondary/10 rounded-2xl border border-clinic-secondary/20">
            <p className="text-xs text-clinic-primary font-medium leading-relaxed">
              <strong>Note:</strong> These management tools are currently in development and will be available in the next system update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
