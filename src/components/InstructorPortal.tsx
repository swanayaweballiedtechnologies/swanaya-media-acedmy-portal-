/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ClipboardList, CheckSquare, PlusCircle, CheckCircle, FileText, 
  User, Award, MessageSquare, Plus, Clock, ExternalLink, FileUp, UploadCloud, Download, QrCode, ShieldAlert, X 
} from 'lucide-react';
import { 
  SwanayaDatabase, Instructor, Student, Subject, ClassSchedule, 
  AttendanceRecord, Assignment, Submission, Project, Course, Lesson, Batch
} from '../db/mockDb';
import ExaminationEngineModule from './ExaminationEngineModule';

interface InstructorPortalProps {
  instructorUser: Instructor;
  currentUser: any;
  onRefreshAllData: () => void;
  onOpenProfile?: (target: { type: 'STUDENT' | 'INSTRUCTOR' | 'USER'; id: string }) => void;
}

export default function InstructorPortal({ instructorUser, currentUser, onRefreshAllData, onOpenProfile }: InstructorPortalProps) {
  // Database local states
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [classes, setClasses] = useState<ClassSchedule[]>(() => SwanayaDatabase.get<ClassSchedule[]>("classes"));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => SwanayaDatabase.get<AttendanceRecord[]>("attendance"));
  const [assignments, setAssignments] = useState<Assignment[]>(() => SwanayaDatabase.get<Assignment[]>("assignments"));
  const [submissions, setSubmissions] = useState<Submission[]>(() => SwanayaDatabase.get<Submission[]>("submissions"));
  const [projects, setProjects] = useState<Project[]>(() => SwanayaDatabase.get<Project[]>("projects"));
  const [subjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [lessons, setLessons] = useState<Lesson[]>(() => SwanayaDatabase.get<Lesson[]>("lessons"));
  const [batches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>("batches"));

  const [activeTab, setActiveTab] = useState<'attendance' | 'assignments' | 'projects' | 'uploads' | 'question-papers' | 'mcq-exams' | 'exam-eval'>('attendance');

  // Attendance states (Hourly tracking added!)
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [activeHour, setActiveHour] = useState<number>(1);
  const [tempAttendance, setTempAttendance] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [attendanceSaved, setAttendanceSaved] = useState(false);

  // Self-Attendance QR Generator States (New Feature!)
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState({
    classId: '',
    hour: 1,
    className: '',
    batchCode: '',
    expiry: ''
  });

  // New assignment form states
  const [isAsgModalOpen, setIsAsgModalOpen] = useState(false);
  const [newAsg, setNewAsg] = useState({
    title: '',
    description: '',
    subjectId: subjects[0]?.id || 'sub-101',
    deadline: '2026-10-15',
    maxMarks: 100,
    submissionType: 'LINK' as 'FILE' | 'LINK' | 'TEXT'
  });

  // Grading states
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeForm, setGradeForm] = useState({
    marks: 90,
    feedback: ''
  });

  // Project feedback state
  const [evaluatingProject, setEvaluatingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    score: 95,
    feedback: ''
  });

  // PDF Syllabus Uploads State
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessons[0]?.id || '');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ lessonId: string, name: string, date: string, size: string }>>([
    { lessonId: 'les-1', name: 'Tailwind_v4_Theme_Guidelines.pdf', date: '2026-10-02', size: '1.4 MB' },
    { lessonId: 'les-3', name: 'React19_State_Hook_Matrix.pdf', date: '2026-10-04', size: '920 KB' }
  ]);
  const [tempPdfName, setTempPdfName] = useState('CoreSyllabus_S1_Lecture_Draft.pdf');
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);

  // Load current attendance map when selected class shifts OR hour shifts
  React.useEffect(() => {
    if (selectedClassId) {
      const records = attendance.filter(r => r.classId === selectedClassId && r.hour === activeHour);
      const map: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
      records.forEach(r => {
        map[r.studentId] = r.status;
      });
      // Fill missing
      students.forEach(s => {
        if (!map[s.id]) map[s.id] = 'PRESENT';
      });
      setTempAttendance(map);
      setAttendanceSaved(false);
    }
  }, [selectedClassId, activeHour, attendance, students]);

  // Attendance Save Actions per Class ID and HOUR!
  const handleSaveAttendance = () => {
    const classRecord = classes.find(c => c.id === selectedClassId);
    if (!classRecord) return;

    // Filter out existing records for this class AND active hour
    const cleanRecords = attendance.filter(r => !(r.classId === selectedClassId && r.hour === activeHour));
    
    // Build new records with hour slot
    const newRecords: AttendanceRecord[] = Object.entries(tempAttendance).map(([studentId, status]) => ({
      id: `att-${selectedClassId}-${studentId}-${activeHour}-${Date.now()}`,
      classId: selectedClassId,
      studentId,
      status,
      date: classRecord.date,
      hour: activeHour
    }));

    const finalAttendance = [...cleanRecords, ...newRecords];
    SwanayaDatabase.set("attendance", finalAttendance);
    setAttendance(finalAttendance);

    // Recalculate each student's overall attendance percentage!
    const updatedStudents = students.map(st => {
      const studentClassRecords = finalAttendance.filter(r => r.studentId === st.id);
      if (studentClassRecords.length === 0) return st;
      const presents = studentClassRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      const percentage = Math.round((presents / studentClassRecords.length) * 100);
      return {
        ...st,
        attendancePercentage: percentage
      };
    });
    SwanayaDatabase.set("students", updatedStudents);
    setStudents(updatedStudents);

    // Audit Log
    SwanayaDatabase.log(currentUser.email, currentUser.name, "ATTENDANCE_LOG", `Hourly Attendance marked for Class ID: ${selectedClassId}, Hour: ${activeHour}`);

    setAttendanceSaved(true);
    onRefreshAllData();
    setTimeout(() => setAttendanceSaved(false), 4000);
  };

  // Create Assignment
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsg.title.trim()) return;

    const newId = `asg-${Date.now()}`;
    const created: Assignment = {
      id: newId,
      title: newAsg.title,
      description: newAsg.description,
      subjectId: newAsg.subjectId,
      deadline: newAsg.deadline,
      maxMarks: Number(newAsg.maxMarks),
      submissionType: newAsg.submissionType
    };

    const finalAsg = [...assignments, created];
    SwanayaDatabase.set("assignments", finalAsg);
    setAssignments(finalAsg);
    setIsAsgModalOpen(false);
    setNewAsg({
      title: '',
      description: '',
      subjectId: subjects[0]?.id || 'sub-101',
      deadline: '2026-10-15',
      maxMarks: 100,
      submissionType: 'LINK'
    });

    SwanayaDatabase.log(currentUser.email, currentUser.name, "ASSIGNMENT_PUBLISH", `Assignment: ${created.title}`);
    onRefreshAllData();
  };

  // Grade Homework Submission
  const handleGradeSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    const updated = submissions.map(sub => sub.id === gradingSubmission.id ? {
      ...sub,
      status: 'EVALUATED' as const,
      marksObtained: Number(gradeForm.marks),
      feedback: gradeForm.feedback,
      gradedBy: instructorUser.name
    } : sub);

    SwanayaDatabase.set("submissions", updated);
    setSubmissions(updated);
    setGradingSubmission(null);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "ASSIGNMENT_EVALUATE", `Graded submission ID: ${gradingSubmission.id}`);
    onRefreshAllData();
  };

  // Evaluate project Capstone
  const handleEvaluateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingProject) return;

    const updated = projects.map(proj => proj.id === evaluatingProject.id ? {
      ...proj,
      status: 'COMPLETED' as const,
      score: Number(projectForm.score),
      feedback: projectForm.feedback
    } : proj);

    SwanayaDatabase.set("projects", updated);
    setProjects(updated);
    setEvaluatingProject(null);

    // Increase student's projects count & readiness score!
    const targetStudentId = evaluatingProject.studentId;
    const currentSt = students.find(s => s.id === targetStudentId);
    if (currentSt) {
      const updatedStudents = students.map(s => s.id === targetStudentId ? {
        ...s,
        projectsCount: s.projectsCount + 1,
        careerReadinessScore: Math.min(s.careerReadinessScore + 10, 100)
      } : s);
      SwanayaDatabase.set("students", updatedStudents);
      setStudents(updatedStudents);
    }

    SwanayaDatabase.log(currentUser.email, currentUser.name, "PROJECT_EVALUATED", `Capstone Project score logged: ${evaluatingProject.title}`);
    onRefreshAllData();
  };

  // Syllabus PDF upload simulation
  const handleMockPdfUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPdfName.trim()) return;

    const newFile = {
      lessonId: selectedLessonId,
      name: tempPdfName,
      date: new Date().toISOString().split('T')[0],
      size: `${(Math.random() * 2 + 0.5).toFixed(1)} MB`
    };

    // Update lesson details in db
    const updatedLessons = lessons.map(l => l.id === selectedLessonId ? {
      ...l,
      documentUrl: `/documents/simulated/${tempPdfName}`,
      documentName: tempPdfName // Custom flag indicating active PDF attachment
    } : l);

    SwanayaDatabase.set("lessons", updatedLessons);
    setLessons(updatedLessons);
    setUploadedFiles([newFile, ...uploadedFiles]);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "PDF_SYLLABUS_UPLOAD", `Uploaded syllabus PDF: ${tempPdfName} for Lesson ID: ${selectedLessonId}`);

    setPdfUploadSuccess(true);
    setTimeout(() => {
      setPdfUploadSuccess(false);
      setTempPdfName('CoreSyllabus_S1_Lecture_Draft.pdf');
    }, 4000);
    onRefreshAllData();
  };

  return (
    <div className="space-y-6">
      
      {/* Portals Subnav Header Bar */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-md max-w-fit">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'attendance' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Hourly Attendance
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Assignments & grading
        </button>
        <button 
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'projects' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Capstone Projects
        </button>
        <button 
          onClick={() => setActiveTab('uploads')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'uploads' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Syllabus PDF Uploads
        </button>
        <button 
          onClick={() => setActiveTab('question-papers')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'question-papers' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Question Papers
        </button>
        <button 
          onClick={() => setActiveTab('mcq-exams')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'mcq-exams' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          MCQ Examinations
        </button>
        <button 
          onClick={() => setActiveTab('exam-eval')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'exam-eval' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Answerbook Evaluation
        </button>
      </div>

      {/* ATTENDANCE SECTION WITH HOURLY CONTROLS */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 font-serif">Hourly Attendance Register</h3>
              <p className="text-[10px] text-slate-500">Track and mark student presence specifically for individual hourly sessions.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-mono">Scheduled Class:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.date} · {subjects.find(s=>s.id===cls.subjectId)?.name || 'Class'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hourly Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-mono">Hour Slot:</label>
                <select
                  value={activeHour}
                  onChange={(e) => setActiveHour(Number(e.target.value))}
                  className="bg-slate-950 border border-amber-500/30 rounded px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value={1}>Hour 1 (Core Lecture)</option>
                  <option value={2}>Hour 2 (Conceptual Lab)</option>
                  <option value={3}>Hour 3 (Vibe Session)</option>
                  <option value={4}>Hour 4 (Code Review)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Student Cohort List</span>
                <p className="text-[10px] text-amber-500 font-mono font-bold mt-0.5 uppercase">MARKING ATTENDANCE FOR HOUR {activeHour}</p>
              </div>
              {attendanceSaved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" /> Hourly Attendance Saved Successfully!
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-850">
              {students.map((st) => (
                <div key={st.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div 
                    onClick={() => onOpenProfile?.({ type: 'STUDENT', id: st.id })}
                    className="flex items-center gap-3 cursor-pointer group"
                    title="View Student Profile"
                  >
                    <img 
                      src={st.avatarUrl} 
                      alt={st.name} 
                      className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 group-hover:border-amber-400 transition-colors" 
                    />
                    <div>
                      <p className="font-bold text-slate-200 group-hover:text-amber-300 transition-colors">{st.name} ↗</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {st.studentId} · Prev Rate: {st.attendancePercentage}%</p>
                    </div>
                  </div>

                  {/* Hourly Controls for Status */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded">
                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setTempAttendance({ ...tempAttendance, [st.id]: status })}
                        className={`px-3 py-1 text-[9px] font-bold font-mono uppercase rounded transition-colors cursor-pointer ${
                          tempAttendance[st.id] === status
                            ? status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' :
                              status === 'ABSENT' ? 'bg-rose-500/20 text-rose-400' :
                              status === 'LATE' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-indigo-500/20 text-indigo-400'
                            : 'text-slate-600 hover:text-slate-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar (With QR self-attendance generator trigger!) */}
            <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
              <button
                onClick={() => {
                  setQrModalOpen(true);
                  const classRecord = classes.find(c => c.id === selectedClassId);
                  const batchRecord = batches.find(b => b.id === classRecord?.batchId);
                  setQrPayload({
                    classId: selectedClassId,
                    hour: activeHour,
                    className: subjects.find(s=>s.id===classRecord?.subjectId)?.name || 'Class Lecture',
                    batchCode: batchRecord?.code || 'BATCH-2026',
                    expiry: new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
                  });
                }}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4 text-amber-500" />
                Generate Self-Attendance QR
              </button>

              <button
                onClick={handleSaveAttendance}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors shadow-md shadow-amber-500/10"
              >
                Log Hour {activeHour} Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENTS SECTION */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Homework Task lists */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Published Homework Worksheets</h4>
              <button
                onClick={() => setIsAsgModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Publish Task
              </button>
            </div>

            <div className="space-y-4">
              {assignments.map((asg) => (
                <div key={asg.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-2.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{asg.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Subject Paper: {subjects.find(s=>s.id===asg.subjectId)?.name}</p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                      MAX: {asg.maxMarks} MARKS
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{asg.description}</p>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-850/60">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" /> Deadline: {asg.deadline}</span>
                    <span className="uppercase text-slate-400">Submission type: {asg.submissionType}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Submissions Grading list (Supports PDF downloads!) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Incoming Student Uploads</h4>
            </div>

            <div className="space-y-4">
              {submissions.map((sub) => {
                const student = students.find(s => s.id === sub.studentId);
                const assignment = assignments.find(a => a.id === sub.assignmentId);
                return (
                  <div key={sub.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <img 
                          src={student?.avatarUrl} 
                          alt={student?.name} 
                          className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 shrink-0" 
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-200">{student?.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Task: {assignment?.title}</p>
                        </div>
                      </div>
                      
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                        sub.status === 'EVALUATED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded text-xs border border-slate-850 font-mono text-slate-400 flex items-center justify-between">
                      <div className="truncate mr-3">
                        <p className="font-semibold text-slate-300">{sub.content}</p>
                        {sub.fileUrl && (
                          <p className="text-[9px] text-emerald-400 mt-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Attached PDF: {sub.fileUrl.split('/').pop()}
                          </p>
                        )}
                      </div>
                      {sub.fileUrl && (
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); alert(`Simulated PDF Download: ${sub.fileUrl}`); }}
                          className="text-amber-500 hover:text-amber-400 flex items-center gap-0.5 text-[10px]"
                        >
                          Download <Download className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {sub.status === 'EVALUATED' ? (
                      <div className="p-3 bg-slate-900/60 rounded border border-slate-850 text-xs space-y-1">
                        <p className="font-bold text-slate-300">Grade: {sub.marksObtained} / {assignment?.maxMarks} marks</p>
                        <p className="text-slate-500 text-[11px]">Critique Feedback: {sub.feedback}</p>
                        <p className="text-[9px] text-slate-600 font-mono mt-2">Evaluated by: {sub.gradedBy}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setGradingSubmission(sub);
                          setGradeForm({ marks: assignment?.maxMarks || 100, feedback: '' });
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded border border-slate-700 cursor-pointer transition-colors"
                      >
                        Launch Critique & Grade Form
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* CAPSTONE PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Senior Capstone Reviews</h3>
            <p className="text-[10px] text-slate-500 mt-1">Provide evaluations to unlock student portfolio public placements.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((proj) => {
              const student = students.find(s => s.id === proj.studentId);
              return (
                <div key={proj.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                    <div>
                      <h4 className="text-sm font-serif font-bold text-slate-200">{proj.title}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Author: {student?.name}</p>
                    </div>
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${
                      proj.status === 'COMPLETED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    }`}>
                      {proj.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{proj.description}</p>

                  <div className="bg-slate-950 p-2.5 rounded text-[11px] font-mono border border-slate-850 text-slate-500 space-y-1">
                    <p>Repository: <span className="text-slate-300">{proj.repoUrl || 'None'}</span></p>
                    <p>Live Workspace URL: <span className="text-amber-500">{proj.liveUrl || 'None'}</span></p>
                  </div>

                  {proj.status === 'COMPLETED' ? (
                    <div className="p-3 bg-slate-950/40 rounded border border-slate-850 text-xs space-y-1">
                      <p className="font-bold text-emerald-400">Evaluated Score: {proj.score} / 100</p>
                      <p className="text-slate-400">Review: {proj.feedback}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEvaluatingProject(proj);
                        setProjectForm({ score: 95, feedback: '' });
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded border border-slate-700 cursor-pointer"
                    >
                      Score & Certify Capstone Build
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SYLLABUS PDF UPLOADS WORKSPACE */}
      {activeTab === 'uploads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Choose Lesson and Upload simulated PDF */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-850 pb-2.5 font-mono flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-amber-500" />
                Upload Course PDF Manual
              </h3>

              {pdfUploadSuccess && (
                <p className="text-xs text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" /> PDF Document Synced to LMS Workspace!
                </p>
              )}

              <form onSubmit={handleMockPdfUpload} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Select Course Lesson</label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2.5 text-xs text-slate-200"
                  >
                    {lessons.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title} ({subjects.find(s=>s.id===l.subjectId)?.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">PDF Material Filename</label>
                  <input 
                    type="text"
                    required
                    value={tempPdfName}
                    onChange={(e) => setTempPdfName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2.5 text-xs text-slate-100 font-mono"
                  />
                </div>

                {/* Simulated drag & drop zone */}
                <div 
                  onClick={() => {
                    const titles = ['ResponsiveFlex_Cheatsheet.pdf', 'React19_Concurrency_DeepDive.pdf', 'LLM_PromptTemplates_Syllabus.pdf'];
                    setTempPdfName(titles[Math.floor(Math.random() * titles.length)]);
                  }}
                  className="border border-dashed border-slate-800 rounded-lg p-8 text-center hover:bg-slate-900/30 transition-all cursor-pointer space-y-2 group"
                >
                  <FileUp className="w-8 h-8 text-slate-500 group-hover:text-amber-500 mx-auto transition-colors" />
                  <p className="text-xs text-slate-400 font-medium">Drag & Drop PDF document here, or click to auto-generate mock PDF file</p>
                  <p className="text-[9px] text-slate-600 font-mono">Format support: .pdf (Max size 10MB)</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors font-mono flex items-center justify-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  Publish PDF to LMS
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: List of Uploaded PDF manuals */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Active Document Repository</h3>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-850">
              {uploadedFiles.map((f, idx) => {
                const lesson = lessons.find(l => l.id === f.lessonId);
                return (
                  <div key={idx} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-950/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200 font-mono">{f.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">Lesson: {lesson?.title} · Uploaded {f.date} · Size {f.size}</p>
                      </div>
                    </div>

                    <a 
                      href="#"
                      onClick={(e) => { e.preventDefault(); alert(`Simulated PDF Download: ${f.name}`); }}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-slate-400 hover:text-amber-500 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* EXAMINATION ENGINE: QUESTION PAPERS, MCQ EXAMS & ANSWERBOOK EVALUATION */}
      {(activeTab === 'question-papers' || activeTab === 'mcq-exams' || activeTab === 'exam-eval') && (
        <ExaminationEngineModule
          mode="INSTRUCTOR"
          initialSection={
            activeTab === 'question-papers'
              ? 'papers'
              : activeTab === 'mcq-exams'
              ? 'mcq'
              : 'evaluations'
          }
          currentUser={currentUser}
          onRefreshAllData={onRefreshAllData}
        />
      )}

      {/* SELF-ATTENDANCE QR CODE MODAL OVERLAY (New Feature!) */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-sm w-full p-8 space-y-6 text-center shadow-2xl relative">
            <button 
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold tracking-wider text-amber-500 uppercase">MOBILE SELF-ATTENDANCE PASS</span>
              <h3 className="text-lg font-serif font-bold text-white leading-tight">
                {qrPayload.className}
              </h3>
              <p className="text-slate-400 text-xs">Batch: <span className="font-mono text-slate-200">{qrPayload.batchCode}</span> · Hour Slot: <span className="font-mono text-amber-400 font-bold">{qrPayload.hour}</span></p>
            </div>

            {/* High-Fidelity SVG QR Code containing custom brand logo */}
            <div className="bg-white p-4 rounded-xl max-w-[220px] mx-auto border-2 border-amber-500/20 shadow-xl shadow-amber-500/5">
              <svg className="w-full h-full text-black" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="white" />
                
                {/* Standard Finder Patterns */}
                <rect x="5" y="5" width="25" height="25" fill="black" />
                <rect x="10" y="10" width="15" height="15" fill="white" />
                <rect x="13" y="13" width="9" height="9" fill="black" />
                
                <rect x="70" y="5" width="25" height="25" fill="black" />
                <rect x="75" y="10" width="15" height="15" fill="white" />
                <rect x="78" y="13" width="9" height="9" fill="black" />
                
                <rect x="5" y="70" width="25" height="25" fill="black" />
                <rect x="10" y="75" width="15" height="15" fill="white" />
                <rect x="13" y="78" width="9" height="9" fill="black" />

                {/* Simulated Noise / Grid Data Block elements */}
                <rect x="35" y="10" width="5" height="10" fill="black" />
                <rect x="45" y="5" width="10" height="5" fill="black" />
                <rect x="40" y="20" width="15" height="5" fill="black" />
                <rect x="60" y="15" width="5" height="15" fill="black" />
                
                <rect x="10" y="35" width="15" height="5" fill="black" />
                <rect x="20" y="45" width="5" height="10" fill="black" />
                <rect x="5" y="55" width="10" height="5" fill="black" />
                
                <rect x="75" y="35" width="10" height="10" fill="black" />
                <rect x="85" y="50" width="10" height="5" fill="black" />
                <rect x="70" y="60" width="5" height="15" fill="black" />
                
                <rect x="35" y="75" width="15" height="5" fill="black" />
                <rect x="55" y="70" width="5" height="10" fill="black" />
                <rect x="45" y="85" width="15" height="10" fill="black" />

                {/* Inner Branding Overlay box 'SW' */}
                <rect x="34" y="34" width="32" height="32" fill="white" rx="3" />
                <rect x="37" y="37" width="26" height="26" fill="black" rx="2" />
                <text x="50" y="53" fill="#D4AF37" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">SMA</text>
              </svg>
            </div>

            <div className="space-y-3 bg-slate-900/60 p-4 rounded border border-slate-850">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Expires at: <span className="font-mono text-white font-bold">{qrPayload.expiry}</span>
              </p>
              <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono justify-center border-t border-slate-850 pt-2.5">
                <ShieldAlert className="w-3 h-3 text-emerald-400" />
                <span>DYNAMIC SECURITY TOKEN ACTIVE</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal font-sans italic">
              Instruct students to log in on their mobile browser and tap "Scan Attendance QR Code" to register as present instantly.
            </p>
          </div>
        </div>
      )}

      {/* GRADING SUBMISSION MODAL */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              Homework Assessment Criteria
            </h3>

            <form onSubmit={handleGradeSubmission} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Marks Awarded</label>
                <input 
                  type="number" 
                  required
                  value={gradeForm.marks}
                  onChange={(e) => setGradeForm({ ...gradeForm, marks: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Critique & Improvement Guidance</label>
                <textarea 
                  rows={4}
                  required
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  placeholder="Review form structure, accessibility contrast, line layout math..."
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Post Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVALUATE PROJECT MODAL */}
      {evaluatingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              Capstone Presentation Evaluation
            </h3>

            <form onSubmit={handleEvaluateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Capstone Score (0 - 100)</label>
                <input 
                  type="number" 
                  required
                  value={projectForm.score}
                  onChange={(e) => setProjectForm({ ...projectForm, score: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Evaluator Critique Remarks</label>
                <textarea 
                  rows={4}
                  required
                  value={projectForm.feedback}
                  onChange={(e) => setProjectForm({ ...projectForm, feedback: e.target.value })}
                  placeholder="Evaluate prompt structure integration, presentation articulation..."
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <p className="text-[10px] text-slate-500 leading-normal italic font-mono">
                *Saving this evaluation increments the student's Verified Projects counter and elevates their industry readiness index by 10 points.
              </p>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setEvaluatingProject(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Post Capstone Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
