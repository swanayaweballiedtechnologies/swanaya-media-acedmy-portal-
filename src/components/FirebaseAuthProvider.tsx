import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { academyService } from '../services/academyService';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isStudent: false,
});

export const useAuth = () => useContext(AuthContext);

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensure persistence is set to browser local
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // First check/initialize profile
        const userProfile = await academyService.getUserProfile(firebaseUser.uid);
        
        if (!userProfile) {
          const isMD = firebaseUser.email === 'aadithyan@swanayamedia.com' || firebaseUser.displayName?.includes('AADITHYAN');
          const newProfile = {
            id: firebaseUser.uid,
            name: isMD ? 'AADITHYAN M MENON' : (firebaseUser.displayName || 'New User'),
            email: firebaseUser.email,
            role: isMD ? 'MD' : 'STUDENT',
            avatarUrl: isMD ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aadithyan&mood[]=happy' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            status: 'ACTIVE'
          };
          await academyService.createUserProfile(firebaseUser.uid, newProfile);
        } else if (firebaseUser.email === 'aadithyan@swanayamedia.com' || firebaseUser.displayName?.includes('AADITHYAN')) {
           // Ensure requested naming is preserved
           if (userProfile.name !== 'AADITHYAN M MENON') {
             await academyService.createUserProfile(firebaseUser.uid, { ...userProfile, name: 'AADITHYAN M MENON', role: 'MD' });
           }
        }

        // Set up real-time listener for multi-device profile sync
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data());
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile sync error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'MD' || profile?.role === 'ADMIN' || profile?.role === 'ACADEMIC_ADMIN';
  const isStudent = profile?.role === 'STUDENT';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
};
