/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Video,
  Calendar,
  Clock,
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
  ShieldCheck,
  Check,
  X,
  Mail,
  UserCheck,
  Copy,
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { Course, Batch, SwanayaDatabase, Instructor, Notification } from '../db/mockDb';
import { calendarService, GoogleMeetMeeting } from '../services/calendarService';

interface GoogleMeetStudioPanelProps {
  mode: 'MANAGE' | 'STUDENT';
  currentUser: any;
  courses: Course[];
  batches?: Batch[];
}

export default function GoogleMeetStudioPanel({
  mode,
  currentUser,
  courses,
  batches = [],
}: GoogleMeetStudioPanelProps) {
  const [meetings, setMeetings] = useState<GoogleMeetMeeting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string>(auth.currentUser?.email || '');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [editingMeeting, setEditingMeeting] = useState<GoogleMeetMeeting | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [instructors] = useState<Instructor[]>(() => SwanayaDatabase.get<Instructor[]>('instructors') || []);
  const [filterScope, setFilterScope] = useState<'ALL' | 'MINE'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const nowIsoLocal = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  const laterIsoLocal = new Date(Date.now() + 7200000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: courses[0]?.id || '',
    batchId: batches[0]?.id || 'b-1',
    instructorId: '',
    startTime: nowIsoLocal,
    endTime: laterIsoLocal,
    attendeeEmails: '',
    sendEmailInvites: true,
  });

  useEffect(() => {
    const unsub = calendarService.subscribeMeetings(
      (list) => {
        setMeetings(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Calendar meetings subscription notice:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleAuthenticateGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.setCustomParameters({ prompt: 'select_account' });

      const cred = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(cred);
      const token = credential?.accessToken;

      if (token) {
        setAccessToken(token);
      }
      setAuthEmail(cred.user?.email || auth.currentUser?.email || '');
      setNotice({
        type: 'success',
        text: `Connected Google Calendar & Gmail API for ${cred.user?.email || 'Admin/Instructor'}.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to authenticate Google account with Calendar scopes.',
      });
    }
  };

  const handleOpenSchedule = (m?: GoogleMeetMeeting) => {
    if (m) {
      setEditingMeeting(m);
      setForm({
        title: m.title || '',
        description: m.description || '',
        courseId: m.courseId || courses[0]?.id || '',
        batchId: m.batchId || batches[0]?.id || 'b-1',
        instructorId: m.instructorId || instructors[0]?.id || '',
        startTime: m.startTime ? m.startTime.slice(0, 16) : nowIsoLocal,
        endTime: m.endTime ? m.endTime.slice(0, 16) : laterIsoLocal,
        attendeeEmails: (m.attendeeEmails || []).join(', '),
        sendEmailInvites: true,
      });
    } else {
      setEditingMeeting(null);
      setForm({
        title: '',
        description: '',
        courseId: courses[0]?.id || '',
        batchId: batches[0]?.id || 'b-1',
        instructorId: instructors[0]?.id || '',
        startTime: nowIsoLocal,
        endTime: laterIsoLocal,
        attendeeEmails: '',
        sendEmailInvites: true,
      });
    }
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!form.title.trim()) {
      setNotice({ type: 'error', text: 'Please enter a meeting title.' });
      return;
    }

    if (!accessToken) {
      setNotice({
        type: 'info',
        text: 'Please connect your Google Account first to authorize Google Calendar Meet generation and Gmail dispatch.',
      });
      await handleAuthenticateGoogle();
      if (!accessToken) return;
    }

    setSubmitting(true);
    try {
      const selectedCourse = courses.find((c) => c.id === form.courseId);
      const selectedBatch = batches.find((b) => b.id === form.batchId);
      const assignedInstructor = instructors.find((i) => i.id === form.instructorId);
      const emailsList = form.attendeeEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));

      if (assignedInstructor?.email && !emailsList.includes(assignedInstructor.email)) {
        emailsList.push(assignedInstructor.email);
      }

      const organizerEmail = authEmail || currentUser?.email || auth.currentUser?.email || 'admin@swanaya.edu';
      const organizerName = currentUser?.name || 'Academy Administration';

      if (editingMeeting) {
        await calendarService.updateGoogleMeetEvent({
          meeting: editingMeeting,
          title: form.title,
          description: form.description,
          startTime: form.startTime,
          endTime: form.endTime,
          accessToken: accessToken || '',
          organizerEmail,
          organizerName,
        });
        setNotice({ type: 'success', text: `Google Meet event "${form.title}" updated successfully.` });
      } else {
        const created = await calendarService.scheduleGoogleMeetEvent({
          title: form.title,
          description: form.description,
          courseId: form.courseId,
          courseName: selectedCourse?.name || 'Academy Course',
          batchId: form.batchId,
          batchName: selectedBatch?.name || 'Cohort Batch',
          startTime: form.startTime,
          endTime: form.endTime,
          accessToken: accessToken || '',
          organizerEmail,
          organizerName,
          instructorId: assignedInstructor?.id,
          instructorName: assignedInstructor?.name,
          instructorEmail: assignedInstructor?.email,
          attendeeEmails: emailsList,
          sendEmailInvites: form.sendEmailInvites,
        });

        if (assignedInstructor) {
          const existingNotifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
          const teacherNotif: Notification = {
            id: `not-meet-${Date.now()}`,
            userId: assignedInstructor.userId || assignedInstructor.id,
            title: 'New Google Meet Session Assigned',
            message: `You are assigned as Teacher Host for "${form.title}" (${new Date(form.startTime).toLocaleString()}). Meet: ${created.meeting.meetLink}`,
            type: 'INFO',
            read: false,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };
          SwanayaDatabase.set('notifications', [teacherNotif, ...existingNotifs]);
        }

        setNotice({
          type: 'success',
          text: `Official Google Meet created via Google Calendar API${assignedInstructor ? ` & assigned to ${assignedInstructor.name}` : ''}!`,
        });
      }

      setShowScheduleModal(false);
      setEditingMeeting(null);
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to schedule Google Meet through Google Calendar API.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMeeting = async (meeting: GoogleMeetMeeting) => {
    if (!window.confirm(`Are you sure you want to cancel Google Meet session "${meeting.title}"?`)) {
      return;
    }
    try {
      if (!accessToken) {
        await handleAuthenticateGoogle();
      }
      const organizerEmail = authEmail || currentUser?.email || 'admin@swanaya.edu';
      const organizerName = currentUser?.name || 'Admin';

      await calendarService.cancelGoogleMeetEvent(meeting, accessToken || '', organizerEmail, organizerName);
      setNotice({ type: 'success', text: 'Google Meet meeting cancelled and removed from calendar.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to cancel meeting.' });
    }
  };

  const isAssignedToCurrentUser = (m: GoogleMeetMeeting) => {
    if (!currentUser) return false;
    const matchByEmail =
      m.instructorEmail && currentUser.email && m.instructorEmail.toLowerCase() === currentUser.email.toLowerCase();
    const matchByName =
      m.instructorName && currentUser.name && m.instructorName.toLowerCase() === currentUser.name.toLowerCase();
    const matchById =
      m.instructorId &&
      (m.instructorId === currentUser.id ||
        instructors.some((i) => i.id === m.instructorId && i.userId === currentUser.id));
    return Boolean(matchByEmail || matchByName || matchById);
  };

  const displayedMeetings =
    filterScope === 'MINE' ? meetings.filter(isAssignedToCurrentUser) : meetings;

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Google Meet &amp; Google Calendar Studio</span>
          </h3>
          <p className="text-xs text-slate-400">
            {mode === 'MANAGE'
              ? 'Schedule official Google Meet classes, auto-generate Google Calendar conference links, and dispatch Gmail email invitations to enrolled students.'
              : 'Join upcoming live online classes scheduled by your instructors and administration via official Google Meet.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!accessToken ? (
            <button
              type="button"
              onClick={handleAuthenticateGoogle}
              className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Connect Google Calendar &amp; Gmail</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>Connected: {authEmail || 'Google Account'}</span>
            </div>
          )}

          {mode === 'MANAGE' && (
            <button
              type="button"
              onClick={() => handleOpenSchedule()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Google Meet</span>
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
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {mode === 'MANAGE' && meetings.length > 0 && (
        <div className="flex items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5">
          <span className="text-[11px] font-mono text-slate-400">
            Showing {displayedMeetings.length} of {meetings.length} Google Meet session(s)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterScope('ALL')}
              className={`px-3 py-1 rounded text-[11px] font-bold uppercase cursor-pointer transition-colors ${
                filterScope === 'ALL'
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Meetings
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('MINE')}
              className={`px-3 py-1 rounded text-[11px] font-bold uppercase cursor-pointer transition-colors ${
                filterScope === 'MINE'
                  ? 'bg-emerald-500 text-black'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Assigned to Me
            </button>
          </div>
        </div>
      )}

      {/* Meetings List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : displayedMeetings.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center space-y-3">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-serif font-bold text-slate-200">
            {filterScope === 'MINE' ? 'No Google Meet Sessions Assigned to You Yet' : 'No Google Meet Sessions Scheduled'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {mode === 'MANAGE'
              ? 'Click "Schedule Google Meet" above to create an official Google Calendar event with auto-generated Google Meet rooms and Gmail invitations.'
              : 'No live classes are currently scheduled. Check back soon or contact your course advisor.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayedMeetings.map((m) => {
            const courseObj = courses.find((c) => c.id === m.courseId);
            const courseName = m.courseName || courseObj?.name || 'Academy Course';
            const assignedToMe = isAssignedToCurrentUser(m);

            return (
              <div
                key={m.id}
                className={`bg-slate-900 border rounded-lg p-5 flex flex-col justify-between gap-4 ${
                  assignedToMe ? 'border-emerald-500/40' : 'border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="text-amber-400 font-semibold">{courseName}</span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(m.startTime).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-serif font-bold text-white">{m.title}</h4>
                      {assignedToMe && (
                        <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase rounded">
                          Assigned to You as Host
                        </span>
                      )}
                    </div>
                    {m.instructorName && (
                      <p className="text-[11px] font-mono text-amber-300 mt-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Assigned Faculty: {m.instructorName}</span>
                      </p>
                    )}
                    {m.description && (
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.description}</p>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-amber-400" />
                        Official Google Meet Room
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Organizer: {m.organizerName || m.organizerEmail}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={m.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        <span>{assignedToMe ? 'Join Google Meet (Teacher Host)' : 'Join Google Meet Now'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(m.id, m.meetLink)}
                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono rounded cursor-pointer flex items-center gap-1.5 shrink-0"
                        title="Copy Google Meet Link"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {m.attendeeEmails && m.attendeeEmails.length > 0
                      ? `${m.attendeeEmails.length} email invite(s) sent via Gmail`
                      : 'Public cohort session'}
                  </span>

                  {mode === 'MANAGE' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSchedule(m)}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Reschedule</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCancelMeeting(m)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Edit Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-serif font-bold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-amber-500" />
                <span>{editingMeeting ? 'Reschedule Google Meet' : 'Schedule New Google Meet'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase text-slate-400 block">
                    Course Program
                  </label>
                  <select
                    value={form.courseId}
                    onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  >
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
                    Assign Faculty / Teacher Host
                  </label>
                  <select
                    value={form.instructorId}
                    onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">-- Organizer as Host --</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 block">
                  Meeting Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Advanced Film Editing Masterclass & Q&A"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 block">
                  Description &amp; Agenda
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Reviewing student portfolio projects..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase text-slate-400 block">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase text-slate-400 block">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 block">
                  Student Attendee Emails (comma separated for Gmail invites)
                </label>
                <input
                  type="text"
                  value={form.attendeeEmails}
                  onChange={(e) => setForm({ ...form, attendeeEmails: e.target.value })}
                  placeholder="student1@swanaya.edu, student2@swanaya.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sendInvites"
                  checked={form.sendEmailInvites}
                  onChange={(e) => setForm({ ...form, sendEmailInvites: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
                <label htmlFor="sendInvites" className="text-xs text-slate-300 cursor-pointer">
                  Automatically send email invitations and calendar reminders via Gmail API
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Creating Meet & Sending Invites...' : editingMeeting ? 'Save Changes' : 'Schedule & Generate Meet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
