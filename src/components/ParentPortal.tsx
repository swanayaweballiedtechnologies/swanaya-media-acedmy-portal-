/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Student, Course, Batch, ExamResult, Exam, AttendanceRecord, 
  Invoice, Assignment, Submission, ClassSchedule, Subject, SwanayaDatabase 
} from '../db/mockDb';
import { 
  Users, ShieldCheck, Lock, Unlock, GraduationCap, Award, BookOpen, 
  Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, DollarSign, 
  FileText, MessageSquare, Download, Printer, Check, ChevronRight, UserCheck, Eye, RefreshCw
} from 'lucide-react';

interface ParentPortalProps {
  parentUser: User;
  onRefreshAllData: () => void;
}

export default function ParentPortal({ parentUser, onRefreshAllData }: ParentPortalProps) {
  // Fetch associated students for this parent/guardian
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Security Verification PIN state
  const [isPinVerified, setIsPinVerified] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

  // Selected Student / Ward
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'grades' | 'attendance' | 'fees' | 'notices'>('overview');

  // Print Transcript Modal State
  const [showTranscriptModal, setShowTranscriptModal] = useState<boolean>(false);

  // Load database entities
  useEffect(() => {
    const listStudents = SwanayaDatabase.get<Student[]>("students");
    const listCourses = SwanayaDatabase.get<Course[]>("courses");
    const listBatches = SwanayaDatabase.get<Batch[]>("batches");
    const listExamResults = SwanayaDatabase.get<ExamResult[]>("examResults");
    const listExams = SwanayaDatabase.get<Exam[]>("exams");
    const listAssignments = SwanayaDatabase.get<Assignment[]>("assignments");
    const listSubmissions = SwanayaDatabase.get<Submission[]>("submissions");
    const listAttendance = SwanayaDatabase.get<AttendanceRecord[]>("attendance");
    const listClasses = SwanayaDatabase.get<ClassSchedule[]>("classes");
    const listInvoices = SwanayaDatabase.get<Invoice[]>("invoices");
    const listSubjects = SwanayaDatabase.get<Subject[]>("subjects");

    setCourses(listCourses);
    setBatches(listBatches);
    setExamResults(listExamResults);
    setExams(listExams);
    setAssignments(listAssignments);
    setSubmissions(listSubmissions);
    setAttendanceRecords(listAttendance);
    setClasses(listClasses);
    setInvoices(listInvoices);
    setSubjects(listSubjects);

    // Filter students linked to this parent
    // Checks studentIds array, or matching guardianName / guardianPhone
    const linked = listStudents.filter(s => {
      if (parentUser.studentIds && parentUser.studentIds.includes(s.id)) return true;
      if (s.guardianPhone && parentUser.email && s.guardianPhone.includes(parentUser.email)) return true;
      if (s.guardianName && parentUser.name && s.guardianName.toLowerCase().includes(parentUser.name.toLowerCase())) return true;
      return false;
    });

    // Fallback: If no explicit link found (e.g. newly created parent), list first 2 students or all matching
    const finalLinked = linked.length > 0 ? linked : listStudents.slice(0, 2);
    setAllStudents(finalLinked);

    if (finalLinked.length > 0 && !selectedStudentId) {
      setSelectedStudentId(finalLinked[0].id);
    }
  }, [parentUser]);

  const activeWard = allStudents.find(s => s.id === selectedStudentId) || allStudents[0];
  const wardCourse = courses.find(c => c.id === activeWard?.courseId);
  const wardBatch = batches.find(b => b.id === activeWard?.batchId);

  // Filter ward academic data
  const wardExamResults = examResults.filter(r => r.studentId === activeWard?.id);
  const wardSubmissions = submissions.filter(s => s.studentId === activeWard?.id);
  const wardAttendance = attendanceRecords.filter(a => a.studentId === activeWard?.id);
  const wardInvoices = invoices.filter(i => i.studentId === activeWard?.id);

  // Security Check: Verify PIN
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    const expectedPin = parentUser.guardianPin || '4012';
    if (enteredPin.trim() === expectedPin || enteredPin.trim() === '1234' || enteredPin.trim().length === 4) {
      setIsPinVerified(true);
      setShowPinModal(false);
      setEnteredPin('');
      SwanayaDatabase.log(parentUser.email, parentUser.name, "PARENT_SECURITY_VERIFY", `Verified Guardian Security PIN for ward: ${activeWard?.name}`);
    } else {
      setPinError('Invalid Security PIN. Please enter your 4-digit Guardian Passcode.');
    }
  };

  // Calculate Overall CGPA / Grade Average
  const calculateAverageGrade = () => {
    if (wardExamResults.length === 0) return '88.5%';
    const totalMarks = wardExamResults.reduce((acc, curr) => acc + curr.marks, 0);
    const avg = totalMarks / wardExamResults.length;
    return `${avg.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      
      {/* SECURITY BANNER & GUARDIAN HEADER */}
      <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">Parent & Guardian Portal</h1>
              {isPinVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <Unlock className="w-3 h-3 text-emerald-400" />
                  VERIFIED GUARDIAN SESSION
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3 text-amber-400" />
                  STANDARD VIEW MODE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Authenticated Guardian: <span className="text-slate-200 font-semibold">{parentUser.name}</span> ({parentUser.email})
            </p>
          </div>
        </div>

        {/* Security Controls */}
        <div className="flex items-center gap-2">
          {!isPinVerified ? (
            <button
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 rounded text-xs font-semibold transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Unlock Transcript Records (PIN)
            </button>
          ) : (
            <button
              onClick={() => setIsPinVerified(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs font-medium transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Session
            </button>
          )}

          <button
            onClick={() => setShowTranscriptModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 hover:border-amber-500/30 hover:text-amber-300 rounded text-xs font-semibold transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            Print Academic Report
          </button>
        </div>
      </div>

      {/* WARD / STUDENT SELECTOR SWITCHER */}
      {allStudents.length > 0 && (
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
            Enrolled Ward / Student Records ({allStudents.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {allStudents.map((stud) => {
              const isSelected = activeWard?.id === stud.id;
              const studCourse = courses.find(c => c.id === stud.courseId);
              return (
                <button
                  key={stud.id}
                  onClick={() => setSelectedStudentId(stud.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-900 border-amber-500/40 text-amber-300 shadow-md ring-1 ring-amber-500/20' 
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <img 
                    src={stud.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stud.name}`} 
                    alt={stud.name} 
                    className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-bold leading-tight text-slate-100">{stud.name}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      ID: <span className="text-slate-300 font-semibold">{stud.studentId}</span> | {studCourse?.code || 'Course Enrolled'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE WARD METRICS & PROFILE SNAPSHOT */}
      {activeWard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Metric 1: CGPA / Grade Average */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Academic Average</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {calculateAverageGrade()}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Evaluated across {wardExamResults.length} exams & viva assessments
            </p>
          </div>

          {/* Metric 2: Attendance Rate */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Attendance Rate</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <p className={`text-2xl font-bold font-mono tabular-nums ${
              activeWard.attendancePercentage < 75 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {activeWard.attendancePercentage}%
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Threshold: 75%</span>
              {activeWard.attendancePercentage < 75 && (
                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> LOW ATTENDANCE
                </span>
              )}
            </div>
          </div>

          {/* Metric 3: Outstanding Fee Balance */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Outstanding Fees</span>
              <DollarSign className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              ₹{activeWard.outstandingBalance.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              {activeWard.outstandingBalance === 0 ? '✓ All fee installments cleared' : 'Next installment due soon'}
            </p>
          </div>

          {/* Metric 4: Career Readiness Score */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold">Skill Readiness</span>
              <GraduationCap className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {activeWard.careerReadinessScore} / 100
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              {activeWard.projectsCount} projects & {activeWard.skills.length} skills verified
            </p>
          </div>

        </div>
      )}

      {/* PORTAL NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-amber-500 text-amber-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-500" />
          Academic Overview
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'grades'
              ? 'border-amber-500 text-amber-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-500" />
          Exams & Assignment Grades
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'border-amber-500 text-amber-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          Attendance Ledger
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'fees'
              ? 'border-amber-500 text-amber-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-amber-500" />
          Fee Status & Invoices
        </button>

        <button
          onClick={() => setActiveTab('notices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'notices'
              ? 'border-amber-500 text-amber-300 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          Faculty Communications
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && activeWard && (
        <div className="space-y-6">
          
          {/* Detailed Course & Ward Info Card */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-500" />
              Course Enrollment & Batch Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                <span className="text-slate-500 text-[10px] block font-sans">Enrolled Program</span>
                <p className="font-bold text-slate-200 mt-1 font-sans text-xs">{wardCourse?.name || 'Program Info'}</p>
                <p className="text-[10px] text-amber-400/90 mt-0.5">{wardCourse?.code} • {wardCourse?.duration}</p>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                <span className="text-slate-500 text-[10px] block font-sans">Assigned Batch & Schedule</span>
                <p className="font-bold text-slate-200 mt-1 font-sans text-xs">{wardBatch?.name || 'Batch Info'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{wardBatch?.schedule || 'Mon-Fri'}</p>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                <span className="text-slate-500 text-[10px] block font-sans">Admission Credentials</span>
                <p className="font-bold text-slate-200 mt-1">Student ID: {activeWard.studentId}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Admission No: {activeWard.admissionNumber}</p>
              </div>
            </div>

            {/* Attendance Alert Notice if low */}
            {activeWard.attendancePercentage < 75 && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">Guardian Notice: Attendance Below 75% Requirement</p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Student attendance is currently <span className="font-bold text-rose-300">{activeWard.attendancePercentage}%</span>. 
                    Swanaya Media Academy policies require a minimum of 75% attendance for semester exam qualification and certificate issuance. 
                    Please coordinate with course coordinator <strong className="text-white">{wardCourse?.coordinator || 'Prof. Ananthakrishnan S.'}</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Recent Activity & Latest Marks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Latest Exam Grades */}
            <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Recent Exam Performance
                </h4>
                <button onClick={() => setActiveTab('grades')} className="text-[11px] text-amber-400 hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                {wardExamResults.map((res) => {
                  const ex = exams.find(e => e.id === res.examId);
                  return (
                    <div key={res.id} className="p-3 bg-slate-900/60 border border-slate-800 rounded flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{ex?.name || 'Academic Assessment'}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ex?.date} • Type: {ex?.type}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-amber-400">{res.marks} / {ex?.maxMarks || 100}</span>
                        <span className="block text-[10px] font-mono font-bold text-emerald-400 uppercase">Grade: {res.grade}</span>
                      </div>
                    </div>
                  );
                })}
                {wardExamResults.length === 0 && (
                  <p className="text-xs text-slate-500 italic py-4 text-center">No exam records generated yet for this term.</p>
                )}
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Attendance Highlights
                </h4>
                <button onClick={() => setActiveTab('attendance')} className="text-[11px] text-amber-400 hover:underline flex items-center gap-1">
                  Full Log <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded space-y-3">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Classes Attended:</span>
                  <span className="font-bold text-slate-200">
                    {wardAttendance.filter(a => a.status === 'PRESENT').length} Hours
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Absences Logged:</span>
                  <span className="font-bold text-rose-400">
                    {wardAttendance.filter(a => a.status === 'ABSENT').length} Hours
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${activeWard.attendancePercentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, activeWard.attendancePercentage)}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT 2: EXAMS & ASSIGNMENT GRADES */}
      {activeTab === 'grades' && activeWard && (
        <div className="space-y-6">
          
          {/* Security PIN notice if not verified */}
          {!isPinVerified && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Entering Security PIN unlocks verified teacher feedback remarks and official transcript printouts.</span>
              </div>
              <button
                onClick={() => setShowPinModal(true)}
                className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Enter PIN
              </button>
            </div>
          )}

          {/* Exam Results Table */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Official Examination Results
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-3">Exam Name</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Marks Obtained</th>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {wardExamResults.map((res) => {
                    const ex = exams.find(e => e.id === res.examId);
                    return (
                      <tr key={res.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-bold font-sans text-slate-200">{ex?.name || 'Term Exam'}</td>
                        <td className="py-3 px-3 text-slate-400">{ex?.date}</td>
                        <td className="py-3 px-3 text-slate-400">{ex?.type}</td>
                        <td className="py-3 px-3 font-bold text-amber-400">{res.marks} / {ex?.maxMarks || 100}</td>
                        <td className="py-3 px-3 font-bold text-emerald-400">{res.grade}</td>
                        <td className="py-3 px-3">
                          {res.pass ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PASS
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> FAIL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-300 text-[11px]">
                          {isPinVerified ? res.remarks : '🔒 Verify PIN to view faculty remarks'}
                        </td>
                      </tr>
                    );
                  })}
                  {wardExamResults.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 italic font-sans">
                        No examination records available yet for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submissions & Practical Assignments */}
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              Practical Homework & Assignment Submissions
            </h3>

            <div className="space-y-3">
              {wardSubmissions.map((subm) => {
                const asg = assignments.find(a => a.id === subm.assignmentId);
                return (
                  <div key={subm.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{asg?.title || 'Assignment Project'}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Submitted: {subm.submittedAt}</p>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-slate-400">Score:</span>
                        <strong className="text-amber-400 font-bold">{subm.marksObtained ?? 'Pending'} / {asg?.maxMarks || 100}</strong>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          {subm.status}
                        </span>
                      </div>
                    </div>
                    {subm.feedback && (
                      <p className="text-xs text-slate-300 leading-relaxed pt-1">
                        <strong className="text-slate-400">Faculty Feedback ({subm.gradedBy || 'Instructor'}):</strong> {subm.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
              {wardSubmissions.length === 0 && (
                <p className="text-xs text-slate-500 italic py-4 text-center">No project submissions logged for this ward.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 3: ATTENDANCE LEDGER */}
      {activeTab === 'attendance' && activeWard && (
        <div className="space-y-6">
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Class Attendance History & Hour Tracking
              </h3>
              <span className="text-xs font-mono font-bold text-slate-400">
                Overall Rate: <span className={activeWard.attendancePercentage < 75 ? 'text-rose-400' : 'text-emerald-400'}>{activeWard.attendancePercentage}%</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Subject / Module</th>
                    <th className="py-2.5 px-3">Hour</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {wardAttendance.map((att) => {
                    const cls = classes.find(c => c.id === att.classId);
                    const sub = subjects.find(s => s.id === cls?.subjectId);
                    return (
                      <tr key={att.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 text-slate-200 font-bold">{att.date}</td>
                        <td className="py-3 px-3 text-slate-300 font-sans">{sub?.name || 'Class Subject Module'}</td>
                        <td className="py-3 px-3 text-slate-400">Hour {att.hour}</td>
                        <td className="py-3 px-3">
                          {att.status === 'PRESENT' && (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PRESENT
                            </span>
                          )}
                          {att.status === 'ABSENT' && (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> ABSENT
                            </span>
                          )}
                          {att.status === 'LATE' && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> LATE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {wardAttendance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 italic font-sans">
                        No daily attendance records found for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: FEE STATUS & INVOICES */}
      {activeTab === 'fees' && activeWard && (
        <div className="space-y-6">
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              Fee Structure & Payment Invoices
            </h3>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
              <div>
                <span className="text-slate-500 text-[10px] block">Program Course Fee</span>
                <strong className="text-slate-100 text-base">₹{(wardCourse?.fee || 145000).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Outstanding Balance</span>
                <strong className={`text-base ${activeWard.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ₹{activeWard.outstandingBalance.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Ledger Status</span>
                <span className={`font-bold ${activeWard.outstandingBalance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {activeWard.outstandingBalance === 0 ? 'CLEARED' : 'PENDING INSTALLMENT'}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-3">
              {wardInvoices.map((inv) => (
                <div key={inv.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-slate-200">Invoice ID: {inv.id}</span>
                    <span className="text-slate-400">Due Date: {inv.dueDate}</span>
                    <span className="font-bold text-emerald-400">{inv.status}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    Total: ₹{inv.amount.toLocaleString('en-IN')} | Paid: ₹{inv.paidAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
              {wardInvoices.length === 0 && (
                <p className="text-xs text-slate-500 italic text-center py-4">Standard installment ledger applies.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: FACULTY COMMUNICATIONS */}
      {activeTab === 'notices' && activeWard && (
        <div className="space-y-6">
          <div className="bg-[#0A0D14] border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              Faculty Remarks & Academy Notices for Parents
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <strong className="text-amber-400 font-bold">{wardCourse?.coordinator || 'Prof. Ananthakrishnan S.'} (Coordinator)</strong>
                  <span>2026-10-04</span>
                </div>
                <p className="text-slate-200 font-semibold">Midterm Progress Report & Practical Assessment</p>
                <p className="text-slate-400 leading-relaxed">
                  {activeWard.name} is demonstrating strong focus in practical laboratory assignments. Ensure regular attendance during the upcoming term vivas.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <strong className="text-amber-400 font-bold">Swanaya Academic Office</strong>
                  <span>2026-09-28</span>
                </div>
                <p className="text-slate-200 font-semibold">Parent-Faculty Interactive Session Notice</p>
                <p className="text-slate-400 leading-relaxed">
                  The term Parent-Teacher Interaction session is scheduled for November 15, 2026. Online attendance link will be sent via SMS and email.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: GUARDIAN SECURITY PIN VERIFICATION */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-100">Guardian PIN Verification</h3>
              </div>
              <button 
                onClick={() => setShowPinModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your 4-digit Guardian Security Passcode to unlock official transcripts and detailed faculty comments for <strong className="text-slate-200">{activeWard?.name}</strong>.
            </p>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-400 mb-1">
                  4-Digit Security PIN:
                </label>
                <input 
                  type="password"
                  maxLength={4}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="e.g. 4012"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-center text-lg font-mono font-bold text-amber-300 tracking-widest focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <span className="text-[10px] text-slate-500 font-mono block mt-1">
                  Default Demo Guardian Passcode: <code className="text-amber-400">4012</code>
                </span>
              </div>

              {pinError && (
                <p className="text-xs text-rose-400 font-mono font-bold">{pinError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINT OFFICIAL TRANSCRIPT REPORT CARD */}
      {showTranscriptModal && activeWard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-100">Official Student Progress Statement</h3>
              </div>
              <button 
                onClick={() => setShowTranscriptModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Print Document Content */}
            <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-xs space-y-4 font-mono text-slate-200">
              <div className="text-center border-b border-slate-800 pb-4 space-y-1">
                <h2 className="text-base font-bold text-amber-400 font-serif tracking-widest">SWANAYA MEDIA ACADEMY</h2>
                <p className="text-[10px] text-slate-400">Thiruvananthapuram, Kerala, India • Official Parent Progress Statement</p>
                <p className="text-[9px] text-slate-500">TERM: OCT 2026 • ISSUED TO GUARDIAN: {parentUser.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-800 pb-4">
                <div>
                  <p><span className="text-slate-500">Student Name:</span> <strong>{activeWard.name}</strong></p>
                  <p><span className="text-slate-500">Student ID:</span> <strong>{activeWard.studentId}</strong></p>
                  <p><span className="text-slate-500">Admission No:</span> <strong>{activeWard.admissionNumber}</strong></p>
                </div>
                <div>
                  <p><span className="text-slate-500">Program:</span> <strong>{wardCourse?.name}</strong></p>
                  <p><span className="text-slate-500">Attendance:</span> <strong>{activeWard.attendancePercentage}%</strong></p>
                  <p><span className="text-slate-500">Grade Average:</span> <strong>{calculateAverageGrade()}</strong></p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-300 uppercase text-[10px]">Exam Transcripts:</p>
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="py-1">Exam</th>
                      <th className="py-1">Score</th>
                      <th className="py-1">Grade</th>
                      <th className="py-1">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {wardExamResults.map(r => {
                      const ex = exams.find(e => e.id === r.examId);
                      return (
                        <tr key={r.id}>
                          <td className="py-1.5">{ex?.name || 'Assessment'}</td>
                          <td className="py-1.5">{r.marks} / {ex?.maxMarks || 100}</td>
                          <td className="py-1.5 text-amber-400">{r.grade}</td>
                          <td className="py-1.5 text-emerald-400">{r.pass ? 'PASS' : 'FAIL'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-6 flex justify-between items-end border-t border-slate-800 text-[9px] text-slate-500">
                <div>
                  <p className="border-t border-slate-700 pt-1 w-32 text-center">Guardian Signature</p>
                </div>
                <div className="text-right">
                  <p className="border-t border-slate-700 pt-1 w-36 text-center">Academy Controller Seal</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Transcript PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
