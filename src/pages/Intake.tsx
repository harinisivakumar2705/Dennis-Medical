import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logAction } from '../services/audit';
import { PatientStatus, STATUS_OPTIONS } from '../types';
import { UserFriendlyDateInput } from '../components/UserFriendlyDateInput';

export function Intake() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    nhi: '',
    sex: 'F' as 'F' | 'M',
    status: PatientStatus.WAITING,
    room: ''
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'patients'), {
        ...formData,
        lastUpdated: serverTimestamp()
      });
      await logAction('CREATE', 'patients', docRef.id, `New patient intake: ${formData.firstName} ${formData.lastName}`);
      navigate('/waiting-room');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'patients');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Patient Intake</h1>
        <p className="text-slate-500">Register a new patient into the system</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-clinic-card p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">First Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none"
              value={formData.firstName}
              onChange={e => setFormData({...formData, firstName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Last Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none"
              value={formData.lastName}
              onChange={e => setFormData({...formData, lastName: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <UserFriendlyDateInput 
            label="Date of Birth"
            required
            value={formData.dob}
            onChange={val => setFormData({...formData, dob: val})}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">NHI</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none"
              value={formData.nhi}
              onChange={e => setFormData({...formData, nhi: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Assigned Sex at Birth</label>
            <select
              required
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none"
              value={formData.sex}
              onChange={e => setFormData({...formData, sex: e.target.value as 'F' | 'M'})}
            >
              <option value="F">Female (F)</option>
              <option value="M">Male (M)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Initial Status</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as PatientStatus})}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-clinic-primary text-white font-bold py-3 rounded-xl hover:bg-clinic-primary/90 transition-colors shadow-lg shadow-clinic-primary/20"
        >
          Complete Intake
        </button>
      </form>
    </div>
  );
}
