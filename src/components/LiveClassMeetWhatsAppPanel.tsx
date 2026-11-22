/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Video,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  PauseCircle,
  PlayCircle,
  QrCode,
  Users,
  X,
} from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { Batch, ClassSchedule, Course, Instructor, LiveClassSession, Notification, Subject, SwanayaDatabase } from '../db/mockDb';
import {
  academyService,
  normalizeGoogleMeetUrl,
  normalizeWhatsappUrl,
} from '../services/academyService';

interface LiveClassMeetWhatsAppPanelProps {
  mode: 'MANAGE' | 'STUDENT';
  currentUser: any;
  courses: Course[];
  batches?: Batch[];
  subjects?: Subject[];
  instructors?: Instructor[];
  instructorUserId?: string;
  studentCourseId?: string;
  onOpenQrScanner?: () => void;
  onRefreshAllData?: () => void;
}

export default function LiveClassMeetWhatsAppPanel({
  mode,
  currentUser,
  courses,
  batches = [],
  subjects = [],
  instructors: propInstructors,
  instructorUserId,
  studentCourseId,
  onOpenQrScanner,
  onRefreshAllData,
}: LiveClassMeetWhatsAppPanelProps) {
  const instructorsList = useMemo(
    () => propInstructors || SwanayaDatabase.get<Instructor[]>('instructors') || [],
    [propInstructors]
  );
  const isTeacherRole = currentUser?.role === 'INSTRUCTOR';
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(Boolean(auth.currentUser));
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('ALL');
  const [facultyScope, setFacultyScope] = useState<'ALL' | 'ASSIGNED_TO_ME'>(isTeacherRole ? 'ASSIGNED_TO_ME' : 'ALL');
  const [studentScope, setStudentScope] = useState<'MY_COURSE' | 'ALL'>(
    studentCourseId ? 'MY_COURSE' : 'ALL'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<LiveClassSession | null>(null);
  const [showForm, setShowForm] = useState<boolean>(mode === 'MANAGE');

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultInstructorId =
    instructorUserId ||
    instructorsList.find((i) => i.userId === currentUser?.id)?.id ||
    instructorsList[0]?.id ||
    currentUser?.id ||
    'inst-1';

  const [form, setForm] = useState({
    title: '',
    courseId: courses[0]?.id || '',
    batchId: batches[0]?.id || 'b-1',
    subjectId: subjects[0]?.id || '',
    instructorId: defaultInstructorId,
    date: todayStr,
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    room: 'Google Meet Classroom',
    type: 'ONLINE' as ClassSchedule['type'],
    googleMeetUrl: '',
    whatsappGroupName: '',
    whatsappGroupUrl: '',
    facultyWhatsapp: '',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseConnected(Boolean(fbUser));
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!form.courseId && courses.length > 0) {
      setForm((prev) => ({ ...prev, courseId: courses[0].id }));
    }
  }, [courses]);

  useEffect(() => {
    setLoading(true);
    const unsub = academyService.subscribeClassSessions({
      includeInactive: mode === 'MANAGE',
      onData: (list) => {
        setSessions(list);
        setLoading(false);
      },
      onError: (err) => {
        setNotice({ type: 'error', text: err.message || 'Unable to sync live class sessions.' });
        setLoading(false);
      },
    });
    return () => unsub();
  }, [mode, firebaseConnected]);

  const handleConnectGoogleAccount = async (): Promise<boolean> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const ok = Boolean(cred?.user || auth.currentUser);
      setFirebaseConnected(ok);
      if (ok) {
        setNotice({
          type: 'success',
          text: `Connected Google account (${cred?.user?.email || auth.currentUser?.email || 'Verified'}) for cross-device Firestore sync.`,
        });
      }
      return ok;
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Google sign-in was cancelled or unavailable.',
      });
      return false;
    }
  };

  const resetForm = () => {
    setEditingSession(null);
    setForm({
      title: '',
      courseId: courses[0]?.id || '',
      batchId: batches[0]?.id || 'b-1',
      subjectId: subjects[0]?.id || '',
      instructorId: defaultInstructorId,
      date: todayStr,
      startTime: '10:00 AM',
      endTime: '11:30 AM',
      room: 'Google Meet Classroom',
      type: 'ONLINE',
      googleMeetUrl: '',
      whatsappGroupName: '',
      whatsappGroupUrl: '',
      facultyWhatsapp: '',
      notes: '',
      isActive: true,
    });
  };

  const handleEditStart = (session: LiveClassSession) => {
    setEditingSession(session);
    setShowForm(true);
    setForm({
      title: session.title || '',
      courseId: session.courseId || courses[0]?.id || '',
      batchId: session.batchId || batches[0]?.id || 'b-1',
      subjectId: session.subjectId || '',
      instructorId: session.instructorId || defaultInstructorId,
      date: session.date || todayStr,
      startTime: session.startTime || '10:00 AM',
      endTime: session.endTime || '11:30 AM',
      room: session.room || 'Google Meet Classroom',
      type: session.type || 'ONLINE',
      googleMeetUrl: session.googleMeetUrl || session.meetingLink || '',
      whatsappGroupName: session.whatsappGroupName || '',
      whatsappGroupUrl: session.whatsappGroupUrl || '',
      facultyWhatsapp: session.facultyWhatsapp || '',
      notes: session.notes || '',
      isActive: session.isActive !== false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!form.title.trim()) {
      setNotice({ type: 'error', text: 'Please enter a Class Topic or WhatsApp Group Title.' });
      return;
    }

    const normalizedMeet = normalizeGoogleMeetUrl(form.googleMeetUrl);
    const normalizedWa = normalizeWhatsappUrl(form.whatsappGroupUrl);
    if (!normalizedMeet && !normalizedWa) {
      setNotice({
        type: 'error',
        text: 'Add at least a Google Meet link or a WhatsApp Class Group invite link.',
      });
      return;
    }

    setSaving(true);
    try {
      if (!auth.currentUser) {
        const connected = await handleConnectGoogleAccount();
        if (!connected) {
          setNotice({
            type: 'info',
            text: 'Saved on this browser only. Connect your Google Faculty/Admin account to publish across all student devices.',
          });
        }
      }

      const selectedCourse = courses.find((c) => c.id === form.courseId);
      const selectedBatch = batches.find((b) => b.id === form.batchId);
      const selectedSubject = subjects.find((s) => s.id === form.subjectId);
      const assignedInst = instructorsList.find(
        (i) => i.id === form.instructorId || i.userId === form.instructorId
      );
      const resolvedInstructorId = assignedInst?.id || form.instructorId || currentUser?.id || 'inst-1';
      const resolvedInstructorName = assignedInst?.name || currentUser?.name || 'Swanaya Faculty';

      const { session, syncedCloud } = await academyService.saveClassSession({
        id: editingSession?.id,
        existingCreatedAt: editingSession?.createdAt,
        existingCreatedById: editingSession?.createdById,
        title: form.title,
        courseId: form.courseId || selectedCourse?.id || 'general',
        courseCode: selectedCourse?.code || '',
        courseName: selectedCourse?.name || 'Academy Cohort',
        batchId: form.batchId || 'b-1',
        batchName: selectedBatch?.name || 'Cohort Batch',
        subjectId: form.subjectId || '',
        subjectName: selectedSubject?.name || '',
        instructorId: resolvedInstructorId,
        instructorName: resolvedInstructorName,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || (normalizedMeet ? 'Google Meet Classroom' : 'Campus Studio'),
        type: form.type,
        googleMeetUrl: normalizedMeet,
        whatsappGroupUrl: normalizedWa,
        whatsappGroupName:
          form.whatsappGroupName.trim() ||
          (selectedCourse ? `${selectedCourse.code || selectedCourse.name} · WhatsApp Group` : ''),
        facultyWhatsapp: form.facultyWhatsapp,
        notes: form.notes,
        isActive: form.isActive,
      });

      // Notify assigned teacher when Google Meet session is assigned
      if (assignedInst) {
        const existingNotifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
        const targetId = assignedInst.userId || assignedInst.id;
        const notif: Notification = {
          id: `notif-meet-${Date.now()}`,
          userId: targetId,
          title: 'Google Meet Class Assigned to You',
          message: `Session "${session.title}" (${session.date} ${session.startTime}–${session.endTime}) has been assigned to you.${normalizedMeet ? ` Meet Link: ${normalizedMeet}` : ''}`,
          type: 'INFO',
          read: false,
          createdAt: new Date().toISOString(),
        };
        SwanayaDatabase.set('notifications', [notif, ...existingNotifs]);
      }

      setNotice({
        type: 'success',
        text: syncedCloud
          ? `Published "${session.title}" (Assigned Faculty: ${resolvedInstructorName}) to Firestore. Teacher & students can join immediately.`
          : `Saved "${session.title}" locally for Faculty ${resolvedInstructorName}. Connect Google Sync to broadcast across browsers.`,
      });

      resetForm();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to save Google Meet / WhatsApp Class session.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (session: LiveClassSession) => {
    try {
      if (!auth.currentUser) {
        await handleConnectGoogleAccount();
      }
      await academyService.toggleClassSessionActive(session, !session.isActive);
      setNotice({
        type: 'success',
        text: session.isActive
          ? `"${session.title}" paused for students.`
          : `"${session.title}" is now live for students.`,
      });
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update session status.' });
    }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      if (!auth.currentUser) {
        const ok = await handleConnectGoogleAccount();
        if (!ok) return;
      }
      await academyService.deleteClassSession(sessionId);
      setConfirmDeleteId(null);
      setNotice({ type: 'success', text: 'Class session removed.' });
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to delete class session.' });
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setNotice({ type: 'info', text: `Link: ${text}` });
    }
  };

  const isAssignedToCurrentUser = (s: LiveClassSession) => {
    const myInstIds = [
      instructorUserId,
      currentUser?.id,
      ...instructorsList
        .filter((i) => i.userId === currentUser?.id || (i.email && currentUser?.email && i.email.toLowerCase() === currentUser.email.toLowerCase()))
        .map((i) => i.id),
    ].filter(Boolean);
    return Boolean(
      (s.instructorId && myInstIds.includes(s.instructorId)) ||
      (s.instructorName && currentUser?.name && s.instructorName.toLowerCase() === currentUser.name.toLowerCase())
    );
  };

  const visibleSessions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sessions.filter((s) => {
      if (mode === 'STUDENT' && !s.isActive) return false;
      if (mode === 'MANAGE' && facultyScope === 'ASSIGNED_TO_ME' && !isAssignedToCurrentUser(s)) {
        return false;
      }
      if (
        mode === 'STUDENT' &&
        studentScope === 'MY_COURSE' &&
        studentCourseId &&
        s.courseId !== studentCourseId &&
        s.courseId !== 'general'
      ) {
        return false;
      }
      if (filterCourseId !== 'ALL' && s.courseId !== filterCourseId) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.courseName || '').toLowerCase().includes(q) ||
        (s.courseCode || '').toLowerCase().includes(q) ||
        (s.whatsappGroupName || '').toLowerCase().includes(q) ||
        (s.instructorName || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, mode, facultyScope, studentScope, studentCourseId, filterCourseId, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Class WhatsApp Groups &amp; Google Meet Studio</span>
          </h3>
          <p className="text-xs text-slate-400">
            {mode === 'MANAGE'
              ? 'Publish persistent WhatsApp class group invite links and live Google Meet classrooms synced across all student browsers.'
              : 'Join your course WhatsApp community group and enter scheduled Google Meet live classes directly from your portal.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!firebaseConnected && (
            <button
              type="button"
              onClick={() => void handleConnectGoogleAccount()}
              className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Connect Google Sync</span>
            </button>
          )}

          {mode === 'MANAGE' && (
            <>
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Video className="w-3.5 h-3.5 text-amber-400" />
                <span>Start Instant Google Meet</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <button
                type="button"
                onClick={() => {
                  if (showForm && editingSession) {
                    resetForm();
                  } else {
                    setShowForm((prev) => !prev);
                  }
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showForm ? 'Hide Editor' : 'Add Meet / WhatsApp'}</span>
              </button>
            </>
          )}

          {mode === 'STUDENT' && onOpenQrScanner && (
            <button
              type="button"
              onClick={onOpenQrScanner}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan Class Attendance QR</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg p-3.5 border text-xs flex items-center justify-between gap-3 ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 rounded hover:bg-black/30 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MANAGE FORM */}
      {mode === 'MANAGE' && showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <div>
              <h4 className="text-sm font-serif font-bold text-white">
                {editingSession
                  ? `Editing: ${editingSession.title}`
                  : 'Create Live Google Meet & Class WhatsApp Group'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Start an instant Google Meet room, copy its URL, and attach your batch WhatsApp group invite.
              </p>
            </div>
            {editingSession && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded cursor-pointer hover:text-white whitespace-nowrap shrink-0"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Course Program
              </label>
              <select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              >
                <option value="general">All Courses · Open Academy Workshop</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} · ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Class Session / Cohort Title
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Week 4 Live Lecture · Brand Storytelling"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-cyan-400 block font-bold">
                Assigned Faculty / Teacher Host
              </label>
              <select
                value={form.instructorId}
                onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                className="w-full bg-slate-950 border border-cyan-500/30 rounded px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-400"
              >
                {instructorsList.length === 0 ? (
                  <option value={currentUser?.id || 'inst-1'}>
                    {currentUser?.name || 'Academy Faculty'}
                  </option>
                ) : (
                  instructorsList.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.specialization || 'Faculty'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase text-slate-400">
                  Google Meet Link
                </label>
                <a
                  href="https://meet.google.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Create Meet Room</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={form.googleMeetUrl}
                onChange={(e) => setForm({ ...form, googleMeetUrl: e.target.value })}
                placeholder="https://meet.google.com/abc-defg-hij or abc-defg-hij"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                WhatsApp Class Group Invite Link
              </label>
              <input
                type="text"
                value={form.whatsappGroupUrl}
                onChange={(e) => setForm({ ...form, whatsappGroupUrl: e.target.value })}
                placeholder="https://chat.whatsapp.com/YourGroupInviteCode"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                WhatsApp Group Name (Optional)
              </label>
              <input
                type="text"
                value={form.whatsappGroupName}
                onChange={(e) => setForm({ ...form, whatsappGroupName: e.target.value })}
                placeholder="e.g. SMA Batch 2026 Official Group"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Start Time
              </label>
              <input
                type="text"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                placeholder="10:00 AM"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                End Time
              </label>
              <input
                type="text"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                placeholder="11:30 AM"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Delivery Mode
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ClassSchedule['type'] })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              >
                <option value="ONLINE">Google Meet Online</option>
                <option value="HYBRID">Hybrid (Studio + Google Meet)</option>
                <option value="WORKSHOP">Live Workshop</option>
                <option value="LAB">Guided Lab</option>
                <option value="PHYSICAL">Campus Studio</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Faculty WhatsApp Direct (Optional)
              </label>
              <input
                type="text"
                value={form.facultyWhatsapp}
                onChange={(e) => setForm({ ...form, facultyWhatsapp: e.target.value })}
                placeholder="+91 94460 11223 or wa.me/..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 block">
                Agenda / Student Note (Optional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Join 5 mins early with portfolio draft ready"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-850 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-amber-500 rounded"
              />
              <span>Visible immediately to enrolled students</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {saving
                ? 'Publishing...'
                : editingSession
                ? 'Update Class & WhatsApp Links'
                : 'Publish Meet & WhatsApp Group'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search live class title, course, instructor, or WhatsApp group..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'MANAGE' && (
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded">
              <button
                type="button"
                onClick={() => setFacultyScope('ASSIGNED_TO_ME')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  facultyScope === 'ASSIGNED_TO_ME'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Assigned to Me
              </button>
              <button
                type="button"
                onClick={() => setFacultyScope('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  facultyScope === 'ALL'
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Sessions
              </button>
            </div>
          )}

          {mode === 'STUDENT' && studentCourseId && (
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded">
              <button
                type="button"
                onClick={() => setStudentScope('MY_COURSE')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  studentScope === 'MY_COURSE'
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Course
              </button>
              <button
                type="button"
                onClick={() => setStudentScope('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  studentScope === 'ALL'
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Live Rooms
              </button>
            </div>
          )}

          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-44 animate-pulse"
            />
          ))}
        </div>
      ) : visibleSessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-10 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <h4 className="text-sm font-serif font-bold text-slate-200">
            No Live Google Meet or WhatsApp Groups Published Yet
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {mode === 'MANAGE'
              ? 'Use the form above to attach your course WhatsApp group invite and live Google Meet link.'
              : 'Your instructor or admin has not published an active Google Meet classroom or WhatsApp group for this filter yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visibleSessions.map((session) => {
            const meetUrl = session.googleMeetUrl || session.meetingLink || '';
            const waUrl = session.whatsappGroupUrl || '';
            const facultyWaUrl = session.facultyWhatsapp || '';
            const resolvedCourse = courses.find((c) => c.id === session.courseId);
            const courseLabel =
              session.courseCode ||
              resolvedCourse?.code ||
              session.courseName ||
              resolvedCourse?.name ||
              'Academy Cohort';

            return (
              <div
                key={session.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Unboxed quiet metadata line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-amber-400 font-semibold">{courseLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.type}</span>
                      <span aria-hidden="true">·</span>
                      <span className={session.isActive ? 'text-emerald-400' : 'text-slate-500'}>
                        {session.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{session.date}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-serif font-bold text-white leading-snug">
                        {session.title}
                      </h4>
                      {mode === 'MANAGE' && isAssignedToCurrentUser(session) && (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase">
                          Assigned to You as Faculty Host
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {session.startTime} – {session.endTime}
                      </span>
                      {session.instructorName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Instructor: {session.instructorName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {session.notes && (
                    <p className="text-xs text-slate-300 leading-relaxed">{session.notes}</p>
                  )}

                  {/* Launch Action Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {meetUrl ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-amber-400" />
                            Google Meet Classroom
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(`meet-${session.id}`, meetUrl)}
                            className="text-slate-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                            title="Copy Google Meet link"
                          >
                            {copiedId === `meet-${session.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{meetUrl}</p>
                        <a
                          href={meetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>
                            {mode === 'MANAGE' && isAssignedToCurrentUser(session)
                              ? 'Join Google Meet (Teacher Host)'
                              : 'Join Google Meet'}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800/70 rounded-md p-3 flex items-center justify-center text-xs text-slate-500">
                        No Google Meet link attached
                      </div>
                    )}

                    {waUrl ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5 truncate pr-2">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {session.whatsappGroupName || 'Class WhatsApp Group'}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopy(`wa-${session.id}`, waUrl)}
                            className="text-slate-400 hover:text-emerald-300 cursor-pointer shrink-0"
                            title="Copy WhatsApp invite link"
                          >
                            {copiedId === `wa-${session.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{waUrl}</p>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Join WhatsApp Group</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800/70 rounded-md p-3 flex items-center justify-center text-xs text-slate-500">
                        No WhatsApp group attached
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-slate-850 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    {facultyWaUrl && (
                      <a
                        href={facultyWaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Message Faculty on WhatsApp</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {mode === 'MANAGE' && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleEditStart(session)}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleActive(session)}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        {session.isActive ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>

                      {confirmDeleteId === session.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleDelete(session.id)}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded cursor-pointer font-semibold whitespace-nowrap shrink-0"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-400 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(session.id)}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
