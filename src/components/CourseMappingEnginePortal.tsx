/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, Layers, FileText, CheckCircle2, Award, Users, 
  Calendar, GraduationCap, Plus, Edit, Trash2, Search, ArrowRight, ShieldCheck, Check
} from 'lucide-react';
import { SwanayaDatabase, Course, Subject, Semester, Instructor, Student, Exam, ExamResult, Certificate } from '../db/mockDb';

interface CourseMappingEnginePortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function CourseMappingEnginePortal({ currentUser, onRefreshAllData }: CourseMappingEnginePortalProps) {
  const [courses, setCourses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [semesters, setSemesters] = useState<Semester[]>(() => SwanayaDatabase.get<Semester[]>("semesters"));
  const [subjects, setSubjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [instructors, setInstructors] = useState<Instructor[]>(() => SwanayaDatabase.get<Instructor[]>("instructors"));
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [exams, setExams] = useState<Exam[]>(() => SwanayaDatabase.get<Exam[]>("exams"));
  const [results, setResults] = useState<ExamResult[]>(() => SwanayaDatabase.get<ExamResult[]>("results"));
  const [certificates, setCertificates] = useState<Certificate[]>(() => SwanayaDatabase.get<Certificate[]>("certificates"));

  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [activeStep, setActiveStep] = useState<'hierarchy' | 'subjects' | 'tutors' | 'students' | 'exams' | 'results' | 'certificates'>('hierarchy');
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];
  const courseSemesters = semesters.filter(s => s.courseId === selectedCourse?.id);
  const courseSubjects = subjects.filter(sub => courseSemesters.some(sem => sem.id === sub.semesterId));
  const courseStudents = students.filter(st => st.courseId === selectedCourse?.id);
  const courseExams = exams.filter(ex => ex.courseId === selectedCourse?.id);
  const courseCertificates = certificates.filter(cert => cert.courseId === selectedCourse?.id);

  // Quick Action Handlers
  const handleAddSubjectToCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('subName') as HTMLInputElement).value;
    const code = (form.elements.namedItem('subCode') as HTMLInputElement).value;
    const credits = Number((form.elements.namedItem('subCredits') as HTMLInputElement).value || 4);
    const hours = Number((form.elements.namedItem('subHours') as HTMLInputElement).value || 60);
    const instructorId = (form.elements.namedItem('subInstructor') as HTMLSelectElement).value;

    const targetSemId = courseSemesters[0]?.id || `sem-${selectedCourse.id}-1`;
    if (!courseSemesters.length) {
      const newSem: Semester = {
        id: targetSemId,
        courseId: selectedCourse.id,
        name: 'Semester 1',
        code: `${selectedCourse.code}-SEM1`
      };
      const updatedSems = [...semesters, newSem];
      setSemesters(updatedSems);
      SwanayaDatabase.set('semesters', updatedSems);
    }

    const newSubject: Subject = {
      id: `sub-${Date.now()}`,
      semesterId: targetSemId,
      code: code || `SUB-${Math.floor(100 + Math.random() * 900)}`,
      name,
      credits,
      hours,
      description: 'Core mapped academic subject for diploma program.',
      learningOutcomes: ['Industry proficiency', 'Practical project delivery'],
      instructorId: instructorId || instructors[0]?.id || 'inst-1',
      assessmentMethod: 'Continuous Evaluation & End Semester Jury'
    };

    const updatedSubjects = [...subjects, newSubject];
    setSubjects(updatedSubjects);
    SwanayaDatabase.set('subjects', updatedSubjects);

    SwanayaDatabase.log(currentUser?.email || 'admin@swanayamedia.com', currentUser?.name || 'Administrator', 'COURSE_MAPPING_SUBJECT_ADDED', `Mapped subject ${name} to course ${selectedCourse.name}`);
    form.reset();
    setNotice(`Successfully mapped subject "${name}" to course ${selectedCourse.name}!`);
    setTimeout(() => setNotice(null), 3000);
    onRefreshAllData();
  };

  const handleIssueCertificate = (student: Student) => {
    const existing = certificates.find(c => c.studentId === student.id && c.courseId === selectedCourse.id);
    if (existing) {
      setNotice(`Certificate already issued for ${student.name}. Verification ID: ${existing.id}`);
      setTimeout(() => setNotice(null), 3000);
      return;
    }

    const newCert: Certificate = {
      id: `CERT-SMA-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      studentId: student.id,
      studentName: student.name,
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      issueDate: new Date().toISOString().split('T')[0],
      completionDate: new Date().toISOString().split('T')[0],
      grade: 'Distinction (A+)',
      type: 'DIPLOMA',
      signatory: 'Aadithyan M Menon (Managing Director) & Academic Principal',
      verificationUrl: `https://academy.swanayamedia.com/verify?cert=CERT-SMA-2026-${student.id}`,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://academy.swanayamedia.com/verify`
    };

    const updatedCerts = [...certificates, newCert];
    setCertificates(updatedCerts);
    SwanayaDatabase.set('certificates', updatedCerts);

    // Update student certificates count
    const updatedStudents = students.map(st => st.id === student.id ? { ...st, certificatesCount: st.certificatesCount + 1 } : st);
    setStudents(updatedStudents);
    SwanayaDatabase.set('students', updatedStudents);

    SwanayaDatabase.log(currentUser?.email || 'admin@swanayamedia.com', currentUser?.name || 'Administrator', 'CERTIFICATE_ISSUED', `Issued diploma certificate to ${student.name} for ${selectedCourse.name}`);
    setNotice(`Verified and issued official Diploma Certificate to ${student.name}!`);
    setTimeout(() => setNotice(null), 3000);
    onRefreshAllData();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-[#0A0D14] border border-amber-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-mono font-bold uppercase border border-amber-500/30">
                Academic Framework v4.2
              </span>
              <span className="text-xs font-mono text-slate-400">Swanaya Media Academy Course Mapping Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-2">
              Course → Subject → Module → Paper → Lesson → Examination → Result → Certificate
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Strict end-to-end curriculum mapping, tutor allocation, credit verification, continuous assessment, and secure diploma certificate generation.
            </p>
          </div>

          {/* Course Selector */}
          <div className="shrink-0">
            <label className="block text-[10px] font-mono uppercase text-amber-400 font-bold mb-1">Select Active Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-slate-900 border border-amber-500/40 text-white px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
              {courses.length === 0 && <option value="">No courses available</option>}
            </select>
          </div>
        </div>

        {notice && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      {/* Pipeline Navigation Steps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { id: 'hierarchy', label: '1. Hierarchy', icon: BookOpen },
          { id: 'subjects', label: '2. Subjects & Modules', icon: Layers },
          { id: 'tutors', label: '3. Tutor Allocation', icon: GraduationCap },
          { id: 'students', label: '4. Enrolment Mapping', icon: Users },
          { id: 'exams', label: '5. Examinations', icon: FileText },
          { id: 'results', label: '6. Results & Grades', icon: CheckCircle2 },
          { id: 'certificates', label: '7. Certificates', icon: Award },
        ].map((step) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id as any)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive 
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10' 
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="text-[10px] font-mono text-slate-500">Step</span>
              </div>
              <span className="text-xs font-bold leading-tight">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content Render */}
      <div className="bg-[#0A0D14] border border-slate-900 rounded-2xl p-6 shadow-xl">
        {selectedCourse ? (
          <>
            {/* STEP 1: HIERARCHY & COURSE DETAILS */}
            {activeStep === 'hierarchy' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-amber-400" />
                      Course Structure & Hierarchy Overview
                    </h3>
                    <p className="text-xs text-slate-400">Comprehensive structural mapping of {selectedCourse.name}</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-mono font-bold">
                    {selectedCourse.code} · {selectedCourse.level}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Duration & Credits</span>
                    <p className="text-lg font-bold text-white">{selectedCourse.duration}</p>
                    <p className="text-xs text-slate-400">Mode: {selectedCourse.mode} · Fee: ₹{selectedCourse.fee.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Academic Coordinator</span>
                    <p className="text-lg font-bold text-white">{selectedCourse.coordinator}</p>
                    <p className="text-xs text-slate-400">Eligibility: {selectedCourse.eligibility}</p>
                  </div>
                  <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Mapped Metrics</span>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-300 pt-1">
                      <span>Subjects Mapped:</span>
                      <strong className="text-amber-400">{courseSubjects.length}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                      <span>Enrolled Students:</span>
                      <strong className="text-amber-400">{courseStudents.length}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Learning Objectives & Career Outcomes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                      <p className="text-xs font-bold text-white mb-2">Objectives:</p>
                      <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                        {selectedCourse.learningObjectives?.map((obj, i) => <li key={i}>{obj}</li>)}
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                      <p className="text-xs font-bold text-white mb-2">Career Outcomes:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCourse.careerOutcomes?.map((co, i) => (
                          <span key={i} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-xs font-mono">
                            {co}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: SUBJECTS & MODULES MAPPING */}
            {activeStep === 'subjects' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-400" />
                      Subject, Module & Paper Mapping
                    </h3>
                    <p className="text-xs text-slate-400">Allocate subjects and syllabus modules for {selectedCourse.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Add Subject Form */}
                  <div className="p-5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Map New Subject & Credits
                    </h4>
                    <form onSubmit={handleAddSubjectToCourse} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Subject Name</label>
                        <input
                          type="text"
                          name="subName"
                          required
                          placeholder="e.g. Advanced AI Prompt Engineering"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Subject Code</label>
                          <input
                            type="text"
                            name="subCode"
                            required
                            placeholder="SMA-AI-101"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Credits</label>
                          <input
                            type="number"
                            name="subCredits"
                            defaultValue={4}
                            min={1}
                            max={10}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Total Hours</label>
                          <input
                            type="number"
                            name="subHours"
                            defaultValue={60}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Assign Tutor</label>
                          <select
                            name="subInstructor"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          >
                            {instructors.map(inst => (
                              <option key={inst.id} value={inst.id}>{inst.name}</option>
                            ))}
                            {instructors.length === 0 && <option value="inst-1">Swanaya Faculty Lead</option>}
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer mt-2"
                      >
                        Add Subject & Module
                      </button>
                    </form>
                  </div>

                  {/* Existing Mapped Subjects List */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                      Mapped Subjects ({courseSubjects.length})
                    </h4>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {courseSubjects.map((sub) => {
                        const assignedInst = instructors.find(i => i.id === sub.instructorId);
                        return (
                          <div key={sub.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded text-[10px] font-mono font-bold">
                                  {sub.code}
                                </span>
                                <span className="text-xs font-bold text-white">{sub.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Credits: <strong className="text-slate-200">{sub.credits}</strong> · Hours: <strong className="text-slate-200">{sub.hours}h</strong> · Tutor: <strong className="text-amber-300">{assignedInst?.name || 'Assigned Faculty'}</strong>
                              </p>
                            </div>
                            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                              Mapped
                            </span>
                          </div>
                        );
                      })}
                      {courseSubjects.length === 0 && (
                        <p className="text-xs text-slate-500 italic py-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                          No subjects mapped yet. Use the form on the left to add subjects and modules to this course.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: TUTOR ALLOCATION */}
            {activeStep === 'tutors' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                      Tutor Allocation & Faculty Mapping
                    </h3>
                    <p className="text-xs text-slate-400">Assigned professors and subject matter specialists for {selectedCourse.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {instructors.map((inst) => (
                    <div key={inst.id} className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={inst.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(inst.name)}`} 
                          alt={inst.name}
                          className="w-10 h-10 rounded-full bg-slate-950 border border-amber-500/30 object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{inst.name}</p>
                          <p className="text-[10px] font-mono text-amber-400">{inst.qualification}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{inst.bio}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] font-mono">
                        <span className="text-slate-400">Specialization:</span>
                        <strong className="text-slate-200 truncate max-w-[150px]">{inst.specialization}</strong>
                      </div>
                    </div>
                  ))}
                  {instructors.length === 0 && (
                    <p className="text-xs text-slate-500 italic py-8 text-center col-span-full">No faculty members registered.</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: STUDENT ENROLMENT MAPPING */}
            {activeStep === 'students' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-400" />
                      Student Enrolment Mapping ({courseStudents.length} Enrolled)
                    </h3>
                    <p className="text-xs text-slate-400">Enrolled scholars mapped to {selectedCourse.name}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {courseStudents.map((st) => (
                    <div key={st.id} className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={st.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(st.name)}`}
                          alt={st.name}
                          className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{st.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{st.studentId} · {st.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-slate-300">Attendance: <strong className="text-emerald-400">{st.attendancePercentage}%</strong></span>
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/30">Active Scholar</span>
                      </div>
                    </div>
                  ))}
                  {courseStudents.length === 0 && (
                    <p className="text-xs text-slate-500 italic py-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                      No students currently enrolled in this specific course. Use the Fast Enrolment or Public Application form to add students.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: EXAMINATIONS MAPPING */}
            {activeStep === 'exams' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-400" />
                      Examination Mapping & Assessments
                    </h3>
                    <p className="text-xs text-slate-400">Scheduled exams and continuous evaluations for {selectedCourse.name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {courseExams.map((ex) => (
                    <div key={ex.id} className="p-4 bg-slate-900/85 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-mono font-bold">
                            {ex.type}
                          </span>
                          <span className="text-xs font-bold text-white">{ex.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Date: {ex.date} · Duration: {ex.duration} · Max Marks: {ex.maxMarks} (Pass: {ex.passingMarks})</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-mono border border-emerald-500/30">
                        Mapped Active
                      </span>
                    </div>
                  ))}
                  {courseExams.length === 0 && (
                    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl text-center space-y-3">
                      <p className="text-xs text-slate-400 italic">No formal exams explicitly mapped yet. System automatically evaluates student submissions and assignments.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 6: RESULTS & GRADING */}
            {activeStep === 'results' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      Examination Results & Grade Ledger
                    </h3>
                    <p className="text-xs text-slate-400">Verified scores, letter grades, and pass/fail transcripts</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {results.map((res) => {
                    const st = students.find(s => s.id === res.studentId);
                    return (
                      <div key={res.id} className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">{st?.name || 'Scholar Student'} ({st?.studentId || 'SMA-2026'})</p>
                          <p className="text-[10px] font-mono text-slate-400">Remarks: {res.remarks} · Graded By: {res.gradedBy}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-amber-400 font-bold">{res.marks} Marks ({res.grade})</span>
                          <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold ${res.pass ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                            {res.pass ? 'PASS' : 'RE-EXAM'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {results.length === 0 && (
                    <p className="text-xs text-slate-500 italic py-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                      Result ledger is updated upon final jury and assignment evaluations.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 7: CERTIFICATE ELIGIBILITY & ISSUANCE */}
            {activeStep === 'certificates' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Certificate Eligibility & Secure Issuance
                    </h3>
                    <p className="text-xs text-slate-400">Verify completion criteria and issue verifiable digital credentials with QR codes</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {courseStudents.map((st) => {
                    const isIssued = courseCertificates.some(c => c.studentId === st.id);
                    const certRecord = courseCertificates.find(c => c.studentId === st.id);
                    return (
                      <div key={st.id} className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={st.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(st.name)}`}
                            alt={st.name}
                            className="w-10 h-10 rounded-full bg-slate-950 border border-slate-700 object-cover"
                          />
                          <div>
                            <p className="text-xs font-bold text-white">{st.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">Attendance: {st.attendancePercentage}% · Projects: {st.projectsCount}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isIssued ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                Issued ({certRecord?.id})
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleIssueCertificate(st)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              Verify & Issue Certificate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400 text-center py-12">Please create or select a course to inspect the academic mapping engine.</p>
        )}
      </div>
    </div>
  );
}
