/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Video, FileText, CheckCircle2, AlertCircle, Clock, 
  Send, ExternalLink, Star, PlayCircle, BarChart2, Calendar, Download, QrCode, X, Camera, Film, ShieldCheck, KeyRound, MessageCircle, CreditCard 
} from 'lucide-react';
import { 
  SwanayaDatabase, Student, Course, Subject, Lesson, 
  ClassSchedule, Assignment, Submission, AcademyReview, AttendanceRecord,
  AttendanceQrSession, LiveClassSession
} from '../db/mockDb';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import MediaHubModule from './MediaHubModule';
import ExamRegistrationPortal from './ExamRegistrationPortal';
import CourseRegistrationPortal from './CourseRegistrationPortal';
import ReviewsPortal from './ReviewsPortal';
import ExaminationEngineModule from './ExaminationEngineModule';
import StudentCoursePapersPanel from './StudentCoursePapersPanel';
import LiveClassMeetWhatsAppPanel from './LiveClassMeetWhatsAppPanel';
import GoogleMeetStudioPanel from './GoogleMeetStudioPanel';
import StudentFeePaymentPanel from './StudentFeePaymentPanel';
import StudentCourseSelectionPanel from './StudentCourseSelectionPanel';
import { triggerBrandedPdfDownload } from './CoursePaperPreviewModal';
import { academyService } from '../services/academyService';
import { useTheme } from '../context/ThemeContext';
import { resolveEffectivePalette } from '../types/theme';

export type StudentPortalTab =
  | 'syllabus'
  | 'course-selection'
  | 'live-class'
  | 'google-meet'
  | 'course-papers'
  | 'assignments'
  | 'results'
  | 'exams'
  | 'reviews'
  | 'media'
  | 'registration'
  | 'exam-registration'
  | 'fees'
  | 'notifications'
  | 'profile';

interface StudentPortalProps {
  studentUser: Student;
  currentUser: any;
  onRefreshAllData: () => void;
  onOpenProfile?: (target: { type: 'STUDENT' | 'INSTRUCTOR' | 'USER'; id: string }) => void;
  initialTab?: StudentPortalTab;
}

export default function StudentPortal({ studentUser, currentUser, onRefreshAllData, onOpenProfile, initialTab }: StudentPortalProps) {
  const { themeConfig, activeSection, isDark } = useTheme();
  const activePalette = resolveEffectivePalette(themeConfig, activeSection);
  // Real-time Firestore courses subscription + local DB
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [lessons, setLessons] = useState<Lesson[]>(() => SwanayaDatabase.get<Lesson[]>("lessons"));
  const [classes, setClasses] = useState<LiveClassSession[]>([]);
  const [assignments] = useState<Assignment[]>(() => SwanayaDatabase.get<Assignment[]>("assignments"));
  const [submissions, setSubmissions] = useState<Submission[]>(() => SwanayaDatabase.get<Submission[]>("submissions"));
  const [reviews] = useState<AcademyReview[]>(() => SwanayaDatabase.get<AcademyReview[]>("reviews"));

  const [activeTab, setActiveTab] = useState<StudentPortalTab>(initialTab || 'syllabus');
  const [portalNotice, setPortalNotice] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  React.useEffect(() => {
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (list) => setCourses(list),
    });
    const unsubClasses = academyService.subscribeClassSessions({
      includeInactive: false,
      onData: (list) => setClasses(list),
    });
    return () => {
      unsubscribe();
      unsubClasses();
    };
  }, []);

  // LMS Interactive State
  const resolvedCourseId =
    studentUser.courseId ||
    currentUser?.courseId ||
    currentUser?.preferredCourseId ||
    (Array.isArray(currentUser?.enrolledCourseIds) ? currentUser.enrolledCourseIds[0] : '');
  const studentCourse = courses.find(c => c.id === resolvedCourseId);
  const studentSubjects = subjects.filter(s => s.semesterId === studentUser.semesterId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(studentSubjects[0]?.id || 'sub-101');
  
  const currentSubjectLessons = lessons.filter(l => l.subjectId === selectedSubjectId);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(currentSubjectLessons[0] || null);

  // Lesson completions state (persisted locally)
  const [completions, setCompletions] = useState<Record<string, 'NOT_STARTED' | 'COMPLETED'>>(() => {
    const saved = localStorage.getItem(`sma_lesson_comp_${studentUser.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Assignment submissions input state
  const [submissionForms, setSubmissionForms] = useState<Record<string, string>>({});
  const [submissionFileNames, setSubmissionFileNames] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Dynamic QR Attendance Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeQrSessions, setActiveQrSessions] = useState<AttendanceQrSession[]>([]);
  const [manualQrToken, setManualQrToken] = useState<string>('');
  const [scanResultMsg, setScanResultMsg] = useState<string>('');
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [scanSuccessAlert, setScanSuccessAlert] = useState(false);
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState<string>('');
  const [attendanceRateDisplay, setAttendanceRateDisplay] = useState<number>(studentUser.attendancePercentage);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setAttendanceRateDisplay(studentUser.attendancePercentage);
  }, [studentUser.attendancePercentage]);

  useEffect(() => {
    const unsubQr = academyService.subscribeActiveQrSessions((list) => {
      setActiveQrSessions(list);
    });
    return () => unsubQr();
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isScannerOpen) {
      stopCameraStream();
      setCameraStatusMsg('');
      setScanErrorMsg(null);
    }
  }, [isScannerOpen]);

  // Sync active lesson when subject shifts
  React.useEffect(() => {
    const filtered = lessons.filter(l => l.subjectId === selectedSubjectId);
    if (filtered.length > 0) {
      setActiveLesson(filtered[0]);
    } else {
      setActiveLesson(null);
    }
  }, [selectedSubjectId, lessons]);

  // Mark lesson completion
  const handleToggleLessonComplete = (lessonId: string) => {
    const updated = {
      ...completions,
      [lessonId]: completions[lessonId] === 'COMPLETED' ? 'NOT_STARTED' as const : 'COMPLETED' as const
    };
    setCompletions(updated);
    localStorage.setItem(`sma_lesson_comp_${studentUser.id}`, JSON.stringify(updated));
    onRefreshAllData();
  };

  // Submit Homework with PDF upload attachments!
  const handleSubmitAssignment = (asgId: string) => {
    const content = submissionForms[asgId] || '';
    const attachedPdfName = submissionFileNames[asgId];
    
    if (!content.trim() && !attachedPdfName) return;

    setSubmittingId(asgId);
    
    setTimeout(() => {
      const allSubmissions = SwanayaDatabase.get<Submission[]>("submissions");
      
      const newSubmission: Submission = {
        id: `subm-${Date.now()}`,
        assignmentId: asgId,
        studentId: studentUser.id,
        submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        content: content || `Attached PDF Homework Document: ${attachedPdfName}`,
        fileUrl: attachedPdfName ? `/uploads/submissions/${attachedPdfName}` : undefined,
        status: 'SUBMITTED'
      };

      const finalSubmissions = [...allSubmissions.filter(s => !(s.assignmentId === asgId && s.studentId === studentUser.id)), newSubmission];
      SwanayaDatabase.set("submissions", finalSubmissions);
      setSubmissions(finalSubmissions);
      
      setSubmissionForms({ ...submissionForms, [asgId]: '' });
      setSubmissionFileNames({ ...submissionFileNames, [asgId]: '' });
      setSubmittingId(null);
      
      SwanayaDatabase.log(currentUser.email, currentUser.name, "ASSIGNMENT_SUBMIT", `Submitted Homework with attached PDF for Task ID: ${asgId}`);
      onRefreshAllData();
    }, 1500);
  };

  const verifyAndMarkQrAttendance = async (rawPayloadOrToken: string) => {
    setScanErrorMsg(null);
    setIsSubmittingQr(true);
    try {
      const session = await academyService.findQrSessionByTokenOrPayload(rawPayloadOrToken);
      if (!session) {
        setScanErrorMsg('Invalid or unrecognized attendance QR code / token. Confirm the code shown on your Instructor screen.');
        return;
      }

      const result = await academyService.submitQrAttendanceCheckIn({
        session,
        student: studentUser,
        userId: currentUser?.id || studentUser.userId || studentUser.id,
      });

      if (!result.ok) {
        setScanErrorMsg(result.message);
        return;
      }

      stopCameraStream();
      const updatedAll = SwanayaDatabase.get<Student[]>('students');
      const refreshedMe = updatedAll.find((s) => s.id === studentUser.id);
      if (refreshedMe) {
        setAttendanceRateDisplay(refreshedMe.attendancePercentage);
      }
      setScanResultMsg(result.message);
      setScanSuccessAlert(true);
      setPortalNotice({ type: 'success', text: result.message });
      onRefreshAllData();

      setTimeout(() => {
        setScanSuccessAlert(false);
        setManualQrToken('');
        setIsScannerOpen(false);
      }, 2400);
    } catch (err: any) {
      setScanErrorMsg(err?.message || 'Unable to verify attendance QR session.');
    } finally {
      setIsSubmittingQr(false);
    }
  };

  const handleStartCameraScanner = async () => {
    setScanErrorMsg(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraStatusMsg('Camera access unavailable on this browser. Enter the Instructor dynamic code below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        setCameraStatusMsg('Camera live — point at the Instructor Attendance QR code.');
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const scanLoop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (Array.isArray(barcodes) && barcodes.length > 0 && barcodes[0]?.rawValue) {
              await verifyAndMarkQrAttendance(barcodes[0].rawValue);
              return;
            }
          } catch {
            // continue polling frames
          }
          if (streamRef.current) {
            setTimeout(() => void scanLoop(), 350);
          }
        };
        setTimeout(() => void scanLoop(), 400);
      } else {
        setCameraStatusMsg('Camera active. If your browser does not auto-decode QR frames, enter the Instructor token (SMA-XXXXXX) below.');
      }
    } catch {
      setCameraActive(false);
      setCameraStatusMsg('Camera permission denied or no camera detected. Use the Dynamic Token check-in below.');
    }
  };

  // Math summary parameters
  const totalSyllabusLessons = lessons.filter(l => subjects.some(s => s.semesterId === studentUser.semesterId && s.id === l.subjectId)).length;
  const completedCount = Object.entries(completions).filter(([lid, val]) => val === 'COMPLETED' && lessons.some(l => l.id === lid)).length;
  const completionPercent = totalSyllabusLessons > 0 ? Math.round((completedCount / totalSyllabusLessons) * 100) : 0;

  // Filter current student items (include enrolled course + academy-wide live rooms)
  const studentReviews = reviews.filter(r => r.authorId === currentUser?.id || r.authorName === studentUser.name);
  const studentSchedule = classes.filter(
    (c) => !resolvedCourseId || c.courseId === resolvedCourseId || c.courseId === 'general'
  );

  return (
    <div className="space-y-6">
      {portalNotice && (
        <div
          className={`rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs border ${
            portalNotice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : portalNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <span>{portalNotice.text}</span>
          <button
            type="button"
            onClick={() => setPortalNotice(null)}
            className="p-1 rounded hover:bg-black/30 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Attendance & Alert banners */}
      {studentUser.attendancePercentage < 75 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">Attendance Warning alert</h4>
            <p className="text-[11px] text-slate-400">Your current aggregate attendance is <strong className="text-rose-400">{studentUser.attendancePercentage}%</strong>, which is below the mandatory 75% requirement. Please coordinate with Professor Ananthakrishnan immediately to prevent suspension.</p>
          </div>
        </div>
      )}

      {studentUser.outstandingBalance > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-400">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">Fee installment Outstanding</h4>
              <p className="text-[11px] text-slate-400">You have an outstanding fee balance of <strong className="text-amber-400">₹{studentUser.outstandingBalance.toLocaleString('en-IN')}</strong>. Please settle your dues before the upcoming Semester Examinations to avoid hall-ticket withholding.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pay via GPay / UPI</span>
          </button>
        </div>
      )}

      {/* Hero Welcome Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Welcome and Progress Card */}
        <div className="md:col-span-8 bg-slate-900/40 border border-slate-800 rounded-lg p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
          
          <div className="space-y-2 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-amber-500 font-mono tracking-wider font-bold">STUDENT COHORT PORTAL</p>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-white">Welcome back, {studentUser.name}!</h2>
              <p className="text-slate-400 text-xs">{studentCourse?.name} ({studentCourse?.code})</p>
            </div>

            {onOpenProfile && (
              <button
                onClick={() => onOpenProfile({ type: 'STUDENT', id: studentUser.id })}
                className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-sm"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>My Profile & Digital ID</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-850 mt-6 relative z-10">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">OVERALL ATTENDANCE</span>
              <p className={`text-base font-bold font-mono ${attendanceRateDisplay < 75 ? 'text-rose-400':'text-emerald-400'}`}>
                {attendanceRateDisplay}%
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">SYLLABUS PROGRESS</span>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold font-mono text-slate-200">{completionPercent}%</p>
                <div className="flex-grow bg-slate-950 h-1.5 rounded overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${completionPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">ACADEMY REVIEWS</span>
              <p className="text-base font-bold font-mono tabular-nums text-amber-400 flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {studentReviews.length}
              </p>
            </div>
          </div>
        </div>

        {/* Today's schedule Widget (Contains QR code scanner entry!) */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 p-6 rounded-lg space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-850 pb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              Class Timetable
            </h3>

            <div className="space-y-3 mt-3 max-h-60 overflow-y-auto pr-1">
              {studentSchedule.length > 0 ? (
                studentSchedule.map((cls) => {
                  const meetHref = cls.googleMeetUrl || cls.meetingLink || '';
                  const waHref = cls.whatsappGroupUrl || '';
                  return (
                    <div key={cls.id} className="bg-slate-950 p-3 rounded border border-slate-900 text-xs space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold text-slate-200 leading-snug">
                          {cls.title || subjects.find(s=>s.id===cls.subjectId)?.name || cls.courseName || 'Live Class'}
                        </p>
                        <span className="text-[9px] font-mono text-amber-500 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 shrink-0">
                          {cls.type}
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-[10px] tabular-nums">
                        {cls.date} · {cls.startTime} - {cls.endTime}
                      </p>
                      {(meetHref || waHref) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {meetHref && (
                            <a
                              href={meetHref}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold uppercase rounded inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Video className="w-3 h-3" />
                              <span>Join Meet</span>
                            </a>
                          )}
                          {waHref && (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp Group</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic text-center py-4">No active classes today.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850/60 mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab('live-class')}
              className="w-full py-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 font-semibold uppercase text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp Group &amp; Google Meet</span>
            </button>

            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold uppercase text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/5"
            >
              <QrCode className="w-4 h-4 text-amber-500" />
              Scan Attendance QR Code
            </button>
          </div>
        </div>

      </div>

      {/* Career Readiness Score 6-Month Historical Recharts Line Chart */}
      {(() => {
        const currentScore = studentUser.careerReadinessScore || 65;
        const projectsCount = studentUser.projectsCount || 2;
        const certsCount = studentUser.certificatesCount || 1;
        const skillsCount = studentUser.skills?.length || 4;

        const chartSurface = isDark ? activePalette.darkSurface : activePalette.surface;
        const chartText = isDark ? '#F5F4FA' : activePalette.textPrimary;
        const chartMuted = isDark ? '#B2B5C7' : activePalette.textSecondary;
        const chartBorder = isDark ? '#2E2E4A' : activePalette.border;
        const primaryLine = activePalette.accent;
        const secondaryLine = activePalette.secondary;

        const now = new Date();
        const careerReadinessHistory = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = d.toLocaleString('default', { month: 'short', year: '2-digit' });

          let calculatedScore = currentScore;
          if (i === 5) calculatedScore = Math.max(20, currentScore - 35 - (projectsCount * 2));
          else if (i === 4) calculatedScore = Math.max(30, currentScore - 26 - (projectsCount * 2));
          else if (i === 3) calculatedScore = Math.max(40, currentScore - 18 - projectsCount);
          else if (i === 2) calculatedScore = Math.max(48, currentScore - 11 - projectsCount);
          else if (i === 1) calculatedScore = Math.max(58, currentScore - 5);
          else calculatedScore = currentScore;

          calculatedScore = Math.min(100, Math.max(10, Math.round(calculatedScore)));

          careerReadinessHistory.push({
            month: monthName,
            readinessScore: calculatedScore,
            portfolioProjects: Math.max(1, projectsCount - Math.floor(i / 1.5)),
            verifiedCertificates: Math.min(certsCount, Math.max(0, certsCount - (i > 2 ? 1 : 0))),
          });
        }

        return (
          <div className="bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-serif font-bold text-[var(--sma-active-text)] flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[var(--sma-accent)]" />
                  <span>Career Readiness Score · 6-Month Historical Progression</span>
                </h3>
                <p className="text-xs text-[var(--sma-active-text-muted)] mt-0.5">
                  Pulling from your historical portfolio submissions, project milestones, and verified skill assessments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tabular-nums font-bold px-3 py-1 rounded-lg bg-[var(--sma-accent)]/12 text-[var(--sma-accent)] border border-[var(--sma-accent)]/35">
                  Current Rating: {studentUser.careerReadinessScore}%
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={careerReadinessHistory}
                  margin={{ top: 15, right: 25, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} />
                  <XAxis dataKey="month" stroke={chartMuted} tick={{ fontSize: 11, fill: chartMuted }} />
                  <YAxis domain={[0, 100]} stroke={chartMuted} tick={{ fontSize: 11, fill: chartMuted }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartSurface,
                      borderColor: chartBorder,
                      borderRadius: '8px',
                      color: chartText,
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: chartText }} />
                  <Line type="monotone" dataKey="readinessScore" name="Career Readiness Score (%)" stroke={primaryLine} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="portfolioProjects" name="Portfolio Projects Built" stroke={secondaryLine} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--sma-active-border)] text-xs">
              <div className="bg-[var(--sma-active-bg)] p-3 rounded-lg border border-[var(--sma-active-border)]">
                <span className="text-[10px] font-mono text-[var(--sma-active-text-muted)] uppercase block">Portfolio Projects</span>
                <p className="text-base font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-0.5">{studentUser.projectsCount} Built</p>
              </div>
              <div className="bg-[var(--sma-active-bg)] p-3 rounded-lg border border-[var(--sma-active-border)]">
                <span className="text-[10px] font-mono text-[var(--sma-active-text-muted)] uppercase block">Verified Certificates</span>
                <p className="text-base font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-0.5">{studentUser.certificatesCount} Awarded</p>
              </div>
              <div className="bg-[var(--sma-active-bg)] p-3 rounded-lg border border-[var(--sma-active-border)]">
                <span className="text-[10px] font-mono text-[var(--sma-active-text-muted)] uppercase block">Tracked Skills</span>
                <p className="text-base font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-0.5">{skillsCount} Active</p>
              </div>
              <div className="bg-[var(--sma-active-bg)] p-3 rounded-lg border border-[var(--sma-active-border)]">
                <span className="text-[10px] font-mono text-[var(--sma-active-text-muted)] uppercase block">6-Month Trend</span>
                <p className="text-base font-bold font-mono tabular-nums text-[var(--sma-accent)] mt-0.5">+{Math.round(currentScore * 0.4)}% Progression</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Subnav tab bar */}
      <div className="flex flex-wrap items-center gap-1 bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-1 rounded-lg max-w-fit">
        <button 
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'syllabus' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          LMS Learning workspace
        </button>
        <button 
          onClick={() => setActiveTab('course-selection')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'course-selection' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Major &amp; Minor Selection
        </button>
        <button 
          onClick={() => setActiveTab('live-class')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'live-class' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>WhatsApp Groups</span>
        </button>
        <button 
          onClick={() => setActiveTab('google-meet')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'google-meet' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Google Meet Studio</span>
        </button>
        <button 
          onClick={() => setActiveTab('course-papers')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'course-papers' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Course Papers
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'assignments' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Homework Tasks ({assignments.length})
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'results' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Academic Grades
        </button>
        <button 
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'exams' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Exams &amp; Answerbooks
        </button>
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'reviews' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Academy Reviews
        </button>
        <button 
          onClick={() => setActiveTab('media')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'media' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Academy Media Hub
        </button>
        <button 
          onClick={() => setActiveTab('registration')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'registration' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Course Registration
        </button>
        <button 
          onClick={() => setActiveTab('exam-registration')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'exam-registration' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Exam Registration
        </button>
        <button 
          onClick={() => setActiveTab('fees')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            activeTab === 'fees' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-accent)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Fee Payments (GPay / UPI)</span>
        </button>
        <button 
          onClick={() => {
            if (onOpenProfile) {
              onOpenProfile({ type: 'STUDENT', id: studentUser.id });
            } else {
              setActiveTab('profile');
            }
          }}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'profile' ? 'bg-[var(--sma-role-accent)] text-white shadow-sm' : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
          }`}
        >
          Profile &amp; Certificates
        </button>
      </div>

      {/* MAJOR & MINOR COURSE SELECTION MODULE */}
      {activeTab === 'course-selection' && (
        <StudentCourseSelectionPanel
          studentUser={studentUser}
          currentUser={currentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* STUDENT PROFILE & CERTIFICATES SUMMARY */}
      {activeTab === 'profile' && (
        <div className="bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-serif font-bold text-[var(--sma-active-text)]">{studentUser.name}</h3>
              <p className="text-xs font-mono text-[var(--sma-active-text-muted)]">
                ID: {studentUser.studentId} · {studentUser.email} · Attendance: {attendanceRateDisplay}%
              </p>
            </div>
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => onOpenProfile({ type: 'STUDENT', id: studentUser.id })}
                className="px-4 py-2 rounded-lg bg-[var(--sma-accent)] text-white text-xs font-bold uppercase cursor-pointer"
              >
                Open Full Academic Profile
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)]">
              <span className="text-[var(--sma-active-text-muted)] font-mono uppercase">Certificates Awarded</span>
              <p className="text-xl font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-1">{studentUser.certificatesCount || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)]">
              <span className="text-[var(--sma-active-text-muted)] font-mono uppercase">Verified Projects</span>
              <p className="text-xl font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-1">{studentUser.projectsCount || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)]">
              <span className="text-[var(--sma-active-text-muted)] font-mono uppercase">Outstanding Fee</span>
              <p className="text-xl font-bold font-mono tabular-nums text-[var(--sma-active-text)] mt-1">INR {Number(studentUser.outstandingBalance || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* LMS INTERACTIVE WORKSPACE */}
      {activeTab === 'syllabus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Subject / Lesson syllabus navigator tree */}
          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Current Semester Papers</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {studentSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono pb-2 border-b border-slate-850">
                Syllabus Lessons List
              </p>
              
              <div className="space-y-1 pt-2">
                {currentSubjectLessons.map((les) => (
                  <button
                    key={les.id}
                    onClick={() => setActiveLesson(les)}
                    className={`w-full text-left p-2.5 rounded text-xs transition-colors flex items-center justify-between border ${
                      activeLesson?.id === les.id
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 font-semibold'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-950/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate pr-3">{les.title}</span>
                    {completions[les.id] === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </button>
                ))}
                {currentSubjectLessons.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-4">No lessons uploaded yet for this subject.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Active Lesson Reader Canvas (60-30split) */}
          <div className="lg:col-span-8">
            {activeLesson ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">LESSON STUDY WORKSPACE</span>
                    <h3 className="text-lg md:text-xl font-serif font-bold text-white">{activeLesson.title}</h3>
                    <p className="text-slate-500 text-xs">Expected Duration: {activeLesson.duration}</p>
                  </div>

                  <button
                    onClick={() => handleToggleLessonComplete(activeLesson.id)}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                      completions[activeLesson.id] === 'COMPLETED'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    {completions[activeLesson.id] === 'COMPLETED' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        Completed!
                      </>
                    ) : (
                      'Mark Complete'
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeLesson.description}</p>

                {/* Simulated Premium Video Player */}
                <div className="aspect-video bg-black rounded border border-slate-850 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-black/60 px-2 py-1 rounded">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span>Syllabus Stream Platform</span>
                  </div>
                  
                  <div className="text-center space-y-3 p-4">
                    <PlayCircle className="w-16 h-16 text-amber-500 hover:text-amber-400 hover:scale-105 transition-all cursor-pointer mx-auto" />
                    <p className="text-xs text-slate-400 max-w-sm">Click play to simulate streaming video lecture for this paper.</p>
                  </div>
                </div>

                {/* Interactive Concept Callout & Syllabus PDF Material */}
                <div className="p-4 bg-slate-950 rounded border border-slate-850 text-xs text-slate-400 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <p className="font-bold text-slate-200 uppercase tracking-wider text-[9px] font-mono">Reference Study Materials & PDFs</p>
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">Syllabus Resource Library</span>
                  </div>
                  
                  {activeLesson.documentUrl || (activeLesson.id === 'les-1' || activeLesson.id === 'les-3') ? (
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-400" />
                        <div>
                          <p className="text-xs font-semibold text-slate-300 font-mono">
                            {activeLesson.documentName || (activeLesson.id === 'les-1' ? 'Tailwind_v4_Theme_Guidelines.pdf' : 'React19_State_Hook_Matrix.pdf')}
                          </p>
                          <p className="text-[9px] text-slate-500 font-mono">Portable Document Format (.pdf) · 1.2 MB</p>
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          if (activeLesson.documentUrl) {
                            void triggerBrandedPdfDownload({
                              fileUrl: activeLesson.documentUrl,
                              fileName: activeLesson.documentName || 'Syllabus_Guide.pdf',
                            });
                          } else {
                            setPortalNotice({
                              type: 'info',
                              text: `Open the Course Papers tab to view and download published PDF materials for ${studentCourse?.code || 'your course'}.`,
                            });
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-amber-400 text-[10px] font-bold uppercase rounded border border-slate-850 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px]">No formal reading PDFs uploaded for this lesson yet. Instructors can attach materials via the Portal Uploader.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center text-slate-500 italic">
                Select a paper and pick a lesson to trigger study workspace streaming.
              </div>
            )}
          </div>

        </div>
      )}

      {/* COURSE PAPERS & LEARNING MATERIALS PORTAL */}
      {activeTab === 'course-papers' && (
        <StudentCoursePapersPanel
          studentUser={studentUser}
          currentUser={currentUser}
          courses={courses}
        />
      )}

      {/* ASSIGNMENTS SUBMISSION PANEL (Supports PDF submissions uploads!) */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">My Homework Tasks</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((asg) => {
              const submission = submissions.find(s => s.assignmentId === asg.id && s.studentId === studentUser.id);
              return (
                <div key={asg.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{asg.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Deadline: {asg.deadline} · Paper Code: {subjects.find(s=>s.id===asg.subjectId)?.code}</p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                      {asg.maxMarks} MARKS
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{asg.description}</p>

                  {/* Submission Flow with PDF uploads simulated */}
                  {submission ? (
                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded text-xs space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Submitted at {submission.submittedAt}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold font-mono uppercase ${
                          submission.status === 'EVALUATED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-slate-300 font-mono truncate">{submission.content}</p>
                      {submission.fileUrl && (
                        <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Attached PDF: {submission.fileUrl.split('/').pop()}
                        </p>
                      )}
                      
                      {submission.status === 'EVALUATED' && (
                        <div className="pt-2 border-t border-slate-900 space-y-1">
                          <p className="font-bold text-amber-400 text-xs">Score obtained: {submission.marksObtained} / {asg.maxMarks}</p>
                          <p className="text-slate-400 text-[11px]">Critique Feedback: {submission.feedback}</p>
                          <p className="text-[9px] text-slate-600 font-mono mt-1">Graded by: {submission.gradedBy}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={asg.submissionType === 'LINK' ? "Paste GitHub repo or Live hosted URL..." : "Write submission narrative..."}
                          value={submissionForms[asg.id] || ''}
                          onChange={(e) => setSubmissionForms({ ...submissionForms, [asg.id]: e.target.value })}
                          className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                        />
                        
                        <button
                          type="button"
                          onClick={() => {
                            const name = `${studentUser.name.toLowerCase().replace(/\s+/g, '_')}_task_${asg.id.substring(4)}.pdf`;
                            setSubmissionFileNames({ ...submissionFileNames, [asg.id]: name });
                          }}
                          className={`px-3 py-2 border rounded text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                            submissionFileNames[asg.id] 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                              : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                          }`}
                          title="Simulate PDF file upload attachment"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {submissionFileNames[asg.id] ? 'Attached PDF!' : 'Attach PDF'}
                        </button>
                      </div>

                      {submissionFileNames[asg.id] && (
                        <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          File: {submissionFileNames[asg.id]} (Ready for upload)
                        </p>
                      )}

                      <button
                        onClick={() => handleSubmitAssignment(asg.id)}
                        disabled={submittingId === asg.id}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {submittingId === asg.id ? 'Uploading Homework PDF & Links...' : 'Submit Homework Task'}
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GRADES TRANSCRIPT */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Academic transcript</h3>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4">Assessed Criteria</th>
                  <th className="p-4">Marks Obtained</th>
                  <th className="p-4">Max Marks</th>
                  <th className="p-4">Grade</th>
                  <th className="p-4">Critique Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {submissions.filter(s => s.studentId === studentUser.id && s.status === 'EVALUATED').map((sub) => {
                  const asg = assignments.find(a => a.id === sub.assignmentId);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-900/20">
                      <td className="p-4 font-bold text-slate-200">
                        {asg?.title}
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-400">
                        {sub.marksObtained}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {asg?.maxMarks}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
                          {sub.marksObtained && asg ? (sub.marksObtained / asg.maxMarks >= 0.9 ? 'A+' : sub.marksObtained / asg.maxMarks >= 0.8 ? 'A' : 'B+') : 'B'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 italic">
                        "{sub.feedback}"
                      </td>
                    </tr>
                  );
                })}
                {submissions.filter(s => s.studentId === studentUser.id && s.status === 'EVALUATED').length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">No formal grades posted yet. Submit assignments for review.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXAMS, ANSWERBOOKS & ONLINE MCQ */}
      {activeTab === 'exams' && (
        <ExaminationEngineModule
          mode="STUDENT"
          currentUser={currentUser}
          studentProfile={studentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* ACADEMY REVIEWS & RATINGS */}
      {activeTab === 'reviews' && (
        <ReviewsPortal
          currentUser={currentUser}
          studentProfile={studentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* ACADEMY MEDIA HUB & BLOG */}
      {activeTab === 'media' && (
        <MediaHubModule currentUser={currentUser} />
      )}

      {/* COURSE REGISTRATION TAB */}
      {activeTab === 'registration' && (
        <CourseRegistrationPortal
          studentUser={studentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* EXAMINATION REGISTRATION TAB */}
      {activeTab === 'exam-registration' && (
        <ExamRegistrationPortal
          currentUser={currentUser}
          studentProfile={studentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* LIVE QR CODE ATTENDANCE SCANNER OVERLAY */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-5 text-center relative overflow-hidden my-auto shadow-2xl">
            <button
              type="button"
              onClick={() => setIsScannerOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close Scanner"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <QrCode className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Self-Attendance QR Scanner
              </h3>
              <p className="text-slate-400 text-[11px]">
                Scan your Instructor&apos;s live QR pass or enter their rotating dynamic token to mark yourself PRESENT.
              </p>
            </div>

            {scanSuccessAlert ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl space-y-2">
                <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Attendance Marked Present!</h4>
                <p className="text-[11px] text-slate-200">{scanResultMsg}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scanErrorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-left text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{scanErrorMsg}</span>
                  </div>
                )}

                {/* Camera Viewfinder / Launcher */}
                <div className="bg-slate-900 rounded-xl relative border border-slate-800 overflow-hidden">
                  {cameraActive ? (
                    <div className="relative aspect-video bg-black flex items-center justify-center">
                      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute inset-4 border-2 border-amber-500/60 rounded-lg pointer-events-none" />
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 text-[10px] font-mono text-slate-200 rounded border border-slate-700 cursor-pointer"
                      >
                        Stop Camera
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col items-center justify-center gap-3">
                      <Camera className="w-7 h-7 text-amber-400" />
                      <button
                        type="button"
                        onClick={() => void handleStartCameraScanner()}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase rounded cursor-pointer flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Open Camera QR Scanner
                      </button>
                    </div>
                  )}
                  {cameraStatusMsg && (
                    <p className="px-3 py-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 border-t border-slate-800">
                      {cameraStatusMsg}
                    </p>
                  )}
                </div>

                {/* Live Active Instructor Sessions detected */}
                {activeQrSessions.length > 0 && (
                  <div className="text-left space-y-2 bg-slate-900/70 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-[10px] font-mono font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Live Instructor QR Session(s) Detected
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeQrSessions.map((sess) => (
                        <button
                          key={sess.id}
                          type="button"
                          disabled={isSubmittingQr}
                          onClick={() => void verifyAndMarkQrAttendance(sess.token)}
                          className="w-full p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-100 truncate">
                              {sess.subjectName || sess.courseName}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              Hour {sess.hour} · {sess.date} · Code <span className="text-amber-400">{sess.token}</span>
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase rounded shrink-0">
                            Mark Present
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Token / QR Payload Entry */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualQrToken.trim()) {
                      setScanErrorMsg('Please enter the Instructor dynamic QR code (e.g. SMA-AB12CD).');
                      return;
                    }
                    void verifyAndMarkQrAttendance(manualQrToken);
                  }}
                  className="space-y-2.5 p-3.5 bg-slate-900 rounded-lg border border-slate-800 text-left"
                >
                  <label className="text-[10px] text-slate-400 uppercase font-bold font-mono flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Enter Instructor QR Token or Scanned Payload
                  </label>
                  <input
                    type="text"
                    value={manualQrToken}
                    onChange={(e) => setManualQrToken(e.target.value)}
                    placeholder="e.g. SMA-7K9P2M"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingQr}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer font-mono disabled:opacity-60"
                  >
                    {isSubmittingQr ? 'Verifying Attendance Token...' : 'Verify & Mark Present'}
                  </button>
                </form>
              </div>
            )}

            <p className="text-[9px] text-slate-500 font-mono uppercase">
              Swanaya Media Academy · Time-Limited Dynamic QR Verification
            </p>
          </div>
        </div>
      )}

      {/* LIVE CLASS GOOGLE MEET & WHATSAPP GROUP TAB */}
      {activeTab === 'live-class' && (
        <LiveClassMeetWhatsAppPanel
          mode="STUDENT"
          currentUser={currentUser}
          courses={courses}
          studentCourseId={resolvedCourseId}
          onOpenQrScanner={() => setIsScannerOpen(true)}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* GOOGLE MEET & CALENDAR STUDIO TAB */}
      {activeTab === 'google-meet' && (
        <GoogleMeetStudioPanel
          mode="STUDENT"
          currentUser={currentUser}
          courses={courses}
        />
      )}

      {/* GOOGLE PAY & UPI FEE PAYMENTS TAB */}
      {activeTab === 'fees' && (
        <StudentFeePaymentPanel
          studentUser={studentUser}
          currentUser={currentUser}
          studentCourse={studentCourse}
          onRefreshAllData={onRefreshAllData}
        />
      )}

    </div>
  );
}
