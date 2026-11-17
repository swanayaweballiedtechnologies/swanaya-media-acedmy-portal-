import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { academyService } from '../services/academyService';
import { SwanayaDatabase, User, Student } from '../db/mockDb';

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
            const data = snapshot.data();
            setProfile(data);

            // Hydrate into SwanayaDatabase so local components always have the user
            try {
              const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
              const uIdx = currentUsers.findIndex(u => u.id === data.id || (data.email && u.email?.toLowerCase() === data.email.toLowerCase()));
              if (uIdx >= 0) {
                currentUsers[uIdx] = { ...currentUsers[uIdx], ...data };
              } else {
                currentUsers.push(data as User);
              }
              SwanayaDatabase.set('users', currentUsers);

              if (data.role === 'STUDENT' || data.role === 'ALUMNI') {
                const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
                const sIdx = currentStudents.findIndex(s => s.userId === data.id || (data.email && s.email.toLowerCase() === data.email.toLowerCase()));
                if (sIdx < 0) {
                  const newStudent: Student = {
                    id: `s-${data.id}`,
                    studentId: data.studentId || `SMA-2026-${data.id.slice(-4).toUpperCase()}`,
                    admissionNumber: `ADM-2026-${data.id.slice(-4).toUpperCase()}`,
                    userId: data.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone || '+91 94460 00000',
                    whatsappPhone: data.whatsappPhone || data.phone || '+91 94460 00000',
                    whatsappOptIn: data.whatsappOptIn ?? true,
                    guardianName: data.guardianName || 'Parent / Guardian',
                    guardianPhone: data.guardianPhone || '+91 94460 00000',
                    academicBackground: data.academicBackground || 'Enrolled Scholar',
                    avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
                    status: data.status || 'ACTIVE',
                    courseId: data.preferredCourseId || 'c-1',
                    batchId: 'b-1',
                    semesterId: 's-1-1',
                    enrollmentDate: data.createdAt || new Date().toISOString().split('T')[0],
                    skills: data.skills || ['Media Science'],
                    projectsCount: 0,
                    certificatesCount: 0,
                    attendancePercentage: 100,
                    outstandingBalance: 0,
                    careerReadinessScore: 50
                  };
                  SwanayaDatabase.set('students', [...currentStudents, newStudent]);
                } else {
                  currentStudents[sIdx] = {
                    ...currentStudents[sIdx],
                    name: data.name || currentStudents[sIdx].name,
                    avatarUrl: data.avatarUrl || currentStudents[sIdx].avatarUrl,
                    phone: data.phone || currentStudents[sIdx].phone,
                    whatsappPhone: data.whatsappPhone || currentStudents[sIdx].whatsappPhone,
                    guardianName: data.guardianName || currentStudents[sIdx].guardianName,
                    guardianPhone: data.guardianPhone || currentStudents[sIdx].guardianPhone,
                    academicBackground: data.academicBackground || currentStudents[sIdx].academicBackground,
                    skills: data.skills || currentStudents[sIdx].skills
                  };
                  SwanayaDatabase.set('students', currentStudents);
                }
              }
            } catch (err: any) {
              console.warn('Local database hydration note:', err.message);
            }
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

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'MD' || profile?.role === 'PRINCIPAL' || profile?.role === 'ADMIN' || profile?.role === 'ACADEMIC_ADMIN';
  const isStudent = profile?.role === 'STUDENT';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
};
