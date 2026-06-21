import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { query, collection, orderBy, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { deleteRecord } from '../services/audit';
import { Patient, PatientStatus, STATUS_OPTIONS } from '../types';
import { FilterDropdown } from '../components/FilterDropdown';
import { StatusSelect } from '../components/StatusSelect';

export function WaitingRoom() {
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

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'all') return p.status !== PatientStatus.DISCHARGED;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Waiting Room</h1>
        </div>
        <FilterDropdown 
          value={statusFilter} 
          onChange={setStatusFilter} 
          options={STATUS_OPTIONS} 
        />
      </header>

      <div className="bg-clinic-card rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-clinic-header text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">NHI</th>
                <th className="px-6 py-4">Sex</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Room</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((p) => (
                <tr key={p.id} className="hover:bg-clinic-secondary/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-clinic-secondary/20 text-clinic-primary flex items-center justify-center font-bold text-xs">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <span className="font-medium text-slate-900">{p.firstName} {p.lastName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{p.nhi}</td>
                  <td className="px-6 py-4 text-slate-500">{p.sex}</td>
                  <td className="px-6 py-4">
                    <StatusSelect 
                      patientId={p.id} 
                      currentStatus={p.status} 
                      canEdit={!!roleData?.canWritePatients} 
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{p.room || '—'}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {p.lastUpdated ? format(p.lastUpdated.toDate(), 'dd-MM-yyyy HH:mm') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => navigate(`/patients/${p.id}/chart`)}
                        className="text-clinic-primary font-bold text-sm hover:underline"
                      >
                        Open Chart
                      </button>
                      <button 
                        onClick={() => deleteRecord('patients', p.id, `Deleted patient: ${p.firstName} ${p.lastName}`)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete Patient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No patients match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
