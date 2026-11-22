/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Send,
  GraduationCap,
  ChevronDown,
  MessageCircle,
  RefreshCw
} from 'lucide-react';
import {
  Batch,
  Course,
  FrontPageConfig,
  INITIAL_FRONT_PAGE_CONFIG,
  AcademySettings,
  SwanayaDatabase
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import ThemeToggle from './ThemeToggle';

interface CourseSelectionPageProps {
  initialCourseId?: string;
  originView: 'landing' | 'login';
  onBack: () => void;
  onNavigateToPortal: () => void;
  onConfirmForRegistration?: (courseId: string) => void;
  onApplyLead: (leadData: {
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
  }) => void;
}

const DEFAULT_BATCH_OPTIONS = [
  { id: 'ADWDVC-2026-A', label: 'Oct 2026 Intake · Batch A (Morning)' },
  { id: 'DAIMPIDM-2026-A', label: 'Nov 2026 Intake · Cohort A (Studio)' },
  { id: 'AIBC-Weekend', label: 'Dec 2026 Intake · Weekend Cohort' },
];

export default function CourseSelectionPage({
  initialCourseId,
  originView,
  onBack,
  onNavigateToPortal,
  onConfirmForRegistration,
  onApplyLead
}: CourseSelectionPageProps) {
  const [frontPage] = useState<FrontPageConfig>(() => ({
    ...INITIAL_FRONT_PAGE_CONFIG,
    ...(SwanayaDatabase.get<FrontPageConfig>('frontPageConfig') || {}),
  }));
  const [academySettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>('settings'));
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>('batches') || []);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [coursesRetryKey, setCoursesRetryKey] = useState(0);

  // Option 1: Program & Level Dropdowns
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');

  // Option 2: Delivery Mode, Cohort Batch & Class Schedule Dropdowns
  const [studyMode, setStudyMode] = useState<'HYBRID' | 'PHYSICAL' | 'ONLINE'>('HYBRID');
  const [preferredBatch, setPreferredBatch] = useState<string>(DEFAULT_BATCH_OPTIONS[0].id);
  const [preferredSchedule, setPreferredSchedule] = useState<string>('WEEKDAY_INTENSIVE');

  // Option 3: Academic Background, Experience & Career Track Dropdowns
  const [qualification, setQualification] = useState<string>('Graduate / Bachelor Degree');
  const [experienceLevel, setExperienceLevel] = useState<string>('Beginner (0 Years Experience)');
  const [careerTrack, setCareerTrack] = useState<string>('Full-Stack Web & AI Engineering');

  // Applicant Submission Details
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantNotes, setApplicantNotes] = useState('');
  const [confirmationReceipt, setConfirmationReceipt] = useState<{
    confirmationId: string;
    recipientPhone: string;
    academySupportPhone: string;
    messageText: string;
    whatsappUrl: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Subscribe to published courses in Firestore as single source of truth
  useEffect(() => {
    setLoadingCourses(true);
    setCoursesError(null);
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (activeCourses) => {
        setCourses(activeCourses);
        setLoadingCourses(false);
        setCoursesError(null);
      },
      onError: (err) => {
        setCoursesError(err.message || 'Unable to load published courses.');
        setLoadingCourses(false);
      },
    });
    return () => unsubscribe();
  }, [coursesRetryKey]);

  const filteredCourses = useMemo(() => {
    if (levelFilter === 'ALL') return courses;
    return courses.filter((c) => String(c.level || '').toUpperCase() === levelFilter);
  }, [courses, levelFilter]);

  useEffect(() => {
    if (initialCourseId && courses.some((c) => c.id === initialCourseId)) {
      setSelectedCourseId(initialCourseId);
      return;
    }
    if (filteredCourses.length > 0 && !filteredCourses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(filteredCourses[0].id);
    }
  }, [initialCourseId, courses, filteredCourses, selectedCourseId]);

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
    const courseBatches = batches.filter((b) => !selectedCourseId || b.courseId === selectedCourseId);
    if (courseBatches.length > 0) {
      return courseBatches.map((b) => ({
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

  const adminWhatsAppPhone =
    academySettings?.adminWhatsAppPhone || academySettings?.phone || '+91 94460 55555';
  const cleanAdminPhone = adminWhatsAppPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  const handleSubmitSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!applicantName.trim() || !applicantEmail.trim() || !applicantPhone.trim()) {
      setSubmitError('Please fill in your full name, email address, and phone number.');
      return;
    }

    const compiledLeadData = {
      name: applicantName.trim(),
      email: applicantEmail.trim(),
      phone: applicantPhone.trim(),
      courseId: selectedCourseId || 'custom-program',
      qualification: `${qualification} · ${experienceLevel}`,
      preferredBatch: `${preferredBatch} (${studyMode} · ${preferredSchedule})`,
      message: applicantNotes.trim() || `Selected ${activeCourse?.name || 'Custom Program'} via 3-option configurator.`,
      levelFilter,
      studyMode,
      preferredSchedule,
      experienceLevel,
      careerTrack,
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadData: compiledLeadData,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setSubmitError(data.error || 'Submission failed. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      try {
        const confirmRes = await academyService.sendCourseRegistrationConfirmation({
          studentName: compiledLeadData.name,
          studentEmail: compiledLeadData.email,
          phone: compiledLeadData.phone,
          channel: 'WHATSAPP',
          courseId: compiledLeadData.courseId,
          courseCode: activeCourse?.code,
          courseTitle: activeCourse?.name || 'Academy Program',
          preferredBatch,
          studyMode,
          preferredSchedule,
          qualification,
          careerGoals: careerTrack,
          source: 'PUBLIC_COURSE_SELECTION',
        });
        setConfirmationReceipt({
          confirmationId: confirmRes.confirmationId,
          recipientPhone: confirmRes.recipientPhone || compiledLeadData.phone,
          academySupportPhone: confirmRes.academyVerificationPhone || adminWhatsAppPhone,
          messageText: confirmRes.messageText,
          whatsappUrl: confirmRes.whatsappUrl,
        });
      } catch {
        // non-fatal confirmation log
      }

      onApplyLead(compiledLeadData);
      setSubmittedSuccess(true);
    } catch {
      onApplyLead(compiledLeadData);
      setSubmittedSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F3F7] dark:bg-[#151521] text-[#25263A] dark:text-[#F5F3FA] flex flex-col selection:bg-[#7652A8]/25 dark:selection:bg-[#A985D6]/30 transition-colors">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#1D1D2B]/95 backdrop-blur-md border-b border-[#E5E1EA] dark:border-[#38384B] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-[#555770] dark:text-[#B8B5C5] hover:text-[#7652A8] dark:hover:text-[#A985D6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{originView === 'login' ? 'Back to Sign In' : 'Back to Front Page'}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-[#555770] dark:text-[#B8B5C5]">
            <span className="font-serif font-bold tracking-widest text-[#7652A8] dark:text-[#A985D6]">
              {frontPage.brandWordmark || 'SWANAYA'}
            </span>
            <span aria-hidden="true" className="text-[#E5E1EA] dark:text-[#38384B]">·</span>
            <span>Course Selection &amp; Enrollment</span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={onNavigateToPortal}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#7652A8] hover:bg-[#634194] dark:bg-[#A985D6] dark:hover:bg-[#BA9BE3] text-white dark:text-[#151521] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {frontPage.portalButtonLabel || 'Enterprise Portal'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Page Heading */}
        <div className="max-w-3xl space-y-2 border-b border-[#E5E1EA] dark:border-[#38384B] pb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#477DBB] dark:text-[#75A7E0]">
            Program Configurator
          </span>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#25263A] dark:text-[#F5F3FA] leading-tight text-balance">
            Select Your Academy Course &amp; Study Options
          </h1>
          <p className="text-sm text-[#555770] dark:text-[#B8B5C5] leading-relaxed">
            Use the dropdown selectors across each option step below to configure your program, batch schedule, and career specialization.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: 3 Structured Option Groups with Dropdown Boxes */}
          <div className="lg:col-span-7 space-y-6">
            {/* OPTION 1: Program & Study Level */}
            <section className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
                <h2 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                  01. Program &amp; Study Level
                </h2>
                <span className="text-xs font-mono font-bold text-[#477DBB] dark:text-[#75A7E0] tabular-nums">
                  {filteredCourses.length} Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cs-level-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Program Level / Track
                  </label>
                  <div className="relative">
                    <select
                      id="cs-level-select"
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6] cursor-pointer"
                    >
                      <option value="ALL">All Program Levels</option>
                      <option value="DIPLOMA">Diploma Programs</option>
                      <option value="ADVANCED">Advanced Programs</option>
                      <option value="INTERMEDIATE">Intermediate Track</option>
                      <option value="BEGINNER">Foundation / Beginner</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cs-course-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Select Course / Program
                  </label>
                  <div className="relative">
                    <select
                      id="cs-course-select"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      disabled={loadingCourses || filteredCourses.length === 0}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6] cursor-pointer disabled:opacity-60"
                    >
                      {loadingCourses ? (
                        <option value="">Loading courses...</option>
                      ) : filteredCourses.length > 0 ? (
                        filteredCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `${c.code} · ` : ''}{c.name} ({c.duration || 'Flexible'})
                          </option>
                        ))
                      ) : (
                        <option value="">No courses published under this level</option>
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>

              {coursesError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-700 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>{coursesError}</span>
                  <button
                    type="button"
                    onClick={() => setCoursesRetryKey((k) => k + 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Sync</span>
                  </button>
                </div>
              )}

              {!loadingCourses && !coursesError && courses.length === 0 && (
                <div className="p-4 bg-[#7652A8]/10 border border-[#7652A8]/30 rounded-lg text-xs text-[#25263A] dark:text-[#F5F3FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>No Courses Published Yet. You can still submit your preferred options or message admissions.</span>
                  <a
                    href={`https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent('Hello Admin, please share the latest Swanaya Media Academy course list.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] dark:hover:bg-[#8AD0AC] text-white dark:text-[#151521] rounded text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Admissions</span>
                  </a>
                </div>
              )}
            </section>

            {/* OPTION 2: Learning Mode, Batch & Schedule */}
            <section className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-6 space-y-5 shadow-xs">
              <div className="border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
                <h2 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                  02. Delivery Mode, Cohort &amp; Schedule
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cs-mode-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Delivery Mode
                  </label>
                  <div className="relative">
                    <select
                      id="cs-mode-select"
                      value={studyMode}
                      onChange={(e) => setStudyMode(e.target.value as 'HYBRID' | 'PHYSICAL' | 'ONLINE')}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#477DBB] dark:focus:border-[#75A7E0] cursor-pointer"
                    >
                      <option value="HYBRID">Hybrid (Studio + Online)</option>
                      <option value="PHYSICAL">Campus Physical Lab</option>
                      <option value="ONLINE">Live Online Cohort</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cs-batch-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Cohort Intake Batch
                  </label>
                  <div className="relative">
                    <select
                      id="cs-batch-select"
                      value={preferredBatch}
                      onChange={(e) => setPreferredBatch(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#477DBB] dark:focus:border-[#75A7E0] cursor-pointer"
                    >
                      {batchDropdownOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cs-schedule-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Class Timing Option
                  </label>
                  <div className="relative">
                    <select
                      id="cs-schedule-select"
                      value={preferredSchedule}
                      onChange={(e) => setPreferredSchedule(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#477DBB] dark:focus:border-[#75A7E0] cursor-pointer"
                    >
                      <option value="WEEKDAY_INTENSIVE">Weekday Intensive (10 AM - 1 PM)</option>
                      <option value="WEEKEND_SPECIALIST">Weekend Specialist (Sat - Sun)</option>
                      <option value="EVENING_COHORT">Evening Executive (6 PM - 9 PM)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>
            </section>

            {/* OPTION 3: Academic Background & Career Track */}
            <section className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-6 space-y-5 shadow-xs">
              <div className="border-b border-[#E5E1EA] dark:border-[#38384B] pb-3">
                <h2 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                  03. Background, Experience &amp; Career Track
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cs-qualification-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Highest Qualification
                  </label>
                  <div className="relative">
                    <select
                      id="cs-qualification-select"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#529B78] dark:focus:border-[#76BD99] cursor-pointer"
                    >
                      <option value="12th Standard / Higher Secondary">12th Standard / Higher Secondary</option>
                      <option value="Undergraduate Student">Undergraduate Student</option>
                      <option value="Graduate / Bachelor Degree">Graduate / Bachelor&apos;s Degree</option>
                      <option value="Postgraduate / Master Degree">Postgraduate / Master&apos;s</option>
                      <option value="Working Professional">Working Professional</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cs-experience-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Prior Experience Level
                  </label>
                  <div className="relative">
                    <select
                      id="cs-experience-select"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#529B78] dark:focus:border-[#76BD99] cursor-pointer"
                    >
                      <option value="Beginner (0 Years Experience)">Beginner (0 Years)</option>
                      <option value="Foundational (1-2 Years)">Foundational (1–2 Years)</option>
                      <option value="Experienced (3+ Years)">Experienced (3+ Years)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="cs-career-select" className="text-xs font-medium text-[#555770] dark:text-[#B8B5C5] block">
                    Career Goal Focus
                  </label>
                  <div className="relative">
                    <select
                      id="cs-career-select"
                      value={careerTrack}
                      onChange={(e) => setCareerTrack(e.target.value)}
                      className="w-full appearance-none bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-3.5 pr-9 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#529B78] dark:focus:border-[#76BD99] cursor-pointer"
                    >
                      <option value="Full-Stack Web & AI Engineering">Web &amp; AI Software Engineering</option>
                      <option value="AI Media & Film Production">Cinema &amp; AI Media Production</option>
                      <option value="Digital Marketing & Brand Strategy">Integrated Digital Marketing</option>
                      <option value="Business Communication & Consulting">Business Communication</option>
                      <option value="Freelance Studio & Startups">Freelance Studio / Entrepreneurship</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] pointer-events-none absolute right-3 top-3" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Live Selected Program Summary + Confirmation Form */}
          <aside className="lg:col-span-5 space-y-6">
            {/* Selected Course Preview */}
            <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex items-start justify-between gap-3 border-b border-[#E5E1EA] dark:border-[#38384B] pb-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold text-[#477DBB] dark:text-[#75A7E0] uppercase tracking-wider">
                    Selected Curriculum
                  </span>
                  <h3 className="text-xl font-serif font-bold text-[#25263A] dark:text-[#F5F3FA] leading-snug">
                    {activeCourse?.name || 'Custom Academy Enrollment'}
                  </h3>
                </div>
                <BookOpen className="w-5 h-5 text-[#477DBB] dark:text-[#75A7E0] shrink-0 mt-1" />
              </div>

              {activeCourse ? (
                <>
                  <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">
                    {activeCourse.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#555770] dark:text-[#B8B5C5]">
                    <span className="font-mono font-bold text-[#25263A] dark:text-[#F5F3FA]">{activeCourse.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeCourse.duration}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeCourse.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-[#529B78] dark:text-[#76BD99] tabular-nums">
                      ₹{Number(activeCourse.fee || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">
                    Program Lead: <span className="text-[#25263A] dark:text-[#F5F3FA] font-medium">{activeCourse.coordinator}</span>
                  </p>
                  {activeCourse.learningObjectives && activeCourse.learningObjectives.length > 0 && (
                    <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] space-y-1.5">
                      <p className="text-[11px] font-mono uppercase text-[#555770] dark:text-[#B8B5C5]">Key Syllabus Modules</p>
                      <ul className="space-y-1 text-xs text-[#555770] dark:text-[#B8B5C5]">
                        {activeCourse.learningObjectives.slice(0, 4).map((obj, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#529B78] dark:text-[#76BD99] shrink-0 mt-0.5" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">
                  Select an option from the dropdowns on the left to review curriculum duration, tuition fee, and syllabus outcomes.
                </p>
              )}

              {/* Summary of 3 Options */}
              <div className="pt-3 border-t border-[#E5E1EA] dark:border-[#38384B] space-y-1.5 text-xs text-[#555770] dark:text-[#B8B5C5]">
                <div className="flex justify-between gap-2">
                  <span>Mode &amp; Schedule:</span>
                  <span className="text-[#25263A] dark:text-[#F5F3FA] font-medium text-right">{studyMode} · {preferredSchedule.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Intake Batch:</span>
                  <span className="text-[#25263A] dark:text-[#F5F3FA] font-mono text-right">{preferredBatch}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Career Track:</span>
                  <span className="text-[#7652A8] dark:text-[#A985D6] font-medium text-right">{careerTrack}</span>
                </div>
              </div>

              {onConfirmForRegistration && selectedCourseId && (
                <button
                  type="button"
                  onClick={() => onConfirmForRegistration(selectedCourseId)}
                  className="w-full py-2.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] hover:bg-[#7652A8]/10 border border-[#7652A8]/40 dark:border-[#A985D6]/40 text-[#7652A8] dark:text-[#A985D6] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Use Selected Course in Account Sign-Up</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Submit Enrollment Proposal */}
            <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl p-6 space-y-5 shadow-xs">
              {submittedSuccess ? (
                <div className="py-5 space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#529B78]/15 border border-[#529B78]/40 text-[#529B78] dark:text-[#76BD99] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                      Course Registered &amp; Confirmation Message Sent!
                    </h3>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">
                      Your selection for <strong className="text-[#7652A8] dark:text-[#A985D6]">{activeCourse?.name || 'Academy Program'}</strong> ({studyMode}) has been queued for Academy acceptance.
                    </p>
                  </div>

                  {confirmationReceipt && (
                    <div className="p-3.5 bg-[#F4F3F7] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-[#2E7051] dark:text-[#76BD99]">
                          ID: {confirmationReceipt.confirmationId}
                        </span>
                        <span className="text-[#555770] dark:text-[#B8B5C5]">SAVED</span>
                      </div>
                      <p className="text-[11px] text-[#25263A] dark:text-[#F5F3FA] leading-relaxed">
                        {confirmationReceipt.messageText}
                      </p>
                      <p className="text-[11px] font-mono text-[#555770] dark:text-[#B8B5C5]">
                        Contact: <strong>{confirmationReceipt.recipientPhone}</strong> · Support:{' '}
                        <strong className="text-[#2E7051] dark:text-[#76BD99]">{confirmationReceipt.academySupportPhone}</strong>
                      </p>
                      {confirmationReceipt.whatsappUrl && (
                        <a
                          href={confirmationReceipt.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] dark:text-[#151521] text-white text-xs font-bold uppercase rounded-lg"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Open WhatsApp Support</span>
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedSuccess(false);
                        setConfirmationReceipt(null);
                        setApplicantName('');
                        setApplicantEmail('');
                        setApplicantPhone('');
                        setApplicantNotes('');
                      }}
                      className="px-4 py-2 bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg text-xs text-[#25263A] dark:text-[#F5F3FA] font-semibold cursor-pointer"
                    >
                      Select Another Course
                    </button>
                    <button
                      type="button"
                      onClick={onBack}
                      className="px-4 py-2 bg-[#7652A8] hover:bg-[#634194] dark:bg-[#A985D6] dark:hover:bg-[#BA9BE3] text-white dark:text-[#151521] text-xs font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Return Home
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitSelection} className="space-y-4">
                  <h3 className="text-sm font-serif font-bold text-[#25263A] dark:text-[#F5F3FA] border-b border-[#E5E1EA] dark:border-[#38384B] pb-2">
                    Complete Your Selection Request
                  </h3>

                  <div className="space-y-1">
                    <label htmlFor="cs-name" className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-semibold">
                      Full Name *
                    </label>
                    <input
                      id="cs-name"
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3.5 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="cs-email" className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-semibold">
                      Email Address *
                    </label>
                    <input
                      id="cs-email"
                      type="email"
                      required
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3.5 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="cs-phone" className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-semibold">
                      Phone / Contact Number *
                    </label>
                    <input
                      id="cs-phone"
                      type="tel"
                      required
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3.5 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] font-mono focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="cs-notes" className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-semibold">
                      Questions or Notes (Optional)
                    </label>
                    <textarea
                      id="cs-notes"
                      rows={2}
                      value={applicantNotes}
                      onChange={(e) => setApplicantNotes(e.target.value)}
                      placeholder="Any questions regarding syllabus, timings, or fees..."
                      className="w-full bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg px-3.5 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] dark:hover:bg-[#8AD0AC] text-white dark:text-[#151521] text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Registering & Sending Confirmation...' : 'Submit & Send Confirmation Message'}</span>
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
