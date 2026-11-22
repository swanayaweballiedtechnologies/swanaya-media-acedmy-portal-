import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Send, AlertCircle, CheckCircle2, ChevronDown, ShieldCheck, Clock, RefreshCw, MessageCircle } from 'lucide-react';
import {
  Batch,
  Course,
  CourseSelectionRegistration,
  Notification,
  Student,
  SwanayaDatabase
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';

interface CourseRegistrationPortalProps {
  studentUser: Student;
  onRefreshAllData: () => void;
}

interface CatalogCourse extends Course {
  title?: string;
  category?: string;
}

const DEFAULT_BATCH_OPTIONS = [
  { id: 'ADWDVC-2026-A', label: 'Oct 2026 Intake · Batch A (Morning)' },
  { id: 'DAIMPIDM-2026-A', label: 'Nov 2026 Intake · Cohort A (Studio)' },
  { id: 'AIBC-Weekend', label: 'Dec 2026 Intake · Weekend Cohort' },
];

export default function CourseRegistrationPortal({ studentUser, onRefreshAllData }: CourseRegistrationPortalProps) {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [batches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>('batches') || []);
  const [myRequests, setMyRequests] = useState<CourseSelectionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [coursesRetryKey, setCoursesRetryKey] = useState(0);

  // Option 1: Program & Study Level
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Option 2: Delivery Mode, Cohort Batch & Class Schedule
  const [studyMode, setStudyMode] = useState<'HYBRID' | 'PHYSICAL' | 'ONLINE'>('HYBRID');
  const [preferredBatch, setPreferredBatch] = useState<string>(DEFAULT_BATCH_OPTIONS[0].id);
  const [preferredSchedule, setPreferredSchedule] = useState<string>('WEEKDAY_INTENSIVE');

  // Option 3: Academic Background, Experience & Career Track
  const [qualification, setQualification] = useState<string>('Undergraduate Student');
  const [priorExperience, setPriorExperience] = useState<string>('Foundational (1-2 Years)');
  const [careerGoals, setCareerGoals] = useState<string>('Full-Stack Web & AI Engineering');

  const [motivationNote, setMotivationNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Contact phone & course confirmation receipt states
  const [contactPhone, setContactPhone] = useState<string>(
    () => studentUser.phone || studentUser.whatsappPhone || ''
  );
  const [confirmationReceipt, setConfirmationReceipt] = useState<{
    confirmationId: string;
    recipientPhone: string;
    academySupportPhone: string;
    messageText: string;
    whatsappUrl: string;
    sentAt: string;
  } | null>(null);

  const filterForStudent = (list: CourseSelectionRegistration[]) => {
    const uid = auth.currentUser?.uid;
    return list
      .filter(
        (r) =>
          r.studentId === studentUser.id ||
          r.userId === studentUser.userId ||
          (uid && r.userId === uid) ||
          (r.studentEmail && r.studentEmail.toLowerCase() === studentUser.email.toLowerCase())
      )
      .sort((a, b) => String(b.updatedAt || b.createdAt || b.timestamp || '').localeCompare(String(a.updatedAt || a.createdAt || a.timestamp || '')));
  };

  useEffect(() => {
    setLoading(true);
    setCoursesError(null);
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (activeCatalog) => {
        setCourses(activeCatalog as CatalogCourse[]);
        setLoading(false);
        setCoursesError(null);
      },
      onError: (err) => {
        setCoursesError(err.message || 'Unable to load published course catalog.');
        setLoading(false);
      },
    });
    return () => unsubscribe();
  }, [coursesRetryKey]);

  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      const localRegs = SwanayaDatabase.get<CourseSelectionRegistration[]>('courseRegistrations') || [];
      setMyRequests(filterForStudent(localRegs));

      let cloudRegs: any[] = [];
      if (auth.currentUser) {
        try {
          const fetchedRegs = await academyService.getRegistrations(auth.currentUser.uid);
          if (Array.isArray(fetchedRegs)) cloudRegs = fetchedRegs;
        } catch {
          // Keep local registrations
        }
      }

      if (!mounted) return;
      const regMap = new Map<string, CourseSelectionRegistration>();
      localRegs.forEach((r) => r?.id && regMap.set(r.id, r));
      cloudRegs.forEach((raw: any) => {
        if (raw?.id) regMap.set(raw.id, { ...regMap.get(raw.id), ...raw });
      });
      const allRegs = Array.from(regMap.values());
      SwanayaDatabase.set('courseRegistrations', allRegs);
      setMyRequests(filterForStudent(allRegs));
    };
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [studentUser.id]);

  const filteredCourses = useMemo(() => {
    if (levelFilter === 'ALL') return courses;
    return courses.filter((c) => String(c.level || '').toUpperCase() === levelFilter);
  }, [courses, levelFilter]);

  useEffect(() => {
    if (filteredCourses.length === 0) {
      setSelectedCourseId('');
      return;
    }
    if (!filteredCourses.some((c) => c.id === selectedCourseId)) {
      const nextPreferred = filteredCourses.find((c) => c.id !== studentUser.courseId) || filteredCourses[0];
      setSelectedCourseId(nextPreferred.id);
    }
  }, [filteredCourses, selectedCourseId, studentUser.courseId]);

  const activeCourse = useMemo(
    () => filteredCourses.find((c) => c.id === selectedCourseId) || courses.find((c) => c.id === selectedCourseId) || null,
    [filteredCourses, courses, selectedCourseId]
  );

  useEffect(() => {
    if (activeCourse?.mode) {
      setStudyMode(activeCourse.mode);
    }
  }, [activeCourse?.id, activeCourse?.mode]);

  const batchDropdownOptions = useMemo(() => {
    const matching = batches.filter((b) => !selectedCourseId || b.courseId === selectedCourseId);
    if (matching.length > 0) {
      return matching.map((b) => ({
        id: b.code || b.id,
        label: `${b.name} (${b.schedule || b.startDate})`,
      }));
    }
    return DEFAULT_BATCH_OPTIONS;
  }, [batches, selectedCourseId]);

  useEffect(() => {
    if (batchDropdownOptions.length > 0 && !batchDropdownOptions.some((b) => b.id === preferredBatch)) {
      setPreferredBatch(batchDropdownOptions[0].id);
    }
  }, [batchDropdownOptions, preferredBatch]);

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse) {
      setSubmitError('Please select a course from the program dropdown before submitting.');
      return;
    }
    setSubmitError(null);

    const activeContactPhone = contactPhone.trim() || studentUser.phone || studentUser.whatsappPhone || '';
    setIsSubmitting(true);
    try {
      const savedRecord = await academyService.registerForCourse(
        {
          userId: auth.currentUser?.uid || studentUser.userId || studentUser.id,
          studentId: studentUser.id,
          studentName: studentUser.name,
          studentEmail: studentUser.email,
          studentPhone: activeContactPhone,
          source: 'PORTAL_COURSE_SELECTION',
          courseId: activeCourse.id,
          courseCode: activeCourse.code,
          courseTitle: activeCourse.title || activeCourse.name,
          courseCategory: activeCourse.category || activeCourse.level || 'Media Science',
          answers: {
            levelFilter,
            studyMode,
            preferredBatch,
            preferredSchedule,
            qualification,
            experienceLevel: priorExperience,
            priorExperience: `${qualification} · ${priorExperience}`,
            careerGoals,
            reason: motivationNote.trim() || `Enrolling under ${careerGoals} track (${studyMode})`,
          },
          timestamp: new Date().toISOString(),
        }
      );

      let receiptPayload: typeof confirmationReceipt = null;
      try {
        const confirmRes = await academyService.sendCourseRegistrationConfirmation({
          registrationId: (savedRecord as any)?.id,
          userId: studentUser.userId || studentUser.id,
          studentId: studentUser.id,
          studentName: studentUser.name,
          studentEmail: studentUser.email,
          phone: activeContactPhone,
          channel: 'WHATSAPP',
          courseId: activeCourse.id,
          courseCode: activeCourse.code,
          courseTitle: activeCourse.title || activeCourse.name,
          preferredBatch,
          studyMode,
          preferredSchedule,
          qualification,
          careerGoals,
          source: 'PORTAL_COURSE_SELECTION',
        });
        receiptPayload = {
          confirmationId: confirmRes.confirmationId,
          recipientPhone: confirmRes.recipientPhone || activeContactPhone,
          academySupportPhone: confirmRes.academyVerificationPhone || '+91 94460 55555',
          messageText: confirmRes.messageText,
          whatsappUrl: confirmRes.whatsappUrl,
          sentAt: confirmRes.sentAt || new Date().toISOString(),
        };
      } catch {
        // Non-fatal fallback
      }

      if (savedRecord) {
        const enrichedRecord: CourseSelectionRegistration = {
          ...(savedRecord as CourseSelectionRegistration),
          confirmationMessageSent: Boolean(receiptPayload),
          confirmationId: receiptPayload?.confirmationId,
          confirmationSentAt: receiptPayload?.sentAt,
          confirmationMessageText: receiptPayload?.messageText,
        };
        const existingLocal = SwanayaDatabase.get<CourseSelectionRegistration[]>('courseRegistrations') || [];
        const nextAll = [enrichedRecord, ...existingLocal];
        SwanayaDatabase.set('courseRegistrations', nextAll);
        setMyRequests(filterForStudent(nextAll));
      }

      setConfirmationReceipt(receiptPayload);

      const notifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
      const newNotif: Notification = {
        id: `not-${Date.now()}`,
        userId: 'usr-md',
        title: 'Course Selection Verification Requested',
        message: `${studentUser.name} submitted a 3-option course selection for ${activeCourse.title || activeCourse.name} (${studyMode}).`,
        type: 'INFO',
        read: false,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      SwanayaDatabase.set('notifications', [newNotif, ...notifs]);
      SwanayaDatabase.log(
        studentUser.email,
        studentUser.name,
        'COURSE_SELECTION_SUBMITTED',
        `Course: ${activeCourse.title || activeCourse.name} (${studyMode} · ${preferredBatch})`
      );

      setIsSubmitting(false);
      setSuccess(true);
      setMotivationNote('');
      onRefreshAllData();
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-serif text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span>Course Selection &amp; Registration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure your next academy program across the three option dropdown sections. Selections are verified by your Department and MD.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
          Active Program ID: <strong className="text-amber-400">{studentUser.courseId || 'None'}</strong>
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-xs animate-pulse border border-slate-800 rounded-xl bg-slate-900/40">
          LOADING ACADEMIC COURSE CATALOG...
        </div>
      ) : coursesError ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-rose-300">Unable to load published courses</p>
            <p className="text-xs text-slate-300">{coursesError}</p>
          </div>
          <button
            type="button"
            onClick={() => setCoursesRetryKey((k) => k + 1)}
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-100 rounded text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-8 text-center bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-2">
          <p className="text-sm font-serif font-bold text-amber-300">No Courses Published Yet</p>
          <p className="text-xs text-slate-400">New programs will appear here automatically once published by the Academy Administration.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmitRegistration} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: 3 Structured Option Sections with Dropdown Boxes */}
          <div className="lg:col-span-7 space-y-5">
            {/* OPTION 1: Program & Study Level */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-serif font-bold text-white">
                  01. Program &amp; Study Level
                </h3>
                <span className="text-xs font-mono text-amber-400 tabular-nums">
                  {filteredCourses.length} Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-level" className="text-xs font-medium text-slate-300 block">
                    Program Level Filter
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-level"
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="ALL">All Program Levels</option>
                      <option value="DIPLOMA">Diploma Programs</option>
                      <option value="ADVANCED">Advanced Specialization</option>
                      <option value="INTERMEDIATE">Intermediate Track</option>
                      <option value="BEGINNER">Foundation / Beginner</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-course" className="text-xs font-medium text-slate-300 block">
                    Select Course / Program
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-course"
                      value={selectedCourseId}
                      onChange={(e) => {
                        setSelectedCourseId(e.target.value);
                        setSuccess(false);
                      }}
                      disabled={filteredCourses.length === 0}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-60"
                    >
                      {filteredCourses.length > 0 ? (
                        filteredCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `${c.code} · ` : ''}{c.title || c.name}
                            {c.id === studentUser.courseId ? ' (Current Enrollment)' : ''}
                          </option>
                        ))
                      ) : (
                        <option value="">No courses match this level</option>
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>
            </section>

            {/* OPTION 2: Delivery Mode, Batch & Schedule */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-serif font-bold text-white">
                  02. Delivery Mode, Batch &amp; Schedule
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-mode" className="text-xs font-medium text-slate-300 block">
                    Preferred Mode
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-mode"
                      value={studyMode}
                      onChange={(e) => setStudyMode(e.target.value as 'HYBRID' | 'PHYSICAL' | 'ONLINE')}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="HYBRID">Hybrid (Studio + Online)</option>
                      <option value="PHYSICAL">Campus Physical Lab</option>
                      <option value="ONLINE">Live Online Cohort</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-batch" className="text-xs font-medium text-slate-300 block">
                    Cohort Batch
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-batch"
                      value={preferredBatch}
                      onChange={(e) => setPreferredBatch(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      {batchDropdownOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-schedule" className="text-xs font-medium text-slate-300 block">
                    Preferred Class Timing
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-schedule"
                      value={preferredSchedule}
                      onChange={(e) => setPreferredSchedule(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="WEEKDAY_INTENSIVE">Weekday Intensive</option>
                      <option value="WEEKEND_SPECIALIST">Weekend Specialist</option>
                      <option value="EVENING_COHORT">Evening Cohort</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>
            </section>

            {/* OPTION 3: Academic Background & Career Track */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-serif font-bold text-white">
                  03. Background, Experience &amp; Career Track
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-qual" className="text-xs font-medium text-slate-300 block">
                    Prior Qualification
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-qual"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="12th Standard / Higher Secondary">12th Standard / Higher Secondary</option>
                      <option value="Undergraduate Student">Undergraduate Student</option>
                      <option value="Graduate / Bachelor Degree">Graduate / Bachelor&apos;s Degree</option>
                      <option value="Postgraduate / Master Degree">Postgraduate / Master&apos;s</option>
                      <option value="Working Professional">Working Professional</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-exp" className="text-xs font-medium text-slate-300 block">
                    Prior Experience Level
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-exp"
                      value={priorExperience}
                      onChange={(e) => setPriorExperience(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Beginner (0 Years Experience)">Beginner (0 Years)</option>
                      <option value="Foundational (1-2 Years)">Foundational (1–2 Years)</option>
                      <option value="Experienced (3+ Years)">Experienced (3+ Years)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-goal" className="text-xs font-medium text-slate-300 block">
                    Career Objective
                  </label>
                  <div className="relative">
                    <select
                      id="portal-cs-goal"
                      value={careerGoals}
                      onChange={(e) => setCareerGoals(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="Full-Stack Web & AI Engineering">Full-Stack Web &amp; AI Engineering</option>
                      <option value="AI Media & Film Production">AI Media &amp; Film Production</option>
                      <option value="Digital Marketing & Brand Strategy">Digital Marketing &amp; Strategy</option>
                      <option value="Business Communication & Consulting">Business Communication</option>
                      <option value="Freelance Studio & Entrepreneurship">Freelance Studio / Startup</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Live Summary & Registration Submission */}
          <aside className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
            {activeCourse ? (
              <div className="space-y-3 border-b border-slate-800 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                      Selected Program Summary
                    </span>
                    <h3 className="text-lg font-serif font-bold text-white leading-snug mt-0.5">
                      {activeCourse.title || activeCourse.name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 tabular-nums shrink-0">
                    ₹{Number(activeCourse.fee || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {activeCourse.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-slate-200">{activeCourse.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCourse.duration}</span>
                  <span aria-hidden="true">·</span>
                  <span>{studyMode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{preferredSchedule.replace('_', ' ')}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400">
                No courses published under the selected level filter.
              </div>
            )}

            {success ? (
              <div className="py-5 space-y-4 bg-emerald-500/5 border border-emerald-500/25 rounded-xl px-4">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-base font-serif font-bold text-white">
                    Course Registered &amp; Confirmation Message Sent!
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your selection for <strong className="text-amber-300">{activeCourse?.title || activeCourse?.name}</strong> has been logged for Admin &amp; MD acceptance.
                  </p>
                </div>

                {confirmationReceipt && (
                  <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2 text-left text-xs">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold">
                        CONFIRMATION ID: {confirmationReceipt.confirmationId}
                      </span>
                      <span className="text-slate-400">SAVED</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {confirmationReceipt.messageText}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {confirmationReceipt.recipientPhone ? (
                        <>
                          Contact: <strong className="text-white">{confirmationReceipt.recipientPhone}</strong> ·{' '}
                        </>
                      ) : null}
                      Academy Support:{' '}
                      <strong className="text-emerald-400">{confirmationReceipt.academySupportPhone}</strong>
                    </p>
                    {confirmationReceipt.whatsappUrl && (
                      <a
                        href={confirmationReceipt.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Open WhatsApp Support</span>
                      </a>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 hover:text-white cursor-pointer"
                  >
                    Configure Another Selection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-phone" className="text-xs font-medium text-slate-300 block">
                    Contact Number (Optional)
                  </label>
                  <input
                    id="portal-cs-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="portal-cs-note" className="text-xs font-medium text-slate-300 block">
                    Statement of Purpose / Notes (Optional)
                  </label>
                  <textarea
                    id="portal-cs-note"
                    rows={2}
                    value={motivationNote}
                    onChange={(e) => setMotivationNote(e.target.value)}
                    placeholder="Any goals, project background, or scheduling notes..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !activeCourse}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting & Sending Confirmation...' : 'Register Course & Send Confirmation'}</span>
                </button>
              </div>
            )}
          </aside>
        </form>
      )}

      {/* Verification Status Tracker for Student's Submitted Selections */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>My Course Selection Verification Status</span>
          </h3>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {myRequests.length} Record{myRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        {myRequests.length === 0 ? (
          <p className="text-xs text-slate-400">
            No course selection requests submitted yet. Use the 3 dropdown option sections above to submit a course for Department and MD approval.
          </p>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-serif font-bold text-white">
                    {req.courseTitle}
                  </p>
                  <p className="text-xs text-slate-400">
                    {req.answers?.studyMode || 'HYBRID'} · {req.answers?.preferredBatch || 'Default Cohort'} ·{' '}
                    {req.answers?.careerGoals || 'Academy Track'}
                  </p>
                  {(req.departmentRemarks || req.mdRemarks) && (
                    <p className="text-xs text-slate-300 italic">
                      Remarks: {req.mdRemarks || req.departmentRemarks}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs shrink-0">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Dept:{' '}
                    <strong
                      className={
                        req.departmentVerificationStatus === 'VERIFIED'
                          ? 'text-emerald-400'
                          : req.departmentVerificationStatus === 'RETURNED'
                          ? 'text-amber-400'
                          : req.departmentVerificationStatus === 'REJECTED'
                          ? 'text-rose-400'
                          : 'text-slate-200'
                      }
                    >
                      {req.departmentVerificationStatus}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    MD:{' '}
                    <strong
                      className={
                        req.mdVerificationStatus === 'VERIFIED'
                          ? 'text-emerald-400'
                          : req.mdVerificationStatus === 'REJECTED'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }
                    >
                      {req.mdVerificationStatus === 'PENDING_MD' ? 'PENDING MD' : req.mdVerificationStatus}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
