import { Pill } from 'lucide-react';

export function PharmacyIntegration() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Pharmacy Integration</h1>
        <p className="text-slate-500">Manage prescriptions and pharmacy communications</p>
      </header>
      <div className="bg-clinic-card p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
          <Pill className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pharmacy integration</h2>
        <p className="text-slate-500 max-w-md">This page will integrate to a te whatu ora database/vendor where clinics and pharmacies upload and receive scripts. Not too sure on the design behind this</p>
      </div>
    </div>
  );
}
