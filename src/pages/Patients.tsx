import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  query, 
  collection, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Search, Plus, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logAction, deleteRecord } from '../services/audit';
import { PatientStatus, STATUS_OPTIONS, Patient } from '../types';
import { toDisplayDate } from '../utils';
import { FilterDropdown } from '../components/FilterDropdown';
import { StatusSelect } from '../components/StatusSelect';
import { UserFriendlyDateInput } from '../components/UserFriendlyDateInput';

export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const { roleData } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('lastName', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });
  }, []);

  const handleSavePatientEdit = async (e: any) => {
    e.preventDefault();
    if (!editingPatient) return;
    try {
      const docRef = doc(db, 'patients', editingPatient.id);
      await setDoc(docRef, {
        firstName: editingPatient.firstName,
        lastName: editingPatient.lastName,
        nhi: editingPatient.nhi,
        sex: editingPatient.sex,
        dob: editingPatient.dob,
        room: editingPatient.room || '',
        status: editingPatient.status,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      await logAction('UPDATE', 'patients', editingPatient.id, `Edited patient demographics: ${editingPatient.firstName} ${editingPatient.lastName}`);
      setEditingPatient(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${editingPatient.id}`);
    }
  };

  const filtered = patients.filter(p => {
    const matchesSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.nhi.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Patient lookup</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <FilterDropdown 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={STATUS_OPTIONS} 
          />
          <Link to="/intake" className="bg-clinic-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-clinic-primary/90 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" />
            New Patient
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name or NHI..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-clinic-primary transition-all shadow-sm bg-clinic-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(p => (
          <div key={p.id} className="bg-clinic-card p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
            <button 
              onClick={() => deleteRecord('patients', p.id, `Deleted patient: ${p.firstName} ${p.lastName}`)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete Patient"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="flex flex-col mb-4">
              <h3 className="font-bold text-lg text-slate-900">{p.lastName}, {p.firstName}</h3>
              <p className="text-sm text-slate-500 mb-2">NHI: {p.nhi} • Sex: {p.sex}</p>
              <StatusSelect 
                patientId={p.id} 
                currentStatus={p.status} 
                canEdit={!!roleData?.canWritePatients} 
              />
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>DOB: {toDisplayDate(p.dob)}</p>
              <p>Room: {p.room || 'N/A'}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
              <Link 
                to={`/patients/${p.id}/chart`}
                className="flex-1 py-2 text-center text-sm font-medium text-clinic-primary hover:bg-clinic-secondary/10 rounded-lg transition-colors"
              >
                View Charts
              </Link>
              {roleData?.canWritePatients && (
                <button 
                  onClick={() => setEditingPatient(p)}
                   className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-clinic-secondary/10 rounded-lg transition-colors"
                >
                  Edit Info
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-clinic-card rounded-2xl border border-dashed border-slate-200">
            No patients found matching your search and filter criteria.
          </div>
        )}
      </div>

      {editingPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-clinic-card rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">Edit Patient Demographics</h2>
            <form onSubmit={handleSavePatientEdit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">First Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary outline-none text-slate-800 font-medium"
                    value={editingPatient.firstName}
                    onChange={e => setEditingPatient({...editingPatient, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Last Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary outline-none text-slate-800 font-medium"
                    value={editingPatient.lastName}
                    onChange={e => setEditingPatient({...editingPatient, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">NHI</label>
                  <input 
                    required
                    type="text"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary font-mono outline-none text-slate-800 font-medium"
                    value={editingPatient.nhi}
                    onChange={e => setEditingPatient({...editingPatient, nhi: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Assigned Sex at Birth</label>
                  <select
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary outline-none text-slate-800 font-medium"
                    value={editingPatient.sex}
                    onChange={e => setEditingPatient({...editingPatient, sex: e.target.value as 'F' | 'M'})}
                  >
                    <option value="F">Female (F)</option>
                    <option value="M">Male (M)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <UserFriendlyDateInput 
                  label="Date of Birth"
                  required
                  value={editingPatient.dob}
                  onChange={val => setEditingPatient({...editingPatient, dob: val})}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Room</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary outline-none text-slate-800 font-medium"
                    value={editingPatient.room || ''}
                    onChange={e => setEditingPatient({...editingPatient, room: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Patient Status</label>
                <select
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-clinic-primary outline-none text-slate-800 font-medium"
                  value={editingPatient.status}
                  onChange={e => setEditingPatient({...editingPatient, status: e.target.value as PatientStatus})}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingPatient(null)} 
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-clinic-primary text-white font-bold rounded-xl hover:bg-clinic-primary/90 transition-all shadow-md active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
