import { useState, useEffect, createContext, useContext, ReactNode, Fragment, ChangeEvent } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate,
  useParams
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
  Timestamp,
  getDocFromServer
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
  AlertCircle,
  Pill,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  PlusCircle,
  ArrowRight,
  Trash2,
  MessageSquare,
  Edit2,
  Check,
  X,
  BarChart3,
  CheckCircle2
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
  startOfDay, 
  addHours, 
  isWithinInterval,
  setHours,
  setMinutes
} from 'date-fns';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { cn } from './lib/utils';

// --- Types ---
enum PatientStatus {
  WAITING = 'waiting',
  IN_TRIAGE = 'in triage',
  IN_APPOINTMENT = 'in appointment',
  ADMISSION_PENDING = 'admission pending',
  UNDER_OBSERVATION = 'under observation',
  PENDING_DISCHARGE = 'pending discharge',
  DISCHARGED = 'discharged'
}

const STATUS_OPTIONS = [
  { value: PatientStatus.WAITING, label: 'Waiting', color: 'bg-blue-100 text-blue-700' },
  { value: PatientStatus.IN_TRIAGE, label: 'In Triage', color: 'bg-amber-100 text-amber-700' },
  { value: PatientStatus.IN_APPOINTMENT, label: 'In Appointment', color: 'bg-emerald-100 text-emerald-700' },
  { value: PatientStatus.ADMISSION_PENDING, label: 'Admission Pending', color: 'bg-purple-100 text-purple-700' },
  { value: PatientStatus.UNDER_OBSERVATION, label: 'Under Observation', color: 'bg-indigo-100 text-indigo-700' },
  { value: PatientStatus.PENDING_DISCHARGE, label: 'Pending Discharge', color: 'bg-orange-100 text-orange-700' },
  { value: PatientStatus.DISCHARGED, label: 'Discharged', color: 'bg-slate-100 text-slate-600' },
];

// --- Date Utilities ---
const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
};

const fromDisplayDate = (displayDate: string) => {
  if (!displayDate) return '';
  const [d, m, y] = displayDate.split('-');
  if (!d || !m || !y) return displayDate;
  return `${y}-${m}-${d}`;
};

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

interface PatientChart {
  medicalHistory: string;
  medications: string;
  notes: string;
  allergies: string;
  previousVisitNotes: string;
  identifyingInfo: {
    address: string;
    phone: string;
    emergencyContact: string;
  };
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  nhi: string;
  sex: 'F' | 'M';
  status: PatientStatus;
  room?: string;
  lastUpdated: Timestamp;
  chart?: PatientChart;
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

// --- Components ---

function StatusSelect({ 
  patientId, 
  currentStatus, 
  canEdit 
}: { 
  patientId: string, 
  currentStatus: string, 
  canEdit: boolean 
}) {
  const handleStatusChange = async (newStatus: string) => {
    try {
      await setDoc(doc(db, 'patients', patientId), { 
        status: newStatus,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      await logAction('UPDATE', 'patients', patientId, `Updated status to ${newStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const option = STATUS_OPTIONS.find(o => o.value === currentStatus) || STATUS_OPTIONS[0];

  if (!canEdit) {
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase inline-block", option.color)}>
        {option.label}
      </span>
    );
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleStatusChange(e.target.value)}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-bold uppercase outline-none border-none cursor-pointer transition-all appearance-none text-center min-w-[140px]",
        option.color
      )}
    >
      {STATUS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-white text-slate-900 uppercase font-bold">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function FilterDropdown({ 
  value, 
  onChange, 
  options, 
  label = "Filter by Status" 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { value: string, label: string }[],
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-clinic-primary/20 transition-all"
      >
        <option value="all">All Statuses</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function UserFriendlyDateInput({ 
  value, 
  onChange, 
  label, 
  required = false,
  placeholder = "DD-MM-YYYY"
}: { 
  value: string, 
  onChange: (val: string) => void, 
  label: string, 
  required?: boolean,
  placeholder?: string
}) {
  // value is stored as yyyy-mm-dd
  const displayValue = toDisplayDate(value);

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow typing dd-mm-yyyy
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) {
      onChange(fromDisplayDate(val));
    } else {
      // If not fully formed, we just let them type but don't update the underlying yyyy-mm-dd yet
      // This is a bit tricky with controlled components. 
      // Let's use a local state for the input text.
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative group flex gap-2">
        <input
          required={required}
          type="text"
          placeholder={placeholder}
          className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-clinic-primary outline-none bg-white transition-all"
          value={displayValue}
          onChange={e => {
            const val = e.target.value;
            if (val.length <= 10) {
              // Simple auto-formatting for dd-mm-yyyy
              let formatted = val.replace(/\D/g, '');
              if (formatted.length > 2 && formatted.length <= 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2)}`;
              } else if (formatted.length > 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 4)}-${formatted.slice(4, 8)}`;
              }
              
              if (formatted.match(/^\d{2}-\d{2}-\d{4}$/)) {
                onChange(fromDisplayDate(formatted));
              } else {
                // We need to allow the user to see what they are typing
                // but onChange expects yyyy-mm-dd. 
                // This component might need to be more complex.
                // For now, let's just accept the raw input if it's not a full date.
              }
            }
          }}
        />
        <div className="relative">
          <input
            type="date"
            className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          <div className="h-full px-3 flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 italic">Format: DD-MM-YYYY. Use the icon for easier year selection.</p>
    </div>
  );
}

function UserFriendlyDateTimeInput({ 
  value, 
  onChange, 
  label, 
  required = false 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  label: string, 
  required?: boolean 
}) {
  // value is YYYY-MM-DDTHH:mm
  const [datePart, timePart] = value.split('T');
  const displayDate = toDisplayDate(datePart);

  const handleDateChange = (newIsoDate: string) => {
    onChange(`${newIsoDate}T${timePart || '09:00'}`);
  };

  const handleTimeChange = (newTime: string) => {
    onChange(`${datePart || format(new Date(), 'yyyy-MM-dd')}T${newTime}`);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1 group flex gap-2">
          <input
            required={required}
            type="text"
            placeholder="DD-MM-YYYY"
            className="flex-1 p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
            value={displayDate}
            onChange={e => {
              const val = e.target.value;
              let formatted = val.replace(/\D/g, '');
              if (formatted.length > 2 && formatted.length <= 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2)}`;
              } else if (formatted.length > 4) {
                formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 4)}-${formatted.slice(4, 8)}`;
              }
              if (formatted.match(/^\d{2}-\d{2}-\d{4}$/)) {
                handleDateChange(fromDisplayDate(formatted));
              }
            }}
          />
          <div className="relative">
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
              value={datePart || ''}
              onChange={e => handleDateChange(e.target.value)}
            />
            <div className="h-full px-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="relative w-36 group flex gap-2">
          <input
            required={required}
            type="text"
            placeholder="HH:mm"
            className="flex-1 p-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-clinic-primary/20 outline-none transition-all"
            value={timePart || ''}
            onChange={e => handleTimeChange(e.target.value)}
          />
          <div className="relative">
            <input
              type="time"
              className="absolute inset-0 opacity-0 cursor-pointer w-10 z-10"
              value={timePart || ''}
              onChange={e => handleTimeChange(e.target.value)}
            />
            <div className="h-full px-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 group-hover:text-clinic-primary transition-colors cursor-pointer">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  roleData: RoleDefinition | null;
  loading: boolean;
  signingIn: boolean;
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

async function testConnection() {
  try {
    // Attempt to fetch a non-existent doc from server to verify connectivity
    await getDocFromServer(doc(db, '_internal_', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firestore is offline. Please check your Firebase configuration and internet connection.");
    }
    // Other errors (like permission denied) are expected if the doc doesn't exist or rules are tight, 
    // but they still confirm the client reached the server.
  }
}

async function bootstrapRoles() {
  try {
    for (const role of DEFAULT_ROLES) {
      const roleRef = doc(db, 'roles', role.name);
      const snap = await getDoc(roleRef);
      if (!snap.exists()) {
        await setDoc(roleRef, role);
      }
    }
  } catch (error) {
    console.warn('Role bootstrapping skipped or failed (likely due to permissions):', error);
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
      userEmail: auth.currentUser.email || '',
      action,
      resourceType,
      resourceId,
      details: details || ''
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

async function deleteRecord(collectionName: string, id: string, details: string) {
  try {
    await deleteDoc(doc(db, collectionName, id));
    await logAction('DELETE', collectionName, id, details);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// --- Components ---

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleData, setRoleData] = useState<RoleDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Only bootstrap if we have a user (might still fail if not admin, but safer)
        await bootstrapRoles();
        
        const docRef = doc(db, 'users', u.uid);
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
        }
        
        let currentProfile: UserProfile | null = null;
        if (docSnap?.exists()) {
          currentProfile = docSnap.data() as UserProfile;
        } else {
          try {
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
          } catch (err) {
            console.error('Failed to create user profile:', err);
          }
        }
        setProfile(currentProfile);

        if (currentProfile) {
          // Fetch role permissions
          try {
            const roleRef = doc(db, 'roles', currentProfile.role);
            const roleSnap = await getDoc(roleRef);
            if (roleSnap.exists()) {
              setRoleData(roleSnap.data() as RoleDefinition);
            }
          } catch (err) {
            console.error('Failed to fetch role data:', err);
          }
        }

        await logAction('LOGIN', 'auth', u.uid);
      } else {
        setProfile(null);
        setRoleData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.warn('Sign-in popup was closed or cancelled.');
      } else {
        console.error('Sign-in error:', error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, roleData, loading, signingIn, signIn, logout }}>
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
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
 
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Main page' },
    { path: '/waiting-room', icon: Clock, label: 'Waiting room', permission: 'canReadPatients' },
    { path: '/patients', icon: Users, label: 'Patient lookup', permission: 'canReadPatients' },
    { path: '/appointments', icon: Calendar, label: 'Schedule', permission: 'canSchedule' },
    { path: '/intake', icon: PlusCircle, label: 'Patient Intake', permission: 'canIntake' },
    { path: '/insights', icon: BarChart3, label: 'Insights', permission: 'canManageUsers' },
    { path: '/forms', icon: FileText, label: 'Forms', permission: 'canReadPatients' },
    { 
      path: '/pharmacy', 
      icon: Pill, 
      label: 'Pharmacy Integration',
      restricted: true
    },
    { 
      path: '/labs', 
      icon: FlaskConical, 
      label: 'Lab Integration',
      restricted: true
    },
    { 
      path: '/messaging', 
      icon: MessageSquare, 
      label: 'Staff Messaging',
      restricted: true
    },
  ];

  const canSeeRestricted = profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'nurse';

  return (
    <div className="flex h-screen bg-clinic-bg">
      {/* Sidebar */}
      <aside className={cn(
        "bg-clinic-header border-r border-slate-200 flex flex-col transition-all duration-300 relative",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-clinic-header border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-clinic-primary shadow-sm z-30"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={cn("p-6 border-bottom border-slate-100", isCollapsed && "px-4")}>
          <Link to="/" className="flex items-center gap-2 text-clinic-primary font-bold text-xl overflow-hidden whitespace-nowrap">
            <Activity className="w-8 h-8 shrink-0" />
            {!isCollapsed && <span>Dennis Medical</span>}
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if (item.permission && roleData && !roleData[item.permission as keyof RoleDefinition]) return null;
            if (item.restricted && !canSeeRestricted) return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors overflow-hidden whitespace-nowrap",
                  isActive 
                    ? "bg-clinic-secondary/40 text-clinic-primary font-bold" 
                    : "text-slate-600 hover:bg-clinic-secondary/20 hover:text-slate-900"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium overflow-hidden whitespace-nowrap",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-clinic-header border-b border-slate-200 flex items-center justify-end px-8 relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-12 h-12 rounded-full bg-clinic-secondary/30 flex items-center justify-center text-clinic-primary hover:bg-clinic-secondary/50 transition-colors border-2 border-clinic-primary/20"
          >
            <UserCircle className="w-8 h-8" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUserMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-8 top-16 w-64 bg-clinic-card rounded-xl shadow-xl border border-slate-200 py-2 z-20"
                >
                  <div className="px-4 py-3 border-b border-slate-100 mb-2">
                    <p className="font-bold text-slate-900">{profile?.displayName}</p>
                    <p className="text-xs text-slate-500">{profile?.email}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-clinic-secondary/20 text-clinic-primary text-[10px] font-bold uppercase">
                      {profile?.role.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-clinic-secondary/20"
                  >
                    <Settings className="w-4 h-4" />
                    User Settings
                  </button>
                  {roleData?.canManageUsers && (
                    <button 
                      onClick={() => { navigate('/admin'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-clinic-secondary/20"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </button>
                  )}
                  <hr className="my-2 border-slate-100" />
                  <button 
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </header>

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
                <Route path="/waiting-room" element={<WaitingRoom />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/patients/:id/chart" element={<PatientChartPage />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/intake" element={<Intake />} />
                <Route path="/insights" element={<ProtectedRoute permission="canManageUsers"><Insights /></ProtectedRoute>} />
                <Route path="/forms" element={<Forms />} />
                <Route path="/pharmacy" element={<PharmacyIntegration />} />
                <Route path="/labs" element={<LabIntegration />} />
                <Route path="/messaging" element={<StaffMessaging />} />
                <Route path="/admin" element={<ProtectedRoute permission="canManageUsers"><Admin /></ProtectedRoute>} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// --- Pages ---

function LoginPage() {
  const { signIn, user, loading, signingIn } = useAuth();
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
          onClick={signIn}
          disabled={signingIn}
          className={cn(
            "w-full flex items-center justify-center gap-3 bg-clinic-header border border-slate-300 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm",
            signingIn ? "opacity-50 cursor-not-allowed" : "hover:bg-clinic-secondary/20"
          )}
        >
          {signingIn ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" alt="Google" />
          )}
          {signingIn ? 'Signing in...' : 'Sign in with Google'}
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

function WaitingRoom() {
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
          <p className="text-slate-500">Manage patients currently in the clinic</p>
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
                  <td className="px-6 py-4 text-slate-500 text-sm">{p.lastUpdated ? format(p.lastUpdated.toDate(), 'dd-MM-yyyy HH:mm') : '—'}</td>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
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

function Appointments() {
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
      
      // Sync with patient status for real-time dashboard/waiting room updates
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
                    to={`/patients/${selectedApp.patientId}`}
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

function PatientChartPage() {
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

  const handleSave = async () => {
    if (!id) return;
    try {
      const docRef = doc(db, 'patients', id);
      await setDoc(docRef, { chart: chartData, lastUpdated: serverTimestamp() }, { merge: true });
      await logAction('UPDATE', 'patients', id, 'Updated patient chart information');
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
          <Link to="/patients" className="p-3 bg-clinic-bg rounded-2xl text-clinic-primary hover:bg-clinic-secondary/20 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{patient.lastName}, {patient.firstName}</h1>
            <p className="text-slate-500 font-medium">NHI: {patient.nhi} • Sex: {patient.sex} • DOB: {toDisplayDate(patient.dob)}</p>
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
              value={field.value}
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
              value={chartData.allergies}
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
                value={chartData.medications}
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
              value={chartData.medicalHistory}
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
                value={chartData.previousVisitNotes}
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
              value={chartData.notes}
              onChange={e => setChartData({...chartData, notes: e.target.value})}
              placeholder="Type clinical notes here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { roleData } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('lastName', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });
  }, []);

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
          <p className="text-slate-500">Search and manage patient medical records</p>
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
              <button className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-clinic-secondary/10 rounded-lg transition-colors">
                Edit Info
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-clinic-card rounded-2xl border border-dashed border-slate-200">
            No patients found matching your search and filter criteria.
          </div>
        )}
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
          <div key={form.title} className="bg-clinic-card p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-clinic-primary/30 transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-clinic-secondary/20 text-clinic-primary rounded-xl flex items-center justify-center group-hover:bg-clinic-primary group-hover:text-white transition-colors">
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

function PharmacyIntegration() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Pharmacy Integration</h1>
        <p className="text-slate-500">Manage prescriptions and pharmacy communications</p>
      </header>
      <div className="bg-clinic-card p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
          <Pill className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pharmacy Module</h2>
        <p className="text-slate-500 max-w-md">This module is currently being integrated with external pharmacy networks. Check back soon for e-prescribing features.</p>
      </div>
    </div>
  );
}

function LabIntegration() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Lab Integration</h1>
        <p className="text-slate-500">View lab results and order diagnostic tests</p>
      </header>
      <div className="bg-clinic-card p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-clinic-bg text-slate-400 rounded-full flex items-center justify-center mb-4">
          <FlaskConical className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Laboratory Module</h2>
        <p className="text-slate-500 max-w-md">Real-time lab result tracking and diagnostic ordering will be available here once the LIS integration is complete.</p>
      </div>
    </div>
  );
}

function StaffMessaging() {
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
        <div className="flex bg-clinic-secondary/20 p-1 rounded-xl border border-slate-200">
          {['logs', 'users', 'roles'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                activeTab === tab ? "bg-clinic-card text-clinic-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'logs' && (
        <div className="bg-clinic-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-clinic-header text-slate-500 text-xs uppercase font-bold tracking-wider">
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
                    <td className="px-6 py-4 text-slate-500">{log.timestamp ? format(log.timestamp.toDate(), 'dd-MM-yyyy HH:mm') : '-'}</td>
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
                        log.action === 'LOGIN' && "bg-clinic-secondary/20 text-clinic-primary"
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
              className="bg-clinic-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-clinic-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New User
            </button>
          </div>
          <div className="bg-clinic-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-clinic-header text-slate-500 text-xs uppercase font-bold tracking-wider">
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
                        <span className="px-2 py-1 rounded bg-clinic-secondary/20 text-clinic-primary text-xs font-bold uppercase">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-clinic-bg border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none"
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
                            className="text-clinic-primary hover:text-clinic-primary/80 text-xs font-bold uppercase"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.uid, u.email)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Pending Invites */}
                  {invites.map(invite => (
                    <tr key={invite.id} className="text-sm bg-clinic-bg/50">
                      <td className="px-6 py-4 font-medium text-slate-400 italic">{invite.displayName}</td>
                      <td className="px-6 py-4 text-slate-400 italic">{invite.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Pending Invite</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-clinic-secondary/20 text-slate-500 text-xs font-bold uppercase">
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
              className="bg-clinic-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-clinic-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Role
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map(role => (
              <div key={role.name} className="bg-clinic-card p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-slate-900 uppercase tracking-tight">{role.name.replace('_', ' ')}</h3>
                  {role.isSystem && <span className="text-[10px] bg-clinic-secondary/20 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">System</span>}
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
          <div className="bg-clinic-card rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
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
                      className="w-4 h-4 text-clinic-primary rounded"
                      checked={newRole[perm.key as keyof RoleDefinition] as boolean}
                      onChange={e => setNewRole({...newRole, [perm.key]: e.target.checked})}
                    />
                    <span className="text-sm text-slate-700">{perm.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowRoleModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-clinic-secondary/20 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-clinic-primary text-white font-medium rounded-lg hover:bg-clinic-primary/90">Create Role</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-clinic-card rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
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
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-clinic-secondary/20 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-clinic-primary text-white font-medium rounded-lg hover:bg-clinic-primary/90">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-clinic-card rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6">Edit User Profile</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (Read-only)</label>
                <input 
                  disabled
                  type="email"
                  className="w-full p-2 border rounded-lg bg-clinic-bg text-slate-500"
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
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-clinic-secondary/20 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-clinic-primary text-white font-medium rounded-lg hover:bg-clinic-primary/90">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Insights() {
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clinic Insights</h1>
          <p className="text-slate-500 font-medium">Performance metrics and patient flow analytics</p>
        </div>
        <div className="flex items-center gap-3 bg-clinic-card p-1 rounded-xl border border-slate-200 shadow-sm">
          {(['daily', 'weekly', 'monthly'] as const).map(v => (
            <button 
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all capitalize",
                view === v ? "bg-clinic-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Patients', value: '1,284', trend: '+12%', icon: Users, color: 'text-blue-600' },
          { label: 'Avg Wait Time', value: '14m', trend: '-2m', icon: Clock, color: 'text-amber-600' },
          { label: 'Appt Completion', value: '94%', trend: '+1.2%', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Revenue (NZD)', value: '$12.4k', trend: '+8%', icon: Activity, color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-clinic-card p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-2xl bg-slate-50", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded-lg",
                stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}>
                {stat.trend}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-slate-900">Patient Volume Over Time</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Filter Data</button>
              <button className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Export PDF</button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
            <p className="text-slate-400 italic">Clinic metrics visualization placeholder</p>
          </div>
        </div>

        <div className="bg-clinic-card p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6">
          <h2 className="text-xl font-bold text-slate-900">Management Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Import via CSV', icon: FileText },
              { label: 'Integrate to BI Platform', icon: Activity },
              { label: 'Create New Chart', icon: PlusCircle },
              { label: 'Ask AI for Insights', icon: Activity },
            ].map(btn => (
              <button 
                key={btn.label}
                disabled
                className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-400 cursor-not-allowed group transition-all"
              >
                <btn.icon className="w-5 h-5" />
                <span className="font-bold text-sm">{btn.label}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Display Only</span>
              </button>
            ))}
          </div>
          <div className="mt-auto p-4 bg-clinic-secondary/10 rounded-2xl border border-clinic-secondary/20">
            <p className="text-xs text-clinic-primary font-medium leading-relaxed">
              <strong>Note:</strong> These management tools are currently in development and will be available in the next system update.
            </p>
          </div>
        </div>
      </div>
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

        <section className="pt-8 border-t border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">System Preferences</h2>
          <div className="flex items-center justify-between p-4 bg-clinic-bg rounded-xl">
            <div>
              <p className="font-medium text-slate-900">Dark Mode</p>
              <p className="text-sm text-slate-500">Adjust the interface for low light</p>
            </div>
            <div className="w-12 h-6 bg-clinic-secondary/20 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-clinic-card rounded-full" />
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
