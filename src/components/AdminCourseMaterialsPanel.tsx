/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  EyeOff,
  Download,
  Replace,
  ShieldCheck,
  X,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import {
  Course,
  CoursePaper,
  CoursePaperCategory,
  COURSE_PAPER_CATEGORIES,
  User,
} from '../db/mockDb';
import { academyService, validateCoursePaperFile } from '../services/academyService';
import CoursePaperPreviewModal, {
  PreviewablePaper,
  formatPaperDate,
  formatPaperFileSize,
  triggerBrandedPdfDownload,
} from './CoursePaperPreviewModal';

interface StagedUploadItem {
  localId: string;
  file: File;
  title: string;
  previewUrl: string;
  progress: number;
  status: 'PENDING' | 'UPLOADING' | 'DONE' | 'ERROR';
  error?: string;
}

interface AdminCourseMaterialsPanelProps {
  courses: Course[];
  currentUser: User;
  firebaseConnected: boolean;
  onConnectGoogleAdmin: () => Promise<void>;
}

export default function AdminCourseMaterialsPanel({
  courses,
  currentUser,
  firebaseConnected,
  onConnectGoogleAdmin,
}: AdminCourseMaterialsPanelProps) {
  const [papers, setPapers] = useState<CoursePaper[]>([]);
  const [papersState, setPapersState] = useState<'loading' | 'empty' | 'success' | 'error'>('loading');
  const [papersError, setPapersError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Banner feedback
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload form states
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [semester, setSemester] = useState<string>('Semester 1');
  const [subject, setSubject] = useState<string>('');
  const [moduleName, setModuleName] = useState<string>('Module 1');
  const [paperTitle, setPaperTitle] = useState<string>('');
  const [paperDescription, setPaperDescription] = useState<string>('');
  const [category, setCategory] = useState<CoursePaperCategory>('Study Materials');
  const [publishImmediately, setPublishImmediately] = useState<boolean>(false);
  const [stagedFiles, setStagedFiles] = useState<StagedUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSemester, setFilterSemester] = useState<string>('ALL');
  const [filterPublish, setFilterPublish] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  // Preview, Edit & Replace states
  const [previewPaper, setPreviewPaper] = useState<PreviewablePaper | null>(null);
  const [editingPaper, setEditingPaper] = useState<CoursePaper | null>(null);
  const [editForm, setEditForm] = useState({
    courseId: '',
    semester: '',
    subject: '',
    module: '',
    title: '',
    description: '',
    category: 'Study Materials' as CoursePaperCategory,
    isPublished: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [replacingPaper, setReplacingPaper] = useState<CoursePaper | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number>(0);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmDeletePaper, setConfirmDeletePaper] = useState<CoursePaper | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (courses.length > 0 && (!selectedCourseId || !courses.some((c) => c.id === selectedCourseId))) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (!firebaseConnected) {
      setPapersState('empty');
      setPapers([]);
      return;
    }

    setPapersState('loading');
    setPapersError(null);
    const unsubscribe = academyService.subscribeCoursePapers({
      mode: 'ADMIN',
      onData: (list) => {
        setPapers(list);
        setPapersState(list.length === 0 ? 'empty' : 'success');
        setPapersError(null);
      },
      onError: (err) => {
        setPapersError(err.message || 'Unable to load course materials.');
        setPapersState('error');
      },
    });
    return () => unsubscribe();
  }, [firebaseConnected, retryKey]);

  // Cleanup staged ObjectURLs on unmount
  useEffect(() => {
    return () => {
      stagedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setNotice(null);
    const nextItems: StagedUploadItem[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file, idx) => {
      const err = validateCoursePaperFile(file);
      if (err) {
        errors.push(err);
        return;
      }
      const cleanDefaultTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      nextItems.push({
        localId: `stage-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        title: fileList.length === 1 && paperTitle.trim() ? paperTitle.trim() : cleanDefaultTitle,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'PENDING',
      });
    });

    if (errors.length > 0) {
      setNotice({ type: 'error', text: errors.join(' ') });
    }
    if (nextItems.length > 0) {
      setStagedFiles((prev) => [...prev, ...nextItems]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStagedFile = (localId: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!firebaseConnected || !auth.currentUser) {
      setNotice({
        type: 'error',
        text: 'Please connect your authorized Admin Google account first to upload PDFs to Firebase Storage.',
      });
      return;
    }

    if (!selectedCourseId) {
      setNotice({ type: 'error', text: 'Please select an existing course.' });
      return;
    }

    if (!subject.trim() || !semester.trim() || !moduleName.trim()) {
      setNotice({ type: 'error', text: 'Please enter semester, subject, and module details.' });
      return;
    }

    if (stagedFiles.length === 0) {
      setNotice({ type: 'error', text: 'Please select one or more PDF files to upload.' });
      return;
    }

    const courseObj = courses.find((c) => c.id === selectedCourseId);
    setIsUploading(true);
    let successCount = 0;
    let failureCount = 0;

    for (const item of stagedFiles) {
      if (item.status === 'DONE') continue;
      const finalTitle =
        stagedFiles.length === 1 && paperTitle.trim()
          ? paperTitle.trim()
          : item.title.trim() || item.file.name.replace(/\.pdf$/i, '');

      setStagedFiles((prev) =>
        prev.map((s) => (s.localId === item.localId ? { ...s, status: 'UPLOADING', progress: 5, error: undefined } : s))
      );

      try {
        const paperId = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const uploaded = await academyService.uploadCoursePaperPdf(
          selectedCourseId,
          paperId,
          item.file,
          (pct) => {
            setStagedFiles((prev) =>
              prev.map((s) => (s.localId === item.localId ? { ...s, progress: pct } : s))
            );
          }
        );

        await academyService.createCoursePaper({
          id: paperId,
          courseId: selectedCourseId,
          courseCode: courseObj?.code || '',
          courseName: courseObj?.name || '',
          semester: semester.trim(),
          subject: subject.trim(),
          module: moduleName.trim(),
          title: finalTitle,
          description: paperDescription.trim(),
          category,
          fileUrl: uploaded.fileUrl,
          storagePath: uploaded.storagePath,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          fileType: uploaded.fileType,
          isPublished: publishImmediately,
          uploadedByName: currentUser.name,
        });

        successCount += 1;
        URL.revokeObjectURL(item.previewUrl);
        setStagedFiles((prev) => prev.filter((s) => s.localId !== item.localId));
      } catch (err: any) {
        failureCount += 1;
        setStagedFiles((prev) =>
          prev.map((s) =>
            s.localId === item.localId
              ? { ...s, status: 'ERROR', error: err?.message || 'Upload failed' }
              : s
          )
        );
      }
    }

    setIsUploading(false);
    if (successCount > 0 && failureCount === 0) {
      setPaperTitle('');
      setPaperDescription('');
      setNotice({
        type: 'success',
        text: `${successCount} PDF ${successCount === 1 ? 'document' : 'documents'} uploaded to Firebase Storage and ${publishImmediately ? 'published' : 'saved as draft'}.`,
      });
    } else if (failureCount > 0) {
      setNotice({
        type: 'error',
        text: `${successCount} uploaded, ${failureCount} failed. Check item errors below and confirm Admin Google authorization.`,
      });
    }
  };

  const handleTogglePublish = async (paper: CoursePaper) => {
    setNotice(null);
    try {
      await academyService.toggleCoursePaperPublish(paper.id, !paper.isPublished);
      setNotice({
        type: 'success',
        text: `"${paper.title}" is now ${!paper.isPublished ? 'Published (visible to enrolled students)' : 'Unpublished (hidden draft)'}.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update publication status.' });
    }
  };

  const openEditModal = (paper: CoursePaper) => {
    setEditingPaper(paper);
    setEditForm({
      courseId: paper.courseId,
      semester: paper.semester,
      subject: paper.subject,
      module: paper.module,
      title: paper.title,
      description: paper.description || '',
      category: paper.category,
      isPublished: paper.isPublished,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaper) return;
    setSavingEdit(true);
    setNotice(null);
    try {
      const courseObj = courses.find((c) => c.id === editForm.courseId);
      await academyService.updateCoursePaper(editingPaper.id, {
        courseId: editForm.courseId,
        courseCode: courseObj?.code || editingPaper.courseCode || '',
        courseName: courseObj?.name || editingPaper.courseName || '',
        semester: editForm.semester.trim(),
        subject: editForm.subject.trim(),
        module: editForm.module.trim(),
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
        isPublished: editForm.isPublished,
        ...(editForm.isPublished && !editingPaper.publishedAt ? { publishedAt: new Date().toISOString() } : {}),
      });
      setEditingPaper(null);
      setNotice({ type: 'success', text: `Updated course material "${editForm.title.trim()}".` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update material metadata.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTriggerReplace = (paper: CoursePaper) => {
    setReplacingPaper(paper);
    setReplaceProgress(0);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = async (file: File | null) => {
    if (!file || !replacingPaper) return;
    const validationErr = validateCoursePaperFile(file);
    if (validationErr) {
      setNotice({ type: 'error', text: validationErr });
      setReplacingPaper(null);
      return;
    }

    setNotice(null);
    try {
      await academyService.replaceCoursePaperPdf(replacingPaper, file, (pct) => {
        setReplaceProgress(pct);
      });
      setNotice({ type: 'success', text: `Replaced PDF document for "${replacingPaper.title}".` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to replace PDF document.' });
    } finally {
      setReplacingPaper(null);
      setReplaceProgress(0);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeletePaper) return;
    setDeletingId(confirmDeletePaper.id);
    setNotice(null);
    try {
      await academyService.deleteCoursePaper(confirmDeletePaper);
      setNotice({ type: 'success', text: `Deleted "${confirmDeletePaper.title}" and removed PDF from storage.` });
      setConfirmDeletePaper(null);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to delete document.' });
    } finally {
      setDeletingId(null);
    }
  };

  const availableSemesters = useMemo(() => {
    return Array.from(new Set(papers.map((p) => p.semester).filter(Boolean))).sort();
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return papers.filter((p) => {
      if (filterCourseId !== 'ALL' && p.courseId !== filterCourseId) return false;
      if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
      if (filterSemester !== 'ALL' && p.semester !== filterSemester) return false;
      if (filterPublish === 'PUBLISHED' && !p.isPublished) return false;
      if (filterPublish === 'DRAFT' && p.isPublished) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        p.semester.toLowerCase().includes(q) ||
        (p.courseCode || '').toLowerCase().includes(q) ||
        (p.courseName || '').toLowerCase().includes(q) ||
        p.fileName.toLowerCase().includes(q)
      );
    });
  }, [papers, searchQuery, filterCourseId, filterCategory, filterSemester, filterPublish]);

  const selectedCourseObj = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-serif font-bold text-white">
              Course Materials Management
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload single or multiple PDF papers, preview before publishing, organize by semester/subject/module, and control student access.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            Total: <strong className="text-amber-400">{papers.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            Published: <strong>{papers.filter((p) => p.isPublished).length}</strong>
          </span>
        </div>
      </div>

      {/* Firebase Google Admin Connection Banner */}
      {!firebaseConnected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Admin Firebase Verification Required for PDF Uploads
              </p>
              <p className="text-xs text-slate-300">
                You signed in via local session. Connect your authorized Swanaya Admin Google account to upload PDFs to Firebase Storage and publish materials to students.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onConnectGoogleAdmin}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer shrink-0 flex items-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            <span>Connect Admin Google</span>
          </button>
        </div>
      )}

      {/* Status Notice */}
      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* UPLOAD & STAGING FORM */}
      <form onSubmit={handleUploadAll} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h4 className="text-sm font-serif font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Upload Single or Multiple PDF Course Papers</span>
          </h4>
          <span className="text-[11px] font-mono text-slate-400">PDF only · Max 25 MB per file</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Select Existing Course *
            </label>
            <select
              required
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            >
              {courses.length === 0 ? (
                <option value="">No courses found</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Document Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CoursePaperCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            >
              {COURSE_PAPER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Semester / Term *
            </label>
            <input
              type="text"
              required
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="e.g. Semester 1"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Subject *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. AI Direction & Post-Production"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Module *
            </label>
            <input
              type="text"
              required
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="e.g. Module 2: Color Grading"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Paper Title {stagedFiles.length > 1 ? '(Optional override for multi-upload)' : '*'}
            </label>
            <input
              type="text"
              value={paperTitle}
              onChange={(e) => setPaperTitle(e.target.value)}
              placeholder={stagedFiles.length > 1 ? 'Edit individual titles below' : 'e.g. Studio Lighting Study Guide'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Paper Description
          </label>
          <textarea
            rows={2}
            value={paperDescription}
            onChange={(e) => setPaperDescription(e.target.value)}
            placeholder="Brief syllabus notes, key exam topics covered, or submission instructions..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Multi-file PDF Picker */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950/70 border border-dashed border-slate-700 rounded-xl">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-200">
                Select one or multiple PDF files to stage &amp; preview before publishing
              </p>
              <p className="text-[11px] text-slate-400">
                Validated automatically for <code className="text-amber-300">.pdf</code> MIME type and size &le; 25 MB.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add PDF Files</span>
              </button>
            </div>
          </div>

          {/* Staged Upload Queue with Pre-Publish Preview */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2.5 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold uppercase text-amber-400">
                  Staged Upload Queue ({stagedFiles.length} PDF{stagedFiles.length === 1 ? '' : 's'})
                </span>
                <span className="text-[11px] text-slate-400">Preview any PDF before publishing</span>
              </div>

              <div className="space-y-2">
                {stagedFiles.map((item) => (
                  <div
                    key={item.localId}
                    className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) =>
                            setStagedFiles((prev) =>
                              prev.map((s) => (s.localId === item.localId ? { ...s, title: e.target.value } : s))
                            )
                          }
                          disabled={item.status === 'UPLOADING'}
                          placeholder="Document Title"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pl-6">
                        <span className="truncate max-w-xs">{item.file.name}</span>
                        <span>{formatPaperFileSize(item.file.size)}</span>
                        {item.status === 'UPLOADING' && (
                          <span className="text-amber-400 font-bold">Uploading {item.progress}%</span>
                        )}
                        {item.status === 'ERROR' && (
                          <span className="text-rose-400">{item.error}</span>
                        )}
                      </div>
                      {item.status === 'UPLOADING' && (
                        <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden ml-6 max-w-md">
                          <div className="bg-amber-500 h-full transition-all" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPaper({
                            title: item.title || item.file.name,
                            description: paperDescription,
                            courseCode: selectedCourseObj?.code,
                            courseName: selectedCourseObj?.name,
                            semester,
                            subject,
                            module: moduleName,
                            category,
                            fileUrl: item.previewUrl,
                            fileName: item.file.name,
                            fileSize: item.file.size,
                            isPublished: false,
                          })
                        }
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedFile(item.localId)}
                        disabled={item.status === 'UPLOADING'}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 text-slate-400 hover:text-rose-400 rounded cursor-pointer disabled:opacity-50"
                        title="Remove staged file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
              className="rounded border-slate-700 accent-amber-500 cursor-pointer"
            />
            <span>
              Publish immediately to enrolled students{' '}
              <span className="text-slate-500">(uncheck to save as unpublished draft for review)</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={isUploading || stagedFiles.length === 0 || courses.length === 0}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            <span>
              {isUploading
                ? 'Uploading PDFs...'
                : publishImmediately
                ? `Upload & Publish (${stagedFiles.length})`
                : `Upload as Draft (${stagedFiles.length})`}
            </span>
          </button>
        </div>
      </form>

      {/* Hidden Replace File Input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => void handleReplaceFileChange(e.target.files?.[0] || null)}
        className="hidden"
      />

      {replacingPaper && replaceProgress > 0 && (
        <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-lg space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-amber-300">
            <span>Replacing PDF for {replacingPaper.title}...</span>
            <span>{replaceProgress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden">
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${replaceProgress}%` }} />
          </div>
        </div>
      )}

      {/* SEARCH & MULTI-FILTER BAR */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, subject, module, file..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Document Categories</option>
            {COURSE_PAPER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Sems</option>
              {availableSemesters.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterPublish}
              onChange={(e) => setFilterPublish(e.target.value as 'ALL' | 'PUBLISHED' | 'DRAFT')}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Unpublished</option>
            </select>
          </div>
        </div>
      </div>

      {/* COURSE MATERIALS CATALOG LIST */}
      {papersState === 'loading' ? (
        <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Loading Course Materials from Firestore...</span>
        </div>
      ) : papersState === 'error' ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-rose-300">Unable to load Course Materials</p>
            <p className="text-xs text-slate-300">{papersError}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/30 border border-slate-800 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-serif font-bold text-slate-200">
            {papers.length === 0 ? 'No Course Materials Uploaded Yet' : 'No Course Materials Match Your Filters'}
          </p>
          <p className="text-xs text-slate-400">
            {papers.length === 0
              ? 'Use the uploader above to upload PDFs, preview them, and publish to students.'
              : 'Adjust your search keyword or category filters to view uploaded papers.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPapers.map((paper) => {
            const matchedCourse = courses.find((c) => c.id === paper.courseId);
            return (
              <div
                key={paper.id}
                className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold">
                        {matchedCourse?.code || paper.courseCode || 'COURSE'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold">
                        {paper.category}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        paper.isPublished
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {paper.isPublished ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-serif font-bold text-white leading-snug">{paper.title}</h4>
                    {paper.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{paper.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-amber-400" />
                      {paper.semester} · {paper.module}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-slate-500" />
                      {paper.subject}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                    <span className="truncate max-w-[220px]" title={paper.fileName}>
                      {paper.fileName} ({formatPaperFileSize(paper.fileSize)})
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatPaperDate(paper.publishedAt || paper.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewPaper(paper)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void triggerBrandedPdfDownload(paper)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(paper)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded cursor-pointer"
                      title="Edit details"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerReplace(paper)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded cursor-pointer"
                      title="Replace PDF file"
                    >
                      <Replace className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePaper(paper)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-rose-400 rounded cursor-pointer"
                      title="Delete course paper"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTogglePublish(paper)}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded flex items-center gap-1 cursor-pointer transition-colors ${
                      paper.isPublished
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {paper.isPublished ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Unpublish</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT METADATA MODAL */}
      {editingPaper && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-serif font-bold text-white">Edit Course Material Details</h3>
              <button
                type="button"
                onClick={() => setEditingPaper(null)}
                className="p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Course *</label>
                  <select
                    required
                    value={editForm.courseId}
                    onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as CoursePaperCategory })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                  >
                    {COURSE_PAPER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Semester *</label>
                  <input
                    type="text"
                    required
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Subject *</label>
                  <input
                    type="text"
                    required
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Module *</label>
                  <input
                    type="text"
                    required
                    value={editForm.module}
                    onChange={(e) => setEditForm({ ...editForm, module: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Paper Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isPublished}
                  onChange={(e) => setEditForm({ ...editForm, isPublished: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
                <span>Published (visible to enrolled students)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPaper(null)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeletePaper && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-rose-500/30 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-serif font-bold text-white">Delete Course Paper</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-amber-300">{confirmDeletePaper.title}</strong> ({confirmDeletePaper.fileName})? This removes both the Firestore metadata and the stored PDF file.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePaper(null)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeletePaper.id}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase rounded cursor-pointer disabled:opacity-50"
              >
                {deletingId === confirmDeletePaper.id ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANDED PDF PREVIEW MODAL */}
      <CoursePaperPreviewModal paper={previewPaper} onClose={() => setPreviewPaper(null)} />
    </div>
  );
}
