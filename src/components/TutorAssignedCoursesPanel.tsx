/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Lock,
  TrendingUp,
  Send,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Course,
  CourseEnrollmentRecord,
  CourseModuleItem,
  Instructor,
  Student,
  TutorCourseAllocation,
  TutorStudentProgressReport,
} from '../db/mockDb';
import { academyService } from '../services/academyService';

interface TutorAssignedCoursesPanelProps {
  instructorUser?: Instructor | null;
  currentUser: any;
  onRefreshAllData?: () => void;
}

export default function TutorAssignedCoursesPanel({
  instructorUser,
  currentUser,
  onRefreshAllData,
}: TutorAssignedCoursesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModuleItem[]>([]);
  const [allocations, setAllocations] = useState<TutorCourseAllocation[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollmentRecord[]>([]);
  const [reports, setReports] = useState<TutorStudentProgressReport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [progressForm, setProgressForm] = useState({
    studentId: '',
    progressPercent: 75,
    assessmentScore: 85,
    status: 'ON_TRACK' as 'ON_TRACK' | 'NEEDS_SUPPORT' | 'COMPLETED',
    remarks: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await academyService.getCourseManagementOverview();
      setCourses(data.courses || []);
      setModules(data.modules || []);
      setAllocations(data.tutorAllocations || []);
      setEnrollments(data.enrollments || []);
      setReports(data.progressReports || []);
      setStudents(data.students || []);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to load assigned courses.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [instructorUser?.id]);

  const myAllocatedCourses = useMemo(() => {
    const myEmail = (instructorUser?.email || currentUser?.email || '').toLowerCase();
    const myIds = new Set(
      [instructorUser?.id, instructorUser?.userId, currentUser?.id].filter(Boolean) as string[]
    );
    const matchingCourseIds = new Set(
      allocations
        .filter(
          (a) =>
            myIds.has(a.tutorId) ||
            (myEmail && a.tutorEmail?.toLowerCase() === myEmail)
        )
        .map((a) => a.courseId)
    );
    if (matchingCourseIds.size > 0) {
      return courses.filter((c) => matchingCourseIds.has(c.id));
    }
    // If Admin hasn't restricted explicit allocations yet, display active catalogue read-only or assigned coordinator courses
    const coordinated = courses.filter(
      (c) =>
        (c.coordinator && instructorUser?.name && c.coordinator.toLowerCase().includes(instructorUser.name.toLowerCase())) ||
        c.status === 'ACTIVE'
    );
    return coordinated;
  }, [allocations, courses, instructorUser, currentUser]);

  useEffect(() => {
    if (!selectedCourseId && myAllocatedCourses.length > 0) {
      setSelectedCourseId(myAllocatedCourses[0].id);
    }
  }, [myAllocatedCourses, selectedCourseId]);

  const selectedCourse = myAllocatedCourses.find((c) => c.id === selectedCourseId) || myAllocatedCourses[0] || null;

  const enrolledInSelectedCourse = useMemo(() => {
    if (!selectedCourse) return [];
    const directEnr = enrollments.filter((e) => e.courseId === selectedCourse.id);
    if (directEnr.length > 0) return directEnr;
    return students
      .filter((st) => st.courseId === selectedCourse.id)
      .map((st) => ({
        id: `legacy-${st.id}-${selectedCourse.id}`,
        selectionId: 'direct',
        studentId: st.id,
        studentName: st.name,
        studentEmail: st.email,
        courseId: selectedCourse.id,
        courseType: (selectedCourse.courseType || 'major') as 'major' | 'minor',
        status: 'ACTIVE' as const,
        progressPercent: st.careerReadinessScore || 65,
        enrolledAt: st.enrollmentDate || '',
      }));
  }, [enrollments, students, selectedCourse]);

  useEffect(() => {
    if (enrolledInSelectedCourse.length > 0 && !enrolledInSelectedCourse.some((e) => e.studentId === progressForm.studentId)) {
      setProgressForm((prev) => ({
        ...prev,
        studentId: enrolledInSelectedCourse[0].studentId,
        progressPercent: enrolledInSelectedCourse[0].progressPercent || 70,
      }));
    }
  }, [enrolledInSelectedCourse]);

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !progressForm.studentId) {
      setNotice({ type: 'error', text: 'Select a course and enrolled student first.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const targetStudent = enrolledInSelectedCourse.find((s) => s.studentId === progressForm.studentId);
      await academyService.submitTutorProgressReport({
        studentId: progressForm.studentId,
        studentName: targetStudent?.studentName,
        courseId: selectedCourse.id,
        courseType: selectedCourse.courseType === 'minor' ? 'minor' : 'major',
        progressPercent: Number(progressForm.progressPercent),
        assessmentScore: Number(progressForm.assessmentScore),
        status: progressForm.status,
        remarks: progressForm.remarks,
      });
      setNotice({
        type: 'success',
        text: `Academic progress report recorded for ${targetStudent?.studentName || 'Student'}.`,
      });
      setProgressForm((prev) => ({ ...prev, remarks: '' }));
      await loadData();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to submit progress report.' });
    } finally {
      setSaving(false);
    }
  };

  const courseModules = useMemo(
    () => (selectedCourse ? modules.filter((m) => m.courseId === selectedCourse.id) : []),
    [modules, selectedCourse]
  );

  const courseReports = useMemo(
    () => (selectedCourse ? reports.filter((r) => r.courseId === selectedCourse.id) : []),
    [reports, selectedCourse]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="rounded-2xl border p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--sma-secondary)' }}>
            <BookOpen className="w-4 h-4" />
            <span>/tutor/assigned-courses · Faculty Course Roster</span>
          </div>
          <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
            Assigned Major &amp; Minor Courses
          </h2>
          <p className="text-xs max-w-2xl" style={{ color: 'var(--sma-active-text-muted)' }}>
            Inspect your allocated Major and Minor cohorts, review syllabus modules, monitor enrolled students, and submit progress reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2"
            style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text-muted)' }}
          >
            <Lock className="w-3.5 h-3.5" style={{ color: 'var(--sma-primary)' }} />
            <span>Allocations governed by Admin</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Assigned Course List */}
        <div className="xl:col-span-4 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider px-1" style={{ color: 'var(--sma-active-text-muted)' }}>
            Allocated Major &amp; Minor Courses ({myAllocatedCourses.length})
          </h3>
          {myAllocatedCourses.map((c) => {
            const active = selectedCourse?.id === c.id;
            const isMajor = (c.courseType || 'major') === 'major';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCourseId(c.id)}
                className="w-full text-left rounded-2xl border p-4 space-y-1.5 transition-all cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--sma-role-accent-soft)' : 'var(--sma-active-surface)',
                  borderColor: active ? 'var(--sma-primary)' : 'var(--sma-active-border)',
                }}
              >
                <p
                  className="text-[11px] font-mono uppercase font-bold"
                  style={{ color: isMajor ? 'var(--sma-primary)' : 'var(--sma-secondary)' }}
                >
                  {isMajor ? 'MAJOR COURSE' : 'MINOR ELECTIVE'} · {c.code} · {c.credits ?? (isMajor ? 12 : 4)} Credits
                </p>
                <h4 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  {c.name}
                </h4>
                <p className="text-xs line-clamp-2" style={{ color: 'var(--sma-active-text-muted)' }}>
                  {c.duration} · {c.mode}
                </p>
              </button>
            );
          })}
        </div>

        {/* Right: Course Workspace, Enrolled Students & Progress Submission */}
        <div className="xl:col-span-8 space-y-6">
          {selectedCourse ? (
            <>
              {/* Enrolled Students & Modules */}
              <div
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
                  <div>
                    <h3 className="text-base font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                      {selectedCourse.name}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {enrolledInSelectedCourse.length} Enrolled Scholar(s) · {courseModules.length} Curriculum Modules
                    </p>
                  </div>
                </div>

                {courseModules.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {courseModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="p-3 rounded-xl border text-xs"
                        style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
                      >
                        <p className="font-semibold" style={{ color: 'var(--sma-active-text)' }}>{mod.title}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--sma-active-text-muted)' }}>
                          {mod.durationHours} hrs · Assessment: {mod.assessmentType}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--sma-active-text-muted)' }}>
                    <Users className="w-3.5 h-3.5" />
                    <span>Enrolled Students</span>
                  </h4>
                  {enrolledInSelectedCourse.length === 0 ? (
                    <p className="text-xs py-4 text-center" style={{ color: 'var(--sma-active-text-muted)' }}>
                      No approved students are currently allocated to this course.
                    </p>
                  ) : (
                    <div className="divide-y rounded-xl border" style={{ borderColor: 'var(--sma-active-border)', backgroundColor: 'var(--sma-active-bg)' }}>
                      {enrolledInSelectedCourse.map((enr) => (
                        <div key={enr.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-bold" style={{ color: 'var(--sma-active-text)' }}>{enr.studentName}</p>
                            <p className="text-[11px] font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
                              {enr.studentEmail || enr.studentId} · {enr.courseType.toUpperCase()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--sma-accent)' }}>
                              {enr.progressPercent}% Complete
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setProgressForm((prev) => ({
                                  ...prev,
                                  studentId: enr.studentId,
                                  progressPercent: enr.progressPercent || 75,
                                }))
                              }
                              className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer"
                              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-primary)' }}
                            >
                              Update Progress
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Student Progress Report */}
              <form
                onSubmit={handleSubmitProgress}
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
              >
                <h3 className="text-sm font-serif font-bold flex items-center gap-2 border-b pb-3" style={{ color: 'var(--sma-active-text)', borderColor: 'var(--sma-active-border)' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: 'var(--sma-accent)' }} />
                  <span>Submit Student Academic Progress Report</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Enrolled Student</label>
                    <select
                      value={progressForm.studentId}
                      onChange={(e) => setProgressForm({ ...progressForm, studentId: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    >
                      {enrolledInSelectedCourse.length === 0 ? (
                        <option value="">No enrolled students</option>
                      ) : (
                        enrolledInSelectedCourse.map((enr) => (
                          <option key={enr.studentId} value={enr.studentId}>
                            {enr.studentName}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Completion (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progressForm.progressPercent}
                      onChange={(e) => setProgressForm({ ...progressForm, progressPercent: Number(e.target.value) })}
                      className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Score (/100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progressForm.assessmentScore}
                      onChange={(e) => setProgressForm({ ...progressForm, assessmentScore: Number(e.target.value) })}
                      className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Standing</label>
                    <select
                      value={progressForm.status}
                      onChange={(e) => setProgressForm({ ...progressForm, status: e.target.value as any })}
                      className="w-full rounded-xl border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    >
                      <option value="ON_TRACK">On Track</option>
                      <option value="NEEDS_SUPPORT">Needs Academic Support</option>
                      <option value="COMPLETED">Course Completed</option>
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Faculty Remarks</label>
                    <input
                      type="text"
                      required
                      value={progressForm.remarks}
                      onChange={(e) => setProgressForm({ ...progressForm, remarks: e.target.value })}
                      placeholder="Module completion feedback, studio assessment note..."
                      className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || enrolledInSelectedCourse.length === 0}
                    className="px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sma-primary)' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{saving ? 'Submitting...' : 'Submit Progress Report'}</span>
                  </button>
                </div>

                {courseReports.length > 0 && (
                  <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--sma-active-border)' }}>
                    <span className="text-[11px] font-mono uppercase block" style={{ color: 'var(--sma-active-text-muted)' }}>
                      Recent Submitted Reports ({courseReports.length})
                    </span>
                    {courseReports.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3"
                        style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--sma-active-text)' }}>
                            {r.studentName || r.studentId} · {r.progressPercent ?? 0}% ({(r.status || r.progressStatus || 'ON_TRACK').replace(/_/g, ' ')})
                          </p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--sma-active-text-muted)' }}>{r.remarks}</p>
                        </div>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--sma-active-text-muted)' }}>
                          {new Date(r.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </>
          ) : (
            <div
              className="rounded-2xl border p-8 text-center text-xs"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text-muted)' }}
            >
              Select a Major or Minor course on the left to inspect modules and submit student progress reports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
