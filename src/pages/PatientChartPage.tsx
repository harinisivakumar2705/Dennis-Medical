import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ChevronLeft, 
  UserCircle, 
  AlertCircle, 
  Pill, 
  ClipboardList, 
  FileText, 
  Edit2, 
  Calendar 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../services/audit';
import { Patient, PatientChart } from '../types';
import { toDisplayDate, fromDisplayDate } from '../utils';
import { StatusSelect } from '../components/StatusSelect';

export function PatientChartPage() {
  const { id } = useParams();
  const { roleData } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<PatientChart>({
    medicalHistory: '',
    medications: '',
    notes: '',
    allergies: '',
    previousVisitNotes: '',
    identifyingInfo: {
      address: '',
      phone: '',
      emergencyContact: ''
    }
  });

  const [coreInfo, setCoreInfo] = useState({
    firstName: '',
    lastName: '',
    nhi: '',
    sex: 'F' as 'F' | 'M',
    dob: '',
    room: ''
  });

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, 'patients', id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Patient;
        setPatient({ id: docSnap.id, ...data });
        if (data.chart) {
          setChartData(data.chart);
        }
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (patient) {
      setCoreInfo({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        nhi: patient.nhi || '',
        sex: patient.sex || 'F',
        dob: patient.dob || '',
        room: patient.room || ''
      });
    }
  }, [patient?.id]);

  const handleSave = async () => {
    if (!id) return;
    try {
      const docRef = doc(db, 'patients', id);
      await setDoc(docRef, {
        firstName: coreInfo.firstName,
        lastName: coreInfo.lastName,
        nhi: coreInfo.nhi,
        sex: coreInfo.sex,
        dob: coreInfo.dob,
        room: coreInfo.room,
        chart: chartData,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      await logAction('UPDATE', 'patients', id, `Updated patient chart and demographics info for ${coreInfo.firstName} ${coreInfo.lastName}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${id}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading chart...</div>;
  if (!patient) return <div className="text-center p-12">Patient not found.</div>;

  const canEdit = roleData?.canWritePatients || roleData?.canManageUsers;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/patients" className="p-3 bg-clinic-bg rounded-2xl text-clinic-primary hover:bg-clinic-secondary/20 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{coreInfo.lastName || patient.lastName}, {coreInfo.firstName || patient.firstName}</h1>
            <p className="text-slate-500 font-medium">NHI: {coreInfo.nhi || patient.nhi} • Sex: {coreInfo.sex || patient.sex} • DOB: {toDisplayDate(coreInfo.dob || patient.dob)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusSelect 
            patientId={patient.id} 
            currentStatus={patient.status} 
            canEdit={!!canEdit} 
          />
          {canEdit && (
            <button
              onClick={handleSave}
              className="px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 bg-clinic-primary text-white hover:bg-clinic-primary/90 shadow-clinic-primary/20"
            >
              Save Changes
            </button>
          )}
        </div>
      </header>

      {/* Core Demographics Editor */}
      <div className="bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-clinic-primary" />
          Core Patient demographics & registration details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">First Name</label>
            <input 
              type="text"
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75 font-medium text-slate-800"
              value={coreInfo.firstName}
              onChange={e => setCoreInfo({...coreInfo, firstName: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Name</label>
            <input 
              type="text"
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75 font-medium text-slate-800"
              value={coreInfo.lastName}
              onChange={e => setCoreInfo({...coreInfo, lastName: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NHI</label>
            <input 
              type="text"
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75 font-mono text-slate-800"
              value={coreInfo.nhi}
              onChange={e => setCoreInfo({...coreInfo, nhi: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sex</label>
            <select
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75 font-medium text-slate-800"
              value={coreInfo.sex}
              onChange={e => setCoreInfo({...coreInfo, sex: e.target.value as 'F' | 'M'})}
            >
              <option value="F">Female (F)</option>
              <option value="M">Male (M)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date of Birth</label>
            {canEdit ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="DD-MM-YYYY"
                  className="flex-1 bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none font-medium text-slate-800"
                  value={toDisplayDate(coreInfo.dob)}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.length <= 10) {
                      let formatted = val.replace(/\D/g, '');
                      if (formatted.length > 2 && formatted.length <= 4) {
                        formatted = `${formatted.slice(0, 2)}-${formatted.slice(2)}`;
                      } else if (formatted.length > 4) {
                        formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 4)}-${formatted.slice(4, 8)}`;
                      }
                      if (formatted.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        setCoreInfo({...coreInfo, dob: fromDisplayDate(formatted)});
                      }
                    }
                  }}
                />
                <div className="relative">
                  <input
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
                    value={coreInfo.dob}
                    onChange={e => setCoreInfo({...coreInfo, dob: e.target.value})}
                  />
                  <div className="h-full px-3 flex items-center justify-center bg-slate-100/50 rounded-lg border border-slate-200 text-slate-400 hover:text-clinic-primary transition-all cursor-pointer">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="bg-clinic-bg border-none rounded-lg p-2.5 text-sm font-medium text-slate-800">{toDisplayDate(coreInfo.dob)}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room</label>
            <input 
              type="text"
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75 font-medium text-slate-800"
              value={coreInfo.room}
              onChange={e => setCoreInfo({...coreInfo, room: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Identifying Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Address', value: chartData.identifyingInfo.address, key: 'address' },
          { label: 'Phone', value: chartData.identifyingInfo.phone, key: 'phone' },
          { label: 'Emergency Contact', value: chartData.identifyingInfo.emergencyContact, key: 'emergencyContact' }
        ].map((field) => (
          <div key={field.key} className="bg-clinic-card p-5 rounded-2xl border border-slate-200 shadow-sm group relative">
            <div className="flex justify-between items-start mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{field.label}</label>
            </div>
            <input 
              type="text"
              disabled={!canEdit}
              className="w-full bg-clinic-bg border-none rounded-lg p-1 text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75"
              value={field.value || ''}
              onChange={e => setChartData({
                ...chartData, 
                identifyingInfo: { ...chartData.identifyingInfo, [field.key as keyof typeof chartData.identifyingInfo]: e.target.value }
              })}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Allergies & Medications */}
        <div className="lg:col-span-1 space-y-6">
          {/* Known Allergies */}
          <div className="bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Known Allergies
            </h2>
            <textarea 
              disabled={!canEdit}
              className="w-full p-3 bg-clinic-bg border-none rounded-xl text-sm min-h-[80px] focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75"
              value={chartData.allergies || ''}
              onChange={e => setChartData({...chartData, allergies: e.target.value})}
              placeholder="List allergies..."
            />
          </div>

          {/* Medications */}
          <div className="bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[300px]">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-clinic-primary" />
              Medications
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <textarea 
                disabled={!canEdit}
                className="w-full h-full p-3 bg-clinic-bg border-none rounded-xl text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none resize-none disabled:opacity-75"
                value={chartData.medications || ''}
                onChange={e => setChartData({...chartData, medications: e.target.value})}
                placeholder="List medications..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Medical History & Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Medical History */}
          <div className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-clinic-primary" />
              Medical History
            </h2>
            <textarea 
              disabled={!canEdit}
              className="w-full p-4 bg-clinic-bg border-none rounded-2xl text-sm min-h-[150px] focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75"
              value={chartData.medicalHistory || ''}
              onChange={e => setChartData({...chartData, medicalHistory: e.target.value})}
              placeholder="Enter patient's medical history..."
            />
          </div>

          {/* Previous Visit Notes */}
          <div className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[250px]">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-clinic-primary" />
              Previous Visit Notes
            </h2>
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              <textarea 
                disabled={!canEdit}
                className="w-full h-full p-4 bg-clinic-bg border-none rounded-2xl text-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none resize-none disabled:opacity-75"
                value={chartData.previousVisitNotes || ''}
                onChange={e => setChartData({...chartData, previousVisitNotes: e.target.value})}
                placeholder="No previous visit notes."
              />
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-clinic-primary" />
              Clinical Notes
            </h2>
            <textarea 
              disabled={!canEdit}
              className="w-full p-6 bg-clinic-bg border-none rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-clinic-primary/20 outline-none disabled:opacity-75"
              value={chartData.notes || ''}
              onChange={e => setChartData({...chartData, notes: e.target.value})}
              placeholder="Type clinical notes here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
