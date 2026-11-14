/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Star, MessageSquarePlus, ThumbsUp, Edit3, Trash2, Search,
  CheckCircle2, AlertCircle, ShieldAlert, Flag, X, BookOpen
} from 'lucide-react';
import { SwanayaDatabase, AcademyReview, Course, Student } from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { useAuth } from './FirebaseAuthProvider';

interface ReviewsPortalProps {
  currentUser: any;
  studentProfile?: Student | null;
  onRefreshAllData?: () => void;
}

const GENERAL_PROGRAM_OPTION = {
  id: 'general-academy',
  name: 'General Academy Experience',
  code: 'SMA-GEN',
};

export default function ReviewsPortal({ currentUser, studentProfile, onRefreshAllData }: ReviewsPortalProps) {
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>('courses'));
  const [reviews, setReviews] = useState<AcademyReview[]>(() => {
    const local = SwanayaDatabase.get<AcademyReview[]>('reviews');
    return Array.isArray(local) ? local : [];
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 'ALL'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [formCourseId, setFormCourseId] = useState<string>(
    studentProfile?.courseId || courses[0]?.id || GENERAL_PROGRAM_OPTION.id
  );
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [helpfulVotedIds, setHelpfulVotedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sma_helpful_reviews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { user: firebaseUser, isAdmin: firebaseIsAdmin } = useAuth();
  const isModerator = ['SUPER_ADMIN', 'MD', 'ADMIN', 'ACADEMIC_ADMIN', 'REVIEWER'].includes(
    currentUser?.role || ''
  );
  const canQueryAllCloudReviews = Boolean(firebaseUser && auth.currentUser && (isModerator || firebaseIsAdmin));
  const currentAuthorId = firebaseUser?.uid || auth.currentUser?.uid || currentUser?.id || currentUser?.email || 'anon';

  const programOptions = useMemo(() => {
    const list = courses.map((c) => ({ id: c.id, name: c.name, code: c.code }));
    if (!list.some((c) => c.id === GENERAL_PROGRAM_OPTION.id)) {
      list.push(GENERAL_PROGRAM_OPTION);
    }
    return list;
  }, [courses]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const localList = SwanayaDatabase.get<AcademyReview[]>('reviews') || [];
      let cloudList: AcademyReview[] = [];
      try {
        const fetched = await academyService.getReviews(!canQueryAllCloudReviews);
        if (Array.isArray(fetched)) {
          cloudList = fetched as AcademyReview[];
        }
      } catch {
        // Local-first resilience when unauthenticated in Firebase or offline
      }

      const mergedMap = new Map<string, AcademyReview>();
      localList.forEach((r) => r?.id && mergedMap.set(r.id, r));
      cloudList.forEach((r) => r?.id && mergedMap.set(r.id, r));

      const sorted = Array.from(mergedMap.values()).sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
      setReviews(sorted);
      SwanayaDatabase.set('reviews', sorted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [canQueryAllCloudReviews]);

  const visibleReviews = useMemo(() => {
    return reviews.filter((rev) => {
      if (!isModerator && rev.status === 'FLAGGED' && rev.authorId !== currentAuthorId) {
        return false;
      }
      if (ratingFilter !== 'ALL' && Math.round(rev.rating) !== ratingFilter) {
        return false;
      }
      if (courseFilter !== 'ALL' && rev.courseId !== courseFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches =
          rev.title.toLowerCase().includes(q) ||
          rev.comment.toLowerCase().includes(q) ||
          rev.authorName.toLowerCase().includes(q) ||
          rev.courseName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reviews, isModerator, currentAuthorId, ratingFilter, courseFilter, searchTerm]);

  const publishedReviews = useMemo(
    () => reviews.filter((r) => r.status === 'PUBLISHED'),
    [reviews]
  );

  const stats = useMemo(() => {
    const count = publishedReviews.length;
    const avg =
      count > 0
        ? publishedReviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / count
        : 0;
    const breakdown = [5, 4, 3, 2, 1].map((star) => {
      const starCount = publishedReviews.filter((r) => Math.round(r.rating) === star).length;
      const pct = count > 0 ? Math.round((starCount / count) * 100) : 0;
      return { star, count: starCount, pct };
    });
    return { count, avg, breakdown };
  }, [publishedReviews]);

  const resetComposer = () => {
    setEditingReviewId(null);
    setFormRating(5);
    setHoverRating(null);
    setFormCourseId(studentProfile?.courseId || courses[0]?.id || GENERAL_PROGRAM_OPTION.id);
    setFormTitle('');
    setFormComment('');
    setIsComposerOpen(false);
  };

  const openEditComposer = (rev: AcademyReview) => {
    setEditingReviewId(rev.id);
    setFormRating(rev.rating);
    setFormCourseId(rev.courseId || GENERAL_PROGRAM_OPTION.id);
    setFormTitle(rev.title);
    setFormComment(rev.comment);
    setIsComposerOpen(true);
    setFeedbackBanner(null);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);

    const trimmedTitle = formTitle.trim();
    const trimmedComment = formComment.trim();
    if (!trimmedTitle || !trimmedComment) {
      setFeedbackBanner({ type: 'error', text: 'Please enter both a review headline and written feedback.' });
      return;
    }
    if (trimmedTitle.length > 160 || trimmedComment.length > 2000) {
      setFeedbackBanner({ type: 'error', text: 'Review exceeds the allowed character limit.' });
      return;
    }

    const selectedCourse =
      programOptions.find((c) => c.id === formCourseId) || GENERAL_PROGRAM_OPTION;
    const nowIso = new Date().toISOString();

    setSubmitting(true);
    try {
      if (editingReviewId) {
        const existing = reviews.find((r) => r.id === editingReviewId);
        if (!existing) {
          setFeedbackBanner({ type: 'error', text: 'Review record not found.' });
          return;
        }
        const updates = {
          courseId: selectedCourse.id,
          courseName: selectedCourse.name,
          rating: formRating,
          title: trimmedTitle,
          comment: trimmedComment,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          try {
            await academyService.updateReview(editingReviewId, updates);
          } catch {
            // Preserve local update even if record was created before Firebase login
          }
        }

        const updatedList = reviews.map((r) =>
          r.id === editingReviewId ? { ...r, ...updates } : r
        );
        setReviews(updatedList);
        SwanayaDatabase.set('reviews', updatedList);
        SwanayaDatabase.log(
          currentUser?.email || 'portal@swanayamedia.com',
          currentUser?.name || 'Portal User',
          'REVIEW_UPDATE',
          `Updated academy review: ${trimmedTitle}`
        );
        setFeedbackBanner({ type: 'success', text: 'Your review has been updated.' });
      } else {
        const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newReview: AcademyReview = {
          id: reviewId,
          authorId: currentAuthorId,
          authorName: currentUser?.name || studentProfile?.name || 'Academy Member',
          authorRole: currentUser?.role || 'STUDENT',
          courseId: selectedCourse.id,
          courseName: selectedCourse.name,
          rating: formRating,
          title: trimmedTitle,
          comment: trimmedComment,
          status: 'PUBLISHED',
          verifiedStudent: Boolean(studentProfile || currentUser?.role === 'STUDENT' || currentUser?.role === 'ALUMNI'),
          helpfulCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.createReview(newReview);
        }

        const updatedList = [newReview, ...reviews];
        setReviews(updatedList);
        SwanayaDatabase.set('reviews', updatedList);
        SwanayaDatabase.log(
          currentUser?.email || 'portal@swanayamedia.com',
          currentUser?.name || 'Portal User',
          'REVIEW_CREATE',
          `Published ${formRating}-star review for ${selectedCourse.name}`
        );
        setFeedbackBanner({ type: 'success', text: 'Thank you. Your review is now published.' });
      }

      resetComposer();
      onRefreshAllData?.();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err?.message || 'Unable to save your review. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      if (auth.currentUser) {
        try {
          await academyService.deleteReview(reviewId);
        } catch {
          // Local fallback cleanup if document only exists locally
        }
      }
      const updated = reviews.filter((r) => r.id !== reviewId);
      setReviews(updated);
      SwanayaDatabase.set('reviews', updated);
      SwanayaDatabase.log(
        currentUser?.email || 'portal@swanayamedia.com',
        currentUser?.name || 'Portal User',
        'REVIEW_DELETE',
        `Deleted review ID: ${reviewId}`
      );
      setConfirmDeleteId(null);
      setFeedbackBanner({ type: 'success', text: 'Review removed.' });
      onRefreshAllData?.();
    } catch {
      setFeedbackBanner({ type: 'error', text: 'Failed to delete review.' });
    }
  };

  const handleToggleFlag = async (rev: AcademyReview) => {
    if (!isModerator) return;
    const nextStatus = rev.status === 'PUBLISHED' ? ('FLAGGED' as const) : ('PUBLISHED' as const);
    if (auth.currentUser) {
      try {
        await academyService.updateReview(rev.id, { status: nextStatus });
      } catch {
        // Fallback to local state
      }
    }
    const updated = reviews.map((r) =>
      r.id === rev.id ? { ...r, status: nextStatus, updatedAt: new Date().toISOString() } : r
    );
    setReviews(updated);
    SwanayaDatabase.set('reviews', updated);
    setFeedbackBanner({
      type: 'success',
      text: nextStatus === 'FLAGGED' ? 'Review hidden from public display.' : 'Review restored to public display.',
    });
  };

  const handleHelpful = async (rev: AcademyReview) => {
    if (helpfulVotedIds.includes(rev.id)) return;
    const nextCount = Number(rev.helpfulCount || 0) + 1;

    if (auth.currentUser) {
      try {
        await academyService.updateReview(rev.id, { helpfulCount: nextCount });
      } catch {
        // Local persistence fallback
      }
    }

    const updated = reviews.map((r) =>
      r.id === rev.id ? { ...r, helpfulCount: nextCount } : r
    );
    setReviews(updated);
    SwanayaDatabase.set('reviews', updated);

    const nextVoted = [...helpfulVotedIds, rev.id];
    setHelpfulVotedIds(nextVoted);
    localStorage.setItem('sma_helpful_reviews', JSON.stringify(nextVoted));
  };

  const activeStar = hoverRating ?? formRating;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-400 tracking-wide">Student &amp; Alumni Feedback</p>
          <h2 className="text-2xl font-serif font-bold text-white">Academy Reviews &amp; Ratings</h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Share candid course feedback, rate instruction quality, and explore verified perspectives across Swanaya Media Academy programs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isComposerOpen && !editingReviewId) {
              resetComposer();
            } else {
              setEditingReviewId(null);
              setIsComposerOpen(true);
              setFeedbackBanner(null);
            }
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isComposerOpen && !editingReviewId ? (
            <>
              <X className="w-4 h-4" />
              <span>Close Editor</span>
            </>
          ) : (
            <>
              <MessageSquarePlus className="w-4 h-4" />
              <span>Write a Review</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Review Composer Form */}
      {isComposerOpen && (
        <form
          onSubmit={handleSaveReview}
          className="bg-slate-900/60 border border-amber-500/30 rounded-lg p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-serif font-bold text-white">
              {editingReviewId ? 'Edit Your Review' : 'Submit an Academy Review'}
            </h3>
            <button
              type="button"
              onClick={resetComposer}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Star Rating Picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Overall Rating</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating out of 5 stars">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const filled = starValue <= activeStar;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setFormRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(null)}
                        aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
                        aria-checked={formRating === starValue}
                        role="radio"
                        className="p-1.5 rounded hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            filled ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-amber-400 ml-2">
                  {activeStar}.0 / 5.0
                </span>
              </div>
            </div>

            {/* Course / Program Selector */}
            <div className="space-y-2">
              <label htmlFor="review-course" className="text-xs font-medium text-slate-300 block">
                Program or Area Reviewed
              </label>
              <select
                id="review-course"
                value={formCourseId}
                onChange={(e) => setFormCourseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              >
                {programOptions.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name} ({prog.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="review-title" className="text-xs font-medium text-slate-300">
                Review Headline
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {formTitle.length}/160
              </span>
            </div>
            <input
              id="review-title"
              type="text"
              required
              maxLength={160}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Summarize your learning or mentoring experience"
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="review-comment" className="text-xs font-medium text-slate-300">
                Detailed Review
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {formComment.length}/2000
              </span>
            </div>
            <textarea
              id="review-comment"
              required
              rows={4}
              maxLength={2000}
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="Describe the curriculum depth, studio mentorship, practical assignments, and outcomes..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={resetComposer}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingReviewId ? 'Update Review' : 'Publish Review'}
            </button>
          </div>
        </form>
      )}

      {/* Rating Summary + Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-900/40 border border-slate-800 rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs text-slate-400">Overall Satisfaction</p>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-4xl font-bold font-mono tabular-nums text-white">
                {stats.count > 0 ? stats.avg.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {stats.count > 0 ? `/ 5.0 across ${stats.count} review${stats.count === 1 ? '' : 's'}` : 'No published reviews yet'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(stats.avg) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            {stats.breakdown.map((row) => (
              <button
                key={row.star}
                type="button"
                onClick={() => setRatingFilter(ratingFilter === row.star ? 'ALL' : row.star)}
                className={`w-full flex items-center gap-3 text-xs py-1 px-1.5 rounded transition-colors cursor-pointer ${
                  ratingFilter === row.star ? 'bg-amber-500/10 text-amber-300' : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span className="w-10 text-left font-mono tabular-nums">{row.star} ★</span>
                <div className="flex-grow h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono tabular-nums text-slate-400">
                  {row.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters + Review Feed */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reviews by headline, course, or author..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="Filter by course"
                className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Programs</option>
                {programOptions.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name}
                  </option>
                ))}
              </select>

              {ratingFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setRatingFilter('ALL')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear {ratingFilter}★
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((idx) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-800 rounded-lg p-6 h-36 animate-pulse" />
              ))}
            </div>
          ) : visibleReviews.length > 0 ? (
            <div className="space-y-4">
              {visibleReviews.map((rev) => {
                const isOwn = rev.authorId === currentAuthorId;
                const hasVoted = helpfulVotedIds.includes(rev.id);
                const formattedDate = rev.createdAt
                  ? new Date(rev.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';

                return (
                  <article
                    key={rev.id}
                    className={`bg-slate-900/40 border rounded-lg p-6 space-y-3 ${
                      rev.status === 'FLAGGED' ? 'border-rose-500/40 opacity-80' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5" aria-label={`${rev.rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= Math.round(rev.rating)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-mono tabular-nums font-semibold text-amber-400">
                            {Number(rev.rating).toFixed(1)}
                          </span>
                          {rev.status === 'FLAGGED' && (
                            <span className="text-xs font-medium text-rose-400 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Hidden by Moderation
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-serif font-bold text-white">{rev.title}</h4>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>{rev.courseName}</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                      {rev.comment}
                    </p>

                    <div className="pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-200">{rev.authorName}</span>
                        <span aria-hidden="true" className="text-slate-700">·</span>
                        <span>{rev.verifiedStudent ? 'Verified Student' : rev.authorRole}</span>
                        {formattedDate && (
                          <>
                            <span aria-hidden="true" className="text-slate-700">·</span>
                            <span className="font-mono tabular-nums">{formattedDate}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleHelpful(rev)}
                          disabled={hasVoted}
                          className={`px-2.5 py-1.5 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            hasVoted
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/40'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">Helpful ({rev.helpfulCount || 0})</span>
                        </button>

                        {(isOwn || isModerator) && (
                          <>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => openEditComposer(rev)}
                                className="px-2.5 py-1.5 rounded border border-slate-800 bg-slate-950 text-slate-300 hover:text-amber-300 hover:border-amber-500/40 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}

                            {isModerator && (
                              <button
                                type="button"
                                onClick={() => handleToggleFlag(rev)}
                                className="px-2.5 py-1.5 rounded border border-slate-800 bg-slate-950 text-slate-300 hover:text-amber-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Flag className="w-3.5 h-3.5" />
                                <span>{rev.status === 'PUBLISHED' ? 'Hide' : 'Restore'}</span>
                              </button>
                            )}

                            {confirmDeleteId === rev.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReview(rev.id)}
                                  className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1.5 rounded border border-slate-700 text-slate-300 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rev.id)}
                                className="px-2.5 py-1.5 rounded border border-slate-800 bg-slate-950 text-rose-400 hover:border-rose-500/40 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
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
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-10 text-center space-y-3">
              <Star className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-serif font-semibold text-slate-200">
                {reviews.length === 0 ? 'Be the First to Review Swanaya Media Academy' : 'No Reviews Match Your Filters'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {reviews.length === 0
                  ? 'Share your experience with coursework, mentorship, and studio resources to help prospective students.'
                  : 'Try clearing the star rating or search filter to view all published reviews.'}
              </p>
              {reviews.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Write the First Review
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
