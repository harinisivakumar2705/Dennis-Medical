import { MessageSquare } from 'lucide-react';

export function StaffMessaging() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Staff Messaging</h1>
        <p className="text-slate-500">Internal communication and secure messaging</p>
      </header>
      <div className="bg-clinic-card p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Messaging Module</h2>
        <p className="text-slate-500 max-w-md">Secure internal messaging for clinic staff is currently being configured. This will allow for HIPAA-compliant communication.</p>
      </div>
    </div>
  );
}
