/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, UploadCloud, Download, CheckCircle2, AlertCircle, Clock,
  ShieldCheck, Plus, Trash2, CheckSquare, Send, XCircle, Eye, Award, BookOpen, Play
} from 'lucide-react';
import {
  SwanayaDatabase, User, Student, Course, ExamQuestionPaper,
  McqExam, McqQuestion, StudentExamSubmission, Notification
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';

interface ExaminationEngineModuleProps {
  mode: 'STUDENT' | 'INSTRUCTOR' | 'MD';
  currentUser: User;
  studentProfile?: Student | null;
  initialSection?: 'papers' | 'mcq' | 'evaluations';
  onRefreshAllData?: () => void;
}

const MAX_INLINE_FILE_BYTES = 320 * 1024; // Keep Firestore documents well below 1MB limit

function computeGrade(marks: number, maxMarks: number, passMarks: number) {
  if (marks < passMarks) return 'F';
  const pct = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
}

function triggerFileDownload(fileName: string, dataUrl?: string, fallbackText?: string) {
  const link = document.createElement('a');
  if (dataUrl) {
    link.href = dataUrl;
  } else {
    const blob = new Blob([fallbackText || ''], { type: 'text/plain;charset=utf-8' });
    link.href = URL.createObjectURL(blob);
  }
  link.download = fileName || 'document.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ExaminationEngineModule({
  mode,
  currentUser,
  studentProfile,
  initialSection = 'papers',
  onRefreshAllData,
}: ExaminationEngineModuleProps) {
  const courses = useMemo(() => SwanayaDatabase.get<Course[]>('courses') || [], []);

  const [questionPapers, setQuestionPapers] = useState<ExamQuestionPaper[]>(
    () => SwanayaDatabase.get<ExamQuestionPaper[]>('questionPapers') || []
  );
  const [mcqExams, setMcqExams] = useState<McqExam[]>(
    () => SwanayaDatabase.get<McqExam[]>('mcqExams') || []
  );
  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>(
    () => SwanayaDatabase.get<StudentExamSubmission[]>('examSubmissions') || []
  );

  const [activeSection, setActiveSection] = useState<'papers' | 'mcq' | 'evaluations'>(initialSection);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Sync from Firestore when signed in with Firebase Auth
  useEffect(() => {
    let cancelled = false;
    const syncAll = async () => {
      if (!auth.currentUser) return;
      try {
        const [cloudPapers, cloudMcqs, cloudSubs] = await Promise.all([
          academyService.getQuestionPapers().catch(() => []),
          academyService.getMcqExams().catch(() => []),
          academyService
            .getExamSubmissions(mode === 'STUDENT' ? auth.currentUser.uid : undefined)
            .catch(() => []),
        ]);
        if (cancelled) return;

        if (Array.isArray(cloudPapers) && cloudPapers.length > 0) {
          const local = SwanayaDatabase.get<ExamQuestionPaper[]>('questionPapers') || [];
          const map = new Map<string, ExamQuestionPaper>();
          local.forEach((p) => p?.id && map.set(p.id, p));
          (cloudPapers as ExamQuestionPaper[]).forEach((p) => p?.id && map.set(p.id, p));
          const merged = Array.from(map.values()).sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt))
          );
          setQuestionPapers(merged);
          SwanayaDatabase.set('questionPapers', merged);
        }

        if (Array.isArray(cloudMcqs) && cloudMcqs.length > 0) {
          const local = SwanayaDatabase.get<McqExam[]>('mcqExams') || [];
          const map = new Map<string, McqExam>();
          local.forEach((m) => m?.id && map.set(m.id, m));
          (cloudMcqs as McqExam[]).forEach((m) => m?.id && map.set(m.id, m));
          const merged = Array.from(map.values()).sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt))
          );
          setMcqExams(merged);
          SwanayaDatabase.set('mcqExams', merged);
        }

        if (Array.isArray(cloudSubs) && cloudSubs.length > 0) {
          const local = SwanayaDatabase.get<StudentExamSubmission[]>('examSubmissions') || [];
          const map = new Map<string, StudentExamSubmission>();
          local.forEach((s) => s?.id && map.set(s.id, s));
          (cloudSubs as StudentExamSubmission[]).forEach((s) => s?.id && map.set(s.id, s));
          const merged = Array.from(map.values()).sort((a, b) =>
            String(b.submittedAt).localeCompare(String(a.submittedAt))
          );
          setExamSubmissionsSafe(merged);
        }
      } catch {
        // Local storage state stays intact
      }
    };
    syncAll();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const setExamSubmissionsSafe = (next: StudentExamSubmission[]) => {
    setSubmissions(next);
    SwanayaDatabase.set('examSubmissions', next);
  };

  // --- INSTRUCTOR: Question Paper Builder State ---
  const [paperForm, setPaperForm] = useState({
    title: '',
    subjectCode: '',
    subjectName: '',
    courseId: courses[0]?.id || 'general-course',
    durationMinutes: 120,
    totalMarks: 100,
    passMarks: 40,
    instructions: 'Read all sections carefully. Upload your completed answerbook as PDF, DOC, or text before the deadline.',
    paperContent: '',
    paperFileName: '',
    paperFileType: '',
    paperFileDataUrl: '',
  });
  const [savingPaper, setSavingPaper] = useState(false);

  // --- INSTRUCTOR: MCQ Exam Builder State ---
  const [mcqForm, setMcqForm] = useState({
    title: '',
    subjectCode: '',
    subjectName: '',
    courseId: courses[0]?.id || 'general-course',
    durationMinutes: 45,
    passMarks: 10,
  });
  const [mcqQuestions, setMcqQuestions] = useState<McqQuestion[]>([
    {
      id: `q-${Date.now()}`,
      prompt: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      marks: 5,
    },
  ]);
  const [savingMcq, setSavingMcq] = useState(false);

  // --- INSTRUCTOR: Evaluation State ---
  const [evaluatingSub, setEvaluatingSub] = useState<StudentExamSubmission | null>(null);
  const [evalMarks, setEvalMarks] = useState<number>(0);
  const [evalRemarks, setEvalRemarks] = useState<string>('');

  // --- STUDENT: Answerbook Upload State ---
  const [answeringPaper, setAnsweringPaper] = useState<ExamQuestionPaper | null>(null);
  const [answerNotes, setAnswerNotes] = useState('');
  const [answerFile, setAnswerFile] = useState<{ name: string; type: string; dataUrl: string }>({
    name: '',
    type: '',
    dataUrl: '',
  });
  const [submittingAnswerbook, setSubmittingAnswerbook] = useState(false);

  // --- STUDENT: MCQ Exam Runner State ---
  const [activeMcqExam, setActiveMcqExam] = useState<McqExam | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [currentMcqIdx, setCurrentMcqIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmSubmitMcq, setConfirmSubmitMcq] = useState(false);

  // --- MD: Verification Remarks & Preview State ---
  const [mdRemarksMap, setMdRemarksMap] = useState<Record<string, string>>({});
  const [previewPaper, setPreviewPaper] = useState<ExamQuestionPaper | null>(null);
  const [previewMcq, setPreviewMcq] = useState<McqExam | null>(null);

  // Countdown timer for Student MCQ Exam Runner
  useEffect(() => {
    if (!activeMcqExam) return;
    if (secondsLeft <= 0) {
      handleFinishMcqExam(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMcqExam, secondsLeft]);

  const activeUserUid = auth.currentUser?.uid || currentUser.id;
  const studentRegNo =
    studentProfile?.studentId || `SMA-${currentUser.id.slice(-5).toUpperCase()}`;

  // File reader helper with safe size enforcement
  const handleReadUploadFile = (
    file: File | undefined,
    onDone: (result: { name: string; type: string; dataUrl: string }) => void
  ) => {
    if (!file) return;
    if (file.size > MAX_INLINE_FILE_BYTES) {
      setNotice({
        type: 'error',
        text: `File "${file.name}" exceeds 320 KB inline limit. Please upload a smaller PDF/image/text file or include written details.`,
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onDone({
        name: file.name,
        type: file.type || 'application/octet-stream',
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      });
    };
    reader.readAsDataURL(file);
  };

  // --- HANDLERS: INSTRUCTOR QUESTION PAPERS ---
  const handleCreateQuestionPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!paperForm.title.trim() || !paperForm.subjectCode.trim()) {
      setNotice({ type: 'error', text: 'Please provide Question Paper title and subject code.' });
      return;
    }
    if (!paperForm.paperContent.trim() && !paperForm.paperFileName) {
      setNotice({
        type: 'error',
        text: 'Please either write the question paper questions or attach a question paper file.',
      });
      return;
    }

    const courseObj = courses.find((c) => c.id === paperForm.courseId);
    const nowIso = new Date().toISOString();
    const newPaper: ExamQuestionPaper = {
      id: `qp-${Date.now()}`,
      title: paperForm.title.trim(),
      subjectCode: paperForm.subjectCode.trim().toUpperCase(),
      subjectName: paperForm.subjectName.trim() || paperForm.title.trim(),
      courseId: courseObj?.id || paperForm.courseId,
      courseName: courseObj?.name || 'Academy Program',
      durationMinutes: Number(paperForm.durationMinutes) || 120,
      totalMarks: Number(paperForm.totalMarks) || 100,
      passMarks: Number(paperForm.passMarks) || 40,
      instructions: paperForm.instructions.trim(),
      paperContent: paperForm.paperContent.trim(),
      ...(paperForm.paperFileName ? { paperFileName: paperForm.paperFileName } : {}),
      ...(paperForm.paperFileType ? { paperFileType: paperForm.paperFileType } : {}),
      ...(paperForm.paperFileDataUrl ? { paperFileDataUrl: paperForm.paperFileDataUrl } : {}),
      createdById: activeUserUid,
      createdByName: currentUser.name,
      mdVerificationStatus: 'PENDING_MD',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setSavingPaper(true);
    try {
      if (auth.currentUser) {
        try {
          await academyService.createQuestionPaper(newPaper);
        } catch (err: any) {
          console.warn('Firestore question paper notice:', err?.message);
        }
      }
      const next = [newPaper, ...questionPapers];
      setQuestionPapers(next);
      SwanayaDatabase.set('questionPapers', next);
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'QUESTION_PAPER_CREATED',
        `${newPaper.title} (${newPaper.subjectCode}) submitted for MD verification`
      );
      setPaperForm({
        ...paperForm,
        title: '',
        subjectCode: '',
        subjectName: '',
        paperContent: '',
        paperFileName: '',
        paperFileType: '',
        paperFileDataUrl: '',
      });
      setNotice({
        type: 'success',
        text: `Question paper "${newPaper.title}" submitted for MD verification.`,
      });
      onRefreshAllData?.();
    } finally {
      setSavingPaper(false);
    }
  };

  // --- HANDLERS: INSTRUCTOR MCQ EXAM BUILDER ---
  const handleAddMcqQuestion = () => {
    setMcqQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${prev.length + 1}`,
        prompt: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        marks: 5,
      },
    ]);
  };

  const handleRemoveMcqQuestion = (qId: string) => {
    if (mcqQuestions.length <= 1) return;
    setMcqQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const handleUpdateMcqQuestion = (
    qId: string,
    patch: Partial<McqQuestion>
  ) => {
    setMcqQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, ...patch } : q))
    );
  };

  const handleCreateMcqExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!mcqForm.title.trim() || !mcqForm.subjectCode.trim()) {
      setNotice({ type: 'error', text: 'Please enter MCQ exam title and subject code.' });
      return;
    }

    const sanitizedQuestions = mcqQuestions.map((q) => ({
      ...q,
      prompt: q.prompt.trim(),
      options: q.options.map((o) => o.trim()),
      marks: Number(q.marks) || 1,
    }));

    const hasInvalidQuestion = sanitizedQuestions.some(
      (q) => !q.prompt || q.options.some((opt) => !opt)
    );
    if (hasInvalidQuestion) {
      setNotice({
        type: 'error',
        text: 'Please complete every MCQ question prompt and all 4 answer options.',
      });
      return;
    }

    const totalMarks = sanitizedQuestions.reduce((sum, q) => sum + q.marks, 0);
    const passMarks = Math.min(Number(mcqForm.passMarks) || Math.ceil(totalMarks * 0.4), totalMarks);
    const courseObj = courses.find((c) => c.id === mcqForm.courseId);
    const nowIso = new Date().toISOString();

    const newExam: McqExam = {
      id: `mcq-${Date.now()}`,
      title: mcqForm.title.trim(),
      subjectCode: mcqForm.subjectCode.trim().toUpperCase(),
      subjectName: mcqForm.subjectName.trim() || mcqForm.title.trim(),
      courseId: courseObj?.id || mcqForm.courseId,
      courseName: courseObj?.name || 'Academy Program',
      durationMinutes: Number(mcqForm.durationMinutes) || 45,
      totalMarks,
      passMarks,
      questions: sanitizedQuestions,
      createdById: activeUserUid,
      createdByName: currentUser.name,
      mdVerificationStatus: 'PENDING_MD',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setSavingMcq(true);
    try {
      if (auth.currentUser) {
        try {
          await academyService.createMcqExam(newExam);
        } catch (err: any) {
          console.warn('Firestore MCQ exam notice:', err?.message);
        }
      }
      const next = [newExam, ...mcqExams];
      setMcqExams(next);
      SwanayaDatabase.set('mcqExams', next);
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'MCQ_EXAM_CREATED',
        `${newExam.title} (${newExam.questions.length} MCQs) submitted for MD verification`
      );
      setMcqForm({
        ...mcqForm,
        title: '',
        subjectCode: '',
        subjectName: '',
      });
      setMcqQuestions([
        {
          id: `q-${Date.now()}`,
          prompt: '',
          options: ['', '', '', ''],
          correctIndex: 0,
          marks: 5,
        },
      ]);
      setNotice({
        type: 'success',
        text: `MCQ Examination "${newExam.title}" (${totalMarks} marks) submitted for MD verification.`,
      });
      onRefreshAllData?.();
    } finally {
      setSavingMcq(false);
    }
  };

  // --- HANDLERS: STUDENT ANSWERBOOK UPLOAD ---
  const handleSubmitAnswerbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answeringPaper) return;
    setNotice(null);

    if (!answerFile.name && !answerNotes.trim()) {
      setNotice({
        type: 'error',
        text: 'Please upload your answerbook file or provide your written answerbook content.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const newSub: StudentExamSubmission = {
      id: `exsub-${Date.now()}`,
      mode: 'ANSWERBOOK',
      examRefId: answeringPaper.id,
      examTitle: answeringPaper.title,
      subjectCode: answeringPaper.subjectCode,
      userId: activeUserUid,
      studentId: studentProfile?.id || currentUser.id,
      studentName: studentProfile?.name || currentUser.name,
      studentRegisterNo: studentRegNo,
      answerNotes: answerNotes.trim(),
      ...(answerFile.name ? { answerFileName: answerFile.name } : {}),
      ...(answerFile.type ? { answerFileType: answerFile.type } : {}),
      ...(answerFile.dataUrl ? { answerFileDataUrl: answerFile.dataUrl } : {}),
      maxMarks: answeringPaper.totalMarks,
      passMarks: answeringPaper.passMarks,
      evaluationStatus: 'SUBMITTED',
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    setSubmittingAnswerbook(true);
    try {
      if (auth.currentUser) {
        try {
          await academyService.createExamSubmission(newSub);
        } catch (err: any) {
          console.warn('Firestore answerbook upload notice:', err?.message);
        }
      }
      const next = [newSub, ...submissions];
      setExamSubmissionsSafe(next);
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'ANSWERBOOK_UPLOADED',
        `${answeringPaper.title} (${answerFile.name || 'Text Answerbook'})`
      );
      setAnsweringPaper(null);
      setAnswerNotes('');
      setAnswerFile({ name: '', type: '', dataUrl: '' });
      setNotice({
        type: 'success',
        text: `Answerbook uploaded for "${answeringPaper.title}". Sent to Instructor for evaluation.`,
      });
      onRefreshAllData?.();
    } finally {
      setSubmittingAnswerbook(false);
    }
  };

  // --- HANDLERS: STUDENT MCQ EXAM RUNNER ---
  const handleStartMcqExam = (exam: McqExam) => {
    setActiveMcqExam(exam);
    setMcqAnswers({});
    setCurrentMcqIdx(0);
    setSecondsLeft(exam.durationMinutes * 60);
    setConfirmSubmitMcq(false);
    setNotice(null);
  };

  const handleFinishMcqExam = async (autoExpired = false) => {
    if (!activeMcqExam) return;

    let autoScore = 0;
    activeMcqExam.questions.forEach((q) => {
      if (mcqAnswers[q.id] === q.correctIndex) {
        autoScore += q.marks;
      }
    });

    const nowIso = new Date().toISOString();
    const newSub: StudentExamSubmission = {
      id: `exsub-${Date.now()}`,
      mode: 'MCQ',
      examRefId: activeMcqExam.id,
      examTitle: activeMcqExam.title,
      subjectCode: activeMcqExam.subjectCode,
      userId: activeUserUid,
      studentId: studentProfile?.id || currentUser.id,
      studentName: studentProfile?.name || currentUser.name,
      studentRegisterNo: studentRegNo,
      mcqAnswers,
      autoScore,
      marksObtained: autoScore,
      maxMarks: activeMcqExam.totalMarks,
      passMarks: activeMcqExam.passMarks,
      evaluationStatus: 'SUBMITTED',
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      try {
        await academyService.createExamSubmission(newSub);
      } catch (err: any) {
        console.warn('Firestore MCQ submission notice:', err?.message);
      }
    }

    const next = [newSub, ...submissions];
    setExamSubmissionsSafe(next);
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'MCQ_EXAM_SUBMITTED',
      `${activeMcqExam.title} · Auto Score: ${autoScore}/${activeMcqExam.totalMarks}`
    );

    const completedTitle = activeMcqExam.title;
    setActiveMcqExam(null);
    setConfirmSubmitMcq(false);
    setNotice({
      type: 'success',
      text: `${autoExpired ? 'Time expired — MCQ' : 'MCQ'} examination "${completedTitle}" submitted. Sent for Instructor evaluation & MD verification.`,
    });
    onRefreshAllData?.();
  };

  // --- HANDLERS: INSTRUCTOR EVALUATION ---
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingSub) return;

    const clampedMarks = Math.max(0, Math.min(Number(evalMarks), evaluatingSub.maxMarks));
    const pass = clampedMarks >= evaluatingSub.passMarks;
    const grade = computeGrade(clampedMarks, evaluatingSub.maxMarks, evaluatingSub.passMarks);
    const nowIso = new Date().toISOString();

    const patch: Partial<StudentExamSubmission> = {
      marksObtained: clampedMarks,
      pass,
      grade,
      evaluationStatus: 'INSTRUCTOR_EVALUATED',
      evaluatorId: activeUserUid,
      evaluatorName: currentUser.name,
      evaluatorRemarks: evalRemarks.trim() || 'Evaluated and forwarded for MD verification.',
      evaluatedAt: nowIso,
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateExamSubmission(evaluatingSub.id, patch);
      } catch (err: any) {
        console.warn('Firestore evaluation update notice:', err?.message);
      }
    }

    const next = submissions.map((s) =>
      s.id === evaluatingSub.id ? { ...s, ...patch } : s
    );
    setExamSubmissionsSafe(next);
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      'EXAM_SUBMISSION_EVALUATED',
      `${evaluatingSub.studentName} · ${evaluatingSub.examTitle} (${clampedMarks}/${evaluatingSub.maxMarks}) -> Pending MD Verification`
    );
    setEvaluatingSub(null);
    setEvalRemarks('');
    setNotice({
      type: 'success',
      text: `Evaluation recorded (${clampedMarks}/${evaluatingSub.maxMarks}). Forwarded to MD for final verification.`,
    });
    onRefreshAllData?.();
  };

  // --- HANDLERS: MD VERIFICATION (QUESTION PAPERS, MCQ EXAMS, EVALUATIONS) ---
  const handleMdVerifyPaper = async (
    paper: ExamQuestionPaper,
    decision: 'VERIFIED' | 'REJECTED'
  ) => {
    const remarks = (mdRemarksMap[paper.id] || '').trim();
    const nowIso = new Date().toISOString();
    const patch: Partial<ExamQuestionPaper> = {
      mdVerificationStatus: decision,
      mdVerifiedBy: currentUser.name,
      mdVerifiedAt: nowIso,
      mdRemarks: remarks || (decision === 'VERIFIED' ? 'Verified and cleared by MD.' : 'Returned for revision.'),
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateQuestionPaper(paper.id, patch);
      } catch (err: any) {
        console.warn('Firestore MD verify paper notice:', err?.message);
      }
    }

    const next = questionPapers.map((p) => (p.id === paper.id ? { ...p, ...patch } : p));
    setQuestionPapers(next);
    SwanayaDatabase.set('questionPapers', next);
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      `MD_QUESTION_PAPER_${decision}`,
      `${paper.title} (${paper.subjectCode})`
    );
    setNotice({
      type: 'success',
      text: `Question Paper "${paper.title}" marked as ${decision === 'VERIFIED' ? 'MD Verified & Live to Students' : 'Rejected / Returned'}.`,
    });
    onRefreshAllData?.();
  };

  const handleMdVerifyMcq = async (
    exam: McqExam,
    decision: 'VERIFIED' | 'REJECTED'
  ) => {
    const remarks = (mdRemarksMap[exam.id] || '').trim();
    const nowIso = new Date().toISOString();
    const patch: Partial<McqExam> = {
      mdVerificationStatus: decision,
      mdVerifiedBy: currentUser.name,
      mdVerifiedAt: nowIso,
      mdRemarks: remarks || (decision === 'VERIFIED' ? 'MCQ exam verified by MD.' : 'Returned for question revision.'),
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateMcqExam(exam.id, patch);
      } catch (err: any) {
        console.warn('Firestore MD verify MCQ notice:', err?.message);
      }
    }

    const next = mcqExams.map((m) => (m.id === exam.id ? { ...m, ...patch } : m));
    setMcqExams(next);
    SwanayaDatabase.set('mcqExams', next);
    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      `MD_MCQ_EXAM_${decision}`,
      `${exam.title} (${exam.subjectCode})`
    );
    setNotice({
      type: 'success',
      text: `MCQ Exam "${exam.title}" marked as ${decision === 'VERIFIED' ? 'MD Verified & Live to Students' : 'Rejected / Returned'}.`,
    });
    onRefreshAllData?.();
  };

  const handleMdVerifySubmission = async (
    sub: StudentExamSubmission,
    decision: 'MD_VERIFIED' | 'RETURNED'
  ) => {
    const remarks = (mdRemarksMap[sub.id] || '').trim();
    const nowIso = new Date().toISOString();
    const patch: Partial<StudentExamSubmission> = {
      evaluationStatus: decision,
      mdVerifiedBy: currentUser.name,
      mdVerifiedAt: nowIso,
      mdVerificationRemarks:
        remarks ||
        (decision === 'MD_VERIFIED'
          ? 'Result and evaluation verified by Managing Director.'
          : 'Returned to instructor for re-evaluation.'),
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      try {
        await academyService.updateExamSubmission(sub.id, patch);
      } catch (err: any) {
        console.warn('Firestore MD verify submission notice:', err?.message);
      }
    }

    const next = submissions.map((s) => (s.id === sub.id ? { ...s, ...patch } : s));
    setExamSubmissionsSafe(next);

    if (decision === 'MD_VERIFIED') {
      const notifs = SwanayaDatabase.get<Notification[]>('notifications') || [];
      SwanayaDatabase.set('notifications', [
        {
          id: `not-${Date.now()}`,
          userId: sub.studentId,
          title: 'Examination Result MD Verified',
          message: `Your ${sub.mode} submission for ${sub.examTitle} is verified by MD: ${sub.marksObtained}/${sub.maxMarks} (${sub.grade}).`,
          type: 'SUCCESS',
          read: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        },
        ...notifs,
      ]);
    }

    SwanayaDatabase.log(
      currentUser.email,
      currentUser.name,
      `MD_EVALUATION_${decision}`,
      `${sub.studentName} · ${sub.examTitle} (${sub.marksObtained ?? sub.autoScore ?? 0}/${sub.maxMarks})`
    );
    setNotice({
      type: 'success',
      text: `Submission for ${sub.studentName} marked as ${decision === 'MD_VERIFIED' ? 'MD Verified' : 'Returned to Instructor'}.`,
    });
    onRefreshAllData?.();
  };

  // Filtered collections for Student
  const verifiedPapers = useMemo(
    () => questionPapers.filter((p) => p.mdVerificationStatus === 'VERIFIED'),
    [questionPapers]
  );
  const verifiedMcqs = useMemo(
    () => mcqExams.filter((m) => m.mdVerificationStatus === 'VERIFIED'),
    [mcqExams]
  );
  const mySubmissions = useMemo(() => {
    return submissions.filter(
      (s) =>
        s.userId === activeUserUid ||
        (studentProfile && s.studentId === studentProfile.id)
    );
  }, [submissions, activeUserUid, studentProfile]);

  const mdPendingCounts = useMemo(() => {
    return {
      papers: questionPapers.filter((p) => p.mdVerificationStatus === 'PENDING_MD').length,
      mcqs: mcqExams.filter((m) => m.mdVerificationStatus === 'PENDING_MD').length,
      evals: submissions.filter((s) => s.evaluationStatus === 'INSTRUCTOR_EVALUATED').length,
      verified:
        questionPapers.filter((p) => p.mdVerificationStatus === 'VERIFIED').length +
        mcqExams.filter((m) => m.mdVerificationStatus === 'VERIFIED').length +
        submissions.filter((s) => s.evaluationStatus === 'MD_VERIFIED').length,
    };
  }, [questionPapers, mcqExams, submissions]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const renderVerificationLabel = (status: string) => {
    if (status === 'VERIFIED' || status === 'MD_VERIFIED') {
      return <span className="text-emerald-400 font-semibold">MD Verified</span>;
    }
    if (status === 'INSTRUCTOR_EVALUATED') {
      return <span className="text-sky-400 font-semibold">Evaluated · Awaiting MD Verification</span>;
    }
    if (status === 'REJECTED' || status === 'RETURNED') {
      return <span className="text-rose-400 font-semibold">Returned / Needs Revision</span>;
    }
    return <span className="text-amber-400 font-semibold">Pending MD Verification</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
            {mode === 'MD'
              ? 'Managing Director · Examination Governance & Verification'
              : mode === 'INSTRUCTOR'
              ? 'Instructor Examination Board'
              : 'Student Examination & Answerbook Desk'}
          </p>
          <h2 className="text-xl font-serif font-bold text-white">
            {mode === 'MD'
              ? 'MD Verification Console: Question Papers, MCQs & Answerbooks'
              : mode === 'INSTRUCTOR'
              ? 'Question Papers, MCQ Examinations & Answerbook Evaluation'
              : 'Question Papers, MCQ Examinations & Answerbook Upload'}
          </h2>
          <p className="text-xs text-slate-400">
            {mode === 'MD'
              ? 'Review and verify all instructor-created question papers, MCQ examinations, and evaluated student answerbooks before official publication.'
              : mode === 'INSTRUCTOR'
              ? 'Publish question papers and MCQ tests for MD verification, then evaluate student answerbooks and forward grades for MD sign-off.'
              : 'Access MD-verified question papers, upload your answerbooks, complete online MCQ examinations, and track MD-verified results.'}
          </p>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('papers')}
            className={`px-3.5 py-2 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'papers' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            {mode === 'MD'
              ? `Question Papers (${mdPendingCounts.papers} Pending)`
              : mode === 'INSTRUCTOR'
              ? 'Question Papers'
              : `Question Papers (${verifiedPapers.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('mcq')}
            className={`px-3.5 py-2 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'mcq' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            {mode === 'MD'
              ? `MCQ Exams (${mdPendingCounts.mcqs} Pending)`
              : mode === 'INSTRUCTOR'
              ? 'MCQ Examinations'
              : `MCQ Exams (${verifiedMcqs.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('evaluations')}
            className={`px-3.5 py-2 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeSection === 'evaluations' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            {mode === 'MD'
              ? `Answerbook & Result Verify (${mdPendingCounts.evals} Pending)`
              : mode === 'INSTRUCTOR'
              ? `Answerbook Evaluation (${submissions.filter((s) => s.evaluationStatus === 'SUBMITTED' || s.evaluationStatus === 'RETURNED').length})`
              : `My Answerbooks & Results (${mySubmissions.length})`}
          </button>
        </div>
      </div>

      {/* MD KPI Strip */}
      {mode === 'MD' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-[11px] font-mono uppercase text-slate-400">Pending Question Papers</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-amber-400 mt-1">
              {mdPendingCounts.papers}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-[11px] font-mono uppercase text-slate-400">Pending MCQ Exams</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-amber-400 mt-1">
              {mdPendingCounts.mcqs}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-[11px] font-mono uppercase text-slate-400">Evaluations Awaiting MD</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-sky-400 mt-1">
              {mdPendingCounts.evals}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <p className="text-[11px] font-mono uppercase text-slate-400">Total MD Verified</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-emerald-400 mt-1">
              {mdPendingCounts.verified}
            </p>
          </div>
        </div>
      )}

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
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
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* INSTRUCTOR VIEW                                                     */}
      {/* =================================================================== */}
      {mode === 'INSTRUCTOR' && activeSection === 'papers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Create / Upload Question Paper */}
          <form
            onSubmit={handleCreateQuestionPaper}
            className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4 h-fit"
          >
            <h3 className="text-sm font-serif font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Add Examination Question Paper</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Question Paper Title</label>
              <input
                type="text"
                required
                value={paperForm.title}
                onChange={(e) => setPaperForm({ ...paperForm, title: e.target.value })}
                placeholder="e.g. Mid-Term Cinema & AI Production Paper"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Subject Code</label>
                <input
                  type="text"
                  required
                  value={paperForm.subjectCode}
                  onChange={(e) => setPaperForm({ ...paperForm, subjectCode: e.target.value })}
                  placeholder="SMA-201"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Program / Course</label>
                <select
                  value={paperForm.courseId}
                  onChange={(e) => setPaperForm({ ...paperForm, courseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {courses.length === 0 && <option value="general-course">Academy Program</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Duration (min)</label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={paperForm.durationMinutes}
                  onChange={(e) => setPaperForm({ ...paperForm, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Total Marks</label>
                <input
                  type="number"
                  min={5}
                  max={1000}
                  value={paperForm.totalMarks}
                  onChange={(e) => setPaperForm({ ...paperForm, totalMarks: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Pass Marks</label>
                <input
                  type="number"
                  min={0}
                  max={paperForm.totalMarks}
                  value={paperForm.passMarks}
                  onChange={(e) => setPaperForm({ ...paperForm, passMarks: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">
                Attach Question Paper File (PDF / DOC / TXT / Image, max 320 KB)
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-amber-400/60 rounded-lg p-3.5 text-xs text-slate-300 cursor-pointer bg-slate-950/60">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span className="truncate">
                  {paperForm.paperFileName ? `Selected: ${paperForm.paperFileName}` : 'Choose Question Paper File'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleReadUploadFile(f, (res) =>
                      setPaperForm((prev) => ({
                        ...prev,
                        paperFileName: res.name,
                        paperFileType: res.type,
                        paperFileDataUrl: res.dataUrl,
                      }))
                    );
                  }}
                />
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Written Question Paper / Sections</label>
              <textarea
                rows={5}
                value={paperForm.paperContent}
                onChange={(e) => setPaperForm({ ...paperForm, paperContent: e.target.value })}
                placeholder="Section A (20 Marks): Short answers...&#10;Section B (80 Marks): Descriptive & Production analysis..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={savingPaper}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingPaper ? 'Submitting...' : 'Submit Question Paper for MD Verification'}
            </button>
          </form>

          {/* Right: Question Papers Status List */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              Published Question Papers ({questionPapers.length})
            </h3>
            {questionPapers.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
                No question papers uploaded yet. Create one to send to MD for verification.
              </div>
            ) : (
              questionPapers.map((qp) => (
                <div key={qp.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-amber-400 font-semibold">
                        {qp.subjectCode} · {qp.courseName}
                      </p>
                      <h4 className="text-base font-serif font-bold text-white">{qp.title}</h4>
                    </div>
                    <div className="text-xs">{renderVerificationLabel(qp.mdVerificationStatus)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono tabular-nums">
                    <span>{qp.totalMarks} Marks (Pass {qp.passMarks})</span>
                    <span>·</span>
                    <span>{qp.durationMinutes} mins</span>
                    {qp.paperFileName && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">{qp.paperFileName}</span>
                      </>
                    )}
                  </div>
                  {qp.mdRemarks && (
                    <p className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-2.5">
                      MD Remarks ({qp.mdVerifiedBy || 'MD'}): {qp.mdRemarks}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mode === 'INSTRUCTOR' && activeSection === 'mcq' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: MCQ Examination Builder */}
          <form
            onSubmit={handleCreateMcqExam}
            className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-5"
          >
            <h3 className="text-sm font-serif font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>Create MCQ Examination</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-slate-400">MCQ Exam Title</label>
                <input
                  type="text"
                  required
                  value={mcqForm.title}
                  onChange={(e) => setMcqForm({ ...mcqForm, title: e.target.value })}
                  placeholder="e.g. AI Video Prompting & Camera Assessment"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Subject Code</label>
                <input
                  type="text"
                  required
                  value={mcqForm.subjectCode}
                  onChange={(e) => setMcqForm({ ...mcqForm, subjectCode: e.target.value })}
                  placeholder="SMA-MCQ-1"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Course</label>
                <select
                  value={mcqForm.courseId}
                  onChange={(e) => setMcqForm({ ...mcqForm, courseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {courses.length === 0 && <option value="general-course">Academy Program</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Duration (min)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={mcqForm.durationMinutes}
                  onChange={(e) => setMcqForm({ ...mcqForm, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Pass Marks</label>
                <input
                  type="number"
                  min={0}
                  value={mcqForm.passMarks}
                  onChange={(e) => setMcqForm({ ...mcqForm, passMarks: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 font-mono tabular-nums">
                  Questions ({mcqQuestions.length}) · Total Marks: {mcqQuestions.reduce((a, b) => a + (Number(b.marks) || 0), 0)}
                </span>
                <button
                  type="button"
                  onClick={handleAddMcqQuestion}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              </div>

              {mcqQuestions.map((q, idx) => (
                <div key={q.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">Question {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400">Marks:</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={q.marks}
                        onChange={(e) => handleUpdateMcqQuestion(q.id, { marks: Number(e.target.value) })}
                        className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 font-mono tabular-nums"
                      />
                      {mcqQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMcqQuestion(q.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                          aria-label="Remove question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    value={q.prompt}
                    onChange={(e) => handleUpdateMcqQuestion(q.id, { prompt: e.target.value })}
                    placeholder="Enter question stem..."
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => handleUpdateMcqQuestion(q.id, { correctIndex: optIdx })}
                          title="Mark as correct option"
                          className="accent-emerald-500 cursor-pointer"
                        />
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => {
                            const updated = [...q.options];
                            updated[optIdx] = e.target.value;
                            handleUpdateMcqQuestion(q.id, { options: updated });
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          className={`flex-grow bg-slate-900 border rounded px-2.5 py-1.5 text-xs text-slate-100 ${
                            q.correctIndex === optIdx ? 'border-emerald-500/50' : 'border-slate-800'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={savingMcq}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingMcq ? 'Submitting...' : 'Submit MCQ Examination for MD Verification'}
            </button>
          </form>

          {/* Right: Existing MCQ Exams */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              MCQ Examination Bank ({mcqExams.length})
            </h3>
            {mcqExams.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
                No MCQ examinations created yet.
              </div>
            ) : (
              mcqExams.map((ex) => (
                <div key={ex.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-amber-400 font-semibold">{ex.subjectCode}</p>
                      <h4 className="text-base font-serif font-bold text-white">{ex.title}</h4>
                    </div>
                    <div className="text-xs">{renderVerificationLabel(ex.mdVerificationStatus)}</div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono tabular-nums">
                    {ex.questions.length} Questions · {ex.totalMarks} Marks · {ex.durationMinutes} min
                  </p>
                  {ex.mdRemarks && (
                    <p className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-2">
                      MD Remarks: {ex.mdRemarks}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mode === 'INSTRUCTOR' && activeSection === 'evaluations' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            Student Answerbooks &amp; MCQ Attempts ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              No student answerbooks or MCQ attempts submitted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-amber-400 font-semibold">
                        {sub.mode} · {sub.subjectCode} · {sub.studentRegisterNo}
                      </p>
                      <h4 className="text-sm font-serif font-bold text-white">{sub.examTitle}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">Student: {sub.studentName}</p>
                    </div>
                    <div className="text-xs text-right">{renderVerificationLabel(sub.evaluationStatus)}</div>
                  </div>

                  {sub.mode === 'ANSWERBOOK' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
                      {sub.answerFileName && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-emerald-400 font-mono truncate">{sub.answerFileName}</span>
                          <button
                            type="button"
                            onClick={() =>
                              triggerFileDownload(
                                sub.answerFileName || 'answerbook.txt',
                                sub.answerFileDataUrl,
                                sub.answerNotes
                              )
                            }
                            className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-amber-400 rounded text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download Answerbook</span>
                          </button>
                        </div>
                      )}
                      {sub.answerNotes && (
                        <p className="text-slate-300 whitespace-pre-line line-clamp-4">{sub.answerNotes}</p>
                      )}
                    </div>
                  )}

                  {sub.mode === 'MCQ' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono tabular-nums text-slate-300">
                      Auto-graded MCQ Score: <strong className="text-amber-400">{sub.autoScore ?? 0} / {sub.maxMarks}</strong>
                    </div>
                  )}

                  {(sub.evaluationStatus === 'INSTRUCTOR_EVALUATED' || sub.evaluationStatus === 'MD_VERIFIED') && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-mono tabular-nums text-white font-semibold">
                        Evaluated Marks: {sub.marksObtained} / {sub.maxMarks} ({sub.grade})
                      </p>
                      <p className="text-slate-400">Remarks: {sub.evaluatorRemarks}</p>
                      {sub.mdVerificationRemarks && (
                        <p className="text-emerald-300">MD Verification Note: {sub.mdVerificationRemarks}</p>
                      )}
                    </div>
                  )}

                  {sub.evaluationStatus !== 'MD_VERIFIED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEvaluatingSub(sub);
                        setEvalMarks(sub.marksObtained ?? sub.autoScore ?? 0);
                        setEvalRemarks(sub.evaluatorRemarks || '');
                      }}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
                    >
                      {sub.evaluationStatus === 'SUBMITTED' || sub.evaluationStatus === 'RETURNED'
                        ? 'Evaluate & Send to MD for Verification'
                        : 'Update Evaluation'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* STUDENT VIEW                                                        */}
      {/* =================================================================== */}
      {mode === 'STUDENT' && activeSection === 'papers' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            MD-Verified Examination Question Papers ({verifiedPapers.length})
          </h3>
          {verifiedPapers.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-2 text-xs text-slate-400">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-200 font-medium">No MD-verified question papers available yet.</p>
              <p>Once your instructor uploads a question paper and the Managing Director verifies it, it will appear here for answerbook upload.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {verifiedPapers.map((qp) => {
                const existingSub = mySubmissions.find(
                  (s) => s.mode === 'ANSWERBOOK' && s.examRefId === qp.id
                );
                return (
                  <div key={qp.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-amber-400 font-semibold">
                            {qp.subjectCode} · {qp.courseName}
                          </p>
                          <h4 className="text-base font-serif font-bold text-white mt-0.5">{qp.title}</h4>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 shrink-0">MD Verified</span>
                      </div>

                      <div className="text-xs text-slate-400 font-mono tabular-nums">
                        {qp.totalMarks} Marks (Pass {qp.passMarks}) · {qp.durationMinutes} min · Set by {qp.createdByName}
                      </div>

                      {qp.instructions && (
                        <p className="text-xs text-slate-400">{qp.instructions}</p>
                      )}

                      {qp.paperContent && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 whitespace-pre-line max-h-40 overflow-y-auto">
                          {qp.paperContent}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          triggerFileDownload(
                            qp.paperFileName || `${qp.subjectCode}_QuestionPaper.txt`,
                            qp.paperFileDataUrl,
                            `${qp.title}\nSubject: ${qp.subjectCode}\nTotal Marks: ${qp.totalMarks}\n\n${qp.instructions}\n\n${qp.paperContent}`
                          )
                        }
                        className="px-3 py-2 bg-slate-950 border border-slate-700 hover:border-amber-400 text-slate-200 text-xs font-medium rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Download Question Paper</span>
                      </button>

                      {existingSub ? (
                        <span className="text-xs font-semibold text-emerald-400">
                          Answerbook Uploaded ({existingSub.evaluationStatus.replace('_', ' ')})
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAnsweringPaper(qp);
                            setAnswerNotes('');
                            setAnswerFile({ name: '', type: '', dataUrl: '' });
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Upload Answerbook</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode === 'STUDENT' && activeSection === 'mcq' && (
        <div className="space-y-4">
          {activeMcqExam ? (
            <div className="bg-slate-900/70 border border-amber-500/40 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-mono text-amber-400 font-semibold">
                    {activeMcqExam.subjectCode} · Live MCQ Examination
                  </p>
                  <h3 className="text-lg font-serif font-bold text-white">{activeMcqExam.title}</h3>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-lg font-mono tabular-nums text-sm">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className={secondsLeft < 60 ? 'text-rose-400 font-bold' : 'text-white font-bold'}>
                    {formatTimer(secondsLeft)}
                  </span>
                </div>
              </div>

              {/* Question Navigation Pills */}
              <div className="flex flex-wrap gap-2">
                {activeMcqExam.questions.map((q, idx) => {
                  const answered = mcqAnswers[q.id] !== undefined;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentMcqIdx(idx)}
                      className={`w-9 h-9 rounded text-xs font-mono tabular-nums font-bold cursor-pointer border ${
                        currentMcqIdx === idx
                          ? 'bg-amber-500 text-black border-amber-400'
                          : answered
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Active Question */}
              {activeMcqExam.questions[currentMcqIdx] && (() => {
                const q = activeMcqExam.questions[currentMcqIdx];
                return (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                      <span>Question {currentMcqIdx + 1} of {activeMcqExam.questions.length}</span>
                      <span>{q.marks} Marks</span>
                    </div>
                    <h4 className="text-base font-medium text-white leading-relaxed">{q.prompt}</h4>
                    <div className="space-y-2.5">
                      {q.options.map((opt, optIdx) => {
                        const selected = mcqAnswers[q.id] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setMcqAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors flex items-center gap-3 cursor-pointer ${
                              selected
                                ? 'bg-amber-500/15 border-amber-400 text-white'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="font-mono text-xs font-bold text-amber-400">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentMcqIdx === 0}
                    onClick={() => setCurrentMcqIdx((i) => Math.max(0, i - 1))}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentMcqIdx >= activeMcqExam.questions.length - 1}
                    onClick={() =>
                      setCurrentMcqIdx((i) => Math.min(activeMcqExam.questions.length - 1, i + 1))
                    }
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>

                {confirmSubmitMcq ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-300">
                      Answered {Object.keys(mcqAnswers).length}/{activeMcqExam.questions.length}. Submit now?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFinishMcqExam(false)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                    >
                      Confirm Submit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSubmitMcq(false)}
                      className="px-3 py-2 border border-slate-700 text-xs text-slate-300 rounded cursor-pointer"
                    >
                      Resume
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmitMcq(true)}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit MCQ Exam</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                MD-Verified MCQ Examinations ({verifiedMcqs.length})
              </h3>
              {verifiedMcqs.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-2 text-xs text-slate-400">
                  <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-slate-200 font-medium">No MD-verified MCQ examinations published yet.</p>
                  <p>Instructors build MCQ exams and the Managing Director verifies them before they open for students.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {verifiedMcqs.map((ex) => {
                    const attempt = mySubmissions.find(
                      (s) => s.mode === 'MCQ' && s.examRefId === ex.id
                    );
                    return (
                      <div key={ex.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-mono text-amber-400 font-semibold">
                              {ex.subjectCode} · {ex.courseName}
                            </p>
                            <h4 className="text-base font-serif font-bold text-white mt-0.5">{ex.title}</h4>
                          </div>
                          <span className="text-xs font-semibold text-emerald-400 shrink-0">MD Verified</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                          {ex.questions.length} Questions · {ex.totalMarks} Marks (Pass {ex.passMarks}) · {ex.durationMinutes} min
                        </p>
                        {attempt ? (
                          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                            <span className="text-emerald-400 font-semibold">Attempt Submitted</span>
                            <span>{renderVerificationLabel(attempt.evaluationStatus)}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartMcqExam(ex)}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start MCQ Examination</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'STUDENT' && activeSection === 'evaluations' && (
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            My Uploaded Answerbooks &amp; MCQ Results ({mySubmissions.length})
          </h3>
          {mySubmissions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              You have not uploaded an answerbook or completed an MCQ examination yet.
            </div>
          ) : (
            <div className="space-y-3">
              {mySubmissions.map((sub) => (
                <div key={sub.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-amber-400 font-semibold">
                        {sub.mode} · {sub.subjectCode}
                      </p>
                      <h4 className="text-base font-serif font-bold text-white">{sub.examTitle}</h4>
                    </div>
                    <div className="text-xs">{renderVerificationLabel(sub.evaluationStatus)}</div>
                  </div>

                  {sub.answerFileName && (
                    <p className="text-xs text-slate-400 font-mono">
                      Uploaded Answerbook: <span className="text-slate-200">{sub.answerFileName}</span>
                    </p>
                  )}

                  {sub.evaluationStatus === 'MD_VERIFIED' ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Final Verified Score</span>
                        <strong className="text-lg font-mono tabular-nums text-emerald-400">
                          {sub.marksObtained} / {sub.maxMarks} ({sub.grade})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Instructor Evaluation</span>
                        <span className="text-slate-200">{sub.evaluatorRemarks}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">MD Verification Sign-Off</span>
                        <span className="text-emerald-300">
                          {sub.mdVerifiedBy || 'Managing Director'} · {sub.mdVerificationRemarks}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Submitted {sub.submittedAt?.substring(0, 10)} · Marks and official grade will be finalized once evaluated by Instructor and verified by MD.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MD VERIFICATION VIEW                                                */}
      {/* =================================================================== */}
      {mode === 'MD' && activeSection === 'papers' && (
        <div className="space-y-4">
          {questionPapers.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              No question papers submitted by instructors yet.
            </div>
          ) : (
            questionPapers.map((qp) => (
              <div key={qp.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-amber-400 font-semibold">
                      {qp.subjectCode} · {qp.courseName} · Prepared by {qp.createdByName}
                    </p>
                    <h4 className="text-lg font-serif font-bold text-white">{qp.title}</h4>
                    <p className="text-xs text-slate-400 font-mono tabular-nums mt-1">
                      Total Marks: {qp.totalMarks} · Pass Marks: {qp.passMarks} · Duration: {qp.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPaper(qp)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 hover:border-amber-400 text-xs text-slate-200 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect Paper</span>
                    </button>
                    <div className="text-xs">{renderVerificationLabel(qp.mdVerificationStatus)}</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input
                    type="text"
                    value={mdRemarksMap[qp.id] || ''}
                    onChange={(e) => setMdRemarksMap({ ...mdRemarksMap, [qp.id]: e.target.value })}
                    placeholder="MD verification remarks (optional)..."
                    className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMdVerifyPaper(qp, 'VERIFIED')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify &amp; Publish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMdVerifyPaper(qp, 'REJECTED')}
                      className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded cursor-pointer"
                    >
                      Return
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mode === 'MD' && activeSection === 'mcq' && (
        <div className="space-y-4">
          {mcqExams.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              No MCQ examinations submitted by instructors yet.
            </div>
          ) : (
            mcqExams.map((ex) => (
              <div key={ex.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-amber-400 font-semibold">
                      {ex.subjectCode} · {ex.courseName} · Prepared by {ex.createdByName}
                    </p>
                    <h4 className="text-lg font-serif font-bold text-white">{ex.title}</h4>
                    <p className="text-xs text-slate-400 font-mono tabular-nums mt-1">
                      {ex.questions.length} Questions · Total {ex.totalMarks} Marks · Pass {ex.passMarks} · {ex.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMcq(ex)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 hover:border-amber-400 text-xs text-slate-200 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Inspect Questions</span>
                    </button>
                    <div className="text-xs">{renderVerificationLabel(ex.mdVerificationStatus)}</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input
                    type="text"
                    value={mdRemarksMap[ex.id] || ''}
                    onChange={(e) => setMdRemarksMap({ ...mdRemarksMap, [ex.id]: e.target.value })}
                    placeholder="MD verification remarks (optional)..."
                    className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMdVerifyMcq(ex, 'VERIFIED')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify &amp; Publish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMdVerifyMcq(ex, 'REJECTED')}
                      className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded cursor-pointer"
                    >
                      Return
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mode === 'MD' && activeSection === 'evaluations' && (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              No student answerbook or MCQ evaluations awaiting MD verification.
            </div>
          ) : (
            submissions.map((sub) => (
              <div key={sub.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-amber-400 font-semibold">
                      {sub.mode} · {sub.subjectCode} · {sub.studentRegisterNo}
                    </p>
                    <h4 className="text-base font-serif font-bold text-white">
                      {sub.examTitle} — {sub.studentName}
                    </h4>
                  </div>
                  <div className="text-xs">{renderVerificationLabel(sub.evaluationStatus)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs">
                  <div>
                    <span className="text-slate-500 block">Marks &amp; Grade</span>
                    <strong className="font-mono tabular-nums text-white text-sm">
                      {sub.marksObtained ?? sub.autoScore ?? 0} / {sub.maxMarks}{' '}
                      {sub.grade ? `(${sub.grade})` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Evaluator</span>
                    <span className="text-slate-200">{sub.evaluatorName || 'Pending Instructor Evaluation'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Answerbook Attachment</span>
                    {sub.answerFileName ? (
                      <button
                        type="button"
                        onClick={() =>
                          triggerFileDownload(
                            sub.answerFileName || 'answerbook.txt',
                            sub.answerFileDataUrl,
                            sub.answerNotes
                          )
                        }
                        className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{sub.answerFileName}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400">{sub.mode === 'MCQ' ? 'Online MCQ Response' : 'Text Answerbook'}</span>
                    )}
                  </div>
                </div>

                {sub.evaluatorRemarks && (
                  <p className="text-xs text-slate-300">
                    <strong className="text-slate-400">Instructor Remarks:</strong> {sub.evaluatorRemarks}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input
                    type="text"
                    value={mdRemarksMap[sub.id] || ''}
                    onChange={(e) => setMdRemarksMap({ ...mdRemarksMap, [sub.id]: e.target.value })}
                    placeholder="MD sign-off or re-evaluation remarks..."
                    className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={sub.evaluationStatus === 'SUBMITTED'}
                      onClick={() => handleMdVerifySubmission(sub, 'MD_VERIFIED')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Award className="w-4 h-4" />
                      <span>Verify Result (MD)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMdVerifySubmission(sub, 'RETURNED')}
                      className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded cursor-pointer"
                    >
                      Return to Instructor
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS                                                              */}
      {/* =================================================================== */}

      {/* Student Answerbook Upload Modal */}
      {answeringPaper && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAnswerbook}
            className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono text-amber-400">{answeringPaper.subjectCode}</p>
                <h3 className="text-base font-serif font-bold text-white">
                  Upload Answerbook — {answeringPaper.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAnsweringPaper(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Upload Scanned / PDF Answerbook (max 320 KB)
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-amber-400 rounded-lg p-4 text-xs text-slate-300 cursor-pointer bg-slate-900/50">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>{answerFile.name ? `Attached: ${answerFile.name}` : 'Select PDF, DOC, TXT, or Image Answerbook'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleReadUploadFile(e.target.files?.[0], (res) => setAnswerFile(res))
                  }
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Written Answerbook Response / Summary Notes
              </label>
              <textarea
                rows={5}
                value={answerNotes}
                onChange={(e) => setAnswerNotes(e.target.value)}
                placeholder="Write your answers or attach notes describing your uploaded answerbook..."
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAnsweringPaper(null)}
                className="px-4 py-2 border border-slate-700 rounded text-xs text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAnswerbook}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase rounded cursor-pointer disabled:opacity-50"
              >
                {submittingAnswerbook ? 'Uploading...' : 'Submit Answerbook'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Instructor Evaluation Modal */}
      {evaluatingSub && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEvaluation}
            className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono text-amber-400">{evaluatingSub.studentName}</p>
                <h3 className="text-base font-serif font-bold text-white">
                  Evaluate {evaluatingSub.mode} — {evaluatingSub.examTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingSub(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">
                Marks Awarded (Max {evaluatingSub.maxMarks}, Pass {evaluatingSub.passMarks})
              </label>
              <input
                type="number"
                min={0}
                max={evaluatingSub.maxMarks}
                required
                value={evalMarks}
                onChange={(e) => setEvalMarks(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono tabular-nums text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 block">Evaluator Remarks</label>
              <textarea
                rows={4}
                required
                value={evalRemarks}
                onChange={(e) => setEvalRemarks(e.target.value)}
                placeholder="Provide rubric feedback and notes for MD verification..."
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEvaluatingSub(null)}
                className="px-4 py-2 border border-slate-700 rounded text-xs text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase rounded cursor-pointer"
              >
                Save &amp; Send for MD Verify
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MD Preview Question Paper Modal */}
      {previewPaper && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono text-amber-400">{previewPaper.subjectCode}</p>
                <h3 className="text-lg font-serif font-bold text-white">{previewPaper.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPaper(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">{previewPaper.instructions}</p>
            {previewPaper.paperContent && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs text-slate-200 whitespace-pre-line">
                {previewPaper.paperContent}
              </div>
            )}
            {previewPaper.paperFileName && (
              <button
                type="button"
                onClick={() =>
                  triggerFileDownload(
                    previewPaper.paperFileName || 'paper.txt',
                    previewPaper.paperFileDataUrl,
                    previewPaper.paperContent
                  )
                }
                className="px-4 py-2 bg-slate-900 border border-slate-700 text-amber-400 text-xs rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download {previewPaper.paperFileName}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MD Preview MCQ Exam Modal */}
      {previewMcq && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono text-amber-400">{previewMcq.subjectCode}</p>
                <h3 className="text-lg font-serif font-bold text-white">{previewMcq.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMcq(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {previewMcq.questions.map((q, idx) => (
                <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                  <p className="font-semibold text-white">
                    {idx + 1}. {q.prompt} <span className="text-amber-400 font-mono">({q.marks} Marks)</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`px-2.5 py-1.5 rounded border ${
                          q.correctIndex === oIdx
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {String.fromCharCode(65 + oIdx)}. {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
