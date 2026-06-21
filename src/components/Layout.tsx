import { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  Calendar, 
  PlusCircle, 
  BarChart3, 
  FileText, 
  Pill, 
  FlaskConical, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  LogOut, 
  UserCircle, 
  Settings, 
  ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { cn } from '../lib/utils';
import { RoleDefinition } from '../types';

// Importing route-level pages
import { Dashboard } from '../pages/Dashboard';
import { WaitingRoom } from '../pages/WaitingRoom';
import { Patients } from '../pages/Patients';
import { PatientChartPage } from '../pages/PatientChartPage';
import { Appointments } from '../pages/Appointments';
import { Intake } from '../pages/Intake';
import { Insights } from '../pages/Insights';
import { Forms } from '../pages/Forms';
import { PharmacyIntegration } from '../pages/PharmacyIntegration';
import { LabIntegration } from '../pages/LabIntegration';
import { StaffMessaging } from '../pages/StaffMessaging';
// import { Admin } from '../pages/Admin';
import { SettingsPage } from '../pages/SettingsPage';

export function Layout() {
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
      label: 'Pharmacy Integration'
    },
    { 
      path: '/labs', 
      icon: FlaskConical, 
      label: 'Lab Integration'
    },
    { 
      path: '/messaging', 
      icon: MessageSquare, 
      label: 'Staff Messaging'
    },
  ];

  const canSeeRestricted = profile?.role === 'admin' || profile?.role === 'clinician';

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
        <header className="h-20 bg-clinic-header border-b border-slate-200 flex items-center justify-end px-8 relative animate-none">
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
                      {profile?.role ? profile.role.replace('_', ' ') : ''}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-clinic-secondary/20"
                  >
                    <Settings className="w-4 h-4" />
                    User Settings
                  </button>
                  {/* Temporarily disabled Admin navigation item
                  roleData?.canManageUsers && (
                    <button 
                      onClick={() => { navigate('/admin'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-clinic-secondary/20"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </button>
                  )*/}
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
                {/* Temporarily disabled Admin route
                <Route path="/admin" element={<ProtectedRoute permission="canManageUsers"><Admin /></ProtectedRoute>} />
                */}
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
