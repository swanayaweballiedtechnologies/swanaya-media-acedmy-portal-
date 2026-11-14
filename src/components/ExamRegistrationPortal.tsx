import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Calendar, Clock, MapPin, CheckCircle2, AlertCircle,
  Plus, X, Printer, Award, ShieldCheck, Building2, FileText, XCircle, Send
} from 'lucide-react';
import {
  SwanayaDatabase, User, Student, Course, ExamSession, ExamRegistration, ExamCenter, Notification
} from '../db/mockDb';
import { useAuth } from './FirebaseAuthProvider';
import { academyService } from '../services/academyService';
import VisualCaptcha from './VisualCaptcha';
import { auth, db } from '../firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';

interface ExamRegistrationPortalProps {
  currentUser: User;
  studentProfile?: Student | null;
  onRefreshAllData: () => void;
}

const DEFAULT_EXAM_CENTERS: ExamCenter[] = [
  {
    id: 'ec-tvm-main',
    name: 'Swanaya Main Studio Campus',
    location: 'Thiruvananthapuram, Kerala',
    totalCapacity: 120,
    availableSeats: 94,
  },
  {
    id: 'ec-kochi-hub',
    name: 'Kochi Media Innovation Center',
    location: 'Edappally, Kochi',
    totalCapacity: 80,
    availableSeats: 62,
  },
  {
    id: 'ec-online-proctored',
    name: 'Online Proctored Exam Desk',
    location: 'Remote Secure Browser',
    totalCapacity: 500,
    availableSeats: 480,
  },
];

export default function ExamRegistrationPortal({
  currentUser,
  studentProfile,
  onRefreshAllData,
}: ExamRegistrationPortalProps) {
  const { isAdmin: authIsAdmin } = useAuth();
  const isStudentCandidate =
    currentUser.role === 'STUDENT' || currentUser.role === 'ALUMNI';
  const isController =
    authIsAdmin ||
    ['SUPER_ADMIN', 'MD', 'ADMIN', 'ACADEMIC_ADMIN', 'INSTRUCTOR', 'REVIEWER'].includes(
      currentUser.role
    );

  const courses = useMemo(() => SwanayaDatabase.get<Course[]>('courses') || [], []);

  const [examSessions, setExamSessions] = useState<ExamSession[]>(() =>
    SwanayaDatabase.get<ExamSession[]>('examSessions') || []
  );
  const [examRegistrations, setExamRegistrations] = useState<ExamRegistration[]>(() =>
    SwanayaDatabase.get<ExamRegistration[]>('examRegistrations') || []
  );
  const [examCenters, setExamCenters] = useState<ExamCenter[]>(() => {
    const stored = SwanayaDatabase.get<ExamCenter[]>('examCenters');
    if (Array.isArray(stored) && stored.length > 0) return stored;
    SwanayaDatabase.set('examCenters', DEFAULT_EXAM_CENTERS);
    return DEFAULT_EXAM_CENTERS;
  });

  const [activeSubTab, setActiveSubTab] = useState<'available' | 'my-registrations' | 'controller' | 'centers'>(
    !isStudentCandidate && isController ? 'controller' : 'available'
  );
  const [regFilter, setRegFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Student Exam Registration Modal State
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [isDirectExamModalOpen, setIsDirectExamModalOpen] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState(examCenters[0]?.id || 'ec-tvm-main');
  const [declaredEligibility, setDeclaredEligibility] = useState(false);
  const [directExamForm, setDirectExamForm] = useState({
    examTitle: 'Semester End Examination',
    subjectCode: '',
    subjectName: '',
    preferredDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Create Session Modal State
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    subjectCode: '',
    subjectName: '',
    courseId: courses[0]?.id || 'c-1',
    scheduledDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '13:00',
    durationMinutes: 180,
    totalMarks: 100,
    passMarks: 40,
    examFee: 500,
    registrationDeadline: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    venue: 'Swanaya Main Studio Campus',
    instructions: 'Bring government photo ID and official academy hall ticket. Report 20 minutes early.',
  });

  // Admin Reject & Add Center States
  const [rejectingRegId, setRejectingRegId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [hallTicketModalReg, setHallTicketModalReg] = useState<ExamRegistration | null>(null);
  const [newCenterForm, setNewCenterForm] = useState({ name: '', location: '', totalCapacity: 100 });

  // Sync Firestore exam_sessions and exam_registrations when Firebase Auth is active
  useEffect(() => {
    let unsubSessions: (() => void) | null = null;
    let unsubRegs: (() => void) | null = null;

    if (auth.currentUser) {
      try {
        const sq = query(collection(db, 'exam_sessions'), orderBy('scheduledDate', 'asc'));
        unsubSessions = onSnapshot(
          sq,
          (snap) => {
            const cloudList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamSession));
            if (cloudList.length > 0) {
              const localList = SwanayaDatabase.get<ExamSession[]>('examSessions') || [];
              const merged = new Map<string, ExamSession>();
              localList.forEach((s) => merged.set(s.id, s));
              cloudList.forEach((s) => merged.set(s.id, s));
              const finalSessions = Array.from(merged.values());
              setExamSessions(finalSessions);
              SwanayaDatabase.set('examSessions', finalSessions);
            }
          },
          (err) => console.warn('Exam sessions listener note:', err.message)
        );

        const rq = isController
          ? query(collection(db, 'exam_registrations'))
          : query(collection(db, 'exam_registrations'), where('userId', '==', auth.currentUser.uid));

        unsubRegs = onSnapshot(
          rq,
          (snap) => {
            const cloudRegs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamRegistration));
            if (cloudRegs.length > 0) {
              const localRegs = SwanayaDatabase.get<ExamRegistration[]>('examRegistrations') || [];
              const merged = new Map<string, ExamRegistration>();
              localRegs.forEach((r) => merged.set(r.id, r));
              cloudRegs.forEach((r) => merged.set(r.id, r));
              const finalRegs = Array.from(merged.values());
              setExamRegistrations(finalRegs);
              SwanayaDatabase.set('examRegistrations', finalRegs);
            }
          },
          (err) => console.warn('Exam registrations listener note:', err.message)
        );
      } catch (err: any) {
        console.warn('Exam Firestore sync notice:', err?.message);
      }
    }

    return () => {
      if (unsubSessions) unsubSessions();
      if (unsubRegs) unsubRegs();
    };
  }, [isController]);

  const activeCandidate = useMemo(() => {
    return {
      userId: auth.currentUser?.uid || currentUser.id,
      studentId: studentProfile?.id || currentUser.id,
      studentName: studentProfile?.name || currentUser.name,
      studentEmail: studentProfile?.email || currentUser.email,
      registerNo: studentProfile?.studentId || `REG-${currentUser.id.slice(-5).toUpperCase()}`,
      courseId: studentProfile?.courseId || courses[0]?.id || 'c-1',
      courseName:
        courses.find((c) => c.id === (studentProfile?.courseId || courses[0]?.id))?.name ||
        'Academy Program',
      batchId: studentProfile?.batchId || 'b-1',
      batchName: studentProfile?.batchId || 'Active Cohort',
      attendancePct: studentProfile?.attendancePercentage ?? 100,
      outstandingBalance: studentProfile?.outstandingBalance ?? 0,
    };
  }, [currentUser, studentProfile, courses]);

  const myRegistrations = useMemo(() => {
    return examRegistrations.filter(
      (r) =>
        r.studentId === activeCandidate.studentId ||
        r.studentEmail.toLowerCase() === activeCandidate.studentEmail.toLowerCase()
    );
  }, [examRegistrations, activeCandidate]);

  const openSessionModal = (session: ExamSession) => {
    setSelectedSession(session);
    setIsDirectExamModalOpen(false);
    setDeclaredEligibility(false);
    setCaptchaToken(null);
    setCaptchaResetSignal((p) => p + 1);
    setStatusMessage(null);
  };

  const openDirectExamModal = () => {
    setSelectedSession(null);
    setIsDirectExamModalOpen(true);
    setDeclaredEligibility(false);
    setCaptchaToken(null);
    setCaptchaResetSignal((p) => p + 1);
    setStatusMessage(null);
  };

  const handleSubmitExamRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!declaredEligibility) {
      setStatusMessage({
        type: 'error',
        text: 'Please confirm the examination candidate declaration before submitting.',
      });
      return;
    }

    if (!captchaToken) {
      setStatusMessage({
        type: 'error',
        text: 'Please complete the human verification CAPTCHA before registering.',
      });
      return;
    }

    const sessionId = selectedSession?.id || `direct-${Date.now()}`;
    const alreadyRegistered =
      selectedSession &&
      myRegistrations.some(
        (r) => r.examSessionId === selectedSession.id && r.status !== 'REJECTED'
      );

    if (alreadyRegistered) {
      setStatusMessage({
        type: 'error',
        text: 'You have already submitted a registration for this examination session.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await academyService.verifyExamCaptcha(captchaToken);

      const center =
        examCenters.find((c) => c.id === selectedCenterId) || examCenters[0];
      const regId = `exreg-${Date.now()}`;

      const newRegistration: ExamRegistration = {
        id: regId,
        examSessionId: sessionId,
        examTitle: selectedSession?.title || directExamForm.examTitle.trim(),
        subjectCode:
          selectedSession?.subjectCode || directExamForm.subjectCode.trim().toUpperCase(),
        subjectName: selectedSession?.subjectName || directExamForm.subjectName.trim(),
        studentId: activeCandidate.studentId,
        studentName: activeCandidate.studentName,
        studentEmail: activeCandidate.studentEmail,
        studentRegisterNo: activeCandidate.registerNo,
        courseId: selectedSession?.courseId || activeCandidate.courseId,
        courseName: activeCandidate.courseName,
        batchId: activeCandidate.batchId,
        batchName: activeCandidate.batchName,
        registrationDate: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        examCenterId: center?.id,
        examCenterName: center ? `${center.name} (${center.location})` : 'Main Campus',
        feePaid: activeCandidate.outstandingBalance === 0,
        attendanceEligible: activeCandidate.attendancePct >= 75,
      };

      if (auth.currentUser) {
        try {
          await academyService.registerForExam({
            ...newRegistration,
            userId: auth.currentUser.uid,
          });
        } catch (err: any) {
          console.warn('Firestore exam registration sync notice:', err?.message);
        }
      }

      const updatedRegs = [newRegistration, ...examRegistrations];
      setExamRegistrations(updatedRegs);
      SwanayaDatabase.set('examRegistrations', updatedRegs);

      // Push notification
      const notifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
      const notif: Notification = {
        id: `not-${Date.now()}`,
        userId: currentUser.id,
        title: 'Examination Registration Received',
        message: `Registered for ${newRegistration.examTitle} (${newRegistration.subjectCode}). Pending controller hall ticket approval.`,
        type: 'INFO',
        read: false,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      SwanayaDatabase.set('notifications', [notif, ...notifs]);

      SwanayaDatabase.log(
        activeCandidate.studentEmail,
        activeCandidate.studentName,
        'EXAM_REGISTRATION_SUBMITTED',
        `${newRegistration.examTitle} - ${newRegistration.subjectCode}`
      );

      setSelectedSession(null);
      setIsDirectExamModalOpen(false);
      setCaptchaToken(null);
      setCaptchaResetSignal((p) => p + 1);
      setActiveSubTab('my-registrations');
      setStatusMessage({
        type: 'success',
        text: `Examination registration ${regId} submitted for ${newRegistration.examTitle}.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setCaptchaToken(null);
      setCaptchaResetSignal((p) => p + 1);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to complete examination registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExamSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const newSession: ExamSession = {
      id: `exses-${Date.now()}`,
      title: sessionForm.title.trim(),
      subjectCode: sessionForm.subjectCode.trim().toUpperCase(),
      subjectName: sessionForm.subjectName.trim(),
      courseId: sessionForm.courseId,
      batchId: 'ALL',
      scheduledDate: sessionForm.scheduledDate,
      startTime: sessionForm.startTime,
      endTime: sessionForm.endTime,
      durationMinutes: Number(sessionForm.durationMinutes) || 180,
      totalMarks: Number(sessionForm.totalMarks) || 100,
      passMarks: Number(sessionForm.passMarks) || 40,
      examFee: Number(sessionForm.examFee) || 0,
      registrationDeadline: sessionForm.registrationDeadline,
      registrationOpen: true,
      status: 'SCHEDULED',
      venue: sessionForm.venue.trim(),
      instructions: sessionForm.instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (auth.currentUser) {
      try {
        await academyService.createExamSession(newSession);
      } catch (err: any) {
        console.warn('Firestore createExamSession notice:', err?.message);
      }
    }

    const updated = [newSession, ...examSessions];
    setExamSessions(updated);
    SwanayaDatabase.set('examSessions', updated);
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'EXAM_SESSION_CREATED',
      `${newSession.title} (${newSession.subjectCode})`
    );

    setIsCreateSessionOpen(false);
    setSessionForm({
      ...sessionForm,
      title: '',
      subjectCode: '',
      subjectName: '',
    });
    setStatusMessage({
      type: 'success',
      text: `Examination session "${newSession.title}" is now open for student registration.`,
    });
    onRefreshAllData();
  };

  const handleToggleRegistrationOpen = async (session: ExamSession) => {
    const nextOpen = !session.registrationOpen;
    if (auth.currentUser) {
      try {
        await academyService.updateExamSession(session.id, { registrationOpen: nextOpen });
      } catch (err: any) {
        console.warn('Firestore updateExamSession notice:', err?.message);
      }
    }
    const updated = examSessions.map((s) =>
      s.id === session.id ? { ...s, registrationOpen: nextOpen } : s
    );
    setExamSessions(updated);
    SwanayaDatabase.set('examSessions', updated);
  };

  const handleApproveRegistration = async (reg: ExamRegistration) => {
    const hallTicketNo = `HT-SMA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const seatNumber = `S-${Math.floor(101 + Math.random() * 899)}`;
    const approvedAt = new Date().toISOString().split('T')[0];

    const patch: Partial<ExamRegistration> = {
      status: 'APPROVED',
      hallTicketNo,
      seatNumber,
      approvedBy: currentUser.name,
      approvedAt,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateExamRegistration(reg.id, patch);
      } catch (err: any) {
        console.warn('Firestore approve exam registration notice:', err?.message);
      }
    }

    const updatedRegs = examRegistrations.map((r) =>
      r.id === reg.id ? { ...r, ...patch } : r
    );
    setExamRegistrations(updatedRegs);
    SwanayaDatabase.set('examRegistrations', updatedRegs);

    const notifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
    SwanayaDatabase.set('notifications', [
      {
        id: `not-${Date.now()}`,
        userId: reg.studentId,
        title: 'Hall Ticket Issued',
        message: `Your registration for ${reg.examTitle} (${reg.subjectCode}) is approved. Hall Ticket: ${hallTicketNo}, Seat: ${seatNumber}.`,
        type: 'SUCCESS',
        read: false,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      },
      ...notifs,
    ]);

    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'EXAM_HALL_TICKET_ISSUED',
      `${reg.studentName} - ${hallTicketNo}`
    );

    setStatusMessage({
      type: 'success',
      text: `Approved ${reg.studentName} and issued Hall Ticket ${hallTicketNo}.`,
    });
    onRefreshAllData();
  };

  const handleConfirmRejectRegistration = async (reg: ExamRegistration) => {
    const reason = rejectionReason.trim() || 'Eligibility criteria not met.';
    const patch: Partial<ExamRegistration> = {
      status: 'REJECTED',
      rejectionReason: reason,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateExamRegistration(reg.id, patch);
      } catch (err: any) {
        console.warn('Firestore reject exam registration notice:', err?.message);
      }
    }

    const updatedRegs = examRegistrations.map((r) =>
      r.id === reg.id ? { ...r, ...patch } : r
    );
    setExamRegistrations(updatedRegs);
    SwanayaDatabase.set('examRegistrations', updatedRegs);

    setRejectingRegId(null);
    setRejectionReason('');
    setStatusMessage({ type: 'success', text: `Registration ${reg.id} marked as rejected.` });
    onRefreshAllData();
  };

  const handleAddCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterForm.name.trim() || !newCenterForm.location.trim()) return;
    const center: ExamCenter = {
      id: `ec-${Date.now()}`,
      name: newCenterForm.name.trim(),
      location: newCenterForm.location.trim(),
      totalCapacity: Number(newCenterForm.totalCapacity) || 100,
      availableSeats: Number(newCenterForm.totalCapacity) || 100,
    };
    const updated = [...examCenters, center];
    setExamCenters(updated);
    SwanayaDatabase.set('examCenters', updated);
    setNewCenterForm({ name: '', location: '', totalCapacity: 100 });
    setStatusMessage({ type: 'success', text: `Exam center "${center.name}" added.` });
  };

  const filteredRegistrations = useMemo(() => {
    if (regFilter === 'ALL') return examRegistrations;
    return examRegistrations.filter((r) => r.status === regFilter);
  }, [examRegistrations, regFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            <span>Swanaya Examination Board</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">
            {isStudentCandidate
              ? 'Examination Registration & Hall Tickets'
              : 'Examination Sessions & Center Approvals'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isStudentCandidate
              ? 'Register for upcoming semester examinations, select your exam center, and download approved hall tickets.'
              : 'Publish official examination schedules, approve candidate applications, and allocate examination centers.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isStudentCandidate && (
            <button
              type="button"
              onClick={openDirectExamModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              <span>Apply for Exam</span>
            </button>
          )}

          {isController && (
            <button
              type="button"
              onClick={() => setIsCreateSessionOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs uppercase tracking-wider rounded-lg border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Open Exam Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate Eligibility Strip (Student / Alumni Only) */}
      {isStudentCandidate && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div>
            <p className="text-[11px] text-slate-500 uppercase font-medium">Candidate Reg. No</p>
            <p className="text-sm font-mono tabular-nums font-bold text-white mt-0.5">
              {activeCandidate.registerNo}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 uppercase font-medium">Enrolled Program</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
              {activeCandidate.courseName}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 uppercase font-medium">Attendance Standing</p>
            <p
              className={`text-sm font-mono tabular-nums font-bold mt-0.5 flex items-center gap-1.5 ${
                activeCandidate.attendancePct >= 75 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {activeCandidate.attendancePct >= 75 ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>
                {activeCandidate.attendancePct}% (
                {activeCandidate.attendancePct >= 75 ? 'Eligible' : 'Review Required'})
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 uppercase font-medium">My Exam Entries</p>
            <p className="text-sm font-mono tabular-nums font-bold text-amber-400 mt-0.5">
              {myRegistrations.length} Submitted
            </p>
          </div>
        </div>
      )}

      {/* Inline Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subnav Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('available')}
          className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeSubTab === 'available'
              ? 'bg-amber-500 text-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Open Examination Sessions ({examSessions.length})
        </button>
        {isStudentCandidate && (
          <button
            type="button"
            onClick={() => setActiveSubTab('my-registrations')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'my-registrations'
                ? 'bg-amber-500 text-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            My Registrations &amp; Hall Tickets ({myRegistrations.length})
          </button>
        )}
        {isController && (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('controller')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'controller'
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Controller Approvals ({examRegistrations.filter((r) => r.status === 'PENDING').length} Pending)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('centers')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === 'centers'
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Exam Centers ({examCenters.length})
            </button>
          </>
        )}
      </div>

      {/* TAB 1: Available Exam Sessions */}
      {activeSubTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {examSessions.map((session) => {
            const existingReg = myRegistrations.find((r) => r.examSessionId === session.id);
            const isOpen = session.registrationOpen !== false && session.status === 'SCHEDULED';

            return (
              <div
                key={session.id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-amber-500/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-amber-400 font-semibold">
                        {session.subjectCode} · {session.subjectName}
                      </p>
                      <h3 className="text-base font-serif font-bold text-white mt-0.5">
                        {session.title}
                      </h3>
                    </div>
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        isOpen ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {isOpen ? 'Registration Open' : session.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono tabular-nums">{session.scheduledDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        {session.startTime}–{session.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        {session.totalMarks} Marks (Pass {session.passMarks})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{session.venue || 'Main Studio'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Exam Fee:{' '}
                    <strong className="text-slate-200">
                      ₹{(session.examFee ?? 0).toLocaleString('en-IN')}
                    </strong>
                    {session.registrationDeadline && (
                      <span> · Due {session.registrationDeadline}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isController && (
                      <button
                        type="button"
                        onClick={() => handleToggleRegistrationOpen(session)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 cursor-pointer"
                      >
                        {session.registrationOpen !== false ? 'Close Entry' : 'Reopen'}
                      </button>
                    )}

                    {isStudentCandidate && (
                      existingReg ? (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('my-registrations')}
                          className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-md cursor-pointer"
                        >
                          {existingReg.status === 'APPROVED'
                            ? 'View Hall Ticket'
                            : `Status: ${existingReg.status}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!isOpen}
                          onClick={() => openSessionModal(session)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Register Now
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {examSessions.length === 0 && (
            <div className="col-span-full py-14 px-6 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl space-y-4">
              <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200">
                  No Scheduled Examination Sessions Published Yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isStudentCandidate
                    ? 'You can submit a direct Subject Examination Registration application now, or an administrator can open an official examination session.'
                    : 'Open an official examination session for students to register.'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {isStudentCandidate && (
                  <button
                    type="button"
                    onClick={openDirectExamModal}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md cursor-pointer"
                  >
                    Apply for Direct Exam Registration
                  </button>
                )}
                {isController && (
                  <button
                    type="button"
                    onClick={() => setIsCreateSessionOpen(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold uppercase rounded-md border border-slate-700 cursor-pointer"
                  >
                    Open New Exam Session
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: My Registrations & Hall Tickets */}
      {activeSubTab === 'my-registrations' && isStudentCandidate && (
        <div className="space-y-4">
          {myRegistrations.map((reg) => (
            <div
              key={reg.id}
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-amber-400 font-semibold">
                    {reg.subjectCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400 font-mono tabular-nums">
                    Applied {reg.registrationDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold inline-flex items-center gap-1 ${
                      reg.status === 'APPROVED'
                        ? 'text-emerald-400'
                        : reg.status === 'REJECTED'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {reg.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {reg.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                    {reg.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                    <span>{reg.status}</span>
                  </span>
                </div>
                <h3 className="text-base font-serif font-bold text-white">
                  {reg.examTitle} — {reg.subjectName}
                </h3>
                <p className="text-xs text-slate-400">
                  Center: {reg.examCenterName}
                  {reg.hallTicketNo && ` · Hall Ticket: ${reg.hallTicketNo}`}
                  {reg.seatNumber && ` · Seat: ${reg.seatNumber}`}
                </p>
                {reg.status === 'REJECTED' && reg.rejectionReason && (
                  <p className="text-xs text-rose-400">Reason: {reg.rejectionReason}</p>
                )}
              </div>

              {reg.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() => setHallTicketModalReg(reg)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>View Hall Ticket</span>
                </button>
              )}
            </div>
          ))}

          {myRegistrations.length === 0 && (
            <div className="py-14 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                You have not submitted any examination registrations yet.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('available')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md cursor-pointer"
              >
                Browse Open Exams
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Controller Approvals (Admin / Instructor) */}
      {activeSubTab === 'controller' && isController && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setRegFilter(status)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    regFilter === status
                      ? 'bg-amber-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredRegistrations.map((reg) => (
              <div
                key={reg.id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-white">{reg.studentName}</span>
                      <span className="font-mono text-amber-400">{reg.studentRegisterNo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400">{reg.studentEmail}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200">
                      {reg.examTitle} ({reg.subjectCode} — {reg.subjectName})
                    </p>
                    <p className="text-xs text-slate-400">
                      Center: {reg.examCenterName} · Registered: {reg.registrationDate} · Status:{' '}
                      <strong
                        className={
                          reg.status === 'APPROVED'
                            ? 'text-emerald-400'
                            : reg.status === 'REJECTED'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }
                      >
                        {reg.status}
                      </strong>
                    </p>
                  </div>

                  {reg.status === 'PENDING' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveRegistration(reg)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve &amp; Issue Hall Ticket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingRegId(reg.id);
                          setRejectionReason('');
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-rose-950 border border-slate-700 text-rose-400 text-xs font-semibold uppercase rounded-md cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {reg.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => setHallTicketModalReg(reg)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded border border-slate-700 cursor-pointer"
                    >
                      Hall Ticket: {reg.hallTicketNo}
                    </button>
                  )}
                </div>

                {rejectingRegId === reg.id && (
                  <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleConfirmRejectRegistration(reg)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingRegId(null)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredRegistrations.length === 0 && (
              <div className="py-14 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">
                  No examination registrations match the selected filter.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Exam Centers */}
      {activeSubTab === 'centers' && isController && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {examCenters.map((center) => (
              <div
                key={center.id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center gap-2 text-amber-400">
                  <Building2 className="w-4 h-4" />
                  <h4 className="text-sm font-bold text-white">{center.name}</h4>
                </div>
                <p className="text-xs text-slate-400">{center.location}</p>
                <p className="text-xs font-mono tabular-nums text-emerald-400 pt-2">
                  {center.availableSeats} / {center.totalCapacity} Seats Available
                </p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddCenter}
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4 h-fit"
          >
            <h4 className="text-sm font-bold text-white">Add Examination Center</h4>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Center Name</label>
              <input
                type="text"
                required
                value={newCenterForm.name}
                onChange={(e) => setNewCenterForm({ ...newCenterForm, name: e.target.value })}
                placeholder="e.g. Calicut Studio Wing"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Location</label>
              <input
                type="text"
                required
                value={newCenterForm.location}
                onChange={(e) => setNewCenterForm({ ...newCenterForm, location: e.target.value })}
                placeholder="City / Campus"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Seat Capacity</label>
              <input
                type="number"
                min={10}
                required
                value={newCenterForm.totalCapacity}
                onChange={(e) =>
                  setNewCenterForm({ ...newCenterForm, totalCapacity: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
            >
              Add Center
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Student Exam Registration (Session or Direct) */}
      {(selectedSession || isDirectExamModalOpen) && isStudentCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-serif font-bold text-white">
                  {selectedSession ? `Register: ${selectedSession.title}` : 'Examination Registration Application'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSession(null);
                  setIsDirectExamModalOpen(false);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitExamRegistration} className="p-6 space-y-4">
              {selectedSession ? (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <p className="text-amber-400 font-mono font-semibold">
                    {selectedSession.subjectCode} · {selectedSession.subjectName}
                  </p>
                  <p className="text-slate-300">
                    Date: {selectedSession.scheduledDate} · {selectedSession.startTime}–{selectedSession.endTime} · Fee: ₹
                    {(selectedSession.examFee ?? 0).toLocaleString('en-IN')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Examination Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={directExamForm.examTitle}
                      onChange={(e) =>
                        setDirectExamForm({ ...directExamForm, examTitle: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Subject Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={directExamForm.subjectCode}
                      onChange={(e) =>
                        setDirectExamForm({ ...directExamForm, subjectCode: e.target.value })
                      }
                      placeholder="e.g. SMA-201"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={directExamForm.subjectName}
                      onChange={(e) =>
                        setDirectExamForm({ ...directExamForm, subjectName: e.target.value })
                      }
                      placeholder="e.g. AI Media Production"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                <div>
                  <span className="text-slate-500 block">Candidate</span>
                  <span className="font-semibold text-white">{activeCandidate.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Register No</span>
                  <span className="font-mono text-amber-400">{activeCandidate.registerNo}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 uppercase font-semibold">
                  Preferred Examination Center *
                </label>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                >
                  {examCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.location}) — {c.availableSeats} seats left
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <input
                  type="checkbox"
                  checked={declaredEligibility}
                  onChange={(e) => setDeclaredEligibility(e.target.checked)}
                  className="mt-0.5 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  I verify my candidate details and agree to abide by the Swanaya Media Academy Examination Board conduct rules.
                </span>
              </label>

              <VisualCaptcha
                purpose="exam_registration"
                compact
                onTokenChange={(tok) => setCaptchaToken(tok)}
                resetSignal={captchaResetSignal}
              />

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSession(null);
                    setIsDirectExamModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Verifying...' : 'Confirm Registration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Admin Create Exam Session */}
      {isCreateSessionOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-serif font-bold text-white">
                Open New Examination Session
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateSessionOpen(false)}
                className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExamSession} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-semibold">
                  Examination Title *
                </label>
                <input
                  type="text"
                  required
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  placeholder="e.g. Semester II Final Assessment 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={sessionForm.subjectCode}
                    onChange={(e) => setSessionForm({ ...sessionForm, subjectCode: e.target.value })}
                    placeholder="e.g. ADWD-104"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={sessionForm.subjectName}
                    onChange={(e) => setSessionForm({ ...sessionForm, subjectName: e.target.value })}
                    placeholder="e.g. AI Business Architecture"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={sessionForm.scheduledDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, scheduledDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">Start</label>
                  <input
                    type="time"
                    required
                    value={sessionForm.startTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">End</label>
                  <input
                    type="time"
                    required
                    value={sessionForm.endTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">Total Marks</label>
                  <input
                    type="number"
                    value={sessionForm.totalMarks}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, totalMarks: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">Exam Fee (₹)</label>
                  <input
                    type="number"
                    value={sessionForm.examFee}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, examFee: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">Deadline</label>
                  <input
                    type="date"
                    value={sessionForm.registrationDeadline}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, registrationDeadline: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateSessionOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Publish Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Printable Official Hall Ticket */}
      {hallTicketModalReg && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-amber-500/40 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                  Swanaya Media Academy · Examination Board
                </p>
                <h3 className="text-lg font-serif font-bold text-white">Official Hall Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setHallTicketModalReg(null)}
                className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div>
                <span className="text-slate-500 block">Hall Ticket No</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {hallTicketModalReg.hallTicketNo}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Allocated Seat</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {hallTicketModalReg.seatNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Candidate Name</span>
                <span className="font-semibold text-white">{hallTicketModalReg.studentName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Register No</span>
                <span className="font-mono text-slate-200">{hallTicketModalReg.studentRegisterNo}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Examination</span>
                <span className="font-semibold text-white">
                  {hallTicketModalReg.examTitle} ({hallTicketModalReg.subjectCode} —{' '}
                  {hallTicketModalReg.subjectName})
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Examination Center</span>
                <span className="text-slate-200">{hallTicketModalReg.examCenterName}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Hall Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
