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
        const lowerEmail = String(firebaseUser.email || '').trim().toLowerCase();
        const isAuthorizedAdminEmail =
          lowerEmail === 'swanayamediaenterprisesadmins@gmail.com' ||
          lowerEmail === 'swanyamediaenterprisesadmins@gmail.com' ||
          lowerEmail === 'aadithyan@swanayamedia.com' ||
          lowerEmail === 'aadithyan.menon@swanayamedia.com' ||
          lowerEmail === 'aadithyanmmenon@gmail.com';
        const isMD =
          isAuthorizedAdminEmail ||
          Boolean(firebaseUser.displayName?.toUpperCase().includes('AADITHYAN'));

        // Guard unverified email/password Firebase sign-ups from entering portal before verification
        const isPasswordProvider = firebaseUser.providerData?.some((p) => p.providerId === 'password');
        if (isPasswordProvider && !firebaseUser.emailVerified && !isMD) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // First check/initialize profile, existing username profile, and any MD-issued AdminGrant
        const [userProfile, matchedExisting] = await Promise.all([
          academyService.getUserProfile(firebaseUser.uid),
          lowerEmail ? academyService.lookupUserForLogin(lowerEmail).catch(() => null) : Promise.resolve(null),
        ]);
        const activeGrant = !isMD
          ? await academyService.findActiveAdminGrantByEmail(lowerEmail)
          : null;
        const linkedUsername = matchedExisting?.user?.username;
        const resolvedCourseFromExisting =
          matchedExisting?.user?.courseId ||
          matchedExisting?.user?.preferredCourseId ||
          matchedExisting?.student?.courseId;

        if (!userProfile) {
          const resolvedRole = isMD
            ? 'MD'
            : activeGrant
            ? activeGrant.role
            : (matchedExisting?.user?.role as string) || 'STUDENT';
          const newProfile = {
            id: firebaseUser.uid,
            ...(isMD
              ? { username: 'aadithyan', designation: 'Managing Director' }
              : linkedUsername
              ? { username: linkedUsername }
              : {}),
            name: isMD
              ? 'AADITHYAN M MENON'
              : (activeGrant?.name || matchedExisting?.user?.name || firebaseUser.displayName || 'New User'),
            email: firebaseUser.email,
            role: resolvedRole,
            isVerified: true,
            email_verified: true,
            ...(isMD ? { adminAcceptanceStatus: 'ACCEPTED' } : {}),
            ...(activeGrant ? { grantId: activeGrant.id } : {}),
            ...(resolvedCourseFromExisting ? { courseId: resolvedCourseFromExisting, preferredCourseId: resolvedCourseFromExisting } : {}),
            avatarUrl: isMD
              ? 'https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon'
              : matchedExisting?.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
            status: 'ACTIVE'
          };
          await academyService.createUserProfile(firebaseUser.uid, newProfile);
        } else if (isMD) {
          const currentRole = String(userProfile.role || '').toUpperCase();
          const needsMdNormalize =
            !['SUPER_ADMIN', 'MD'].includes(currentRole) ||
            userProfile.username !== 'aadithyan' ||
            userProfile.designation !== 'Managing Director' ||
            userProfile.name !== 'AADITHYAN M MENON' ||
            userProfile.status !== 'ACTIVE';
          if (needsMdNormalize) {
            await academyService.updateUserProfile(firebaseUser.uid, {
              ...userProfile,
              id: firebaseUser.uid,
              username: 'aadithyan',
              name: 'AADITHYAN M MENON',
              designation: 'Managing Director',
              email: userProfile.email || firebaseUser.email,
              role: 'MD',
              status: 'ACTIVE',
              isVerified: true,
              email_verified: true,
              adminAcceptanceStatus: 'ACCEPTED',
            });
          }
        } else if (activeGrant && userProfile.status !== 'INACTIVE') {
          const currentRole = String(userProfile.role || '').toUpperCase();
          if (currentRole !== activeGrant.role || userProfile.grantId !== activeGrant.id) {
            await academyService.updateUserProfile(firebaseUser.uid, {
              ...userProfile,
              id: firebaseUser.uid,
              role: activeGrant.role,
              grantId: activeGrant.id,
              status: 'ACTIVE',
              ...(linkedUsername && !userProfile.username ? { username: linkedUsername } : {}),
            });
          }
        } else if (linkedUsername && !userProfile.username) {
          await academyService.updateUserProfile(firebaseUser.uid, {
            ...userProfile,
            id: firebaseUser.uid,
            username: linkedUsername,
          });
        }

        // Sync Firebase verified session with backend HttpOnly session cookie
        if (lowerEmail && (firebaseUser.emailVerified || isMD)) {
          academyService
            .establishFirebaseBackendSession({
              userId: firebaseUser.uid,
              email: lowerEmail,
              role: isMD ? 'MD' : (activeGrant?.role || userProfile?.role || matchedExisting?.user?.role || 'STUDENT'),
              emailVerified: true,
              displayName: firebaseUser.displayName || undefined,
            })
            .catch(() => {});
        }

        // Set up real-time listener for multi-device profile sync
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const rawData = snapshot.data();
            const data = isMD
              ? {
                  ...rawData,
                  id: firebaseUser.uid,
                  username: 'aadithyan',
                  name: 'AADITHYAN M MENON',
                  designation: 'Managing Director',
                  role: 'MD',
                  status: 'ACTIVE',
                  isVerified: true,
                  email_verified: true,
                  adminAcceptanceStatus: 'ACCEPTED',
                }
              : rawData;
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
                const resolvedCourseId =
                  data.courseId ||
                  data.preferredCourseId ||
                  (Array.isArray(data.enrolledCourseIds) && data.enrolledCourseIds[0]) ||
                  currentStudents[sIdx]?.courseId ||
                  '';

                if (sIdx < 0) {
                  const newStudent: Student = {
                    id: `s-${data.id}`,
                    studentId: data.studentId || `SMA-2026-${data.id.slice(-4).toUpperCase()}`,
                    admissionNumber: `ADM-2026-${data.id.slice(-4).toUpperCase()}`,
                    userId: data.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone || '',
                    guardianName: data.guardianName || 'Parent / Guardian',
                    guardianPhone: data.guardianPhone || '',
                    academicBackground: data.academicBackground || 'Enrolled Scholar',
                    avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name)}`,
                    status: data.status || 'ACTIVE',
                    courseId: resolvedCourseId,
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
                    guardianName: data.guardianName || currentStudents[sIdx].guardianName,
                    guardianPhone: data.guardianPhone || currentStudents[sIdx].guardianPhone,
                    academicBackground: data.academicBackground || currentStudents[sIdx].academicBackground,
                    courseId: resolvedCourseId || currentStudents[sIdx].courseId,
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
