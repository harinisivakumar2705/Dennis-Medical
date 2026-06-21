import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ROLE_MAP, RoleDefinition, UserProfile } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  roleData: RoleDefinition | null;
  loading: boolean;
  isSigningIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleData, setRoleData] = useState<RoleDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userProfile = userDoc.data() as UserProfile;
            setProfile(userProfile);
            setRoleData(ROLE_MAP[userProfile.role] || ROLE_MAP.staff);
          } else {
            // User profile not found, fall back to default staff permissions
            // Note: Auto-creation is handled elsewhere or skipped for simplicity during EOI
            setProfile(null);
            setRoleData(ROLE_MAP.staff);
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
          setProfile(null);
          setRoleData(ROLE_MAP.staff);
        }
      } else {
        // Clear state on logout
        setProfile(null);
        setRoleData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
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
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, roleData, loading, isSigningIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
