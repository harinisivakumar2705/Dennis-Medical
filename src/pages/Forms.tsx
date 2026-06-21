import { FileText } from 'lucide-react';

export function Forms() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
        <FileText className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Medical Forms</h1>
      <p className="text-slate-500 max-w-md">
        This page will display and manage clinical documentation templates. It will enable clinic staff to complete and save initial patient prenatal visits, postpartum follow-ups, and procedures.
      </p>
    </div>
  );
}
