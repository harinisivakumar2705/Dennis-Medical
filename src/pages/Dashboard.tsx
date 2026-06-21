import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { query, collection, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  PlusCircle, 
  Search, 
  Clock, 
  Activity, 
  Users, 
  ArrowRight, 
  ClipboardList, 
  Calendar, 
  FileText, 
  Pill, 
  FlaskConical 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Patient, PatientStatus, STATUS_OPTIONS } from '../types';
import { cn } from '../lib/utils';
import { FilterDropdown } from '../components/FilterDropdown';
import { StatusSelect } from '../components/StatusSelect';

export function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { roleData } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('lastUpdated', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'patients'));
  }, []);

  const stats = {
    waiting: patients.filter(p => p.status === PatientStatus.WAITING).length,
    triage: patients.filter(p => p.status === PatientStatus.IN_TRIAGE).length,
    inAppointment: patients.filter(p => p.status === PatientStatus.IN_APPOINTMENT).length,
  };

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'all') return p.status !== PatientStatus.DISCHARGED;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Main page</h1>
          <p className="text-slate-500 text-lg mt-1">Welcome back to the Dennis Medical staff portal.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/intake')}
            className="px-6 py-3 bg-clinic-primary text-white font-bold rounded-xl shadow-lg shadow-clinic-primary/20 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Patient Intake
          </button>
          <button 
            onClick={() => navigate('/patients')}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Look up patient
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'In Waiting Room', value: stats.waiting, color: 'bg-blue-500', icon: Clock, path: '/waiting-room' },
          { label: 'In Triage', value: stats.triage, color: 'bg-amber-500', icon: Activity, path: '/waiting-room' },
          { label: 'In Appointment', value: stats.inAppointment, color: 'bg-emerald-500', icon: Users, path: '/waiting-room' },
        ].map((stat) => (
          <button 
            key={stat.label} 
            onClick={() => navigate(stat.path)}
            className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left group"
          >
            <div className="flex justify-between items-start">
              <div className={cn("p-3 rounded-2xl mb-4 transition-colors", stat.color.replace('bg-', 'bg-').concat('/10'), stat.color.replace('bg-', 'text-'))}>
                <stat.icon className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-clinic-primary group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-black text-slate-900">{stat.value}</span>
              <span className="text-slate-400 font-medium">patients</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-clinic-primary" />
            Quick Links
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Schedule Visit', path: '/appointments', icon: Calendar, color: 'bg-indigo-50 text-indigo-600' },
              { label: 'Medical Forms', path: '/forms', icon: FileText, color: 'bg-purple-50 text-purple-600' },
              { label: 'Pharmacy', path: '/pharmacy', icon: Pill, color: 'bg-pink-50 text-pink-600' },
              { label: 'Lab Results', path: '/labs', icon: FlaskConical, color: 'bg-cyan-50 text-cyan-600' },
            ].map(link => (
              <button 
                key={link.label}
                 onClick={() => navigate(link.path)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-100 hover:border-clinic-primary/20 hover:bg-clinic-secondary/10 transition-all gap-3"
              >
                <div className={cn("p-3 rounded-xl", link.color)}>
                  <link.icon className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-700 text-sm">{link.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-clinic-primary" />
              Patient Status Preview
            </h2>
            <FilterDropdown 
              value={statusFilter} 
              onChange={setStatusFilter} 
              options={STATUS_OPTIONS} 
            />
          </div>
          <div className="space-y-4">
            {filteredPatients.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-clinic-bg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-clinic-card border border-slate-200 flex items-center justify-center text-slate-400 font-bold">
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{p.firstName} {p.lastName}</p>
                    <StatusSelect 
                      patientId={p.id} 
                      currentStatus={p.status} 
                      canEdit={!!roleData?.canWritePatients} 
                    />
                  </div>
                </div>
                <button 
                  onClick={() => navigate(`/patients/${p.id}/chart`)}
                  className="p-2 text-slate-400 hover:text-clinic-primary transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
            {filteredPatients.length === 0 && (
              <p className="text-center py-8 text-slate-400 italic">No patients match this status.</p>
            )}
            <div className="pt-4 border-t border-slate-100 text-center">
              <Link to="/waiting-room" className="text-sm font-bold text-clinic-primary hover:underline">View Full Waiting Room</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
