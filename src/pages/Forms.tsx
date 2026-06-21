import { FileText, Plus } from 'lucide-react';

export function Forms() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Medical Forms</h1>
        <p className="text-slate-500">Access and fill out clinical documentation</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: 'Initial Prenatal Visit', type: 'Clinical' },
          { title: 'Postpartum Follow-up', type: 'Clinical' },
          { title: 'Gyn Annual Exam', type: 'Clinical' },
          { title: 'Consent for Procedure', type: 'Legal' },
        ].map(form => (
          <div key={form.title} className="bg-clinic-card p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-clinic-primary/30 transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-clinic-secondary/20 text-clinic-primary rounded-xl flex items-center justify-center group-hover:bg-clinic-primary group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{form.title}</h3>
                <p className="text-sm text-slate-500">{form.type}</p>
              </div>
            </div>
            <Plus className="w-5 h-5 text-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
