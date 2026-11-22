/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  Download,
  Calendar,
  Layers,
  BookOpen,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Filter,
  FolderOpen,
  Lock,
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Course,
  CoursePaper,
  COURSE_PAPER_CATEGORIES,
  CourseSelectionRegistration,
  Student,
  SwanayaDatabase,
  User,
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import CoursePaperPreviewModal, {
  PreviewablePaper,
  formatPaperDate,
  formatPaperFileSize,
  triggerBrandedPdfDownload,
} from './CoursePaperPreviewModal';

interface StudentCoursePapersPanelProps {
  studentUser: Student;
  currentUser: User;
  courses: Course[];
}

export default function StudentCoursePapersPanel({
  studentUser,
  currentUser,
  courses,
}: StudentCoursePapersPanelProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [authSyncing, setAuthSyncing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [enrollmentSynced, setEnrollmentSynced] = useState(false);

  const [papers, setPapers] = useState<CoursePaper[]>([]);
  const [papersState, setPapersState] = useState<'loading' | 'empty' | 'success' | 'error'>('loading');
  const [papersError, setPapersError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Browsing & filter controls
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Online Preview & Download feedback
  const [previewPaper, setPreviewPaper] = useState<PreviewablePaper | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setEnrollmentSynced(false);
    });
    return () => unsub();
  }, []);

  // Resolve all enrolled courses for this student (preserves existing registrations & multi-course access)
  const enrolledCourseIds = useMemo(() => {
    const ids = new Set<string>();
    const pushIfValid = (val?: string) => {
      const trimmed = String(val || '').trim();
      if (trimmed) ids.add(trimmed);
    };

    pushIfValid(studentUser?.courseId);
    pushIfValid(currentUser?.courseId);
    pushIfValid(currentUser?.preferredCourseId);
    if (Array.isArray(currentUser?.enrolledCourseIds)) {
      currentUser.enrolledCourseIds.forEach((cid) => pushIfValid(cid));
    }

    // Check approved course registrations for this student
    const localRegs = SwanayaDatabase.get<CourseSelectionRegistration[]>('courseRegistrations') || [];
    localRegs.forEach((reg) => {
      const belongs =
        reg.studentId === studentUser?.id ||
        reg.studentId === studentUser?.studentId ||
        reg.userId === currentUser?.id ||
        (studentUser?.email && reg.studentEmail?.toLowerCase() === studentUser.email.toLowerCase());
      if (belongs && (reg.status === 'APPROVED' || reg.status === 'MD_VERIFIED')) {
        pushIfValid(reg.courseId);
      }
    });

    return Array.from(ids);
  }, [studentUser, currentUser]);

  const enrolledCourseIdsKey = enrolledCourseIds.join('|');

  const enrolledCourses = useMemo(() => {
    return enrolledCourseIds.map((cid) => {
      const found = courses.find((c) => c.id === cid);
      return found || ({ id: cid, code: cid.toUpperCase(), name: 'Enrolled Program' } as Course);
    });
  }, [enrolledCourseIds, courses]);

  // Ensure Firestore users/{uid} carries the student's enrolled courseIds so Security Rules (`isEnrolledInCourse`) authorize reads
  useEffect(() => {
    let active = true;
    const syncUserEnrollment = async () => {
      if (!firebaseUser) {
        if (active) setEnrollmentSynced(false);
        return;
      }

      if (enrolledCourseIds.length === 0) {
        if (active) setEnrollmentSynced(true);
        return;
      }

      try {
        const existingProfile = await academyService.getUserProfile(firebaseUser.uid);
        if (!active) return;

        if (!existingProfile) {
          await academyService.createUserProfile(firebaseUser.uid, {
            id: firebaseUser.uid,
            name: currentUser?.name || studentUser?.name || firebaseUser.displayName || 'Swanaya Student',
            email: currentUser?.email || studentUser?.email || firebaseUser.email || '',
            role: 'STUDENT',
            status: 'ACTIVE',
            courseId: enrolledCourseIds[0],
            preferredCourseId: enrolledCourseIds[0],
            enrolledCourseIds,
          });
        } else {
          const existingList = Array.isArray(existingProfile.enrolledCourseIds)
            ? existingProfile.enrolledCourseIds
            : [];
          const mergedList = Array.from(
            new Set([
              ...existingList,
              ...(existingProfile.courseId ? [existingProfile.courseId] : []),
              ...enrolledCourseIds,
            ].filter(Boolean))
          );
          const needsUpdate =
            (!existingProfile.courseId && Boolean(enrolledCourseIds[0])) ||
            mergedList.some((id) => !existingList.includes(id));

          if (needsUpdate) {
            await academyService.updateUserProfile(firebaseUser.uid, {
              id: existingProfile.id || firebaseUser.uid,
              name: existingProfile.name || currentUser?.name || studentUser?.name || 'Swanaya Student',
              email: existingProfile.email || currentUser?.email || studentUser?.email || firebaseUser.email || '',
              role: existingProfile.role || 'STUDENT',
              courseId: existingProfile.courseId || enrolledCourseIds[0],
              preferredCourseId: existingProfile.preferredCourseId || enrolledCourseIds[0],
              enrolledCourseIds: mergedList,
            });
          }
        }
      } catch (err) {
        console.warn('Student course enrollment Firestore sync notice:', err);
      } finally {
        if (active) setEnrollmentSynced(true);
      }
    };

    void syncUserEnrollment();
    return () => {
      active = false;
    };
  }, [firebaseUser, enrolledCourseIdsKey]);

  // Subscribe to published Course Papers for the student's enrolled courses
  useEffect(() => {
    if (!firebaseUser) {
      setPapers([]);
      setPapersState('empty');
      return;
    }

    if (enrolledCourseIds.length === 0) {
      setPapers([]);
      setPapersState('empty');
      return;
    }

    if (!enrollmentSynced) {
      setPapersState('loading');
      return;
    }

    setPapersState('loading');
    setPapersError(null);

    const unsubscribe = academyService.subscribeCoursePapers({
      mode: 'STUDENT',
      courseIds: enrolledCourseIds,
      onData: (list) => {
        const publishedOnly = list.filter(
          (p) => p.isPublished === true && enrolledCourseIds.includes(p.courseId)
        );
        setPapers(publishedOnly);
        setPapersState(publishedOnly.length === 0 ? 'empty' : 'success');
        setPapersError(null);
      },
      onError: (err) => {
        setPapersError(err.message || 'Unable to load course papers from Swanaya Cloud.');
        setPapersState('error');
      },
    });

    return () => unsubscribe();
  }, [firebaseUser, enrollmentSynced, enrolledCourseIdsKey, retryKey]);

  const handleConnectGoogleStudent = async () => {
    setAuthSyncing(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setRetryKey((k) => k + 1);
    } catch (err: any) {
      setAuthError(err?.message || 'Google authentication was cancelled or failed. Please try again.');
    } finally {
      setAuthSyncing(false);
    }
  };

  // Distinct facets from loaded published papers
  const semesterOptions = useMemo(() => {
    return Array.from(new Set(papers.map((p) => p.semester).filter(Boolean))).sort();
  }, [papers]);

  const moduleOptions = useMemo(() => {
    return Array.from(
      new Set(
        papers
          .filter((p) => selectedSemester === 'ALL' || p.semester === selectedSemester)
          .map((p) => p.module)
          .filter(Boolean)
      )
    ).sort();
  }, [papers, selectedSemester]);

  const subjectOptions = useMemo(() => {
    return Array.from(
      new Set(
        papers
          .filter((p) => selectedSemester === 'ALL' || p.semester === selectedSemester)
          .map((p) => p.subject)
          .filter(Boolean)
      )
    ).sort();
  }, [papers, selectedSemester]);

  // Reset invalid child filters when semester changes
  useEffect(() => {
    if (selectedModule !== 'ALL' && !moduleOptions.includes(selectedModule)) {
      setSelectedModule('ALL');
    }
    if (selectedSubject !== 'ALL' && !subjectOptions.includes(selectedSubject)) {
      setSelectedSubject('ALL');
    }
  }, [selectedSemester, moduleOptions, subjectOptions, selectedModule, selectedSubject]);

  const filteredPapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return papers.filter((p) => {
      if (p.isPublished !== true) return false;
      if (selectedCourseFilter !== 'ALL' && p.courseId !== selectedCourseFilter) return false;
      if (selectedSemester !== 'ALL' && p.semester !== selectedSemester) return false;
      if (selectedModule !== 'ALL' && p.module !== selectedModule) return false;
      if (selectedSubject !== 'ALL' && p.subject !== selectedSubject) return false;
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;

      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        p.semester.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.fileName.toLowerCase().includes(q) ||
        (p.courseCode || '').toLowerCase().includes(q) ||
        (p.courseName || '').toLowerCase().includes(q)
      );
    });
  }, [
    papers,
    selectedCourseFilter,
    selectedSemester,
    selectedModule,
    selectedSubject,
    selectedCategory,
    searchQuery,
  ]);

  const handleDownloadPaper = async (paper: PreviewablePaper) => {
    const pid = paper.id || paper.fileName;
    setDownloadingId(pid);
    try {
      await triggerBrandedPdfDownload(paper);
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  const resetFilters = () => {
    setSelectedCourseFilter('ALL');
    setSelectedSemester('ALL');
    setSelectedModule('ALL');
    setSelectedSubject('ALL');
    setSelectedCategory('ALL');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
              SWANAYA MEDIA ACADEMY · STUDENT REPOSITORY
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Published Materials Only
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-serif font-bold text-white">
            Course Papers &amp; Learning Materials
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl">
            Browse, preview online, and download official study materials, notes, assignments, practical records, and question papers for your enrolled course.
          </p>
        </div>

        {/* Enrolled Course Badge(s) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {enrolledCourses.length > 0 ? (
            enrolledCourses.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/30 text-left"
              >
                <span className="text-[9px] font-mono uppercase text-amber-400 block">
                  Enrolled Program
                </span>
                <span className="text-xs font-semibold text-white">
                  {c.code} · {c.name}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
              No enrolled course linked yet
            </div>
          )}
        </div>
      </div>

      {/* State 1: Firebase Authentication Required for Secure Storage & Firestore Access */}
      {!firebaseUser ? (
        <div className="bg-slate-900/50 border border-amber-500/30 rounded-xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h4 className="text-base font-serif font-bold text-white">
              Verify Google Session to Access Course PDFs
            </h4>
            <p className="text-xs text-slate-400">
              Course papers and examination materials are access-controlled for enrolled Swanaya Media Academy students. Sign in with Google to unlock live PDF previews and downloads for your course.
            </p>
          </div>
          {authError && (
            <div className="max-w-md mx-auto p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleConnectGoogleStudent}
            disabled={authSyncing}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            {authSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Connecting Session...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Connect Google Account to View Course Papers
              </>
            )}
          </button>
        </div>
      ) : enrolledCourseIds.length === 0 ? (
        /* State 2: No enrolled course linked */
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <h4 className="text-sm font-serif font-bold text-slate-200">
            No Enrolled Course Assigned Yet
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Once your course registration is assigned or approved, published study materials and question papers for that course will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Semester Browse Pills + Multi-Filter Toolbar */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            {/* Quick Semester Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Semester:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSemester('ALL')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedSemester === 'ALL'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                All Semesters ({papers.length})
              </button>
              {semesterOptions.map((sem) => {
                const count = papers.filter((p) => p.semester === sem).length;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSelectedSemester(sem)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      selectedSemester === sem
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {sem} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search & Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Box */}
              <div className="relative sm:col-span-2 lg:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search paper title, subject, module, keyword..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {/* Filter by Subject */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                aria-label="Filter by Subject"
                className="bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Subjects</option>
                {subjectOptions.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>

              {/* Filter by Module */}
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                aria-label="Browse by Module"
                className="bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Modules</option>
                {moduleOptions.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>

              {/* Filter by Document Type */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by Document Type"
                className="bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Document Types</option>
                {COURSE_PAPER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {enrolledCourses.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-500 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-amber-400" /> Course:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCourseFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] cursor-pointer ${
                    selectedCourseFilter === 'ALL'
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}
                >
                  All Enrolled Courses
                </button>
                {enrolledCourses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourseFilter(c.id)}
                    className={`px-2.5 py-1 rounded text-[11px] cursor-pointer ${
                      selectedCourseFilter === c.id
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold'
                        : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* State 3: Loading */}
          {papersState === 'loading' && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">
                Loading published course papers from Swanaya Cloud...
              </p>
            </div>
          )}

          {/* State 4: Error */}
          {papersState === 'error' && (
            <div className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-rose-300">Unable to Load Course Papers</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {papersError || 'There was a network or authorization issue loading your course materials.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold uppercase rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Sync
              </button>
            </div>
          )}

          {/* State 5: Empty (No published papers exist yet for enrolled courses) */}
          {papersState === 'empty' && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-2.5">
              <FolderOpen className="w-9 h-9 text-slate-500 mx-auto" />
              <h4 className="text-sm font-serif font-bold text-slate-200">
                No Published Course Papers Yet
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your instructors or academy administrators haven&apos;t published PDF study materials or question papers for this course yet. New materials will appear automatically as soon as they are published.
              </p>
            </div>
          )}

          {/* State 6: Success */}
          {papersState === 'success' && (
            <>
              {filteredPapers.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                  <Search className="w-7 h-7 text-slate-500 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-200">No Matching Course Papers</h4>
                    <p className="text-xs text-slate-400">
                      Try clearing your search query or switching semester, subject, module, or document type filters.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-400 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPapers.map((paper) => {
                    const matchedCourse = courses.find((c) => c.id === paper.courseId);
                    const courseLabel =
                      paper.courseCode ||
                      matchedCourse?.code ||
                      'SMA';
                    const pubDate = formatPaperDate(paper.publishedAt || paper.createdAt);
                    const isDownloading = downloadingId === paper.id;

                    return (
                      <div
                        key={paper.id}
                        className="bg-[#0B0F17] border border-slate-800 hover:border-amber-500/40 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors shadow-sm"
                      >
                        <div className="space-y-3">
                          {/* Top Row: Swanaya Badge + Category + Course Code */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 font-semibold">
                              {paper.category}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                              {courseLabel} · {formatPaperFileSize(paper.fileSize)}
                            </span>
                          </div>

                          {/* Title & Description */}
                          <div className="space-y-1.5">
                            <h4 className="text-base font-serif font-bold text-white leading-snug">
                              {paper.title}
                            </h4>
                            {paper.description && (
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                                {paper.description}
                              </p>
                            )}
                          </div>

                          {/* Metadata Tags */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1 text-slate-300">
                              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              {paper.semester} · {paper.module}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              {paper.subject}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-slate-400">
                              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              Published {pubDate}
                            </span>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]" title={paper.fileName}>
                            {paper.fileName}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPaper(paper)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadPaper(paper)}
                              disabled={isDownloading}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {isDownloading ? 'Saving...' : 'Download'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Branded PDF Preview Modal */}
      <CoursePaperPreviewModal
        paper={previewPaper}
        onClose={() => setPreviewPaper(null)}
        onDownload={(p) => void handleDownloadPaper(p)}
      />
    </div>
  );
}
