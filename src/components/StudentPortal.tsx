/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, Video, FileText, CheckCircle2, AlertCircle, Clock, 
  Send, ExternalLink, Award, PlayCircle, Trophy, BarChart2, Calendar, Download, QrCode, X, Camera 
} from 'lucide-react';
import { 
  SwanayaDatabase, Student, Course, Subject, Lesson, 
  ClassSchedule, Assignment, Submission, Certificate, AttendanceRecord 
} from '../db/mockDb';

interface StudentPortalProps {
  studentUser: Student;
  currentUser: any;
  onRefreshAllData: () => void;
  onNavigateToVerify: (certId: string) => void;
}

export default function StudentPortal({ studentUser, currentUser, onRefreshAllData, onNavigateToVerify }: StudentPortalProps) {
  // Read local DB
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [subjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [lessons, setLessons] = useState<Lesson[]>(() => SwanayaDatabase.get<Lesson[]>("lessons"));
  const [classes] = useState<ClassSchedule[]>(() => SwanayaDatabase.get<ClassSchedule[]>("classes"));
  const [assignments] = useState<Assignment[]>(() => SwanayaDatabase.get<Assignment[]>("assignments"));
  const [submissions, setSubmissions] = useState<Submission[]>(() => SwanayaDatabase.get<Submission[]>("submissions"));
  const [certificates] = useState<Certificate[]>(() => SwanayaDatabase.get<Certificate[]>("certificates"));

  const [activeTab, setActiveTab] = useState<'syllabus' | 'assignments' | 'results' | 'certificates'>('syllabus');

  // LMS Interactive State
  const studentCourse = courses.find(c => c.id === studentUser.courseId);
  const studentSubjects = subjects.filter(s => s.semesterId === studentUser.semesterId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(studentSubjects[0]?.id || 'sub-101');
  
  const currentSubjectLessons = lessons.filter(l => l.subjectId === selectedSubjectId);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(currentSubjectLessons[0] || null);

  // Lesson completions state (persisted locally)
  const [completions, setCompletions] = useState<Record<string, 'NOT_STARTED' | 'COMPLETED'>>(() => {
    const saved = localStorage.getItem(`sma_lesson_comp_${studentUser.id}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Assignment submissions input state
  const [submissionForms, setSubmissionForms] = useState<Record<string, string>>({});
  const [submissionFileNames, setSubmissionFileNames] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Mobile QR Scanner Simulator States (New Feature!)
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanHourSlot, setScanHourSlot] = useState<number>(1);
  const [scanSuccessAlert, setScanSuccessAlert] = useState(false);

  // Sync active lesson when subject shifts
  React.useEffect(() => {
    const filtered = lessons.filter(l => l.subjectId === selectedSubjectId);
    if (filtered.length > 0) {
      setActiveLesson(filtered[0]);
    } else {
      setActiveLesson(null);
    }
  }, [selectedSubjectId, lessons]);

  // Mark lesson completion
  const handleToggleLessonComplete = (lessonId: string) => {
    const updated = {
      ...completions,
      [lessonId]: completions[lessonId] === 'COMPLETED' ? 'NOT_STARTED' as const : 'COMPLETED' as const
    };
    setCompletions(updated);
    localStorage.setItem(`sma_lesson_comp_${studentUser.id}`, JSON.stringify(updated));
    onRefreshAllData();
  };

  // Submit Homework with PDF upload attachments!
  const handleSubmitAssignment = (asgId: string) => {
    const content = submissionForms[asgId] || '';
    const attachedPdfName = submissionFileNames[asgId];
    
    if (!content.trim() && !attachedPdfName) return;

    setSubmittingId(asgId);
    
    setTimeout(() => {
      const allSubmissions = SwanayaDatabase.get<Submission[]>("submissions");
      
      const newSubmission: Submission = {
        id: `subm-${Date.now()}`,
        assignmentId: asgId,
        studentId: studentUser.id,
        submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        content: content || `Attached PDF Homework Document: ${attachedPdfName}`,
        fileUrl: attachedPdfName ? `/uploads/submissions/${attachedPdfName}` : undefined,
        status: 'SUBMITTED'
      };

      const finalSubmissions = [...allSubmissions.filter(s => !(s.assignmentId === asgId && s.studentId === studentUser.id)), newSubmission];
      SwanayaDatabase.set("submissions", finalSubmissions);
      setSubmissions(finalSubmissions);
      
      setSubmissionForms({ ...submissionForms, [asgId]: '' });
      setSubmissionFileNames({ ...submissionFileNames, [asgId]: '' });
      setSubmittingId(null);
      
      SwanayaDatabase.log(currentUser.email, currentUser.name, "ASSIGNMENT_SUBMIT", `Submitted Homework with attached PDF for Task ID: ${asgId}`);
      onRefreshAllData();
    }, 1500);
  };

  // Mobile QR Self-Attendance Scanner simulation
  const handleMockQRScan = () => {
    const todayClass = studentSchedule[0];
    if (!todayClass) {
      alert("No active scheduled class today for scanner connection.");
      return;
    }

    const allAttendance = SwanayaDatabase.get<AttendanceRecord[]>("attendance");
    
    // Check if record exists for this class, student and hour
    const exists = allAttendance.some(r => r.classId === todayClass.id && r.studentId === studentUser.id && r.hour === scanHourSlot);
    
    if (exists) {
      alert(`You have already logged attendance for Hour ${scanHourSlot} of this class.`);
      setIsScannerOpen(false);
      return;
    }

    // Add new Present hourly record
    const newRecord: AttendanceRecord = {
      id: `att-${todayClass.id}-${studentUser.id}-${scanHourSlot}-${Date.now()}`,
      classId: todayClass.id,
      studentId: studentUser.id,
      status: 'PRESENT',
      date: todayClass.date,
      hour: scanHourSlot
    };

    const finalAttendance = [...allAttendance, newRecord];
    SwanayaDatabase.set("attendance", finalAttendance);

    // Recalculate scholar's aggregate rate
    const studentRecords = finalAttendance.filter(r => r.studentId === studentUser.id);
    const presents = studentRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const rate = Math.round((presents / studentRecords.length) * 100);

    const allStudents = SwanayaDatabase.get<Student[]>("students");
    const updatedStudents = allStudents.map(s => s.id === studentUser.id ? {
      ...s,
      attendancePercentage: rate
    } : s);
    SwanayaDatabase.set("students", updatedStudents);

    // Audit Log
    SwanayaDatabase.log(studentUser.email, studentUser.name, "ATTENDANCE_QR_SCAN", `Student self-scanned QR attendance for Hour: ${scanHourSlot}`);

    setScanSuccessAlert(true);
    onRefreshAllData();
    setTimeout(() => {
      setScanSuccessAlert(false);
      setIsScannerOpen(false);
    }, 2500);
  };

  // Math summary parameters
  const totalSyllabusLessons = lessons.filter(l => subjects.some(s => s.semesterId === studentUser.semesterId && s.id === l.subjectId)).length;
  const completedCount = Object.entries(completions).filter(([lid, val]) => val === 'COMPLETED' && lessons.some(l => l.id === lid)).length;
  const completionPercent = totalSyllabusLessons > 0 ? Math.round((completedCount / totalSyllabusLessons) * 100) : 0;

  // Filter current student items
  const studentCerts = certificates.filter(c => c.studentId === studentUser.id);
  const studentSchedule = classes.filter(c => c.courseId === studentUser.courseId);

  return (
    <div className="space-y-6">
      
      {/* Attendance & Alert banners */}
      {studentUser.attendancePercentage < 75 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4 flex items-start gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">Attendance Warning alert</h4>
            <p className="text-[11px] text-slate-400">Your current aggregate attendance is <strong className="text-rose-400">{studentUser.attendancePercentage}%</strong>, which is below the mandatory 75% requirement. Please coordinate with Professor Ananthakrishnan immediately to prevent suspension.</p>
          </div>
        </div>
      )}

      {studentUser.outstandingBalance > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3 text-amber-400">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">Fee installment Outstanding</h4>
            <p className="text-[11px] text-slate-400">You have an outstanding fee balance of <strong className="text-amber-400">₹{studentUser.outstandingBalance.toLocaleString('en-IN')}</strong>. Please settle your dues before the upcoming Semester Examinations to avoid hall-ticket withholding.</p>
          </div>
        </div>
      )}

      {/* Hero Welcome Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Welcome and Progress Card */}
        <div className="md:col-span-8 bg-slate-900/40 border border-slate-800 rounded-lg p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
          
          <div className="space-y-2 relative z-10">
            <p className="text-[10px] text-amber-500 font-mono tracking-wider font-bold">STUDENT COHORT PORTAL</p>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white">Welcome back, {studentUser.name}!</h2>
            <p className="text-slate-400 text-xs">{studentCourse?.name} ({studentCourse?.code})</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-850 mt-6 relative z-10">
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">OVERALL ATTENDANCE</span>
              <p className={`text-base font-bold font-mono ${studentUser.attendancePercentage < 75 ? 'text-rose-400':'text-emerald-400'}`}>
                {studentUser.attendancePercentage}%
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">SYLLABUS PROGRESS</span>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold font-mono text-slate-200">{completionPercent}%</p>
                <div className="flex-grow bg-slate-950 h-1.5 rounded overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${completionPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 text-[10px] font-mono block uppercase">CREDENTIALS UNLOCKED</span>
              <p className="text-base font-bold font-mono text-amber-400 flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-400" />
                {studentCerts.length}
              </p>
            </div>
          </div>
        </div>

        {/* Today's schedule Widget (Contains QR code scanner entry!) */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 p-6 rounded-lg space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-850 pb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              Class Timetable
            </h3>

            <div className="space-y-3 mt-3">
              {studentSchedule.length > 0 ? (
                studentSchedule.map((cls) => (
                  <div key={cls.id} className="bg-slate-950 p-3 rounded border border-slate-900 text-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-slate-200">{subjects.find(s=>s.id===cls.subjectId)?.name}</p>
                      <span className="text-[9px] font-mono text-amber-500 bg-amber-500/5 px-1.5 py-0.2 rounded border border-amber-500/10">
                        {cls.type}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono text-[10px]">Time: {cls.startTime} - {cls.endTime}</p>
                    <p className="text-slate-500 font-mono text-[10px]">Date: {cls.date} · Room: {cls.room}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic text-center py-4">No active classes today.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850/60 mt-4">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold uppercase text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/5"
            >
              <QrCode className="w-4 h-4 text-amber-500" />
              Scan Attendance QR Code
            </button>
          </div>
        </div>

      </div>

      {/* Subnav tab bar */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-md max-w-fit">
        <button 
          onClick={() => setActiveTab('syllabus')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'syllabus' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          LMS Learning workspace
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Homework Tasks ({assignments.length})
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'results' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Academic Grades
        </button>
        <button 
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'certificates' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Digital Credentials
        </button>
      </div>

      {/* LMS INTERACTIVE WORKSPACE */}
      {activeTab === 'syllabus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Subject / Lesson syllabus navigator tree */}
          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Current Semester Papers</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {studentSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono pb-2 border-b border-slate-850">
                Syllabus Lessons List
              </p>
              
              <div className="space-y-1 pt-2">
                {currentSubjectLessons.map((les) => (
                  <button
                    key={les.id}
                    onClick={() => setActiveLesson(les)}
                    className={`w-full text-left p-2.5 rounded text-xs transition-colors flex items-center justify-between border ${
                      activeLesson?.id === les.id
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 font-semibold'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-950/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate pr-3">{les.title}</span>
                    {completions[les.id] === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </button>
                ))}
                {currentSubjectLessons.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-4">No lessons uploaded yet for this subject.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Active Lesson Reader Canvas (60-30split) */}
          <div className="lg:col-span-8">
            {activeLesson ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">LESSON STUDY WORKSPACE</span>
                    <h3 className="text-lg md:text-xl font-serif font-bold text-white">{activeLesson.title}</h3>
                    <p className="text-slate-500 text-xs">Expected Duration: {activeLesson.duration}</p>
                  </div>

                  <button
                    onClick={() => handleToggleLessonComplete(activeLesson.id)}
                    className={`px-4 py-2 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                      completions[activeLesson.id] === 'COMPLETED'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    {completions[activeLesson.id] === 'COMPLETED' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        Completed!
                      </>
                    ) : (
                      'Mark Complete'
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{activeLesson.description}</p>

                {/* Simulated Premium Video Player */}
                <div className="aspect-video bg-black rounded border border-slate-850 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-black/60 px-2 py-1 rounded">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span>Syllabus Stream Platform</span>
                  </div>
                  
                  <div className="text-center space-y-3 p-4">
                    <PlayCircle className="w-16 h-16 text-amber-500 hover:text-amber-400 hover:scale-105 transition-all cursor-pointer mx-auto" />
                    <p className="text-xs text-slate-400 max-w-sm">Click play to simulate streaming video lecture for this paper.</p>
                  </div>
                </div>

                {/* Interactive Concept Callout & Syllabus PDF Material */}
                <div className="p-4 bg-slate-950 rounded border border-slate-850 text-xs text-slate-400 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                    <p className="font-bold text-slate-200 uppercase tracking-wider text-[9px] font-mono">Reference Study Materials & PDFs</p>
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">Syllabus Resource Library</span>
                  </div>
                  
                  {activeLesson.documentUrl || (activeLesson.id === 'les-1' || activeLesson.id === 'les-3') ? (
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-400" />
                        <div>
                          <p className="text-xs font-semibold text-slate-300 font-mono">
                            {activeLesson.documentName || (activeLesson.id === 'les-1' ? 'Tailwind_v4_Theme_Guidelines.pdf' : 'React19_State_Hook_Matrix.pdf')}
                          </p>
                          <p className="text-[9px] text-slate-500 font-mono">Portable Document Format (.pdf) · 1.2 MB</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => alert(`Simulated PDF Download triggered for: ${activeLesson.documentName || 'Syllabus_Guide.pdf'}`)}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-amber-400 text-[10px] font-bold uppercase rounded border border-slate-850 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px]">No formal reading PDFs uploaded for this lesson yet. Instructors can attach materials via the Portal Uploader.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center text-slate-500 italic">
                Select a paper and pick a lesson to trigger study workspace streaming.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ASSIGNMENTS SUBMISSION PANEL (Supports PDF submissions uploads!) */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">My Homework Tasks</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((asg) => {
              const submission = submissions.find(s => s.assignmentId === asg.id && s.studentId === studentUser.id);
              return (
                <div key={asg.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{asg.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Deadline: {asg.deadline} · Paper Code: {subjects.find(s=>s.id===asg.subjectId)?.code}</p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                      {asg.maxMarks} MARKS
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{asg.description}</p>

                  {/* Submission Flow with PDF uploads simulated */}
                  {submission ? (
                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded text-xs space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Submitted at {submission.submittedAt}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold font-mono uppercase ${
                          submission.status === 'EVALUATED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {submission.status}
                        </span>
                      </div>
                      <p className="text-slate-300 font-mono truncate">{submission.content}</p>
                      {submission.fileUrl && (
                        <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Attached PDF: {submission.fileUrl.split('/').pop()}
                        </p>
                      )}
                      
                      {submission.status === 'EVALUATED' && (
                        <div className="pt-2 border-t border-slate-900 space-y-1">
                          <p className="font-bold text-amber-400 text-xs">Score obtained: {submission.marksObtained} / {asg.maxMarks}</p>
                          <p className="text-slate-400 text-[11px]">Critique Feedback: {submission.feedback}</p>
                          <p className="text-[9px] text-slate-600 font-mono mt-1">Graded by: {submission.gradedBy}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={asg.submissionType === 'LINK' ? "Paste GitHub repo or Live hosted URL..." : "Write submission narrative..."}
                          value={submissionForms[asg.id] || ''}
                          onChange={(e) => setSubmissionForms({ ...submissionForms, [asg.id]: e.target.value })}
                          className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                        />
                        
                        <button
                          type="button"
                          onClick={() => {
                            const name = `${studentUser.name.toLowerCase().replace(/\s+/g, '_')}_task_${asg.id.substring(4)}.pdf`;
                            setSubmissionFileNames({ ...submissionFileNames, [asg.id]: name });
                          }}
                          className={`px-3 py-2 border rounded text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                            submissionFileNames[asg.id] 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                              : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                          }`}
                          title="Simulate PDF file upload attachment"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {submissionFileNames[asg.id] ? 'Attached PDF!' : 'Attach PDF'}
                        </button>
                      </div>

                      {submissionFileNames[asg.id] && (
                        <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          File: {submissionFileNames[asg.id]} (Ready for upload)
                        </p>
                      )}

                      <button
                        onClick={() => handleSubmitAssignment(asg.id)}
                        disabled={submittingId === asg.id}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {submittingId === asg.id ? 'Uploading Homework PDF & Links...' : 'Submit Homework Task'}
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GRADES TRANSCRIPT */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Academic transcript</h3>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4">Assessed Criteria</th>
                  <th className="p-4">Marks Obtained</th>
                  <th className="p-4">Max Marks</th>
                  <th className="p-4">Grade</th>
                  <th className="p-4">Critique Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {submissions.filter(s => s.studentId === studentUser.id && s.status === 'EVALUATED').map((sub) => {
                  const asg = assignments.find(a => a.id === sub.assignmentId);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-900/20">
                      <td className="p-4 font-bold text-slate-200">
                        {asg?.title}
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-400">
                        {sub.marksObtained}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {asg?.maxMarks}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
                          {sub.marksObtained && asg ? (sub.marksObtained / asg.maxMarks >= 0.9 ? 'A+' : sub.marksObtained / asg.maxMarks >= 0.8 ? 'A' : 'B+') : 'B'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 italic">
                        "{sub.feedback}"
                      </td>
                    </tr>
                  );
                })}
                {submissions.filter(s => s.studentId === studentUser.id && s.status === 'EVALUATED').length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">No formal grades posted yet. Submit assignments for review.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VERIFIABLE DIGITAL CREDENTIALS */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">My Digital Certificates</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studentCerts.length > 0 ? (
              studentCerts.map((cert) => (
                <div key={cert.id} className="bg-slate-900 border border-slate-800 rounded-lg p-6 relative overflow-hidden space-y-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] text-amber-500 font-mono font-bold tracking-wider uppercase">{cert.type} CREDENTIAL</span>
                    <h4 className="text-sm font-bold text-slate-200 font-serif leading-tight">{cert.courseName}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">Certificate ID: {cert.id}</p>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-4 border-t border-slate-850">
                    <span className="text-slate-500">Issued: {cert.issueDate}</span>
                    <button
                      onClick={() => onNavigateToVerify(cert.id)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-amber-400 text-[10px] font-bold uppercase rounded hover:border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      View Live Verifier <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-slate-900/60 border border-slate-850 p-8 rounded-lg text-center space-y-4 col-span-2">
                <Award className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-400">No Credentials Issued Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Complete all core semester syllabus guides and evaluated Capstone projects to automatically trigger certificate generation.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE QR CAMERA SCANNER SIMULATOR OVERLAY (New Feature!) */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-sm w-full p-6 space-y-5 text-center relative overflow-hidden">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <Camera className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono">Mobile Scanner viewfinder</h3>
              <p className="text-slate-500 text-[10px]">Align your device camera with the Instructor's dashboard self-attendance QR code.</p>
            </div>

            {scanSuccessAlert ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg space-y-2 animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Attendance scan Succeeded!</h4>
                <p className="text-[10px] text-slate-300">Hour {scanHourSlot} present log recorded instantly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Camera Viewfinder graphics */}
                <div className="aspect-square bg-slate-900 rounded-xl relative border border-slate-800 flex items-center justify-center overflow-hidden">
                  
                  {/* Neon targeting brackets */}
                  <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-amber-500"></div>
                  <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-amber-500"></div>
                  <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-amber-500"></div>
                  <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-amber-500"></div>
                  
                  {/* Moving scanning laser line */}
                  <div className="absolute left-6 right-6 h-0.5 bg-amber-500/40 shadow shadow-amber-500 animate-bounce-slow"></div>

                  <div className="text-center space-y-2 p-4 text-[10px] text-slate-500 relative z-10 font-mono">
                    <p className="text-slate-400">Aiming at SMA QR Code...</p>
                    <p>Current: Hour {scanHourSlot}</p>
                  </div>
                </div>

                <div className="space-y-3 p-3 bg-slate-900 rounded border border-slate-850 text-left">
                  <label className="text-[9px] text-slate-500 uppercase font-bold font-mono block">Simulate Hour Selection</label>
                  <select
                    value={scanHourSlot}
                    onChange={(e) => setScanHourSlot(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                  >
                    <option value={1}>Hour 1 (Core Lecture)</option>
                    <option value={2}>Hour 2 (Syntax Lab)</option>
                    <option value={3}>Hour 3 (Vibe Session)</option>
                    <option value={4}>Hour 4 (Code Review)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleMockQRScan}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer font-mono"
                >
                  Decode & Register Present
                </button>
              </div>
            )}
            
            <p className="text-[9px] text-slate-600 font-mono uppercase">Swanaya Media Academy · SSL Secure Scanner Token</p>
          </div>
        </div>
      )}

    </div>
  );
}
