/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Calendar, Clock, MapPin, Plus, Search, CheckCircle2,
  AlertCircle, ShieldCheck, Edit3, Trash2, Archive, FileText, Video,
  X, Send, ArrowRight, BellRing, Eye, Users, Save
} from 'lucide-react';
import {
  SwanayaDatabase, User, Student, Course, Batch, ExamAnnouncement, Notification
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
  onNavigateTab,
  onRefreshAllData,
}: ExamAnnouncementsPortalProps) {
  const { user: firebaseUser } = useAuth();
  const courses = useMemo(() => SwanayaDatabase.get<Course[]>('courses') || [], []);
  const batches = useMemo(() => SwanayaDatabase.get<Batch[]>('batches') || [], []);

  const isMdOrPrincipal = ['MD', 'PRINCIPAL', 'SUPER_ADMIN'].includes(currentUser.role);
  const isPublisher = isMdOrPrincipal;
  const isStudentOrAlumni = false;

  const [announcements, setAnnouncements] = useState<ExamAnnouncement[]>(() => {
    const local = SwanayaDatabase.get<ExamAnnouncement[]>('examAnnouncements');
    return Array.isArray(local) ? local : [];
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filterMode, setFilterMode] = useState<
    'ALL' | 'OFFICIAL' | 'DRAFT' | 'URGENT' | 'SEMESTER_FINAL' | 'MCQ_ASSESSMENT' | 'ARCHIVED'
  >('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Inline Composer Form State (open by default for MD & Principal)
  const [isComposerOpen, setIsComposerOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState<'DRAFT' | 'OFFICIAL' | null>(null);
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
    batchId: 'ALL',
    customBatchName: '',
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
  });

  const canQueryAllInCloud = Boolean(firebaseUser && auth.currentUser && isMdOrPrincipal);

  const availableBatchesForForm = useMemo(() => {
    if (form.courseId === 'ALL') return batches;
    return batches.filter((b) => b.courseId === form.courseId);
  }, [batches, form.courseId]);

  const syncAnnouncements = async () => {
    setLoading(true);
    try {
      const localList = SwanayaDatabase.get<ExamAnnouncement[]>('examAnnouncements') || [];
      let cloudList: ExamAnnouncement[] = [];
      if (auth.currentUser && isMdOrPrincipal) {
        try {
          const fetched = await academyService.getExamAnnouncements(false);
          if (Array.isArray(fetched)) {
            cloudList = fetched as ExamAnnouncement[];
          }
        } catch {
          // Local-first fallback when offline or Firebase user lacks executive doc role
        }
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
      batchId: 'ALL',
      customBatchName: '',
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
    });
  };

  const openCreateForm = () => {
    resetForm();
    setNotice(null);
    setIsComposerOpen(true);
  };

  const openEditForm = (ann: ExamAnnouncement) => {
    const matchingBatch = batches.find((b) => b.id === ann.batchId);
    const isCustomBatch = Boolean(ann.batchId === 'CUSTOM' || (ann.batchName && !matchingBatch && ann.batchId !== 'ALL'));
    setEditingId(ann.id);
    setForm({
      title: ann.title || '',
      examType: ann.examType || 'SEMESTER_FINAL',
      subjectCode: ann.subjectCode || '',
      subjectName: ann.subjectName || '',
      courseId: ann.courseId || 'ALL',
      batchId: isCustomBatch ? 'CUSTOM' : (ann.batchId || 'ALL'),
      customBatchName: isCustomBatch ? (ann.batchName || '') : '',
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
    });
    setNotice(null);
    setIsComposerOpen(true);
  };

  const broadcastNotification = (ann: ExamAnnouncement) => {
    const existingNotifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
    const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const title = ann.urgent
      ? `Urgent Announced Exam: ${ann.title}`
      : `Announced Examination: ${ann.title}`;
    const batchLabel = ann.batchName ? ` · Batch: ${ann.batchName}` : '';
    const message = `${ann.subjectCode ? `${ann.subjectCode} · ` : ''}Scheduled for ${ann.examDate || ann.date}${batchLabel}${ann.venue ? ` at ${ann.venue}` : ''}.`;

    const mdNotif: Notification = {
      id: `not-exam-ann-md-${Date.now()}`,
      userId: 'usr-md',
      title,
      message,
      type: ann.urgent ? 'WARNING' : 'INFO',
      read: false,
      createdAt,
    };
    const principalNotif: Notification = {
      id: `not-exam-ann-principal-${Date.now() + 1}`,
      userId: 'usr-principal',
      title,
      message,
      type: ann.urgent ? 'WARNING' : 'INFO',
      read: false,
      createdAt,
    };
    SwanayaDatabase.set('notifications', [mdNotif, principalNotif, ...existingNotifs]);
  };

  const resolveBatchSelection = () => {
    if (form.batchId === 'CUSTOM') {
      const cleanName = form.customBatchName.trim();
      return {
        batchId: 'CUSTOM',
        batchName: cleanName || 'Target Batch',
      };
    }
    if (!form.batchId || form.batchId === 'ALL') {
      return {
        batchId: 'ALL',
        batchName: 'All Academy Batches',
      };
    }
    const matched = batches.find((b) => b.id === form.batchId);
    return {
      batchId: form.batchId,
      batchName: matched ? `${matched.name}${matched.code ? ` (${matched.code})` : ''}` : form.batchId,
    };
  };

  const saveAnnouncement = async (targetStatus: 'DRAFT' | 'OFFICIAL') => {
    setNotice(null);

    const trimmedTitle = form.title.trim();
    const trimmedMessage = form.message.trim();
    if (!trimmedTitle || !trimmedMessage || !form.examDate) {
      setNotice({
        type: 'error',
        text: 'Please provide Exam Title, Exam Date, and Description before saving.',
      });
      return;
    }

    if (form.batchId === 'CUSTOM' && !form.customBatchName.trim()) {
      setNotice({
        type: 'error',
        text: 'Please enter the Target Batch name or choose an existing batch.',
      });
      return;
    }

    const selectedCourse = courses.find((c) => c.id === form.courseId);
    const courseName =
      form.courseId === 'ALL'
        ? 'All Academy Programs'
        : selectedCourse?.name || 'Academy Program';
    const { batchId, batchName } = resolveBatchSelection();

    const nowIso = new Date().toISOString();
    const actorUid = auth.currentUser?.uid || firebaseUser?.uid || currentUser.id;
    const isPublishing = targetStatus === 'OFFICIAL';

    setSavingMode(targetStatus);
    try {
      let persistedToCloud = false;

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
          batchId,
          batchName,
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
          active: isPublishing,
          approvalStatus: targetStatus,
          ...(isPublishing
            ? { verifiedBy: currentUser.name, verifiedAt: nowIso }
            : {}),
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.updateExamAnnouncement(editingId, patch);
          persistedToCloud = true;
        }

        const updatedList = announcements.map((a) =>
          a.id === editingId ? { ...a, ...patch } : a
        );
        persistList(updatedList);
        if (isPublishing && existing?.approvalStatus !== 'OFFICIAL') {
          const merged = updatedList.find((a) => a.id === editingId);
          if (merged) broadcastNotification(merged);
        }

        SwanayaDatabase.log(
          currentUser.email,
          currentUser.name,
          isPublishing ? 'EXAM_ANNOUNCEMENT_PUBLISHED' : 'EXAM_ANNOUNCEMENT_DRAFTED',
          `${targetStatus}: ${trimmedTitle} (${batchName} · ${form.examDate})`
        );

        setNotice({
          type: 'success',
          text: isPublishing
            ? `Examination announcement "${trimmedTitle}" published for ${batchName}${persistedToCloud ? ' and saved to Firestore database.' : '.'}`
            : `Draft "${trimmedTitle}" updated for ${batchName}${persistedToCloud ? ' and saved to Firestore database.' : '.'}`,
        });
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
          batchId,
          batchName,
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
          active: isPublishing,
          approvalStatus: targetStatus,
          createdById: actorUid,
          createdByName: currentUser.name,
          createdByRole: currentUser.role,
          ...(isPublishing
            ? { verifiedBy: currentUser.name, verifiedAt: nowIso }
            : {}),
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (auth.currentUser) {
          await academyService.createExamAnnouncement(created);
          persistedToCloud = true;
        }

        persistList([created, ...announcements]);
        if (isPublishing) {
          broadcastNotification(created);
        }

        SwanayaDatabase.log(
          currentUser.email,
          currentUser.name,
          isPublishing ? 'EXAM_ANNOUNCEMENT_PUBLISHED' : 'EXAM_ANNOUNCEMENT_DRAFTED',
          `${targetStatus}: ${trimmedTitle} (${batchName} · ${form.examDate})`
        );

        setNotice({
          type: 'success',
          text: isPublishing
            ? `Published examination announcement "${trimmedTitle}" for ${batchName}${persistedToCloud ? ' and persisted to database.' : '.'}`
            : `Saved draft "${trimmedTitle}" for ${batchName}${persistedToCloud ? ' to database.' : '.'}`,
        });
      }

      resetForm();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to persist examination announcement. Please retry.',
      });
    } finally {
      setSavingMode(null);
    }
  };

  const handlePublishDraft = async (ann: ExamAnnouncement) => {
    if (!isMdOrPrincipal) return;
    const nowIso = new Date().toISOString();
    const patch: Partial<ExamAnnouncement> = {
      approvalStatus: 'OFFICIAL',
      active: true,
      verifiedBy: currentUser.name,
      verifiedAt: nowIso,
      updatedAt: nowIso,
    };
    try {
      if (auth.currentUser) {
        await academyService.updateExamAnnouncement(ann.id, patch);
      }
      const updated = announcements.map((a) => (a.id === ann.id ? { ...a, ...patch } : a));
      persistList(updated);
      broadcastNotification({ ...ann, ...patch });
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'EXAM_ANNOUNCEMENT_PUBLISHED',
        `Published draft exam announcement: ${ann.title}`
      );
      setNotice({
        type: 'success',
        text: `"${ann.title}" published to the official Announced Examination board.`,
      });
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to publish draft to Firestore.',
      });
    }
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
    if (!isMdOrPrincipal) return;
    const isCurrentlyArchived = ann.approvalStatus === 'ARCHIVED' || (!ann.active && ann.approvalStatus !== 'DRAFT');
    const nextActive = isCurrentlyArchived;
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
        ? `"${ann.title}" restored and published.`
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
    if (editingId === id) {
      resetForm();
    }
    setNotice({ type: 'success', text: 'Examination announcement deleted.' });
    onRefreshAllData?.();
  };

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      const status = ann.approvalStatus || (ann.active ? 'OFFICIAL' : 'ARCHIVED');

      if (!isPublisher) {
        if (!ann.active || status !== 'OFFICIAL') return false;
      }

      if (filterMode === 'OFFICIAL' && status !== 'OFFICIAL') return false;
      if (filterMode === 'DRAFT' && status !== 'DRAFT') return false;
      if (filterMode === 'URGENT' && (!ann.urgent || status === 'ARCHIVED')) return false;
      if (filterMode === 'SEMESTER_FINAL' && ann.examType !== 'SEMESTER_FINAL') return false;
      if (filterMode === 'MCQ_ASSESSMENT' && ann.examType !== 'MCQ_ASSESSMENT') return false;
      if (filterMode === 'ARCHIVED' && status !== 'ARCHIVED') return false;

      if (filterMode === 'ALL' && status === 'ARCHIVED') return false;

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
          (ann.batchName || '').toLowerCase().includes(q) ||
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
      (a) => (a.approvalStatus || (a.active ? 'OFFICIAL' : 'ARCHIVED')) === 'OFFICIAL'
    );
    const draftCount = announcements.filter((a) => a.approvalStatus === 'DRAFT').length;
    const urgentCount = officialActive.filter((a) => a.urgent).length;
    const today = new Date().toISOString().split('T')[0];
    const upcomingCount = officialActive.filter((a) => (a.examDate || a.date) >= today).length;
    return {
      activeTotal: officialActive.length,
      draftCount,
      urgentCount,
      upcomingCount,
    };
  }, [announcements]);

  const resolveDisplayBatch = (ann: ExamAnnouncement) => {
    if (ann.batchName) return ann.batchName;
    if (!ann.batchId || ann.batchId === 'ALL') return 'All Academy Batches';
    const found = batches.find((b) => b.id === ann.batchId);
    return found ? `${found.name}${found.code ? ` (${found.code})` : ''}` : ann.batchId;
  };

  if (!isMdOrPrincipal) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center space-y-2">
        <ShieldCheck className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-base font-serif font-bold text-white">
          Announced Examination · Restricted Access
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Announced Examination schedules and executive circulars are visible exclusively to the Managing Director (MD) and Academy Principal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <Megaphone className="w-4 h-4 text-amber-400" />
            <span>MD &amp; Principal Examination Board · Executive Ledger</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">
            Announced Examination
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Draft, target by batch, and publish official examination announcements for Managing Director and Principal oversight.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isComposerOpen && !editingId) {
              setIsComposerOpen(false);
            } else {
              openCreateForm();
            }
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/10 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isComposerOpen && !editingId ? 'Hide Announcement Form' : 'New Announcement'}</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Published Announcements</p>
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
          <p className="text-xs text-slate-400">Saved Drafts &amp; Urgent</p>
          <p className="text-2xl font-serif font-bold text-amber-400 tabular-nums mt-1">
            {metrics.draftCount} Drafts · {metrics.urgentCount} Urgent
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

      {/* INLINE FORM: Draft & Publish Examination Announcement */}
      {isComposerOpen && (
        <section
          aria-label="Draft and publish examination announcement"
          className="bg-[#0B0F17] border border-slate-800 rounded-xl overflow-hidden shadow-xl"
        >
          <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-serif font-bold text-white">
                  {editingId ? 'Edit Examination Announcement' : 'Draft & Publish Examination Announcement'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Save as a draft for later review or publish directly to the executive register.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap"
                >
                  Clear Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsComposerOpen(false);
                  resetForm();
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Collapse form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveAnnouncement('OFFICIAL');
            }}
            className="p-6 space-y-5"
          >
            {/* Primary 4 Core Fields: Exam Title, Date, Target Batch, Description */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 space-y-1.5">
                <label htmlFor="exam-ann-title" className="text-[11px] text-slate-300 uppercase font-semibold tracking-wider block">
                  Exam Title *
                </label>
                <input
                  id="exam-ann-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Semester II Final Examination — November 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label htmlFor="exam-ann-date" className="text-[11px] text-slate-300 uppercase font-semibold tracking-wider block">
                  Exam Date *
                </label>
                <input
                  id="exam-ann-date"
                  type="date"
                  required
                  value={form.examDate}
                  onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label htmlFor="exam-ann-batch" className="text-[11px] text-slate-300 uppercase font-semibold tracking-wider block">
                  Target Batch *
                </label>
                <select
                  id="exam-ann-batch"
                  value={form.batchId}
                  onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                >
                  <option value="ALL">All Academy Batches</option>
                  {availableBatchesForForm.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.code ? ` (${b.code})` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">Specify Target Batch Name...</option>
                </select>
              </div>
            </div>

            {form.batchId === 'CUSTOM' && (
              <div className="space-y-1.5">
                <label htmlFor="exam-ann-custom-batch" className="text-[11px] text-slate-300 uppercase font-semibold tracking-wider block">
                  Target Batch Name *
                </label>
                <input
                  id="exam-ann-custom-batch"
                  type="text"
                  value={form.customBatchName}
                  onChange={(e) => setForm({ ...form, customBatchName: e.target.value })}
                  placeholder="e.g. Oct 2026 Morning Batch / ADWD-2026-B1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="exam-ann-description" className="text-[11px] text-slate-300 uppercase font-semibold tracking-wider block">
                Description *
              </label>
              <textarea
                id="exam-ann-description"
                rows={4}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Enter the examination announcement description, syllabus coverage, evaluation format, and reporting requirements..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
              />
            </div>

            {/* Secondary Schedule & Metadata Fields */}
            <div className="pt-2 border-t border-slate-800/80 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Examination Category
                  </label>
                  <select
                    value={form.examType}
                    onChange={(e) => setForm({ ...form, examType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    {Object.entries(EXAM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Target Program
                  </label>
                  <select
                    value={form.courseId}
                    onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    <option value="ALL">All Academy Programs</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={form.subjectCode}
                    onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
                    placeholder="e.g. SMA-301"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={form.subjectName}
                    onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                    placeholder="e.g. Media Production & AI"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Deadline Date
                  </label>
                  <input
                    type="date"
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Delivery Mode
                  </label>
                  <select
                    value={form.deliveryMode}
                    onChange={(e) => setForm({ ...form, deliveryMode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    {Object.entries(DELIVERY_MODE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Venue / Desk
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    placeholder="e.g. Studio Wing A"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Candidate Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Circular PDF URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.pdfUrl}
                    onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Briefing Video URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.youtubeUrl}
                    onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.urgent}
                  onChange={(e) => setForm({ ...form, urgent: e.target.checked })}
                  className="accent-rose-500 cursor-pointer"
                />
                <span>Mark as Urgent Priority Exam Alert</span>
              </label>

              <div className="flex flex-wrap items-center gap-2.5">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs text-slate-300 font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  type="button"
                  disabled={savingMode !== null}
                  onClick={() => saveAnnouncement('DRAFT')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>{savingMode === 'DRAFT' ? 'Saving Draft...' : 'Save as Draft'}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingMode !== null}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {savingMode === 'OFFICIAL'
                      ? 'Publishing...'
                      : editingId
                      ? 'Update & Publish'
                      : 'Publish Announcement'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'All Notices' },
            { id: 'OFFICIAL', label: `Published (${metrics.activeTotal})` },
            { id: 'DRAFT', label: `Drafts (${metrics.draftCount})` },
            { id: 'URGENT', label: `Urgent (${metrics.urgentCount})` },
            { id: 'SEMESTER_FINAL', label: 'Semester Finals' },
            { id: 'MCQ_ASSESSMENT', label: 'MCQ Exams' },
            { id: 'ARCHIVED', label: 'Archived' },
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
              placeholder="Search title, batch, subject, venue..."
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
          Loading announced examinations...
        </div>
      ) : visibleAnnouncements.length === 0 ? (
        <div className="py-14 px-6 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl space-y-4">
          <Megaphone className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">
              No Announced Examinations Match This View
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Use the announcement form above to draft or publish an upcoming examination date and target batch.
            </p>
          </div>
          {!isComposerOpen && (
            <button
              type="button"
              onClick={openCreateForm}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-md cursor-pointer"
            >
              Open Announcement Form
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
            const batchLabel = resolveDisplayBatch(ann);

            return (
              <article
                key={ann.id}
                className={`bg-slate-900/75 border rounded-xl p-5 space-y-4 transition-colors ${
                  ann.urgent && status === 'OFFICIAL'
                    ? 'border-rose-500/40'
                    : status === 'DRAFT'
                    ? 'border-amber-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-[260px]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {ann.urgent && status !== 'ARCHIVED' && (
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
                            : status === 'DRAFT'
                            ? 'text-amber-400'
                            : status === 'PENDING_MD'
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {status === 'OFFICIAL'
                          ? 'Published Official Circular'
                          : status === 'DRAFT'
                          ? 'Saved Draft'
                          : status === 'PENDING_MD'
                          ? 'Pending Verification'
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

                {/* Schedule & Batch Metadata Grid */}
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
                    <Users className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 block uppercase">Target Batch</span>
                      <span className="font-medium text-white truncate block">
                        {batchLabel}
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
                        <span>Schedule PDF</span>
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
                        {status === 'DRAFT' ? 'Drafted by ' : 'Published by '}
                        {ann.createdByName}
                        {ann.verifiedBy && status === 'OFFICIAL' ? ` · Verified by ${ann.verifiedBy}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isStudentOrAlumni && onNavigateTab && ann.active && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('exams')}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Open Exams</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(status === 'DRAFT' || status === 'PENDING_MD') && (
                      <button
                        type="button"
                        onClick={() => handlePublishDraft(ann)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish Announcement</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleUrgent(ann)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      {ann.urgent ? 'Clear Urgent' : 'Mark Urgent'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditForm(ann)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>

                    {status !== 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(ann)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md border border-slate-700 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{status === 'ARCHIVED' ? 'Re-publish' : 'Archive'}</span>
                      </button>
                    )}

                    {confirmDeleteId === ann.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded cursor-pointer whitespace-nowrap"
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
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* MODAL: Detailed Official Circular Viewer */}
      {viewingAnnouncement && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-amber-500/30 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                  Swanaya Media Academy · Announced Examination
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
                <span className="text-slate-500 block">Target Batch</span>
                <span className="font-semibold text-amber-400">
                  {resolveDisplayBatch(viewingAnnouncement)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Time Window</span>
                <span className="font-mono font-bold text-white">
                  {viewingAnnouncement.startTime || '10:00'} – {viewingAnnouncement.endTime || '13:00'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Program / Venue</span>
                <span className="text-slate-200">
                  {viewingAnnouncement.courseName || 'All Programs'} · {viewingAnnouncement.venue || 'Online Portal'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Announcement Description
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
