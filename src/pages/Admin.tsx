import { useState, useEffect } from 'react';
import { onSnapshot, query, collection, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { logAction } from '../services/audit';
import { AuditLog, UserProfile } from '../types';
import { cn } from '../lib/utils';

export function Admin() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'users'>('logs');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribeLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), orderBy('email', 'asc')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
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
          <p className="text-slate-500 font-medium">Manage system users, roles, and view audit trails</p>
        </div>
        <div className="flex bg-clinic-secondary/20 p-1 rounded-xl border border-slate-200">
          {['logs', 'users'].map((tab) => (
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
                    <td className="px-6 py-4 text-slate-500">
                      {log.timestamp ? format(log.timestamp.toDate(), 'dd-MM-yyyy HH:mm') : '-'}
                    </td>
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
                  {users.map(u => (
                    <tr key={u.uid} className="text-sm">
                      <td className="px-6 py-4 font-medium text-slate-900">{u.displayName}</td>
                      <td className="px-6 py-4 text-slate-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">Active</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-clinic-secondary/20 text-clinic-primary text-xs font-bold uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-clinic-bg border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="clinician">Clinician</option>
                          <option value="staff">Staff</option>
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
                </tbody>
              </table>
            </div>
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
                  <option value="admin">Admin</option>
                  <option value="clinician">Clinician</option>
                  <option value="staff">Staff</option>
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
