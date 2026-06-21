import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export function LoginPage() {
  const { login, user, loading, isSigningIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg p-4">
      <div className="max-w-md w-full bg-clinic-card rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-clinic-secondary/20 text-clinic-primary rounded-full mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Dennis Medical</h1>
          <p className="text-slate-500 mt-2">Sign in to access the staff portal</p>
        </div>

        <button
          onClick={login}
          disabled={isSigningIn}
          className={cn(
            "w-full flex items-center justify-center gap-3 bg-clinic-header border border-slate-300 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm",
            isSigningIn ? "opacity-50 cursor-not-allowed" : "hover:bg-clinic-secondary/20"
          )}
        >
          {isSigningIn ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" alt="Google" />
          )}
          {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Authorized access only. All actions are logged for HIPAA compliance. 
            By signing in, you agree to the system's security and privacy policies.
          </p>
        </div>
      </div>
    </div>
  );
}
