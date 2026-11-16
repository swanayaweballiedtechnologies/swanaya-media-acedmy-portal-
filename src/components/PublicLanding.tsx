/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Star, CheckCircle2, Phone, Mail, MapPin, Sparkles, Send, 
  GraduationCap, Code, Video, Globe, Terminal, Calendar, User, ExternalLink, ArrowUpRight, AlertCircle, X, MessageSquarePlus, Film,
  Lock, LogIn, Eye, EyeOff, ArrowRight, UserPlus
} from 'lucide-react';
import { SwanayaDatabase, Course, AcademyReview, FrontPageConfig, FrontPagePosterItem, INITIAL_FRONT_PAGE_CONFIG, AcademySettings, User as SwanayaUser } from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { applyDocumentFavicon } from '../utils/favicon';
import { parseFrontPageVideoUrl } from '../utils/mediaHelpers';

interface PublicLandingProps {
  onNavigateToPortal: () => void;
  onNavigateToRegister?: () => void;
  onNavigateToCourseSelection?: (courseId?: string) => void;
  onLoginSuccess?: (user: SwanayaUser) => void;
  activeUser?: SwanayaUser | null;
  courses: Course[];
  onApplyLead: (leadData: { name: string; email: string; phone: string; courseId: string; qualification: string; preferredBatch: string; message: string }) => void;
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
    posters:
      Array.isArray(safe.posters)
        ? safe.posters
        : INITIAL_FRONT_PAGE_CONFIG.posters,
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

export default function PublicLanding({
  onNavigateToPortal,
  onNavigateToRegister,
  onNavigateToCourseSelection,
  onLoginSuccess,
  activeUser,
  courses,
  onApplyLead
}: PublicLandingProps) {
  const [frontPage, setFrontPage] = useState<FrontPageConfig>(() =>
    mergeFrontPage(SwanayaDatabase.get<FrontPageConfig>('frontPageConfig'))
  );
  const [academySettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>('settings'));
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [selectedLandingBlog, setSelectedLandingBlog] = useState<any | null>(null);
  const [reviews, setReviews] = useState<AcademyReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    authorName: '',
    courseId: courses[0]?.id || 'general-academy',
    rating: 5,
    title: '',
    comment: ''
  });
  const [reviewHoverStar, setReviewHoverStar] = useState<number | null>(null);
  const [reviewNotice, setReviewNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const localSaved = SwanayaDatabase.get<any[]>('blogs');
        const localPublished = Array.isArray(localSaved)
          ? localSaved.filter((b) => b.status === 'PUBLISHED')
          : [];

        let cloudPublished: any[] = [];
        try {
          const fetched = await academyService.getBlogs(true);
          if (Array.isArray(fetched)) {
            cloudPublished = fetched;
          }
        } catch {
          // Graceful fallback to local published posts
        }

        const mergedMap = new Map<string, any>();
        localPublished.forEach((b) => b?.id && mergedMap.set(b.id, b));
        cloudPublished.forEach((b) => b?.id && mergedMap.set(b.id, b));
        const combined = Array.from(mergedMap.values()).sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
        setBlogs(combined.slice(0, 6));
      } finally {
        setLoadingBlogs(false);
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
      } finally {
        setLoadingReviews(false);
      }
    };
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
    fetchFrontPage();
    fetchBlogs();
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: courses[0]?.id || 'c-1',
    qualification: '',
    preferredBatch: 'ADWDVC-2026-A',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Side-position login drawer state
  const [isSideLoginOpen, setIsSideLoginOpen] = useState(false);
  const [sideLoginInput, setSideLoginInput] = useState('');
  const [sidePassword, setSidePassword] = useState('');
  const [showSidePassword, setShowSidePassword] = useState(false);
  const [sideLoginError, setSideLoginError] = useState('');
  const [sideLoginLoading, setSideLoginLoading] = useState(false);

  const handleSideGoogleLogin = async () => {
    setSideLoginError('');
    setSideLoginLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      let userProfile = await academyService.getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        userProfile = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'New Scholar',
          email: firebaseUser.email,
          role: 'STUDENT',
          status: 'ACTIVE'
        };
        await academyService.createUserProfile(firebaseUser.uid, userProfile);
      }

      setIsSideLoginOpen(false);
      if (onLoginSuccess) {
        onLoginSuccess(userProfile as SwanayaUser);
      } else {
        onNavigateToPortal();
      }
    } catch (err: any) {
      setSideLoginError('Google login failed: ' + (err?.message || 'Please try again.'));
    } finally {
      setSideLoginLoading(false);
    }
  };

  const handleSideCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSideLoginError('');
    setSideLoginLoading(true);

    setTimeout(() => {
      const usersList = SwanayaDatabase.get<SwanayaUser[]>('users') || [];
      const cleanInput = sideLoginInput.trim().toLowerCase();
      const found = usersList.find((u) =>
        (u.username && u.username.toLowerCase() === cleanInput) ||
        u.email.toLowerCase() === cleanInput ||
        u.name.toLowerCase() === cleanInput
      );

      if (found) {
        if (found.status === 'INACTIVE') {
          setSideLoginError('This account has been deactivated. Please contact admin.');
          setSideLoginLoading(false);
          return;
        }
        setSideLoginLoading(false);
        setIsSideLoginOpen(false);
        if (onLoginSuccess) {
          onLoginSuccess(found);
        } else {
          onNavigateToPortal();
        }
      } else {
        setSideLoginError('Invalid credentials. Check your username or email address.');
        setSideLoginLoading(false);
      }
    }, 350);
  };

  const handlePublicReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewNotice(null);

    const authorName = reviewForm.authorName.trim();
    const title = reviewForm.title.trim();
    const comment = reviewForm.comment.trim();
    if (!authorName || !title || !comment) {
      setReviewNotice({ type: 'error', text: 'Please fill in your name, review headline, and feedback.' });
      return;
    }

    const matchedCourse = courses.find((c) => c.id === reviewForm.courseId);
    const courseName = matchedCourse?.name || 'General Academy Experience';
    const nowIso = new Date().toISOString();
    const newReview: AcademyReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorId: auth.currentUser?.uid || `guest-${Date.now()}`,
      authorName,
      authorRole: 'Student / Visitor',
      courseId: matchedCourse?.id || 'general-academy',
      courseName,
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
      const updated = [newReview, ...existingLocal];
      SwanayaDatabase.set('reviews', updated);
      setReviews((prev) => [newReview, ...prev]);
      setReviewForm({
        authorName: '',
        courseId: courses[0]?.id || 'general-academy',
        rating: 5,
        title: '',
        comment: ''
      });
      setIsReviewFormOpen(false);
      setReviewNotice({ type: 'success', text: 'Thank you. Your review has been published.' });
    } catch {
      setReviewNotice({ type: 'error', text: 'Could not submit review right now. Please try again.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!formData.name || !formData.email || !formData.phone) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadData: formData,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Submission failed. Please try again.');
        setIsSubmitting(false);
        return;
      }

      onApplyLead(formData);
      setSubmitted(true);
      setIsSubmitting(false);

      setTimeout(() => {
        setSubmitted(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          courseId: courses[0]?.id || 'c-1',
          qualification: '',
          preferredBatch: 'ADWDVC-2026-A',
          message: ''
        });
      }, 4000);
    } catch {
      setSubmitError('Network error submitting proposal. Please try again.');
      setIsSubmitting(false);
    }
  };

  const courseIcons = (code: string) => {
    if (code.includes('WD')) return <Code className="w-6 h-6 text-amber-400" />;
    if (code.includes('DM')) return <Globe className="w-6 h-6 text-amber-400" />;
    if (code.includes('BC')) return <Terminal className="w-6 h-6 text-amber-400" />;
    return <Video className="w-6 h-6 text-amber-400" />;
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Premium Top Bar Contract (1 row, 3 zones) */}
      <header className="sticky top-0 z-50 bg-[#0A0D14]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            {headerLogoSrc && !logoLoadError && (
              <img
                src={headerLogoSrc}
                alt={`${frontPage.brandWordmark} logo`}
                referrerPolicy="no-referrer"
                onError={() => setLogoLoadError(true)}
                className="h-8 w-8 rounded-md object-contain bg-slate-900/70 border border-slate-800 p-0.5 shrink-0"
              />
            )}
            <span className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 font-serif">
              {frontPage.brandWordmark}
            </span>
            <span className="text-[10px] tracking-widest text-amber-400 font-sans uppercase border-l border-slate-700 pl-3">
              {frontPage.brandSubtitle}
            </span>
          </div>

          {/* Zone 2: Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {hasMediaShowcase && (
              <a href="#showcase" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Showcase</a>
            )}
            <a href="#courses" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Programs</a>
            {onNavigateToCourseSelection && (
              <button
                type="button"
                onClick={() => onNavigateToCourseSelection()}
                className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer uppercase tracking-wider"
              >
                Select Course
              </button>
            )}
            {frontPage.showReviewsSection && (
              <a href="#reviews" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Reviews</a>
            )}
            {frontPage.showBlogSection && (
              <a href="#blog" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Insights</a>
            )}
            {frontPage.showAdmissionsSection && (
              <a href="#admissions" className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0">Admissions</a>
            )}
          </nav>

          {/* Zone 3: Direct Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => onNavigateToPortal()}
              className="px-4 py-2 text-xs font-semibold tracking-wider uppercase text-[#0A0D14] bg-gradient-to-r from-amber-400 to-amber-200 rounded hover:from-amber-300 hover:to-amber-100 transition-all cursor-pointer shadow-md shadow-amber-500/10 whitespace-nowrap"
            >
              {frontPage.portalButtonLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden py-24 md:py-32 border-b border-slate-900 bg-radial-[at_top_right] from-amber-500/5 via-transparent to-transparent">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Info */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>{frontPage.heroEyebrow}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white font-serif leading-tight text-wrap">
                {frontPage.heroHeadlinePrefix} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                  {frontPage.heroHeadlineHighlight}
                </span> <br />
                {frontPage.heroHeadlineSuffix}
              </h1>
              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                {frontPage.heroDescription}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {frontPage.showAdmissionsSection && (
                  <a 
                    href="#admissions" 
                    className="px-6 py-3 text-center text-xs font-bold tracking-wider uppercase bg-amber-500 hover:bg-amber-400 text-black rounded transition-colors whitespace-nowrap"
                  >
                    {frontPage.heroPrimaryCta}
                  </a>
                )}
                {onNavigateToCourseSelection ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToCourseSelection()}
                    className="px-6 py-3 text-center text-xs font-bold tracking-wider uppercase bg-slate-800/80 hover:bg-slate-700/80 text-white rounded border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {frontPage.heroSecondaryCta}
                  </button>
                ) : (
                  <a 
                    href="#courses" 
                    className="px-6 py-3 text-center text-xs font-bold tracking-wider uppercase bg-slate-800/80 hover:bg-slate-700/80 text-white rounded border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    {frontPage.heroSecondaryCta}
                  </a>
                )}
              </div>
            </div>

            {/* Right Display Card - Premium visual details */}
            <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-lg p-8 relative overflow-hidden backdrop-blur-sm shadow-xl shadow-black/40">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
              <h3 className="text-lg font-serif font-semibold text-amber-400 mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                {frontPage.cohortCardTitle}
              </h3>
              <ul className="space-y-4">
                {frontPage.cohortItems.map((cohort, idx) => (
                  <li
                    key={idx}
                    className={`flex justify-between items-start text-xs ${
                      idx < frontPage.cohortItems.length - 1 ? 'border-b border-slate-800/50 pb-2' : ''
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{cohort.title}</p>
                      <p className="text-slate-500">{cohort.subtitle}</p>
                    </div>
                    <span className="text-amber-500 font-medium shrink-0">{cohort.badgeText}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                <span>{frontPage.cohortLocationLabel}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>

          </div>
        </section>

        {/* POSTERS & FEATURED VIDEO SHOWCASE */}
        {hasMediaShowcase && (
          <section id="showcase" className="py-20 border-b border-slate-900 bg-slate-950/40">
            <div className="max-w-7xl mx-auto px-6 space-y-12">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">
                  {frontPage.mediaSectionEyebrow}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">
                  {frontPage.mediaSectionTitle}
                </h2>
                <p className="text-slate-400 text-sm">{frontPage.mediaSectionSubtitle}</p>
              </div>

              {parsedFeaturedVideo && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <div className="aspect-video w-full bg-black">
                    {parsedFeaturedVideo.kind === 'youtube' || parsedFeaturedVideo.kind === 'vimeo' ? (
                      <iframe
                        src={parsedFeaturedVideo.src}
                        title={frontPage.featuredVideoTitle || 'Featured Academy Video'}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={parsedFeaturedVideo.src}
                        poster={frontPage.featuredVideoPosterUrl || undefined}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {(frontPage.featuredVideoTitle || frontPage.featuredVideoCaption) && (
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
                      <div className="space-y-1">
                        {frontPage.featuredVideoTitle && (
                          <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                            <Film className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{frontPage.featuredVideoTitle}</span>
                          </h3>
                        )}
                        {frontPage.featuredVideoCaption && (
                          <p className="text-xs text-slate-400 leading-relaxed">{frontPage.featuredVideoCaption}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {validPosters.length > 0 && (
                <div
                  className={`grid grid-cols-1 ${
                    validPosters.length === 1
                      ? 'max-w-2xl mx-auto'
                      : validPosters.length === 2
                      ? 'md:grid-cols-2'
                      : 'md:grid-cols-2 lg:grid-cols-3'
                  } gap-6`}
                >
                  {validPosters.map((poster) => (
                    <article
                      key={poster.id}
                      className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between group hover:border-amber-500/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPoster(poster)}
                        className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden cursor-pointer text-left"
                      >
                        {poster.imageUrl ? (
                          <img
                            src={poster.imageUrl}
                            alt={poster.title || 'Academy promotional poster'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <Film className="w-8 h-8 text-amber-400/50" />
                          </div>
                        )}
                      </button>

                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <h3 className="text-base font-serif font-bold text-white group-hover:text-amber-300 transition-colors">
                            {poster.title}
                          </h3>
                          {poster.caption && (
                            <p className="text-xs text-slate-400 leading-relaxed">{poster.caption}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => setSelectedPoster(poster)}
                            className="text-xs font-medium text-slate-300 hover:text-amber-300 cursor-pointer"
                          >
                            View Full Poster
                          </button>
                          {poster.ctaLabel && poster.ctaUrl && (
                            <a
                              href={poster.ctaUrl}
                              target={poster.ctaUrl.startsWith('http') ? '_blank' : undefined}
                              rel={poster.ctaUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap"
                            >
                              <span>{poster.ctaLabel}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {selectedPoster && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPoster(null)}
          >
            <div
              className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="text-sm font-serif font-bold text-white truncate">{selectedPoster.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPoster(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {selectedPoster.imageUrl && (
                  <img
                    src={selectedPoster.imageUrl}
                    alt={selectedPoster.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[70vh] object-contain rounded-lg bg-black"
                  />
                )}
                {selectedPoster.caption && (
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedPoster.caption}</p>
                )}
                {selectedPoster.ctaLabel && selectedPoster.ctaUrl && (
                  <div className="pt-2">
                    <a
                      href={selectedPoster.ctaUrl}
                      onClick={() => {
                        if (selectedPoster.ctaUrl?.startsWith('#')) setSelectedPoster(null);
                      }}
                      target={selectedPoster.ctaUrl.startsWith('http') ? '_blank' : undefined}
                      rel={selectedPoster.ctaUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded"
                    >
                      <span>{selectedPoster.ctaLabel}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FEATURED PROGRAMS SECTION */}
        <section id="courses" className="py-20 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">{frontPage.programsEyebrow}</span>
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">{frontPage.programsTitle}</h2>
            <p className="text-slate-400 text-sm">{frontPage.programsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course) => (
              <div key={course.id} className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-8 hover:border-amber-500/20 transition-all flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                      {courseIcons(course.code)}
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold px-2 py-0.5 bg-amber-400/5 rounded border border-amber-500/10">
                      {course.code} · {course.level}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-100 group-hover:text-amber-300 transition-colors font-serif">
                    {course.name}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    {course.description}
                  </p>
                  
                  {/* Unboxed Metadata (Zero Pill Compliance) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-800/40">
                    <span>Duration: {course.duration}</span>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span>Mode: {course.mode}</span>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span className="text-amber-500 font-semibold font-mono">₹{Number(course.fee || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/40 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Coordinator: {course.coordinator}</span>
                  {onNavigateToCourseSelection ? (
                    <button
                      type="button"
                      onClick={() => onNavigateToCourseSelection(course.id)}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Select Course &amp; Options →
                    </button>
                  ) : (
                    <a href="#admissions" className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                      Enroll Now →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {onNavigateToCourseSelection && (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => onNavigateToCourseSelection()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
              >
                <span>Open Dedicated Course Selection Page</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* PHILOSOPHY & WHY SWANAYA */}
        <section id="philosophy" className="py-20 bg-slate-950/80 border-y border-slate-900">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Visual Block */}
            <div className="space-y-6">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">{frontPage.philosophyEyebrow}</span>
              <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">{frontPage.philosophyTitle}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {frontPage.philosophyDescription}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                {frontPage.philosophyPillars.map((pillar, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{pillar.title}</h4>
                      <p className="text-slate-500 text-xs mt-1">{pillar.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial Panel */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg relative">
              <span className="text-6xl text-amber-500/20 font-serif absolute top-4 left-4">“</span>
              <div className="relative space-y-6">
                <p className="text-slate-300 text-sm font-serif italic leading-relaxed">
                  "{frontPage.testimonialQuote}"
                </p>
                <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
                  <img 
                    src={frontPage.testimonialAvatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind'} 
                    alt={frontPage.testimonialAuthor} 
                    className="w-10 h-10 rounded-full border border-slate-700 bg-slate-850"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{frontPage.testimonialAuthor}</p>
                    <p className="text-[10px] text-slate-500">{frontPage.testimonialRole}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ACADEMY REVIEWS & RATINGS SECTION */}
        {frontPage.showReviewsSection && (
        <section id="reviews" className="py-20 max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3 max-w-2xl">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">{frontPage.reviewsEyebrow}</span>
              <h2 className="text-2xl md:text-3xl font-bold font-serif text-white">{frontPage.reviewsTitle}</h2>
              <p className="text-slate-400 text-sm">
                {frontPage.reviewsSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono tabular-nums border border-slate-800 bg-slate-900/60 px-3.5 py-2 rounded">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-white">
                    {(reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)}
                  </span>
                  <span className="text-slate-500">/ 5.0 · {reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsReviewFormOpen((prev) => !prev);
                  setReviewNotice(null);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>{isReviewFormOpen ? 'Close Review Form' : 'Write a Review'}</span>
              </button>
            </div>
          </div>

          {reviewNotice && (
            <div
              className={`mb-6 p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
                reviewNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {reviewNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{reviewNotice.text}</span>
            </div>
          )}

          {isReviewFormOpen && (
            <form
              onSubmit={handlePublicReviewSubmit}
              className="mb-10 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="landing-review-name" className="text-xs font-medium text-slate-300 block">
                    Your Name
                  </label>
                  <input
                    id="landing-review-name"
                    type="text"
                    required
                    maxLength={150}
                    value={reviewForm.authorName}
                    onChange={(e) => setReviewForm({ ...reviewForm, authorName: e.target.value })}
                    placeholder="Full name"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="landing-review-course" className="text-xs font-medium text-slate-300 block">
                    Program Reviewed
                  </label>
                  <select
                    id="landing-review-course"
                    value={reviewForm.courseId}
                    onChange={(e) => setReviewForm({ ...reviewForm, courseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="general-academy">General Academy Experience</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300 block">Star Rating</span>
                  <div className="flex items-center gap-1 pt-1">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const active = starVal <= (reviewHoverStar ?? reviewForm.rating);
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, rating: starVal })}
                          onMouseEnter={() => setReviewHoverStar(starVal)}
                          onMouseLeave={() => setReviewHoverStar(null)}
                          aria-label={`Rate ${starVal} out of 5 stars`}
                          className="p-1 cursor-pointer"
                        >
                          <Star className={`w-5 h-5 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-xs font-mono tabular-nums text-amber-400 font-semibold">
                      {(reviewHoverStar ?? reviewForm.rating)}.0 / 5.0
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="landing-review-title" className="text-xs font-medium text-slate-300 block">
                  Review Headline
                </label>
                <input
                  id="landing-review-title"
                  type="text"
                  required
                  maxLength={160}
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  placeholder="Summarize your experience"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="landing-review-comment" className="text-xs font-medium text-slate-300 block">
                  Detailed Feedback
                </label>
                <textarea
                  id="landing-review-comment"
                  required
                  rows={3}
                  maxLength={2000}
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="Share thoughts on workshops, assignments, instructors, or studio sessions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewFormOpen(false)}
                  className="px-4 py-2 text-xs text-slate-300 border border-slate-700 rounded hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          )}

          {loadingReviews ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-xl h-44 animate-pulse" />
              ))}
            </div>
          ) : reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.slice(0, 6).map((rev) => (
                <article key={rev.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= Math.round(rev.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-mono tabular-nums text-amber-400 font-semibold">
                        {Number(rev.rating).toFixed(1)}
                      </span>
                    </div>
                    <h3 className="text-base font-serif font-bold text-white leading-snug">{rev.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{rev.comment}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-300 truncate">{rev.authorName}</span>
                    <span className="text-[11px] truncate">{rev.courseName}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-10 px-6 text-center bg-slate-900/30 border border-slate-800 rounded-xl space-y-3">
              <Star className="w-8 h-8 text-amber-400/70 mx-auto" />
              <p className="text-sm font-medium text-slate-200">No academy reviews published yet.</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Students and alumni can post course ratings and feedback here or inside the Enterprise Portal.
              </p>
            </div>
          )}
        </section>
        )}

        {/* ACADEMY BLOG & INSIGHTS */}
        {frontPage.showBlogSection && (
        <section id="blog" className="py-24 border-t border-slate-900 bg-slate-950/50">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div className="space-y-4 max-w-2xl">
                <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">{frontPage.blogEyebrow}</span>
                <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">{frontPage.blogTitle}</h2>
                <p className="text-slate-400 text-sm">{frontPage.blogSubtitle}</p>
              </div>
              <button 
                onClick={() => onNavigateToPortal()}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 uppercase tracking-widest flex items-center gap-2 transition-colors border-b border-amber-400/30 pb-1"
              >
                View All Articles <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {loadingBlogs ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-xl aspect-[4/5] animate-pulse"></div>
                ))
              ) : blogs.length > 0 ? (
                blogs.map((blog) => (
                  <article key={blog.id} className="group bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col h-full">
                    <div className="aspect-video relative overflow-hidden">
                      {blog.thumbnailUrl ? (
                        <img src={blog.thumbnailUrl} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-slate-800" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        <span className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                          {blog.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex-grow space-y-4 flex flex-col">
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {blog.createdAt?.substring(0, 10)}</span>
                        <span aria-hidden="true">|</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {blog.authorName}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors leading-tight line-clamp-2 font-serif">
                        {blog.title}
                      </h3>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                        {blog.excerpt}
                      </p>
                      <div className="pt-4 mt-auto">
                        <button 
                          type="button"
                          onClick={() => setSelectedLandingBlog(blog)}
                          className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all cursor-pointer"
                        >
                          Read Full Insight <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="col-span-full py-12 text-center bg-slate-900/20 border border-dashed border-slate-800 rounded-xl space-y-3">
                  <p className="text-slate-500 text-sm italic font-serif">Academy insights are currently being curated. Check back soon.</p>
                  <button
                    type="button"
                    onClick={() => onNavigateToPortal()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:underline cursor-pointer"
                  >
                    Sign in to write in the Media Hub <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {selectedLandingBlog && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-amber-400 truncate">
                  {selectedLandingBlog.contentType || 'Blog Article'} · {selectedLandingBlog.category}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLandingBlog(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 sm:p-8 space-y-5">
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-snug">
                  {selectedLandingBlog.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>By {selectedLandingBlog.authorName || 'Academy Contributor'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {String(selectedLandingBlog.createdAt || '').substring(0, 10)}
                  </span>
                </div>
                {selectedLandingBlog.thumbnailUrl && (
                  <img
                    src={selectedLandingBlog.thumbnailUrl}
                    alt={selectedLandingBlog.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-80 object-cover rounded-lg border border-slate-800"
                  />
                )}
                <div className="text-sm sm:text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedLandingBlog.content}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADMISSIONS FORM SECTION */}
        {frontPage.showAdmissionsSection && (
        <section id="admissions" className="py-20 border-t border-slate-900 bg-gradient-to-b from-transparent to-slate-950/90">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center space-y-3 mb-12">
              <span className="text-xs font-semibold tracking-widest text-amber-400 uppercase">{frontPage.admissionsEyebrow}</span>
              <h2 className="text-3xl font-serif text-white">{frontPage.admissionsTitle}</h2>
              <p className="text-slate-400 text-sm">{frontPage.admissionsSubtitle}</p>
              {onNavigateToCourseSelection && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToCourseSelection(formData.courseId)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer"
                  >
                    <span>Configure All 3 Course Options on Dedicated Selection Page</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 backdrop-blur-sm shadow-xl">
              {submitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-serif text-slate-100 font-semibold">Application Received!</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Thank you. We have saved your application. Lakshmi S. Bose (Admission Counselor) has been notified to guide you through the process.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="john@example.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Phone Number</label>
                      <input 
                        type="tel" 
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+91 94460 00000"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Highest Qualification</label>
                      <input 
                        type="text" 
                        required
                        value={formData.qualification}
                        onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                        placeholder="Graduate / 12th Standard"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Desired Program</label>
                      <select 
                        value={formData.courseId}
                        onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400 uppercase font-semibold">Preferred Batch Start</label>
                      <select 
                        value={formData.preferredBatch}
                        onChange={(e) => setFormData({...formData, preferredBatch: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="ADWDVC-2026-A">ADWDVC Batch A (Oct 2026)</option>
                        <option value="DAIMPIDM-2026-A">DAIMPIDM Cohort A (Nov 2026)</option>
                        <option value="AIBC-Weekend">AIBC Weekend Spec (Dec 2026)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 uppercase font-semibold">Message & Aspirations (Optional)</label>
                    <textarea 
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="Tell us about what you want to build or create..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Verifying & Submitting...' : 'Submit Enrollment Proposal'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {headerLogoSrc && !logoLoadError && (
                <img
                  src={headerLogoSrc}
                  alt={`${frontPage.footerBrandTitle} logo`}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded object-contain bg-slate-900 border border-slate-800 p-0.5 shrink-0"
                />
              )}
              <span className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 font-serif">
                {frontPage.footerBrandTitle}
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">
              {frontPage.footerDescription}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Programs</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">Web Development & Vibe Coding</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">AI Media & Digital Marketing</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">AI & Business Communication</a></li>
              <li><a href="#courses" className="hover:text-amber-400 transition-colors">Videography & Creation Basics</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Community</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              {frontPage.showReviewsSection && (
                <li><a href="#reviews" className="hover:text-amber-400 transition-colors">Academy Reviews</a></li>
              )}
              <li><a href="#philosophy" className="hover:text-amber-400 transition-colors">Alumni network</a></li>
              {frontPage.showAdmissionsSection && (
                <li><a href="#admissions" className="hover:text-amber-400 transition-colors">Enterprise Partners</a></li>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Contact Academy</h4>
            <div className="space-y-2 text-xs text-slate-500">
              <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-amber-500" /> {frontPage.contactEmail || academySettings.email}</p>
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-500" /> {frontPage.contactPhone || academySettings.phone}</p>
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-amber-500" /> {frontPage.contactLocation || academySettings.address}</p>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-900/50 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-600">
          <p>{frontPage.copyrightText}</p>
          <div className="flex gap-4 mt-2 sm:mt-0 font-mono">
            <span>CURRENCY: {academySettings.currency || 'INR (₹)'}</span>
            <span>TIMEZONE: {academySettings.timezone || 'IST (Kolkata)'}</span>
          </div>
        </div>
      </footer>

      {/* DOCKED SIDE-POSITION LOGIN HANDLE */}
      <button
        type="button"
        onClick={() => {
          setSideLoginError('');
          setIsSideLoginOpen(true);
        }}
        aria-label="Open Side Login Panel"
        aria-expanded={isSideLoginOpen}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 bg-[#0B0F17]/95 hover:bg-slate-900 border border-r-0 border-amber-500/40 text-amber-300 hover:text-amber-200 px-2.5 py-4 rounded-l-lg shadow-2xl shadow-black/60 backdrop-blur-md transition-colors cursor-pointer"
      >
        <LogIn className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
          {activeUser ? 'Workspace' : 'Portal Login'}
        </span>
      </button>

      {/* RIGHT-SIDE LOGIN DRAWER */}
      {isSideLoginOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          onClick={() => setIsSideLoginOpen(false)}
        >
          <aside
            aria-label="Portal Side Login"
            className="w-full max-w-md h-full bg-[#0B0F17] border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                    {frontPage.brandWordmark}
                  </p>
                  <h2 className="text-xl font-serif font-bold text-white">
                    {activeUser ? 'Active Workspace Session' : 'Side Portal Login'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeUser
                      ? 'Continue to your dashboard or switch to another account.'
                      : 'Sign in with Google or your registered username and password.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideLoginOpen(false)}
                  aria-label="Close Side Login Panel"
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeUser ? (
                <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-5">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeUser.name)}`}
                      alt={activeUser.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full border border-slate-700 object-cover bg-slate-950"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{activeUser.name}</p>
                      <p className="text-xs text-slate-400 truncate">{activeUser.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideLoginOpen(false);
                      onNavigateToPortal();
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={handleSideGoogleLogin}
                    disabled={sideLoginLoading}
                    className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold uppercase text-xs tracking-wider rounded transition-colors cursor-pointer shadow flex items-center justify-center gap-3 border border-slate-200 disabled:opacity-50"
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google"
                      className="w-4 h-4"
                    />
                    <span>{sideLoginLoading ? 'Signing in...' : 'Continue with Google'}</span>
                  </button>

                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-slate-800" />
                    <span className="mx-3 text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">
                      Or Credentials
                    </span>
                    <div className="flex-grow border-t border-slate-800" />
                  </div>

                  <form onSubmit={handleSideCredentialLogin} className="space-y-4">
                    {sideLoginError && (
                      <div
                        role="alert"
                        className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-3 rounded"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{sideLoginError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="side-login-identifier" className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 block">
                        Username or Email ID
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="side-login-identifier"
                          type="text"
                          required
                          value={sideLoginInput}
                          onChange={(e) => setSideLoginInput(e.target.value)}
                          placeholder="e.g. aadithyan or email"
                          className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="side-login-password" className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 block">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="side-login-password"
                          type={showSidePassword ? 'text' : 'password'}
                          required
                          value={sidePassword}
                          onChange={(e) => setSidePassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSidePassword((prev) => !prev)}
                          aria-label={showSidePassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-2 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-0.5"
                        >
                          {showSidePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={sideLoginLoading}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>{sideLoginLoading ? 'Authenticating...' : 'Sign In to Portal'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-800 space-y-2.5">
                    {onNavigateToRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSideLoginOpen(false);
                          onNavigateToRegister();
                        }}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Create New Account</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSideLoginOpen(false);
                        onNavigateToPortal();
                      }}
                      className="w-full py-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      Open Full Campus Login Page →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between gap-2">
              <span>{frontPage.contactLocation || academySettings.address}</span>
              <span className="font-mono text-slate-400">{frontPage.contactPhone || academySettings.phone}</span>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}
