import { FlaskConical } from 'lucide-react';

export function LabIntegration() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Lab Integration</h1>
        <p className="text-slate-500">View lab results and order diagnostic tests</p>
      </header>
      <div className="bg-clinic-card p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Lab integration</h2>
        <p className="text-slate-500 max-w-md">This page will integrate to a 3rd party vendor lab application to receive lab results in real time. Will expand into FHIR and ISO compliant design.</p>
      </div>
    </div>
  );
}
