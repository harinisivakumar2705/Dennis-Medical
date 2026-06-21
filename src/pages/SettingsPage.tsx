import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account and preferences</p>
      </header>

      <div className="bg-clinic-card p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">User Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Display Name</p>
              <p className="text-slate-900">{profile?.displayName}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Email</p>
              <p className="text-slate-900">{profile?.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Assigned Role</p>
              <p className="text-clinic-primary font-bold uppercase">{profile?.role}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Account Created</p>
              <p className="text-slate-900">{profile?.createdAt?.toDate().toLocaleDateString()}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
