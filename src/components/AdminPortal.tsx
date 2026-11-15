/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users, BookOpen, Layers, UserCheck, Calendar, GraduationCap, DollarSign, 
  Plus, Edit, Eye, Trash2, Search, Filter, Check, X, FileText, MoveUp, MapPin, Sparkles, AlertTriangle,
  MessageCircle, ExternalLink, Phone
} from 'lucide-react';
import { 
  SwanayaDatabase, Student, Course, Batch, User, Instructor, Semester, Subject, AdmissionApplication, Lead, ExamCenter
} from '../db/mockDb';
import InstructorAllocation from './InstructorAllocation';
import { academyService } from '../services/academyService';

interface AdminPortalProps {
  activeRole: 'SUPER_ADMIN' | 'ADMIN' | 'ACADEMIC_ADMIN' | 'MD' | 'PRINCIPAL' | 'REVIEWER';
  currentUser: User;
  onRefreshAllData: () => void;
  onOpenProfile?: (target: { type: 'STUDENT' | 'INSTRUCTOR' | 'USER'; id: string }) => void;
  onNavigate?: (tab: string) => void;
}

export default function AdminPortal({ activeRole, currentUser, onRefreshAllData, onOpenProfile, onNavigate }: AdminPortalProps) {
  // State from LocalStorage
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [courses, setCourses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [batches, setBatches] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>("batches"));
  const [instructors, setInstructors] = useState<Instructor[]>(() => SwanayaDatabase.get<Instructor[]>("instructors"));
  const [semesters, setSemesters] = useState<Semester[]>(() => SwanayaDatabase.get<Semester[]>("semesters"));
  const [subjects, setSubjects] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));
  const [applications, setApplications] = useState<AdmissionApplication[]>(() => SwanayaDatabase.get<AdmissionApplication[]>("applications"));

  React.useEffect(() => {
    const loadRealCourses = async () => {
      const fetched = await academyService.getCourses();
      if (fetched && fetched.length > 0) {
        setCourses(fetched as unknown as Course[]);
      }
    };
    loadRealCourses();
  }, []);

  // Batch capacity verification states for student modal
  const [studentModalOverrideConfirmed, setStudentModalOverrideConfirmed] = useState(false);
  const [studentModalCapacityWarning, setStudentModalCapacityWarning] = useState<string | null>(null);

  // Navigation Sub-tab within Admin portal
  const [activeSubTab, setActiveSubTab] = useState<string>('registrations');


  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('adminName') as HTMLInputElement).value;
    const email = (form.elements.namedItem('adminEmail') as HTMLInputElement).value;
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
      isVerified: true
    };
    const users = SwanayaDatabase.get<User[]>("users");
    SwanayaDatabase.set("users", [...users, newUser]);
    onRefreshAllData();
    alert('Admin added successfully!');
    form.reset();
  };

  const handleClearPreloadedContent = () => {
    if (window.confirm("Are you sure you want to remove all preloaded content? This will allow you to add fresh subjects, trainers, courses, and registrations.")) {
      SwanayaDatabase.clearAllPreloadedData();
      setStudents([]);
      setCourses([]);
      setBatches([]);
      setInstructors([]);
      setSemesters([]);
      setSubjects([]);
      setApplications([]);
      onRefreshAllData();
    }
  };

  const handleRestoreDefaultContent = () => {
    SwanayaDatabase.restoreDefaultData();
    setStudents(SwanayaDatabase.get<Student[]>("students"));
    setCourses(SwanayaDatabase.get<Course[]>("courses"));
    setBatches(SwanayaDatabase.get<Batch[]>("batches"));
    setInstructors(SwanayaDatabase.get<Instructor[]>("instructors"));
    setSemesters(SwanayaDatabase.get<Semester[]>("semesters"));
    setSubjects(SwanayaDatabase.get<Subject[]>("subjects"));
    setApplications(SwanayaDatabase.get<AdmissionApplication[]>("applications"));
    onRefreshAllData();
  };

  // Search & Filter state for lists
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilterCourse, setStudentFilterCourse] = useState('ALL');
  
  // Modals / Editors state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    phone: '',
    whatsappPhone: '',
    whatsappOptIn: true,
    guardianName: '',
    guardianPhone: '',
    academicBackground: '',
    courseId: 'c-1',
    batchId: 'b-1',
    semesterId: 's-1-1',
    skills: '',
    outstandingBalance: 0
  });

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    name: '',
    description: '',
    duration: '12 Months',
    level: 'ADVANCED' as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'DIPLOMA',
    eligibility: '',
    fee: 0,
    mode: 'HYBRID' as 'PHYSICAL' | 'ONLINE' | 'HYBRID',
    coordinator: ''
  });

  // Curriculum Builder additions
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterCourse, setNewSemesterCourse] = useState('c-1');
  const [newSubjectForm, setNewSubjectForm] = useState({
    semesterId: 's-1-1',
    code: '',
    name: '',
    credits: 4,
    hours: 60,
    description: '',
    instructorId: 'inst-1'
  });

  // Sync state helpers
  const saveStudents = (newStudents: Student[]) => {
    SwanayaDatabase.set("students", newStudents);
    setStudents(newStudents);
    onRefreshAllData();
  };

  const saveCourses = (newCourses: Course[]) => {
    SwanayaDatabase.set("courses", newCourses);
    setCourses(newCourses);
    onRefreshAllData();
  };

  // Student Actions
  const handleOpenStudentModal = (student: Student | null) => {
    setStudentModalOverrideConfirmed(false);
    setStudentModalCapacityWarning(null);
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        name: student.name,
        email: student.email,
        phone: student.phone,
        whatsappPhone: student.whatsappPhone || student.phone || '',
        whatsappOptIn: student.whatsappOptIn ?? true,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        academicBackground: student.academicBackground,
        courseId: student.courseId,
        batchId: student.batchId,
        semesterId: student.semesterId,
        skills: student.skills.join(', '),
        outstandingBalance: student.outstandingBalance
      });
    } else {
      setEditingStudent(null);
      setStudentForm({
        name: '',
        email: '',
        phone: '',
        whatsappPhone: '',
        whatsappOptIn: true,
        guardianName: '',
        guardianPhone: '',
        academicBackground: '',
        courseId: courses[0]?.id || 'c-1',
        batchId: batches[0]?.id || 'b-1',
        semesterId: semesters[0]?.id || 's-1-1',
        skills: 'HTML5, CSS, React',
        outstandingBalance: 145000
      });
    }
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();

    // Check target batch capacity
    const targetBatch = batches.find(b => b.id === studentForm.batchId);
    // If editing existing student and they remain in the same batch, exclude them from count
    const enrolledCount = students.filter(s => 
      s.batchId === studentForm.batchId && 
      s.status !== 'INACTIVE' && 
      (!editingStudent || s.id !== editingStudent.id)
    ).length;
    const maxCapacity = targetBatch?.maxCapacity ?? 30;

    if (enrolledCount >= maxCapacity && !studentModalOverrideConfirmed) {
      setStudentModalCapacityWarning(`⚠️ Target Batch Full: ${targetBatch?.name || 'Selected batch'} has reached its capacity limit of ${maxCapacity} students (${enrolledCount}/${maxCapacity} filled). Please check the override box to proceed.`);
      return;
    }

    setStudentModalCapacityWarning(null);

    const finalWhatsapp = studentForm.whatsappPhone.trim() || studentForm.phone.trim() || '+91 94460 00000';

    if (editingStudent) {
      // Edit
      const updated = students.map(s => s.id === editingStudent.id ? {
        ...s,
        name: studentForm.name,
        email: studentForm.email,
        phone: studentForm.phone,
        whatsappPhone: finalWhatsapp,
        whatsappOptIn: studentForm.whatsappOptIn,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
        academicBackground: studentForm.academicBackground,
        courseId: studentForm.courseId,
        batchId: studentForm.batchId,
        semesterId: studentForm.semesterId,
        skills: studentForm.skills.split(',').map(sk => sk.trim()).filter(Boolean),
        outstandingBalance: Number(studentForm.outstandingBalance)
      } : s);
      saveStudents(updated);
      SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_UPDATE", `Student: ${studentForm.name} (WhatsApp: ${finalWhatsapp})`);
    } else {
      // Create
      const newId = `stud-${Date.now()}`;
      const admissionNum = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const studentIdCode = `SMA-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newStudent: Student = {
        id: newId,
        studentId: studentIdCode,
        admissionNumber: admissionNum,
        userId: `usr-${Date.now()}`,
        name: studentForm.name,
        email: studentForm.email,
        phone: studentForm.phone,
        whatsappPhone: finalWhatsapp,
        whatsappOptIn: studentForm.whatsappOptIn,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
        academicBackground: studentForm.academicBackground,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentForm.name}`,
        status: 'ACTIVE',
        courseId: studentForm.courseId,
        batchId: studentForm.batchId,
        semesterId: studentForm.semesterId,
        enrollmentDate: new Date().toISOString().split('T')[0],
        skills: studentForm.skills.split(',').map(sk => sk.trim()).filter(Boolean),
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: Number(studentForm.outstandingBalance),
        careerReadinessScore: 35
      };
      
      // Also write User record for them so they can log in!
      const usersList = SwanayaDatabase.get<User[]>("users");
      const newUser: User = {
        id: newStudent.userId,
        email: studentForm.email,
        name: studentForm.name,
        role: 'STUDENT',
        avatarUrl: newStudent.avatarUrl,
        status: 'ACTIVE',
        createdAt: newStudent.enrollmentDate
      };
      SwanayaDatabase.set("users", [...usersList, newUser]);

      saveStudents([...students, newStudent]);
      SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_CREATE", `Student: ${studentForm.name}`);
    }
    setIsStudentModalOpen(false);
  };

  const handleDeactivateStudent = (id: string, name: string) => {
    const updated = students.map(s => s.id === id ? { ...s, status: s.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const } : s);
    saveStudents(updated);
    SwanayaDatabase.log(currentUser.email, currentUser.name, "STUDENT_STATUS_TOGGLE", `Student: ${name}`);
  };

  // Course Actions
  const handleOpenCourseModal = (course: Course | null) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        code: course.code,
        name: course.name,
        description: course.description,
        duration: course.duration,
        level: course.level,
        eligibility: course.eligibility,
        fee: course.fee,
        mode: course.mode,
        coordinator: course.coordinator
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        code: 'SMA-',
        name: '',
        description: '',
        duration: '6 Months',
        level: 'DIPLOMA',
        eligibility: '12th Standard or Equivalent',
        fee: 65000,
        mode: 'PHYSICAL',
        coordinator: 'Devika Menon'
      });
    }
    setIsCourseModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const courseData = {
        code: courseForm.code,
        name: courseForm.name,
        description: courseForm.description,
        duration: courseForm.duration,
        level: courseForm.level,
        eligibility: courseForm.eligibility,
        fee: Number(courseForm.fee),
        mode: courseForm.mode,
        coordinator: courseForm.coordinator,
        status: 'ACTIVE'
      };

      if (editingCourse) {
        // For simplicity in this demo, we'll just log or you can add update method to service
        const updated = courses.map(c => c.id === editingCourse.id ? { ...c, ...courseData } : c);
        saveCourses(updated as Course[]);
      } else {
        const id = await academyService.createCourse(courseData);
        if (id) {
          const fetched = await academyService.getCourses();
          if (fetched) setCourses((fetched as any[]).map(c => ({ ...c, status: c.status || 'ACTIVE' })) as unknown as Course[]);
        }
      }
      setIsCourseModalOpen(false);
      onRefreshAllData();
    } catch (err) {
      alert('Failed to save course.');
    }
  };

  // Curriculum Build Actions
  const handleAddSemester = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterName.trim()) return;
    const newId = `s-${Date.now()}`;
    const newSem: Semester = {
      id: newId,
      courseId: newSemesterCourse,
      name: newSemesterName,
      code: `${courses.find(c=>c.id===newSemesterCourse)?.code || 'SMA'}-S${semesters.filter(s=>s.courseId===newSemesterCourse).length + 1}`
    };
    const updated = [...semesters, newSem];
    SwanayaDatabase.set("semesters", updated);
    setSemesters(updated);
    setNewSemesterName('');
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SEMESTER_CREATE", `Semester: ${newSem.name}`);
    onRefreshAllData();
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectForm.name.trim() || !newSubjectForm.code.trim()) return;
    const newId = `sub-${Date.now()}`;
    const newSub: Subject = {
      id: newId,
      semesterId: newSubjectForm.semesterId,
      code: newSubjectForm.code,
      name: newSubjectForm.name,
      credits: Number(newSubjectForm.credits),
      hours: Number(newSubjectForm.hours),
      description: newSubjectForm.description,
      learningOutcomes: ["Deliver validated technical outputs", "Formulate real-time solutions with code"],
      instructorId: newSubjectForm.instructorId,
      assessmentMethod: "Course assignments + Viva evaluation"
    };
    const updated = [...subjects, newSub];
    SwanayaDatabase.set("subjects", updated);
    setSubjects(updated);
    setNewSubjectForm({
      semesterId: 's-1-1',
      code: '',
      name: '',
      credits: 4,
      hours: 60,
      description: '',
      instructorId: 'inst-1'
    });
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SUBJECT_CREATE", `Subject: ${newSub.name}`);
    onRefreshAllData();
  };

  const handleApproveApplication = (appId: string) => {
    const updatedApps = applications.map(app => app.id === appId ? { ...app, status: 'ACCEPTED' as const } : app);
    SwanayaDatabase.set("applications", updatedApps);
    setApplications(updatedApps);
    
    // Log audit
    const app = applications.find(a=>a.id === appId);
    if (app) {
      SwanayaDatabase.log(currentUser.email, currentUser.name, "ADMISSION_APPROVE", `App approved for: ${app.name}`);
    }
    onRefreshAllData();
  };

  // Search filter math
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          student.email.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          student.studentId.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesCourse = studentFilterCourse === 'ALL' || student.courseId === studentFilterCourse;
    return matchesSearch && matchesCourse;
  });

  // Financial Stats summary for Super Admin & Admin
  const outstandingSum = students.reduce((sum, s) => sum + s.outstandingBalance, 0);
  const revenueReceived = 185000; // Mock cumulative paid

  return (
    <div className="space-y-6">
      
      {/* Top Admin Controls Bar: Data Purge & Management */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-lg gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-sm font-serif font-bold text-white uppercase tracking-wider">
              ADMIN CONTROL CENTER & REGISTRATIONS
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Manage registrations, add custom subjects, trainers (instructors), courses, and clear preloaded demo content for fresh entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleClearPreloadedContent}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-mono font-bold uppercase rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
            title="Remove preloaded demo courses, subjects, trainers and students"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Preloaded Content
          </button>
          
          <button
            onClick={handleRestoreDefaultContent}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono font-bold uppercase rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
            title="Reload default demo data"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Restore Demo Data
          </button>
        </div>
      </div>

      {/* Dynamic Navigation Sub-tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-md">
        <button 
          onClick={() => setActiveSubTab('registrations')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeSubTab === 'registrations' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Registrations
        </button>

        <button 
          onClick={() => setActiveSubTab('courses')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeSubTab === 'courses' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Courses & Syllabus
        </button>

        <button 
          onClick={() => setActiveSubTab('students')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeSubTab === 'students' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Students CRM
        </button>

        <button 
          onClick={() => setActiveSubTab('allocation')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeSubTab === 'allocation' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Faculty
        </button>

        {activeRole === 'SUPER_ADMIN' && (
          <button 
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
              activeSubTab === 'overview' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            System Health
          </button>
        )}
      </div>

      {/* COURSES & SYLLABUS SECTION */}
      {activeSubTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-5 rounded-lg gap-4">
            <div>
              <h3 className="text-base font-serif font-bold text-white">Course Catalog & Mapping</h3>
              <p className="text-[11px] text-slate-400">Manage academic programs, upload brochures, and map syllabus modules.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleOpenCourseModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
              <button 
                onClick={() => {
                  alert('Course Catalog & Mappings successfully saved to database and synchronized!');
                  onRefreshAllData();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
              >
                <Check className="w-4 h-4" /> Save Course Mapping
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => (
              <div key={course.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold font-mono">
                      {course.code}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => handleOpenCourseModal(course)} className="p-1.5 bg-slate-800 text-slate-400 hover:text-blue-400 rounded" title="Edit Course"><Edit className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 bg-slate-800 text-slate-400 hover:text-rose-400 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{course.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{course.description}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono">
                    <span className="text-slate-500">{course.duration}</span>
                    <span className="text-amber-500 font-bold">₹{course.fee.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-mono font-semibold">Catalog Mapped</span>
                  <button
                    onClick={() => {
                      handleOpenCourseModal(course);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer transition-colors shadow"
                  >
                    Save Course
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ADMIN ADDITION SUB-TAB (Only for Super Admin) */}
      {activeRole === 'SUPER_ADMIN' && activeSubTab === 'overview' && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg mt-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase mb-4">Add Admin</h3>
          <form onSubmit={handleAddAdmin} className="space-y-2">
            <input name="adminName" placeholder="Admin Name" required className="w-full bg-slate-950 p-2 rounded text-xs" />
            <input name="adminEmail" placeholder="Admin Email" type="email" required className="w-full bg-slate-950 p-2 rounded text-xs" />
            <button type="submit" className="bg-amber-500 text-black px-4 py-2 rounded text-xs font-bold">Add Admin</button>
          </form>
        </div>
      )}


      {/* REGISTRATIONS SUB-TAB */}
      {activeSubTab === 'registrations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 border border-slate-800 p-5 rounded-lg gap-4">
            <div>
              <span className="text-[9px] font-mono font-bold text-amber-500 tracking-widest uppercase block">STUDENT & TRAINEE REGISTRATIONS</span>
              <h3 className="text-base font-serif font-bold text-white">Registrations & Admissions Management</h3>
              <p className="text-[11px] text-slate-400">Manage student registrations, review incoming proposals, and register new scholars directly into the database.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('course-verification')}
                  className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded cursor-pointer transition-colors whitespace-nowrap"
                >
                  MD &amp; Dept Course Verification →
                </button>
              )}
              <button
                onClick={() => handleOpenStudentModal(null)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/10 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Registration
              </button>
            </div>
          </div>

          {/* Pending Applications / Registrations list */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Incoming Registrations & Applications ({applications.length})
              </h4>
            </div>
            
            {applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200 text-sm">{app.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                          app.status === 'ACCEPTED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>{app.email} • {app.phone}</span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono">
                          {courses.find(c => c.id === app.courseId)?.code || 'SMA-ADWDVC'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500">Qualification: {app.qualification} | Preferred Batch: {app.preferredBatch}</p>
                      {app.message && <p className="text-[11px] text-slate-400 italic">"{app.message}"</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={`https://wa.me/${(app.phone || '919446000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hello ${app.name}! This is Swanaya Media Academy Admissions Office regarding your registration for the ${
                            courses.find(c => c.id === app.courseId)?.name || 'program'
                          }.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1 font-mono"
                        title="Chat with trainee on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>

                      {app.status !== 'ACCEPTED' && (
                        <button
                          onClick={() => handleApproveApplication(app.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setStudentForm({
                            name: app.name,
                            email: app.email,
                            phone: app.phone,
                            whatsappPhone: app.phone,
                            whatsappOptIn: true,
                            guardianName: 'Self / Guardian',
                            guardianPhone: app.phone,
                            academicBackground: app.qualification,
                            courseId: app.courseId || courses[0]?.id || 'c-1',
                            batchId: batches[0]?.id || 'b-1',
                            semesterId: semesters[0]?.id || 's-1-1',
                            skills: 'Fresh Trainee',
                            outstandingBalance: 145000
                          });
                          setIsStudentModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-400 text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Enroll Student
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950 border border-slate-850 rounded-lg space-y-2">
                <p className="text-xs text-slate-400">No pending admission registrations in system.</p>
                <p className="text-[11px] text-slate-500">Click "New Registration" to add fresh trainees or scholars to the database.</p>
              </div>
            )}
          </div>

          {/* Quick Enrolled Student Roster summary in Registrations */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Registered Student Scholars ({students.length})
              </h4>
            </div>

            {students.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((st) => (
                  <div 
                    key={st.id} 
                    onClick={() => onOpenProfile?.({ type: 'STUDENT', id: st.id })}
                    className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-lg flex items-start gap-3 cursor-pointer transition-colors group"
                  >
                    <img 
                      src={st.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${st.name}`}
                      alt={st.name} 
                      className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 shrink-0 group-hover:border-amber-400 transition-colors"
                    />
                    <div className="space-y-1 min-w-0 flex-grow">
                      <p className="font-bold text-slate-200 group-hover:text-amber-300 transition-colors text-xs truncate flex items-center justify-between">
                        <span>{st.name}</span>
                        <Eye className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
                      </p>
                      <span className="text-[10px] font-mono font-bold text-amber-500 block">{st.studentId}</span>
                      <p className="text-[10px] text-slate-400 truncate">{st.email}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 inline-block font-mono">
                        {st.status} · View Profile ↗
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-950 border border-slate-850 rounded-lg">
                <p className="text-xs text-slate-500 italic">Database contains zero registered students. Use "New Registration" or "Clear Preloaded Content" to populate fresh items.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OVERVIEW SECTION */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">TOTAL REGISTERED STUDENTS</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">{students.length}</h3>
              <p className="text-[10px] text-emerald-400 mt-2">100% active validation</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">ACTIVE COURSES RUNNING</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">{courses.length}</h3>
              <p className="text-[10px] text-slate-400 mt-2">3 programs, 1 add-on workshop</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">OUTSTANDING ACADEMY FEES</p>
              <h3 className="text-2xl font-bold font-serif text-amber-500 tracking-tight mt-1">₹{outstandingSum.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] text-rose-400 mt-2">Triggers automatic alert warnings</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">PENDING ADMISSION APPLICATIONS</p>
              <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">
                {applications.filter(a => a.status !== 'ENROLLED' && a.status !== 'REJECTED').length}
              </h3>
              <p className="text-[10px] text-amber-400 mt-2">Counselling required</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 font-serif">System Host Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs text-slate-400 font-mono">
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">CURRENT LOCAL SESSION</span>
                <span>2026-10-05 Local Server Instance</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">PERSISTENCE STRATEGY</span>
                <span className="text-emerald-400 font-semibold">Active HTML5 LocalStorage</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[9px] uppercase font-bold">DATABASE HEALTH STATUS</span>
                <span className="text-emerald-400">NOMINAL · 0ms LATENCY</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          
          {/* List Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="Search student, id, email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 max-w-xs font-mono"
                />
              </div>
              
              <select
                value={studentFilterCourse}
                onChange={(e) => setStudentFilterCourse(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Programs</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenStudentModal(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Register New Student
            </button>
          </div>

          {/* Grid/Table List */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4 font-bold">Student Name & ID</th>
                  <th className="p-4 font-bold">Contact & Background</th>
                  <th className="p-4 font-bold">Course / Batch / Sem</th>
                  <th className="p-4 font-bold">Balance</th>
                  <th className="p-4 font-bold">Attendance</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <img 
                            src={student.avatarUrl} 
                            alt={student.name} 
                            className="w-7 h-7 rounded-full bg-slate-800 shrink-0 border border-slate-700"
                          />
                          <div>
                            <p className="font-bold text-slate-200">{student.name}</p>
                            <span className="text-[10px] font-mono text-amber-500 font-bold">{student.studentId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 space-y-0.5">
                        <p className="text-slate-300">{student.email}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{student.phone}</p>
                        <span className="text-[10px] text-slate-500 italic">Edu: {student.academicBackground}</span>
                      </td>
                      <td className="p-4 space-y-0.5 text-slate-300">
                        <p className="font-semibold">{courses.find(c=>c.id===student.courseId)?.code || 'N/A'}</p>
                        <p className="text-slate-500 text-[10px]">{batches.find(b=>b.id===student.batchId)?.name || 'N/A'}</p>
                        <p className="text-slate-500 text-[10px] italic">Sem: {semesters.find(s=>s.id===student.semesterId)?.name || 'N/A'}</p>
                      </td>
                      <td className="p-4 font-mono font-bold text-amber-400">
                        ₹{student.outstandingBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="p-4 font-mono">
                        <span className={student.attendancePercentage < 75 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                          {student.attendancePercentage}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          student.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          <a
                            href={`https://wa.me/${((student.whatsappPhone || student.phone) || '919446000000').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Hello ${student.name}! This is Swanaya Media Academy Admin Office regarding your ${
                                courses.find(c=>c.id===student.courseId)?.code || 'course'
                              } schedule.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 transition-colors"
                            title={`Chat on WhatsApp (${student.whatsappPhone || student.phone})`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => onOpenProfile?.({ type: 'STUDENT', id: student.id })}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 transition-colors cursor-pointer"
                            title="View Individual Profile & Digital ID Pass"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenStudentModal(student)}
                            className="p-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded text-amber-400 transition-colors"
                            title="Edit student record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeactivateStudent(student.id, student.name)}
                            className={`p-1.5 border rounded transition-colors ${
                              student.status === 'ACTIVE' 
                                ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 text-rose-400' 
                                : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400'
                            }`}
                            title={student.status === 'ACTIVE' ? "Deactivate" : "Activate"}
                          >
                            {student.status === 'ACTIVE' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">No students matched.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* COURSES DIRECTORY TAB */}
      {activeSubTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Courses Registry</h3>
            <button
              onClick={() => handleOpenCourseModal(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Course Spec
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <div key={course.id} className="bg-slate-900/40 border border-slate-800 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                  <div>
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">{course.code}</span>
                    <h4 className="text-sm font-semibold text-slate-100 font-serif mt-1">{course.name}</h4>
                  </div>
                  <button
                    onClick={() => handleOpenCourseModal(course)}
                    className="p-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded text-amber-400 transition-colors"
                    title="Edit Program"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-normal">{course.description}</p>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-slate-500">
                  <div>
                    <span className="text-slate-600 block text-[8px] uppercase">Level</span>
                    <span className="text-slate-300 font-bold">{course.level}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[8px] uppercase">Duration</span>
                    <span className="text-slate-300">{course.duration}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[8px] uppercase">Academy Fee</span>
                    <span className="text-amber-500 font-bold">₹{course.fee.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 border-t border-slate-850 pt-3 flex justify-between">
                  <span>Coordinator: {course.coordinator}</span>
                  <span className="text-emerald-400">Status: {course.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMISSIONS APPLICATION TRACKER */}
      {activeSubTab === 'admissions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prospect Applications Inbox</h3>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                  <th className="p-4 font-bold">Applicant Details</th>
                  <th className="p-4 font-bold">Academic Qualification</th>
                  <th className="p-4 font-bold">Course Proposed</th>
                  <th className="p-4 font-bold">CRM Pipeline Status</th>
                  <th className="p-4 font-bold text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {applications.length > 0 ? (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-4 space-y-1">
                        <p className="font-bold text-slate-200">{app.name}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{app.email} · {app.phone}</p>
                        <p className="text-slate-400 text-[10px] italic">" {app.message} "</p>
                      </td>
                      <td className="p-4 text-slate-300 font-medium">
                        {app.qualification}
                      </td>
                      <td className="p-4 text-slate-300">
                        {courses.find(c=>c.id===app.courseId)?.name || 'N/A'}
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">Pref. Batch: {app.preferredBatch}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          app.status === 'ACCEPTED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                          app.status === 'REJECTED' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                          'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {app.status === 'COUNSELLING' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleApproveApplication(app.id)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[10px] uppercase rounded transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No pending actions</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">No new applications inbox.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CURRICULUM BUILDER */}
      {activeSubTab === 'curriculum' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Current Curriculum Tree */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Academic Schema Explorer</h3>
              <p className="text-[10px] text-slate-500 mt-1">Directly build Program Modules and Subject definitions on the fly.</p>
            </div>

            <div className="space-y-6">
              {courses.map((course) => {
                const semList = semesters.filter(s => s.courseId === course.id);
                return (
                  <div key={course.id} className="bg-slate-900/30 border border-slate-850 rounded-lg p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <GraduationCap className="w-5 h-5 text-amber-500 shrink-0" />
                      <h4 className="text-sm font-bold text-white font-serif">{course.name} ({course.code})</h4>
                    </div>

                    <div className="space-y-3 pl-2">
                      {semList.length > 0 ? (
                        semList.map((sem) => {
                          const subList = subjects.filter(s => s.semesterId === sem.id);
                          return (
                            <div key={sem.id} className="bg-[#0A0D14]/40 border border-slate-800/80 p-4 rounded space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-200">{sem.name}</p>
                                <span className="text-[9px] font-mono text-slate-500 uppercase">{sem.code}</span>
                              </div>

                              <div className="space-y-2 pl-4 border-l border-slate-850">
                                {subList.length > 0 ? (
                                  subList.map((sub) => (
                                    <div key={sub.id} className="bg-slate-900/40 border border-slate-850 p-2.5 rounded text-xs">
                                      <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-300">{sub.name}</p>
                                        <span className="text-[10px] text-amber-500 font-mono font-semibold">{sub.code}</span>
                                      </div>
                                      <p className="text-slate-500 text-[10px] leading-relaxed mt-1">{sub.description}</p>
                                      
                                      {/* Unboxed inline metadata */}
                                      <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-900">
                                        <span>Credits: {sub.credits}</span>
                                        <span>·</span>
                                        <span>Hours: {sub.hours}</span>
                                        <span>·</span>
                                        <span>Assigned Instructor: {instructors.find(i=>i.id===sub.instructorId)?.name || 'N/A'}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-500 italic pl-2">No subjects configured for this semester.</p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic">No semesters created yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Builder Tools */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Create Semester */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 font-mono">
                Add Semester Block
              </h3>
              
              <form onSubmit={handleAddSemester} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Assign to Program</label>
                  <select
                    value={newSemesterCourse}
                    onChange={(e) => setNewSemesterCourse(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Semester Title</label>
                  <input 
                    type="text" 
                    required
                    value={newSemesterName}
                    onChange={(e) => setNewSemesterName(e.target.value)}
                    placeholder="e.g. Semester 4: Vibe Architecture"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold uppercase rounded text-white transition-colors cursor-pointer"
                >
                  Create Semester
                </button>
              </form>
            </div>

            {/* Create Subject */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 font-mono">
                Configure New Subject Paper
              </h3>

              <form onSubmit={handleAddSubject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Assign to Semester</label>
                  <select
                    value={newSubjectForm.semesterId}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, semesterId: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({courses.find(c=>c.id===s.courseId)?.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Subject Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. SMA-WD-401"
                      value={newSubjectForm.code}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, code: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Instructor</label>
                    <select
                      value={newSubjectForm.instructorId}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, instructorId: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                    >
                      {instructors.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Subject Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Next.js Server Components"
                    value={newSubjectForm.name}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Credits</label>
                    <input 
                      type="number" 
                      required
                      value={newSubjectForm.credits}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, credits: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Hours</label>
                    <input 
                      type="number" 
                      required
                      value={newSubjectForm.hours}
                      onChange={(e) => setNewSubjectForm({...newSubjectForm, hours: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Description Outcomes</label>
                  <textarea 
                    rows={2}
                    placeholder="Syllabus coverage & goals..."
                    value={newSubjectForm.description}
                    onChange={(e) => setNewSubjectForm({...newSubjectForm, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
                >
                  Publish Subject Spec
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {activeSubTab === 'allocation' && (
        <InstructorAllocation currentUser={currentUser} onRefreshAllData={onRefreshAllData} />
      )}

      {/* STUDENT REGISTRATION / PROFILE MODAL */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif flex items-center justify-between">
              <span>{editingStudent ? 'Edit Student Profile' : 'Fast-Track Student Enrollment'}</span>
              <span className="text-[10px] font-mono font-normal text-amber-500">Academic Registrar</span>
            </h3>

            {studentModalCapacityWarning && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Capacity Exceeded Notice</span>
                </div>
                <p className="text-[11px] text-slate-300">{studentModalCapacityWarning}</p>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Email</label>
                  <input 
                    type="email" 
                    required
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={studentForm.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentForm(prev => ({
                        ...prev,
                        phone: val,
                        whatsappPhone: prev.whatsappPhone ? prev.whatsappPhone : val
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Academic Background</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.academicBackground}
                    onChange={(e) => setStudentForm({...studentForm, academicBackground: e.target.value})}
                    placeholder="e.g. B.Tech / Plus Two"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* WHATSAPP INTEGRATION IN STUDENT MODAL */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    WhatsApp Number & Alerts
                  </label>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">Official Desk Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input 
                    type="tel" 
                    value={studentForm.whatsappPhone}
                    onChange={(e) => setStudentForm({...studentForm, whatsappPhone: e.target.value})}
                    placeholder="WhatsApp Number e.g. +91 94460 00000"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-400"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={studentForm.whatsappOptIn}
                      onChange={(e) => setStudentForm({...studentForm, whatsappOptIn: e.target.checked})}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-300 font-semibold">
                      Enable WhatsApp Alerts
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Guardian Name</label>
                  <input 
                    type="text" 
                    required
                    value={studentForm.guardianName}
                    onChange={(e) => setStudentForm({...studentForm, guardianName: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Guardian Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={studentForm.guardianPhone}
                    onChange={(e) => setStudentForm({...studentForm, guardianPhone: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Course Program</label>
                  <select
                    value={studentForm.courseId}
                    onChange={(e) => setStudentForm({...studentForm, courseId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Batch</label>
                    {(() => {
                      const selBatch = batches.find(b => b.id === studentForm.batchId);
                      const currentCount = students.filter(s => s.batchId === studentForm.batchId && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                      const maxCap = selBatch?.maxCapacity ?? 30;
                      const isFull = currentCount >= maxCap;
                      return (
                        <span className={`text-[9px] font-mono ${isFull ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                          {currentCount}/{maxCap} {isFull ? 'FULL' : 'seats'}
                        </span>
                      );
                    })()}
                  </div>
                  <select
                    value={studentForm.batchId}
                    onChange={(e) => {
                      setStudentForm({...studentForm, batchId: e.target.value});
                      setStudentModalCapacityWarning(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {batches.map(b => {
                      const count = students.filter(s => s.batchId === b.id && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                      const maxCap = b.maxCapacity ?? 30;
                      const isFull = count >= maxCap;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name} ({count}/{maxCap} {isFull ? '• FULL' : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Semester</label>
                  <select
                    value={studentForm.semesterId}
                    onChange={(e) => setStudentForm({...studentForm, semesterId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name.substring(0, 10)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BATCH CAPACITY WARNING BOX */}
              {(() => {
                const selBatch = batches.find(b => b.id === studentForm.batchId);
                const currentCount = students.filter(s => s.batchId === studentForm.batchId && s.status !== 'INACTIVE' && (!editingStudent || s.id !== editingStudent.id)).length;
                const maxCap = selBatch?.maxCapacity ?? 30;
                const isFull = currentCount >= maxCap;

                if (!isFull) return null;

                return (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">⚠️ Target Batch Full Warning</p>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      <strong className="text-amber-200">{selBatch?.name}</strong> has reached its maximum capacity limit of <strong className="font-mono text-amber-400">{maxCap} students</strong> ({currentCount}/{maxCap} filled).
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                      <input 
                        type="checkbox"
                        id="studentModalOverrideCheck"
                        checked={studentModalOverrideConfirmed}
                        onChange={(e) => setStudentModalOverrideConfirmed(e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer rounded"
                      />
                      <label htmlFor="studentModalOverrideCheck" className="text-[11px] text-amber-200 font-semibold cursor-pointer select-none">
                        I understand this batch is full and wish to proceed with enrollment
                      </label>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Initial Skills (comma sep)</label>
                  <input 
                    type="text" 
                    value={studentForm.skills}
                    onChange={(e) => setStudentForm({...studentForm, skills: e.target.value})}
                    placeholder="HTML, CSS, Git"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Outstanding Fees (₹)</label>
                  <input 
                    type="number" 
                    value={studentForm.outstandingBalance}
                    onChange={(e) => setStudentForm({...studentForm, outstandingBalance: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COURSE FORM MODAL */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              {editingCourse ? 'Edit Program Blueprint' : 'Define New Course Blueprint'}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Course Code</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.code}
                    onChange={(e) => setCourseForm({...courseForm, code: e.target.value})}
                    placeholder="e.g. SMA-ADWDVC"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Coordinator</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.coordinator}
                    onChange={(e) => setCourseForm({...courseForm, coordinator: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Program Title</label>
                <input 
                  type="text" 
                  required
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({...courseForm, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Description Outlines</label>
                <textarea 
                  rows={3}
                  required
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Duration</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.duration}
                    onChange={(e) => setCourseForm({...courseForm, duration: e.target.value})}
                    placeholder="e.g. 12 Months"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Classification</label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm({...courseForm, level: e.target.value as any})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                    <option value="DIPLOMA">DIPLOMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Mode</label>
                  <select
                    value={courseForm.mode}
                    onChange={(e) => setCourseForm({...courseForm, mode: e.target.value as any})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200"
                  >
                    <option value="PHYSICAL">PHYSICAL</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Academy Fee (₹)</label>
                  <input 
                    type="number" 
                    required
                    value={courseForm.fee}
                    onChange={(e) => setCourseForm({...courseForm, fee: Number(e.target.value)})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Eligibility criteria</label>
                  <input 
                    type="text" 
                    required
                    value={courseForm.eligibility}
                    onChange={(e) => setCourseForm({...courseForm, eligibility: e.target.value})}
                    placeholder="Graduate / 10th standard"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Save Blueprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
