/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  BookOpen,
  UserCheck,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  AdmissionApplication,
  Batch,
  Course,
  CourseSelectionRegistration,
  Notification,
  Semester,
  Student,
  SwanayaDatabase,
  User
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';

interface CourseVerificationPortalProps {
  currentUser: User;
  onRefreshAllData: () => void;
}

type UnifiedCourseRequest = {
  id: string;
  origin: 'PORTAL_REGISTRATION' | 'PUBLIC_COURSE_SELECTION';
  isFirestoreBacked: boolean;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  studentId?: string;
  userId?: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  levelFilter: string;
  studyMode: string;
  preferredBatch: string;
  preferredSchedule: string;
  qualification: string;
  experienceLevel: string;
  careerGoal: string;
  notes: string;
  status: string;
  departmentVerificationStatus: 'PENDING' | 'VERIFIED' | 'RETURNED' | 'REJECTED';
  departmentVerifiedBy?: string;
  departmentVerifiedRole?: string;
  departmentVerifiedAt?: string;
  departmentRemarks?: string;
  mdVerificationStatus: 'PENDING_MD' | 'VERIFIED' | 'REJECTED';
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdRemarks?: string;
  createdAt: string;
  rawRegistration?: CourseSelectionRegistration;
  rawApplication?: AdmissionApplication;
};

export default function CourseVerificationPortal({
  currentUser,
  onRefreshAllData,
}: CourseVerificationPortalProps) {
  const [registrations, setRegistrations] = useState<CourseSelectionRegistration[]>(
    () => SwanayaDatabase.get<CourseSelectionRegistration[]>('courseRegistrations') || []
  );
  const [applications, setApplications] = useState<AdmissionApplication[]>(
    () => SwanayaDatabase.get<AdmissionApplication[]>('applications') || []
  );
  const [courses, setCourses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>('courses') || []);
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>('students') || []);
  const [batches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>('batches') || []);
  const [semesters] = useState<Semester[]>(() => SwanayaDatabase.get<Semester[]>('semesters') || []);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_DEPARTMENT' | 'PENDING_MD' | 'MD_VERIFIED' | 'RETURNED_OR_REJECTED'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'PORTAL_REGISTRATION' | 'PUBLIC_COURSE_SELECTION'>('ALL');
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isMdExecutive =
    currentUser.role === 'MD' ||
    currentUser.role === 'PRINCIPAL' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'ADMIN';

  const isDepartmentReviewer =
    isMdExecutive ||
    currentUser.role === 'ACADEMIC_ADMIN' ||
    currentUser.role === 'INSTRUCTOR' ||
    currentUser.role === 'REVIEWER' ||
    currentUser.role === 'COUNSELLOR';

  const syncAll = async () => {
    setLoading(true);
    const localRegs = SwanayaDatabase.get<CourseSelectionRegistration[]>('courseRegistrations') || [];
    const localApps = SwanayaDatabase.get<AdmissionApplication[]>('applications') || [];
    const localCourses = SwanayaDatabase.get<Course[]>('courses') || [];
    const localStudents = SwanayaDatabase.get<Student[]>('students') || [];

    setApplications(localApps);
    setStudents(localStudents);

    let cloudCourses: any[] = [];
    let cloudRegs: any[] = [];

    try {
      const fetchedCourses = await academyService.getCourses();
      if (Array.isArray(fetchedCourses)) cloudCourses = fetchedCourses;
    } catch {
      // keep local catalog
    }

    if (auth.currentUser) {
      try {
        const fetchedRegs = await academyService.getRegistrations();
        if (Array.isArray(fetchedRegs)) cloudRegs = fetchedRegs;
      } catch {
        // keep local registrations if Firestore read is unavailable
      }
    }

    const courseMap = new Map<string, Course>();
    localCourses.forEach((c) => c?.id && courseMap.set(c.id, c));
    cloudCourses.forEach((raw: any) => {
      if (raw?.id && !courseMap.has(raw.id)) {
        courseMap.set(raw.id, {
          id: raw.id,
          code: raw.code || raw.id.slice(0, 8).toUpperCase(),
          name: raw.name || raw.title || 'Academy Course',
          description: raw.description || '',
          duration: raw.duration || '6 Months',
          level: raw.level || 'DIPLOMA',
          eligibility: raw.eligibility || '',
          fee: Number(raw.fee ?? raw.fees ?? 0),
          mode: raw.mode || 'HYBRID',
          status: raw.status || 'ACTIVE',
          thumbnailUrl: raw.thumbnailUrl || '',
          coordinator: raw.coordinator || 'Academic Director',
          learningObjectives: Array.isArray(raw.learningObjectives) ? raw.learningObjectives : [],
          careerOutcomes: Array.isArray(raw.careerOutcomes) ? raw.careerOutcomes : [],
        });
      }
    });
    setCourses(Array.from(courseMap.values()));

    const regMap = new Map<string, CourseSelectionRegistration>();
    localRegs.forEach((r) => r?.id && regMap.set(r.id, r));
    cloudRegs.forEach((raw: any) => {
      if (!raw?.id) return;
      const existing = regMap.get(raw.id);
      regMap.set(raw.id, {
        ...existing,
        ...raw,
        departmentVerificationStatus:
          raw.departmentVerificationStatus ||
          (raw.status === 'DEPARTMENT_VERIFIED' || raw.status === 'MD_VERIFIED' || raw.status === 'APPROVED'
            ? 'VERIFIED'
            : raw.status === 'RETURNED'
            ? 'RETURNED'
            : raw.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING'),
        mdVerificationStatus:
          raw.mdVerificationStatus ||
          (raw.status === 'MD_VERIFIED' || raw.status === 'APPROVED'
            ? 'VERIFIED'
            : raw.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_MD'),
      });
    });

    const mergedRegs = Array.from(regMap.values()).sort((a, b) =>
      String(b.updatedAt || b.createdAt || b.timestamp || '').localeCompare(
        String(a.updatedAt || a.createdAt || a.timestamp || '')
      )
    );
    setRegistrations(mergedRegs);
    SwanayaDatabase.set('courseRegistrations', mergedRegs);
    setLoading(false);
  };

  useEffect(() => {
    syncAll();
  }, []);

  const unifiedQueue: UnifiedCourseRequest[] = useMemo(() => {
    const courseLookup = new Map<string, Course>();
    courses.forEach((c) => courseLookup.set(c.id, c));

    const fromRegs: UnifiedCourseRequest[] = registrations.map((r) => {
      const matched = courseLookup.get(r.courseId);
      return {
        id: r.id,
        origin: 'PORTAL_REGISTRATION',
        isFirestoreBacked: true,
        applicantName: r.studentName || 'Student Scholar',
        applicantEmail: r.studentEmail || '—',
        applicantPhone: r.studentPhone || '—',
        studentId: r.studentId,
        userId: r.userId,
        courseId: r.courseId,
        courseCode: r.courseCode || matched?.code || 'ACADEMY',
        courseTitle: r.courseTitle || matched?.name || 'Academy Course',
        levelFilter: r.answers?.levelFilter || matched?.level || 'ALL',
        studyMode: r.answers?.studyMode || matched?.mode || 'HYBRID',
        preferredBatch: r.answers?.preferredBatch || 'Default Cohort',
        preferredSchedule: r.answers?.preferredSchedule || 'Weekday Intensive',
        qualification: r.answers?.qualification || r.answers?.priorExperience || 'Student Profile',
        experienceLevel: r.answers?.experienceLevel || 'Not Specified',
        careerGoal: r.answers?.careerGoals || 'Academic Progression',
        notes: r.answers?.reason || '',
        status: r.status || 'PENDING',
        departmentVerificationStatus: r.departmentVerificationStatus || 'PENDING',
        departmentVerifiedBy: r.departmentVerifiedBy,
        departmentVerifiedRole: r.departmentVerifiedRole,
        departmentVerifiedAt: r.departmentVerifiedAt,
        departmentRemarks: r.departmentRemarks,
        mdVerificationStatus: r.mdVerificationStatus || 'PENDING_MD',
        mdVerifiedBy: r.mdVerifiedBy,
        mdVerifiedAt: r.mdVerifiedAt,
        mdRemarks: r.mdRemarks,
        createdAt: r.createdAt || r.timestamp || '',
        rawRegistration: r,
      };
    });

    const fromApps: UnifiedCourseRequest[] = applications.map((app) => {
      const matched = courseLookup.get(app.courseId);
      const deptStatus: 'PENDING' | 'VERIFIED' | 'RETURNED' | 'REJECTED' =
        app.departmentVerificationStatus ||
        (app.status === 'ACCEPTED' || app.status === 'ENROLLED'
          ? 'VERIFIED'
          : app.status === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING');
      const mdStatus: 'PENDING_MD' | 'VERIFIED' | 'REJECTED' =
        app.mdVerificationStatus ||
        (app.status === 'ACCEPTED' || app.status === 'ENROLLED'
          ? 'VERIFIED'
          : app.status === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING_MD');

      return {
        id: app.id,
        origin: 'PUBLIC_COURSE_SELECTION',
        isFirestoreBacked: false,
        applicantName: app.name,
        applicantEmail: app.email,
        applicantPhone: app.phone,
        courseId: app.courseId,
        courseCode: matched?.code || app.courseId.toUpperCase(),
        courseTitle: matched?.name || 'Selected Academy Program',
        levelFilter: app.levelFilter || matched?.level || 'ALL',
        studyMode: app.studyMode || matched?.mode || 'HYBRID',
        preferredBatch: app.preferredBatch || 'Default Cohort',
        preferredSchedule: app.preferredSchedule || 'Standard Track',
        qualification: app.qualification || '—',
        experienceLevel: app.experienceLevel || '—',
        careerGoal: app.careerTrack || 'Academy Career Track',
        notes: app.message || '',
        status: app.status,
        departmentVerificationStatus: deptStatus,
        departmentVerifiedBy: app.departmentVerifiedBy,
        departmentVerifiedRole: app.departmentVerifiedRole,
        departmentVerifiedAt: app.departmentVerifiedAt,
        departmentRemarks: app.departmentRemarks,
        mdVerificationStatus: mdStatus,
        mdVerifiedBy: app.mdVerifiedBy,
        mdVerifiedAt: app.mdVerifiedAt,
        mdRemarks: app.mdRemarks,
        createdAt: app.createdAt || '',
        rawApplication: app,
      };
    });

    return [...fromRegs, ...fromApps].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
  }, [registrations, applications, courses]);

  const counts = useMemo(() => {
    const pendingDept = unifiedQueue.filter((q) => q.departmentVerificationStatus === 'PENDING' && q.mdVerificationStatus !== 'REJECTED').length;
    const awaitingMd = unifiedQueue.filter((q) => q.departmentVerificationStatus === 'VERIFIED' && q.mdVerificationStatus === 'PENDING_MD').length;
    const mdVerified = unifiedQueue.filter((q) => q.mdVerificationStatus === 'VERIFIED').length;
    const returnedOrRejected = unifiedQueue.filter(
      (q) => q.departmentVerificationStatus === 'RETURNED' || q.departmentVerificationStatus === 'REJECTED' || q.mdVerificationStatus === 'REJECTED'
    ).length;
    return { total: unifiedQueue.length, pendingDept, awaitingMd, mdVerified, returnedOrRejected };
  }, [unifiedQueue]);

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unifiedQueue.filter((item) => {
      if (originFilter !== 'ALL' && item.origin !== originFilter) return false;
      if (statusFilter === 'PENDING_DEPARTMENT') {
        if (!(item.departmentVerificationStatus === 'PENDING' && item.mdVerificationStatus !== 'REJECTED')) return false;
      } else if (statusFilter === 'PENDING_MD') {
        if (!(item.departmentVerificationStatus === 'VERIFIED' && item.mdVerificationStatus === 'PENDING_MD')) return false;
      } else if (statusFilter === 'MD_VERIFIED') {
        if (item.mdVerificationStatus !== 'VERIFIED') return false;
      } else if (statusFilter === 'RETURNED_OR_REJECTED') {
        if (!(item.departmentVerificationStatus === 'RETURNED' || item.departmentVerificationStatus === 'REJECTED' || item.mdVerificationStatus === 'REJECTED')) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.applicantName.toLowerCase().includes(q) ||
        item.applicantEmail.toLowerCase().includes(q) ||
        item.courseTitle.toLowerCase().includes(q) ||
        item.courseCode.toLowerCase().includes(q) ||
        item.preferredBatch.toLowerCase().includes(q) ||
        item.careerGoal.toLowerCase().includes(q)
      );
    });
  }, [unifiedQueue, originFilter, statusFilter, searchQuery]);

  const pushNotification = (userId: string | undefined, title: string, message: string, type = 'INFO') => {
    const existing = SwanayaDatabase.get<Notification[]>('notifications') || [];
    const newNotif: Notification = {
      id: `not-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: userId || 'usr-counsel',
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    SwanayaDatabase.set('notifications', [newNotif, ...existing]);
  };

  const handleDepartmentDecision = async (
    item: UnifiedCourseRequest,
    decision: 'VERIFIED' | 'RETURNED' | 'REJECTED'
  ) => {
    if (!isDepartmentReviewer) return;
    setNotice(null);
    setProcessingId(item.id);
    const nowIso = new Date().toISOString();
    const remark = (remarksById[item.id] || '').trim();
    const nextStatus =
      decision === 'VERIFIED'
        ? 'DEPARTMENT_VERIFIED'
        : decision === 'RETURNED'
        ? 'RETURNED'
        : 'REJECTED';

    try {
      if (item.origin === 'PORTAL_REGISTRATION') {
        const patch: Partial<CourseSelectionRegistration> = {
          status: nextStatus,
          departmentVerificationStatus: decision,
          departmentVerifiedBy: currentUser.name,
          departmentVerifiedRole: currentUser.role,
          departmentVerifiedAt: nowIso,
          departmentRemarks: remark || undefined,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.updateCourseRegistration(item.id, patch);
        }

        const updated = registrations.map((r) => (r.id === item.id ? { ...r, ...patch } : r));
        setRegistrations(updated);
        SwanayaDatabase.set('courseRegistrations', updated);
      } else {
        const appStatus: AdmissionApplication['status'] =
          decision === 'VERIFIED'
            ? 'UNDER_REVIEW'
            : decision === 'RETURNED'
            ? 'COUNSELLING'
            : 'REJECTED';
        const updatedApps = applications.map((app) =>
          app.id === item.id
            ? {
                ...app,
                status: appStatus,
                departmentVerificationStatus: decision,
                departmentVerifiedBy: currentUser.name,
                departmentVerifiedRole: currentUser.role,
                departmentVerifiedAt: nowIso,
                departmentRemarks: remark || undefined,
              }
            : app
        );
        setApplications(updatedApps);
        SwanayaDatabase.set('applications', updatedApps);
      }

      pushNotification(
        item.userId || item.studentId,
        `Department ${decision === 'VERIFIED' ? 'Verified' : decision === 'RETURNED' ? 'Returned' : 'Rejected'} Course Selection`,
        `${item.applicantName}'s course selection (${item.courseTitle}) was marked ${decision} by ${currentUser.name} (${currentUser.role}).`,
        decision === 'VERIFIED' ? 'SUCCESS' : 'WARNING'
      );

      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        `COURSE_SELECTION_DEPT_${decision}`,
        `${item.applicantName} -> ${item.courseTitle}`
      );
      setNotice({
        type: 'success',
        text: `Department status updated to ${decision} for ${item.applicantName} (${item.courseTitle}).`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to update Department verification status.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleMdDecision = async (
    item: UnifiedCourseRequest,
    decision: 'VERIFIED' | 'REJECTED'
  ) => {
    if (!isMdExecutive) return;
    setNotice(null);
    setProcessingId(item.id);
    const nowIso = new Date().toISOString();
    const remark = (remarksById[item.id] || '').trim();

    try {
      if (item.origin === 'PORTAL_REGISTRATION') {
        const patch: Partial<CourseSelectionRegistration> = {
          status: decision === 'VERIFIED' ? 'MD_VERIFIED' : 'REJECTED',
          departmentVerificationStatus:
            decision === 'VERIFIED'
              ? 'VERIFIED'
              : item.departmentVerificationStatus === 'PENDING'
              ? 'REJECTED'
              : item.departmentVerificationStatus,
          departmentVerifiedBy: item.departmentVerifiedBy || currentUser.name,
          departmentVerifiedRole: item.departmentVerifiedRole || currentUser.role,
          departmentVerifiedAt: item.departmentVerifiedAt || nowIso,
          mdVerificationStatus: decision,
          mdVerifiedBy: currentUser.name,
          mdVerifiedAt: nowIso,
          mdRemarks: remark || undefined,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.updateCourseRegistration(item.id, patch);
        }

        const updated = registrations.map((r) => (r.id === item.id ? { ...r, ...patch } : r));
        setRegistrations(updated);
        SwanayaDatabase.set('courseRegistrations', updated);

        // If student is already in local student roster and MD approved, link their active course if empty or requested
        if (decision === 'VERIFIED' && item.studentId) {
          const updatedStudents = students.map((st) =>
            st.id === item.studentId && !st.courseId
              ? { ...st, courseId: item.courseId }
              : st
          );
          setStudents(updatedStudents);
          SwanayaDatabase.set('students', updatedStudents);
        }
      } else {
        const appStatus: AdmissionApplication['status'] =
          decision === 'VERIFIED' ? 'ACCEPTED' : 'REJECTED';
        const updatedApps = applications.map((app) =>
          app.id === item.id
            ? {
                ...app,
                status: appStatus,
                departmentVerificationStatus:
                  decision === 'VERIFIED'
                    ? 'VERIFIED'
                    : app.departmentVerificationStatus || 'REJECTED',
                departmentVerifiedBy: app.departmentVerifiedBy || currentUser.name,
                departmentVerifiedRole: app.departmentVerifiedRole || currentUser.role,
                departmentVerifiedAt: app.departmentVerifiedAt || nowIso,
                mdVerificationStatus: decision,
                mdVerifiedBy: currentUser.name,
                mdVerifiedAt: nowIso,
                mdRemarks: remark || undefined,
              }
            : app
        );
        setApplications(updatedApps);
        SwanayaDatabase.set('applications', updatedApps);
      }

      try {
        await academyService.acceptRegistrationDecision({
          targetType: item.origin === 'PORTAL_REGISTRATION' ? 'COURSE_REGISTRATION' : 'APPLICATION',
          targetId: item.id,
          decision: decision === 'VERIFIED' ? 'ACCEPTED' : 'REJECTED',
          adminName: currentUser.name,
          adminEmail: currentUser.email,
          remarks: remark || undefined,
          registrationSnapshot:
            item.origin === 'PORTAL_REGISTRATION'
              ? {
                  ...item.rawRegistration,
                  studentName: item.applicantName,
                  studentEmail: item.applicantEmail,
                  studentPhone: item.applicantPhone,
                  courseTitle: item.courseTitle,
                }
              : item.rawApplication,
        });
      } catch {
        // non-fatal backend acceptance log sync
      }

      pushNotification(
        item.userId || item.studentId,
        decision === 'VERIFIED' ? 'Course Registration Accepted' : 'Course Selection Declined by MD',
        `${item.applicantName}'s course selection (${item.courseTitle}) received acceptance status: ${decision}.`,
        decision === 'VERIFIED' ? 'SUCCESS' : 'WARNING'
      );

      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        `COURSE_SELECTION_MD_${decision}`,
        `${item.applicantName} -> ${item.courseTitle}`
      );
      setNotice({
        type: 'success',
        text: `Course registration ${decision === 'VERIFIED' ? 'accepted' : 'declined'} for ${item.applicantName}.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to record MD verification decision.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleEnrollVerifiedApplicant = (item: UnifiedCourseRequest) => {
    if (!isMdExecutive || item.origin !== 'PUBLIC_COURSE_SELECTION') return;
    const existingStudent = students.find(
      (s) => s.email.toLowerCase() === item.applicantEmail.toLowerCase()
    );
    if (existingStudent) {
      setNotice({
        type: 'error',
        text: `${item.applicantName} is already enrolled as ${existingStudent.studentId}.`,
      });
      return;
    }

    const matchedCourse = courses.find((c) => c.id === item.courseId);
    const matchingBatch = batches.find((b) => b.courseId === item.courseId) || batches[0];
    const matchingSem = semesters.find((s) => s.courseId === item.courseId) || semesters[0];
    const nowDate = new Date().toISOString().split('T')[0];
    const userId = `usr-${Date.now()}`;

    const newStudent: Student = {
      id: `stud-${Date.now()}`,
      studentId: `SMA-2026-${Math.floor(100 + Math.random() * 900)}`,
      admissionNumber: `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      userId,
      name: item.applicantName,
      email: item.applicantEmail,
      phone: item.applicantPhone,
      whatsappPhone: item.applicantPhone,
      whatsappOptIn: true,
      guardianName: 'Self / Guardian',
      guardianPhone: item.applicantPhone,
      academicBackground: `${item.qualification} (${item.experienceLevel})`,
      status: 'ACTIVE',
      courseId: item.courseId,
      batchId: matchingBatch?.id || 'b-1',
      semesterId: matchingSem?.id || 's-1-1',
      enrollmentDate: nowDate,
      skills: [item.careerGoal],
      projectsCount: 0,
      certificatesCount: 0,
      attendancePercentage: 100,
      outstandingBalance: matchedCourse?.fee || 0,
      careerReadinessScore: 50,
    };

    const existingUsers = SwanayaDatabase.get<User[]>('users') || [];
    const newUser: User = {
      id: userId,
      email: item.applicantEmail.toLowerCase(),
      name: item.applicantName,
      role: 'STUDENT',
      status: 'ACTIVE',
      createdAt: nowDate,
      isVerified: true,
      preferredCourseId: item.courseId,
    };

    const nextStudents = [...students, newStudent];
    setStudents(nextStudents);
    SwanayaDatabase.set('students', nextStudents);
    SwanayaDatabase.set('users', [...existingUsers, newUser]);

    const updatedApps = applications.map((app) =>
      app.id === item.id ? { ...app, status: 'ENROLLED' as const } : app
    );
    setApplications(updatedApps);
    SwanayaDatabase.set('applications', updatedApps);

    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'COURSE_SELECTION_ENROLLED',
      `Enrolled verified applicant ${item.applicantName} (${newStudent.studentId}) into ${item.courseTitle}`
    );
    setNotice({
      type: 'success',
      text: `${item.applicantName} enrolled cleanly into ${item.courseTitle} as ${newStudent.studentId}.`,
    });
    onRefreshAllData();
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
            MD · Department · Academy Verification Desk
          </span>
          <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Course Selection &amp; Registration Verification</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Review candidate 3-option course configurations, verify academic eligibility at Department level, and issue final Managing Director approval.
          </p>
        </div>

        {/* Tabular KPI Strip */}
        <div className="flex flex-wrap items-center gap-6 text-xs border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800 shrink-0">
          <div>
            <span className="text-slate-400 block">Pending Dept</span>
            <span className="text-lg font-mono font-bold text-amber-400 tabular-nums">{counts.pendingDept}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Awaiting MD</span>
            <span className="text-lg font-mono font-bold text-sky-400 tabular-nums">{counts.awaitingMd}</span>
          </div>
          <div>
            <span className="text-slate-400 block">MD Verified</span>
            <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">{counts.mdVerified}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Total Queue</span>
            <span className="text-lg font-mono font-bold text-white tabular-nums">{counts.total}</span>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          {[
            { id: 'ALL', label: `All (${counts.total})` },
            { id: 'PENDING_DEPARTMENT', label: `Pending Dept (${counts.pendingDept})` },
            { id: 'PENDING_MD', label: `Awaiting MD (${counts.awaitingMd})` },
            { id: 'MD_VERIFIED', label: `MD Verified (${counts.mdVerified})` },
            { id: 'RETURNED_OR_REJECTED', label: `Returned / Declined (${counts.returnedOrRejected})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            aria-label="Filter by submission source"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="ALL">All Submission Sources</option>
            <option value="PORTAL_REGISTRATION">Student Portal Course Selection</option>
            <option value="PUBLIC_COURSE_SELECTION">Public Course Selection Page</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, email, or course..."
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Verification Queue List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-900/40 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-serif font-bold text-slate-200">
            No Course Selection Requests Found
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Submissions from the Student Portal Course Registration tab and the public Course Selection Page appear here for Department and MD verification.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQueue.map((item) => {
            const isBusy = processingId === item.id;
            const alreadyEnrolled =
              item.origin === 'PUBLIC_COURSE_SELECTION' &&
              (item.status === 'ENROLLED' ||
                students.some((s) => s.email.toLowerCase() === item.applicantEmail.toLowerCase()));

            return (
              <article
                key={`${item.origin}-${item.id}`}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-5"
              >
                {/* Row 1: Candidate & Program Headline */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-amber-400 font-semibold">{item.courseCode}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.origin === 'PORTAL_REGISTRATION'
                          ? 'Student Portal Course Selection'
                          : 'Public Course Selection Page'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {item.createdAt ? item.createdAt.substring(0, 10) : 'Today'}
                      </span>
                    </div>
                    <h3 className="text-lg font-serif font-bold text-white">
                      {item.applicantName}{' '}
                      <span className="text-slate-400 font-sans font-normal text-sm">
                        for {item.courseTitle}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {item.applicantEmail} · {item.applicantPhone}
                    </p>
                  </div>

                  {/* Two-Stage Verification Status Summary (Zero-Pill Typography) */}
                  <div className="flex flex-col sm:items-end gap-1.5 text-xs shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Department:</span>
                      <strong
                        className={
                          item.departmentVerificationStatus === 'VERIFIED'
                            ? 'text-emerald-400'
                            : item.departmentVerificationStatus === 'RETURNED'
                            ? 'text-amber-400'
                            : item.departmentVerificationStatus === 'REJECTED'
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }
                      >
                        {item.departmentVerificationStatus}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">MD Sign-Off:</span>
                      <strong
                        className={
                          item.mdVerificationStatus === 'VERIFIED'
                            ? 'text-emerald-400'
                            : item.mdVerificationStatus === 'REJECTED'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                        }
                      >
                        {item.mdVerificationStatus === 'PENDING_MD' ? 'PENDING MD' : item.mdVerificationStatus}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Row 2: The 3 Selected Dropdown Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                    <p className="font-serif font-semibold text-amber-400">01. Program &amp; Study Level</p>
                    <p className="text-slate-200 font-medium">{item.courseTitle}</p>
                    <p className="text-slate-400">Level Track: {item.levelFilter}</p>
                  </div>

                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                    <p className="font-serif font-semibold text-amber-400">02. Mode, Batch &amp; Schedule</p>
                    <p className="text-slate-200 font-medium">
                      {item.studyMode} · {String(item.preferredSchedule).replace(/_/g, ' ')}
                    </p>
                    <p className="text-slate-400 font-mono">Batch: {item.preferredBatch}</p>
                  </div>

                  <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                    <p className="font-serif font-semibold text-amber-400">03. Background &amp; Career Track</p>
                    <p className="text-slate-200 font-medium">{item.careerGoal}</p>
                    <p className="text-slate-400">
                      {item.qualification} · {item.experienceLevel}
                    </p>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-xs text-slate-300 italic border-t border-slate-800/60 pt-3">
                    Applicant Note: &ldquo;{item.notes}&rdquo;
                  </p>
                )}

                {/* Existing Audit Trail */}
                {(item.departmentVerifiedBy || item.mdVerifiedBy) && (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-3">
                    {item.departmentVerifiedBy && (
                      <span>
                        Dept Reviewed by <strong className="text-slate-200">{item.departmentVerifiedBy}</strong>
                        {item.departmentVerifiedRole ? ` (${item.departmentVerifiedRole})` : ''}
                        {item.departmentRemarks ? ` — "${item.departmentRemarks}"` : ''}
                      </span>
                    )}
                    {item.mdVerifiedBy && (
                      <span>
                        MD Reviewed by <strong className="text-emerald-300">{item.mdVerifiedBy}</strong>
                        {item.mdRemarks ? ` — "${item.mdRemarks}"` : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Row 3: Verification Controls */}
                <div className="pt-3 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={remarksById[item.id] ?? ''}
                    onChange={(e) => setRemarksById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Optional verification remarks (eligibility, seat allocation, batch confirmation)..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isDepartmentReviewer && item.mdVerificationStatus !== 'VERIFIED' && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDepartmentDecision(item, 'VERIFIED')}
                          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify (Department)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDepartmentDecision(item, 'RETURNED')}
                          className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Return</span>
                        </button>
                      </>
                    )}

                    {isMdExecutive && (
                      <>
                        {item.mdVerificationStatus !== 'VERIFIED' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleMdDecision(item, 'VERIFIED')}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>MD Final Verify</span>
                          </button>
                        )}
                        {item.mdVerificationStatus !== 'REJECTED' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleMdDecision(item, 'REJECTED')}
                            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        )}
                        {item.origin === 'PUBLIC_COURSE_SELECTION' &&
                          item.mdVerificationStatus === 'VERIFIED' &&
                          !alreadyEnrolled && (
                            <button
                              type="button"
                              onClick={() => handleEnrollVerifiedApplicant(item)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Enroll Scholar</span>
                            </button>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
