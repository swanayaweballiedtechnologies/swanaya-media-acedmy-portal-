/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit3,
  Archive,
  Users,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Download,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Trash2,
  UserCheck,
  Clock,
  Layers,
} from 'lucide-react';
import {
  Course,
  CourseApprovalLog,
  CourseCategory,
  CourseCreditSpec,
  CourseEnrollmentRecord,
  CourseModuleItem,
  CourseSelectionPolicy,
  Student,
  StudentCourseSelection,
  TutorCourseAllocation,
} from '../db/mockDb';
import { academyService } from '../services/academyService';

interface MajorMinorCourseManagementPanelProps {
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onRefreshAllData?: () => void;
}

type ManagementTab = 'catalogue' | 'allocations' | 'approvals' | 'policy-reports';

export default function MajorMinorCourseManagementPanel({
  currentUser,
  onRefreshAllData,
}: MajorMinorCourseManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('catalogue');
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [modules, setModules] = useState<CourseModuleItem[]>([]);
  const [credits, setCredits] = useState<CourseCreditSpec[]>([]);
  const [tutorAllocations, setTutorAllocations] = useState<TutorCourseAllocation[]>([]);
  const [selections, setSelections] = useState<StudentCourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollmentRecord[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<CourseApprovalLog[]>([]);
  const [tutors, setTutors] = useState<Array<{ id: string; userId?: string; name: string; email?: string; qualification?: string; specialization?: string }>>([]);
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

  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Course Builder Form State
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    name: '',
    courseType: 'major' as 'major' | 'minor',
    categoryId: 'cat-media',
    duration: '12 Months',
    credits: 12,
    maxSeats: 40,
    fee: 65000,
    level: 'DIPLOMA' as Course['level'],
    mode: 'HYBRID' as Course['mode'],
    eligibility: '12th Standard or Equivalent',
    description: '',
    examRequirements: '',
    prerequisitesText: '',
    learningObjectivesText: '',
  });
  const [draftModules, setDraftModules] = useState<Array<{ title: string; description: string; durationHours: number }>>([
    { title: 'Module 1: Core Foundations', description: 'Foundational concepts and studio orientation', durationHours: 20 },
  ]);

  // Tutor Allocation Form State
  const [allocCourseId, setAllocCourseId] = useState('');
  const [allocTutorId, setAllocTutorId] = useState('');
  const [allocRole, setAllocRole] = useState<'LEAD' | 'CO_TUTOR'>('LEAD');

  // New Category Form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await academyService.getCourseManagementOverview();
      setCourses(data.courses || []);
      setCategories(data.categories || []);
      setModules(data.modules || []);
      setCredits(data.credits || []);
      setTutorAllocations(data.tutorAllocations || []);
      setSelections(data.selections || []);
      setEnrollments(data.enrollments || []);
      setApprovalLogs(data.approvalLogs || []);
      setPolicy(data.policy);
      setTutors(data.tutors || []);
      if (!allocCourseId && data.courses?.length) setAllocCourseId(data.courses[0].id);
      if (!allocTutorId && data.tutors?.length) setAllocTutorId(data.tutors[0].id);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to load Major & Minor course catalogue.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const majorCourses = useMemo(() => courses.filter((c) => (c.courseType || 'major') === 'major'), [courses]);
  const minorCourses = useMemo(() => courses.filter((c) => c.courseType === 'minor'), [courses]);

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseForm({
      code: '',
      name: '',
      courseType: 'major',
      categoryId: categories[0]?.id || 'cat-media',
      duration: '12 Months',
      credits: 12,
      maxSeats: 40,
      fee: 65000,
      level: 'DIPLOMA',
      mode: 'HYBRID',
      eligibility: '12th Standard or Equivalent',
      description: '',
      examRequirements: '',
      prerequisitesText: '',
      learningObjectivesText: '',
    });
    setDraftModules([
      { title: 'Module 1: Core Foundations', description: 'Foundational concepts and studio orientation', durationHours: 20 },
    ]);
  };

  const handleEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseForm({
      code: c.code || '',
      name: c.name || c.title || '',
      courseType: c.courseType === 'minor' ? 'minor' : 'major',
      categoryId: c.categoryId || categories[0]?.id || 'cat-media',
      duration: c.duration || '12 Months',
      credits: Number(c.credits ?? (c.courseType === 'minor' ? 4 : 12)),
      maxSeats: Number(c.maxSeats ?? 40),
      fee: Number(c.fee ?? c.fees ?? 0),
      level: c.level || 'DIPLOMA',
      mode: c.mode || 'HYBRID',
      eligibility: c.eligibility || '12th Standard or Equivalent',
      description: c.description || '',
      examRequirements: c.examRequirements || '',
      prerequisitesText: Array.isArray(c.prerequisites) ? c.prerequisites.join(', ') : '',
      learningObjectivesText: Array.isArray(c.learningObjectives) ? c.learningObjectives.join('\n') : '',
    });
    const existingMods = modules.filter((m) => m.courseId === c.id);
    if (existingMods.length > 0) {
      setDraftModules(
        existingMods.map((m) => ({
          title: m.title,
          description: m.description || '',
          durationHours: m.durationHours,
        }))
      );
    }
    setActiveTab('catalogue');
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const prerequisites = courseForm.prerequisitesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const learningObjectives = courseForm.learningObjectivesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await academyService.saveManagedCourse({
        ...(editingCourseId ? { id: editingCourseId } : {}),
        code: courseForm.code,
        name: courseForm.name,
        title: courseForm.name,
        courseType: courseForm.courseType,
        categoryId: courseForm.categoryId,
        duration: courseForm.duration,
        credits: Number(courseForm.credits),
        maxSeats: Number(courseForm.maxSeats),
        fee: Number(courseForm.fee),
        level: courseForm.level,
        mode: courseForm.mode,
        eligibility: courseForm.eligibility,
        description: courseForm.description,
        examRequirements: courseForm.examRequirements,
        prerequisites,
        learningObjectives,
        syllabusModules: draftModules
          .filter((m) => m.title.trim())
          .map((m, idx) => ({
            id: `mod-${editingCourseId || 'new'}-${idx + 1}`,
            courseId: editingCourseId || '',
            title: m.title.trim(),
            description: m.description.trim(),
            order: idx + 1,
            durationHours: Number(m.durationHours || 15),
            assessmentType: 'EXAM',
            isRequired: true,
          })),
      });

      setNotice({
        type: 'success',
        text: `${courseForm.courseType === 'major' ? 'Major' : 'Minor'} course "${courseForm.name}" saved cleanly.`,
      });
      resetCourseForm();
      await loadOverview();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to save course.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (c: Course) => {
    setSaving(true);
    try {
      const nextStatus = c.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
      await academyService.saveManagedCourse({
        id: c.id,
        status: nextStatus,
        isPublished: nextStatus === 'ACTIVE',
      });
      setNotice({
        type: 'info',
        text: `Course "${c.name}" marked as ${nextStatus}.`,
      });
      await loadOverview();
      onRefreshAllData?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update course status.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      await academyService.saveCourseCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      await loadOverview();
      setNotice({ type: 'success', text: 'Course category added.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to save category.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAllocateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocCourseId || !allocTutorId) return;
    setSaving(true);
    try {
      const tutorObj = tutors.find((t) => t.id === allocTutorId);
      await academyService.allocateTutorToCourse({
        courseId: allocCourseId,
        tutorId: allocTutorId,
        tutorName: tutorObj?.name,
        tutorEmail: tutorObj?.email,
        allocationRole: allocRole,
      });
      await loadOverview();
      setNotice({ type: 'success', text: `Allocated ${tutorObj?.name || 'Tutor'} cleanly.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to allocate tutor.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAllocation = async (allocId: string) => {
    setSaving(true);
    try {
      await academyService.removeTutorAllocation(allocId);
      await loadOverview();
      setNotice({ type: 'info', text: 'Tutor allocation removed.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to remove allocation.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReviewSelection = async (
    selId: string,
    decision: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUIRED'
  ) => {
    setSaving(true);
    try {
      await academyService.reviewStudentCourseSelection(selId, decision, reviewRemarks[selId] || '');
      await loadOverview();
      onRefreshAllData?.();
      setNotice({
        type: 'success',
        text: `Student course selection marked ${decision.replace(/_/g, ' ')}.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to review selection.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await academyService.updateCourseSelectionPolicy(policy);
      setPolicy(updated);
      setNotice({
        type: 'success',
        text: 'Major & Minor selection limits, deadlines, and lock status saved.',
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to save policy.' });
    } finally {
      setSaving(false);
    }
  };

  const getCourseTitle = (id: string) => {
    const found = courses.find((c) => c.id === id);
    return found ? `${found.code} · ${found.name}` : id;
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div
        className="rounded-2xl border p-6 space-y-5"
        style={{
          backgroundColor: 'var(--sma-active-surface)',
          borderColor: 'var(--sma-active-border)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--sma-primary)' }}>
              <BookOpen className="w-4 h-4" />
              <span>/admin/course-management · Curriculum Governance</span>
            </div>
            <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
              Major &amp; Minor Course Management System
            </h2>
            <p className="text-xs" style={{ color: 'var(--sma-active-text-muted)' }}>
              Configure Major specializations and Minor electives, allocate faculty tutors, approve student study plans, and enforce selection deadlines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'var(--sma-active-bg)',
                borderColor: 'var(--sma-active-border)',
                color: 'var(--sma-active-text)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Catalogue</span>
            </button>

            <a
              href={academyService.getCourseSelectionExportUrl('csv')}
              className="px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: 'var(--sma-accent)' }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Major Courses', value: majorCourses.length, tone: 'var(--sma-primary)' },
            { label: 'Minor Electives', value: minorCourses.length, tone: 'var(--sma-secondary)' },
            {
              label: 'Pending Approvals',
              value: selections.filter((s) => s.approvalStatus === 'SUBMITTED' || s.approvalStatus === 'UNDER_REVIEW').length,
              tone: 'var(--sma-accent)',
            },
            {
              label: 'Selection Window',
              value: policy.selectionLocked ? 'Locked' : `Open · Max ${policy.maxMinorSelections} Minors`,
              tone: policy.selectionLocked ? '#E11D48' : 'var(--sma-accent)',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border p-3.5"
              style={{
                backgroundColor: 'var(--sma-active-bg)',
                borderColor: 'var(--sma-active-border)',
              }}
            >
              <span className="text-[11px] font-mono block" style={{ color: 'var(--sma-active-text-muted)' }}>
                {stat.label}
              </span>
              <span className="text-base font-mono font-bold tabular-nums mt-1 block" style={{ color: stat.tone }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border w-fit"
        style={{
          backgroundColor: 'var(--sma-active-surface)',
          borderColor: 'var(--sma-active-border)',
        }}
      >
        {(
          [
            { id: 'catalogue', label: 'Major & Minor Catalogue', icon: BookOpen },
            { id: 'allocations', label: 'Tutor Allocations', icon: UserCheck },
            { id: 'approvals', label: `Student Approvals (${selections.length})`, icon: Users },
            { id: 'policy-reports', label: 'Selection Policy & Reports', icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: active ? 'var(--sma-primary)' : 'transparent',
                color: active ? '#FFFFFF' : 'var(--sma-active-text-muted)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] font-semibold underline cursor-pointer shrink-0">
            Close
          </button>
        </div>
      )}

      {/* TAB 1: MAJOR & MINOR CATALOGUE + BUILDER */}
      {activeTab === 'catalogue' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Course Creation / Edit Form */}
          <div className="xl:col-span-5 space-y-5">
            <form
              onSubmit={handleSaveCourse}
              className="rounded-2xl border p-5 space-y-4"
              style={{
                backgroundColor: 'var(--sma-active-surface)',
                borderColor: 'var(--sma-active-border)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
                <h3 className="text-sm font-serif font-bold flex items-center gap-2" style={{ color: 'var(--sma-active-text)' }}>
                  <Plus className="w-4 h-4" style={{ color: 'var(--sma-primary)' }} />
                  <span>{editingCourseId ? 'Edit Course Specification' : 'Create Major / Minor Course'}</span>
                </h3>
                {editingCourseId && (
                  <button type="button" onClick={resetCourseForm} className="text-xs font-semibold underline cursor-pointer" style={{ color: 'var(--sma-primary)' }}>
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Course Type</label>
                  <select
                    value={courseForm.courseType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'major' | 'minor';
                      setCourseForm((prev) => ({
                        ...prev,
                        courseType: nextType,
                        credits: nextType === 'major' ? 12 : 4,
                        duration: nextType === 'major' ? '12 Months' : '4 Months',
                        level: nextType === 'major' ? 'DIPLOMA' : 'CERTIFICATE',
                      }));
                    }}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  >
                    <option value="major">Major Course (Core)</option>
                    <option value="minor">Minor Course (Elective)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Course Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SMA-AIUX"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-mono uppercase focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Creative Production & Visual Systems"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    required
                    value={courseForm.credits}
                    onChange={(e) => setCourseForm({ ...courseForm, credits: Number(e.target.value) })}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Duration</label>
                  <input
                    type="text"
                    required
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Max Seats</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={courseForm.maxSeats}
                    onChange={(e) => setCourseForm({ ...courseForm, maxSeats: Number(e.target.value) })}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Category</label>
                  <select
                    value={courseForm.categoryId}
                    onChange={(e) => setCourseForm({ ...courseForm, categoryId: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Fee (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={courseForm.fee}
                    onChange={(e) => setCourseForm({ ...courseForm, fee: Number(e.target.value) })}
                    className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums focus:outline-none"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Eligibility</label>
                <input
                  type="text"
                  value={courseForm.eligibility}
                  onChange={(e) => setCourseForm({ ...courseForm, eligibility: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Prerequisites (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Basic Digital Literacy, Design Fundamentals"
                  value={courseForm.prerequisitesText}
                  onChange={(e) => setCourseForm({ ...courseForm, prerequisitesText: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Description &amp; Examination Requirements</label>
                <textarea
                  rows={2}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="Course summary and practical outcomes..."
                  className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>

              {/* Modules Editor */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--sma-active-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                    Syllabus Modules ({draftModules.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftModules((prev) => [
                        ...prev,
                        { title: `Module ${prev.length + 1}: New Topic`, description: '', durationHours: 16 },
                      ])
                    }
                    className="text-xs font-semibold cursor-pointer"
                    style={{ color: 'var(--sma-primary)' }}
                  >
                    + Add Module
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {draftModules.map((mod, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => {
                          const next = [...draftModules];
                          next[idx] = { ...next[idx], title: e.target.value };
                          setDraftModules(next);
                        }}
                        className="col-span-8 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                      />
                      <input
                        type="number"
                        min={1}
                        value={mod.durationHours}
                        onChange={(e) => {
                          const next = [...draftModules];
                          next[idx] = { ...next[idx], durationHours: Number(e.target.value) };
                          setDraftModules(next);
                        }}
                        className="col-span-3 rounded-lg border px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none"
                        style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setDraftModules((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 text-rose-500 hover:text-rose-600 cursor-pointer flex justify-center"
                        aria-label="Remove module"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--sma-primary)' }}
              >
                {saving ? 'Saving...' : editingCourseId ? 'Update Course Specification' : 'Publish Course to Catalogue'}
              </button>
            </form>

            {/* Quick Category Creator */}
            <form
              onSubmit={handleSaveCategory}
              className="rounded-2xl border p-4 flex items-center gap-2.5"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <Layers className="w-4 h-4 shrink-0" style={{ color: 'var(--sma-secondary)' }} />
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Add new academic category..."
                className="flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
              />
              <button
                type="submit"
                disabled={saving || !newCategoryName.trim()}
                className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-50"
                style={{ backgroundColor: 'var(--sma-secondary)' }}
              >
                Add Category
              </button>
            </form>
          </div>

          {/* Catalogue Cards List */}
          <div className="xl:col-span-7 space-y-4">
            {[
              { title: 'Major Courses (Primary Specializations)', list: majorCourses, tone: 'var(--sma-primary)' },
              { title: 'Minor Courses (Supplementary Electives)', list: minorCourses, tone: 'var(--sma-secondary)' },
            ].map((group) => (
              <div
                key={group.title}
                className="rounded-2xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--sma-active-surface)',
                  borderColor: 'var(--sma-active-border)',
                }}
              >
                <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--sma-active-border)' }}>
                  <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                    {group.title}
                  </h3>
                  <span className="text-xs font-mono font-bold tabular-nums" style={{ color: group.tone }}>
                    {group.list.length} Courses
                  </span>
                </div>

                <div className="space-y-3">
                  {group.list.map((course) => {
                    const courseMods = modules.filter((m) => m.courseId === course.id);
                    const courseCred = credits.find((cr) => cr.courseId === course.id);
                    const assignedTutors = tutorAllocations.filter((a) => a.courseId === course.id);
                    return (
                      <div
                        key={course.id}
                        className="rounded-xl border p-4 space-y-2.5"
                        style={{
                          backgroundColor: 'var(--sma-active-bg)',
                          borderColor: 'var(--sma-active-border)',
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: group.tone }}>
                              {course.code} · {course.duration} · {courseCred?.totalCredits ?? course.credits ?? 4} Credits · {course.status}
                            </p>
                            <h4 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                              {course.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditCourse(course)}
                              className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleArchive(course)}
                              className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text-muted)' }}
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>{course.status === 'ACTIVE' ? 'Archive' : 'Activate'}</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed" style={{ color: 'var(--sma-active-text-muted)' }}>
                          {course.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono pt-1" style={{ color: 'var(--sma-active-text-muted)' }}>
                          <span>Seats: {course.enrolledCount ?? 0}/{course.maxSeats ?? 40}</span>
                          <span>Modules: {courseMods.length}</span>
                          <span>Tutors: {assignedTutors.length > 0 ? assignedTutors.map((t) => t.tutorName).join(', ') : course.coordinator || 'Unassigned'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TUTOR ALLOCATIONS */}
      {activeTab === 'allocations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAllocateTutor}
            className="lg:col-span-5 rounded-2xl border p-5 space-y-4 h-fit"
            style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
          >
            <h3 className="text-sm font-serif font-bold border-b pb-3" style={{ color: 'var(--sma-active-text)', borderColor: 'var(--sma-active-border)' }}>
              Allocate Faculty Tutor to Major / Minor Course
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Select Course</label>
              <select
                value={allocCourseId}
                onChange={(e) => setAllocCourseId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{(c.courseType || 'major').toUpperCase()}] {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Select Faculty Tutor</label>
              <select
                value={allocTutorId}
                onChange={(e) => setAllocTutorId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
              >
                {tutors.length === 0 ? (
                  <option value="inst-1">Default Academy Tutor</option>
                ) : (
                  tutors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.specialization || t.email})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Allocation Role</label>
              <select
                value={allocRole}
                onChange={(e) => setAllocRole(e.target.value as 'LEAD' | 'CO_TUTOR')}
                className="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none"
                style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
              >
                <option value="LEAD">Lead Course Tutor</option>
                <option value="CO_TUTOR">Co-Tutor / Lab Mentor</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--sma-primary)' }}
            >
              Assign Tutor to Course
            </button>
          </form>

          <div
            className="lg:col-span-7 rounded-2xl border p-5 space-y-3"
            style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
          >
            <h3 className="text-sm font-serif font-bold border-b pb-3" style={{ color: 'var(--sma-active-text)', borderColor: 'var(--sma-active-border)' }}>
              Active Faculty Allocations ({tutorAllocations.length})
            </h3>
            {tutorAllocations.length === 0 ? (
              <p className="text-xs py-8 text-center" style={{ color: 'var(--sma-active-text-muted)' }}>
                No explicit Major/Minor tutor allocations recorded yet. Use the form on the left to bind tutors to courses.
              </p>
            ) : (
              <div className="space-y-2.5">
                {tutorAllocations.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
                    style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono uppercase" style={{ color: 'var(--sma-primary)' }}>
                        {alloc.courseType.toUpperCase()} · {alloc.role}
                      </p>
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--sma-active-text)' }}>
                        {alloc.tutorName} — {getCourseTitle(alloc.courseId)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveAllocation(alloc.id)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                      style={{ borderColor: 'var(--sma-active-border)' }}
                    >
                      Unassign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT COURSE SELECTION APPROVAL QUEUE */}
      {activeTab === 'approvals' && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
            <div>
              <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                Student Major &amp; Minor Course Selections
              </h3>
              <p className="text-xs" style={{ color: 'var(--sma-active-text-muted)' }}>
                Review submitted combinations, verify credit totals, and issue approval to activate enrollments.
              </p>
            </div>
          </div>

          {selections.length === 0 ? (
            <p className="text-xs py-10 text-center" style={{ color: 'var(--sma-active-text-muted)' }}>
              No student Major &amp; Minor course selections have been submitted yet.
            </p>
          ) : (
            <div className="space-y-3">
              {selections.map((sel) => (
                <div
                  key={sel.id}
                  className="rounded-xl border p-4 space-y-3"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                        {sel.studentName} · <span className="font-mono font-normal">{sel.studentEmail || sel.studentId}</span>
                      </p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--sma-active-text-muted)' }}>
                        Status: <strong style={{ color: sel.approvalStatus === 'APPROVED' ? 'var(--sma-accent)' : 'var(--sma-primary)' }}>{sel.approvalStatus}</strong> · Credits: <strong className="tabular-nums">{sel.totalCredits}</strong>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {sel.submittedAt ? `Submitted ${new Date(sel.submittedAt).toLocaleDateString()}` : 'Draft'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}>
                      <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--sma-primary)' }}>Major Specialization</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--sma-active-text)' }}>{getCourseTitle(sel.majorCourseId)}</p>
                    </div>
                    <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}>
                      <span className="text-[10px] font-mono uppercase block" style={{ color: 'var(--sma-secondary)' }}>Minor Electives ({sel.minorCourseIds.length})</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--sma-active-text)' }}>
                        {sel.minorCourseIds.length > 0 ? sel.minorCourseIds.map(getCourseTitle).join(' · ') : 'None selected'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={reviewRemarks[sel.id] ?? sel.remarks ?? ''}
                      onChange={(e) => setReviewRemarks((prev) => ({ ...prev, [sel.id]: e.target.value }))}
                      placeholder="Optional approval / modification remarks..."
                      className="flex-1 min-w-[220px] rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleReviewSelection(sel.id, 'APPROVED')}
                      className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: 'var(--sma-accent)' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleReviewSelection(sel.id, 'MODIFICATION_REQUIRED')}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                    >
                      Request Revision
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleReviewSelection(sel.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SELECTION POLICY, STUDENT-WISE ALLOCATIONS & AUDIT LOGS */}
      {activeTab === 'policy-reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSavePolicy}
            className="lg:col-span-5 rounded-2xl border p-5 space-y-4 h-fit"
            style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
          >
            <h3 className="text-sm font-serif font-bold border-b pb-3" style={{ color: 'var(--sma-active-text)', borderColor: 'var(--sma-active-border)' }}>
              Major &amp; Minor Selection Rules &amp; Deadlines
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Min Minor Courses</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={policy.minMinorSelections}
                  onChange={(e) => setPolicy({ ...policy, minMinorSelections: Number(e.target.value) })}
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Max Minor Courses</label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={policy.maxMinorSelections}
                  onChange={(e) => setPolicy({ ...policy, maxMinorSelections: Number(e.target.value) })}
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Max Total Credits</label>
                <input
                  type="number"
                  min={4}
                  max={60}
                  value={policy.maxTotalCredits}
                  onChange={(e) => setPolicy({ ...policy, maxTotalCredits: Number(e.target.value) })}
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono tabular-nums"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold block" style={{ color: 'var(--sma-active-text-muted)' }}>Submission Deadline</label>
                <input
                  type="date"
                  value={policy.selectionDeadline || ''}
                  onChange={(e) => setPolicy({ ...policy, selectionDeadline: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono"
                  style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text)' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}>
              <div className="flex items-center gap-2">
                {policy.selectionLocked ? <Lock className="w-4 h-4 text-rose-500" /> : <Unlock className="w-4 h-4" style={{ color: 'var(--sma-accent)' }} />}
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                    Lock Student Course Selection
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                    Freeze new student changes after deadline
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={policy.selectionLocked}
                onChange={(e) => setPolicy({ ...policy, selectionLocked: e.target.checked })}
                className="w-4 h-4 accent-[#6941C6] cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--sma-primary)' }}
            >
              Save Academic Rules &amp; Lock Settings
            </button>
          </form>

          <div className="lg:col-span-7 space-y-5">
            {/* Student-wise Normalized Enrollments */}
            <div
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--sma-active-border)' }}>
                <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  Approved Student-Wise Course Allocations ({enrollments.length})
                </h3>
                <a
                  href={academyService.getCourseSelectionExportUrl('json')}
                  className="text-xs font-mono font-semibold underline"
                  style={{ color: 'var(--sma-primary)' }}
                >
                  Download JSON Report
                </a>
              </div>
              {enrollments.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--sma-active-text-muted)' }}>
                  Approve a student course selection to generate normalized enrollment allocations.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b font-mono text-[10px] uppercase" style={{ borderColor: 'var(--sma-active-border)', color: 'var(--sma-active-text-muted)' }}>
                        <th className="py-2 pr-3">Student</th>
                        <th className="py-2 pr-3">Course</th>
                        <th className="py-2 pr-3">Track</th>
                        <th className="py-2">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--sma-active-border)' }}>
                      {enrollments.slice(0, 20).map((enr) => (
                        <tr key={enr.id}>
                          <td className="py-2.5 pr-3 font-semibold" style={{ color: 'var(--sma-active-text)' }}>{enr.studentName}</td>
                          <td className="py-2.5 pr-3" style={{ color: 'var(--sma-active-text-muted)' }}>{getCourseTitle(enr.courseId)}</td>
                          <td className="py-2.5 pr-3 font-mono uppercase">{enr.courseType}</td>
                          <td className="py-2.5 font-mono tabular-nums font-bold" style={{ color: 'var(--sma-accent)' }}>{enr.progressPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Approval Audit Trail */}
            <div
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: 'var(--sma-active-surface)', borderColor: 'var(--sma-active-border)' }}
            >
              <h3 className="text-sm font-serif font-bold flex items-center gap-2 border-b pb-2.5" style={{ color: 'var(--sma-active-text)', borderColor: 'var(--sma-active-border)' }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--sma-secondary)' }} />
                <span>Course Approval Audit Logs</span>
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {approvalLogs.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--sma-active-text-muted)' }}>No approval events recorded yet.</p>
                ) : (
                  approvalLogs.slice(0, 15).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3"
                      style={{ backgroundColor: 'var(--sma-active-bg)', borderColor: 'var(--sma-active-border)' }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--sma-active-text)' }}>
                          {log.studentName || log.studentId} · {log.previousStatus} → {log.nextStatus}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--sma-active-text-muted)' }}>
                          By {log.actorName} — {log.remarks}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--sma-active-text-muted)' }}>
                        {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
