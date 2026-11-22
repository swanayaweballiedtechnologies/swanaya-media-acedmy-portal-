/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Users, BookOpen, Layers, UserCheck, Calendar, GraduationCap, DollarSign, 
  Plus, Edit, Eye, EyeOff, Globe, Trash2, Search, Filter, Check, X, FileText, MoveUp, MapPin, Sparkles, AlertTriangle,
  MessageCircle, ExternalLink, Phone, RefreshCw, ShieldCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Video, TrendingUp, Palette
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  SwanayaDatabase, Student, Course, Batch, User, Instructor, Semester, Subject, AdmissionApplication, Lead, ExamCenter 
} from '../db/mockDb';
import InstructorAllocation from './InstructorAllocation';
import AdminCourseMaterialsPanel from './AdminCourseMaterialsPanel';
import LiveClassMeetWhatsAppPanel from './LiveClassMeetWhatsAppPanel';
import GoogleMeetStudioPanel from './GoogleMeetStudioPanel';
import FinancePortal from './FinancePortal';
import CourseMappingEnginePortal from './CourseMappingEnginePortal';
import MajorMinorCourseManagementPanel from './MajorMinorCourseManagementPanel';
import AdminThemeConsole from './AdminThemeConsole';
import { academyService, isPublishedCourse } from '../services/academyService';
import { auth } from '../firebase';
import { suggestNextAvailableBatch } from '../utils/batchCapacity';

interface AdminPortalProps {
  activeRole: 'SUPER_ADMIN' | 'ADMIN' | 'ACADEMIC_ADMIN' | 'MD' | 'PRINCIPAL' | 'REVIEWER';
  currentUser: User;
  onRefreshAllData: () => void;
  onOpenProfile?: (target: { type: 'STUDENT' | 'INSTRUCTOR' | 'USER'; id: string }) => void;
  onNavigate?: (tab: string) => void;
  initialSubTab?: string;
}

export default function AdminPortal({ activeRole, currentUser, onRefreshAllData, onOpenProfile, onNavigate, initialSubTab }: AdminPortalProps) {
  // State from LocalStorage + Firestore real-time subscription for courses
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState<boolean>(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [courseNotice, setCourseNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<Course | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState<boolean>(false);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(Boolean(auth.currentUser));

  const [batches, setBatches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>("batches"));
  const [instructors, setInstructors] = useState<Instructor[]>(() => SwanayaDatabase.get<Instructor[]>("instructors"));
  const [semesters, setSemesters] = useState<Semester[]>(() => SwanayaDatabase.get<Semester[]>("semesters"));
  const [subjects, setSubjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [applications, setApplications] = useState<AdmissionApplication[]>(() => SwanayaDatabase.get<AdmissionApplication[]>("applications"));

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseConnected(Boolean(fbUser));
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    setCoursesLoading(true);
    setCoursesError(null);
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: true,
      onData: (fetched) => {
        setCourses(fetched);
        setCoursesLoading(false);
        setCoursesError(null);
      },
      onError: (err) => {
        setCoursesError(err.message || 'Unable to sync course catalog from Firestore.');
        setCoursesLoading(false);
      },
    });
    return () => unsubscribe();
  }, [firebaseConnected]);

  const handleConnectGoogleAdmin = async (): Promise<boolean> => {
    setCourseNotice(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const authed = Boolean(cred?.user || auth.currentUser);
      setFirebaseConnected(authed);
      if (authed) {
        setCourseNotice({
          type: 'success',
          text: `Connected Admin Google session (${cred?.user?.email || auth.currentUser?.email || 'Admin'}). Cloud course editing, deletion, and PDF uploads are enabled.`,
        });
      }
      return authed;
    } catch (err: any) {
      setCourseNotice({
        type: 'error',
        text: err?.message || 'Google Admin connection was cancelled or failed.',
      });
      return false;
    }
  };

  // Batch capacity verification states for student modal
  const [studentModalOverrideConfirmed, setStudentModalOverrideConfirmed] = useState(false);
  const [studentModalCapacityWarning, setStudentModalCapacityWarning] = useState<string | null>(null);

  // Navigation Sub-tab within Admin portal
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab || 'registrations');
  const [subTabDropdownOpen, setSubTabDropdownOpen] = useState<boolean>(false);

  const adminSubTabs = [
    {
      id: 'registrations',
      label: 'Registrations',
      icon: UserCheck,
      description: 'Applicant & Student enrollments',
    },
    {
      id: 'courses',
      label: 'Courses & Syllabus',
      icon: BookOpen,
      description: 'Curriculum & course configurations',
    },
    {
      id: 'course-management',
      label: 'Major & Minor Courses',
      icon: GraduationCap,
      description: 'Major/Minor programmes, tutor allocations & approvals',
    },
    {
      id: 'course-mapping',
      label: 'Course Mapping Engine',
      icon: BookOpen,
      description: 'A-Z curriculum, subject, exam & certificate mapping',
    },
    {
      id: 'materials',
      label: 'Course Materials',
      icon: FileText,
      description: 'PDF papers, notes & uploads',
    },
    {
      id: 'live-classes',
      label: 'Meet & WhatsApp Groups',
      icon: MessageCircle,
      description: 'Live lectures & cohort channels',
    },
    {
      id: 'google-meet',
      label: 'Google Meet Studio',
      icon: Video,
      description: 'Calendar scheduling & Meet rooms',
    },
    {
      id: 'students',
      label: 'Students CRM',
      icon: Users,
      description: 'Student directory & records',
    },
    {
      id: 'occupancy',
      label: 'Batch Occupancy',
      icon: TrendingUp,
      description: 'Capacity planning & analytics',
    },
    {
      id: 'allocation',
      label: 'Faculty',
      icon: GraduationCap,
      description: 'Instructor allocation & trainers',
    },
    {
      id: 'admissions',
      label: 'Admissions Inbox',
      icon: Layers,
      description: 'Prospect applications pipeline',
    },
    {
      id: 'curriculum',
      label: 'Curriculum Builder',
      icon: BookOpen,
      description: 'Semester & subject structure',
    },
    {
      id: 'finance-verification',
      label: 'Fee & UPI Verification',
      icon: DollarSign,
      description: 'Verify GPay UTRs & issue PDF receipts',
    },
    {
      id: 'theme',
      label: 'Theme & Colour Console',
      icon: Palette,
      description: 'Global colour palette & dark/light theme manager',
    },
    ...(activeRole === 'SUPER_ADMIN'
      ? [
          {
            id: 'overview',
            label: 'System Health',
            icon: ShieldCheck,
            description: 'Audit logs & system overview',
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);


  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('adminName') as HTMLInputElement).value;
    const email = (form.elements.namedItem('adminEmail') as HTMLInputElement).value;
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
      isVerified: true
    };
    const users = SwanayaDatabase.get<User[]>("users");
    SwanayaDatabase.set("users", [...users, newUser]);
    onRefreshAllData();
    setCourseNotice({ type: 'success', text: `Admin "${name}" (${email}) added to local registry.` });
    form.reset();
  };

  const handleClearPreloadedContent = () => {
    SwanayaDatabase.clearAllPreloadedData();
    setStudents([]);
    setBatches([]);
    setInstructors([]);
    setSemesters([]);
    setSubjects([]);
    setApplications([]);
    setCourseNotice({
      type: 'success',
      text: 'Cleared local demo students, batches, subjects, and registrations. Live Firestore courses remain preserved.',
    });
    onRefreshAllData();
  };

  const handleRestoreDefaultContent = () => {
    SwanayaDatabase.restoreDefaultData();
    setStudents(SwanayaDatabase.get<Student[]>("students"));
    setCourses(SwanayaDatabase.get<Course[]>("courses"));
    setBatches(SwanayaDatabase.get<Batch[]>("batches"));
    setInstructors(SwanayaDatabase.get<Instructor[]>("instructors"));
    setSemesters(SwanayaDatabase.get<Semester[]>("semesters"));
    setSubjects(SwanayaDatabase.get<Subject[]>("subjects"));
    setApplications(SwanayaDatabase.get<AdmissionApplication[]>("applications"));
    onRefreshAllData();
  };

  // Search & Filter state for lists
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilterCourse, setStudentFilterCourse] = useState('ALL');
  
  // Modals / Editors state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    phone: '',
    whatsappPhone: '',
    whatsappOptIn: true,
    guardianName: '',
    guardianPhone: '',
    academicBackground: '',
    courseId: 'c-1',
    batchId: 'b-1',
    semesterId: 's-1-1',
    skills: '',
    outstandingBalance: 0
  });

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    name: '',
    description: '',
    duration: '12 Months',
    level: 'ADVANCED' as Course['level'],
    eligibility: '',
    fee: 0,
    mode: 'HYBRID' as 'PHYSICAL' | 'ONLINE' | 'HYBRID',
    coordinator: '',
    isPublished: true
  });

  // Curriculum Builder additions
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterCourse, setNewSemesterCourse] = useState('c-1');
  const [multiPaperModalOpen, setMultiPaperModalOpen] = useState(false);
  const [multiPaperSemesterId, setMultiPaperSemesterId] = useState('s-1-1');
  const [multiPaperText, setMultiPaperText] = useState('');
  const [newSubjectForm, setNewSubjectForm] = useState({
    semesterId: 's-1-1',
    code: '',
    name: '',
    credits: 4,
    hours: 60,
    description: '',
    instructorId: 'inst-1'
  });

  // Sync state helpers
  const saveStudents = (newStudents: Student[]) => {
    SwanayaDatabase.set("students", newStudents);
    setStudents(newStudents);
    onRefreshAllData();
  };

  const saveCourses = (newCourses: Course[]) => {
    SwanayaDatabase.set("courses", newCourses);
    setCourses(newCourses);
    onRefreshAllData();
  };

  // Student Actions
  const handleOpenStudentModal = (student: Student | null) => {
    setStudentModalOverrideConfirmed(false);
    setStudentModalCapacityWarning(null);
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        name: student.name,
        email: student.email,
        phone: student.phone,
        whatsappPhone: student.whatsappPhone || student.phone || '',
        whatsappOptIn: student.whatsappOptIn ?? true,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        academicBackground: student.academicBackground,
        courseId: student.courseId,
        batchId: student.batchId,
        semesterId: student.semesterId,
        skills: student.skills.join(', '),
        outstandingBalance: student.outstandingBalance
      });
    } else {
      setEditingStudent(null);
      const initCourseId = courses[0]?.id || 'c-1';
      const suggested = suggestNextAvailableBatch(initCourseId, batches, students);
      const matchingSemester = semesters.find((s) => s.courseId === initCourseId)?.id || semesters[0]?.id || 's-1-1';
      setStudentForm({
        name: '',
        email: '',
        phone: '',
        whatsappPhone: '',
        whatsappOptIn: true,
        guardianName: '',
        guardianPhone: '',
        academicBackground: '',
        courseId: initCourseId,
        batchId: suggested.batchId || batches[0]?.id || 'b-1',
        semesterId: matchingSemester,
        skills: 'HTML5, CSS, React',
        outstandingBalance: 145000
      });
    }
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();

    // Check target batch capacity
    const targetBatch = batches.find(b => b.id === studentForm.batchId);
    // If editing existing student and they remain in the same batch, exclude them from count
    const enrolledCount = students.filter(s => 
      s.batchId === studentForm.batchId && 
      s.status !== 'INACTIVE' && 
      (!editingStudent || s.id !== editingStudent.id)
    ).length;
    const maxCapacity = targetBatch?.maxCapacity ?? 30;

    if (enrolledCount >= maxCapacity && !studentModalOverrideConfirmed) {
      setStudentModalCapacityWarning(`⚠️ Target Batch Full: ${targetBatch?.name || 'Selected batch'} has reached its capacity limit of ${maxCapacity} students (${enrolledCount}/${maxCapacity} filled). Please check the override box to proceed.`);
      return;
    }

    setStudentModalCapacityWarning(null);

    const finalWhatsapp = studentForm.whatsappPhone.trim() || studentForm.phone.trim() || '+91 94460 00000';

    if (editingStudent) {
      // Edit
      const updated = students.map(s => s.id === editingStudent.id ? {
        ...s,
        name: studentForm.name,
        email: studentForm.email,
        phone: studentForm.phone,
        whatsappPhone: finalWhatsapp,
        whatsappOptIn: studentForm.whatsappOptIn,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
        academicBackground: studentForm.academicBackground,
        courseId: studentForm.courseId,
        batchId: studentForm.batchId,
        semesterId: studentForm.semesterId,
        skills: studentForm.skills.split(',').map(sk => sk.trim()).filter(Boolean),
        outstandingBalance: Number(studentForm.outstandingBalance)
      } : s);
      saveStudents(updated);
      SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_UPDATE", `Student: ${studentForm.name} (WhatsApp: ${finalWhatsapp})`);
      const studentObj = updated.find(s => s.id === editingStudent.id);
      const userObj = SwanayaDatabase.get<User[]>("users").find(u => u.id === editingStudent.userId || u.email === editingStudent.email);
      if (userObj && studentObj) {
        academyService.syncProfileToCloud({
          ...userObj,
          name: studentObj.name,
          email: studentObj.email,
          phone: studentObj.phone,
          whatsappPhone: studentObj.whatsappPhone,
          avatarUrl: studentObj.avatarUrl
        }, studentObj).catch(e => console.warn('Student sync note:', e));
      }
    } else {
      // Create
      const newId = `stud-${Date.now()}`;
      const admissionNum = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const studentIdCode = `SMA-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newStudent: Student = {
        id: newId,
        studentId: studentIdCode,
        admissionNumber: admissionNum,
        userId: `usr-${Date.now()}`,
        name: studentForm.name,
        email: studentForm.email,
        phone: studentForm.phone,
        whatsappPhone: finalWhatsapp,
        whatsappOptIn: studentForm.whatsappOptIn,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
        academicBackground: studentForm.academicBackground,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentForm.name}`,
        status: 'ACTIVE',
        courseId: studentForm.courseId,
        batchId: studentForm.batchId,
        semesterId: studentForm.semesterId,
        enrollmentDate: new Date().toISOString().split('T')[0],
        skills: studentForm.skills.split(',').map(sk => sk.trim()).filter(Boolean),
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: Number(studentForm.outstandingBalance),
        careerReadinessScore: 35
      };
      
      // Also write User record for them so they can log in!
      const usersList = SwanayaDatabase.get<User[]>("users");
      const newUser: User = {
        id: newStudent.userId,
        email: studentForm.email,
        name: studentForm.name,
        role: 'STUDENT',
        avatarUrl: newStudent.avatarUrl,
        status: 'ACTIVE',
        createdAt: newStudent.enrollmentDate
      };
      SwanayaDatabase.set("users", [...usersList, newUser]);

      saveStudents([...students, newStudent]);
      SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_CREATE", `Student: ${studentForm.name}`);

      academyService.syncProfileToCloud(newUser, newStudent).catch(e => console.warn('New student cloud sync note:', e));
    }
    setIsStudentModalOpen(false);
  };

  const handleDeactivateStudent = (id: string, name: string) => {
    const updated = students.map(s => s.id === id ? { ...s, status: s.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const } : s);
    saveStudents(updated);
    SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_STATUS_TOGGLE", `Student: ${name}`);
  };

  // Course Actions
  const handleOpenCourseModal = (course: Course | null) => {
    setCourseNotice(null);
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        code: course.code,
        name: course.name,
        description: course.description,
        duration: course.duration,
        level: course.level,
        eligibility: course.eligibility,
        fee: course.fee,
        mode: course.mode,
        coordinator: course.coordinator,
        isPublished: isPublishedCourse(course)
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        code: 'SMA-',
        name: '',
        description: '',
        duration: '6 Months',
        level: 'DIPLOMA',
        eligibility: '12th Standard or Equivalent',
        fee: 65000,
        mode: 'PHYSICAL',
        coordinator: 'Devika Menon',
        isPublished: true
      });
    }
    setIsCourseModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseNotice(null);
    setSavingCourse(true);
    try {
      if (!auth.currentUser) {
        const connected = await handleConnectGoogleAdmin();
        if (!connected || !auth.currentUser) {
          setSavingCourse(false);
          return;
        }
      }

      const courseId = editingCourse ? editingCourse.id : `c-${Date.now()}`;
      const publishedFlag = Boolean(courseForm.isPublished);
      const courseData: Course = {
        id: courseId,
        code: (courseForm.code.trim() || 'SMA-NEW').toUpperCase(),
        name: (courseForm.name.trim() || 'New Academy Program'),
        description: courseForm.description.trim() || 'Comprehensive industry curriculum module.',
        duration: courseForm.duration || '6 Months',
        level: courseForm.level || 'DIPLOMA',
        eligibility: courseForm.eligibility || '12th Standard or Equivalent',
        fee: Number(courseForm.fee) || 0,
        mode: courseForm.mode || 'PHYSICAL',
        coordinator: courseForm.coordinator || 'Devika Menon',
        status: publishedFlag ? 'ACTIVE' : 'ARCHIVED',
        isPublished: publishedFlag,
        thumbnailUrl: (editingCourse as any)?.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
        learningObjectives: (editingCourse as any)?.learningObjectives && (editingCourse as any).learningObjectives.length > 0 
          ? (editingCourse as any).learningObjectives 
          : [
            'Master core concepts and tools',
            'Build production-ready portfolios'
          ],
        careerOutcomes: (editingCourse as any)?.careerOutcomes && (editingCourse as any).careerOutcomes.length > 0
          ? (editingCourse as any).careerOutcomes
          : [
            'Industry Professional',
            'Certified Media Specialist'
          ]
      };

      await academyService.createCourse(courseData);

      try {
        SwanayaDatabase.log(
          currentUser?.email || 'admin@swanayamedia.com',
          currentUser?.name || 'Administrator',
          editingCourse ? "COURSE_UPDATE" : "COURSE_CREATE",
          `Course: ${courseData.name} (${courseData.code}) [${publishedFlag ? 'PUBLISHED' : 'DRAFT'}]`
        );
      } catch (logErr) {
        console.warn('Audit log write notice:', logErr);
      }

      setIsCourseModalOpen(false);
      setEditingCourse(null);
      if (typeof onRefreshAllData === 'function') {
        onRefreshAllData();
      }
      setCourseNotice({
        type: 'success',
        text: `Course "${courseData.name}" (${courseData.code}) saved to Firestore (${publishedFlag ? 'Published to registration catalog' : 'Saved as unpublished draft'}).`,
      });
    } catch (err: any) {
      const msg = err?.message || 'Unable to save course.';
      const currentGoogleEmail = auth.currentUser?.email;
      setCourseNotice({
        type: 'error',
        text: msg.includes('permission-denied')
          ? `Signed-in Google account (${currentGoogleEmail || 'unknown'}) lacks Admin write permission in Firestore. Please click "Connect Admin Google" with an authorized Swanaya Admin account.`
          : msg.includes('ADMIN_FIREBASE_AUTH_REQUIRED') || !auth.currentUser
          ? 'Please click "Connect Admin Google" above with an authorized Swanaya Admin email to save changes to Firestore.'
          : `Failed to save course: ${msg}`,
      });
    } finally {
      setSavingCourse(false);
    }
  };

  const handleToggleCoursePublish = async (course: Course) => {
    setCourseNotice(null);
    const nextPublished = !isPublishedCourse(course);
    try {
      if (!auth.currentUser) {
        const connected = await handleConnectGoogleAdmin();
        if (!connected || !auth.currentUser) return;
      }

      await academyService.setCoursePublishState(course.id, nextPublished);
      SwanayaDatabase.log(
        currentUser?.email || 'admin@swanayamedia.com',
        currentUser?.name || 'Administrator',
        nextPublished ? 'COURSE_PUBLISH' : 'COURSE_UNPUBLISH',
        `Course ${course.name} (${course.code})`
      );
      setCourseNotice({
        type: 'success',
        text: `"${course.name}" is now ${nextPublished ? 'Published on landing & registration pages' : 'Unpublished (hidden from registration dropdowns)'}.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      const msg = err?.message || '';
      const currentGoogleEmail = auth.currentUser?.email;
      setCourseNotice({
        type: 'error',
        text: msg.includes('permission-denied')
          ? `Signed-in Google account (${currentGoogleEmail || 'unknown'}) lacks Admin permission to update course status in Firestore.`
          : !auth.currentUser || msg.includes('ADMIN_FIREBASE_AUTH_REQUIRED')
          ? 'Connect Admin Google account to publish or unpublish courses in Firestore.'
          : msg || 'Failed to update course publication state.',
      });
    }
  };

  const handleDeleteCourseConfirm = async () => {
    if (!confirmDeleteCourse) return;
    setDeletingCourseId(confirmDeleteCourse.id);
    setCourseNotice(null);
    try {
      if (!auth.currentUser) {
        const connected = await handleConnectGoogleAdmin();
        if (!connected || !auth.currentUser) {
          setDeletingCourseId(null);
          return;
        }
      }

      await academyService.deleteCourse(confirmDeleteCourse.id);
      SwanayaDatabase.log(
        currentUser?.email || 'admin@swanayamedia.com',
        currentUser?.name || 'Administrator',
        'COURSE_DELETE',
        `Deleted course ${confirmDeleteCourse.name} (${confirmDeleteCourse.code})`
      );
      setCourseNotice({
        type: 'success',
        text: `Deleted course "${confirmDeleteCourse.name}" (${confirmDeleteCourse.code}) from Firestore.`,
      });
      setConfirmDeleteCourse(null);
      onRefreshAllData();
    } catch (err: any) {
      const msg = err?.message || '';
      const currentGoogleEmail = auth.currentUser?.email;
      setCourseNotice({
        type: 'error',
        text: msg.includes('permission-denied')
          ? `Signed-in Google account (${currentGoogleEmail || 'unknown'}) is not authorized to delete courses in Firestore. Please connect with an Admin Google email (e.g. swanayamediaenterprisesadmins@gmail.com).`
          : !auth.currentUser || msg.includes('ADMIN_FIREBASE_AUTH_REQUIRED')
          ? 'Connect Admin Google account to delete courses from Firestore.'
          : msg || 'Failed to delete course.',
      });
      setConfirmDeleteCourse(null);
    } finally {
      setDeletingCourseId(null);
    }
  };

  const handleCommitAndExportSyllabus = (courseName: string) => {
    setCourseNotice({
      type: 'success',
      text: `Official Syllabus Document committed for "${courseName}".`,
    });
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SYLLABUS_COMMIT_PDF", `Exported syllabus PDF for ${courseName}`);
  };

  const handleBatchAddPapers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiPaperText.trim()) return;
    const lines = multiPaperText.split('\n').filter(l => l.trim().length > 0);
    const allSubjects = SwanayaDatabase.get<Subject[]>("subjects");
    const newSubs: Subject[] = lines.map((line, idx) => {
      const parts = line.split(':');
      const code = parts[1] ? parts[0].trim() : `SMA-P-${Date.now()}-${idx}`;
      const name = parts[1] ? parts[1].trim() : parts[0].trim();
      return {
        id: `sub-batch-${Date.now()}-${idx}`,
        semesterId: multiPaperSemesterId || semesters[0]?.id || 's-1-1',
        code,
        name,
        credits: 4,
        hours: 60,
        description: 'Mapped multi-paper program curriculum module.',
        learningOutcomes: ['Complete practical paper requirements', 'Pass modular assessment'],
        instructorId: 'inst-1',
        assessmentMethod: 'Semester Exam + Continuous Assessment'
      };
    });

    const updated = [...allSubjects, ...newSubs];
    SwanayaDatabase.set("subjects", updated);
    setSubjects(updated);
    setMultiPaperText('');
    setMultiPaperModalOpen(false);
    setCourseNotice({
      type: 'success',
      text: `Successfully committed and mapped ${newSubs.length} paper programs to curriculum.`,
    });
    SwanayaDatabase.log(currentUser.email, currentUser.name, "CURRICULUM_BATCH_COMMIT", `Committed ${newSubs.length} multi-paper programs`);
    onRefreshAllData();
  };

  // Curriculum Build Actions
  const handleAddSemester = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterName.trim()) return;
    const newId = `s-${Date.now()}`;
    const newSem: Semester = {
      id: newId,
      courseId: newSemesterCourse,
      name: newSemesterName,
      code: `${courses.find(c=>c.id===newSemesterCourse)?.code || 'SMA'}-S${semesters.filter(s=>s.courseId===newSemesterCourse).length + 1}`
    };
    const updated = [...semesters, newSem];
    SwanayaDatabase.set("semesters", updated);
    setSemesters(updated);
    setNewSemesterName('');
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SEMESTER_CREATE", `Semester: ${newSem.name}`);
    onRefreshAllData();
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectForm.name.trim() || !newSubjectForm.code.trim()) return;
    const newId = `sub-${Date.now()}`;
    const newSub: Subject = {
      id: newId,
      semesterId: newSubjectForm.semesterId,
      code: newSubjectForm.code,
      name: newSubjectForm.name,
      credits: Number(newSubjectForm.credits),
      hours: Number(newSubjectForm.hours),
      description: newSubjectForm.description,
      learningOutcomes: ["Deliver validated technical outputs", "Formulate real-time solutions with code"],
      instructorId: newSubjectForm.instructorId,
      assessmentMethod: "Course assignments + Viva evaluation"
    };
    const updated = [...subjects, newSub];
    SwanayaDatabase.set("subjects", updated);
    setSubjects(updated);
    setNewSubjectForm({
      semesterId: 's-1-1',
      code: '',
      name: '',
      credits: 4,
      hours: 60,
      description: '',
      instructorId: 'inst-1'
    });
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SUBJECT_CREATE", `Subject: ${newSub.name}`);
    onRefreshAllData();
  };

  const handleApproveApplication = (appId: string) => {
    const updatedApps = applications.map(app => app.id === appId ? { ...app, status: 'ACCEPTED' as const } : app);
    SwanayaDatabase.set("applications", updatedApps);
    setApplications(updatedApps);
    
    // Log audit
    const app = applications.find(a=>a.id === appId);
    if (app) {
      SwanayaDatabase.log(currentUser.email, currentUser.name, "ADMISSION_APPROVE", `App approved for: ${app.name}`);
    }
    onRefreshAllData();
  };

  // Search filter math
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          student.email.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          student.studentId.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesCourse = studentFilterCourse === 'ALL' || student.courseId === studentFilterCourse;
    return matchesSearch && matchesCourse;
  });

  // Financial Stats summary for Super Admin & Admin
  const outstandingSum = students.reduce((sum, s) => sum + s.outstandingBalance, 0);
  const revenueReceived = 185000; // Mock cumulative paid

  return (
    <div className="space-y-6">
      
      {/* Top Admin Controls Bar: Data Purge & Management */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-lg gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--sma-accent)] shrink-0" />
            <h2 className="text-sm font-serif font-bold text-white uppercase tracking-wider">
              ADMIN CONTROL CENTER &amp; REGISTRATIONS
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Manage registrations, add custom subjects, trainers (instructors), courses, and clear preloaded demo content for fresh entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleClearPreloadedContent}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-mono font-bold uppercase rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
            title="Remove preloaded demo courses, subjects, trainers and students"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Preloaded Content
          </button>
          
          <button
            onClick={handleRestoreDefaultContent}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono font-bold uppercase rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
            title="Reload default demo data"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Restore Demo Data
          </button>
        </div>
      </div>

      {/* Dynamic Navigation Sub-tabs: Only Popup Drop Box */}
      <div className="relative inline-block w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-xl shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest pl-1">
              Active Module:
            </span>
            <button
              type="button"
              onClick={() => setSubTabDropdownOpen((prev) => !prev)}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-amber-500/50 hover:border-amber-400 text-white rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md shadow-amber-500/5 group text-left min-w-[260px] sm:min-w-[320px]"
              aria-haspopup="true"
              aria-expanded={subTabDropdownOpen}
              title="Click to open module dropdown menu"
            >
              <div className="flex items-center gap-2.5 truncate">
                {(() => {
                  const current = adminSubTabs.find((t) => t.id === activeSubTab) || adminSubTabs[0];
                  const IconComp = current.icon;
                  return (
                    <>
                      <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white font-serif group-hover:text-amber-300 transition-colors truncate">
                          {current.label}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {current.description}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  Select
                </span>
                {subTabDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-amber-400 transition-transform" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform" />
                )}
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pr-1">
            <span className="text-[10px] text-slate-500 hidden md:inline">Quick Jump:</span>
            <select
              value={activeSubTab}
              onChange={(e) => {
                setActiveSubTab(e.target.value);
                setSubTabDropdownOpen(false);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
            >
              {adminSubTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Popup Drop Box Dropdown Popover */}
        {subTabDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              onClick={() => setSubTabDropdownOpen(false)}
            />
            <div className="absolute left-0 mt-2 w-full sm:w-[480px] md:w-[540px] bg-slate-950/95 border border-amber-500/40 rounded-2xl shadow-2xl z-50 p-4 max-h-[520px] overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2.5 px-1">
                <div>
                  <h4 className="text-xs font-bold text-white font-mono tracking-widest uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    Admin Control Modules
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Click any module below to switch views
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTabDropdownOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Close popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {adminSubTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  const isCurrent = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveSubTab(tab.id);
                        setSubTabDropdownOpen(false);
                      }}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 transition-colors ${
                          isCurrent
                            ? 'bg-amber-500 text-black font-bold'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 group-hover:text-amber-400'
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 flex-grow truncate">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-300' : 'text-slate-200 group-hover:text-white'}`}>
                            {tab.label}
                          </p>
                          {isCurrent && (
                            <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {tab.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-850 flex items-center justify-between px-1 text-[10px] text-slate-500 font-mono">
                <span>{adminSubTabs.length} Modules Configured</span>
                <span className="text-amber-500 font-semibold">Active: {adminSubTabs.find(t=>t.id===activeSubTab)?.label}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* LIVE CLASS GOOGLE MEET & WHATSAPP GROUPS */}
      {activeSubTab === 'live-classes' && (
        <LiveClassMeetWhatsAppPanel
          mode="MANAGE"
          currentUser={currentUser}
          courses={courses}
          batches={batches}
          subjects={subjects}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* COURSE MAPPING ENGINE */}
      {activeSubTab === 'course-mapping' && (
        <CourseMappingEnginePortal
          currentUser={currentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* GOOGLE MEET & CALENDAR STUDIO */}
      {activeSubTab === 'google-meet' && (
        <GoogleMeetStudioPanel
          mode="MANAGE"
          currentUser={currentUser}
          courses={courses}
          batches={batches}
        />
      )}

      {/* FEE COLLECTION & UPI VERIFICATION DASHBOARD */}
      {activeSubTab === 'finance-verification' && (
        <FinancePortal
          currentUser={currentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* BATCH OCCUPANCY ANALYTICS (RECHARTS BAR CHART) */}
      {activeSubTab === 'occupancy' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
            <div>
              <span className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">Analytics &amp; Capacity Planner</span>
              <h3 className="text-lg font-serif font-bold text-white">Batch Occupancy &amp; Utilization Overview</h3>
              <p className="text-xs text-slate-400">Visualizing enrolled scholars vs. maximum batch capacities across courses to identify full or under-utilized cohorts.</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(() => {
              const totalCapacity = batches.reduce((sum, b) => sum + (b.maxCapacity || 30), 0);
              const totalEnrolled = students.filter(s => s.status !== 'INACTIVE').length;
              const overallUtil = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;
              return (
                <>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Total Capacity</span>
                    <p className="text-xl font-bold font-mono text-slate-100">{totalCapacity} Seats</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Active Enrolled Scholars</span>
                    <p className="text-xl font-bold font-mono text-amber-400">{totalEnrolled} Enrolled</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Overall Utilization Rate</span>
                    <p className={`text-xl font-bold font-mono ${overallUtil > 85 ? 'text-amber-400' : 'text-emerald-400'}`}>{overallUtil}%</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Recharts Bar Chart */}
          <div className="bg-slate-950 p-5 rounded-lg border border-slate-850 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Enrolled vs. Capacity per Batch</h4>
              <span className="text-[10px] font-mono text-slate-500">Recharts Visualization</span>
            </div>

            <div className="h-80 w-full pt-4">
              {batches.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No active batches configured.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={batches.map(b => {
                      const enrolled = students.filter(s => s.batchId === b.id && s.status !== 'INACTIVE').length;
                      const capacity = b.maxCapacity || 30;
                      const crs = courses.find(c => c.id === b.courseId);
                      return {
                        name: b.name || b.code,
                        course: crs?.code || crs?.name || 'General',
                        enrolled,
                        capacity,
                        available: Math.max(0, capacity - enrolled)
                      };
                    })}
                    margin={{ top: 20, right: 30, left: 20, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="enrolled" name="Enrolled Students" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="capacity" name="Total Capacity" fill="#334155" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COURSE MATERIALS MANAGEMENT SUB-TAB */}
      {activeSubTab === 'materials' && (
        <AdminCourseMaterialsPanel
          courses={courses}
          currentUser={currentUser}
          firebaseConnected={firebaseConnected}
          onConnectGoogleAdmin={async () => {
            await handleConnectGoogleAdmin();
          }}
        />
      )}

      {/* MAJOR & MINOR COURSE MANAGEMENT SUB-TAB */}
      {activeSubTab === 'course-management' && (
        <MajorMinorCourseManagementPanel
          currentUser={currentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* THEME & COLOUR MANAGEMENT CONSOLE SUB-TAB */}
      {activeSubTab === 'theme' && (
        <AdminThemeConsole
          currentUser={currentUser}
          onThemeSaved={onRefreshAllData}
        />
      )}

      {/* COURSES & SYLLABUS SECTION (UNIFIED) */}
      {activeSubTab === 'courses' && (
        <div className="space-y-6">
          {!firebaseConnected && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Connect Admin Google Account for Cloud Course Sync
                  </p>
                  <p className="text-xs text-slate-300">
                    You signed in locally. Authenticate with your authorized Swanaya Admin Google account to create, edit, publish, unpublish, or delete courses in Firestore.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogleAdmin}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer shrink-0 flex items-center gap-2"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                <span>Connect Admin Google</span>
              </button>
            </div>
          )}

          {courseNotice && (
            <div
              role="status"
              className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                courseNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {courseNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{courseNotice.text}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {courseNotice.type === 'error' && (
                  <button
                    type="button"
                    onClick={() => void handleConnectGoogleAdmin()}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 text-[10px] font-bold uppercase rounded cursor-pointer"
                  >
                    Connect / Switch Admin Google
                  </button>
                )}
                <button type="button" onClick={() => setCourseNotice(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-5 rounded-lg gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-serif font-bold text-white">Course Catalog &amp; Publication Registry</h3>
                {firebaseConnected && auth.currentUser?.email && (
                  <button
                    type="button"
                    onClick={() => void handleConnectGoogleAdmin()}
                    title="Click to switch Google Admin account"
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    Cloud: {auth.currentUser.email} (Switch)
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Create, edit, publish/unpublish, and delete academy courses synced in real time to registration pages.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('materials')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Manage Course PDFs
              </button>
              <button 
                type="button"
                onClick={() => handleOpenCourseModal(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            </div>
          </div>

          {coursesLoading ? (
            <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Loading Firestore course catalog...</span>
            </div>
          ) : coursesError ? (
            <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {coursesError}
            </div>
          ) : courses.length === 0 ? (
            <div className="p-10 text-center bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
              <p className="text-sm font-serif font-bold text-slate-200">No Courses Created Yet</p>
              <p className="text-xs text-slate-400">Click &ldquo;Create Course&rdquo; to publish your first academy program.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map(course => {
                const published = isPublishedCourse(course);
                return (
                  <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold font-mono">
                            {course.code}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            published
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {published ? 'PUBLISHED' : 'UNPUBLISHED'}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenCourseModal(course)}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-blue-400 rounded cursor-pointer"
                            title="Edit Course"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCourse(course)}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded cursor-pointer"
                            title="Delete Course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-serif">{course.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{course.description}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px] font-mono">
                        <span className="text-slate-400 truncate">{course.level}</span>
                        <span className="text-slate-400 truncate text-center">{course.duration}</span>
                        <span className="text-amber-500 font-bold text-right">₹{Number(course.fee || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">Coordinator: {course.coordinator} · Mode: {course.mode}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleCoursePublish(course)}
                        className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                          published
                            ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                        }`}
                      >
                        {published ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Unpublish</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCourseModal(course)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer transition-colors shadow"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCourse(course)}
                          className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-[11px] font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ADMIN ADDITION SUB-TAB (Only for Super Admin) */}
      {activeRole === 'SUPER_ADMIN' && activeSubTab === 'overview' && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg mt-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase mb-4">Add Admin</h3>
          <form onSubmit={handleAddAdmin} className="space-y-2">
            <input name="adminName" placeholder="Admin Name" required className="w-full bg-slate-950 p-2 rounded text-xs" />
            <input name="adminEmail" placeholder="Admin Email" type="email" required className="w-full bg-slate-950 p-2 rounded text-xs" />
            <button type="submit" className="bg-amber-500 text-black px-4 py-2 rounded text-xs font-bold">Add Admin</button>
          </form>
        </div>
      )}


      {/* REGISTRATIONS SUB-TAB */}
      {activeSubTab === 'registrations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-5 rounded-lg gap-4">
            <div>
              <span className="text-[9px] font-mono font-bold text-amber-500 tracking-widest uppercase block">STUDENT & TRAINEE REGISTRATIONS</span>
              <h3 className="text-base font-serif font-bold text-white">Registrations & Admissions Management</h3>
              <p className="text-[11px] text-slate-400">Manage student registrations, review incoming proposals, and register new scholars directly into the database.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('course-verification')}
                  className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded cursor-pointer transition-colors whitespace-nowrap"
                >
                  MD &amp; Dept Course Verification →
                </button>
              )}
              <button
                onClick={() => handleOpenStudentModal(null)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/10 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Registration
              </button>
            </div>
          </div>

          {/* Pending Applications / Registrations list */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Incoming Registrations & Applications ({applications.length})
              </h4>
            </div>
            
            {applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-sm">{app.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                          app.status === 'ACCEPTED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>{app.email} • {app.phone}</span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono">
                          {courses.find(c => c.id === app.courseId)?.code || 'SMA-ADWDVC'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500">Qualification: {app.qualification} | Preferred Batch: {app.preferredBatch}</p>
                      {app.message && <p className="text-[11px] text-slate-400 italic">"{app.message}"</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={`https://wa.me/${(app.phone || '919446000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hello ${app.name}! This is Swanaya Media Academy Admissions Office regarding your registration for the ${
                            courses.find(c => c.id === app.courseId)?.name || 'program'
                          }.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1 font-mono"
                        title="Chat with trainee on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>

                      {app.status !== 'ACCEPTED' && (
                        <button
                          onClick={() => handleApproveApplication(app.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setStudentForm({
                            name: app.name,
                            email: app.email,
                            phone: app.phone,
                            whatsappPhone: app.phone,
                            whatsappOptIn: true,
                            guardianName: 'Self / Guardian',
                            guardianPhone: app.phone,
                            academicBackground: app.qualification,
                            courseId: app.courseId || courses[0]?.id || 'c-1',
                            batchId: batches[0]?.id || 'b-1',
                            semesterId: semesters[0]?.id || 's-1-1',
                            skills: 'Fresh Trainee',
                            outstandingBalance: 145000
                          });
                          setIsStudentModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-400 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Enroll Student
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950 border border-slate-850 rounded-lg space-y-2">
                <p className="text-xs text-slate-400">No pending admission registrations in system.</p>
                <p className="text-[11px] text-slate-500">Click "New Registration" to add fresh trainees or scholars to the database.</p>
              </div>
            )}
          </div>

          {/* Quick Enrolled Student Roster summary in Registrations */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Registered Student Scholars ({students.length})
              </h4>
            </div>

            {students.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((st) => (
                  <div 
                    key={st.id} 
                    onClick={() => onOpenProfile?.({ type: 'STUDENT', id: st.id })}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-lg flex items-start gap-3 cursor-pointer transition-colors group"
                  >
                    <img 
                      src={st.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${st.name}`}
                      alt={st.name} 
                      className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 shrink-0 group-hover:border-amber-400 transition-colors"
                    />
                    <div className="space-y-1 min-w-0 flex-grow">
                      <p className="font-bold text-slate-200 group-hover:text-amber-300 transition-colors text-xs truncate flex items-center justify-between">
                        <span>{st.name}</span>
                        <Eye className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                      </p>
                      <span className="text-[10px] font-mono font-bold text-amber-500 block">{st.studentId}</span>
                      <p className="text-[10px] text-slate-400 truncate">{st.email}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 inline-block font-mono">
                        {st.status} · View Profile ↗
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-950 border border-slate-850 rounded-lg">
                <p className="text-xs text-slate-500 italic">Database contains zero registered students. Use "New Registration" or "Clear Preloaded Content" to populate fresh items.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OVERVIEW SECTION */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">TOTAL REGISTERED STUDENTS</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">{students.length}</h3>
              <p className="text-[10px] text-emerald-400 mt-2">100% active validation</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">ACTIVE COURSES RUNNING</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">{courses.length}</h3>
              <p className="text-[10px] text-slate-400 mt-2">3 programs, 1 add-on workshop</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">OUTSTANDING ACADEMY FEES</p>
              <h3 className="text-2xl font-bold font-serif text-amber-500 tracking-tight mt-1">₹{outstandingSum.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] text-rose-400 mt-2">Triggers automatic alert warnings</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">PENDING ADMISSION APPLICATIONS</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">
                {applications.filter(a => a.status !== 'ENROLLED' && a.status !== 'REJECTED').length}
              </h3>
              <p className="text-[10px] text-amber-400 mt-2">Counselling required</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 font-serif">System Host Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs text-slate-400 font-mono">
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">CURRENT LOCAL SESSION</span>
                <span>2026-10-05 Local Server Instance</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">PERSISTENCE STRATEGY</span>
                <span className="text-emerald-400 font-semibold">Active HTML5 LocalStorage</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">DATABASE HEALTH STATUS</span>
                <span className="text-emerald-400">NOMINAL · 0ms LATENCY</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          
          {/* List Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Search student, id, email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 max-w-xs font-mono"
                />
              </div>
              
              <select
                value={studentFilterCourse}
                onChange={(e) => setStudentFilterCourse(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Programs</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenStudentModal(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Register New Student
            </button>
          </div>

          {/* Grid/Table List */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4 font-bold">Student Name & ID</th>
                  <th className="p-4 font-bold">Contact & Background</th>
                  <th className="p-4 font-bold">Course / Batch / Sem</th>
                  <th className="p-4 font-bold">Balance</th>
                  <th className="p-4 font-bold">Attendance</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <img 
                            src={student.avatarUrl} 
                            alt={student.name} 
                            className="w-7 h-7 rounded-full bg-slate-800 shrink-0 border border-slate-700"
                          />
                          <div>
                            <p className="font-bold text-slate-200">{student.name}</p>
                            <span className="text-[10px] font-mono text-amber-500 font-bold">{student.studentId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 space-y-0.5">
                        <p className="text-slate-300">{student.email}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{student.phone}</p>
                        <span className="text-[10px] text-slate-500 italic">Edu: {student.academicBackground}</span>
                      </td>
                      <td className="p-4 space-y-0.5 text-slate-300">
                        <p className="font-semibold">{courses.find(c=>c.id===student.courseId)?.code || 'N/A'}</p>
                        <p className="text-slate-500 text-[10px]">{batches.find(b=>b.id===student.batchId)?.name || 'N/A'}</p>
                        <p className="text-slate-500 text-[10px] italic">Sem: {semesters.find(s=>s.id===student.semesterId)?.name || 'N/A'}</p>
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-400">
                        ₹{student.outstandingBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="p-4 font-mono">
                        <span className={student.attendancePercentage < 75 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                          {student.attendancePercentage}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          student.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          <a
                            href={`https://wa.me/${((student.whatsappPhone || student.phone) || '919446000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hello ${student.name}! This is Swanaya Media Academy Admin Office regarding your ${
                                courses.find(c=>c.id===student.courseId)?.code || 'course'
                              } schedule.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 transition-colors"
                            title={`Chat on WhatsApp (${student.whatsappPhone || student.phone})`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => onOpenProfile?.({ type: 'STUDENT', id: student.id })}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 transition-colors cursor-pointer"
                            title="View Individual Profile & Digital ID Pass"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenStudentModal(student)}
                            className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded text-amber-400 transition-colors"
                            title="Edit student record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeactivateStudent(student.id, student.name)}
                            className={`p-1.5 border rounded transition-colors ${
                              student.status === 'ACTIVE' 
                                ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 text-rose-400' 
                                : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400'
                            }`}
                            title={student.status === 'ACTIVE' ? "Deactivate" : "Activate"}
                          >
                            {student.status === 'ACTIVE' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">No students matched.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Removed duplicate COURSES DIRECTORY TAB - consolidated above */}

      {/* ADMISSIONS APPLICATION TRACKER */}
      {activeSubTab === 'admissions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prospect Applications Inbox</h3>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4 font-bold">Applicant Details</th>
                  <th className="p-4 font-bold">Academic Qualification</th>
                  <th className="p-4 font-bold">Course Proposed</th>
                  <th className="p-4 font-bold">CRM Pipeline Status</th>
                  <th className="p-4 font-bold text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {applications.length > 0 ? (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 space-y-1">
                        <p className="font-bold text-slate-200">{app.name}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{app.email} · {app.phone}</p>
                        <p className="text-slate-400 text-[10px] italic">" {app.message} "</p>
                      </td>
                      <td className="p-4 text-slate-300 font-medium">
                        {app.qualification}
                      </td>
                      <td className="p-4 text-slate-300">
                        {courses.find(c=>c.id===app.courseId)?.name || 'N/A'}
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">Pref. Batch: {app.preferredBatch}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          app.status === 'ACCEPTED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                          app.status === 'REJECTED' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                          'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {app.status === 'COUNSELLING' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleApproveApplication(app.id)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[10px] uppercase rounded transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No pending actions</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">No new applications inbox.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CURRICULUM BUILDER */}
      {activeSubTab === 'curriculum' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Current Curriculum Tree */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-4 rounded-lg gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Academic Schema Explorer</h3>
                <p className="text-[10px] text-slate-500 mt-1">Directly build Program Modules and Subject definitions on the fly.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMultiPaperModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase rounded cursor-pointer transition-colors"
                >
                  + Add Multiple Paper Program
                </button>
                <button
                  type="button"
                  onClick={() => handleCommitAndExportSyllabus("All Mapped Course Programs")}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer transition-colors shadow"
                >
                  Commit &amp; Export Syllabus PDF
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {courses.map((course) => {
                const semList = semesters.filter(s => s.courseId === course.id);
                return (
                  <div key={course.id} className="bg-slate-900/30 border border-slate-850 rounded-lg p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <GraduationCap className="w-5 h-5 text-amber-500 shrink-0" />
                      <h4 className="text-sm font-bold text-white font-serif">{course.name} ({course.code})</h4>
                    </div>

                    <div className="space-y-3 pl-2">
                      {semList.length > 0 ? (
                        semList.map((sem) => {
                          const subList = subjects.filter(s => s.semesterId === sem.id);
                          return (
                            <div key={sem.id} className="bg-[#0A0D14]/40 border border-slate-800/80 p-4 rounded space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-200">{sem.name}</p>
                                <span className="text-[9px] font-mono text-slate-500 uppercase">{sem.code}</span>
                              </div>

                              <div className="space-y-2 pl-4 border-l border-slate-850">
                                {subList.length > 0 ? (
                                  subList.map((sub) => (
                                    <div key={sub.id} className="bg-slate-900/40 border border-slate-850 p-2.5 rounded text-xs">
                                      <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-300">{sub.name}</p>
                                        <span className="text-[10px] text-amber-500 font-mono font-semibold">{sub.code}</span>
                                      </div>
                                      <p className="text-slate-500 text-[10px] leading-relaxed mt-1">{sub.description}</p>
                                      
                                      {/* Unboxed inline metadata */}
                                      <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-900">
                                        <span>Credits: {sub.credits}</span>
                                        <span>·</span>
                                        <span>Hours: {sub.hours}</span>
                                        <span>·</span>
                                        <span>Assigned Instructor: {instructors.find(i=>i.id===sub.instructorId)?.name || 'N/A'}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-500 italic pl-2">No subjects configured for this semester.</p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic">No semesters created yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Builder Tools */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Create Semester */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 font-mono">
                Add Semester Block
              </h3>
              
              <form onSubmit={handleAddSemester} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Assign to Program</label>
                  <select
                    value={newSemesterCourse}
                    onChange={(e) => setNewSemesterCourse(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Semester Title</label>
                  <input 
                    type="text" 
                    required
                    value={newSemesterName}
                    onChange={(e) => setNewSemesterName(e.target.value)}
                    placeholder="e.g. Semester 4: Vibe Architecture"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold uppercase rounded text-white transition-colors cursor-pointer"
                >
                  Create Semester
                </button>
              </form>
            </div>

            {/* Create Subject */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 font-mono">
                Configure New Subject Paper
              </h3>

              <form onSubmit={handleAddSubject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Assign to Semester</label>
                  <select
                    value={newSubjectForm.semesterId}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, semesterId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({courses.find(c=>c.id===s.courseId)?.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Subject Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. SMA-WD-401"
                      value={newSubjectForm.code}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, code: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Instructor</label>
                    <select
                      value={newSubjectForm.instructorId}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, instructorId: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                    >
                      {instructors.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Subject Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Next.js Server Components"
                    value={newSubjectForm.name}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Credits</label>
                    <input 
                      type="number" 
                      required
                      value={newSubjectForm.credits}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, credits: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Hours</label>
                    <input 
                      type="number" 
                      required
                      value={newSubjectForm.hours}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, hours: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Description Outcomes</label>
                  <textarea 
                    rows={2}
                    placeholder="Syllabus coverage & goals..."
                    value={newSubjectForm.description}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
                >
                  Publish Subject Spec
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {activeSubTab === 'allocation' && (
        <InstructorAllocation currentUser={currentUser} onRefreshAllData={onRefreshAllData} />
      )}

      {/* STUDENT REGISTRATION / PROFILE MODAL */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif flex items-center justify-between">
              <span>{editingStudent ? 'Edit Student Profile' : 'Fast-Track Student Enrollment'}</span>
              <span className="text-[10px] font-mono font-normal text-amber-500">Academic Registrar</span>
            </h3>

            {studentModalCapacityWarning && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Capacity Exceeded Notice</span>
                </div>
                <p className="text-[11px] text-slate-300">{studentModalCapacityWarning}</p>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Email</label>
                  <input 
                    type="email" 
                    required
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={studentForm.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentForm(prev => ({
                        ...prev,
                        phone: val,
                        whatsappPhone: prev.whatsappPhone ? prev.whatsappPhone : val
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Academic Background</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.academicBackground}
                    onChange={(e) => setStudentForm({...studentForm, academicBackground: e.target.value})}
                    placeholder="e.g. B.Tech / Plus Two"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* WHATSAPP INTEGRATION IN STUDENT MODAL */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    WhatsApp Number & Alerts
                  </label>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">Official Desk Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input 
                    type="tel" 
                    value={studentForm.whatsappPhone}
                    onChange={(e) => setStudentForm({...studentForm, whatsappPhone: e.target.value})}
                    placeholder="WhatsApp Number e.g. +91 94460 00000"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-400"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={studentForm.whatsappOptIn}
                      onChange={(e) => setStudentForm({...studentForm, whatsappOptIn: e.target.checked})}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-300 font-semibold">
                      Enable WhatsApp Alerts
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Guardian Name</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.guardianName}
                    onChange={(e) => setStudentForm({...studentForm, guardianName: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Guardian Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={studentForm.guardianPhone}
                    onChange={(e) => setStudentForm({...studentForm, guardianPhone: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Course Program</label>
                  <select
                    value={studentForm.courseId}
                    onChange={(e) => {
                      const nextCourseId = e.target.value;
                      if (!editingStudent) {
                        const suggested = suggestNextAvailableBatch(nextCourseId, batches, students);
                        const matchingSem = semesters.find((s) => s.courseId === nextCourseId)?.id;
                        setStudentForm({
                          ...studentForm,
                          courseId: nextCourseId,
                          batchId: suggested.batchId || studentForm.batchId,
                          semesterId: matchingSem || studentForm.semesterId,
                        });
                        setStudentModalCapacityWarning(null);
                        setStudentModalOverrideConfirmed(false);
                      } else {
                        setStudentForm({ ...studentForm, courseId: nextCourseId });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Batch</label>
                    {(() => {
                      const selBatch = batches.find(b => b.id === studentForm.batchId);
                      const currentCount = students.filter(s => s.batchId === studentForm.batchId && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                      const maxCap = selBatch?.maxCapacity ?? 30;
                      const isFull = currentCount >= maxCap;
                      return (
                        <span className={`text-[9px] font-mono ${isFull ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                          {currentCount}/{maxCap} {isFull ? 'FULL' : 'seats'}
                        </span>
                      );
                    })()}
                  </div>
                  <select
                    value={studentForm.batchId}
                    onChange={(e) => {
                      setStudentForm({...studentForm, batchId: e.target.value});
                      setStudentModalCapacityWarning(null);
                      setStudentModalOverrideConfirmed(false);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {(() => {
                      const suggested = suggestNextAvailableBatch(
                        studentForm.courseId,
                        batches,
                        students,
                        editingStudent?.id
                      );
                      return batches.map(b => {
                        const count = students.filter(s => s.batchId === b.id && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                        const maxCap = b.maxCapacity ?? 30;
                        const isFull = count >= maxCap;
                        const isSuggested = suggested.batchId === b.id && suggested.hasOpenSeats;
                        return (
                          <option key={b.id} value={b.id}>
                            {isSuggested ? '★ Suggested · ' : ''}{b.name} ({count}/{maxCap} {isFull ? '• FULL' : `• ${Math.max(0, maxCap - count)} open`})
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Semester</label>
                  <select
                    value={studentForm.semesterId}
                    onChange={(e) => setStudentForm({...studentForm, semesterId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name.substring(0, 10)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                const suggested = suggestNextAvailableBatch(
                  studentForm.courseId,
                  batches,
                  students,
                  editingStudent?.id
                );
                if (!suggested.batch) return null;
                return (
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-emerald-300 leading-snug">
                      <span className="font-bold">Smart Batch Suggestion:</span> {suggested.batch.name} — {suggested.reason}
                    </p>
                    {studentForm.batchId !== suggested.batchId && suggested.hasOpenSeats && (
                      <button
                        type="button"
                        onClick={() => {
                          setStudentForm({ ...studentForm, batchId: suggested.batchId });
                          setStudentModalCapacityWarning(null);
                          setStudentModalOverrideConfirmed(false);
                        }}
                        className="px-2.5 py-1 bg-emerald-500 text-slate-950 rounded text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer hover:bg-emerald-400"
                      >
                        Use Suggested
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* BATCH CAPACITY WARNING BOX */}
              {(() => {
                const selBatch = batches.find(b => b.id === studentForm.batchId);
                const currentCount = students.filter(s => s.batchId === studentForm.batchId && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                const maxCap = selBatch?.maxCapacity ?? 30;
                const isFull = currentCount >= maxCap;

                if (!isFull) return null;

                return (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">⚠️ Target Batch Full Warning</p>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      <strong className="text-amber-200">{selBatch?.name}</strong> has reached its maximum capacity limit of <strong className="font-mono text-amber-400">{maxCap} students</strong> ({currentCount}/{maxCap} filled).
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                      <input 
                        type="checkbox"
                        id="studentModalOverrideCheck"
                        checked={studentModalOverrideConfirmed}
                        onChange={(e) => setStudentModalOverrideConfirmed(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer rounded"
                      />
                      <label htmlFor="studentModalOverrideCheck" className="text-[11px] text-amber-200 font-semibold cursor-pointer select-none">
                        I understand this batch is full and wish to proceed with enrollment
                      </label>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Initial Skills (comma sep)</label>
                  <input 
                    type="text" 
                    value={studentForm.skills}
                    onChange={(e) => setStudentForm({...studentForm, skills: e.target.value})}
                    placeholder="HTML, CSS, Git"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Outstanding Fees (₹)</label>
                  <input 
                    type="number" 
                    value={studentForm.outstandingBalance}
                    onChange={(e) => setStudentForm({...studentForm, outstandingBalance: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COURSE FORM MODAL */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              {editingCourse ? 'Edit Program Blueprint' : 'Define New Course Blueprint'}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Course Code</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({...courseForm, code: e.target.value})}
                    placeholder="e.g. SMA-ADWDVC"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Coordinator</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.coordinator}
                    onChange={(e) => setCourseForm({...courseForm, coordinator: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Program Title</label>
                <input 
                  type="text" 
                  required
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({...courseForm, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Description Outlines</label>
                <textarea 
                  rows={3}
                  required
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Duration</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({...courseForm, duration: e.target.value})}
                    placeholder="e.g. 12 Months"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Classification</label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm({...courseForm, level: e.target.value as any})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                    <option value="DIPLOMA">DIPLOMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Mode</label>
                  <select
                    value={courseForm.mode}
                    onChange={(e) => setCourseForm({...courseForm, mode: e.target.value as any})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="PHYSICAL">PHYSICAL</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Academy Fee (₹)</label>
                  <input 
                    type="number" 
                    required
                    value={courseForm.fee}
                    onChange={(e) => setCourseForm({...courseForm, fee: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Eligibility criteria</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.eligibility}
                    onChange={(e) => setCourseForm({...courseForm, eligibility: e.target.value})}
                    placeholder="Graduate / 10th standard"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={courseForm.isPublished}
                  onChange={(e) => setCourseForm({ ...courseForm, isPublished: e.target.checked })}
                  className="accent-amber-500 rounded cursor-pointer"
                />
                <span>Publish immediately to front-end landing &amp; student registration pages</span>
              </label>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer disabled:opacity-50"
                >
                  {savingCourse ? 'Saving to Firestore...' : editingCourse ? 'Update Course' : 'Create & Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COURSE DELETE CONFIRMATION MODAL */}
      {confirmDeleteCourse && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-rose-500/30 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif font-bold text-white">Delete Course Program</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-amber-300">{confirmDeleteCourse.name}</strong> ({confirmDeleteCourse.code})? It will be removed from Firestore and student registration dropdowns immediately.
            </p>
            {!firebaseConnected && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Your Admin Google session is not connected yet. Clicking below will prompt Google Sign-In to authorize deleting this course in Firestore.
                </span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCourse(null)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingCourseId === confirmDeleteCourse.id}
                onClick={() => void handleDeleteCourseConfirm()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase rounded cursor-pointer disabled:opacity-50"
              >
                {deletingCourseId === confirmDeleteCourse.id
                  ? 'Deleting...'
                  : firebaseConnected
                  ? 'Delete Course'
                  : 'Connect Google & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-PAPER BATCH MAPPING MODAL */}
      {multiPaperModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <h3 className="text-sm font-bold text-slate-200 font-serif">
                Add Multiple Paper Program to Mapping
              </h3>
              <button
                type="button"
                onClick={() => setMultiPaperModalOpen(false)}
                className="p-1 bg-slate-900 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchAddPapers} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Target Semester / Term</label>
                <select
                  value={multiPaperSemesterId}
                  onChange={(e) => setMultiPaperSemesterId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({courses.find(c => c.id === s.courseId)?.code || 'SMA'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  Paper Programs (One per line, format: CODE: Title)
                </label>
                <textarea
                  rows={5}
                  required
                  value={multiPaperText}
                  onChange={(e) => setMultiPaperText(e.target.value)}
                  placeholder="SMA-P1: Advanced Vibe Architecture&#10;SMA-P2: Autonomous Agentic Workflows&#10;SMA-P3: Cinematic AI Direction & Post-Production"
                  className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-xs text-slate-100 font-mono leading-relaxed"
                />
                <p className="text-[10px] text-slate-500">
                  Enter multiple paper programs separated by newlines. Automatically mapped to the selected semester and committed to syllabus records.
                </p>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setMultiPaperModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded cursor-pointer shadow"
                >
                  Commit &amp; Map Multiple Papers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
