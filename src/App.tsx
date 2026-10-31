/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  SwanayaDatabase, User, Student, Course, Batch, Instructor, Invoice, 
  Lead, AdmissionApplication, Notification, AuditLog, AcademySettings, Project, Certificate, ClassSchedule, Semester, Subject 
} from './db/mockDb';

import PublicLanding from './components/PublicLanding';
import RoleSwitcher from './components/RoleSwitcher';
import CertificateVerifyPublic from './components/CertificateVerifyPublic';
import StudentPortfolioPublic from './components/StudentPortfolioPublic';
import AuthGateway from './components/AuthGateway';

import AdminPortal from './components/AdminPortal';
import InstructorPortal from './components/InstructorPortal';
import StudentPortal from './components/StudentPortal';
import FinancePortal from './components/FinancePortal';
import CounsellorPortal from './components/CounsellorPortal';
import CareerPortal from './components/CareerPortal';
import ParentPortal from './components/ParentPortal';
import SettingsAuditPortal from './components/SettingsAuditPortal';
import StudentAiAssistant from './components/StudentAiAssistant';
import ExaminationAnnouncementBar from './components/ExaminationAnnouncementBar';
import ExaminationSessionPortal from './components/ExaminationSessionPortal';

import { 
  Home, Users, BookOpen, Layers, Calendar, ClipboardCheck, 
  FileText, Award, Briefcase, DollarSign, Settings, ShieldAlert,
  Bell, LogOut, Menu, X, ArrowLeft, ArrowUpRight, Sparkles, GraduationCap, CheckCircle2, AlertTriangle 
} from 'lucide-react';

export default function App() {
  // Initialize standard local db on boot
  useEffect(() => {
    SwanayaDatabase.init();
  }, []);

  // Application general views
  // 'landing' | 'login' | 'verify' | 'portfolio' | 'portal'
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'verify' | 'portfolio' | 'portal'>('login');
  
  // Parameterized sub-view states
  const [selectedVerifyCertId, setSelectedVerifyCertId] = useState<string>('');
  const [selectedPortfolioStudent, setSelectedPortfolioStudent] = useState<Student | null>(null);

  // Quick-Access Modal States (New focused features!)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSchedModalOpen, setIsSchedModalOpen] = useState(false);

  // Fast Student Enrollment Form State & Capacity Verification
  const [fastStudent, setFastStudent] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: 'c-1',
    batchId: 'b-1'
  });
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [fastEnrollOverrideConfirmed, setFastEnrollOverrideConfirmed] = useState(false);
  const [fastEnrollCapacityWarning, setFastEnrollCapacityWarning] = useState<string | null>(null);

  // Reactive DB states for quick modals
  const [batchesList, setBatchesList] = useState<Batch[]>(() => SwanayaDatabase.get<Batch[]>("batches"));
  const [studentsList, setStudentsList] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [coursesList, setCoursesList] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [subjectsList, setSubjectsList] = useState<Subject[]>(() => SwanayaDatabase.get<Subject[]>("subjects"));

  // Fast Batch Scheduler Form State
  const [fastSchedule, setFastSchedule] = useState({
    courseId: 'c-1',
    batchId: 'b-1',
    subjectId: 'sub-101',
    date: '2026-10-05',
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    room: 'Lab Alpha (2nd Floor)',
    type: 'HYBRID' as 'PHYSICAL' | 'ONLINE' | 'HYBRID' | 'WORKSHOP' | 'LAB' | 'HACKATHON'
  });
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Report Export State
  const [exportingReport, setExportingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Users & Active User states (Requires authentication on login first)
  const [users, setUsers] = useState<User[]>(() => SwanayaDatabase.get<User[]>("users"));
  const [activeUser, setActiveUser] = useState<User | null>(null);

  // Re-fetch reactive states to update widgets instantly across CRUDs
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleRefreshAllData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    setBatchesList(SwanayaDatabase.get<Batch[]>("batches"));
    setStudentsList(SwanayaDatabase.get<Student[]>("students"));
    setCoursesList(SwanayaDatabase.get<Course[]>("courses"));
    setSubjectsList(SwanayaDatabase.get<Subject[]>("subjects"));
  }, [refreshTrigger, isEnrollModalOpen, isSchedModalOpen]);

  // Submit Fast Student Enrollment
  const handleFastEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastStudent.name || !fastStudent.email) return;

    // Check target batch capacity
    const curBatches = SwanayaDatabase.get<Batch[]>("batches");
    const curStudents = SwanayaDatabase.get<Student[]>("students");
    const targetBatch = curBatches.find(b => b.id === fastStudent.batchId);
    const enrolledCount = curStudents.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
    const maxCapacity = targetBatch?.maxCapacity ?? 30;

    if (enrolledCount >= maxCapacity && !fastEnrollOverrideConfirmed) {
      setFastEnrollCapacityWarning(`⚠️ Target Batch Full: ${targetBatch?.name || 'Selected batch'} has reached its capacity limit of ${maxCapacity} students (${enrolledCount}/${maxCapacity} filled). Please check the confirmation box below to proceed.`);
      return;
    }

    setFastEnrollCapacityWarning(null);
    setEnrollSuccess(true);
    setTimeout(() => {
      const listStudents = SwanayaDatabase.get<Student[]>("students");
      const listUsers = SwanayaDatabase.get<User[]>("users");
      const listSems = SwanayaDatabase.get<Semester[]>("semesters");

      const studentIdCode = `SMA-2026-${Math.floor(100 + Math.random() * 900)}`;
      const admissionNum = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const targetSem = listSems.find(s => s.courseId === fastStudent.courseId)?.id || 's-1-1';

      const newStudent: Student = {
        id: `stud-${Date.now()}`,
        studentId: studentIdCode,
        admissionNumber: admissionNum,
        userId: `usr-${Date.now()}`,
        name: fastStudent.name,
        email: fastStudent.email,
        phone: fastStudent.phone || '+91 94460 11223',
        guardianName: 'Self / Guardian',
        guardianPhone: '+91 94460 00000',
        academicBackground: 'Fast Enrollment Entry',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fastStudent.name}`,
        status: 'ACTIVE',
        courseId: fastStudent.courseId,
        batchId: fastStudent.batchId,
        semesterId: targetSem,
        enrollmentDate: new Date().toISOString().split('T')[0],
        skills: ['Fast Track'],
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: 145000,
        careerReadinessScore: 40
      };

      const newUser: User = {
        id: newStudent.userId,
        email: fastStudent.email,
        name: fastStudent.name,
        role: 'STUDENT',
        avatarUrl: newStudent.avatarUrl,
        status: 'ACTIVE',
        createdAt: newStudent.enrollmentDate
      };

      SwanayaDatabase.set("students", [...listStudents, newStudent]);
      SwanayaDatabase.set("users", [...listUsers, newUser]);

      SwanayaDatabase.log(activeUser?.email || 'admin@swanayamedia.com', activeUser?.name || 'Administrator', "STUDENT_FAST_ENROLL", `Fast Enroll: ${fastStudent.name}`);
      
      setEnrollSuccess(false);
      setIsEnrollModalOpen(false);
      setFastStudent({ name: '', email: '', phone: '', courseId: 'c-1', batchId: 'b-1' });
      handleRefreshAllData();
    }, 1500);
  };

  // Submit Fast Class Batch Scheduling
  const handleFastScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleSuccess(true);
    setTimeout(() => {
      const listClasses = SwanayaDatabase.get<ClassSchedule[]>("classes");
      
      const newClass: ClassSchedule = {
        id: `cls-${Date.now()}`,
        courseId: fastSchedule.courseId,
        batchId: fastSchedule.batchId,
        subjectId: fastSchedule.subjectId,
        instructorId: 'inst-1', // Default instructor
        date: fastSchedule.date,
        startTime: fastSchedule.startTime,
        endTime: fastSchedule.endTime,
        room: fastSchedule.room,
        meetingLink: fastSchedule.type === 'ONLINE' || fastSchedule.type === 'HYBRID' ? 'https://zoom.us/j/944600123' : undefined,
        type: fastSchedule.type
      };

      SwanayaDatabase.set("classes", [...listClasses, newClass]);
      SwanayaDatabase.log(activeUser?.email || 'admin@swanayamedia.com', activeUser?.name || 'Administrator', "BATCH_FAST_SCHEDULE", `Scheduled Hour/Class for subject: ${fastSchedule.subjectId}`);
      
      setScheduleSuccess(false);
      setIsSchedModalOpen(false);
      setScheduleSuccess(false);
      handleRefreshAllData();
    }, 1500);
  };

  // Submit Fast Report Export
  const handleExportReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExportingReport(true);
    setTimeout(() => {
      setExportingReport(false);
      setReportSuccess(true);
      SwanayaDatabase.log(activeUser?.email || 'admin@swanayamedia.com', activeUser?.name || 'Administrator', "REPORT_FAST_EXPORT", "Generated academic ledger summary PDF");
      setTimeout(() => {
        setReportSuccess(false);
        setIsReportModalOpen(false);
      }, 2000);
    }, 1500);
  };

  // Synchronize users and active student/instructor contexts
  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [settings, setSettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>("settings"));
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setStudents(SwanayaDatabase.get<Student[]>("students"));
    setInstructors(SwanayaDatabase.get<Instructor[]>("instructors"));
    setSettings(SwanayaDatabase.get<AcademySettings>("settings"));
    setUsers(SwanayaDatabase.get<User[]>("users"));
    
    // Filter notifications for active user
    if (activeUser) {
      const list = SwanayaDatabase.get<Notification[]>("notifications");
      setNotifications(list.filter(n => n.userId === activeUser.id || activeUser.role === 'SUPER_ADMIN'));
    } else {
      setNotifications([]);
    }
  }, [activeUser, refreshTrigger]);

  // Find respective active student or instructor object matching active logged in user
  const activeStudentProfile = activeUser ? (students.find(s => s.userId === activeUser.id) || students[0]) : null;
  const activeInstructorProfile = activeUser ? (instructors.find(i => i.userId === activeUser.id) || instructors[0]) : null;

  // CRM submissions triggers from landing form
  const handleApplyFromLanding = (leadData: { name: string; email: string; phone: string; courseId: string; qualification: string; preferredBatch: string; message: string }) => {
    // Write new Application Record
    const apps = SwanayaDatabase.get<AdmissionApplication[]>("applications");
    const newApp: AdmissionApplication = {
      id: `app-${Date.now()}`,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      courseId: leadData.courseId,
      qualification: leadData.qualification,
      preferredBatch: leadData.preferredBatch,
      message: leadData.message,
      status: 'NEW',
      leadSource: 'Website Application Form',
      createdAt: new Date().toISOString().split('T')[0]
    };
    SwanayaDatabase.set("applications", [newApp, ...apps]);

    // Write new Lead Record in CRM pipeline
    const leads = SwanayaDatabase.get<Lead[]>("leads");
    const newLead: Lead = {
      id: `ld-${Date.now()}`,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      courseId: leadData.courseId,
      source: 'Website Application Form',
      status: 'NEW',
      notes: leadData.message || 'Submitted online admission form.',
      assignedTo: 'usr-counsel',
      createdAt: newApp.createdAt
    };
    SwanayaDatabase.set("leads", [newLead, ...leads]);

    // Send a system notification to Counselors
    const notificationsList = SwanayaDatabase.get<Notification[]>("notifications");
    const newNot: Notification = {
      id: `not-${Date.now()}`,
      userId: 'usr-counsel',
      title: 'New Admission Application',
      message: `${leadData.name} submitted an enrollment proposal for ${leadData.preferredBatch}.`,
      type: 'INFO',
      read: false,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    SwanayaDatabase.set("notifications", [newNot, ...notificationsList]);

    SwanayaDatabase.log("guest@swanaya.com", leadData.name, "ADMISSION_APPLY_ONLINE", `Applied for Course: ${leadData.courseId}`);
    handleRefreshAllData();
  };

  // Navigation Sidemenu logic (Dynamic depending on active role)
  // 'overview' | 'students' | 'courses' | 'curriculum' | 'attendance' | 'assignments' | 'projects' | 'finance' | 'cRM' | 'career' | 'settings'
  const [activePortalTab, setActivePortalTab] = useState<string>('overview');

  // Triggered when RoleSwitcher changes user context
  const handleSelectUser = (user: User) => {
    setActiveUser(user);
    // Reset active portal tab to matching first access entry
    if (user.role === 'STUDENT') {
      setActivePortalTab('overview');
    } else if (user.role === 'INSTRUCTOR') {
      setActivePortalTab('attendance');
    } else if (user.role === 'FINANCE') {
      setActivePortalTab('finance');
    } else if (user.role === 'COUNSELLOR') {
      setActivePortalTab('cRM');
    } else if (user.role === 'CAREER') {
      setActivePortalTab('career');
    } else if (user.role === 'PARENT') {
      setActivePortalTab('parent');
    } else {
      setActivePortalTab('overview');
    }
  };

  // Notification clear action
  const handleMarkNotificationsRead = () => {
    if (!activeUser) return;
    const list = SwanayaDatabase.get<Notification[]>("notifications");
    const updated = list.map(n => n.userId === activeUser.id || activeUser.role === 'SUPER_ADMIN' ? { ...n, read: true } : n);
    SwanayaDatabase.set("notifications", updated);
    handleRefreshAllData();
  };

  // Mobile menu expand
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Render main core layout depending on current overall navigation view
  if (currentView === 'landing') {
    const listCourses = SwanayaDatabase.get<Course[]>("courses");
    return (
      <PublicLanding 
        courses={listCourses}
        onNavigateToPortal={() => {
          setCurrentView('login');
        }}
        onNavigateToVerify={(certId) => {
          setSelectedVerifyCertId(certId);
          setCurrentView('verify');
        }}
        onApplyLead={handleApplyFromLanding}
      />
    );
  }

  if (currentView === 'login' || !activeUser) {
    return (
      <AuthGateway 
        onLoginSuccess={(user) => {
          handleSelectUser(user);
          setCurrentView('portal');
        }}
        onBack={() => setCurrentView('landing')}
      />
    );
  }

  if (currentView === 'verify') {
    return (
      <CertificateVerifyPublic 
        initialCertId={selectedVerifyCertId}
        onBack={() => {
          setSelectedVerifyCertId('');
          setCurrentView('landing');
        }}
      />
    );
  }

  if (currentView === 'portfolio' && selectedPortfolioStudent) {
    const listProjects = SwanayaDatabase.get<Project[]>("projects");
    const listCerts = SwanayaDatabase.get<Certificate[]>("certificates");
    const listHacks = SwanayaDatabase.get<any[]>("hackathonRegistrations");
    return (
      <StudentPortfolioPublic 
        student={selectedPortfolioStudent}
        projects={listProjects}
        certificates={listCerts}
        hackathons={listHacks}
        onBack={() => {
          setSelectedPortfolioStudent(null);
          setCurrentView('portal');
        }}
      />
    );
  }

  // --- SAAS ENTERPRISE WORKSPACE PORTAL LAYOUT ---
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans">
      
      {/* SaaS Premium Header Bar (1 Row, 3 Zones) - Rendered as a DIV so it is div:nth-of-type(1) */}
      <div className="sticky top-0 z-40 bg-[#0A0D14]/95 border-b border-slate-900 px-6 py-4 flex items-center justify-between backdrop-blur-md">
        
        {/* Zone 1: Branding Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Website
          </button>
          
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-base font-serif font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              {settings.logoText || "SWANAYA"}
            </span>
            <span className="text-[9px] tracking-widest text-slate-500 font-mono font-bold uppercase">
              ENTERPRISE PLATFORM
            </span>
          </div>
        </div>

        {/* Zone 2: Enterprise Notifications Center & Alerts */}
        <div className="flex items-center gap-6 shrink-0">
          
          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setNotifDropdownOpen(!notifDropdownOpen);
                if (!notifDropdownOpen) handleMarkNotificationsRead();
              }}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[#0A0D14]"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {notifDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 p-3 max-h-96 overflow-y-auto">
                  <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase pb-2 border-b border-slate-850 mb-2 font-mono">
                    Academy Alerts Inbox
                  </p>
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2 bg-slate-900/60 rounded text-xs space-y-1 border border-slate-850">
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                          <span>{n.createdAt}</span>
                          <span className="text-amber-500 font-bold">{n.type}</span>
                        </div>
                        <p className="font-semibold text-slate-200">{n.title}</p>
                        <p className="text-[11px] text-slate-400 leading-normal">{n.message}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-6">No new alerts.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active User Indicator */}
          {activeUser && (
            <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-4 font-mono text-xs text-slate-400">
              <span>Logged in:</span>
              <strong className="text-slate-200">{activeUser.name}</strong>
            </div>
          )}

        </div>

        {/* Zone 3: Interactive Role Switcher & Action buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {activeUser && (
            <RoleSwitcher 
              users={users}
              activeUser={activeUser}
              onSelectUser={handleSelectUser}
            />
          )}

          <button 
            onClick={() => {
              setActiveUser(null);
              setCurrentView('login');
            }}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer"
            title="Logout and Exit to Authentication Login"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile navigation toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Subheader Utility Announcement - Rendered as a DIV so it becomes div:nth-of-type(2) */}
      <div className="bg-slate-950 border-b border-slate-900 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Swanaya Media Academy - ERP & LMS Active Session</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`https://wa.me/${(settings.adminWhatsAppPhone || "+91 94460 12345").replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent("Hello Admin! I need support regarding Swanaya Media Academy.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded text-[11px] font-bold font-mono transition-colors flex items-center gap-1.5"
            title="Direct WhatsApp access to Admin Desk"
          >
            <span>💬 WhatsApp Admin ({settings.adminWhatsAppPhone || "+91 94460 12345"})</span>
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          </a>
          <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-slate-500 border-l border-slate-800 pl-3">
            <span>TERM: OCT-DEC 2026</span>
            <span>SECURE HANDSHAKE: COMPLIANT</span>
          </div>
        </div>
      </div>

      {/* Live Examination Session Announcement & Ticker Bar */}
      <ExaminationAnnouncementBar 
        currentUser={activeUser}
        onOpenExamSession={(sessionId) => {
          setActivePortalTab('exam');
        }}
        onRefresh={handleRefreshAllData}
      />

      {/* Sidebar & Workspace layout wrapper - Rendered as a DIV so it is div:nth-of-type(3) */}
      <div className="flex-grow flex flex-col md:flex-row relative">
        
        {/* SIDEBAR NAVIGATION PANEL (Strict Role Restricted Permission gates) */}
        <aside className={`w-full md:w-64 bg-[#0A0D14]/90 border-r border-slate-900 flex flex-col shrink-0 md:sticky md:top-[64px] md:h-[calc(100vh-64px)] transition-all ${
          mobileMenuOpen ? 'block' : 'hidden md:flex'
        }`}>
          <div className="p-4 space-y-1.5 flex-grow overflow-y-auto">
            <p className="text-[9px] font-bold tracking-widest text-slate-600 uppercase font-mono px-3 mb-2">
              Syllabus & ERP Modules
            </p>

            {/* SUPER_ADMIN, MD, ADMIN, ACADEMIC_ADMIN, REVIEWER navigation elements */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'REVIEWER') && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('overview'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'overview' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Home className="w-4 h-4 text-amber-500" />
                  Performance Overview
                </button>

                <button 
                  onClick={() => { setActivePortalTab('students'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'students' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 text-amber-500" />
                  Academy Students
                </button>

                <button 
                  onClick={() => { setActivePortalTab('courses'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'courses' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  Syllabus Blueprints
                </button>
              </>
            )}

            {/* ACADEMIC INSTRUCTOR portal access */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER') && (
              <>
                <button 
                  onClick={() => { setActivePortalTab('attendance'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'attendance' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 text-amber-500" />
                  Class Attendance
                </button>

                <button 
                  onClick={() => { setActivePortalTab('assignments'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    activePortalTab === 'assignments' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 text-amber-500" />
                  Assignments Hub
                </button>
              </>
            )}

            {/* ADMISSIONS COUNSELLOR CRM access */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'COUNSELLOR') && (
              <button 
                onClick={() => { setActivePortalTab('cRM'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'cRM' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 text-amber-500" />
                Admissions CRM
              </button>
            )}

            {/* STUDENT & ALUMNI PORTAL navigation widgets */}
            {(activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') && activeStudentProfile && (
              <button 
                onClick={() => { setActivePortalTab('student'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'student' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-amber-500" />
                {activeUser.role === 'ALUMNI' ? 'Alumni Graduate Classroom' : 'My Study Classroom'}
              </button>
            )}

            {/* PARENT / GUARDIAN PORTAL navigation */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'PARENT' || activeUser.role === 'REVIEWER') && (
              <button 
                onClick={() => { setActivePortalTab('parent'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'parent' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-amber-500" />
                Parent & Guardian Portal
              </button>
            )}

            {/* EXAM SESSIONS & MULTIMEDIA HUB */}
            <button 
              onClick={() => { setActivePortalTab('exam'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activePortalTab === 'exam' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              Exams & Media Hub
            </button>

            {/* CAREER & PLACEMENTS HUB */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'CAREER' || activeUser.role === 'REVIEWER') && (
              <button 
                onClick={() => { setActivePortalTab('career'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'career' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4 text-amber-500" />
                Placements Hub
              </button>
            )}

            {/* FINANCE fees & invoicing registry */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'FINANCE') && (
              <button 
                onClick={() => { setActivePortalTab('finance'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'finance' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4 text-amber-500" />
                Receipts Ledger
              </button>
            )}

            {/* SYSTEM CONFIGURATION & AUDITS */}
            {(activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD') && (
              <button 
                onClick={() => { setActivePortalTab('settings'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activePortalTab === 'settings' ? 'bg-amber-500/10 border-l-2 border-amber-500 text-amber-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 text-amber-500" />
                System Configurations
              </button>
            )}

          </div>

          {/* User Profile Footer section in Sidebar */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/40 flex items-center gap-3">
            <img 
              src={activeUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.name}`} 
              alt={activeUser.name} 
              className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800"
            />
            <div className="truncate text-left">
              <p className="text-xs font-bold text-slate-200 truncate">{activeUser.name}</p>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500 block">
                {activeUser.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        </aside>

        {/* WORKSPACE CONTENT FIELD - Rendered as a DIV so it is div:nth-of-type(1) inside div:nth-of-type(3) */}
        <div className="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          
          {/* Dashboard primary content area - Rendered as a DIV so it matches div#root > div > div:nth-of-type(3) > div > div */}
          <div className="space-y-6">



            {/* ACTIVE PORTAL TAB SWITCHER */}
            {activePortalTab === 'overview' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'ADMIN' || activeUser.role === 'ACADEMIC_ADMIN' || activeUser.role === 'REVIEWER') && (
              <AdminPortal 
                activeRole={activeUser.role as any}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'students' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'ADMIN' || activeUser.role === 'REVIEWER') && (
              <AdminPortal 
                activeRole={activeUser.role as any}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'courses' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'ADMIN' || activeUser.role === 'REVIEWER') && (
              <AdminPortal 
                activeRole={activeUser.role as any}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'attendance' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER') && activeInstructorProfile && (
              <InstructorPortal 
                instructorUser={activeInstructorProfile}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'assignments' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'INSTRUCTOR' || activeUser.role === 'REVIEWER') && activeInstructorProfile && (
              <InstructorPortal 
                instructorUser={activeInstructorProfile}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'cRM' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'COUNSELLOR') && (
              <CounsellorPortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'student' && (activeUser.role === 'STUDENT' || activeUser.role === 'ALUMNI') && activeStudentProfile && (
              <StudentPortal 
                studentUser={activeStudentProfile}
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
                onNavigateToVerify={(certId) => {
                  setSelectedVerifyCertId(certId);
                  setCurrentView('verify');
                }}
              />
            )}

            {/* PARENT / GUARDIAN PORTAL RENDER */}
            {activePortalTab === 'parent' && (
              <ParentPortal 
                parentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {/* EXAM SESSION & MULTIMEDIA HUB RENDER */}
            {activePortalTab === 'exam' && (
              <ExaminationSessionPortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'career' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'CAREER' || activeUser.role === 'REVIEWER') && (
              <CareerPortal 
                onSelectPortfolio={(student) => {
                  setSelectedPortfolioStudent(student);
                  setCurrentView('portfolio');
                }}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'finance' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD' || activeUser.role === 'FINANCE') && (
              <FinancePortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

            {activePortalTab === 'settings' && (activeUser.role === 'SUPER_ADMIN' || activeUser.role === 'MD') && (
              <SettingsAuditPortal 
                currentUser={activeUser}
                onRefreshAllData={handleRefreshAllData}
              />
            )}

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* QUICK-ACCESS SYSTEM MODAL OVERLAYS (Integrated with real local DB triggers!) */}
      {/* ========================================================================= */}

      {/* QUICK MODAL 1: GENERATE SYSTEM REPORT */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider block">EXECUTIVE LEDGER AUDITOR</span>
              <h3 className="text-base font-serif font-bold text-white">Generate Academic Performance Report</h3>
              <p className="text-[11px] text-slate-500">Compiles students enrollment stats, overall attendance registers, and overdue balance ledgers into a secure analytical report.</p>
            </div>

            <form onSubmit={handleExportReportSubmit} className="space-y-4">
              {reportSuccess ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Analysis Completed Successfully!</p>
                  <p className="text-[11px] text-slate-400">PDF generated and logged to the global system audit ledger.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Target Cohort Group</label>
                    <select className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200">
                      <option value="all">All Academy Students & Programs</option>
                      <option value="c-1">Advanced Diploma in Web Dev (SMA-ADWDVC)</option>
                      <option value="c-2">Diploma in AI Media Production (SMA-DAIMPIDM)</option>
                      <option value="c-3">AI & Business Communication (SMA-AIBC)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Report Analytics Depth</label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <label className="p-2.5 bg-slate-900 border border-slate-850 rounded flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-amber-500" />
                        <span>Attendance Rates</span>
                      </label>
                      <label className="p-2.5 bg-slate-900 border border-slate-850 rounded flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-amber-500" />
                        <span>Grading Ledger</span>
                      </label>
                      <label className="p-2.5 bg-slate-900 border border-slate-850 rounded flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-amber-500" />
                        <span>Admissions Funnel</span>
                      </label>
                      <label className="p-2.5 bg-slate-900 border border-slate-850 rounded flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-amber-500" />
                        <span>Outstanding Dues</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(false)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={exportingReport}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded cursor-pointer transition-colors shadow-md shadow-amber-500/10 flex items-center gap-1.5"
                    >
                      {exportingReport ? 'Running Analyzer...' : 'Compile Audit PDF'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 2: FAST NEW STUDENT ENROLLMENT */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsEnrollModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider block">ACADEMIC REGISTRAR</span>
              <h3 className="text-base font-serif font-bold text-white">Fast-Track Student Enrollment</h3>
              <p className="text-[11px] text-slate-500">Quickly register a new scholar and instantly deploy their default LMS database account.</p>
            </div>

            <form onSubmit={handleFastEnrollSubmit} className="space-y-4">
              {fastEnrollCapacityWarning && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Capacity Exceeded Notice</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{fastEnrollCapacityWarning}</p>
                </div>
              )}

              {enrollSuccess ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Enrollment Authorized!</p>
                  <p className="text-[11px] text-slate-400">Student and User database profile initialized in local storage.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Scholar Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={fastStudent.name}
                        onChange={(e) => setFastStudent({ ...fastStudent, name: e.target.value })}
                        placeholder="e.g. Rahul Nair"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={fastStudent.email}
                        onChange={(e) => setFastStudent({ ...fastStudent, email: e.target.value })}
                        placeholder="name@gmail.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Contact Number</label>
                      <input 
                        type="text" 
                        value={fastStudent.phone}
                        onChange={(e) => setFastStudent({ ...fastStudent, phone: e.target.value })}
                        placeholder="+91 94460 12345"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Syllabus Program</label>
                      {coursesList.length === 0 ? (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
                          ⚠️ No courses created yet. Admin must add courses before fast enrollment.
                        </div>
                      ) : (
                        <select 
                          value={fastStudent.courseId}
                          onChange={(e) => setFastStudent({ ...fastStudent, courseId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                        >
                          {coursesList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Target Cohort Batch</label>
                        {(() => {
                          const selBatch = batchesList.find(b => b.id === fastStudent.batchId);
                          const count = studentsList.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
                          const maxCap = selBatch?.maxCapacity ?? 30;
                          const isFull = count >= maxCap;
                          return (
                            <span className={`text-[9px] font-mono ${isFull ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                              {count}/{maxCap} {isFull ? 'FULL' : 'filled'}
                            </span>
                          );
                        })()}
                      </div>
                      <select 
                        value={fastStudent.batchId}
                        onChange={(e) => {
                          setFastStudent({ ...fastStudent, batchId: e.target.value });
                          setFastEnrollCapacityWarning(null);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      >
                        {batchesList.map(b => {
                          const count = studentsList.filter(s => s.batchId === b.id && s.status !== 'INACTIVE').length;
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
                  </div>

                  {/* BATCH CAPACITY WARNING BOX */}
                  {(() => {
                    const selBatch = batchesList.find(b => b.id === fastStudent.batchId);
                    const count = studentsList.filter(s => s.batchId === fastStudent.batchId && s.status !== 'INACTIVE').length;
                    const maxCap = selBatch?.maxCapacity ?? 30;
                    const isFull = count >= maxCap;

                    if (!isFull) return null;

                    return (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase tracking-wide">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>⚠️ Target Batch Full Warning</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          <strong className="text-amber-200">{selBatch?.name}</strong> has reached its maximum capacity limit of <strong className="font-mono text-amber-400">{maxCap} students</strong> ({count}/{maxCap} filled).
                        </p>
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                          <input 
                            type="checkbox"
                            id="fastEnrollOverrideCheck"
                            checked={fastEnrollOverrideConfirmed}
                            onChange={(e) => setFastEnrollOverrideConfirmed(e.target.checked)}
                            className="w-3.5 h-3.5 accent-amber-500 cursor-pointer rounded"
                          />
                          <label htmlFor="fastEnrollOverrideCheck" className="text-[11px] text-amber-200 font-semibold cursor-pointer select-none">
                            I understand this batch is full and wish to proceed with enrollment
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEnrollModalOpen(false);
                        setFastEnrollCapacityWarning(null);
                        setFastEnrollOverrideConfirmed(false);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded cursor-pointer transition-colors shadow-md shadow-amber-500/10"
                    >
                      Issue Scholar Admission
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 3: BATCH HOUR SCHEDULER */}
      {isSchedModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsSchedModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider block">CLASSROOM COORDINATOR</span>
              <h3 className="text-base font-serif font-bold text-white">Schedule Batch Hourly Session</h3>
              <p className="text-[11px] text-slate-500">Configure custom daily time slots, assign rooms, and provision online study room links dynamically.</p>
            </div>

            <form onSubmit={handleFastScheduleSubmit} className="space-y-4">
              {scheduleSuccess ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-center space-y-2 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">Session Registered & Synced!</p>
                  <p className="text-[11px] text-slate-400">Batch timetable updated. Notification dispatched to students.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Target Batch</label>
                      <select 
                        value={fastSchedule.batchId}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, batchId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="b-1">Web Dev Elite Batch A</option>
                        <option value="b-2">Integrated Marketing Cohort B</option>
                        <option value="b-3">AI Business Weekend</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Course Syllabus</label>
                      {coursesList.length === 0 ? (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
                          No active courses available.
                        </div>
                      ) : (
                        <select 
                          value={fastSchedule.courseId}
                          onChange={(e) => setFastSchedule({ ...fastSchedule, courseId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                        >
                          {coursesList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Subject Paper</label>
                    {subjectsList.length === 0 ? (
                      <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
                        No subjects published yet.
                      </div>
                    ) : (
                      <select 
                        value={fastSchedule.subjectId}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, subjectId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      >
                        {subjectsList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Physical Room Lab</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.room}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, room: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Session Mode</label>
                      <select 
                        value={fastSchedule.type}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, type: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="HYBRID">Hybrid Broadcast</option>
                        <option value="PHYSICAL">Physical Attendance only</option>
                        <option value="ONLINE">Zoom Streaming Link</option>
                        <option value="LAB">Concept Sandbox Laboratory</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Date</label>
                      <input 
                        type="date" 
                        required
                        value={fastSchedule.date}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, date: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs text-slate-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Start Time</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.startTime}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, startTime: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs text-slate-100 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">End Time</label>
                      <input 
                        type="text" 
                        required
                        value={fastSchedule.endTime}
                        onChange={(e) => setFastSchedule({ ...fastSchedule, endTime: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-2 text-xs text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsSchedModalOpen(false)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded cursor-pointer transition-colors shadow-md shadow-amber-500/10"
                    >
                      Deploy Hour Slot
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* DeepSeek V4.1 Flash AI Student Learning Assistant Widget */}
      <StudentAiAssistant 
        studentName={activeUser.name} 
        courseName={activeStudentProfile ? "Digital Media & Web Development" : undefined} 
      />

    </div>
  );
}
