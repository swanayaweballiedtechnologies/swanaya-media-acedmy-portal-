/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Award,
  UserCheck,
  Send,
  Save,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  Course,
  CourseEnrollmentRecord,
  CourseModuleItem,
  CourseSelectionPolicy,
  Student,
  StudentCourseSelection,
  TutorCourseAllocation,
} from '../db/mockDb';
import { academyService } from '../services/academyService';

interface StudentCourseSelectionPanelProps {
  studentUser: Student;
  currentUser: any;
  onRefreshAllData?: () => void;
}

export default function StudentCourseSelectionPanel({
  studentUser,
  currentUser,
  onRefreshAllData,
}: StudentCourseSelectionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModuleItem[]>([]);
  const [allocations, setAllocations] = useState<TutorCourseAllocation[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollmentRecord[]>([]);
  const [existingSelection, setExistingSelection] = useState<StudentCourseSelection | null>(null);
  const [policy, setPolicy] = useState<CourseSelectionPolicy>({
    id: 'default',
    maxMinorSelections: 2,
    minMinorSelections: 1,
    maxTotalCredits: 24,
    selectionLocked: false,
    selectionDeadline: '2026-12-31',
    requireAdminApproval: true,
    updatedAt: new Date().toISOString(),
  });

  const [selectedMajorId, setSelectedMajorId] = useState<string>(studentUser.courseId || '');
  const [selectedMinorIds, setSelectedMinorIds] = useState<string[]>([]);
  const [studentRemarks, setStudentRemarks] = useState<string>('');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await academyService.getCourseManagementOverview();
      const activeCourses = (data.courses || []).filter((c) => c.status === 'ACTIVE');
      setCourses(activeCourses);
      setModules(data.modules || []);
      setAllocations(data.tutorAllocations || []);
      setEnrollments(data.enrollments || []);
      setPolicy(data.policy);

      const myEmail = (studentUser.email || currentUser?.email || '').toLowerCase();
      const matched = (data.selections || []).find(
        (s) =>
          s.studentId === studentUser.id ||
          s.userId === currentUser?.id ||
          (myEmail && s.studentEmail?.toLowerCase() === myEmail)
      );
      if (matched) {
        setExistingSelection(matched);
        setSelectedMajorId(matched.majorCourseId);
        setSelectedMinorIds(matched.minorCourseIds || []);
        setStudentRemarks(matched.remarks || '');
      } else {
        const firstMajor = activeCourses.find((c) => (c.courseType || 'major') === 'major');
        if (!selectedMajorId && firstMajor) {
          setSelectedMajorId(firstMajor.id);
        }
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to load available Major and Minor programmes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [studentUser.id]);

  const majorCourses = useMemo(() => courses.filter((c) => (c.courseType || 'major') === 'major'), [courses]);
  const minorCourses = useMemo(() => courses.filter((c) => c.courseType === 'minor'), [courses]);

  const selectedMajor = majorCourses.find((c) => c.id === selectedMajorId) || null;
  const selectedMinors = minorCourses.filter((c) => selectedMinorIds.includes(c.id));

  const totalCredits = useMemo(() => {
    const majorCred = Number(selectedMajor?.credits ?? 12);
    const minorCred = selectedMinors.reduce((acc, m) => acc + Number(m.credits ?? 4), 0);
    return (selectedMajor ? majorCred : 0) + minorCred;
  }, [selectedMajor, selectedMinors]);

  const isLocked = useMemo(() => {
    if (existingSelection?.approvalStatus === 'APPROVED') return true;
    if (policy.selectionLocked) return true;
    if (policy.selectionDeadline) {
      const today = new Date().toISOString().split('T')[0];
      if (today > policy.selectionDeadline) return true;
    }
    return false;
  }, [existingSelection?.approvalStatus, policy.selectionLocked, policy.selectionDeadline]);

  const handleToggleMinor = (minorId: string) => {
    if (isLocked) return;
    setNotice(null);
    setSelectedMinorIds((prev) => {
      if (prev.includes(minorId)) {
        return prev.filter((id) => id !== minorId);
      }
      if (prev.length >= policy.maxMinorSelections) {
        setNotice({
          type: 'info',
          text: `Administrator policy limits Minor selections to a maximum of ${policy.maxMinorSelections}. Deselect one before adding another.`,
        });
        return prev;
      }
      return [...prev, minorId];
    });
  };

  const handleSubmitSelection = async (mode: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedMajorId) {
      setNotice({ type: 'error', text: 'Please select 1 active Major Course first.' });
      return;
    }
    if (mode === 'SUBMITTED' && selectedMinorIds.length < policy.minMinorSelections && minorCourses.length >= policy.minMinorSelections) {
      setNotice({
        type: 'error',
        text: `Please select at least ${policy.minMinorSelections} Minor Course(s) before submitting for approval.`,
      });
      return;
    }
    if (totalCredits > policy.maxTotalCredits) {
      setNotice({
        type: 'error',
        text: `Selected total credits (${totalCredits}) exceed the policy limit (${policy.maxTotalCredits}).`,
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const result = await academyService.submitStudentCourseSelection({
        majorCourseId: selectedMajorId,
        minorCourseIds: selectedMinorIds,
        mode,
        remarks: studentRemarks,
        studentId: studentUser.id,
        studentName: studentUser.name,
      });
      setExistingSelection(result);
      setNotice({
        type: 'success',
        text:
          mode === 'DRAFT'
            ? 'Your Major & Minor draft has been saved.'
            : 'Course selection submitted for Academic Administration approval.',
      });
      await loadData();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to submit your course selection.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderCourseDetailsDrawer = (course: Course) => {
    const courseMods = modules.filter((m) => m.courseId === course.id);
    const courseTutors = allocations.filter((a) => a.courseId === course.id);
    return (
      <div
        className="mt-3 pt-3 border-t space-y-3 text-xs"
        style={{ borderColor: 'var(--sma-active-border)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase block" style={{ color: 'var(--sma-primary)' }}>
              Learning Outcomes &amp; Requirements
            </span>
            {Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0 ? (
              <ul className="space-y-1 list-disc pl-4" style={{ color: 'var(--sma-active-text-muted)' }}>
                {course.learningObjectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--sma-active-text-muted)' }}>{course.examRequirements}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase block" style={{ color: 'var(--sma-secondary)' }}>
              Eligibility, Prerequisites &amp; Tutors
            </span>
            <p style={{ color: 'var(--sma-active-text-muted)' }}>
              <strong>Eligibility:</strong> {course.eligibility || 'Open to enrolled scholars'}
            </p>
            <p style={{ color: 'var(--sma-active-text-muted)' }}>
              <strong>Prerequisites:</strong>{' '}
              {Array.isArray(course.prerequisites) && course.prerequisites.length > 0
                ? course.prerequisites.join(', ')
                : 'None'}
            </p>
            <p style={{ color: 'var(--sma-active-text-muted)' }}>
              <strong>Assigned Tutors:</strong>{' '}
              {courseTutors.length > 0
                ? courseTutors.map((t) => `${t.tutorName} (${t.role})`).join(', ')
                : course.coordinator || 'Faculty Panel'}
            </p>
          </div>
        </div>

        {courseMods.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase block" style={{ color: 'var(--sma-accent)' }}>
              Syllabus Modules ({courseMods.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {courseMods.map((mod) => (
                <div
                  key={mod.id}
                  className="p-2.5 rounded-lg border"
                  style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
                >
                  <p className="font-semibold" style={{ color: 'var(--sma-active-text)' }}>
                    {mod.title}
                  </p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--sma-active-text-muted)' }}>
                    {mod.durationHours} hrs · {mod.assessmentType}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const myProgressByCourse = useMemo(() => {
    const map: Record<string, number> = {};
    for (const enr of enrollments) {
      if (enr.studentId === studentUser.id) {
        map[enr.courseId] = enr.progressPercent ?? 0;
      }
    }
    return map;
  }, [enrollments, studentUser.id]);

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div
        className="rounded-2xl border p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--sma-active-surface)',
          borderColor: 'var(--sma-active-border)',
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--sma-primary)' }}>
            <BookOpen className="w-4 h-4" />
            <span>/student/course-selection · Academic Specialization</span>
          </div>
          <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
            Major &amp; Minor Course Selection
          </h2>
          <p className="text-xs max-w-2xl" style={{ color: 'var(--sma-active-text-muted)' }}>
            Choose 1 active Major specialization and up to {policy.maxMinorSelections} eligible Minor electives before {policy.selectionDeadline || 'the term deadline'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            className="px-4 py-2 rounded-xl border text-xs font-mono"
            style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
          >
            <span className="block text-[10px]" style={{ color: 'var(--sma-active-text-muted)' }}>Approval Status</span>
            <strong
              className="text-xs uppercase"
              style={{
                color:
                  existingSelection?.approvalStatus === 'APPROVED'
                    ? 'var(--sma-accent)'
                    : existingSelection?.approvalStatus === 'REJECTED'
                    ? '#E11D48'
                    : 'var(--sma-primary)',
              }}
            >
              {existingSelection?.approvalStatus?.replace(/_/g, ' ') || 'NOT SUBMITTED'}
            </strong>
          </div>

          <div
            className="px-4 py-2 rounded-xl border text-xs font-mono"
            style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
          >
            <span className="block text-[10px]" style={{ color: 'var(--sma-active-text-muted)' }}>Credit Allocation</span>
            <strong className="text-xs tabular-nums" style={{ color: totalCredits > policy.maxTotalCredits ? '#E11D48' : 'var(--sma-active-text)' }}>
              {totalCredits} / {policy.maxTotalCredits} Credits
            </strong>
          </div>
        </div>
      </div>

      {isLocked && (
        <div
          className="rounded-xl border p-4 text-xs flex items-center gap-3"
          style={{
            backgroundColor: 'var(--sma-role-accent-soft)',
            borderColor: 'var(--sma-primary)',
            color: 'var(--sma-active-text)',
          }}
        >
          <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--sma-primary)' }} />
          <span>
            {existingSelection?.approvalStatus === 'APPROVED'
              ? `Your Major & Minor curriculum was approved by ${existingSelection.approvedBy || 'Administration'} and is now locked for your cohort.`
              : 'Course selection editing is currently locked by Academic Administration.'}
          </span>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
          Loading academic programmes, credits, and faculty allocations...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left 8 Columns: Major & Minor Selection Lists */}
          <div className="xl:col-span-8 space-y-6">
            {/* Step 1: Major Course Selection */}
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
                <div>
                  <h3 className="text-sm font-serif font-bold flex items-center gap-2" style={{ color: 'var(--sma-active-text)' }}>
                    <Award className="w-4 h-4" style={{ color: 'var(--sma-primary)' }} />
                    <span>1. Major Course (Primary Specialization · Choose 1)</span>
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                    Primary core diploma or degree programme with capstone evaluation.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {majorCourses.map((course) => {
                  const isSelected = selectedMajorId === course.id;
                  const isExpanded = expandedCourseId === course.id;
                  const seatsLeft = Math.max(0, (course.maxSeats ?? 40) - (course.enrolledCount ?? 0));
                  const progressPct = myProgressByCourse[course.id];
                  return (
                    <div
                      key={course.id}
                      className="rounded-xl border p-4 transition-all"
                      style={{
                        backgroundColor: isSelected ? 'var(--sma-role-accent-soft)' : 'var(--sma-active-bg)',
                        borderColor: isSelected ? 'var(--sma-primary)' : 'var(--sma-active-border)',
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <label className={`flex items-start gap-3 flex-1 ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="majorCourse"
                            disabled={isLocked}
                            checked={isSelected}
                            onChange={() => setSelectedMajorId(course.id)}
                            className="mt-1 w-4 h-4 accent-[#6941C6]"
                          />
                          <div className="space-y-1">
                            <p className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--sma-primary)' }}>
                              {course.code} · {course.duration} · {course.credits ?? 12} Credits · {seatsLeft} Seats Open
                            </p>
                            <h4 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                              {course.name}
                            </h4>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--sma-active-text-muted)' }}>
                              {course.description}
                            </p>
                            {progressPct !== undefined && (
                              <p className="text-[11px] font-mono font-bold pt-1" style={{ color: 'var(--sma-accent)' }}>
                                Current Course Progress: {progressPct}%
                              </p>
                            )}
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                          style={{
                            backgroundColor: 'var(--sma-active-surface)',
                            borderColor: 'var(--sma-active-border)',
                            color: 'var(--sma-active-text)',
                          }}
                        >
                          <span>{isExpanded ? 'Hide Syllabus' : 'Syllabus & Tutors'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isExpanded && renderCourseDetailsDrawer(course)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Minor Courses Selection */}
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
                <div>
                  <h3 className="text-sm font-serif font-bold flex items-center gap-2" style={{ color: 'var(--sma-active-text)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--sma-secondary)' }} />
                    <span>2. Minor Courses (Supplementary Electives · Pick {policy.minMinorSelections}–{policy.maxMinorSelections})</span>
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                    Build cross-disciplinary mastery alongside your primary specialization.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold tabular-nums" style={{ color: 'var(--sma-secondary)' }}>
                  {selectedMinorIds.length} / {policy.maxMinorSelections} Selected
                </span>
              </div>

              {minorCourses.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--sma-active-text-muted)' }}>
                  No Minor electives are currently published. Check back after Administrator catalogue updates.
                </p>
              ) : (
                <div className="space-y-3">
                  {minorCourses.map((course) => {
                    const isSelected = selectedMinorIds.includes(course.id);
                    const isExpanded = expandedCourseId === course.id;
                    const seatsLeft = Math.max(0, (course.maxSeats ?? 40) - (course.enrolledCount ?? 0));
                    const progressPct = myProgressByCourse[course.id];
                    return (
                      <div
                        key={course.id}
                        className="rounded-xl border p-4 transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--sma-role-accent-soft)' : 'var(--sma-active-bg)',
                          borderColor: isSelected ? 'var(--sma-secondary)' : 'var(--sma-active-border)',
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <label className={`flex items-start gap-3 flex-1 ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={isSelected}
                              onChange={() => handleToggleMinor(course.id)}
                              className="mt-1 w-4 h-4 accent-[#243B70]"
                            />
                            <div className="space-y-1">
                              <p className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--sma-secondary)' }}>
                                {course.code} · {course.duration} · {course.credits ?? 4} Credits · {seatsLeft} Seats Open
                              </p>
                              <h4 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                                {course.name}
                              </h4>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--sma-active-text-muted)' }}>
                                {course.description}
                              </p>
                              {progressPct !== undefined && (
                                <p className="text-[11px] font-mono font-bold pt-1" style={{ color: 'var(--sma-accent)' }}>
                                  Minor Course Progress: {progressPct}%
                                </p>
                              )}
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                            style={{
                              backgroundColor: 'var(--sma-active-surface)',
                              borderColor: 'var(--sma-active-border)',
                              color: 'var(--sma-active-text)',
                            }}
                          >
                            <span>{isExpanded ? 'Hide Syllabus' : 'Syllabus & Tutors'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {isExpanded && renderCourseDetailsDrawer(course)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Columns: Review Summary & Submission */}
          <div className="xl:col-span-4">
            <div
              className="rounded-2xl border p-5 space-y-4 sticky top-20"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
                <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  Review Selection Summary
                </h3>
                <Clock className="w-4 h-4" style={{ color: 'var(--sma-primary)' }} />
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}>
                  <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--sma-primary)' }}>Selected Major</span>
                  <p className="font-bold mt-1" style={{ color: 'var(--sma-active-text)' }}>
                    {selectedMajor ? `${selectedMajor.code} · ${selectedMajor.name}` : 'None selected'}
                  </p>
                  {selectedMajor && (
                    <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {selectedMajor.duration} · {selectedMajor.credits ?? 12} Credits
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}>
                  <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--sma-secondary)' }}>
                    Selected Minor Courses ({selectedMinors.length})
                  </span>
                  {selectedMinors.length === 0 ? (
                    <p className="mt-1" style={{ color: 'var(--sma-active-text-muted)' }}>No Minor courses picked yet.</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {selectedMinors.map((m) => (
                        <li key={m.id} className="font-semibold flex items-center justify-between gap-2" style={{ color: 'var(--sma-active-text)' }}>
                          <span className="truncate">{m.name}</span>
                          <span className="font-mono text-[11px] shrink-0">{m.credits ?? 4} Cr</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>
                    Academic Study Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isLocked}
                    value={studentRemarks}
                    onChange={(e) => setStudentRemarks(e.target.value)}
                    placeholder="Career track goals or preferred studio schedule..."
                    className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none disabled:opacity-60"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
              </div>

              {existingSelection?.reviewedBy && (
                <div
                  className="p-3 rounded-xl border text-[11px] space-y-1"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text-muted)' }}
                >
                  <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--sma-active-text)' }}>
                    <UserCheck className="w-3.5 h-3.5" style={{ color: 'var(--sma-accent)' }} />
                    <span>Reviewed by {existingSelection.reviewedBy}</span>
                  </div>
                  {existingSelection.remarks && <p>{existingSelection.remarks}</p>}
                </div>
              )}

              {!isLocked && (
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmitSelection('DRAFT')}
                    className="flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--sma-active-bg)',
                      borderColor: 'var(--sma-active-border)',
                      color: 'var(--sma-active-text)',
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmitSelection('SUBMITTED')}
                    className="flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sma-primary)' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Submit for Approval'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
