import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { 
  query, 
  collection, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  Timestamp, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  PlusCircle, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  ArrowRight, 
  Plus 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  isWithinInterval,
  setHours,
  setMinutes
} from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logAction } from '../services/audit';
import { PatientStatus, STATUS_OPTIONS, Patient, Appointment } from '../types';
import { cn } from '../lib/utils';
import { toDisplayDate } from '../utils';
import { FilterDropdown } from '../components/FilterDropdown';
import { StatusSelect } from '../components/StatusSelect';
import { UserFriendlyDateTimeInput } from '../components/UserFriendlyDateTimeInput';

export function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { roleData } = useAuth();
  const [newApp, setNewApp] = useState({
    patientId: '',
    startTime: '',
    type: 'Consultation'
  });

  useEffect(() => {
    const q = query(collection(db, 'appointments'), orderBy('startTime', 'asc'));
    const unsubscribeApp = onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });

    const unsubscribePatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    return () => {
      unsubscribeApp();
      unsubscribePatients();
    };
  }, []);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === newApp.patientId);
    if (!patient) return;

    try {
      await addDoc(collection(db, 'appointments'), {
        patientId: newApp.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        startTime: Timestamp.fromDate(new Date(newApp.startTime)),
        type: newApp.type,
        status: 'scheduled'
      });
      await logAction('CREATE', 'appointments', 'new', `Scheduled ${newApp.type} for ${patient.firstName}`);
      setShowModal(false);
      setNewApp({ patientId: '', startTime: '', type: 'Consultation' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
    try {
      const appRef = doc(db, 'appointments', id);
      await setDoc(appRef, { status }, { merge: true });
      
      const appSnap = await getDoc(appRef);
      if (appSnap.exists()) {
        const appData = appSnap.data() as Appointment;
        const patientRef = doc(db, 'patients', appData.patientId);
        
        let patientStatus: PatientStatus | null = null;
        if (status === 'checked_in') patientStatus = PatientStatus.WAITING;
        if (status === 'completed' || status === 'cancelled') patientStatus = PatientStatus.DISCHARGED;
        
        if (patientStatus) {
          await setDoc(patientRef, { 
            status: patientStatus,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        }
      }

      await logAction('UPDATE', 'appointments', id, `Updated status to ${status}`);
      setSelectedApp(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      await logAction('DELETE', 'appointments', id, 'Deleted appointment');
      setSelectedApp(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${id}`);
    }
  };

  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ 
    start: startOfCurrentWeek, 
    end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
  });
  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter(app => {
      const appDate = app.startTime.toDate();
      return isSameDay(appDate, day) && appDate.getHours() === hour;
    });
  };

  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const showTimeIndicator = isWithinInterval(currentTime, { 
    start: startOfCurrentWeek, 
    end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
  });

  const filteredAppointments = appointments.filter(app => {
    if (statusFilter === 'all') return true;
    const patient = patients.find(p => p.id === app.patientId);
    return patient?.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Schedule</h1>
          <p className="text-slate-500">Manage clinic appointments and patient flow</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <FilterDropdown 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={STATUS_OPTIONS} 
            label="Patient Status"
          />

          <div className="flex items-center gap-3 bg-clinic-card p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                viewMode === 'calendar' ? "bg-clinic-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Calendar
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                viewMode === 'list' ? "bg-clinic-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              List
            </button>
          </div>

          <button 
            onClick={() => setShowModal(true)}
            className="bg-clinic-primary text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-clinic-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-semibold">New Appointment</span>
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-clinic-card rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[700px]">
          {/* Calendar Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-clinic-header/30">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800">
                {format(startOfCurrentWeek, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setCurrentDate(subDays(currentDate, 7))}
                  className="p-2 hover:bg-slate-50 text-slate-600 border-r border-slate-100"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="relative group">
                  <input 
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                    value={format(currentDate, 'yyyy-MM-dd')}
                    onChange={(e) => setCurrentDate(new Date(e.target.value))}
                  />
                  <button className="px-4 py-1.5 text-sm font-medium hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {toDisplayDate(format(currentDate, 'yyyy-MM-dd'))}
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-1.5 text-sm font-medium hover:bg-slate-50 text-slate-700 border-l border-slate-100"
                >
                  Today
                </button>
                <button 
                  onClick={() => setCurrentDate(addDays(currentDate, 7))}
                  className="p-2 hover:bg-slate-50 text-slate-600 border-l border-slate-100"
                  title="Next Week"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="text-sm font-medium text-slate-500 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
              Week {format(currentDate, 'w')}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-[80px_repeat(7,1fr)] min-w-[800px]">
              {/* Day Headers */}
              <div className="sticky top-0 z-20 bg-clinic-header/50 border-b border-slate-200 h-12"></div>
              {days.map(day => (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "sticky top-0 z-20 bg-clinic-header/50 border-b border-slate-200 h-12 flex flex-col items-center justify-center",
                    isSameDay(day, new Date()) && "bg-clinic-primary/5"
                  )}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(day, 'EEE')}</span>
                  <span className={cn(
                    "text-sm font-bold",
                    isSameDay(day, new Date()) ? "text-clinic-primary" : "text-slate-700"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
              ))}

              {/* Time Rows */}
              {hours.map(hour => (
                <Fragment key={hour}>
                  <div className="border-r border-b border-slate-100 h-20 flex items-start justify-center pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                    </span>
                  </div>
                  {days.map(day => {
                    const slotApps = getAppointmentsForSlot(day, hour);
                    const isCurrentSlot = showTimeIndicator && isSameDay(day, currentTime) && hour === currentHour;
                    
                    return (
                      <div 
                        key={`${day}-${hour}`}
                        onClick={() => {
                          const date = setHours(setMinutes(day, 0), hour);
                          setNewApp({ ...newApp, startTime: format(date, "yyyy-MM-dd'T'HH:mm") });
                          setShowModal(true);
                        }}
                        className={cn(
                          "border-r border-b border-slate-100 h-20 p-1 transition-colors hover:bg-clinic-secondary/5 cursor-pointer relative group",
                          isSameDay(day, new Date()) && "bg-clinic-primary/[0.02]"
                        )}
                      >
                        {isCurrentSlot && (
                          <div 
                            className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                            style={{ top: `${(currentMinute / 60) * 100}%` }}
                          >
                            <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full shadow-sm" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col gap-1 p-1 overflow-hidden z-10">
                          {slotApps.map(app => (
                            <div 
                              key={app.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedApp(app);
                              }}
                              className={cn(
                                "text-[10px] p-1.5 rounded-lg shadow-sm border truncate font-medium hover:brightness-95 transition-all",
                                app.status === 'scheduled' && "bg-blue-50 border-blue-200 text-blue-700",
                                app.status === 'checked_in' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                app.status === 'cancelled' && "bg-red-50 border-red-200 text-red-700",
                                app.status === 'completed' && "bg-slate-50 border-slate-200 text-slate-600"
                              )}
                            >
                              <div className="font-bold">{app.patientName}</div>
                              <div className="opacity-75">{app.type}</div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlusCircle className="w-4 h-4 text-clinic-primary/40" />
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-clinic-card rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-clinic-header text-slate-500 text-xs uppercase font-bold tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-8 py-5">Time</th>
                <th className="px-8 py-5">Patient</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length > 0 ? filteredAppointments.map(app => {
                const patient = patients.find(p => p.id === app.patientId);
                return (
                  <tr key={app.id} className="hover:bg-clinic-secondary/5 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-clinic-bg rounded-lg text-clinic-primary">
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-900">
                          {format(app.startTime.toDate(), 'dd-MM-yyyy, h:mm a')}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{app.patientName}</span>
                        {patient && (
                          <StatusSelect 
                            patientId={patient.id} 
                            currentStatus={patient.status} 
                            canEdit={!!roleData?.canWritePatients} 
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        {app.type}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        app.status === 'scheduled' && "bg-blue-100 text-blue-700",
                        app.status === 'checked_in' && "bg-emerald-100 text-emerald-700",
                        app.status === 'cancelled' && "bg-red-100 text-red-700",
                        app.status === 'completed' && "bg-slate-100 text-slate-600"
                      )}>
                        Appt: {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => setSelectedApp(app)}
                        className="text-clinic-primary font-bold hover:underline flex items-center gap-1 ml-auto"
                      >
                        Manage <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">
                    No appointments scheduled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-clinic-card rounded-[2rem] p-10 max-w-md w-full shadow-2xl border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-clinic-primary"></div>
              <h2 className="text-2xl font-bold mb-2 text-slate-900">Schedule Appointment</h2>
              <p className="text-slate-500 mb-8 text-sm">Fill in the details to book a new patient visit.</p>
              
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Patient</label>
                  <select 
                    required
                    className="w-full p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
                    value={newApp.patientId}
                    onChange={e => setNewApp({...newApp, patientId: e.target.value})}
                  >
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Visit Type</label>
                  <select 
                    required
                    className="w-full p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
                    value={newApp.type}
                    onChange={e => setNewApp({...newApp, type: e.target.value})}
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Lab Work">Lab Work</option>
                    <option value="Surgery">Surgery</option>
                  </select>
                </div>

                <UserFriendlyDateTimeInput 
                  label="Date & Time"
                  required
                  value={newApp.startTime}
                  onChange={val => setNewApp({...newApp, startTime: val})}
                />

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="flex-1 py-3 text-slate-600 font-bold hover:bg-clinic-secondary/20 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-clinic-primary text-white font-bold rounded-xl hover:bg-clinic-primary/90 shadow-lg shadow-clinic-primary/20 transition-all active:scale-95"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-clinic-card rounded-[2rem] p-10 max-w-md w-full shadow-2xl border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-clinic-primary"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedApp.patientName}</h2>
                  <p className="text-clinic-primary font-medium">{selectedApp.type}</p>
                </div>
                <button 
                  onClick={() => setSelectedApp(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 text-slate-600 bg-clinic-bg p-4 rounded-2xl">
                  <Clock className="w-5 h-5 text-clinic-primary" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Scheduled For</p>
                    <p className="font-semibold">{format(selectedApp.startTime.toDate(), 'dd-MM-yyyy')}</p>
                    <p className="text-sm">{format(selectedApp.startTime.toDate(), 'h:mm a')}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Update Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleUpdateStatus(selectedApp.id, 'checked_in')}
                      disabled={selectedApp.status === 'checked_in'}
                      className={cn(
                        "py-2.5 rounded-xl text-sm font-bold transition-all border",
                        selectedApp.status === 'checked_in' 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 opacity-50 cursor-not-allowed" 
                          : "bg-white border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600"
                      )}
                    >
                      Check In
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedApp.id, 'completed')}
                      disabled={selectedApp.status === 'completed'}
                      className={cn(
                        "py-2.5 rounded-xl text-sm font-bold transition-all border",
                        selectedApp.status === 'completed' 
                          ? "bg-slate-50 border-slate-200 text-slate-600 opacity-50 cursor-not-allowed" 
                          : "bg-white border-slate-200 text-slate-700 hover:border-clinic-primary hover:text-clinic-primary"
                      )}
                    >
                      Complete
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedApp.id, 'cancelled')}
                      disabled={selectedApp.status === 'cancelled'}
                      className={cn(
                        "py-2.5 rounded-xl text-sm font-bold transition-all border",
                        selectedApp.status === 'cancelled' 
                          ? "bg-red-50 border-red-200 text-red-700 opacity-50 cursor-not-allowed" 
                          : "bg-white border-slate-200 text-slate-700 hover:border-red-500 hover:text-red-600"
                      )}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleDeleteApp(selectedApp.id)}
                      className="py-2.5 rounded-xl text-sm font-bold transition-all border bg-white border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <Link 
                    to={`/patients/${selectedApp.patientId}/chart`}
                    onClick={() => setSelectedApp(null)}
                    className="flex-1 py-3 bg-clinic-primary text-white font-bold rounded-xl hover:bg-clinic-primary/90 text-center shadow-lg shadow-clinic-primary/20 transition-all active:scale-95"
                  >
                    View Patient Chart
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
