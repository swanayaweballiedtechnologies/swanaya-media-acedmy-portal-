/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  SwanayaDatabase, User, Student, Course, Batch, Instructor, Invoice, 
  Lead, AdmissionApplication, Notification, AuditLog, AcademySettings, Project, ClassSchedule, Semester, Subject, FrontPageConfig 
} from './db/mockDb';
import { applyDocumentFavicon } from './utils/favicon';

import PublicLanding from './components/PublicLanding';
import RoleSwitcher from './components/RoleSwitcher';
import StudentPortfolioPublic from './components/StudentPortfolioPublic';
import AuthGateway from './components/AuthGateway';
import LibraryPortal from './components/LibraryPortal';
import CourseRegistrationPortal from './components/CourseRegistrationPortal';
import CourseSelectionPage from './components/CourseSelectionPage';
import CourseVerificationPortal from './components/CourseVerificationPortal';

import AdminPortal from './components/AdminPortal';
import InstructorPortal from './components/InstructorPortal';
import StudentPortal from './components/StudentPortal';
import FinancePortal from './components/FinancePortal';
import CounsellorPortal from './components/CounsellorPortal';
import CareerPortal from './components/CareerPortal';
import ParentPortal from './components/ParentPortal';
import SettingsAuditPortal from './components/SettingsAuditPortal';
import AcademyFloatingMascotChat from './components/AcademyFloatingMascotChat';
import FloatingSocialButtons from './components/FloatingSocialButtons';
import { suggestNextAvailableBatch } from './utils/batchCapacity';

import MediaHubModule from './components/MediaHubModule';
import ExamRegistrationPortal from './components/ExamRegistrationPortal';
import ExaminationEngineModule from './components/ExaminationEngineModule';
import ExamAnnouncementsPortal from './components/ExamAnnouncementsPortal';
import ReviewsPortal from './components/ReviewsPortal';
import IndividualProfileModal, { IndividualProfileTarget } from './components/IndividualProfileModal';
import MdAdminManagementPanel from './components/MdAdminManagementPanel';

import AdminThemeConsole from './components/AdminThemeConsole';
import MajorMinorCourseManagementPanel from './components/MajorMinorCourseManagementPanel';
import StudentCourseSelectionPanel from './components/StudentCourseSelectionPanel';
import TutorAssignedCoursesPanel from './components/TutorAssignedCoursesPanel';

import { 
  Home, Users, BookOpen, Layers, Calendar, ClipboardCheck, 
  FileText, Star, Briefcase, DollarSign, Settings, ShieldCheck,
  Bell, LogOut, Menu, X, ArrowLeft, ArrowUpRight, Sparkles, GraduationCap, CheckCircle2, AlertTriangle, Film, Megaphone, Video, MessageCircle,
  KeyRound, Eye, EyeOff, Palette
} from 'lucide-react';
import { useAuth } from './components/FirebaseAuthProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { academyService } from './services/academyService';
import { useTheme } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import type { AuthGatewayMode } from './components/AuthGateway';

function getPortalRoleCategory(role?: string): 'ADMIN' | 'TUTOR' | 'STUDENT' {
  const upper = String(role || '').toUpperCase();
  if (['INSTRUCTOR', 'REVIEWER'].includes(upper)) return 'TUTOR';
  if (['STUDENT', 'ALUMNI', 'PARENT'].includes(upper)) return 'STUDENT';
  return 'ADMIN';
}

function isStrictAdminRole(role?: string): boolean {
  return ['SUPER_ADMIN', 'MD', 'PRINCIPAL', 'ADMIN', 'ACADEMIC_ADMIN', 'REVIEWER'].includes(
    String(role || '').toUpperCase()
  );
}

type AppViewType = 'landing' | 'login' | 'portfolio' | 'portal' | 'course-selection';

function parseAppPath(pathname: string): {
  view: AppViewType;
  portalTab: string;
  roleHint?: 'ADMIN' | 'TUTOR' | 'STUDENT';
} {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  if (clean === '/login') return { view: 'login', portalTab: 'overview' };
  if (clean === '/course-selection') return { view: 'course-selection', portalTab: 'overview' };
  if (clean === '/admin/course-management') {
    return { view: 'portal', portalTab: 'course-management', roleHint: 'ADMIN' };
  }
  if (clean === '/admin/theme') {
    return { view: 'portal', portalTab: 'theme-settings', roleHint: 'ADMIN' };
  }
  if (clean === '/admin') {
    return { view: 'portal', portalTab: 'overview', roleHint: 'ADMIN' };
  }
  if (clean === '/student/course-selection') {
    return { view: 'portal', portalTab: 'student-course-selection', roleHint: 'STUDENT' };
  }
  if (clean === '/student') {
    return { view: 'portal', portalTab: 'student', roleHint: 'STUDENT' };
  }
  if (clean === '/tutor/assigned-courses') {
    return { view: 'portal', portalTab: 'tutor-assigned-courses', roleHint: 'TUTOR' };
  }
  if (clean === '/tutor') {
    return { view: 'portal', portalTab: 'attendance', roleHint: 'TUTOR' };
  }
  return { view: 'landing', portalTab: 'overview' };
}

function resolvePathForState(view: AppViewType, portalTab: string, user: User | null): string {
  if (view === 'landing') return '/';
  if (view === 'login') return '/login';
  if (view === 'course-selection') return '/course-selection';
  if (view === 'portfolio') return '/';
  if (!user) return '/login';

  const roleCat = getPortalRoleCategory(user.role);
  if (roleCat === 'STUDENT') {
    if (portalTab === 'student-course-selection') return '/student/course-selection';
    return '/student';
  }
  if (roleCat === 'TUTOR') {
    if (portalTab === 'tutor-assigned-courses') return '/tutor/assigned-courses';
    return '/tutor';
  }
  if (portalTab === 'course-management') return '/admin/course-management';
  if (portalTab === 'theme-settings') return '/admin/theme';
  return '/admin';
}

function readInitialUrlAuthAction(): { mode?: AuthGatewayMode; token?: string; openLogin?: boolean } {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('authAction');
    const token = params.get('token') || '';
    if (action === 'verify-email' && token) {
      return { mode: 'verify-result', token, openLogin: true };
    }
    if (action === 'reset-password' && token) {
      return { mode: 'reset-password', token, openLogin: true };
    }
    if (action === 'confirm-email-change' && token) {
      return { mode: 'confirm-email-change', token, openLogin: true };
    }
  } catch {
    // ignore URL parse error
  }
  return {};
}

export default function App() {
  const { setActiveSection } = useTheme();
  const initialUrlAction = React.useMemo(() => readInitialUrlAuthAction(), []);
  const initialParsedRoute = React.useMemo(
    () => (typeof window !== 'undefined' ? parseAppPath(window.location.pathname) : { view: 'landing' as AppViewType, portalTab: 'overview' }),
    []
  );
  const [urlActionToken, setUrlActionToken] = useState<string>(initialUrlAction.token || '');

  // Initialize standard local db on boot & auto-save listener
  const [autoSaveToast, setAutoSaveToast] = useState(false);

  useEffect(() => {
    SwanayaDatabase.init();
    const savedFrontPage = SwanayaDatabase.get<FrontPageConfig>('frontPageConfig');
    applyDocumentFavicon(savedFrontPage?.faviconUrl);

    // Pull all users, students, and profile updates from cloud so profile is identical across all systems
    academyService.fetchAllProfilesFromCloud().then((data) => {
      if (data) {
        setUsers(SwanayaDatabase.get<User[]>("users"));
        setStudents(SwanayaDatabase.get<Student[]>("students"));
        setInstructors(SwanayaDatabase.get<Instructor[]>("instructors"));
      }
    }).catch((err) => console.warn('Cloud profiles boot sync deferred:', err));

    // Real-time Firestore course catalogue subscription across all browsers & sessions
    setCoursesLoading(true);
    setCoursesError(null);
    const unsubscribeCourses = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (courses) => {
        setCoursesList(courses);
        setCoursesLoading(false);
        setCoursesError(null);
        if (courses.length > 0) {
          setFastStudent((prev) =>
            prev.courseId && courses.some((c) => c.id === prev.courseId)
              ? prev
              : { ...prev, courseId: courses[0].id }
          );
          setFastSchedule((prev) =>
            prev.courseId && courses.some((c) => c.id === prev.courseId)
              ? prev
              : { ...prev, courseId: courses[0].id }
          );
        }
      },
      onError: (err) => {
        setCoursesLoading(false);
        setCoursesError(err.message || 'Unable to sync published courses.');
      },
    });

    const handleAutoSave = (e?: any) => {
      setAutoSaveToast(true);
      if (e?.detail?.key === 'courses') {
        const fresh = SwanayaDatabase.get<Course[]>("courses");
        if (Array.isArray(fresh)) {
          setCoursesList(fresh);
        }
      }
      const timer = setTimeout(() => setAutoSaveToast(false), 2500);
      return () => clearTimeout(timer);
    };
    window.addEventListener('sma-autosave', handleAutoSave);
    return () => {
      unsubscribeCourses();
      window.removeEventListener('sma-autosave', handleAutoSave);
    };
  }, []);

  // Application general views
  // 'landing' | 'login' | 'portfolio' | 'portal' | 'course-selection'
  const [currentView, setCurrentView] = useState<AppViewType>(
    initialUrlAction.openLogin ? 'login' : initialParsedRoute.view
  );
  const [courseSelectionOrigin, setCourseSelectionOrigin] = useState<'landing' | 'login'>('landing');
  const [preselectedCourseId, setPreselectedCourseId] = useState<string>('');
  const [authInitialMode, setAuthInitialMode] = useState<AuthGatewayMode>(initialUrlAction.mode || 'signin');
  const [authInitialRoleTab, setAuthInitialRoleTab] = useState<'ADMIN' | 'TUTOR' | 'STUDENT'>(
    initialParsedRoute.roleHint || 'STUDENT'
  );
  const [preselectedResetEmail, setPreselectedResetEmail] = useState<string>('');
  const [desktopSidebarDropdownOpen, setDesktopSidebarDropdownOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Floating Woman Mascot Chatbot State
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);
  const [chatbotRecoveryTrigger, setChatbotRecoveryTrigger] = useState<{ nonce: number; email?: string } | null>(null);

  const handleClearUrlAction = () => {
    setUrlActionToken('');
    setAuthInitialMode('signin');
    setPreselectedResetEmail('');
    if (typeof window !== 'undefined' && window.location.search.includes('authAction')) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  };
  
  // Parameterized sub-view states
  const [selectedPortfolioStudent, setSelectedPortfolioStudent] = useState<Student | null>(null);

  // Individual Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<IndividualProfileTarget | null>(null);
  const [profileInitialEditMode, setProfileInitialEditMode] = useState(false);

  const handleOpenProfileModal = (target: IndividualProfileTarget, editMode = false) => {
    setProfileTarget(target);
    setProfileInitialEditMode(editMode);
    setIsProfileModalOpen(true);
  };

  // In-Portal Re-Authentication & Recovery State
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [reauthUsername, setReauthUsername] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthSuccess, setReauthSuccess] = useState<string | null>(null);
  const [lastReauthAt, setLastReauthAt] = useState<string | null>(null);
  const [reauthForgotMode, setReauthForgotMode] = useState(false);
  const [reauthResetEmail, setReauthResetEmail] = useState('');
  const [reauthResetLoading, setReauthResetLoading] = useState(false);
  const [reauthResetError, setReauthResetError] = useState<string | null>(null);
  const [reauthResetSuccess, setReauthResetSuccess] = useState<string | null>(null);

  const openReauthModal = () => {
    const defaultEmail = activeUser?.email || '';
    setReauthUsername(activeUser?.username || defaultEmail);
    setReauthPassword('');
    setShowReauthPassword(false);
    setReauthError(null);
    setReauthSuccess(null);
    setReauthForgotMode(false);
    setReauthResetEmail(defaultEmail);
    setReauthResetError(null);
    setReauthResetSuccess(null);
    setIsReauthModalOpen(true);
  };

  const handleRedirectToPasswordReset = (emailHint?: string) => {
    const cleanEmail = (emailHint || reauthResetEmail || activeUser?.email || '').trim();
    setIsReauthModalOpen(false);
    setFloatingChatOpen(false);
    if (cleanEmail.includes('@')) {
      setPreselectedResetEmail(cleanEmail);
    }
    setAuthInitialMode('forgot-password');
    setCurrentView('login');
  };

  const handleStartChatbotRecovery = (emailHint?: string) => {
    const cleanEmail = (
      emailHint ||
      reauthResetEmail ||
      (reauthUsername.includes('@') ? reauthUsername : activeUser?.email) ||
      ''
    ).trim();
    setIsReauthModalOpen(false);
    setFloatingChatOpen(true);
    setChatbotRecoveryTrigger({
      nonce: Date.now(),
      email: cleanEmail || undefined,
    });
  };

  const handleReauthPasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthResetError(null);
    setReauthResetSuccess(null);
    const cleanEmail = reauthResetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setReauthResetError('Please enter a valid registered email address.');
      return;
    }
    setReauthResetLoading(true);
    try {
      const res = await academyService.requestPasswordReset(cleanEmail);
      await sendPasswordResetEmail(auth, cleanEmail).catch(() => {});
      setReauthResetSuccess(
        res?.message ||
          `Password reset instructions have been sent to ${cleanEmail}. Check your inbox to complete recovery.`
      );
    } catch (err: any) {
      setReauthResetError(err?.message || 'Unable to send password reset instructions.');
    } finally {
      setReauthResetLoading(false);
    }
  };

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError(null);
    setReauthSuccess(null);
    const cleanUser = reauthUsername.trim();
    if (!cleanUser || !reauthPassword) {
      setReauthError('Please enter both your username (or email) and password.');
      return;
    }
    setReauthLoading(true);
    try {
      const res = await academyService.reauthenticateWithCredentials({
        identifier: cleanUser,
        password: reauthPassword,
      });
      if (res?.user) {
        if (res.user.email) {
          await signInWithEmailAndPassword(auth, res.user.email, reauthPassword).catch(() => {});
        }
        handleSelectUser(res.user);
      }
      setLastReauthAt(res?.reauthenticatedAt || new Date().toISOString());
      setReauthSuccess(res?.message || `Re-authenticated as ${res?.user?.username || cleanUser}.`);
      setReauthPassword('');
      handleRefreshAllData();
      setTimeout(() => {
        setIsReauthModalOpen(false);
        setReauthSuccess(null);
      }, 1100);
    } catch (err: any) {
      setReauthError(err?.message || 'Re-authentication failed. Please verify your username and password.');
    } finally {
      setReauthLoading(false);
    }
  };

  const handleFirebaseReauth = async () => {
    setReauthError(null);
    setReauthSuccess(null);
    setReauthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const fbUser = cred.user;
      const cleanEmail = String(fbUser.email || '').trim().toLowerCase();
      const idToken = await fbUser.getIdToken().catch(() => undefined);
      const sessionRes = await academyService.establishFirebaseBackendSession({
        userId: fbUser.uid,
        email: cleanEmail,
        role: activeUser?.role || 'STUDENT',
        emailVerified: Boolean(fbUser.emailVerified),
        displayName: fbUser.displayName || activeUser?.name,
        idToken,
      });
      if (sessionRes?.user) {
        handleSelectUser(sessionRes.user as User);
      }
      setLastReauthAt(new Date().toISOString());
      setReauthSuccess(`Firebase Auth verified for ${cleanEmail}.`);
      handleRefreshAllData();
      setTimeout(() => {
        setIsReauthModalOpen(false);
        setReauthSuccess(null);
      }, 1100);
    } catch (err: any) {
      setReauthError(err?.message || 'Firebase Google authentication was cancelled or failed.');
    } finally {
      setReauthLoading(false);
    }
  };

  // Quick-Access Modal States (New focused features!)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSchedModalOpen, setIsSchedModalOpen] = useState(false);

  // Fast Student Enrollment Form State & Capacity Verification
  const [fastStudent, setFastStudent] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: 'c-1',
    batchId: 'b-1'
  });
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [fastEnrollOverrideConfirmed, setFastEnrollOverrideConfirmed] = useState(false);
  const [fastEnrollCapacityWarning, setFastEnrollCapacityWarning] = useState<string | null>(null);

  // Reactive DB states for quick modals
  const [batchesList, setBatchesList] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>("batches"));
  const [studentsList, setStudentsList] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState<boolean>(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [subjectsList, setSubjectsList] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));

  // Fast Batch Scheduler Form State
  const [fastSchedule, setFastSchedule] = useState({
    title: '',
    courseId: 'c-1',
    batchId: 'b-1',
    subjectId: 'sub-101',
    instructorId: (SwanayaDatabase.get<Instructor[]>("instructors") || [])[0]?.id || 'inst-1',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    room: 'Google Meet Studio',
    googleMeetUrl: '',
    whatsappGroupUrl: '',
    whatsappGroupName: '',
    type: 'HYBRID' as 'PHYSICAL' | 'ONLINE' | 'HYBRID' | 'WORKSHOP' | 'LAB' | 'HACKATHON'
  });
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Report Export State
  const [exportingReport, setExportingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Auth integration
  const { profile, loading: authLoading, isAdmin } = useAuth();

  // Users & Active User states (Requires verified authentication)
  const [users, setUsers] = useState<User[]>(() => SwanayaDatabase.get<User[]>("users"));
  const [activeUser, setActiveUser] = useState<User | null>(null);

  useEffect(() => {
    if (profile) {
      setActiveUser(profile as User);
      setSessionChecked(true);
      const roleCat = getPortalRoleCategory(profile.role);
      if (roleCat === 'STUDENT') {
        setActivePortalTab((prev) =>
          ['student', 'student-course-selection', 'course-papers', 'live-class', 'fees-pay', 'exams', 'registration', 'exam-registration', 'media', 'reviews', 'library'].includes(prev)
            ? prev
            : 'student'
        );
      } else if (roleCat === 'TUTOR') {
        setActivePortalTab((prev) =>
          ['attendance', 'tutor-assigned-courses', 'assignments', 'live-classes', 'google-meet', 'instructor-exams', 'exam-registration', 'course-verification', 'media', 'reviews', 'library'].includes(prev)
            ? prev
            : 'attendance'
        );
      }
    } else if (!authLoading) {
      // Restore verified credential session from backend HttpOnly cookie if active
      academyService
        .getCurrentSessionUser()
        .then((sessionUser) => {
          if (sessionUser) {
            setActiveUser(sessionUser);
            const roleCat = getPortalRoleCategory(sessionUser.role);
            if (roleCat === 'STUDENT') {
              setActivePortalTab((prev) =>
                ['student', 'student-course-selection', 'course-papers', 'live-class', 'fees-pay', 'exams', 'registration', 'exam-registration', 'media', 'reviews', 'library'].includes(prev)
                  ? prev
                  : 'student'
              );
            } else if (roleCat === 'TUTOR') {
              setActivePortalTab((prev) =>
                ['attendance', 'tutor-assigned-courses', 'assignments', 'live-classes', 'google-meet', 'instructor-exams', 'exam-registration', 'course-verification', 'media', 'reviews', 'library'].includes(prev)
                  ? prev
                  : 'attendance'
              );
            }
          }
        })
        .catch(() => {})
        .finally(() => setSessionChecked(true));
    }
  }, [profile, authLoading]);

  // Re-fetch reactive states to update widgets instantly across CRUDs
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleRefreshAllData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const freshBatches = SwanayaDatabase.get<Batch[]>("batches");
    const freshStudents = SwanayaDatabase.get<Student[]>("students");
    setBatchesList(freshBatches);
    setStudentsList(freshStudents);
    setSubjectsList(SwanayaDatabase.get<Subject[]>("subjects"));

    if (isEnrollModalOpen) {
      const resolvedCourseId =
        coursesList.find((c) => c.id === fastStudent.courseId)?.id ||
        coursesList[0]?.id ||
        fastStudent.courseId;
      const suggestion = suggestNextAvailableBatch(resolvedCourseId, freshBatches, freshStudents);
      setFastEnrollCapacityWarning(null);
      setFastEnrollOverrideConfirmed(false);
      setFastStudent((prev) => ({
        ...prev,
        courseId: resolvedCourseId,
        batchId: suggestion.batchId || prev.batchId,
      }));
    }
  }, [refreshTrigger, isEnrollModalOpen, isSchedModalOpen]);

  const fastBatchSuggestion = React.useMemo(
    () => suggestNextAvailableBatch(fastStudent.courseId, batchesList, studentsList),
    [fastStudent.courseId, batchesList, studentsList]
  );

  // Submit Fast Student Enrollment
  const handleFastEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastStudent.name || !fastStudent.email) return;

    // Check target batch capacity
    const curBatches = SwanayaDatabase.get<Batch[]>("batches");
    const curStudents = SwanayaDatabase.get<Student[]>("students");
    const targetBatch = curBatches.find(b => b.id === fastStudent.batchId);
    const enrolledCount = curStudents.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
    const maxCapacity = targetBatch?.maxCapacity ?? 30;

    if (enrolledCount >= maxCapacity && !fastEnrollOverrideConfirmed) {
      setFastEnrollCapacityWarning(`⚠️ Target Batch Full: ${targetBatch?.name || 'Selected batch'} has reached its capacity limit of ${maxCapacity} students (${enrolledCount}/${maxCapacity} filled). Please check the confirmation box below to proceed.`);
      return;
    }

    setFastEnrollCapacityWarning(null);
    setEnrollSuccess(true);
    setTimeout(() => {
      const listStudents = SwanayaDatabase.get<Student[]>("students");
      const listUsers = SwanayaDatabase.get<User[]>("users");
      const listSems = SwanayaDatabase.get<Semester[]>("semesters");

      const studentIdCode = `SMA-2026-${Math.floor(100 + Math.random() * 900)}`;
      const admissionNum = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const targetSem = listSems.find(s => s.courseId === fastStudent.courseId)?.id || 's-1-1';

      const newStudent: Student = {
        id: `stud-${Date.now()}`,
        studentId: studentIdCode,
        admissionNumber: admissionNum,
        userId: `usr-${Date.now()}`,
        name: fastStudent.name,
        email: fastStudent.email,
        phone: fastStudent.phone || '',
        guardianName: 'Self / Guardian',
        guardianPhone: '',
        academicBackground: 'Fast Enrollment Entry',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fastStudent.name}`,
        status: 'ACTIVE',
        courseId: fastStudent.courseId,
        batchId: fastStudent.batchId,
        semesterId: targetSem,
        enrollmentDate: new Date().toISOString().split('T')[0],
        skills: ['Fast Track'],
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: 145000,
        careerReadinessScore: 40
      };

      const newUser: User = {
        id: newStudent.userId,
        email: fastStudent.email,
        name: fastStudent.name,
        role: 'STUDENT',
        avatarUrl: newStudent.avatarUrl,
        status: 'ACTIVE',
        createdAt: newStudent.enrollmentDate
      };

      SwanayaDatabase.set("students", [...listStudents, newStudent]);
      SwanayaDatabase.set("users", [...listUsers, newUser]);

      SwanayaDatabase.log(activeUser?.email || 'admin@swanayamedia.com', activeUser?.name || 'Administrator', "STUDENT_FAST_ENROLL", `Fast Enroll: ${fastStudent.name}`);
      
      setEnrollSuccess(false);
      setIsEnrollModalOpen(false);
      setFastStudent({ name: '', email: '', phone: '', courseId: 'c-1', batchId: 'b-1' });
      handleRefreshAllData();
    }, 1500);
  };

  // Submit Fast Class Batch Scheduling
  const handleFastScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleSuccess(true);
    try {
      const targetCourse = coursesList.find((c) => c.id === fastSchedule.courseId);
      const targetBatch = batchesList.find((b) => b.id === fastSchedule.batchId);
      const targetSubject = subjectsList.find((s) => s.id === fastSchedule.subjectId);
      const targetInstructor = instructors.find((i) => i.id === fastSchedule.instructorId) || instructors[0];
      const sessionTitle =
        fastSchedule.title.trim() ||
        targetSubject?.name ||
        targetCourse?.name ||
        'Scheduled Live Class';

      await academyService.saveClassSession({
        title: sessionTitle,
        courseId: fastSchedule.courseId,
        courseCode: targetCourse?.code || '',
        courseName: targetCourse?.name || '',
        batchId: fastSchedule.batchId,
        batchName: targetBatch?.name || '',
        subjectId: fastSchedule.subjectId,
        subjectName: targetSubject?.name || '',
        instructorId: targetInstructor?.id || activeUser?.id || 'inst-1',
        instructorName: targetInstructor?.name || activeUser?.name || 'Swanaya Faculty',
        date: fastSchedule.date,
        startTime: fastSchedule.startTime,
        endTime: fastSchedule.endTime,
        room: fastSchedule.room,
        type: fastSchedule.type,
        googleMeetUrl: fastSchedule.googleMeetUrl,
        whatsappGroupUrl: fastSchedule.whatsappGroupUrl,
        whatsappGroupName: fastSchedule.whatsappGroupName,
        isActive: true,
      });

      if (targetInstructor) {
        const currentNotifs = SwanayaDatabase.get<Notification[]>("notifications") || [];
        const teacherAlert: Notification = {
          id: `not-sched-${Date.now()}`,
          userId: targetInstructor.userId || targetInstructor.id,
          title: 'New Session & Google Meet Assigned',
          message: `Admin assigned you to host "${sessionTitle}" on ${fastSchedule.date} (${fastSchedule.startTime} - ${fastSchedule.endTime}).${
            fastSchedule.googleMeetUrl ? ` Google Meet: ${fastSchedule.googleMeetUrl}` : ''
          }`,
          type: 'INFO',
          read: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        SwanayaDatabase.set("notifications", [teacherAlert, ...currentNotifs]);
      }

      SwanayaDatabase.log(
        activeUser?.email || 'admin@swanayamedia.com',
        activeUser?.name || 'Administrator',
        'BATCH_FAST_SCHEDULE',
        `Scheduled Class/Meet for subject: ${targetSubject?.name || fastSchedule.subjectId}${targetInstructor ? ` · Host: ${targetInstructor.name}` : ''}`
      );
      setTimeout(() => {
        setScheduleSuccess(false);
        setIsSchedModalOpen(false);
        setFastSchedule((prev) => ({ ...prev, title: '', googleMeetUrl: '', whatsappGroupUrl: '', whatsappGroupName: '' }));
        handleRefreshAllData();
      }, 900);
    } catch {
      setScheduleSuccess(false);
    }
  };

  // Submit Fast Report Export
  const handleExportReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExportingReport(true);
    setTimeout(() => {
      setExportingReport(false);
      setReportSuccess(true);
      SwanayaDatabase.log(activeUser?.email || 'admin@swanayamedia.com', activeUser?.name || 'Administrator', "REPORT_FAST_EXPORT", "Generated academic ledger summary PDF");
      setTimeout(() => {
        setReportSuccess(false);
        setIsReportModalOpen(false);
      }, 2000);
    }, 1500);
  };

  // Synchronize users and active student/instructor contexts
  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [settings, setSettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>("settings"));
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setStudents(SwanayaDatabase.get<Student[]>("students"));
    setInstructors(SwanayaDatabase.get<Instructor[]>("instructors"));
    setSettings(SwanayaDatabase.get<AcademySettings>("settings"));
    setUsers(SwanayaDatabase.get<User[]>("users"));
    
    // Real-time synchronization of notifications across devices
    let unsubscribeNotifs: (() => void) | null = null;
    
    // Always initialize notifications from local database
    const localNotifs = SwanayaDatabase.get<Notification[]>("notifications") || [];
    setNotifications(localNotifs);

    if (auth.currentUser && activeUser) {
      try {
        const isUserAdmin = isAdmin || activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL';
        const q = isUserAdmin
          ? query(collection(db, "notifications"))
          : query(collection(db, "notifications"), where('userId', '==', auth.currentUser.uid));

        unsubscribeNotifs = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(list);
          }
        }, (error) => {
          // Gracefully handle permission errors when using local demo profiles
          console.warn("Notifications sync notice (using local data store):", error.message);
          setNotifications(SwanayaDatabase.get<Notification[]>("notifications") || []);
        });
      } catch (err: any) {
        console.warn("Notifications listener setup skipped:", err?.message);
      }
    } else if (!activeUser) {
      setNotifications([]);
    }

    return () => {
      if (unsubscribeNotifs) unsubscribeNotifs();
    };
  }, [activeUser, refreshTrigger, isAdmin]);

  // Find respective active student or instructor object matching active logged in user without leaking other profiles
  const activeStudentProfile = React.useMemo<Student | null>(() => {
    if (!activeUser) return null;
    const match = students.find((s) => 
      s.userId === activeUser.id || 
      (s.email && activeUser.email && s.email.toLowerCase() === activeUser.email.toLowerCase())
    );
    if (match) return match;
    if (activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') {
      const fallbackStudent: Student = {
        id: `s-${activeUser.id}`,
        studentId: (activeUser as any).studentId || (activeUser.studentIds && activeUser.studentIds[0]) || `SMA-2026-${activeUser.id.slice(-4).toUpperCase()}`,
        admissionNumber: `ADM-2026-${activeUser.id.slice(-4).toUpperCase()}`,
        userId: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        phone: activeUser.phone || activeUser.whatsappPhone || '',
        whatsappPhone: activeUser.whatsappPhone || activeUser.phone || '',
        whatsappOptIn: activeUser.whatsappOptIn ?? true,
        guardianName: activeUser.guardianName || 'Parent / Guardian',
        guardianPhone: activeUser.guardianPhone || '',
        academicBackground: activeUser.academicBackground || 'Enrolled Scholar',
        avatarUrl: activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeUser.name)}`,
        status: activeUser.role === 'ALUMNI' ? 'ALUMNI' : activeUser.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        courseId:
          activeUser.courseId ||
          activeUser.preferredCourseId ||
          (Array.isArray(activeUser.enrolledCourseIds) && activeUser.enrolledCourseIds[0]) ||
          coursesList[0]?.id ||
          '',
        batchId: 'b-1',
        semesterId: 's-1-1',
        enrollmentDate: activeUser.createdAt || new Date().toISOString().split('T')[0],
        skills: activeUser.skills || ['Media Science'],
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: 0,
        careerReadinessScore: 50
      };
      return fallbackStudent;
    }
    return null;
  }, [activeUser, students, coursesList]);

  const activeInstructorProfile = React.useMemo<Instructor | null>(() => {
    if (!activeUser) return null;
    const match = instructors.find((i) => 
      i.userId === activeUser.id || 
      (i.email && activeUser.email && i.email.toLowerCase() === activeUser.email.toLowerCase())
    );
    if (match) return match;
    if (
      activeUser.role === 'INSTRUCTOR' ||
      activeUser.role === 'REVIEWER' ||
      activeUser.role === 'SUPER_ADMIN' ||
      activeUser.role === 'MD' ||
      activeUser.role === 'PRINCIPAL' ||
      activeUser.role === 'ADMIN' ||
      activeUser.role === 'ACADEMIC_ADMIN'
    ) {
      return {
        id: `inst-${activeUser.id}`,
        userId: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        phone: activeUser.phone || '',
        qualification: activeUser.academicBackground || 'Faculty Specialist',
        specialization: activeUser.skills?.join(', ') || 'Media Science & AI',
        experience: '5+ Years',
        bio: activeUser.bio || 'Faculty Instructor at Swanaya Media Academy',
        avatarUrl: activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeUser.name)}`,
        status: activeUser.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        assignedSubjects: []
      };
    }
    return null;
  }, [activeUser, instructors]);

  // CRM submissions triggers from landing form & course selection page
  const handleApplyFromLanding = (leadData: {
    name: string;
    email: string;
    phone: string;
    courseId: string;
    qualification: string;
    preferredBatch: string;
    message: string;
    levelFilter?: string;
    studyMode?: 'HYBRID' | 'PHYSICAL' | 'ONLINE';
    preferredSchedule?: string;
    experienceLevel?: string;
    careerTrack?: string;
  }) => {
    // Write new Application Record with Department & MD verification defaults
    const apps = SwanayaDatabase.get<AdmissionApplication[]>("applications");
    const newApp: AdmissionApplication = {
      id: `app-${Date.now()}`,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      courseId: leadData.courseId,
      qualification: leadData.qualification,
      preferredBatch: leadData.preferredBatch,
      message: leadData.message,
      levelFilter: leadData.levelFilter,
      studyMode: leadData.studyMode,
      preferredSchedule: leadData.preferredSchedule,
      experienceLevel: leadData.experienceLevel,
      careerTrack: leadData.careerTrack,
      status: 'NEW',
      leadSource: leadData.careerTrack ? 'Course Selection Page' : 'Website Application Form',
      createdAt: new Date().toISOString().split('T')[0],
      departmentVerificationStatus: 'PENDING',
      mdVerificationStatus: 'PENDING_MD',
    };
    SwanayaDatabase.set("applications", [newApp, ...apps]);

    // Write new Lead Record in CRM pipeline
    const leads = SwanayaDatabase.get<Lead[]>("leads");
    const newLead: Lead = {
      id: `ld-${Date.now()}`,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      courseId: leadData.courseId,
      source: newApp.leadSource,
      status: 'NEW',
      notes: leadData.message || 'Submitted online admission form.',
      assignedTo: 'usr-counsel',
      createdAt: newApp.createdAt
    };
    SwanayaDatabase.set("leads", [newLead, ...leads]);

    // Send system notifications to Counsellors and MD
    const notificationsList = SwanayaDatabase.get<Notification[]>("notifications");
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const counselNotif: Notification = {
      id: `not-${Date.now()}`,
      userId: 'usr-counsel',
      title: 'New Course Selection Verification Request',
      message: `${leadData.name} submitted course selection options for ${leadData.preferredBatch}.`,
      type: 'INFO',
      read: false,
      createdAt: timestampStr
    };
    const mdNotif: Notification = {
      id: `not-md-${Date.now()}`,
      userId: 'usr-md',
      title: 'Course Selection Awaiting Department & MD Verification',
      message: `${leadData.name} selected course ${leadData.courseId} (${leadData.studyMode || 'HYBRID'}).`,
      type: 'INFO',
      read: false,
      createdAt: timestampStr
    };
    SwanayaDatabase.set("notifications", [counselNotif, mdNotif, ...notificationsList]);

    SwanayaDatabase.log("guest@swanaya.com", leadData.name, "COURSE_SELECTION_SUBMITTED", `Course: ${leadData.courseId} (${leadData.preferredBatch})`);
    handleRefreshAllData();
  };

  // Navigation Sidemenu logic (Dynamic depending on active role & URL pathname)
  const [activePortalTab, setActivePortalTab] = useState<string>(initialParsedRoute.portalTab || 'overview');

  // Synchronize active section theme override with route & role
  useEffect(() => {
    if (currentView === 'landing' || currentView === 'course-selection') {
      setActiveSection('landing');
    } else if (currentView === 'login' || !activeUser) {
      setActiveSection('login');
    } else {
      const cat = getPortalRoleCategory(activeUser.role);
      if (cat === 'STUDENT') setActiveSection('student');
      else if (cat === 'TUTOR') setActiveSection('tutor');
      else setActiveSection('global');
    }
  }, [currentView, activeUser, setActiveSection]);

  // Enforce strict RBAC on portal tabs & sync browser pathname URL without breaking auth boot
  useEffect(() => {
    if (!sessionChecked || typeof window === 'undefined') return;

    if (activeUser && currentView === 'portal') {
      const roleCat = getPortalRoleCategory(activeUser.role);
      if (
        roleCat === 'STUDENT' &&
        [
          'overview',
          'students',
          'courses',
          'course-management',
          'theme-settings',
          'admin-management',
          'settings',
          'front-page',
          'attendance',
          'assignments',
          'tutor-assigned-courses',
          'instructor-exams',
          'cRM',
          'finance',
          'career',
          'exam-verification',
          'exam-announcements',
        ].includes(activePortalTab)
      ) {
        setActivePortalTab('student');
        return;
      }

      if (
        roleCat === 'TUTOR' &&
        [
          'overview',
          'students',
          'courses',
          'course-management',
          'theme-settings',
          'admin-management',
          'settings',
          'front-page',
          'finance',
          'cRM',
        ].includes(activePortalTab)
      ) {
        setActivePortalTab('attendance');
        return;
      }
    }

    if (!activeUser && currentView === 'portal') {
      return; // AuthGateway is rendered while preserving requested target path post-login
    }

    const targetPath = resolvePathForState(currentView, activePortalTab, activeUser);
    const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    if (currentPath !== targetPath && !window.location.search.includes('authAction')) {
      window.history.pushState({}, '', targetPath + window.location.hash);
    }
  }, [currentView, activePortalTab, activeUser, sessionChecked]);

  // Listen to browser back/forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const parsed = parseAppPath(window.location.pathname);
      setCurrentView(parsed.view);
      if (parsed.portalTab) setActivePortalTab(parsed.portalTab);
      if (parsed.roleHint) setAuthInitialRoleTab(parsed.roleHint);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Triggered when user logs in or RoleSwitcher changes user context
  const handleSelectUser = (user: User) => {
    setActiveUser(user);
    const roleCat = getPortalRoleCategory(user.role);
    if (roleCat === 'STUDENT') {
      setActivePortalTab((prev) =>
        ['student', 'student-course-selection'].includes(prev) ? prev : 'student'
      );
    } else if (roleCat === 'TUTOR') {
      setActivePortalTab((prev) =>
        ['attendance', 'tutor-assigned-courses'].includes(prev) ? prev : 'attendance'
      );
    } else if (user.role === 'FINANCE') {
      setActivePortalTab('finance');
    } else if (user.role === 'COUNSELLOR') {
      setActivePortalTab('cRM');
    } else if (user.role === 'CAREER') {
      setActivePortalTab('career');
    } else {
      setActivePortalTab((prev) =>
        ['overview', 'course-management', 'theme-settings'].includes(prev) ? prev : 'overview'
      );
    }
  };

  // Notification clear action
  const handleMarkNotificationsRead = () => {
    if (!activeUser) return;
    const list = SwanayaDatabase.get<Notification[]>("notifications");
    const updated = list.map(n => n.userId === activeUser.id || activeUser.role === 'SUPER_ADMIN' ? { ...n, read: true } : n);
    SwanayaDatabase.set("notifications", updated);
    handleRefreshAllData();
  };

  // Mobile menu expand
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Render main core layout depending on current overall navigation view
  const renderPrimaryView = () => {
    if (currentView === 'course-selection') {
      return (
        <CourseSelectionPage
          initialCourseId={preselectedCourseId}
          originView={courseSelectionOrigin}
          onBack={() => setCurrentView(courseSelectionOrigin)}
          onNavigateToPortal={() => {
            setAuthInitialMode('signin');
            setCurrentView(activeUser ? 'portal' : 'login');
          }}
          onConfirmForRegistration={(courseId) => {
            setPreselectedCourseId(courseId);
            setAuthInitialMode('register');
            setCurrentView('login');
          }}
          onApplyLead={handleApplyFromLanding}
        />
      );
    }

    if (currentView === 'landing') {
      return (
        <PublicLanding 
          courses={coursesList}
          coursesLoading={coursesLoading}
          coursesError={coursesError}
          activeUser={activeUser}
          onLoginSuccess={(user) => {
            handleSelectUser(user);
            setCurrentView('portal');
          }}
          onNavigateToRegister={() => {
            setAuthInitialRoleTab('STUDENT');
            setAuthInitialMode('register');
            setCurrentView('login');
          }}
          onNavigateToPortal={(roleTab = 'STUDENT') => {
            setAuthInitialRoleTab(roleTab);
            setAuthInitialMode('signin');
            setCurrentView(activeUser ? 'portal' : 'login');
          }}
          onNavigateToCourseSelection={(courseId) => {
            setPreselectedCourseId(courseId || '');
            setCourseSelectionOrigin('landing');
            setCurrentView('course-selection');
          }}
          onApplyLead={handleApplyFromLanding}
        />
      );
    }

    if (currentView === 'login' || !activeUser) {
      return (
        <AuthGateway 
          initialCourseId={preselectedCourseId}
          initialAuthMode={authInitialMode}
          initialRoleTab={authInitialRoleTab}
          initialForgotEmail={preselectedResetEmail}
          actionToken={urlActionToken}
          onClearUrlAction={handleClearUrlAction}
          onOpenCourseSelection={(courseId) => {
            setPreselectedCourseId(courseId || '');
            setCourseSelectionOrigin('login');
            setCurrentView('course-selection');
          }}
          onLoginSuccess={(user) => {
            handleClearUrlAction();
            handleSelectUser(user);
            setCurrentView('portal');
          }}
          onBack={() => {
            handleClearUrlAction();
            setCurrentView('landing');
          }}
        />
      );
    }

    if (currentView === 'portfolio' && selectedPortfolioStudent) {
      const listProjects = SwanayaDatabase.get<Project[]>("projects");
      const listHacks = SwanayaDatabase.get<any[]>("hackathonRegistrations");
      return (
        <StudentPortfolioPublic 
          student={selectedPortfolioStudent}
          projects={listProjects}
          hackathons={listHacks}
          onBack={() => {
            setSelectedPortfolioStudent(null);
            setCurrentView('portal');
          }}
        />
      );
    }

    return null;
  };

  const prePortalView = renderPrimaryView();
  if (prePortalView) {
    return (
      <>
        {prePortalView}
        <FloatingSocialButtons
          hidden={floatingChatOpen}
          whatsappNumber={settings.adminWhatsAppPhone || settings.phone}
          instagramUrl="https://www.instagram.com/swanaya_media_acedemy_for_ai/"
        />
        <AcademyFloatingMascotChat
          mode={currentView === 'login' || !activeUser ? 'login' : currentView}
          userName={activeUser?.name}
          userEmail={activeUser?.email}
          userRole={activeUser?.role}
          externalOpen={floatingChatOpen}
          onExternalOpenChange={setFloatingChatOpen}
          recoveryTrigger={chatbotRecoveryTrigger}
          onRedirectToPasswordReset={handleRedirectToPasswordReset}
        />
      </>
    );
  }

  if (!activeUser) {
    return null;
  }

  // --- SAAS ENTERPRISE WORKSPACE PORTAL LAYOUT ---
  const portalRoleCategory = getPortalRoleCategory(activeUser.role);
  const roleBadgeClass =
    portalRoleCategory === 'ADMIN'
      ? 'text-[var(--sma-primary)]'
      : portalRoleCategory === 'TUTOR'
      ? 'text-[var(--sma-secondary)]'
      : 'text-[var(--sma-accent)]';
  const roleBorderAccent =
    portalRoleCategory === 'ADMIN'
      ? 'border-[var(--sma-primary)]/40'
      : portalRoleCategory === 'TUTOR'
      ? 'border-[var(--sma-secondary)]/40'
      : 'border-[var(--sma-accent)]/40';

  return (
    <div
      data-sma-portal=""
      data-role={portalRoleCategory}
      className="min-h-screen flex flex-col font-sans transition-colors duration-200 bg-[var(--sma-active-bg)] text-[var(--sma-active-text)]"
    >
      
      {/* SaaS Header Bar */}
      <div className="sticky top-0 z-40 border-b px-6 py-3.5 flex items-center justify-between backdrop-blur-md bg-[var(--sma-active-surface)]/95 border-[var(--sma-active-border)]">
        
        {/* Zone 1: Branding Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Website
          </button>
          
          <div className="hidden sm:flex items-center gap-2 border-l border-[var(--sma-active-border)] pl-3">
            <span className={`text-base font-serif font-bold tracking-widest ${roleBadgeClass}`}>
              {settings.logoText || "SWANAYA"}
            </span>
            <span className="text-[10px] tracking-widest text-[var(--sma-active-text-muted)] font-mono font-bold uppercase">
              {portalRoleCategory} PORTAL
            </span>
          </div>
        </div>

        {/* Zone 2: Notifications & Active User */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          
          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                if (!notifDropdownOpen) handleMarkNotificationsRead();
              }}
              aria-label="Open notifications"
              className="p-2 bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] transition-colors relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#7652A8] dark:bg-[#A985D6]"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notifDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifDropdownOpen(false)} />
                <div className={`absolute right-0 mt-3 w-80 sm:w-96 bg-[#FFFFFF] dark:bg-[#242436] border ${roleBorderAccent} rounded-xl shadow-2xl z-50 p-4 max-h-96 overflow-y-auto space-y-3`}>
                  <div className="flex items-center justify-between border-b border-[#E5E1EA] dark:border-[#38384B] pb-2">
                    <p className={`text-xs font-bold tracking-widest uppercase font-mono flex items-center gap-1.5 ${roleBadgeClass}`}>
                      <Bell className="w-3.5 h-3.5" />
                      Academy Alerts Inbox
                    </p>
                    <span className="text-[10px] font-mono text-[#555770] dark:text-[#B8B5C5]">{notifications.length} message(s)</span>
                  </div>
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] rounded-lg text-xs space-y-1 border border-[#E5E1EA] dark:border-[#38384B]">
                        <div className="flex justify-between items-center text-[10px] font-mono text-[#555770] dark:text-[#B8B5C5]">
                          <span>{n.createdAt}</span>
                          <span className={`${roleBadgeClass} font-bold px-1.5 py-0.5 rounded`}>{n.type}</span>
                        </div>
                        <p className="font-semibold text-[#25263A] dark:text-[#F5F3FA]">{n.title}</p>
                        <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5] leading-normal">{n.message}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-xs text-[#555770] dark:text-[#B8B5C5] italic text-center py-6">No new alerts.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active User Indicator */}
          {activeUser && (
            <button 
              type="button"
              onClick={() => handleOpenProfileModal({
                type: activeUser.role === 'STUDENT' ? 'STUDENT' : activeUser.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER',
                id: activeUser.id
              }, true)}
              className="hidden md:flex items-center gap-2 border-l border-[#E5E1EA] dark:border-[#38384B] pl-4 font-mono text-xs text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] transition-colors cursor-pointer text-left whitespace-nowrap shrink-0"
              title="Edit Profile & Verified Email Settings"
            >
              <img
                src={activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeUser.name)}`}
                alt={activeUser.name}
                referrerPolicy="no-referrer"
                className={`w-6 h-6 rounded-full border border-[#E5E1EA] dark:border-[#38384B] object-cover ${
                  activeUser.avatarFocus === 'center' ? 'object-center' : 'object-top'
                }`}
              />
              <strong className="text-[#25263A] dark:text-[#F5F3FA] underline decoration-[#7652A8]/50 dark:decoration-[#A985D6]/50 underline-offset-4">{activeUser.name}</strong>
            </button>
          )}

        </div>

        {/* Zone 3: Re-Auth, Theme Switcher, Logout & Mobile Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openReauthModal}
            className="px-2.5 py-1.5 bg-[#7652A8]/10 hover:bg-[#7652A8]/20 dark:bg-[#A985D6]/15 dark:hover:bg-[#A985D6]/25 border border-[#7652A8]/35 dark:border-[#A985D6]/35 rounded-lg text-[#5E3C8F] dark:text-[#D5BEFA] text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title={lastReauthAt ? `Last re-authenticated: ${new Date(lastReauthAt).toLocaleTimeString()}` : 'Re-Authenticate with Username & Password'}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Re-Auth</span>
          </button>

          <ThemeToggle compact />

          <button 
            onClick={async () => {
              await academyService.logoutBackendSession();
              await signOut(auth).catch(() => {});
              setActiveUser(null);
              setCurrentView('login');
            }}
            className="p-2 bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer"
            title="Logout and Exit to Authentication Login"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile navigation toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Subheader Utility Announcement */}
      <div className="bg-[var(--sma-active-surface)] border-b border-[var(--sma-active-border)] px-6 py-2 flex items-center justify-between text-xs text-[var(--sma-active-text-muted)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--sma-accent)] shrink-0" />
          <span>Swanaya Media Academy · Verified Session ({portalRoleCategory})</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`https://wa.me/${(settings.adminWhatsAppPhone || settings.phone || "+91 94460 55555").replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent("Hello Admin! I need support regarding Swanaya Media Academy.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-[var(--sma-accent)]/12 hover:bg-[var(--sma-accent)]/20 border border-[var(--sma-accent)]/35 text-[var(--sma-accent)] rounded text-[11px] font-bold font-mono transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Direct WhatsApp access to Academy Support"
          >
            <span>WhatsApp Support ({settings.adminWhatsAppPhone || settings.phone || "+91 94460 55555"})</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
          <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-[var(--sma-active-text-muted)] border-l border-[var(--sma-active-border)] pl-3">
            <span>TERM: OCT-DEC 2026</span>
            <span>VERIFIED SESSION</span>
          </div>
        </div>
      </div>

      {/* Sidebar & Workspace layout wrapper */}
      <div className="flex-grow flex flex-col md:flex-row relative">
        
        {/* SIDEBAR NAVIGATION PANEL */}
        <aside className={`w-full md:w-64 bg-[var(--sma-active-surface)] border-r border-[var(--sma-active-border)] flex flex-col shrink-0 md:sticky md:top-[58px] md:h-[calc(100vh-58px)] transition-all ${
          mobileMenuOpen ? 'block' : 'hidden md:flex'
        }`}>
          <div className="p-4 space-y-1.5 flex-grow overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setDesktopSidebarDropdownOpen(!desktopSidebarDropdownOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-3 bg-[#F4F3F7] dark:bg-[#242436] hover:border-[#7652A8] dark:hover:border-[#A985D6] border ${roleBorderAccent} rounded-xl text-xs font-serif font-bold ${roleBadgeClass} transition-all cursor-pointer shadow-xs mb-2`}
            >
              <span className="flex items-center gap-2">
                <Menu className="w-4 h-4" />
                <span>Workspace Modules ▾</span>
              </span>
              <span className="text-[10px] font-mono text-[#555770] dark:text-[#B8B5C5]">({activeUser.role})</span>
            </button>

            {desktopSidebarDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDesktopSidebarDropdownOpen(false)} />
                <div className={`md:absolute md:top-16 md:left-3 md:right-3 md:w-72 bg-[#FFFFFF] dark:bg-[#242436] border ${roleBorderAccent} rounded-xl shadow-2xl z-50 p-3 space-y-1.5 max-h-[70vh] overflow-y-auto`}>
                  <p className={`text-[9px] font-bold tracking-widest uppercase font-mono px-2 pb-1 border-b border-[#E5E1EA] dark:border-[#38384B] ${roleBadgeClass}`}>
                    Syllabus &amp; ERP Menu Links
                  </p>

            {/* SUPER_ADMIN, MD, PRINCIPAL, ADMIN, ACADEMIC_ADMIN, REVIEWER navigation elements */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'REVIEWER') && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('overview'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'overview' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Home className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Performance Overview
                </button>

                <button 
                  onClick={() => { setActivePortalTab('students'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'students' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Users className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Academy Students
                </button>

                <button 
                  onClick={() => { setActivePortalTab('courses'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'courses' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Syllabus &amp; Course Creation
                </button>

                <button 
                  onClick={() => { setActivePortalTab('course-management'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'course-management' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Major &amp; Minor Courses
                </button>

                {isStrictAdminRole(activeUser.role) && activeUser.role !== 'REVIEWER' && (
                  <button 
                    onClick={() => { setActivePortalTab('theme-settings'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      activePortalTab === 'theme-settings' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                    }`}
                  >
                    <Palette className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                    Theme &amp; Colour Console
                  </button>
                )}
              </>
            )}

            {/* ACADEMIC INSTRUCTOR portal access */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER') && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('tutor-assigned-courses'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'tutor-assigned-courses' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Assigned Major &amp; Minor
                </button>

                <button 
                  onClick={() => { setActivePortalTab('attendance'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'attendance' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Class Attendance
                </button>

                <button 
                  onClick={() => { setActivePortalTab('assignments'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'assignments' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Assignments Hub
                </button>

                <button 
                  onClick={() => { setActivePortalTab('instructor-exams'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'instructor-exams' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Papers, MCQs &amp; Grading
                </button>

                <button 
                  onClick={() => { setActivePortalTab('live-classes'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'live-classes' ? 'bg-[var(--sma-accent)]/15 ring-1 ring-[var(--sma-accent)]/35 text-[var(--sma-accent)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Video className="w-4 h-4 text-[var(--sma-accent)] shrink-0" />
                  Meet &amp; WhatsApp Group
                </button>

                <button 
                  onClick={() => { setActivePortalTab('google-meet'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'google-meet' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Google Meet Studio
                </button>
              </>
            )}

            {/* ADMISSIONS COUNSELLOR CRM access */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'COUNSELLOR') && (
              <button 
                onClick={() => { setActivePortalTab('cRM'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'cRM' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <Layers className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Admissions CRM
              </button>
            )}

            {/* STUDENT & ALUMNI PORTAL navigation widgets */}
            {(activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') && activeStudentProfile && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('student'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'student' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  {activeUser.role === 'ALUMNI' ? 'Alumni Graduate Classroom' : 'My Study Classroom'}
                </button>

                <button 
                  onClick={() => { setActivePortalTab('student-course-selection'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'student-course-selection' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Layers className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Major &amp; Minor Selection
                </button>

                <button 
                  onClick={() => { setActivePortalTab('course-papers'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'course-papers' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Course Papers
                </button>

                <button 
                  onClick={() => { setActivePortalTab('live-class'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'live-class' ? 'bg-[var(--sma-accent)]/15 ring-1 ring-[var(--sma-accent)]/35 text-[var(--sma-accent)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-[var(--sma-accent)] shrink-0" />
                  Meet &amp; WhatsApp Group
                </button>

                <button 
                  onClick={() => { setActivePortalTab('fees-pay'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'fees-pay' ? 'bg-[var(--sma-accent)]/15 ring-1 ring-[var(--sma-accent)]/35 text-[var(--sma-accent)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-[var(--sma-accent)] shrink-0" />
                  Fee Payments (GPay / UPI)
                </button>

                <button 
                  onClick={() => { setActivePortalTab('exams'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'exams' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Exams &amp; Answerbooks
                </button>
              </>
            )}

            {(activeUser.role === 'STUDENT') && (
              <button 
                onClick={() => { setActivePortalTab('registration'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'registration' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Course Registration
              </button>
            )}

            {(activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'INSTRUCTOR') && (
              <button 
                onClick={() => { setActivePortalTab('exam-registration'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'exam-registration' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                {activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI' ? 'Exam Registration' : 'Exam Sessions & Approvals'}
              </button>
            )}

            {(activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'SUPER_ADMIN') && (
              <button 
                onClick={() => { setActivePortalTab('exam-announcements'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'exam-announcements' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <Megaphone className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Announced Examination
              </button>
            )}

            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER' || activeUser.role === 'COUNSELLOR') && (
              <button 
                onClick={() => { setActivePortalTab('course-verification'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'course-verification' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Course Selection Verify
              </button>
            )}

            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'REVIEWER') && (
              <button 
                onClick={() => { setActivePortalTab('exam-verification'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'exam-verification' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                MD Exam Verification
              </button>
            )}

            {/* PARENT / GUARDIAN PORTAL navigation */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PARENT' || activeUser.role === 'REVIEWER') && (
              <button 
                onClick={() => { setActivePortalTab('parent'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'parent' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <Users className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Parent &amp; Guardian Portal
              </button>
            )}

            {/* MEDIA HUB & BLOG */}
            <button 
              onClick={() => { setActivePortalTab('media'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activePortalTab === 'media' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
              }`}
            >
              <Film className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
              Media Hub &amp; Blog
            </button>

            {/* ACADEMY REVIEWS */}
            <button 
              onClick={() => { setActivePortalTab('reviews'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activePortalTab === 'reviews' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
              }`}
            >
              <Star className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
              Academy Reviews
            </button>

            {/* CAREER & PLACEMENTS HUB */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'CAREER' || activeUser.role === 'REVIEWER') && (
              <button 
                onClick={() => { setActivePortalTab('career'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'career' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <Briefcase className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Placements Hub
              </button>
            )}

            {/* FINANCE fees & invoicing registry */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'FINANCE') && (
              <button 
                onClick={() => { setActivePortalTab('finance'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'finance' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                }`}
              >
                <DollarSign className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                Receipts Ledger
              </button>
            )}

            {/* SYSTEM CONFIGURATION, ADMIN MANAGEMENT, FRONT PAGE EDITOR & AUDITS */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD') && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('admin-management'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'admin-management' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Admin Access (MD)
                </button>

                <button 
                  onClick={() => { setActivePortalTab('front-page'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'front-page' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  Front Page Editor
                </button>

                <button 
                  onClick={() => { setActivePortalTab('settings'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'settings' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  <Settings className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
                  System Configurations
                </button>

                <div className="px-3 py-2">
                  <p className="text-[9px] font-bold tracking-widest text-[var(--sma-active-text-muted)] uppercase font-mono mb-2">Role Switcher</p>
                  <RoleSwitcher 
                    users={users}
                    activeUser={activeUser}
                    onSelectUser={handleSelectUser}
                  />
                </div>
              </>
            )}

            <button 
              onClick={() => { setActivePortalTab('library'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activePortalTab === 'library' ? 'bg-[var(--sma-role-accent-soft)] ring-1 ring-[var(--sma-role-accent)]/35 text-[var(--sma-role-accent-text)]' : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-active-text)]'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
              Public Library
            </button>

            <button
              type="button"
              onClick={() => {
                handleOpenProfileModal({
                  type: activeUser.role === 'STUDENT' ? 'STUDENT' : activeUser.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER',
                  id: activeUser.id
                }, true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-[var(--sma-active-text-muted)] hover:text-[var(--sma-role-accent-text)] hover:bg-[var(--sma-role-accent-soft)] transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[var(--sma-role-accent)] shrink-0" />
              Edit Profile &amp; Photo
            </button>

                </div>
              </>
            )}

          </div>

          {/* User Profile Footer section in Sidebar */}
          <button 
            type="button"
            onClick={() => handleOpenProfileModal({
              type: activeUser.role === 'STUDENT' ? 'STUDENT' : activeUser.role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'USER',
              id: activeUser.id
            })}
            className="p-4 border-t border-[#E5E1EA] dark:border-[#38384B] bg-[#F4F3F7]/70 dark:bg-[#151521]/40 flex items-center gap-3 hover:bg-[#F4F3F7] dark:hover:bg-[#242436] transition-colors cursor-pointer w-full text-left group"
            title="Open Individual Profile & Digital Identity Card"
          >
            <img 
              src={activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeUser.name)}`} 
              alt={activeUser.name}
              referrerPolicy="no-referrer"
              className={`w-9 h-9 rounded-full bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] group-hover:border-[var(--sma-role-accent)] transition-colors object-cover shrink-0 ${
                activeUser.avatarFocus === 'center' ? 'object-center' : 'object-top'
              }`}
            />
            <div className="truncate text-left flex-grow">
              <p className="text-xs font-bold text-[#25263A] dark:text-[#F5F3FA] group-hover:text-[var(--sma-role-accent-text)] transition-colors truncate">{activeUser.name}</p>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--sma-role-accent-text)] block">
                {activeUser.role.replace('_', ' ')} · Profile Settings
              </span>
            </div>
          </button>
        </aside>

        {/* WORKSPACE CONTENT FIELD - Rendered as a DIV so it is div:nth-of-type(1) inside div:nth-of-type(3) */}
        <div className="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          
          {/* Dashboard primary content area - Rendered as a DIV so it matches div#root > div > div:nth-of-type(3) > div > div */}
          <div className="space-y-6">



            {/* ACTIVE PORTAL TAB SWITCHER */}
            {(activePortalTab === 'overview' || activePortalTab === 'students' || activePortalTab === 'courses' || (activePortalTab === 'live-classes' && !activeInstructorProfile)) && 
             isStrictAdminRole(activeUser.role) && (
              <AdminPortal 
                activeRole={activeUser.role as any}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
                onOpenProfile={handleOpenProfileModal}
                onNavigate={(tab) => setActivePortalTab(tab)}
                initialSubTab={
                  activePortalTab === 'courses'
                    ? 'courses'
                    : activePortalTab === 'students'
                    ? 'students'
                    : activePortalTab === 'live-classes'
                    ? 'live-classes'
                    : 'registrations'
                }
              />
            )}

            {activePortalTab === 'course-management' && isStrictAdminRole(activeUser.role) && (
              <MajorMinorCourseManagementPanel
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'theme-settings' && isStrictAdminRole(activeUser.role) && activeUser.role !== 'REVIEWER' && (
              <AdminThemeConsole currentUser={activeUser} />
            )}

            {activePortalTab === 'tutor-assigned-courses' &&
              (isStrictAdminRole(activeUser.role) || activeUser.role === 'INSTRUCTOR') && (
                <TutorAssignedCoursesPanel
                  currentUser={activeUser}
                  instructorUser={activeInstructorProfile}
                  onRefreshAllData={handleRefreshAllData}
                />
              )}

            {(activePortalTab === 'attendance' || activePortalTab === 'assignments' || activePortalTab === 'live-classes' || activePortalTab === 'google-meet') && 
             (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER') && activeInstructorProfile && (
              <InstructorPortal 
                instructorUser={activeInstructorProfile}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
                onOpenProfile={handleOpenProfileModal}
                initialTab={
                  activePortalTab === 'live-classes'
                    ? 'live-class'
                    : activePortalTab === 'google-meet'
                    ? 'google-meet'
                    : 'attendance'
                }
              />
            )}

            {activePortalTab === 'cRM' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'COUNSELLOR') && (
              <CounsellorPortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'student-course-selection' &&
              (activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') &&
              activeStudentProfile && (
                <StudentCourseSelectionPanel
                  currentUser={activeUser}
                  studentUser={activeStudentProfile}
                  onRefreshAllData={handleRefreshAllData}
                />
              )}

            {(activePortalTab === 'student' || activePortalTab === 'course-papers' || activePortalTab === 'live-class' || activePortalTab === 'fees-pay' || activePortalTab === 'overview') && (activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') && activeStudentProfile && (
              <StudentPortal 
                studentUser={activeStudentProfile}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
                onOpenProfile={handleOpenProfileModal}
                initialTab={
                  activePortalTab === 'course-papers'
                    ? 'course-papers'
                    : activePortalTab === 'live-class'
                    ? 'live-class'
                    : activePortalTab === 'fees-pay'
                    ? 'fees'
                    : 'syllabus'
                }
              />
            )}

            {/* PARENT / GUARDIAN PORTAL RENDER - Strict Role Enforcement */}
            {activePortalTab === 'parent' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PARENT' || activeUser.role === 'REVIEWER') && (
              <ParentPortal 
                parentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'media' && (
              <MediaHubModule currentUser={activeUser} />
            )}

            {activePortalTab === 'reviews' && (
              <ReviewsPortal
                currentUser={activeUser}
                studentProfile={activeStudentProfile}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'exam-announcements' && (activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'SUPER_ADMIN') && (
              <ExamAnnouncementsPortal
                currentUser={activeUser}
                studentProfile={activeStudentProfile}
                onNavigateTab={(tab) => setActivePortalTab(tab)}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'exam-registration' && (
              <ExamRegistrationPortal
                currentUser={activeUser}
                studentProfile={activeStudentProfile}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'course-verification' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER' || activeUser.role === 'COUNSELLOR') && (
              <CourseVerificationPortal
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'exam-verification' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PRINCIPAL' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'REVIEWER') && (
              <ExaminationEngineModule
                mode="MD"
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'instructor-exams' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'ADMIN' || activeUser.role === 'REVIEWER') && (
              <ExaminationEngineModule
                mode="INSTRUCTOR"
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'exams' && (activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') && activeStudentProfile && (
              <ExaminationEngineModule
                mode="STUDENT"
                currentUser={activeUser}
                studentProfile={activeStudentProfile}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'career' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'CAREER' || activeUser.role === 'REVIEWER') && (
              <CareerPortal 
                onSelectPortfolio={(student) => {
                  setSelectedPortfolioStudent(student);
                  setCurrentView('portfolio');
                }}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'finance' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'FINANCE') && (
              <FinancePortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'admin-management' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD') && (
              <MdAdminManagementPanel
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {(activePortalTab === 'settings' || activePortalTab === 'front-page') && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD') && (
              <SettingsAuditPortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
                initialTab={activePortalTab === 'front-page' ? 'front-page' : 'academy'}
                onPreviewLanding={() => setCurrentView('landing')}
              />
            )}

            {activePortalTab === 'library' && (
              <LibraryPortal userRole={activeUser.role} />
            )}

            {activePortalTab === 'registration' && activeStudentProfile && (
              <CourseRegistrationPortal 
                studentUser={activeStudentProfile}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* QUICK-ACCESS SYSTEM MODAL OVERLAYS (Integrated with real local DB triggers!) */}
      {/* ========================================================================= */}

      {/* QUICK MODAL 1: GENERATE SYSTEM REPORT */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-[#151521]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
              <span className="text-[9px] font-mono font-bold text-[var(--sma-role-accent-text)] uppercase tracking-wider block">EXECUTIVE LEDGER AUDITOR</span>
              <h3 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">Generate Academic Performance Report</h3>
              <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Compiles students enrollment stats, overall attendance registers, and overdue balance ledgers into a secure analytical report.</p>
            </div>

            <form onSubmit={handleExportReportSubmit} className="space-y-4">
              {reportSuccess ? (
                <div className="p-4 bg-[#529B78]/10 border border-[#529B78]/30 text-[#2E7051] dark:text-[#76BD99] rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Analysis Completed Successfully!</p>
                  <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">PDF generated and logged to the global system audit ledger.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Target Cohort Group</label>
                    <select className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA]">
                      <option value="all">All Academy Students & Programs</option>
                      <option value="c-1">Advanced Diploma in Web Dev (SMA-ADWDVC)</option>
                      <option value="c-2">Diploma in AI Media Production (SMA-DAIMPIDM)</option>
                      <option value="c-3">AI & Business Communication (SMA-AIBC)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Report Analytics Depth</label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[#25263A] dark:text-[#F5F3FA]">
                      <label className="p-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7652A8] dark:accent-[#A985D6]" />
                        <span>Attendance Rates</span>
                      </label>
                      <label className="p-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7652A8] dark:accent-[#A985D6]" />
                        <span>Grading Ledger</span>
                      </label>
                      <label className="p-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7652A8] dark:accent-[#A985D6]" />
                        <span>Admissions Funnel</span>
                      </label>
                      <label className="p-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#7652A8] dark:accent-[#A985D6]" />
                        <span>Outstanding Dues</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(false)}
                      className="px-4 py-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:opacity-80 border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs text-[#555770] dark:text-[#B8B5C5] font-bold uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={exportingReport}
                      className="px-5 py-2 bg-[var(--sma-role-accent)] hover:bg-[var(--sma-role-accent-hover)] text-white dark:text-[#151521] text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors shadow-md flex items-center gap-1.5"
                    >
                      {exportingReport ? 'Running Analyzer...' : 'Compile Audit PDF'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 2: FAST NEW STUDENT ENROLLMENT */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 bg-[#151521]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsEnrollModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
              <span className="text-[9px] font-mono font-bold text-[var(--sma-role-accent-text)] uppercase tracking-wider block">ACADEMIC REGISTRAR</span>
              <h3 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">Fast-Track Student Enrollment</h3>
              <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Quickly register a new scholar and instantly deploy their default LMS database account.</p>
            </div>

            <form onSubmit={handleFastEnrollSubmit} className="space-y-4">
              {fastEnrollCapacityWarning && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Capacity Exceeded Notice</span>
                  </div>
                  <p className="text-[11px]">{fastEnrollCapacityWarning}</p>
                </div>
              )}

              {enrollSuccess ? (
                <div className="p-4 bg-[#529B78]/10 border border-[#529B78]/30 text-[#2E7051] dark:text-[#76BD99] rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Enrollment Authorized!</p>
                  <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Student and User database profile initialized.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Scholar Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={fastStudent.name}
                        onChange={(e) => setFastStudent({ ...fastStudent, name: e.target.value })}
                        placeholder="e.g. Rahul Nair"
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[var(--sma-role-accent)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={fastStudent.email}
                        onChange={(e) => setFastStudent({ ...fastStudent, email: e.target.value })}
                        placeholder="name@gmail.com"
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[var(--sma-role-accent)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Contact Number</label>
                      <input 
                        type="text" 
                        value={fastStudent.phone}
                        onChange={(e) => setFastStudent({ ...fastStudent, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[var(--sma-role-accent)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Syllabus Program</label>
                      {coursesList.length === 0 ? (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-700 dark:text-amber-300">
                          No courses created yet. Admin must add courses before fast enrollment.
                        </div>
                      ) : (
                        <select 
                          value={fastStudent.courseId}
                          onChange={(e) => {
                            const nextCourseId = e.target.value;
                            const nextSuggestion = suggestNextAvailableBatch(nextCourseId, batchesList, studentsList);
                            setFastStudent({
                              ...fastStudent,
                              courseId: nextCourseId,
                              batchId: nextSuggestion.batchId || fastStudent.batchId,
                            });
                            setFastEnrollCapacityWarning(null);
                            setFastEnrollOverrideConfirmed(false);
                          }}
                          className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                        >
                          {coursesList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold">Target Cohort Batch</label>
                        {(() => {
                          const selBatch = batchesList.find(b => b.id === fastStudent.batchId);
                          const count = studentsList.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
                          const maxCap = selBatch?.maxCapacity ?? 30;
                          const isFull = count >= maxCap;
                          return (
                            <span className={`text-[9px] font-mono ${isFull ? 'text-rose-500 font-bold' : 'text-[#529B78] dark:text-[#76BD99]'}`}>
                              {count}/{maxCap} {isFull ? 'FULL' : 'filled'}
                            </span>
                          );
                        })()}
                      </div>
                      <select 
                        value={fastStudent.batchId}
                        onChange={(e) => {
                          setFastStudent({ ...fastStudent, batchId: e.target.value });
                          setFastEnrollCapacityWarning(null);
                          setFastEnrollOverrideConfirmed(false);
                        }}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                      >
                        {batchesList.map(b => {
                          const count = studentsList.filter(s => s.batchId === b.id && s.status !== 'INACTIVE').length;
                          const maxCap = b.maxCapacity ?? 30;
                          const isFull = count >= maxCap;
                          const isSuggested = fastBatchSuggestion.batchId === b.id && fastBatchSuggestion.hasOpenSeats;
                          return (
                            <option key={b.id} value={b.id}>
                              {isSuggested ? '★ Suggested · ' : ''}{b.name} ({count}/{maxCap} {isFull ? '• FULL' : `• ${Math.max(0, maxCap - count)} open`})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* SMART BATCH SUGGESTION STRIP */}
                  {fastBatchSuggestion.batch && (
                    <div className="px-3 py-2 rounded-lg bg-[#529B78]/10 border border-[#529B78]/25 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-[#2E7051] dark:text-[#8AD0AC] leading-snug">
                        <span className="font-bold">Auto-Suggested:</span> {fastBatchSuggestion.batch.name} — {fastBatchSuggestion.reason}
                      </p>
                      {fastStudent.batchId !== fastBatchSuggestion.batchId && fastBatchSuggestion.hasOpenSeats && (
                        <button
                          type="button"
                          onClick={() => {
                            setFastStudent({ ...fastStudent, batchId: fastBatchSuggestion.batchId });
                            setFastEnrollCapacityWarning(null);
                            setFastEnrollOverrideConfirmed(false);
                          }}
                          className="px-2.5 py-1 bg-[#529B78] text-white rounded text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90"
                        >
                          Use Suggested
                        </button>
                      )}
                    </div>
                  )}

                  {/* BATCH CAPACITY WARNING BOX */}
                  {(() => {
                    const selBatch = batchesList.find(b => b.id === fastStudent.batchId);
                    const count = studentsList.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
                    const maxCap = selBatch?.maxCapacity ?? 30;
                    const isFull = count >= maxCap;

                    if (!isFull) return null;

                    return (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300 text-xs uppercase tracking-wide">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Target Batch Full Warning</span>
                        </div>
                        <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5] leading-snug">
                          <strong className="text-[#25263A] dark:text-[#F5F3FA]">{selBatch?.name}</strong> has reached its maximum capacity limit of <strong className="font-mono">{maxCap} students</strong> ({count}/{maxCap} filled).
                        </p>
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                          <input 
                            type="checkbox"
                            id="fastEnrollOverrideCheck"
                            checked={fastEnrollOverrideConfirmed}
                            onChange={(e) => setFastEnrollOverrideConfirmed(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#7652A8] dark:accent-[#A985D6] cursor-pointer rounded"
                          />
                          <label htmlFor="fastEnrollOverrideCheck" className="text-[11px] text-[#25263A] dark:text-[#F5F3FA] font-semibold cursor-pointer select-none">
                            I understand this batch is full and wish to proceed with enrollment
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnrollModalOpen(false);
                        setFastEnrollCapacityWarning(null);
                        setFastEnrollOverrideConfirmed(false);
                      }}
                      className="px-4 py-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:opacity-80 border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs text-[#555770] dark:text-[#B8B5C5] font-bold uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] dark:hover:bg-[#8AD0AC] text-white dark:text-[#151521] text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors shadow-md"
                    >
                      Issue Scholar Admission
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 3: BATCH HOUR SCHEDULER */}
      {isSchedModalOpen && (
        <div className="fixed inset-0 bg-[#151521]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsSchedModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
              <span className="text-[9px] font-mono font-bold text-[var(--sma-role-accent-text)] uppercase tracking-wider block">CLASSROOM COORDINATOR</span>
              <h3 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">Schedule Batch Hourly Session</h3>
              <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Configure custom daily time slots, assign rooms, and provision online study room links dynamically.</p>
            </div>

            <form onSubmit={handleFastScheduleSubmit} className="space-y-4">
              {scheduleSuccess ? (
                <div className="p-4 bg-[#529B78]/10 border border-[#529B78]/30 text-[#2E7051] dark:text-[#76BD99] rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Session Registered &amp; Synced!</p>
                  <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Batch timetable updated. Notification dispatched to students.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Target Batch</label>
                      <select 
                        value={fastSchedule.batchId}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, batchId: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                      >
                        <option value="b-1">Web Dev Elite Batch A</option>
                        <option value="b-2">Integrated Marketing Cohort B</option>
                        <option value="b-3">AI Business Weekend</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Course Syllabus</label>
                      {coursesList.length === 0 ? (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-700 dark:text-amber-300">
                          No active courses available.
                        </div>
                      ) : (
                        <select 
                          value={fastSchedule.courseId}
                          onChange={(e) => setFastSchedule({ ...fastSchedule, courseId: e.target.value })}
                          className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                        >
                          {coursesList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Subject Paper</label>
                      {subjectsList.length === 0 ? (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-700 dark:text-amber-300">
                          No subjects published yet.
                        </div>
                      ) : (
                        <select 
                          value={fastSchedule.subjectId}
                          onChange={(e) => setFastSchedule({ ...fastSchedule, subjectId: e.target.value })}
                          className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                        >
                          {subjectsList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Assign Faculty / Teacher Host</label>
                      <select
                        value={fastSchedule.instructorId}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, instructorId: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                      >
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Physical Room Lab</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.room}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, room: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[var(--sma-role-accent)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Session Mode</label>
                      <select 
                        value={fastSchedule.type}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, type: e.target.value as any })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                      >
                        <option value="HYBRID">Hybrid Broadcast (Meet + Studio)</option>
                        <option value="ONLINE">Google Meet Live Class</option>
                        <option value="PHYSICAL">Physical Attendance only</option>
                        <option value="LAB">Concept Sandbox Laboratory</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Google Meet Link</label>
                      <a
                        href="https://meet.google.com/new"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#477DBB] dark:text-[#75A7E0] hover:underline"
                      >
                        Create Instant Meet ↗
                      </a>
                    </div>
                    <input
                      type="text"
                      value={fastSchedule.googleMeetUrl}
                      onChange={(e) => setFastSchedule({ ...fastSchedule, googleMeetUrl: e.target.value })}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono focus:outline-none focus:border-[var(--sma-role-accent)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">WhatsApp Group Invite</label>
                      <input
                        type="text"
                        value={fastSchedule.whatsappGroupUrl}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, whatsappGroupUrl: e.target.value })}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono focus:outline-none focus:border-[#529B78]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Group Label</label>
                      <input
                        type="text"
                        value={fastSchedule.whatsappGroupName}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, whatsappGroupName: e.target.value })}
                        placeholder="Batch WhatsApp Group"
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#529B78]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Date</label>
                      <input 
                        type="date" 
                        required
                        value={fastSchedule.date}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, date: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-2 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">Start Time</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.startTime}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, startTime: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-2 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold font-mono">End Time</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.endTime}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, endTime: e.target.value })}
                        className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-2 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsSchedModalOpen(false)}
                      className="px-4 py-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:opacity-80 border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs text-[#555770] dark:text-[#B8B5C5] font-bold uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#477DBB] hover:bg-[#3B6CA4] dark:bg-[#75A7E0] dark:hover:bg-[#8BB7EA] text-white dark:text-[#151521] text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors shadow-md"
                    >
                      Deploy Hour Slot
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Individual Profile Modal View */}
      <IndividualProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setProfileInitialEditMode(false);
        }}
        target={profileTarget}
        currentUser={activeUser}
        initialEditMode={profileInitialEditMode}
        onUserUpdated={(updatedUser) => {
          if (activeUser && updatedUser.id === activeUser.id) {
            setActiveUser(updatedUser);
          }
        }}
        onRequestReauth={openReauthModal}
        onRefreshAllData={handleRefreshAllData}
      />

      {/* Re-Authenticate with Username & Password Modal */}
      {isReauthModalOpen && (
        <div className="fixed inset-0 bg-[#151521]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-2xl max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setIsReauthModalOpen(false)}
              aria-label="Close re-authentication dialog"
              className="absolute top-4 right-4 p-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-[#E5E1EA] dark:border-[#38384B] pb-3 pr-8">
              <span className="text-[10px] font-mono font-bold text-[#7652A8] dark:text-[#A985D6] uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                {reauthForgotMode ? 'ACCOUNT PASSWORD RECOVERY' : 'SESSION VERIFICATION'}
              </span>
              <h3 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                {reauthForgotMode ? 'Reset or Recover Your Password' : 'Re-Auth with Username & Password'}
              </h3>
              <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">
                {reauthForgotMode
                  ? 'Request a password reset email directly, launch interactive recovery with Maya Assistant, or switch to the full password reset screen.'
                  : 'Confirm your current session or re-authenticate into another authorized account using Username & Password.'}
              </p>
            </div>

            {!reauthForgotMode ? (
              <form onSubmit={handleReauthSubmit} className="space-y-4">
                {/* Dual Auth Connection Summary */}
                <div className="p-3 rounded-xl bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div>
                    <span className="font-mono uppercase text-[10px] text-[#555770] dark:text-[#B8B5C5] block">Username Session</span>
                    <span className="font-bold text-[#25263A] dark:text-[#F5F3FA]">@{activeUser.username || activeUser.email?.split('@')[0]}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono uppercase text-[10px] text-[#555770] dark:text-[#B8B5C5] block">Firebase Cloud Auth</span>
                    <span className={`font-bold ${auth.currentUser ? 'text-[#2E7051] dark:text-[#76BD99]' : 'text-amber-600 dark:text-amber-400'}`}>
                      {auth.currentUser?.email || 'Not Linked'}
                    </span>
                  </div>
                </div>

                {reauthError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{reauthError}</span>
                  </div>
                )}

                {reauthSuccess && (
                  <div className="p-3 rounded-xl bg-[#529B78]/12 border border-[#529B78]/35 text-xs text-[#2E7051] dark:text-[#76BD99] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{reauthSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5] block">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={reauthUsername}
                    onChange={(e) => setReauthUsername(e.target.value)}
                    placeholder="Enter username or email"
                    className="w-full bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5] block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setReauthResetEmail(
                          (reauthUsername.includes('@') ? reauthUsername : activeUser?.email || '').trim()
                        );
                        setReauthResetError(null);
                        setReauthResetSuccess(null);
                        setReauthForgotMode(true);
                      }}
                      className="text-[11px] font-semibold text-[#7652A8] dark:text-[#A985D6] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showReauthPassword ? 'text' : 'password'}
                      required
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowReauthPassword(!showReauthPassword)}
                      aria-label={showReauthPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] cursor-pointer"
                    >
                      {showReauthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {lastReauthAt && (
                  <p className="text-[10px] font-mono text-[#529B78] dark:text-[#76BD99]">
                    Last verified: {new Date(lastReauthAt).toLocaleString()}
                  </p>
                )}

                <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] space-y-2.5">
                  <div className="flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsReauthModalOpen(false)}
                      className="px-4 py-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl text-xs font-bold text-[#555770] dark:text-[#B8B5C5] cursor-pointer whitespace-nowrap"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reauthLoading}
                      className="px-5 py-2 bg-[#7652A8] hover:bg-[#614091] dark:bg-[#A985D6] dark:hover:bg-[#B898E0] text-white dark:text-[#151521] text-xs font-mono font-bold uppercase rounded-xl cursor-pointer transition-colors shadow-md flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{reauthLoading ? 'Verifying...' : 'Verify Username Auth'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={reauthLoading}
                    onClick={handleFirebaseReauth}
                    className="w-full py-2.5 bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] hover:border-[#7652A8] dark:hover:border-[#A985D6] rounded-xl text-xs font-bold text-[#25263A] dark:text-[#F5F3FA] flex items-center justify-center gap-2.5 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      className="w-4 h-4"
                    />
                    <span>{auth.currentUser ? 'Re-Verify via Firebase Google Auth' : 'Connect Firebase Google Auth'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReauthPasswordResetSubmit} className="space-y-4">
                {reauthResetError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{reauthResetError}</span>
                  </div>
                )}

                {reauthResetSuccess && (
                  <div className="p-3 rounded-xl bg-[#529B78]/12 border border-[#529B78]/35 text-xs text-[#2E7051] dark:text-[#76BD99] font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{reauthResetSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5] block">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={reauthResetEmail}
                    onChange={(e) => setReauthResetEmail(e.target.value)}
                    placeholder="name@swanayamedia.com"
                    className="w-full bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={reauthResetLoading}
                    className="w-full py-2.5 px-4 bg-[#7652A8] hover:bg-[#614091] dark:bg-[#A985D6] dark:hover:bg-[#B898E0] text-white dark:text-[#151521] text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap"
                  >
                    {reauthResetLoading ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartChatbotRecovery(reauthResetEmail)}
                      className="py-2 px-3 bg-[#529B78]/12 hover:bg-[#529B78]/20 dark:bg-[#76BD99]/15 text-[#2E7051] dark:text-[#76BD99] border border-[#529B78]/35 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chatbot Recovery</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRedirectToPasswordReset(reauthResetEmail)}
                      className="py-2 px-3 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] text-[#25263A] dark:text-[#F5F3FA] hover:border-[#7652A8] rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Open Reset Flow</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setReauthForgotMode(false)}
                    className="text-xs font-semibold text-[#7652A8] dark:text-[#A985D6] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Re-Authentication</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReauthModalOpen(false)}
                    className="px-3.5 py-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs font-semibold text-[#555770] dark:text-[#B8B5C5] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Floating WhatsApp & Instagram Quick Buttons */}
      <FloatingSocialButtons
        hidden={floatingChatOpen}
        whatsappNumber={settings.adminWhatsAppPhone || settings.phone}
        instagramUrl="https://www.instagram.com/swanaya_media_acedemy_for_ai/"
      />

      {/* Floating Woman Mascot Chatbot Widget */}
      <AcademyFloatingMascotChat
        mode="portal"
        userName={activeUser.name}
        userEmail={activeUser.email}
        userRole={activeUser.role}
        courseContext={activeStudentProfile ? "Digital Media & Web Development" : undefined}
        externalOpen={floatingChatOpen}
        onExternalOpenChange={setFloatingChatOpen}
        recoveryTrigger={chatbotRecoveryTrigger}
        onRedirectToPasswordReset={handleRedirectToPasswordReset}
      />

      {/* Auto-Saved Notification Toast */}
      {autoSaveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-black px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4" />
          <span>Auto-Saved to Database</span>
        </div>
      )}

    </div>
  );
}
