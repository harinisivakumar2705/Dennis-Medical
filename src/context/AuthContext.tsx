import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
  getDocFromServer,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ROLE_MAP, RoleDefinition, UserProfile } from '../types';
import { logAction } from '../services/audit';

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_internal_', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firestore is offline. Please check your Firebase configuration and internet connection.");
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
            const isFirstAdmin = u.email === 'harinisivakumar2705@gmail.com';
            let assignedRole = isFirstAdmin ? 'admin' : 'staff';
            let assignedName = u.displayName || '';

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
          const matchedRole = ROLE_MAP[currentProfile.role] || ROLE_MAP.staff;
          setRoleData(matchedRole);
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
