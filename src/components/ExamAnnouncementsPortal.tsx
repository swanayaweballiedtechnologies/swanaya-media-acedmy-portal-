/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Calendar, Clock, MapPin, Plus, Search, CheckCircle2,
  AlertCircle, ShieldCheck, Edit3, Trash2, Archive, FileText, Video,
  X, Send, ArrowRight, BellRing, Eye
} from 'lucide-react';
import {
  SwanayaDatabase, User, Student, Course, ExamAnnouncement, Notification
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { useAuth } from './FirebaseAuthProvider';

interface ExamAnnouncementsPortalProps {
  currentUser: User;
  studentProfile?: Student | null;
  onNavigateTab?: (tab: string) => void;
  onRefreshAllData?: () => void;
}

const EXAM_TYPE_LABELS: Record<NonNullable<ExamAnnouncement['examType']>, string> = {
  SEMESTER_FINAL: 'Semester Final',
  MID_TERM: 'Mid-Term Assessment',
  MCQ_ASSESSMENT: 'MCQ Examination',
  PRACTICAL_JURY: 'Practical & Jury',
  RE_EXAM: 'Supplementary / Re-Exam',
};

const DELIVERY_MODE_LABELS: Record<NonNullable<ExamAnnouncement['deliveryMode']>, string> = {
  ONLINE_PORTAL: 'Online Exam Portal',
  CAMPUS_CENTER: 'Campus Exam Hall',
  HYBRID: 'Hybrid (Campus + Online)',
};

export default function ExamAnnouncementsPortal({
  currentUser,
  studentProfile,
  onNavigateTab,
  onRefreshAllData,
}: ExamAnnouncementsPortalProps) {
  const { user: firebaseUser, isAdmin: firebaseIsAdmin } = useAuth();
  const courses = useMemo(() => SwanayaDatabase.get<Course[]>('courses') || [], []);

  const isMdOrAdmin =
    firebaseIsAdmin ||
    ['SUPER_ADMIN', 'MD', 'ADMIN', 'ACADEMIC_ADMIN'].includes(currentUser.role);
  const isPublisher =
    isMdOrAdmin || ['INSTRUCTOR', 'REVIEWER'].includes(currentUser.role);
  const isStudentOrAlumni =
    currentUser.role === 'STUDENT' || currentUser.role === 'ALUMNI';

  const [announcements, setAnnouncements] = useState<ExamAnnouncement[]>(() => {
    const local = SwanayaDatabase.get<ExamAnnouncement[]>('examAnnouncements');
    return Array.isArray(local) ? local : [];
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filterMode, setFilterMode] = useState<
    'ALL' | 'URGENT' | 'SEMESTER_FINAL' | 'MCQ_ASSESSMENT' | 'PENDING_MD' | 'ARCHIVED'
  >('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Composer Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<ExamAnnouncement | null>(null);

  const defaultExamDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const defaultDeadline = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: '',
    examType: 'SEMESTER_FINAL' as NonNullable<ExamAnnouncement['examType']>,
    subjectCode: '',
    subjectName: '',
    courseId: 'ALL',
    examDate: defaultExamDate,
    startTime: '10:00',
    endTime: '13:00',
    deliveryMode: 'CAMPUS_CENTER' as NonNullable<ExamAnnouncement['deliveryMode']>,
    venue: 'Swanaya Main Studio Campus',
    registrationDeadline: defaultDeadline,
    message: '',
    instructions:
      'Carry your Academy ID and report 20 minutes prior to commencement. Submit uploaded answerbooks within the designated window.',
    pdfUrl: '',
    youtubeUrl: '',
    urgent: false,
    active: true,
  });

  const canQueryAllInCloud = Boolean(firebaseUser && auth.currentUser && (isPublisher || firebaseIsAdmin));

  const syncAnnouncements = async () => {
    setLoading(true);
    try {
      const localList = SwanayaDatabase.get<ExamAnnouncement[]>('examAnnouncements') || [];
      let cloudList: ExamAnnouncement[] = [];
      try {
        const fetched = await academyService.getExamAnnouncements(!canQueryAllInCloud);
        if (Array.isArray(fetched)) {
          cloudList = fetched as ExamAnnouncement[];
        }
      } catch {
        // Local-first fallback when offline or unauthenticated in Firebase
      }

      const map = new Map<string, ExamAnnouncement>();
      localList.forEach((a) => a?.id && map.set(a.id, a));
      cloudList.forEach((a) => a?.id && map.set(a.id, a));

      const merged = Array.from(map.values()).sort((a, b) =>
        String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
      );
      setAnnouncements(merged);
      SwanayaDatabase.set('examAnnouncements', merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAnnouncements();
  }, [canQueryAllInCloud]);

  const persistList = (next: ExamAnnouncement[]) => {
    const sorted = [...next].sort((a, b) =>
      String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
    );
    setAnnouncements(sorted);
    SwanayaDatabase.set('examAnnouncements', sorted);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      examType: 'SEMESTER_FINAL',
      subjectCode: '',
      subjectName: '',
      courseId: 'ALL',
      examDate: defaultExamDate,
      startTime: '10:00',
      endTime: '13:00',
      deliveryMode: 'CAMPUS_CENTER',
      venue: 'Swanaya Main Studio Campus',
      registrationDeadline: defaultDeadline,
      message: '',
      instructions:
        'Carry your Academy ID and report 20 minutes prior to commencement. Submit uploaded answerbooks within the designated window.',
      pdfUrl: '',
      youtubeUrl: '',
      urgent: false,
      active: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setNotice(null);
    setIsComposerOpen(true);
  };

  const openEditModal = (ann: ExamAnnouncement) => {
    setEditingId(ann.id);
    setForm({
      title: ann.title || '',
      examType: ann.examType || 'SEMESTER_FINAL',
      subjectCode: ann.subjectCode || '',
      subjectName: ann.subjectName || '',
      courseId: ann.courseId || 'ALL',
      examDate: ann.examDate || ann.date || defaultExamDate,
      startTime: ann.startTime || '10:00',
      endTime: ann.endTime || '13:00',
      deliveryMode: ann.deliveryMode || 'CAMPUS_CENTER',
      venue: ann.venue || 'Swanaya Main Studio Campus',
      registrationDeadline: ann.registrationDeadline || defaultDeadline,
      message: ann.message || '',
      instructions: ann.instructions || '',
      pdfUrl: ann.pdfUrl || '',
      youtubeUrl: ann.youtubeUrl || '',
      urgent: Boolean(ann.urgent),
      active: ann.active !== false,
    });
    setNotice(null);
    setIsComposerOpen(true);
  };

  const broadcastNotification = (ann: ExamAnnouncement) => {
    const existingNotifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
    const newNotif: Notification = {
      id: `not-exam-ann-${Date.now()}`,
      userId: 'ALL',
      title: ann.urgent ? `Urgent Exam Notice: ${ann.title}` : `Exam Announced: ${ann.title}`,
      message: `${ann.subjectCode ? `${ann.subjectCode} · ` : ''}Scheduled for ${ann.examDate || ann.date}${ann.venue ? ` at ${ann.venue}` : ''}.`,
      type: ann.urgent ? 'WARNING' : 'INFO',
      read: false,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    SwanayaDatabase.set('notifications', [newNotif, ...existingNotifs]);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const trimmedTitle = form.title.trim();
    const trimmedMessage = form.message.trim();
    if (!trimmedTitle || !trimmedMessage || !form.examDate) {
      setNotice({ type: 'error', text: 'Please fill in the announcement title, message, and examination date.' });
      return;
    }

    const selectedCourse = courses.find((c) => c.id === form.courseId);
    const courseName =
      form.courseId === 'ALL'
        ? 'All Academy Programs'
        : selectedCourse?.name || 'Academy Program';
    const nowIso = new Date().toISOString();
    const actorUid = firebaseUser?.uid || auth.currentUser?.uid || currentUser.id;
    const approvalStatus: ExamAnnouncement['approvalStatus'] = !form.active
      ? 'ARCHIVED'
      : isMdOrAdmin
      ? 'OFFICIAL'
      : 'PENDING_MD';

    setSaving(true);
    try {
      if (editingId) {
        const existing = announcements.find((a) => a.id === editingId);
        const patch: Partial<ExamAnnouncement> = {
          title: trimmedTitle,
          message: trimmedMessage,
          examType: form.examType,
          subjectCode: form.subjectCode.trim().toUpperCase(),
          subjectName: form.subjectName.trim(),
          courseId: form.courseId,
          courseName,
          date: form.examDate,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          deliveryMode: form.deliveryMode,
          venue: form.venue.trim(),
          registrationDeadline: form.registrationDeadline,
          instructions: form.instructions.trim(),
          pdfUrl: form.pdfUrl.trim(),
          youtubeUrl: form.youtubeUrl.trim(),
          urgent: form.urgent,
          active: form.active,
          approvalStatus: isMdOrAdmin
            ? form.active
              ? 'OFFICIAL'
              : 'ARCHIVED'
            : existing?.approvalStatus || 'PENDING_MD',
          verifiedBy: isMdOrAdmin ? currentUser.name : existing?.verifiedBy,
          verifiedAt: isMdOrAdmin ? nowIso : existing?.verifiedAt,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.updateExamAnnouncement(editingId, patch);
        }

        const updated = announcements.map((a) =>
          a.id === editingId ? { ...a, ...patch } : a
        );
        persistList(updated);
        SwanayaDatabase.log(
          currentUser.email,
          currentUser.name,
          'EXAM_ANNOUNCEMENT_UPDATED',
          `Updated examination notice: ${trimmedTitle}`
        );
        setNotice({ type: 'success', text: `Examination announcement "${trimmedTitle}" updated.` });
      } else {
        const annId = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const created: ExamAnnouncement = {
          id: annId,
          title: trimmedTitle,
          message: trimmedMessage,
          examType: form.examType,
          subjectCode: form.subjectCode.trim().toUpperCase(),
          subjectName: form.subjectName.trim(),
          courseId: form.courseId,
          courseName,
          date: form.examDate,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          deliveryMode: form.deliveryMode,
          venue: form.venue.trim(),
          registrationDeadline: form.registrationDeadline,
          instructions: form.instructions.trim(),
          pdfUrl: form.pdfUrl.trim(),
          youtubeUrl: form.youtubeUrl.trim(),
          urgent: form.urgent,
          active: form.active,
          approvalStatus,
          createdById: actorUid,
          createdByName: currentUser.name,
          createdByRole: currentUser.role,
          verifiedBy: isMdOrAdmin ? currentUser.name : undefined,
          verifiedAt: isMdOrAdmin ? nowIso : undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.createExamAnnouncement(created);
        }

        persistList([created, ...announcements]);
        if (approvalStatus === 'OFFICIAL' && created.active) {
          broadcastNotification(created);
        }
        SwanayaDatabase.log(
          currentUser.email,
          currentUser.name,
          'EXAM_ANNOUNCEMENT_PUBLISHED',
          `${approvalStatus}: ${trimmedTitle} (${form.examDate})`
        );
        setNotice({
          type: 'success',
          text:
            approvalStatus === 'OFFICIAL'
              ? `Official examination announcement "${trimmedTitle}" published and broadcast to students.`
              : `Announcement "${trimmedTitle}" drafted and queued for Managing Director verification.`,
        });
      }

      setIsComposerOpen(false);
      resetForm();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to save examination announcement. Please retry.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMdVerifyAnnouncement = async (ann: ExamAnnouncement) => {
    if (!isMdOrAdmin) return;
    const nowIso = new Date().toISOString();
    const patch: Partial<ExamAnnouncement> = {
      approvalStatus: 'OFFICIAL',
      active: true,
      verifiedBy: currentUser.name,
      verifiedAt: nowIso,
      updatedAt: nowIso,
    };
    if (auth.currentUser) {
      try {
        await academyService.updateExamAnnouncement(ann.id, patch);
      } catch {
        // Fallback if local-only record
      }
    }
    const updated = announcements.map((a) => (a.id === ann.id ? { ...a, ...patch } : a));
    persistList(updated);
    broadcastNotification({ ...ann, ...patch });
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'MD_VERIFY_EXAM_ANNOUNCEMENT',
      `Verified & broadcast exam notice: ${ann.title}`
    );
    setNotice({ type: 'success', text: `"${ann.title}" verified by MD and broadcast to portals.` });
    onRefreshAllData?.();
  };

  const handleToggleUrgent = async (ann: ExamAnnouncement) => {
    if (!isPublisher) return;
    const nextUrgent = !ann.urgent;
    const patch = { urgent: nextUrgent, updatedAt: new Date().toISOString() };
    if (auth.currentUser) {
      try {
        await academyService.updateExamAnnouncement(ann.id, patch);
      } catch {
        // Local fallback
      }
    }
    persistList(announcements.map((a) => (a.id === ann.id ? { ...a, ...patch } : a)));
    onRefreshAllData?.();
  };

  const handleToggleArchive = async (ann: ExamAnnouncement) => {
    if (!isMdOrAdmin) return;
    const nextActive = !ann.active;
    const patch: Partial<ExamAnnouncement> = {
      active: nextActive,
      approvalStatus: nextActive ? 'OFFICIAL' : 'ARCHIVED',
      updatedAt: new Date().toISOString(),
    };
    if (auth.currentUser) {
      try {
        await academyService.updateExamAnnouncement(ann.id, patch);
      } catch {
        // Local fallback
      }
    }
    persistList(announcements.map((a) => (a.id === ann.id ? { ...a, ...patch } : a)));
    setNotice({
      type: 'success',
      text: nextActive
        ? `"${ann.title}" restored to active announcements.`
        : `"${ann.title}" moved to archive.`,
    });
    onRefreshAllData?.();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (auth.currentUser) {
      try {
        await academyService.deleteExamAnnouncement(id);
      } catch {
        // Local fallback
      }
    }
    persistList(announcements.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
    setNotice({ type: 'success', text: 'Examination announcement deleted.' });
    onRefreshAllData?.();
  };

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      const status = ann.approvalStatus || (ann.active ? 'OFFICIAL' : 'ARCHIVED');

      if (!isPublisher) {
        if (!ann.active || status !== 'OFFICIAL') return false;
      }

      if (filterMode === 'URGENT' && (!ann.urgent || !ann.active)) return false;
      if (filterMode === 'SEMESTER_FINAL' && ann.examType !== 'SEMESTER_FINAL') return false;
      if (filterMode === 'MCQ_ASSESSMENT' && ann.examType !== 'MCQ_ASSESSMENT') return false;
      if (filterMode === 'PENDING_MD' && status !== 'PENDING_MD') return false;
      if (filterMode === 'ARCHIVED' && (ann.active && status !== 'ARCHIVED')) return false;

      if (filterMode === 'ALL' && isPublisher && !ann.active) return false;

      if (courseFilter !== 'ALL') {
        if (ann.courseId && ann.courseId !== 'ALL' && ann.courseId !== courseFilter) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hit =
          ann.title.toLowerCase().includes(q) ||
          ann.message.toLowerCase().includes(q) ||
          (ann.subjectCode || '').toLowerCase().includes(q) ||
          (ann.subjectName || '').toLowerCase().includes(q) ||
          (ann.courseName || '').toLowerCase().includes(q) ||
          (ann.venue || '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [announcements, isPublisher, filterMode, courseFilter, searchTerm]);

  const metrics = useMemo(() => {
    const officialActive = announcements.filter(
      (a) => a.active && (a.approvalStatus || 'OFFICIAL') === 'OFFICIAL'
    );
    const urgentCount = officialActive.filter((a) => a.urgent).length;
    const pendingMdCount = announcements.filter((a) => a.approvalStatus === 'PENDING_MD').length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingCount = officialActive.filter((a) => (a.examDate || a.date) >= today).length;
    return {
      activeTotal: officialActive.length,
      urgentCount,
      pendingMdCount,
      upcomingCount,
    };
  }, [announcements]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <Megaphone className="w-4 h-4 text-amber-400" />
            <span>Swanaya Examination Board · Official Circulars</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">
            Examination Announcements &amp; Schedule Board
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            {isMdOrAdmin
              ? 'Publish official examination circulars, approve faculty schedule notices, and broadcast urgent timetable updates across all student and parent portals.'
              : isPublisher
              ? 'Draft and submit examination timetable announcements for Managing Director verification and broadcast.'
              : 'Stay updated with official examination dates, venues, submission deadlines, and priority academy circulars.'}
          </p>
        </div>

        {isPublisher && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Announce Examination</span>
          </button>
        )}
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Active Official Circulars</p>
          <p className="text-2xl font-serif font-bold text-white tabular-nums mt-1">
            {metrics.activeTotal}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Upcoming Examination Dates</p>
          <p className="text-2xl font-serif font-bold text-emerald-400 tabular-nums mt-1">
            {metrics.upcomingCount}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">
            {isPublisher ? 'Pending MD Verification / Urgent' : 'Urgent Priority Notices'}
          </p>
          <p className="text-2xl font-serif font-bold text-amber-400 tabular-nums mt-1">
            {isPublisher
              ? `${metrics.pendingMdCount} Pending · ${metrics.urgentCount} Urgent`
              : metrics.urgentCount}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'Active Circulars' },
            { id: 'URGENT', label: `Urgent (${metrics.urgentCount})` },
            { id: 'SEMESTER_FINAL', label: 'Semester Finals' },
            { id: 'MCQ_ASSESSMENT', label: 'MCQ Exams' },
            ...(isPublisher
              ? [
                  { id: 'PENDING_MD', label: `Pending MD (${metrics.pendingMdCount})` },
                  { id: 'ARCHIVED', label: 'Archived' },
                ]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, subject code, venue..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white focus:border-amber-400 outline-none"
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:border-amber-400 outline-none cursor-pointer"
          >
            <option value="ALL">All Programs</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Announcements List */}
      {loading && announcements.length === 0 ? (
        <div className="py-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl text-xs text-slate-400">
          Loading examination circulars...
        </div>
      ) : visibleAnnouncements.length === 0 ? (
        <div className="py-14 px-6 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl space-y-4">
          <Megaphone className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              No Examination Announcements Match This View
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isPublisher
                ? 'Announce an upcoming examination timetable, MCQ assessment date, or answerbook upload deadline to notify candidates immediately.'
                : 'Official examination circulars and timetable updates published by the Swanaya Examination Board will appear here.'}
            </p>
          </div>
          {isPublisher && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-md cursor-pointer"
            >
              Announce First Examination
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleAnnouncements.map((ann) => {
            const status = ann.approvalStatus || (ann.active ? 'OFFICIAL' : 'ARCHIVED');
            const examTypeLabel = ann.examType
              ? EXAM_TYPE_LABELS[ann.examType]
              : 'Examination Notice';
            const deliveryLabel = ann.deliveryMode
              ? DELIVERY_MODE_LABELS[ann.deliveryMode]
              : 'Scheduled Mode';
            const canEditThis =
              isMdOrAdmin ||
              (isPublisher && ann.createdById === (firebaseUser?.uid || auth.currentUser?.uid || currentUser.id));

            return (
              <article
                key={ann.id}
                className={`bg-slate-900/75 border rounded-xl p-5 space-y-4 transition-colors ${
                  ann.urgent && ann.active
                    ? 'border-rose-500/40'
                    : status === 'PENDING_MD'
                    ? 'border-amber-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-[260px]">
                    {/* Clean unboxed metadata row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {ann.urgent && ann.active && (
                        <>
                          <span className="font-semibold text-rose-400 inline-flex items-center gap-1">
                            <BellRing className="w-3.5 h-3.5" />
                            <span>Urgent Alert</span>
                          </span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                        </>
                      )}
                      <span
                        className={`font-semibold ${
                          status === 'OFFICIAL'
                            ? 'text-emerald-400'
                            : status === 'PENDING_MD'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {status === 'OFFICIAL'
                          ? 'MD Verified Official Circular'
                          : status === 'PENDING_MD'
                          ? 'Pending MD Verification'
                          : 'Archived Circular'}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-amber-400 font-medium">{examTypeLabel}</span>
                      {ann.subjectCode && (
                        <>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="font-mono text-slate-300">{ann.subjectCode}</span>
                        </>
                      )}
                      {ann.courseName && (
                        <>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="text-slate-400">{ann.courseName}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-lg font-serif font-bold text-white leading-snug">
                      {ann.title}
                    </h3>

                    {ann.subjectName && (
                      <p className="text-xs font-medium text-slate-300">
                        Subject: {ann.subjectName}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingAnnouncement(ann)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Read Circular</span>
                  </button>
                </div>

                {/* Schedule Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Exam Date</span>
                      <span className="font-mono tabular-nums font-semibold text-white">
                        {ann.examDate || ann.date}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Time Window</span>
                      <span className="font-mono tabular-nums font-semibold text-white">
                        {ann.startTime || '10:00'} – {ann.endTime || '13:00'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 block uppercase">{deliveryLabel}</span>
                      <span className="font-medium text-slate-200 truncate block">
                        {ann.venue || 'Online Portal'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Deadline</span>
                      <span className="font-mono tabular-nums font-semibold text-amber-300">
                        {ann.registrationDeadline || 'Before Exam Start'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {ann.message}
                </p>

                {/* Attached Links + Action Footer */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {ann.pdfUrl && (
                      <a
                        href={ann.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download Schedule / Circular PDF</span>
                      </a>
                    )}
                    {ann.youtubeUrl && (
                      <a
                        href={ann.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-400 hover:text-rose-300 font-medium inline-flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Briefing Session</span>
                      </a>
                    )}
                    {ann.createdByName && (
                      <span className="text-slate-500">
                        Issued by {ann.createdByName}
                        {ann.verifiedBy ? ` · Verified by ${ann.verifiedBy}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isStudentOrAlumni && onNavigateTab && ann.active && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('exams')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Exams &amp; Answerbooks</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('exam-registration')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 cursor-pointer"
                        >
                          Exam Registration
                        </button>
                      </>
                    )}

                    {isMdOrAdmin && status === 'PENDING_MD' && (
                      <button
                        type="button"
                        onClick={() => handleMdVerifyAnnouncement(ann)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify &amp; Broadcast</span>
                      </button>
                    )}

                    {isPublisher && (
                      <button
                        type="button"
                        onClick={() => handleToggleUrgent(ann)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 cursor-pointer"
                      >
                        {ann.urgent ? 'Clear Urgent' : 'Mark Urgent'}
                      </button>
                    )}

                    {canEditThis && (
                      <button
                        type="button"
                        onClick={() => openEditModal(ann)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Edit</span>
                      </button>
                    )}

                    {isMdOrAdmin && (
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(ann)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{ann.active ? 'Archive' : 'Re-publish'}</span>
                      </button>
                    )}

                    {canEditThis && (
                      confirmDeleteId === ann.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(ann.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-md border border-slate-700 cursor-pointer"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* MODAL: Announce / Edit Examination */}
      {isComposerOpen && isPublisher && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-serif font-bold text-white">
                  {editingId ? 'Edit Examination Announcement' : 'Announce New Examination'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsComposerOpen(false);
                  resetForm();
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-semibold">
                  Announcement Headline *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Semester II Final Examination Schedule — November 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Examination Category
                  </label>
                  <select
                    value={form.examType}
                    onChange={(e) => setForm({ ...form, examType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    {Object.entries(EXAM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Target Program
                  </label>
                  <select
                    value={form.courseId}
                    onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    <option value="ALL">All Academy Programs</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={form.subjectCode}
                    onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
                    placeholder="e.g. SMA-301"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={form.subjectName}
                    onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                    placeholder="e.g. Media Production & AI Systems"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.examDate}
                    onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Deadline Date
                  </label>
                  <input
                    type="date"
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Delivery Mode
                  </label>
                  <select
                    value={form.deliveryMode}
                    onChange={(e) => setForm({ ...form, deliveryMode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    {Object.entries(DELIVERY_MODE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Venue / Examination Desk
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    placeholder="e.g. Studio Wing A / Online Exam Portal"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-semibold">
                  Official Circular Message *
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Write the official examination announcement details, syllabus scope, and answerbook / MCQ instructions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-semibold">
                  Candidate Guidelines &amp; Instructions
                </label>
                <textarea
                  rows={2}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Circular / Timetable PDF Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.pdfUrl}
                    onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold">
                    Briefing Video URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.youtubeUrl}
                    onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.urgent}
                    onChange={(e) => setForm({ ...form, urgent: e.target.checked })}
                    className="accent-rose-500 cursor-pointer"
                  />
                  <span>Mark as Urgent Priority Exam Alert</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="accent-amber-500 cursor-pointer"
                  />
                  <span>Display Actively on Student &amp; Parent Portals</span>
                </label>
              </div>

              {!isMdOrAdmin && (
                <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  Instructor-drafted examination announcements require Managing Director verification before broadcasting to students.
                </p>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? 'Publishing...'
                      : editingId
                      ? 'Save Changes'
                      : isMdOrAdmin
                      ? 'Publish Official Announcement'
                      : 'Submit for MD Verification'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detailed Official Circular Viewer */}
      {viewingAnnouncement && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-amber-500/30 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                  Swanaya Media Academy · Examination Circular
                </p>
                <h3 className="text-lg font-serif font-bold text-white">
                  {viewingAnnouncement.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAnnouncement(null)}
                className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div>
                <span className="text-slate-500 block">Examination Date</span>
                <span className="font-mono font-bold text-white">
                  {viewingAnnouncement.examDate || viewingAnnouncement.date}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Time Window</span>
                <span className="font-mono font-bold text-amber-400">
                  {viewingAnnouncement.startTime || '10:00'} – {viewingAnnouncement.endTime || '13:00'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Program / Subject</span>
                <span className="text-slate-200">
                  {viewingAnnouncement.courseName || 'All Programs'}
                  {viewingAnnouncement.subjectCode ? ` · ${viewingAnnouncement.subjectCode}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Venue / Mode</span>
                <span className="text-slate-200">
                  {viewingAnnouncement.venue || 'Online Exam Portal'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Announcement Circular
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                {viewingAnnouncement.message}
              </p>
            </div>

            {viewingAnnouncement.instructions && (
              <div className="space-y-1.5 bg-slate-950 border border-slate-800 rounded-lg p-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Candidate Conduct &amp; Submission Instructions
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {viewingAnnouncement.instructions}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                {viewingAnnouncement.verifiedBy
                  ? `Verified by ${viewingAnnouncement.verifiedBy}`
                  : `Issued by ${viewingAnnouncement.createdByName || 'Examination Board'}`}
              </span>
              <button
                type="button"
                onClick={() => setViewingAnnouncement(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
              >
                Close Circular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
