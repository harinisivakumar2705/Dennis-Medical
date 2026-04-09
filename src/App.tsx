import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  UserCircle, 
  Settings, 
  LogOut, 
  Plus, 
  Search,
  Activity,
  ShieldCheck,
  FileText,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { cn } from './lib/utils';

// --- Types ---
interface RoleDefinition {
  name: string;
  canReadPatients: boolean;
  canWritePatients: boolean;
  canIntake: boolean;
  canManageUsers: boolean;
  canSchedule: boolean;
  isSystem: boolean;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string; // References RoleDefinition.name
  createdAt: Timestamp;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  startTime: Timestamp;
  type: string;
  status: 'scheduled' | 'checked_in' | 'cancelled' | 'completed';
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  mrn: string;
  status: 'waiting' | 'triage' | 'with_doctor' | 'discharged';
  room?: string;
  lastUpdated: Timestamp;
}

interface AuditLog {
  id: string;
  timestamp: Timestamp;
  userUid: string;
  userEmail: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'INVITE' | 'INVITE_ACCEPTED';
  resourceType: string;
  resourceId: string;
  details?: string;
}

// --- Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  roleData: RoleDefinition | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// --- Bootstrap Defaults ---
const DEFAULT_ROLES: RoleDefinition[] = [
  { name: 'admin', canReadPatients: true, canWritePatients: true, canIntake: true, canManageUsers: true, canSchedule: true, isSystem: true },
  { name: 'doctor', canReadPatients: true, canWritePatients: true, canIntake: true, canManageUsers: false, canSchedule: true, isSystem: true },
  { name: 'nurse', canReadPatients: true, canWritePatients: true, canIntake: true, canManageUsers: false, canSchedule: true, isSystem: true },
  { name: 'cna', canReadPatients: true, canWritePatients: false, canIntake: false, canManageUsers: false, canSchedule: false, isSystem: true },
  { name: 'front_desk', canReadPatients: true, canWritePatients: false, canIntake: true, canManageUsers: false, canSchedule: true, isSystem: true },
];

async function bootstrapRoles() {
  for (const role of DEFAULT_ROLES) {
    const roleRef = doc(db, 'roles', role.name);
    const snap = await getDoc(roleRef);
    if (!snap.exists()) {
      await setDoc(roleRef, role);
    }
  }
}

// --- Audit Logger ---
async function logAction(
  action: AuditLog['action'],
  resourceType: string,
  resourceId: string,
  details?: string
) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      timestamp: serverTimestamp(),
      userUid: auth.currentUser.uid,
      userEmail: auth.currentUser.email,
      action,
      resourceType,
      resourceId,
      details
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

// --- Components ---

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleData, setRoleData] = useState<RoleDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapRoles();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        
        let currentProfile: UserProfile;
        if (docSnap.exists()) {
          currentProfile = docSnap.data() as UserProfile;
        } else {
          // Check for invitation
          const inviteRef = doc(db, 'user_invites', u.email || '');
          const inviteSnap = await getDoc(inviteRef);
          
          const isFirstAdmin = u.email === 'harinisivakumar2705@gmail.com';
          let assignedRole = isFirstAdmin ? 'admin' : 'cna';
          let assignedName = u.displayName || '';

          if (inviteSnap.exists()) {
            const inviteData = inviteSnap.data();
            assignedRole = inviteData.role;
            assignedName = inviteData.displayName || assignedName;
            await deleteDoc(inviteRef); // Consume the invite
            await logAction('INVITE_ACCEPTED', 'user_invites', u.email || '', `User joined with pre-assigned role: ${assignedRole}`);
          }

          currentProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: assignedName,
            role: assignedRole,
            createdAt: Timestamp.now()
          };
          await setDoc(docRef, currentProfile);
          await logAction('CREATE', 'users', u.uid, `Auto-created user profile with role: ${assignedRole}`);
        }
        setProfile(currentProfile);

        // Fetch role permissions
        const roleRef = doc(db, 'roles', currentProfile.role);
        const roleSnap = await getDoc(roleRef);
        if (roleSnap.exists()) {
          setRoleData(roleSnap.data() as RoleDefinition);
        }

        await logAction('LOGIN', 'auth', u.uid);
      } else {
        setProfile(null);
        setRoleData(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, roleData, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, permission }: { children: ReactNode, permission?: keyof RoleDefinition }) {
  const { user, roleData, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permission && roleData && !roleData[permission]) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function Layout() {
  const { profile, roleData, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/patients', icon: Users, label: 'Patients', permission: 'canReadPatients' },
    { path: '/appointments', icon: ClipboardList, label: 'Schedule', permission: 'canSchedule' },
    { path: '/intake', icon: Plus, label: 'Intake', permission: 'canIntake' },
    { path: '/forms', icon: FileText, label: 'Forms', permission: 'canReadPatients' },
    { path: '/admin', icon: ShieldCheck, label: 'Admin', permission: 'canManageUsers' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <Activity className="w-8 h-8" />
            <span>OBGYN EHR</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            if (item.permission && roleData && !roleData[item.permission as keyof RoleDefinition]) return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700 font-medium" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <UserCircle className="w-10 h-10 text-slate-400" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">{profile?.displayName}</p>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{profile?.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/intake" element={<Intake />} />
              <Route path="/forms" element={<Forms />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Pages ---

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Medical Staff Portal</h1>
          <p className="text-slate-500 mt-2">Sign in to access the EHR platform</p>
        </div>

        <button
          onClick={signIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-medium py-3 px-4 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" alt="Google" />
          Sign in with Google
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

function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('lastUpdated', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'patients'));
  }, []);

  const stats = {
    waiting: patients.filter(p => p.status === 'waiting').length,
    triage: patients.filter(p => p.status === 'triage').length,
    withDoctor: patients.filter(p => p.status === 'with_doctor').length,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Floor Status Dashboard</h1>
        <p className="text-slate-500">Real-time overview of current patient flow</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'In Waiting Room', value: stats.waiting, color: 'bg-blue-500' },
          { label: 'In Triage', value: stats.triage, color: 'bg-amber-500' },
          { label: 'With Doctor', value: stats.withDoctor, color: 'bg-emerald-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <span className="text-4xl font-bold text-slate-900">{stat.value}</span>
              <div className={cn("w-12 h-1.5 rounded-full", stat.color)} />
            </div>
          </div>
        ))}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-900">Active Patients</h2>
          <Link to="/patients" className="text-sm text-indigo-600 font-medium hover:underline">View All</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">MRN</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Room</th>
                <th className="px-6 py-4">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.filter(p => p.status !== 'discharged').map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{p.firstName} {p.lastName}</td>
                  <td className="px-6 py-4 text-slate-500">{p.mrn}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase",
                      p.status === 'waiting' && "bg-blue-100 text-blue-700",
                      p.status === 'triage' && "bg-amber-100 text-amber-700",
                      p.status === 'with_doctor' && "bg-emerald-100 text-emerald-700"
                    )}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">{p.room || '-'}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {p.lastUpdated?.toDate().toLocaleTimeString()}
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No active patients</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showModal, setShowModal] = useState(false);
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
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-500">Manage patient scheduling and check-ins</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Visit
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.map(app => (
              <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">
                  {app.startTime?.toDate().toLocaleString()}
                </td>
                <td className="px-6 py-4 text-slate-900">{app.patientName}</td>
                <td className="px-6 py-4 text-slate-500">{app.type}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                    app.status === 'scheduled' && "bg-blue-100 text-blue-700",
                    app.status === 'checked_in' && "bg-emerald-100 text-emerald-700",
                    app.status === 'cancelled' && "bg-red-100 text-red-700"
                  )}>
                    {app.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-sm text-indigo-600 font-medium hover:underline">Check In</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Schedule Appointment</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Patient</label>
                <select 
                  required
                  className="w-full p-2 border rounded-lg"
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
                <label className="text-sm font-medium">Date & Time</label>
                <input 
                  required
                  type="datetime-local"
                  className="w-full p-2 border rounded-lg"
                  value={newApp.startTime}
                  onChange={e => setNewApp({...newApp, startTime: e.target.value})}
                />
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('lastName', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });
  }, []);

  const filtered = patients.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn.includes(search)
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Patient Directory</h1>
          <p className="text-slate-500">Manage and view patient medical records</p>
        </div>
        <Link to="/intake" className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Patient
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name or MRN..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{p.lastName}, {p.firstName}</h3>
                <p className="text-sm text-slate-500">MRN: {p.mrn}</p>
              </div>
              <span className={cn(
                "px-2 py-1 rounded text-[10px] font-bold uppercase",
                p.status === 'discharged' ? "bg-slate-100 text-slate-600" : "bg-indigo-100 text-indigo-700"
              )}>
                {p.status}
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p>DOB: {p.dob}</p>
              <p>Room: {p.room || 'N/A'}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
              <button className="flex-1 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                View Charts
              </button>
              <button className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                Edit Info
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Intake() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    mrn: '',
    status: 'waiting' as Patient['status'],
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
      navigate('/patients');
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

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">First Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.firstName}
              onChange={e => setFormData({...formData, firstName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Last Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.lastName}
              onChange={e => setFormData({...formData, lastName: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Date of Birth</label>
            <input
              required
              type="date"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.dob}
              onChange={e => setFormData({...formData, dob: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">MRN</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.mrn}
              onChange={e => setFormData({...formData, mrn: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Initial Status</label>
            <select
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as any})}
            >
              <option value="waiting">Waiting Room</option>
              <option value="triage">Triage</option>
              <option value="with_doctor">With Doctor</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Assigned Room</label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.room}
              onChange={e => setFormData({...formData, room: e.target.value})}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          Complete Intake
        </button>
      </form>
    </div>
  );
}

function Forms() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Medical Forms</h1>
        <p className="text-slate-500">Access and fill out clinical documentation</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: 'Initial Prenatal Visit', type: 'Clinical' },
          { title: 'Postpartum Follow-up', type: 'Clinical' },
          { title: 'Gyn Annual Exam', type: 'Clinical' },
          { title: 'Consent for Procedure', type: 'Legal' },
        ].map(form => (
          <div key={form.title} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-300 transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{form.title}</h3>
                <p className="text-sm text-slate-500">{form.type}</p>
              </div>
            </div>
            <Plus className="w-5 h-5 text-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Admin() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'roles'>('logs');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', role: 'cna' });
  const [newRole, setNewRole] = useState<RoleDefinition>({
    name: '',
    canReadPatients: false,
    canWritePatients: false,
    canIntake: false,
    canManageUsers: false,
    canSchedule: false,
    isSystem: false
  });

  useEffect(() => {
    const unsubscribeLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), orderBy('email', 'asc')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    const unsubscribeRoles = onSnapshot(query(collection(db, 'roles'), orderBy('name', 'asc')), (snapshot) => {
      setRoles(snapshot.docs.map(doc => doc.data() as RoleDefinition));
    });

    const unsubscribeInvites = onSnapshot(query(collection(db, 'user_invites'), orderBy('email', 'asc')), (snapshot) => {
      setInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
      unsubscribeRoles();
      unsubscribeInvites();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRoleName: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { role: newRoleName }, { merge: true });
      await logAction('UPDATE', 'users', userId, `Role updated to ${newRoleName}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleCreateRole = async (e: any) => {
    e.preventDefault();
    if (!newRole.name) return;
    try {
      const roleId = newRole.name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'roles', roleId), {
        ...newRole,
        name: roleId
      });
      await logAction('CREATE', 'roles', roleId, 'Created new custom role');
      setShowRoleModal(false);
      setNewRole({
        name: '',
        canReadPatients: false,
        canWritePatients: false,
        canIntake: false,
        canManageUsers: false,
        canSchedule: false,
        isSystem: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'roles');
    }
  };

  const handleInviteUser = async (e: any) => {
    e.preventDefault();
    if (!newUser.email) return;
    try {
      await setDoc(doc(db, 'user_invites', newUser.email), {
        ...newUser,
        createdAt: Timestamp.now()
      });
      await logAction('INVITE', 'user_invites', newUser.email, `Invited user with role: ${newUser.role}`);
      setShowUserModal(false);
      setNewUser({ email: '', displayName: '', role: 'cna' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'user_invites');
    }
  };

  const handleCancelInvite = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'user_invites', email));
      await logAction('DELETE', 'user_invites', email, 'Cancelled user invitation');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `user_invites/${email}`);
    }
  };

  const handleUpdateUser = async (e: any) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.uid);
      await setDoc(userRef, { 
        displayName: editingUser.displayName,
        role: editingUser.role 
      }, { merge: true });
      await logAction('UPDATE', 'users', editingUser.uid, `Updated user profile: ${editingUser.displayName} (${editingUser.role})`);
      setEditingUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUser.uid}`);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${email}? This will remove their profile and access.`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      await logAction('DELETE', 'users', userId, `Deleted user profile for ${email}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-500">Manage system users, roles, and view audit trails</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {['logs', 'users', 'roles'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                activeTab === tab ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Resource</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="text-sm">
                    <td className="px-6 py-4 text-slate-500">{log.timestamp?.toDate().toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{log.userEmail}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{log.userUid}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        log.action === 'CREATE' && "bg-emerald-100 text-emerald-700",
                        log.action === 'UPDATE' && "bg-blue-100 text-blue-700",
                        log.action === 'DELETE' && "bg-red-100 text-red-700",
                        log.action === 'LOGIN' && "bg-indigo-100 text-indigo-700"
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{log.resourceType} ({log.resourceId})</td>
                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{log.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowUserModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New User
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Current Role</th>
                    <th className="px-6 py-4">Assign Role</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Active Users */}
                  {users.map(u => (
                    <tr key={u.uid} className="text-sm">
                      <td className="px-6 py-4 font-medium text-slate-900">{u.displayName}</td>
                      <td className="px-6 py-4 text-slate-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Active</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold uppercase">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                        >
                          {roles.map(r => (
                            <option key={r.name} value={r.name}>{r.name.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setEditingUser(u)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold uppercase"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.uid, u.email)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete User"
                          >
                            <LogOut className="w-4 h-4 rotate-180" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Pending Invites */}
                  {invites.map(invite => (
                    <tr key={invite.id} className="text-sm bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-400 italic">{invite.displayName}</td>
                      <td className="px-6 py-4 text-slate-400 italic">{invite.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Pending Invite</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold uppercase">
                          {invite.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-400 italic">Role pre-assigned</p>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleCancelInvite(invite.email)}
                          className="text-red-600 hover:text-red-700 text-xs font-bold uppercase"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowRoleModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Role
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map(role => (
              <div key={role.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-slate-900 uppercase tracking-tight">{role.name.replace('_', ' ')}</h3>
                  {role.isSystem && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">System</span>}
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'canReadPatients', label: 'Read Patients' },
                    { key: 'canWritePatients', label: 'Write Patients' },
                    { key: 'canIntake', label: 'Intake/Check-in' },
                    { key: 'canSchedule', label: 'Scheduling' },
                    { key: 'canManageUsers', label: 'Admin Access' },
                  ].map(perm => (
                    <div key={perm.key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{perm.label}</span>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        role[perm.key as keyof RoleDefinition] ? "bg-emerald-500" : "bg-slate-200"
                      )} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Create New Role</h2>
            <form onSubmit={handleCreateRole} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role Name</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. Receptionist"
                  className="w-full p-2 border rounded-lg"
                  value={newRole.name}
                  onChange={e => setNewRole({...newRole, name: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-400 uppercase">Permissions</p>
                {[
                  { key: 'canReadPatients', label: 'Can Read Patients' },
                  { key: 'canWritePatients', label: 'Can Write Patients' },
                  { key: 'canIntake', label: 'Can Intake/Check-in' },
                  { key: 'canSchedule', label: 'Can Schedule' },
                  { key: 'canManageUsers', label: 'Can Manage Users (Admin)' },
                ].map(perm => (
                  <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 text-indigo-600 rounded"
                      checked={newRole[perm.key as keyof RoleDefinition] as boolean}
                      onChange={e => setNewRole({...newRole, [perm.key]: e.target.checked})}
                    />
                    <span className="text-sm text-slate-700">{perm.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowRoleModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Invite New User</h2>
            <p className="text-sm text-slate-500 mb-6">This will pre-assign a role and name to the user. They will be automatically configured when they first sign in with this email.</p>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input 
                  required
                  type="email"
                  placeholder="user@example.com"
                  className="w-full p-2 border rounded-lg"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name (Optional)</label>
                <input 
                  type="text"
                  placeholder="John Doe"
                  className="w-full p-2 border rounded-lg"
                  value={newUser.displayName}
                  onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Role</label>
                <select 
                  required
                  className="w-full p-2 border rounded-lg"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  {roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-6">Edit User Profile</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (Read-only)</label>
                <input 
                  disabled
                  type="email"
                  className="w-full p-2 border rounded-lg bg-slate-50 text-slate-500"
                  value={editingUser.email}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <input 
                  required
                  type="text"
                  className="w-full p-2 border rounded-lg"
                  value={editingUser.displayName}
                  onChange={e => setEditingUser({...editingUser, displayName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Role</label>
                <select 
                  required
                  className="w-full p-2 border rounded-lg"
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                >
                  {roles.map(r => (
                    <option key={r.name} value={r.name}>{r.name.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account and preferences</p>
      </header>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
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
              <p className="text-indigo-600 font-bold uppercase">{profile?.role}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Account Created</p>
              <p className="text-slate-900">{profile?.createdAt?.toDate().toLocaleDateString()}</p>
            </div>
          </div>
        </section>

        <section className="pt-8 border-t border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">System Preferences</h2>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Dark Mode</p>
              <p className="text-sm text-slate-500">Adjust the interface for low light</p>
            </div>
            <div className="w-12 h-6 bg-slate-200 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
