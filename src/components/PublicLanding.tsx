/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Compass,
  Cpu,
  FileCheck2,
  Globe,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquarePlus,
  MonitorPlay,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserCheck,
  Users,
  Video,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  AcademyReview,
  AcademySettings,
  Course,
  FrontPageConfig,
  FrontPagePosterItem,
  INITIAL_FRONT_PAGE_CONFIG,
  Instructor,
  SwanayaDatabase,
  User as SwanayaUser,
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { applyDocumentFavicon } from '../utils/favicon';
import { parseFrontPageVideoUrl } from '../utils/mediaHelpers';
import ThemeToggle from './ThemeToggle';

import heroAcademyImg from '../assets/images/hero_academy_edtech_1795100147459.jpg';
import aboutStudioImg from '../assets/images/about_practical_training_1795100148310.jpg';
import ecosystemPlatformImg from '../assets/images/learning_ecosystem_platform_1795100148060.jpg';

export type PortalLoginRoleTab = 'ADMIN' | 'TUTOR' | 'STUDENT';

interface PublicLandingProps {
  onNavigateToPortal: (roleTab?: PortalLoginRoleTab) => void;
  onNavigateToRegister?: () => void;
  onNavigateToCourseSelection?: (courseId?: string) => void;
  onLoginSuccess?: (user: SwanayaUser) => void;
  activeUser?: SwanayaUser | null;
  courses: Course[];
  coursesLoading?: boolean;
  coursesError?: string | null;
  onApplyLead: (leadData: {
    name: string;
    email: string;
    phone: string;
    courseId: string;
    qualification: string;
    preferredBatch: string;
    message: string;
  }) => void;
}

function mergeFrontPage(partial?: Partial<FrontPageConfig> | null): FrontPageConfig {
  const safe = partial && typeof partial === 'object' ? partial : {};
  return {
    ...INITIAL_FRONT_PAGE_CONFIG,
    ...safe,
    cohortItems:
      Array.isArray(safe.cohortItems) && safe.cohortItems.length > 0
        ? safe.cohortItems
        : INITIAL_FRONT_PAGE_CONFIG.cohortItems,
    philosophyPillars:
      Array.isArray(safe.philosophyPillars) && safe.philosophyPillars.length > 0
        ? safe.philosophyPillars
        : INITIAL_FRONT_PAGE_CONFIG.philosophyPillars,
    posters: Array.isArray(safe.posters) ? safe.posters : INITIAL_FRONT_PAGE_CONFIG.posters,
    showReviewsSection:
      typeof safe.showReviewsSection === 'boolean'
        ? safe.showReviewsSection
        : INITIAL_FRONT_PAGE_CONFIG.showReviewsSection,
    showBlogSection:
      typeof safe.showBlogSection === 'boolean'
        ? safe.showBlogSection
        : INITIAL_FRONT_PAGE_CONFIG.showBlogSection,
    showAdmissionsSection:
      typeof safe.showAdmissionsSection === 'boolean'
        ? safe.showAdmissionsSection
        : INITIAL_FRONT_PAGE_CONFIG.showAdmissionsSection,
    showMediaShowcaseSection:
      typeof safe.showMediaShowcaseSection === 'boolean'
        ? safe.showMediaShowcaseSection
        : INITIAL_FRONT_PAGE_CONFIG.showMediaShowcaseSection,
  };
}

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const SMA_FAQS: FaqItem[] = [
  {
    id: 'courses',
    category: 'Courses',
    question: 'What academic programmes does Swanaya Media Academy offer?',
    answer:
      'Swanaya Media Academy delivers career-focused diploma, foundation, and advanced training programmes across digital media, software engineering, web architecture, and AI-enabled production. Every published programme in our catalogue lists exact duration, level, delivery mode, and learning outcomes.',
  },
  {
    id: 'admission',
    category: 'Admission',
    question: 'How does the admission and registration process work?',
    answer:
      'Prospective learners can submit a Course Enquiry directly on this page or register through the Student Portal. Once your enquiry is received, our Admissions Desk schedules a programme briefing, verifies prerequisites, and confirms your cohort allocation.',
  },
  {
    id: 'duration',
    category: 'Course duration',
    question: 'How long are the courses and what study modes are available?',
    answer:
      'Programme durations vary by curriculum depth—from focused multi-month certificate tracks to comprehensive 12-month diploma cohorts. Delivery options include Physical campus studios, live Online cohorts, and flexible Hybrid schedules.',
  },
  {
    id: 'examinations',
    category: 'Examinations',
    question: 'How are assessments and examinations conducted at SMA?',
    answer:
      'Students complete continuous practical project evaluations alongside scheduled assessments inside the dedicated SMA Examination Portal, featuring structured question papers, timed MCQ evaluations, and faculty review.',
  },
  {
    id: 'certification',
    category: 'Certification',
    question: 'What certification is awarded upon completing a programme?',
    answer:
      'Graduates who satisfy attendance, project, and examination benchmarks receive verified digital certification issued under Swanaya Media Academy, the official training and certification division of Swanaya Media Enterprises.',
  },
  {
    id: 'online-learning',
    category: 'Online learning',
    question: 'How does the Swanaya digital learning platform support online study?',
    answer:
      'The SMA Learning Ecosystem unifies live virtual sessions, structured study materials, student and tutor dashboards, assignment submissions, real-time progress tracking, and digital credential access within one secure platform.',
  },
];

const WHY_CHOOSE_PILLARS = [
  {
    title: 'Industry-Oriented Learning',
    description:
      'Curricula co-designed around modern media production pipelines, enterprise web engineering, and real workplace standards.',
    accent: 'purple' as const,
    icon: Briefcase,
  },
  {
    title: 'Practical Projects',
    description:
      'Every module culminates in guided hands-on briefs, portfolio builds, and applied critiques instead of passive theory alone.',
    accent: 'green' as const,
    icon: Code2,
  },
  {
    title: 'AI-Integrated Education',
    description:
      'Learn contemporary workflows combining creative direction and engineering fundamentals with responsible AI productivity tools.',
    accent: 'purple' as const,
    icon: Cpu,
  },
  {
    title: 'Professional Development',
    description:
      'Structured communication, workflow discipline, mentor feedback loops, and portfolio readiness for evolving industry roles.',
    accent: 'green' as const,
    icon: Target,
  },
  {
    title: 'Digital Learning Environment',
    description:
      'Unified access to class timetables, recorded sessions, curated resource libraries, attendance records, and academic notices.',
    accent: 'purple' as const,
    icon: Globe,
  },
  {
    title: 'Certification Opportunities',
    description:
      'Earn verifiable credentials backed by Swanaya Media Enterprises upon passing practical reviews and institutional exams.',
    accent: 'green' as const,
    icon: Award,
  },
];

const ECOSYSTEM_MODULES = [
  {
    title: 'Online Learning',
    description: 'Live interactive classes, curated course notes, and structured lesson playback.',
    icon: MonitorPlay,
    accent: '#477FC4',
  },
  {
    title: 'Examination Portal',
    description: 'Timed online MCQ tests, structured question papers, and transparent scoring.',
    icon: FileCheck2,
    accent: '#7546B8',
  },
  {
    title: 'Student Dashboard',
    description: 'Personal timetables, digital ID card, attendance percentage, and fee ledger.',
    icon: GraduationCap,
    accent: '#50A77B',
  },
  {
    title: 'Tutor Dashboard',
    description: 'Cohort delivery tools, attendance verification, syllabus status, and grading.',
    icon: Users,
    accent: '#477FC4',
  },
  {
    title: 'Academic Progress Tracking',
    description: 'Semester-by-semester competency milestones and verified project evaluations.',
    icon: BarChart3,
    accent: '#7546B8',
  },
  {
    title: 'Digital Certification',
    description: 'Official SMA graduation certificates ready for employer and academic verification.',
    icon: Award,
    accent: '#50A77B',
  },
];

export default function PublicLanding({
  onNavigateToPortal,
  onNavigateToRegister,
  onNavigateToCourseSelection,
  activeUser,
  courses,
  coursesLoading: parentCoursesLoading,
  coursesError: parentCoursesError,
  onApplyLead,
}: PublicLandingProps) {
  const [frontPage, setFrontPage] = useState<FrontPageConfig>(() =>
    mergeFrontPage(SwanayaDatabase.get<FrontPageConfig>('frontPageConfig'))
  );
  const [academySettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>('settings'));
  const facultyList = useMemo(() => {
    const raw = SwanayaDatabase.get<Instructor[]>('instructors') || [];
    return raw.filter((inst) => inst && inst.status !== 'INACTIVE').slice(0, 6);
  }, []);

  // Reactive real-time Firestore courses subscription
  const [activeCourses, setActiveCourses] = useState<Course[]>(() => (Array.isArray(courses) ? courses : []));
  const [landingCoursesLoading, setLandingCoursesLoading] = useState<boolean>(
    Boolean(parentCoursesLoading ?? courses.length === 0)
  );
  const [landingCoursesError, setLandingCoursesError] = useState<string | null>(parentCoursesError || null);

  useEffect(() => {
    if (Array.isArray(courses) && courses.length > 0) {
      setActiveCourses(courses);
      setLandingCoursesLoading(false);
    }
  }, [courses]);

  useEffect(() => {
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (fetched) => {
        setActiveCourses(fetched);
        setLandingCoursesLoading(false);
        setLandingCoursesError(null);
      },
      onError: (err) => {
        setLandingCoursesError(err.message || 'Unable to load published programmes.');
        setLandingCoursesLoading(false);
      },
    });
    return () => unsubscribe();
  }, []);

  const displayCourses = useMemo(() => {
    if (activeCourses.length > 0) return activeCourses;
    if (Array.isArray(courses) && courses.length > 0) return courses;
    return [];
  }, [activeCourses, courses]);

  // Level filter for Section 04 Academic Programmes
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
  const filteredCourses = useMemo(() => {
    if (selectedLevelFilter === 'ALL') return displayCourses;
    return displayCourses.filter((c) => c.level === selectedLevelFilter);
  }, [displayCourses, selectedLevelFilter]);

  const availableLevels = useMemo(() => {
    const levels = Array.from(new Set(displayCourses.map((c) => c.level))).filter(Boolean);
    return ['ALL', ...levels];
  }, [displayCourses]);

  // Course Details Modal
  const [selectedCourseModal, setSelectedCourseModal] = useState<Course | null>(null);

  // Dynamic Front Page & Reviews (zero invented testimonials)
  const [reviews, setReviews] = useState<AcademyReview[]>([]);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    authorName: '',
    courseId: displayCourses[0]?.id || courses[0]?.id || 'general-academy',
    rating: 5,
    title: '',
    comment: '',
  });
  const [reviewNotice, setReviewNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchFrontPage = async () => {
      try {
        const cloud = await academyService.getFrontPageConfig();
        if (cloud) {
          const merged = mergeFrontPage(cloud as Partial<FrontPageConfig>);
          setFrontPage(merged);
          SwanayaDatabase.set('frontPageConfig', merged);
        }
      } catch {
        // Keep local configuration on offline/uninitialized document
      }
    };

    const fetchReviews = async () => {
      try {
        const localSaved = SwanayaDatabase.get<AcademyReview[]>('reviews');
        const localPublished = Array.isArray(localSaved)
          ? localSaved.filter((r) => r.status === 'PUBLISHED')
          : [];

        let cloudPublished: AcademyReview[] = [];
        try {
          const fetched = await academyService.getReviews(true);
          if (Array.isArray(fetched)) {
            cloudPublished = fetched as AcademyReview[];
          }
        } catch {
          // Graceful fallback to local published reviews
        }

        const mergedMap = new Map<string, AcademyReview>();
        localPublished.forEach((r) => r?.id && mergedMap.set(r.id, r));
        cloudPublished.forEach((r) => r?.id && mergedMap.set(r.id, r));
        const combined = Array.from(mergedMap.values()).sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
        setReviews(combined);
      } catch {
        // Ignore review fetch errors
      }
    };

    fetchFrontPage();
    fetchReviews();
  }, []);

  useEffect(() => {
    applyDocumentFavicon(frontPage.faviconUrl);
  }, [frontPage.faviconUrl]);

  const [logoLoadError, setLogoLoadError] = useState(false);
  useEffect(() => {
    setLogoLoadError(false);
  }, [frontPage.brandLogoUrl, frontPage.faviconUrl]);

  const headerLogoSrc =
    frontPage.brandLogoUrl?.trim() ||
    (frontPage.faviconUrl && frontPage.faviconUrl.trim() !== '/favicon.svg' ? frontPage.faviconUrl.trim() : '');

  const parsedFeaturedVideo = parseFrontPageVideoUrl(frontPage.featuredVideoUrl);
  const validPosters = (frontPage.posters || []).filter((p) => p.imageUrl?.trim() || p.title?.trim());
  const hasMediaShowcase =
    frontPage.showMediaShowcaseSection && (Boolean(parsedFeaturedVideo) || validPosters.length > 0);
  const [selectedPoster, setSelectedPoster] = useState<FrontPagePosterItem | null>(null);

  // Image error states for smooth fallback surfaces
  const [heroImgError, setHeroImgError] = useState(false);
  const [aboutImgError, setAboutImgError] = useState(false);
  const [ecosystemImgError, setEcosystemImgError] = useState(false);

  // Navigation mobile menu & FAQ accordion
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string>(SMA_FAQS[0].id);

  // Section 08 – Admission & Enquiry Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: displayCourses[0]?.id || courses[0]?.id || '',
    qualification: 'Prospective Applicant',
    preferredBatch: 'Next Cohort',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enquiryConfirmation, setEnquiryConfirmation] = useState<{
    confirmationId: string;
    recipientPhone: string;
    academyVerificationPhone: string;
    messageText: string;
    whatsappUrl: string;
    studentName: string;
    studentEmail: string;
    courseId: string;
    courseTitle: string;
  } | null>(null);
  const [editingConfirmPhone, setEditingConfirmPhone] = useState(false);
  const [confirmPhoneInput, setConfirmPhoneInput] = useState('');
  const [resendingConfirm, setResendingConfirm] = useState(false);

  useEffect(() => {
    if (displayCourses.length > 0) {
      setFormData((prev) =>
        prev.courseId && displayCourses.some((c) => c.id === prev.courseId)
          ? prev
          : { ...prev, courseId: displayCourses[0].id }
      );
      setReviewForm((prev) =>
        prev.courseId && (prev.courseId === 'general-academy' || displayCourses.some((c) => c.id === prev.courseId))
          ? prev
          : { ...prev, courseId: displayCourses[0].id }
      );
    }
  }, [displayCourses]);

  const handleEnquireCourse = (courseId: string) => {
    setFormData((prev) => ({ ...prev, courseId }));
    setSelectedCourseModal(null);
    const contactEl = document.getElementById('contact');
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim();
    const cleanPhone = formData.phone.trim();

    if (!cleanName || !cleanEmail || !cleanPhone) {
      setSubmitError('Please provide your name, email address, and contact number.');
      return;
    }

    const payload = {
      ...formData,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      courseId: formData.courseId || displayCourses[0]?.id || 'general-enquiry',
      qualification: formData.qualification || 'Prospective Applicant',
      preferredBatch: formData.preferredBatch || 'Next Cohort',
      message: formData.message.trim(),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadData: payload }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setSubmitError(data.error || 'Submission failed. Please check your details and try again.');
          setIsSubmitting(false);
          return;
        }
      } else if (!res.ok) {
        setSubmitError('Unable to reach admissions service right now. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const matchedCourse = displayCourses.find((c) => c.id === payload.courseId) || courses.find((c) => c.id === payload.courseId);
      const resolvedCourseTitle = matchedCourse?.name || 'Swanaya Media Academy Program';
      try {
        const confirmRes = await academyService.sendCourseRegistrationConfirmation({
          studentName: payload.name,
          studentEmail: payload.email,
          phone: payload.phone,
          channel: 'WHATSAPP',
          courseId: payload.courseId,
          courseCode: matchedCourse?.code,
          courseTitle: resolvedCourseTitle,
          preferredBatch: payload.preferredBatch,
          source: 'LANDING_ENQUIRY',
        });
        setEnquiryConfirmation({
          confirmationId: confirmRes.confirmationId,
          recipientPhone: confirmRes.recipientPhone || payload.phone,
          academyVerificationPhone: confirmRes.academyVerificationPhone || '+91 94460 55555',
          messageText: confirmRes.messageText,
          whatsappUrl: confirmRes.whatsappUrl,
          studentName: payload.name,
          studentEmail: payload.email,
          courseId: payload.courseId,
          courseTitle: resolvedCourseTitle,
        });
        setConfirmPhoneInput(confirmRes.recipientPhone || payload.phone);
      } catch {
        // non-fatal confirmation log
      }

      onApplyLead(payload);
      setSubmitted(true);
      setIsSubmitting(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        courseId: displayCourses[0]?.id || courses[0]?.id || '',
        qualification: 'Prospective Applicant',
        preferredBatch: 'Next Cohort',
        message: '',
      });
    } catch {
      onApplyLead(payload);
      setSubmitted(true);
      setIsSubmitting(false);
    }
  };

  const handleUpdateLandingConfirmNumber = async () => {
    if (!enquiryConfirmation) return;
    const nextNum = confirmPhoneInput.trim();
    if (!nextNum || nextNum.replace(/\D/g, '').length < 6) return;
    setResendingConfirm(true);
    try {
      const confirmRes = await academyService.sendCourseRegistrationConfirmation({
        studentName: enquiryConfirmation.studentName,
        studentEmail: enquiryConfirmation.studentEmail,
        phone: nextNum,
        channel: 'WHATSAPP',
        courseId: enquiryConfirmation.courseId,
        courseTitle: enquiryConfirmation.courseTitle,
        source: 'LANDING_ENQUIRY',
      });
      setEnquiryConfirmation((prev) =>
        prev
          ? {
              ...prev,
              confirmationId: confirmRes.confirmationId,
              recipientPhone: confirmRes.recipientPhone || nextNum,
              academyVerificationPhone: confirmRes.academyVerificationPhone || '+91 94460 55555',
              messageText: confirmRes.messageText,
              whatsappUrl: confirmRes.whatsappUrl,
            }
          : null
      );
      setEditingConfirmPhone(false);
    } catch {
      // ignore transient
    } finally {
      setResendingConfirm(false);
    }
  };

  const handlePublicReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewNotice(null);

    const authorName = reviewForm.authorName.trim();
    const title = reviewForm.title.trim();
    const comment = reviewForm.comment.trim();
    if (!authorName || !title || !comment) {
      setReviewNotice({ type: 'error', text: 'Please fill in your name, headline, and review comment.' });
      return;
    }

    const matchedCourse = displayCourses.find((c) => c.id === reviewForm.courseId);
    const nowIso = new Date().toISOString();
    const newReview: AcademyReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorId: auth.currentUser?.uid || `guest-${Date.now()}`,
      authorName,
      authorRole: 'Student / Visitor',
      courseId: matchedCourse?.id || 'general-academy',
      courseName: matchedCourse?.name || 'Swanaya Media Academy',
      rating: reviewForm.rating,
      title,
      comment,
      status: 'PUBLISHED',
      verifiedStudent: Boolean(auth.currentUser),
      helpfulCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setSubmittingReview(true);
    try {
      if (auth.currentUser) {
        await academyService.createReview(newReview);
      }
      const existingLocal = SwanayaDatabase.get<AcademyReview[]>('reviews') || [];
      SwanayaDatabase.set('reviews', [newReview, ...existingLocal]);
      setReviews((prev) => [newReview, ...prev]);
      setReviewForm({
        authorName: '',
        courseId: displayCourses[0]?.id || courses[0]?.id || 'general-academy',
        rating: 5,
        title: '',
        comment: '',
      });
      setIsReviewFormOpen(false);
      setReviewNotice({ type: 'success', text: 'Thank you. Your verified feedback has been published.' });
    } catch {
      setReviewNotice({ type: 'error', text: 'Could not publish feedback right now. Please try again.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const contactEmail = frontPage.contactEmail || academySettings?.email || 'academy@swanayamedia.com';
  const contactPhone = frontPage.contactPhone || academySettings?.phone || '+91 94460 55555';
  const campusAddress =
    frontPage.contactLocation || academySettings?.address || 'Swanaya Media Enterprises Campus, Thiruvananthapuram, Kerala';
  const whatsappNumber = (academySettings?.adminWhatsAppPhone || contactPhone).replace(/[^\d]/g, '');

  return (
    <div className="min-h-screen bg-[var(--sma-active-bg)] text-[var(--sma-active-text)] flex flex-col font-sans selection:bg-[var(--sma-primary)]/20 selection:text-[var(--sma-active-text)] transition-colors">
      {/* =================================================================== */}
      {/* SECTION 01 – NAVIGATION (1 row, 3 zones, accessible touch targets)  */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-50 bg-[var(--sma-active-surface)]/95 backdrop-blur-md border-b border-[var(--sma-active-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          {/* Zone 1: Academy Logo & Name */}
          <a href="#home" className="flex items-center gap-3 shrink-0 group focus:outline-none">
            {headerLogoSrc && !logoLoadError ? (
              <img
                src={headerLogoSrc}
                alt="Swanaya Media Academy"
                referrerPolicy="no-referrer"
                onError={() => setLogoLoadError(true)}
                className="w-10 h-10 rounded-xl object-cover border border-[var(--sma-active-border)] bg-[var(--sma-active-surface)]"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[#FFFFFF] font-serif font-bold text-sm tracking-wider shadow-sm"
                style={{ background: 'linear-gradient(135deg, var(--sma-primary), var(--sma-secondary))' }}
              >
                SMA
              </div>
            )}
            <div className="leading-tight">
              <span className="block font-serif font-bold text-base sm:text-lg tracking-tight text-[var(--sma-active-text)] whitespace-nowrap">
                {academySettings?.academyName || 'Swanaya Media Academy'}
              </span>
              <span className="hidden sm:block text-[11px] font-medium text-[var(--sma-secondary)] dark:text-[#75A7E0] tracking-wide whitespace-nowrap">
                Division of Swanaya Media Enterprises
              </span>
            </div>
          </a>

          {/* Zone 2: Desktop Navigation Links */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-7 text-sm font-semibold text-[var(--sma-active-text)]">
            <a href="#about" className="hover:text-[var(--sma-primary)] transition-colors whitespace-nowrap shrink-0 py-2">
              About
            </a>
            <a href="#courses" className="hover:text-[var(--sma-primary)] transition-colors whitespace-nowrap shrink-0 py-2">
              Courses
            </a>
            <a href="#faculty" className="hover:text-[var(--sma-primary)] transition-colors whitespace-nowrap shrink-0 py-2">
              Faculty
            </a>
            <a href="#certification" className="hover:text-[var(--sma-primary)] transition-colors whitespace-nowrap shrink-0 py-2">
              Certification
            </a>
            <a href="#contact" className="hover:text-[var(--sma-primary)] transition-colors whitespace-nowrap shrink-0 py-2">
              Contact
            </a>
          </nav>

          {/* Zone 3: Theme Switcher + Student Login CTA & Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle compact />

            <button
              type="button"
              onClick={() => onNavigateToPortal('STUDENT')}
              className="hidden sm:inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-[#FFFFFF] text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
            >
              <span>{activeUser ? 'Enter Portal' : 'Student Login'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-[var(--sma-active-border)] bg-[var(--sma-active-surface)] text-[var(--sma-active-text)] hover:opacity-90 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--sma-active-border)] bg-[var(--sma-active-surface)] px-4 py-4 space-y-2 shadow-lg">
            <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1 text-sm font-semibold text-[var(--sma-active-text)]">
              {[
                { label: 'Home', href: '#home' },
                { label: 'About Us', href: '#about' },
                { label: 'Courses', href: '#courses' },
                { label: 'Faculty & Tutors', href: '#faculty' },
                { label: 'Certification', href: '#certification' },
                { label: 'Portal Access', href: '#portals' },
                { label: 'Contact', href: '#contact' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] flex items-center px-3 rounded-lg hover:bg-[var(--sma-active-bg)] hover:text-[var(--sma-primary)] transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="pt-2 border-t border-[var(--sma-active-border)] grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToPortal('STUDENT');
                }}
                className="min-h-[44px] rounded-xl bg-[var(--sma-accent)] text-[#FFFFFF] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Student Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToPortal('TUTOR');
                }}
                className="min-h-[44px] rounded-xl bg-[var(--sma-secondary)] text-[#FFFFFF] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Tutor Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToPortal('ADMIN');
                }}
                className="min-h-[44px] rounded-xl bg-[var(--sma-primary)] text-[#FFFFFF] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Admin Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onNavigateToRegister) onNavigateToRegister();
                  else onNavigateToPortal('STUDENT');
                }}
                className="min-h-[44px] rounded-xl border border-[var(--sma-active-border)] text-[var(--sma-active-text)] text-xs font-semibold flex items-center justify-center cursor-pointer"
              >
                Register Now
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* =================================================================== */}
        {/* SECTION 02 – FULL-SCREEN HERO BANNER                                */}
        {/* =================================================================== */}
        <section
          id="home"
          className="relative overflow-hidden text-[#FFFFFF] min-h-[calc(100vh-4.5rem)] flex items-center py-12 sm:py-16 px-4 sm:px-6 lg:px-8"
          style={{
            background: 'linear-gradient(135deg, var(--sma-primary) 0%, var(--sma-secondary) 100%)',
          }}
        >
          {/* Subtle compositor-safe geometric accents */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border border-[#FFFFFF]/15" />
            <div className="absolute top-12 right-1/4 w-72 h-72 rounded-full bg-[#FFFFFF]/10 blur-3xl" />
            <div className="absolute -bottom-32 -right-20 w-[440px] h-[440px] rounded-full border border-[#FFFFFF]/10" />
          </div>

          <div className="relative max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Hero Left Copy & Explicit Primary + Role Actions */}
            <div className="lg:col-span-6 space-y-6">
              <p className="text-xs sm:text-sm font-mono uppercase tracking-[0.18em] text-[#FFFFFF]/85 font-semibold">
                {frontPage.heroEyebrow || 'Swanaya Media Enterprises · Training & Certification Division'}
              </p>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-serif font-bold tracking-tight leading-[1.1] text-[#FFFFFF] text-balance">
                Build Your Future With The Power Of Knowledge.
              </h1>

              <p className="text-base sm:text-lg text-[#FFFFFF]/90 leading-relaxed max-w-xl">
                {frontPage.heroDescription ||
                  'Discover professional learning, practical skills and industry-oriented training with Swanaya Media Academy.'}
              </p>

              {/* Primary CTA Row */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#courses"
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[var(--sma-accent)] hover:bg-[var(--sma-accent-hover)] text-[#FFFFFF] text-sm font-bold shadow-md transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Explore Courses</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => (onNavigateToRegister ? onNavigateToRegister() : onNavigateToPortal('STUDENT'))}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 border border-[#FFFFFF]/40 text-[#FFFFFF] text-sm font-semibold backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Register Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateToPortal('STUDENT')}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#FFFFFF] hover:bg-[#F7F7FA] text-[#20243A] text-sm font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{activeUser ? 'Open Portal' : 'Student Login'}</span>
                  <ArrowUpRight className="w-4 h-4 text-[var(--sma-primary)]" />
                </button>
              </div>

              {/* Dedicated Faculty & Admin Role Access Strip */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#FFFFFF]/90">
                <button
                  type="button"
                  onClick={() => onNavigateToPortal('TUTOR')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 border border-[#FFFFFF]/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Tutor Login</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPortal('ADMIN')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 border border-[#FFFFFF]/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Login</span>
                </button>
              </div>

              {/* Grounded Institution Highlight Strip */}
              <div className="pt-4 border-t border-[#FFFFFF]/20 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-[#FFFFFF]/90 font-medium">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--sma-accent)] bg-[#FFFFFF] rounded-full shrink-0" />
                  Practical Studio Curricula
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--sma-accent)] bg-[#FFFFFF] rounded-full shrink-0" />
                  Dedicated LMS &amp; Exam Portal
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--sma-accent)] bg-[#FFFFFF] rounded-full shrink-0" />
                  Digital Certification
                </span>
              </div>
            </div>

            {/* Hero Right Visual Frame */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl overflow-hidden bg-[#293044] border border-[#FFFFFF]/25 shadow-2xl">
                <div className="aspect-[16/10] w-full overflow-hidden">
                  {heroImgError ? (
                    <div className="w-full h-full bg-gradient-to-br from-[#293044] to-[#477FC4] flex flex-col items-center justify-center p-8 text-center space-y-3">
                      <GraduationCap className="w-12 h-12 text-[#FFFFFF]" />
                      <p className="font-serif text-xl font-bold text-[#FFFFFF]">Swanaya Media Academy</p>
                      <p className="text-sm text-[#E9EAED] max-w-sm">
                        Academic Excellence, Creative Production &amp; Digital Technology Education
                      </p>
                    </div>
                  ) : (
                    <img
                      src={heroAcademyImg}
                      alt="Students collaborating inside the modern academic media and technology studio at Swanaya Media Academy"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Single clean caption bar below image inside frame */}
                <div className="bg-[#293044]/95 px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#FFFFFF]/15">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#50A77B] font-semibold">
                      Academic Technology Platform
                    </p>
                    <p className="text-sm font-semibold text-[#FFFFFF]">
                      Structured Mentorship · Practical Portfolios · Verified Credentials
                    </p>
                  </div>
                  <a
                    href="#platform"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FFFFFF] hover:text-[#50A77B] transition-colors whitespace-nowrap"
                  >
                    <span>View Platform</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 03 – ABOUT SWANAYA MEDIA ACADEMY                            */}
        {/* =================================================================== */}
        <section id="about" className="bg-[var(--sma-active-surface)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Editorial Visual */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-[var(--sma-active-border)] bg-[var(--sma-active-bg)] shadow-sm">
                <div className="aspect-[4/3] w-full overflow-hidden">
                  {aboutImgError ? (
                    <div className="w-full h-full bg-[#242436] text-[#FFFFFF] flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <BookOpen className="w-10 h-10 text-[var(--sma-secondary)]" />
                      <p className="font-serif text-lg font-bold">Swanaya Learning Studios</p>
                    </div>
                  ) : (
                    <img
                      src={aboutStudioImg}
                      alt="Hands-on media production and collaborative design training at Swanaya Media Academy"
                      referrerPolicy="no-referrer"
                      onError={() => setAboutImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="bg-[var(--sma-active-surface)] px-5 py-4 border-t border-[var(--sma-active-border)]">
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--sma-primary)] font-bold">
                    Swanaya Media Enterprises
                  </p>
                  <p className="text-sm font-semibold text-[var(--sma-active-text)] mt-0.5">
                    Dedicated Training, Assessment &amp; Certification Wing
                  </p>
                </div>
              </div>
            </div>

            {/* Introduction, Vision & Mission, Approach */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-primary)] font-bold">
                  About Swanaya Media Academy
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)] leading-tight">
                  The Training &amp; Certification Division of Swanaya Media Enterprises
                </h2>
                <p className="text-base text-[var(--sma-active-text-muted)] leading-relaxed">
                  {frontPage.philosophyDescription ||
                    'Swanaya Media Academy (SMA) bridges academic foundations with studio and engineering practice. Built within Swanaya Media Enterprises, the academy prepares learners through structured instruction, live project execution, and verified certification.'}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Vision */}
                <div className="rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] p-5 space-y-2">
                  <div className="flex items-center gap-2.5 text-[var(--sma-primary)]">
                    <Compass className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-base text-[var(--sma-active-text)]">Our Vision</h3>
                  </div>
                  <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed">
                    To cultivate capable, industry-ready media and technology professionals equipped with enduring fundamentals and ethical digital fluency.
                  </p>
                </div>

                {/* Mission */}
                <div className="rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] p-5 space-y-2">
                  <div className="flex items-center gap-2.5 text-[var(--sma-secondary)] dark:text-[#75A7E0]">
                    <Target className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-base text-[var(--sma-active-text)]">Our Mission</h3>
                  </div>
                  <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed">
                    Deliver accessible, mentor-guided training supported by a transparent digital LMS, rigorous examinations, and recognized certification.
                  </p>
                </div>

                {/* Professional Learning Approach */}
                <div className="rounded-xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-5 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2.5 text-[var(--sma-accent)]">
                    <UserCheck className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-base text-[var(--sma-active-text)]">Professional Learning Approach</h3>
                  </div>
                  <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed">
                    Structured cohort schedules, active attendance monitoring, and direct faculty feedback keep every learner progressing steadily.
                  </p>
                </div>

                {/* Practical & Project-Oriented Education */}
                <div className="rounded-xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-5 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2.5 text-[var(--sma-primary)]">
                    <Layers className="w-5 h-5 shrink-0" />
                    <h3 className="font-bold text-base text-[var(--sma-active-text)]">Practical &amp; Project-Oriented</h3>
                  </div>
                  <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed">
                    Students apply concepts on real studio workflows, software builds, and evaluated assignments that translate directly to portfolio proof.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 04 – ACADEMIC PROGRAMMES (Medium Blue accents, Cards)       */}
        {/* =================================================================== */}
        <section id="courses" className="bg-[var(--sma-active-bg)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-secondary)] dark:text-[#75A7E0] font-bold">
                  Academic Programmes
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                  Structured Courses Built For Real Competence
                </h2>
                <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)]">
                  All published programmes are synced live from our academic registry. Review outcomes or submit an enquiry for admissions guidance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {availableLevels.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-[var(--sma-active-surface)] p-1 rounded-xl border border-[var(--sma-active-border)]">
                    {availableLevels.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSelectedLevelFilter(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          selectedLevelFilter === lvl
                            ? 'bg-[var(--sma-secondary)] text-[#FFFFFF]'
                            : 'text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)]'
                        }`}
                      >
                        {lvl === 'ALL' ? 'All Levels' : lvl}
                      </button>
                    ))}
                  </div>
                )}

                {onNavigateToCourseSelection && (
                  <button
                    type="button"
                    onClick={() => onNavigateToCourseSelection()}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[var(--sma-active-surface)] hover:bg-[var(--sma-secondary)] text-[var(--sma-secondary)] dark:text-[#75A7E0] hover:text-[#FFFFFF] border border-[var(--sma-active-border)] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Full Course Directory</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Loading State */}
            {landingCoursesLoading && displayCourses.length === 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-6 space-y-4 opacity-75"
                  >
                    <div className="h-3 w-28 bg-[var(--sma-active-border)] rounded" />
                    <div className="h-6 w-3/4 bg-[var(--sma-active-border)] rounded" />
                    <div className="h-16 w-full bg-[var(--sma-active-border)] rounded" />
                    <div className="h-10 w-full bg-[var(--sma-active-border)] rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Live Error State */}
            {!landingCoursesLoading && landingCoursesError && displayCourses.length === 0 && (
              <div className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-secondary)]/40 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[var(--sma-secondary)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-[var(--sma-active-text)]">Unable to load live course catalogue</h3>
                    <p className="text-sm text-[var(--sma-active-text-muted)]">{landingCoursesError}</p>
                  </div>
                </div>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-accent)] text-[#FFFFFF] text-xs font-bold shrink-0"
                >
                  Request Programme Brochure
                </a>
              </div>
            )}

            {/* Honest Empty State (no invented courses) */}
            {!landingCoursesLoading && !landingCoursesError && filteredCourses.length === 0 && (
              <div className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-8 text-center space-y-3">
                <BookOpen className="w-9 h-9 text-[var(--sma-secondary)] mx-auto" />
                <h3 className="text-lg font-serif font-bold text-[var(--sma-active-text)]">
                  No Published Programmes Match This View
                </h3>
                <p className="text-sm text-[var(--sma-active-text-muted)] max-w-md mx-auto">
                  {selectedLevelFilter !== 'ALL'
                    ? 'Select "All Levels" above or submit an enquiry for upcoming cohorts.'
                    : 'Admissions for upcoming cohorts are open via enquiry while published schedules sync.'}
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-3">
                  {selectedLevelFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedLevelFilter('ALL')}
                      className="min-h-[44px] px-5 py-2 rounded-xl border border-[var(--sma-secondary)] text-[var(--sma-secondary)] text-xs font-bold cursor-pointer"
                    >
                      Show All Programmes
                    </button>
                  )}
                  <a
                    href="#contact"
                    className="inline-flex items-center min-h-[44px] px-5 py-2 rounded-xl bg-[var(--sma-accent)] text-[#FFFFFF] text-xs font-bold"
                  >
                    Enquire With Admissions
                  </a>
                </div>
              </div>
            )}

            {/* Live Course Cards */}
            {filteredCourses.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <article
                    key={course.id}
                    className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                  >
                    <div className="h-1.5 w-full bg-[var(--sma-secondary)]" />
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <div className="text-xs font-mono font-semibold text-[var(--sma-secondary)] dark:text-[#75A7E0] tracking-wide">
                          <span>{course.code}</span>
                          <span aria-hidden="true" className="mx-1.5 opacity-40">·</span>
                          <span>{course.level}</span>
                          <span aria-hidden="true" className="mx-1.5 opacity-40">·</span>
                          <span>{course.mode}</span>
                        </div>

                        <h3 className="text-xl font-serif font-bold text-[var(--sma-active-text)] leading-snug">
                          {course.name}
                        </h3>

                        <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed line-clamp-3">
                          {course.description}
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-[var(--sma-active-border)]">
                        <dl className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <dt className="text-[var(--sma-active-text-muted)] font-medium">Duration</dt>
                            <dd className="font-bold text-[var(--sma-active-text)] mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[var(--sma-secondary)]" />
                              <span>{course.duration}</span>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--sma-active-text-muted)] font-medium">Learning Level</dt>
                            <dd className="font-bold text-[var(--sma-active-text)] mt-0.5">{course.level}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--sma-active-text-muted)] font-medium">Tuition Fee</dt>
                            <dd className="font-bold text-[var(--sma-active-text)] mt-0.5 tabular-nums">
                              INR {Number(course.fee || 0).toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--sma-active-text-muted)] font-medium">Coordinator</dt>
                            <dd className="font-semibold text-[var(--sma-active-text)] mt-0.5 truncate" title={course.coordinator}>
                              {course.coordinator || 'SMA Faculty'}
                            </dd>
                          </div>
                        </dl>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCourseModal(course)}
                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-[var(--sma-secondary)]/50 text-[var(--sma-secondary)] dark:text-[#75A7E0] hover:bg-[var(--sma-secondary)] hover:text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Course Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnquireCourse(course.id)}
                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[var(--sma-secondary)] hover:bg-[var(--sma-secondary-hover)] text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Enquire
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 05 – WHY CHOOSE SMA? (Accent & Primary)                     */}
        {/* =================================================================== */}
        <section id="why-sma" className="bg-[var(--sma-active-surface)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-accent)] font-bold">
                Why Choose SMA?
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                Focused On Employable Skills &amp; Measurable Growth
              </h2>
              <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)]">
                Six institutional pillars guide every cohort from admission through graduation.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {WHY_CHOOSE_PILLARS.map((pillar) => {
                const IconComponent = pillar.icon;
                const isPurple = pillar.accent === 'purple';
                return (
                  <div
                    key={pillar.title}
                    className="rounded-2xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] p-6 space-y-3 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        isPurple
                          ? 'bg-[var(--sma-primary)]/15 text-[var(--sma-primary)]'
                          : 'bg-[var(--sma-accent)]/15 text-[var(--sma-accent)]'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--sma-active-text)]">{pillar.title}</h3>
                    <p className="text-sm text-[var(--sma-active-text-muted)] leading-relaxed">{pillar.description}</p>
                    <div
                      className={`h-0.5 w-10 rounded-full ${
                        isPurple ? 'bg-[var(--sma-primary)]' : 'bg-[var(--sma-accent)]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 06 – LEARNING ECOSYSTEM                                     */}
        {/* =================================================================== */}
        <section id="platform" className="bg-[var(--sma-active-bg)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-6 space-y-4">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-primary)] font-bold">
                  Digital Learning Platform
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                  The Connected Swanaya Learning Ecosystem
                </h2>
                <p className="text-base text-[var(--sma-active-text-muted)] leading-relaxed">
                  Students, faculty tutors, and academic coordinators operate within a single institutional web workspace—unifying classes, assessments, attendance, and certification.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToPortal('STUDENT')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Explore Student Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToPortal('TUTOR')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-active-surface)] hover:bg-[var(--sma-secondary)] text-[var(--sma-secondary)] dark:text-[#75A7E0] hover:text-[#FFFFFF] border border-[var(--sma-active-border)] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Tutor Environment</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl overflow-hidden bg-[#242436] border border-[var(--sma-active-border)] shadow-lg">
                  <div className="aspect-video w-full overflow-hidden">
                    {ecosystemImgError ? (
                      <div className="w-full h-full bg-[#242436] text-[#FFFFFF] flex flex-col items-center justify-center p-6 text-center space-y-2">
                        <MonitorPlay className="w-10 h-10 text-[var(--sma-secondary)]" />
                        <p className="font-serif text-lg font-bold">SMA Digital Learning Workspace</p>
                      </div>
                    ) : (
                      <img
                        src={ecosystemPlatformImg}
                        alt="Swanaya Media Academy digital learning platform showing student progress tracking, schedules, and examination tools"
                        referrerPolicy="no-referrer"
                        onError={() => setEcosystemImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Core Platform Capabilities */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {ECOSYSTEM_MODULES.map((mod) => {
                const IconComp = mod.icon;
                return (
                  <div
                    key={mod.title}
                    className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-5 flex items-start gap-4 shadow-xs"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[#FFFFFF]"
                      style={{ backgroundColor: mod.accent }}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-[var(--sma-active-text)]">{mod.title}</h3>
                      <p className="text-xs sm:text-sm text-[var(--sma-active-text-muted)] leading-relaxed">{mod.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Admin-Configured Media Showcase (preserved when enabled) */}
            {hasMediaShowcase && (
              <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#477DBB] dark:text-[#75A7E0] font-bold">
                      {frontPage.mediaSectionEyebrow || 'Academy Highlights'}
                    </p>
                    <h3 className="text-2xl font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                      {frontPage.mediaSectionTitle || 'Featured Media & Announcements'}
                    </h3>
                  </div>
                </div>

                {parsedFeaturedVideo && (
                  <div className="rounded-xl overflow-hidden bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] aspect-video max-w-4xl">
                    {parsedFeaturedVideo.kind === 'youtube' || parsedFeaturedVideo.kind === 'vimeo' ? (
                      <iframe
                        src={parsedFeaturedVideo.src}
                        title={frontPage.featuredVideoTitle || 'Swanaya Media Academy Presentation'}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : (
                      <video src={parsedFeaturedVideo.src} controls className="w-full h-full object-cover" />
                    )}
                  </div>
                )}

                {validPosters.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {validPosters.map((poster) => (
                      <button
                        key={poster.id}
                        type="button"
                        onClick={() => setSelectedPoster(poster)}
                        className="text-left rounded-xl overflow-hidden border border-[#E5E1EA] dark:border-[#38384B] bg-[#FFFFFF] dark:bg-[#1D1D2B] hover:shadow-md transition-shadow cursor-pointer"
                      >
                        {poster.imageUrl && (
                          <div className="aspect-[16/10] bg-[#F4F3F7] dark:bg-[#151521] overflow-hidden">
                            <img
                              src={poster.imageUrl}
                              alt={poster.title || 'Academy highlight'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <p className="font-bold text-sm text-[#25263A] dark:text-[#F5F3FA]">{poster.title}</p>
                          {poster.caption && (
                            <p className="text-xs text-[#555770] dark:text-[#B8B5C5] mt-1 line-clamp-2">{poster.caption}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Live Verified Student Reviews (only rendered when real records exist) */}
            {frontPage.showReviewsSection && reviews.length > 0 && (
              <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#529B78] dark:text-[#76BD99] font-bold">
                      Verified Academy Reviews
                    </p>
                    <h3 className="text-2xl font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                      Feedback From Enrolled Scholars
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReviewFormOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-[#7652A8]/40 dark:border-[#A985D6]/40 text-[#7652A8] dark:text-[#A985D6] hover:bg-[#7652A8] dark:hover:bg-[#A985D6] hover:text-[#FFFFFF] dark:hover:text-[#151521] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    <span>{isReviewFormOpen ? 'Close Review Form' : 'Share Your Feedback'}</span>
                  </button>
                </div>

                {reviewNotice && (
                  <div
                    className={`rounded-xl px-4 py-3 text-xs font-semibold ${
                      reviewNotice.type === 'success'
                        ? 'bg-[#529B78]/15 text-[#25263A] dark:text-[#F5F3FA] border border-[#529B78]/40'
                        : 'bg-[#7652A8]/10 text-[#25263A] dark:text-[#F5F3FA] border border-[#7652A8]/40'
                    }`}
                  >
                    {reviewNotice.text}
                  </div>
                )}

                {isReviewFormOpen && (
                  <form
                    onSubmit={handlePublicReviewSubmit}
                    className="rounded-xl bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] p-5 space-y-4"
                  >
                    <div className="grid sm:grid-cols-3 gap-4">
                      <input
                        type="text"
                        required
                        placeholder="Your full name"
                        value={reviewForm.authorName}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, authorName: e.target.value }))}
                        className="rounded-xl bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] px-3.5 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                      />
                      <select
                        value={reviewForm.courseId}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, courseId: e.target.value }))}
                        className="rounded-xl bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] px-3.5 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                      >
                        <option value="general-academy">General Academy Experience</option>
                        {displayCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={reviewForm.rating}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                        className="rounded-xl bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] px-3.5 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} Stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Review headline"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-xl bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] px-3.5 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                    <textarea
                      rows={3}
                      required
                      placeholder="Share your learning experience at Swanaya Media Academy"
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                      className="w-full rounded-xl bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] px-3.5 py-2.5 text-sm text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8] dark:focus:border-[#A985D6]"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] dark:hover:bg-[#8AD0AC] text-[#FFFFFF] dark:text-[#151521] text-xs font-bold cursor-pointer"
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </form>
                )}

                <div className="grid md:grid-cols-3 gap-5">
                  {reviews.slice(0, 3).map((rev) => (
                    <div key={rev.id} className="rounded-xl bg-[#F4F3F7] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] p-5 space-y-2.5">
                      <div className="flex items-center gap-1 text-[#7652A8] dark:text-[#A985D6]">
                        {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                      <h4 className="font-bold text-sm text-[#25263A] dark:text-[#F5F3FA]">{rev.title}</h4>
                      <p className="text-xs sm:text-sm text-[#555770] dark:text-[#B8B5C5] leading-relaxed line-clamp-3">
                        {rev.comment}
                      </p>
                      <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] text-xs">
                        <span className="font-bold text-[#25263A] dark:text-[#F5F3FA]">{rev.authorName}</span>
                        {rev.courseName && (
                          <span className="block text-[#477DBB] dark:text-[#75A7E0] font-medium mt-0.5">{rev.courseName}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 06B – TUTOR & FACULTY INTRODUCTION + CERTIFICATION          */}
        {/* =================================================================== */}
        <section id="faculty" className="bg-[var(--sma-active-surface)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-secondary)] dark:text-[#75A7E0] font-bold">
                  Tutor &amp; Faculty Introduction
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                  Mentors Guiding Studio &amp; Technical Mastery
                </h2>
                <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)]">
                  Industry practitioners and academic coordinators leading live lectures, project reviews, and continuous competency assessments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToPortal('TUTOR')}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-secondary)] hover:bg-[var(--sma-secondary-hover)] text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Tutor Login Portal</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {facultyList.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {facultyList.map((inst) => (
                  <div
                    key={inst.id}
                    className="rounded-2xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] p-6 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-[var(--sma-secondary)] dark:text-[#75A7E0]">
                        {inst.specialization || 'Academy Faculty'} · {inst.experience || '5+ Years'}
                      </p>
                      <h3 className="text-lg font-serif font-bold text-[var(--sma-active-text)]">
                        {inst.name}
                      </h3>
                      <p className="text-xs text-[var(--sma-active-text-muted)] leading-relaxed">
                        {inst.qualification || 'Senior Academic Mentor · Swanaya Media Academy'}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-[var(--sma-active-border)] flex items-center justify-between text-xs text-[var(--sma-active-text-muted)]">
                      <span>Status: {inst.status || 'ACTIVE'}</span>
                      <span className="font-mono font-semibold text-[var(--sma-primary)]">Verified Faculty</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] p-6 text-sm text-[var(--sma-active-text-muted)]">
                Faculty profiles are managed live from the Swanaya Admin Registry. Sign in as a Tutor or Student to view cohort allocations.
              </div>
            )}

            {/* Certification Highlight Sub-Band */}
            <div
              id="certification"
              className="rounded-2xl border border-[var(--sma-active-border)] bg-[var(--sma-active-bg)] p-7 sm:p-9 grid lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-8 space-y-3">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-accent)] font-bold">
                  Accredited Certification · Swanaya Media Enterprises
                </p>
                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--sma-active-text)]">
                  Verified Academic &amp; Professional Credentials
                </h3>
                <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)] leading-relaxed">
                  Every Major specialization and Minor track concludes with practical portfolio evaluations, scheduled examinations, and an official tamper-evident Swanaya Media Academy credential ID verifiable by employers.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[var(--sma-active-text)] pt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[var(--sma-accent)]" />
                    Digital Certificate Vault
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[var(--sma-primary)]" />
                    Verified Student Transcripts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-[var(--sma-secondary)]" />
                    Major + Minor Credit Recognition
                  </span>
                </div>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
                <button
                  type="button"
                  onClick={() => (onNavigateToRegister ? onNavigateToRegister() : onNavigateToPortal('STUDENT'))}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-[#FFFFFF] text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Register Now
                </button>
                <a
                  href="#contact"
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[var(--sma-active-border)] bg-[var(--sma-active-surface)] text-[var(--sma-active-text)] hover:border-[var(--sma-primary)] text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-colors"
                >
                  Request Programme Brochure
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 07 – PORTAL ACCESS (Student, Tutor, Admin)                  */}
        {/* =================================================================== */}
        <section id="portals" className="bg-[var(--sma-active-bg)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-primary)] font-bold">
                Portal Access
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                Dedicated Role Workspaces
              </h2>
              <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)]">
                Select your institutional role to launch the standalone authentication gateway at /login. Administrative portals enforce verified governance access.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* 1. Student Portal */}
              <div
                className="rounded-2xl text-[#FFFFFF] p-7 flex flex-col justify-between space-y-6 shadow-md"
                style={{ backgroundColor: 'var(--sma-accent)' }}
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FFFFFF]/15 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-[#FFFFFF]" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[#FFFFFF]/85">
                    Learner Workspace
                  </p>
                  <h3 className="text-2xl font-serif font-bold">Student Portal</h3>
                  <p className="text-sm text-[#FFFFFF]/95 leading-relaxed">
                    Access Major &amp; Minor course selection, timetables, study resources, online examinations, Career Readiness charts, and digital certificates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToPortal('STUDENT')}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#FFFFFF] hover:bg-[#F7F7FA] text-[#20243A] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Student Login</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* 2. Tutor Portal */}
              <div
                className="rounded-2xl text-[#FFFFFF] p-7 flex flex-col justify-between space-y-6 shadow-md"
                style={{ backgroundColor: 'var(--sma-secondary)' }}
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FFFFFF]/15 flex items-center justify-center">
                    <Video className="w-6 h-6 text-[#FFFFFF]" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[#FFFFFF]/85">
                    Faculty Workspace
                  </p>
                  <h3 className="text-2xl font-serif font-bold">Tutor Portal</h3>
                  <p className="text-sm text-[#FFFFFF]/95 leading-relaxed">
                    View allocated Major &amp; Minor courses, conduct scheduled classes, manage examinations, record attendance, and submit progress reports.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToPortal('TUTOR')}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#FFFFFF] hover:bg-[#F7F7FA] text-[#20243A] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Tutor Login</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* 3. Admin Portal */}
              <div className="rounded-2xl bg-[#20243A] dark:bg-[#202038] text-[#FFFFFF] border border-[var(--sma-primary)]/50 p-7 flex flex-col justify-between space-y-6 shadow-md">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[var(--sma-primary)]/30 border border-[var(--sma-primary)]/60 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-[#FFFFFF]" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-[#E9EAED] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[var(--sma-primary)]" />
                    <span>Restricted Institutional Control</span>
                  </p>
                  <h3 className="text-2xl font-serif font-bold">Admin Portal</h3>
                  <p className="text-sm text-[#F5F3FA]/85 leading-relaxed">
                    Authorized academic governance, Major &amp; Minor course management, theme &amp; colour console, admissions approval, and compliance records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToPortal('ADMIN')}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-[#FFFFFF] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Admin Login</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 08 – ADMISSION AND ENQUIRY ("Your Next Chapter Starts Here.")*/}
        {/* =================================================================== */}
        <section id="contact" className="bg-[var(--sma-active-bg)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--sma-active-border)]">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-start">
            {/* Left Guidance Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-accent)] font-bold">
                  Admission &amp; Enquiry
                </p>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)] leading-tight">
                  Your Next Chapter Starts Here.
                </h2>
                <p className="text-base text-[var(--sma-active-text-muted)] leading-relaxed">
                  Speak with our Admissions &amp; Academic Advisory team to receive full syllabus details, cohort schedules, and fee guidance tailored to your goals.
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[var(--sma-primary)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text-muted)]">Campus</p>
                    <p className="text-sm font-semibold text-[var(--sma-active-text)]">{campusAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[var(--sma-secondary)] dark:text-[#75A7E0] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text-muted)]">Admissions Desk</p>
                    <p className="text-sm font-semibold text-[var(--sma-active-text)]">{contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[var(--sma-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text-muted)]">Official Email</p>
                    <p className="text-sm font-semibold text-[var(--sma-active-text)] break-all">{contactEmail}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      'Hello Swanaya Media Academy Admissions, I would like information about your courses.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--sma-secondary)] hover:bg-[var(--sma-secondary-hover)] text-[#FFFFFF] text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-[#FFFFFF]" />
                    <span>Message Admissions on WhatsApp</span>
                  </a>
                )}
                <a
                  href="https://www.instagram.com/swanaya_media_acedemy_for_ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--sma-active-border)] bg-[var(--sma-active-surface)] hover:border-[var(--sma-primary)] text-[var(--sma-active-text)] text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>@swanaya_media_acedemy_for_ai</span>
                  <ArrowUpRight className="w-4 h-4 text-[var(--sma-primary)]" />
                </a>
              </div>
            </div>

            {/* Right Course Enquiry Form Card */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] p-6 sm:p-8 shadow-sm">
                <div className="mb-6 pb-4 border-b border-[var(--sma-active-border)]">
                  <h3 className="text-xl font-serif font-bold text-[var(--sma-active-text)]">Course Enquiry Form</h3>
                  <p className="text-sm text-[var(--sma-active-text-muted)] mt-1">
                    Submit your enquiry directly to our admissions pipeline.
                  </p>
                </div>

                {submitted ? (
                  <div className="rounded-xl bg-[var(--sma-accent)]/12 border border-[var(--sma-accent)]/40 p-6 text-center space-y-4">
                    <CheckCircle2 className="w-10 h-10 text-[var(--sma-accent)] mx-auto" />
                    <h4 className="text-lg font-serif font-bold text-[var(--sma-active-text)]">
                      Course Registration &amp; Confirmation Message Sent!
                    </h4>
                    <p className="text-sm text-[var(--sma-active-text-muted)] max-w-md mx-auto">
                      Thank you for registering with Swanaya Media Academy. Your application has been queued for acceptance and confirmation has been dispatched.
                    </p>
                    {enquiryConfirmation && (
                      <div className="text-left max-w-md mx-auto p-3.5 rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-[var(--sma-accent)]">
                            {enquiryConfirmation.confirmationId}
                          </span>
                          <span className="text-[var(--sma-active-text-muted)]">
                            Desk: {enquiryConfirmation.academyVerificationPhone}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--sma-active-text)]">
                          {enquiryConfirmation.messageText}
                        </p>
                        {enquiryConfirmation.whatsappUrl && (
                          <a
                            href={enquiryConfirmation.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[var(--sma-accent)] text-[#FFFFFF] text-xs font-bold uppercase"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Open WhatsApp Confirmation</span>
                          </a>
                        )}
                        <div className="pt-1 border-t border-[var(--sma-active-border)] flex items-center justify-between text-[11px]">
                          <span className="text-[var(--sma-active-text-muted)]">
                            Contact: <strong className="font-mono">{enquiryConfirmation.recipientPhone}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingConfirmPhone((prev) => !prev)}
                            className="text-[var(--sma-primary)] font-semibold hover:underline cursor-pointer"
                          >
                            {editingConfirmPhone ? 'Cancel' : 'Update Contact Number'}
                          </button>
                        </div>
                        {editingConfirmPhone && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="tel"
                              value={confirmPhoneInput}
                              onChange={(e) => setConfirmPhoneInput(e.target.value)}
                              placeholder="+91 98765 43210"
                              className="flex-1 bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--sma-active-text)]"
                            />
                            <button
                              type="button"
                              disabled={resendingConfirm}
                              onClick={() => void handleUpdateLandingConfirmNumber()}
                              className="px-3 py-1.5 rounded-lg bg-[var(--sma-primary)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              {resendingConfirm ? 'Sending...' : 'Update & Resend'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setEnquiryConfirmation(null);
                      }}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[var(--sma-accent)] text-[#FFFFFF] text-xs font-bold cursor-pointer"
                    >
                      Submit Another Enquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEnquirySubmit} className="space-y-4">
                    {submitError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-rose-500/10 border border-rose-500/35 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="enquiry-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text)]">
                          Name *
                        </label>
                        <input
                          id="enquiry-name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Your full name"
                          className="w-full min-h-[44px] rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] px-4 py-2.5 text-sm text-[var(--sma-active-text)] placeholder-[var(--sma-active-text-muted)]/70 focus:outline-none transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="enquiry-email" className="block text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text)]">
                          Email *
                        </label>
                        <input
                          id="enquiry-email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="you@example.com"
                          className="w-full min-h-[44px] rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] px-4 py-2.5 text-sm text-[var(--sma-active-text)] placeholder-[var(--sma-active-text-muted)]/70 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="enquiry-phone" className="block text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text)]">
                          Contact Number *
                        </label>
                        <input
                          id="enquiry-phone"
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+91 98765 43210"
                          className="w-full min-h-[44px] rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] px-4 py-2.5 text-sm text-[var(--sma-active-text)] placeholder-[var(--sma-active-text-muted)]/70 focus:outline-none transition-colors"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="enquiry-course" className="block text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text)]">
                          Programme of Interest *
                        </label>
                        <select
                          id="enquiry-course"
                          value={formData.courseId}
                          onChange={(e) => setFormData((prev) => ({ ...prev, courseId: e.target.value }))}
                          className="w-full min-h-[44px] rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] px-4 py-2.5 text-sm text-[var(--sma-active-text)] focus:outline-none transition-colors"
                        >
                          {displayCourses.length === 0 ? (
                            <option value="general-enquiry">General Programme Enquiry</option>
                          ) : (
                            displayCourses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.name} ({course.duration})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="enquiry-message" className="block text-xs font-bold uppercase tracking-wider text-[var(--sma-active-text)]">
                        Message
                      </label>
                      <textarea
                        id="enquiry-message"
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                        placeholder="Share your learning goals, background, or preferred study schedule..."
                        className="w-full rounded-xl bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] px-4 py-3 text-sm text-[var(--sma-active-text)] placeholder-[var(--sma-active-text-muted)]/70 focus:outline-none transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[var(--sma-accent)] hover:bg-[var(--sma-accent-hover)] disabled:opacity-70 text-[#FFFFFF] text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmitting ? 'Submitting Enquiry...' : 'Submit Enquiry'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* SECTION 09 – FAQ                                                    */}
        {/* =================================================================== */}
        <section id="faq" className="bg-[var(--sma-active-surface)] py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-[var(--sma-primary)] font-bold">
                Frequently Asked Questions
              </p>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--sma-active-text)]">
                Clear Answers Before You Enrol
              </h2>
              <p className="text-sm sm:text-base text-[var(--sma-active-text-muted)]">
                Everything you need to know about SMA programmes, admissions, examinations, certification, and online learning.
              </p>
            </div>

            <div className="space-y-3">
              {SMA_FAQS.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`rounded-2xl border transition-colors ${
                      isOpen
                        ? 'border-[var(--sma-primary)]/45 bg-[var(--sma-active-bg)]'
                        : 'border-[var(--sma-active-border)] bg-[var(--sma-active-surface)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? '' : faq.id)}
                      aria-expanded={isOpen}
                      className="w-full px-6 py-4 min-h-[56px] flex items-center justify-between gap-4 text-left cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[var(--sma-secondary)] dark:text-[#75A7E0]">
                          {faq.category}
                        </span>
                        <span className="block text-base font-bold text-[var(--sma-active-text)]">{faq.question}</span>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-[var(--sma-primary)] shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm text-[var(--sma-active-text-muted)] leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* =================================================================== */}
      {/* SECTION 10 – FOOTER                                                 */}
      {/* =================================================================== */}
      <footer
        className="text-[#FFFFFF] pt-14 pb-8 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: 'var(--sma-secondary)' }}
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Branding */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold text-sm text-[#FFFFFF]"
                  style={{
                    background: 'linear-gradient(135deg, var(--sma-primary), var(--sma-secondary))',
                  }}
                >
                  SMA
                </div>
                <div>
                  <p className="font-serif font-bold text-base text-[#FFFFFF]">Swanaya Media Academy</p>
                  <p className="text-xs text-[#E9EAED]/80">A Division of Swanaya Media Enterprises</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[#E9EAED]/80 leading-relaxed">
                Professional education, practical industry projects, and verified digital certification powered by Swanaya Media Enterprises.
              </p>
              <div className="flex items-center gap-2.5 pt-1">
                {[
                  { label: 'LinkedIn', href: '#contact', external: false },
                  { label: 'Instagram', href: 'https://www.instagram.com/swanaya_media_acedemy_for_ai/', external: true },
                  { label: 'YouTube', href: '#contact', external: false },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    {...(social.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="px-3 py-1.5 rounded-lg bg-[#FFFFFF]/10 hover:bg-[var(--sma-primary)] text-xs font-semibold text-[#FFFFFF] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Navigation */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--sma-accent)] bg-[#FFFFFF] inline-block px-2 py-0.5 rounded font-bold">
                Quick Navigation
              </h3>
              <ul className="space-y-2 text-sm text-[#E9EAED]/90">
                <li>
                  <a href="#home" className="hover:text-[#FFFFFF] transition-colors">Home</a>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#FFFFFF] transition-colors">About Us</a>
                </li>
                <li>
                  <a href="#courses" className="hover:text-[#FFFFFF] transition-colors">Courses</a>
                </li>
                <li>
                  <a href="#platform" className="hover:text-[#FFFFFF] transition-colors">Learning Platform</a>
                </li>
                <li>
                  <a href="#portals" className="hover:text-[#FFFFFF] transition-colors">Portal Access</a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-[#FFFFFF] transition-colors">FAQ</a>
                </li>
              </ul>
            </div>

            {/* Academic Programmes */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFFFFF] font-bold">
                Academic Programmes
              </h3>
              {displayCourses.length > 0 ? (
                <ul className="space-y-2 text-sm text-[#E9EAED]/90">
                  {displayCourses.slice(0, 5).map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseModal(course)}
                        className="text-left hover:text-[#FFFFFF] transition-colors cursor-pointer line-clamp-1"
                      >
                        {course.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#E9EAED]/80">
                  <a href="#courses" className="hover:text-[#FFFFFF] underline">
                    View Academic Programmes
                  </a>
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFFFFF] font-bold">
                Contact Information
              </h3>
              <ul className="space-y-2.5 text-sm text-[#E9EAED]/90">
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#FFFFFF] shrink-0 mt-0.5" />
                  <span>{campusAddress}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#FFFFFF] shrink-0" />
                  <span>{contactPhone}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#FFFFFF] shrink-0" />
                  <span className="break-all">{contactEmail}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[#FFFFFF]/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#E9EAED]/80">
            <p>
              &copy; {new Date().getFullYear()} Swanaya Media Academy — A Division of Swanaya Media Enterprises. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigateToPortal('STUDENT')}
                className="hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                Student Portal
              </button>
              <button
                type="button"
                onClick={() => onNavigateToPortal('TUTOR')}
                className="hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                Tutor Portal
              </button>
              <button
                type="button"
                onClick={() => onNavigateToPortal('ADMIN')}
                className="hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* =================================================================== */}
      {/* COURSE DETAILS MODAL                                                */}
      {/* =================================================================== */}
      {selectedCourseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-modal-title"
          className="fixed inset-0 z-50 bg-[#151521]/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div
              className="px-6 py-5 text-[#FFFFFF] flex items-start justify-between gap-4"
              style={{
                background: 'linear-gradient(90deg, var(--sma-primary), var(--sma-secondary))',
              }}
            >
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#F4F3F7]">
                  {selectedCourseModal.code} · {selectedCourseModal.level} · {selectedCourseModal.mode}
                </p>
                <h3 id="course-modal-title" className="text-xl sm:text-2xl font-serif font-bold mt-1">
                  {selectedCourseModal.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourseModal(null)}
                aria-label="Close course details"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 flex items-center justify-center text-[#FFFFFF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm text-[var(--sma-active-text)]">
              <p className="leading-relaxed text-[var(--sma-active-text-muted)]">{selectedCourseModal.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--sma-active-bg)] rounded-xl p-4 border border-[var(--sma-active-border)]">
                <div>
                  <span className="text-xs text-[var(--sma-active-text-muted)] block">Duration</span>
                  <span className="font-bold">{selectedCourseModal.duration}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--sma-active-text-muted)] block">Level</span>
                  <span className="font-bold">{selectedCourseModal.level}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--sma-active-text-muted)] block">Tuition Fee</span>
                  <span className="font-bold tabular-nums">INR {Number(selectedCourseModal.fee || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--sma-active-text-muted)] block">Coordinator</span>
                  <span className="font-bold">{selectedCourseModal.coordinator || 'SMA Faculty'}</span>
                </div>
              </div>

              {selectedCourseModal.eligibility && (
                <div>
                  <h4 className="font-bold text-[var(--sma-active-text)] mb-1">Eligibility Criteria</h4>
                  <p className="text-[var(--sma-active-text-muted)]">{selectedCourseModal.eligibility}</p>
                </div>
              )}

              {Array.isArray(selectedCourseModal.learningObjectives) &&
                selectedCourseModal.learningObjectives.length > 0 && (
                  <div>
                    <h4 className="font-bold text-[var(--sma-active-text)] mb-2">Key Learning Objectives</h4>
                    <ul className="space-y-1.5">
                      {selectedCourseModal.learningObjectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[var(--sma-active-text-muted)]">
                          <CheckCircle2 className="w-4 h-4 text-[var(--sma-accent)] shrink-0 mt-0.5" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {Array.isArray(selectedCourseModal.careerOutcomes) &&
                selectedCourseModal.careerOutcomes.length > 0 && (
                  <div>
                    <h4 className="font-bold text-[var(--sma-active-text)] mb-2">Career Outcomes</h4>
                    <ul className="space-y-1.5">
                      {selectedCourseModal.careerOutcomes.map((outcome, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[var(--sma-active-text-muted)]">
                          <Sparkles className="w-4 h-4 text-[var(--sma-primary)] shrink-0 mt-0.5" />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            <div className="px-6 py-4 bg-[var(--sma-active-bg)] border-t border-[var(--sma-active-border)] flex flex-wrap items-center justify-end gap-3">
              {onNavigateToCourseSelection && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedCourseModal.id;
                    setSelectedCourseModal(null);
                    onNavigateToCourseSelection(id);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--sma-secondary)] text-[var(--sma-secondary)] dark:text-[#75A7E0] text-xs font-bold cursor-pointer"
                >
                  Open Full Curriculum View
                </button>
              )}
              <button
                type="button"
                onClick={() => handleEnquireCourse(selectedCourseModal.id)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[var(--sma-accent)] hover:bg-[var(--sma-accent-hover)] text-[#FFFFFF] text-xs font-bold cursor-pointer"
              >
                Enquire For This Programme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* POSTER PREVIEW LIGHTBOX (if admin configured posters)               */}
      {/* =================================================================== */}
      {selectedPoster && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#151521]/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-2xl w-full rounded-2xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] overflow-hidden shadow-2xl">
            {selectedPoster.imageUrl && (
              <img
                src={selectedPoster.imageUrl}
                alt={selectedPoster.title || 'Academy announcement'}
                referrerPolicy="no-referrer"
                className="w-full max-h-[65vh] object-contain bg-[#151521]"
              />
            )}
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-[#25263A] dark:text-[#F5F3FA]">{selectedPoster.title}</h4>
                {selectedPoster.caption && (
                  <p className="text-sm text-[#555770] dark:text-[#B8B5C5] mt-0.5">{selectedPoster.caption}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoster(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#7652A8] dark:bg-[#A985D6] text-[#FFFFFF] dark:text-[#151521] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
