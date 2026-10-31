/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Types & Database Schema
export type UserRole =
  | 'SUPER_ADMIN'
  | 'MD'
  | 'ADMIN'
  | 'ACADEMIC_ADMIN'
  | 'INSTRUCTOR'
  | 'STUDENT'
  | 'ALUMNI'
  | 'REVIEWER'
  | 'FINANCE'
  | 'COUNSELLOR'
  | 'CAREER'
  | 'PARENT';

export interface User {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  isVerified?: boolean;
  studentIds?: string[];
  guardianPin?: string;
  whatsappPhone?: string;
  whatsappOptIn?: boolean;
  preferredCourseId?: string;
}

export interface Student {
  id: string; // matches user id or unique
  studentId: string; // e.g., SMA-2026-001
  admissionNumber: string; // e.g., ADM-2026-4012
  userId: string;
  name: string;
  email: string;
  phone: string;
  whatsappPhone?: string;
  whatsappOptIn?: boolean;
  guardianName: string;
  guardianPhone: string;
  academicBackground: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  courseId: string;
  batchId: string;
  semesterId: string;
  enrollmentDate: string;
  skills: string[];
  projectsCount: number;
  certificatesCount: number;
  attendancePercentage: number;
  outstandingBalance: number;
  careerReadinessScore: number;
}

export interface Instructor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  experience: string;
  bio: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  assignedSubjects: string[]; // Subject IDs
}

export interface Course {
  id: string;
  code: string; // e.g. SMA-ADWDVC
  name: string;
  description: string;
  duration: string; // e.g. "12 Months"
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'DIPLOMA';
  eligibility: string;
  fee: number; // in INR
  mode: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  status: 'ACTIVE' | 'ARCHIVED';
  thumbnailUrl: string;
  coordinator: string;
  learningObjectives: string[];
  careerOutcomes: string[];
}

export interface Semester {
  id: string;
  courseId: string;
  name: string; // e.g., Semester 1, Semester 2
  code: string;
}

export interface Subject {
  id: string;
  semesterId: string;
  code: string;
  name: string;
  credits: number;
  hours: number;
  description: string;
  learningOutcomes: string[];
  instructorId: string;
  assessmentMethod: string;
}

export interface Lesson {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string; // Attached PDF name
  duration: string; // e.g., 45 mins
}

export interface Batch {
  id: string;
  name: string;
  code: string;
  courseId: string;
  startDate: string;
  endDate: string;
  schedule: string; // e.g., "Mon, Wed, Fri (10 AM - 1 PM)"
  instructorId: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  maxCapacity?: number;
}

export interface ClassSchedule {
  id: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  instructorId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  meetingLink?: string;
  type: 'PHYSICAL' | 'ONLINE' | 'HYBRID' | 'WORKSHOP' | 'LAB' | 'HACKATHON';
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  date: string;
  hour: number; // Hourly tracking (e.g. Hour 1, Hour 2, Hour 3, Hour 4)
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  deadline: string;
  maxMarks: number;
  attachmentUrl?: string;
  submissionType: 'FILE' | 'LINK' | 'TEXT';
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: string;
  content: string; // description, link or file name
  fileUrl?: string;
  status: 'PENDING' | 'SUBMITTED' | 'LATE' | 'EVALUATED';
  marksObtained?: number;
  feedback?: string;
  gradedBy?: string;
}

export interface Exam {
  id: string;
  name: string;
  courseId: string;
  semesterId: string;
  subjectId: string;
  date: string;
  duration: string;
  maxMarks: number;
  passingMarks: number;
  type: 'INTERNAL' | 'EXTERNAL' | 'SEM_FINAL' | 'QUIZ' | 'PRACTICAL' | 'PROJECT_EVAL' | 'VIVA';
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  grade: string; // A+, A, B+, B, C, D, F
  pass: boolean;
  remarks: string;
  gradedBy: string;
}

export interface ExamAnnouncement {
  id: string;
  title: string;
  message: string;
  urgent: boolean;
  date: string;
  courseId?: string;
  batchId?: string;
  examId?: string;
  pdfUrl?: string;
  slidesUrl?: string;
  youtubeUrl?: string;
  active: boolean;
}

export interface ExamStudentSubmission {
  studentId: string;
  studentName: string;
  submittedAt: string;
  answerText: string;
  answerFileUrl?: string;
  marksObtained?: number;
  graded: boolean;
  feedback?: string;
}

export interface ExamSession {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  courseId: string;
  batchId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  pdfQuestionPaperUrl?: string;
  pdfQuestionPaperName?: string;
  slidesEmbedUrl?: string;
  youtubeVideoUrl?: string;
  instructions: string[];
  studentSubmissions?: ExamStudentSubmission[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  studentId: string;
  instructorId: string;
  semesterId: string;
  startDate: string;
  deadline: string;
  repoUrl?: string;
  liveUrl?: string;
  documentationUrl?: string;
  status: 'IDEA' | 'APPROVED' | 'DEVELOPMENT' | 'REVIEW' | 'COMPLETED';
  score?: number;
  feedback?: string;
}

export interface Hackathon {
  id: string;
  name: string;
  theme: string;
  description: string;
  date: string;
  duration: string; // e.g., 48 Hours
  location: string;
  mode: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  registrationDeadline: string;
  prizes: string[];
  rules: string[];
}

export interface HackathonRegistration {
  id: string;
  hackathonId: string;
  studentId: string;
  teamName: string;
  projectName?: string;
  projectDescription?: string;
  score?: number;
  rank?: string;
}

export interface Certificate {
  id: string; // Used as Certificate Verification ID
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  issueDate: string;
  completionDate: string;
  grade: string;
  type: 'COMPLETION' | 'DIPLOMA' | 'ADVANCED_DIPLOMA' | 'WORKSHOP' | 'ACHIEVEMENT';
  signatory: string;
  verificationUrl: string;
  qrCodeUrl?: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  courseId: string;
  amount: number;
  dueDate: string;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'REFUNDED';
  paidAmount: number;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    method: string;
    receiptNo: string;
  }>;
}

export interface AdmissionApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  courseId: string;
  qualification: string;
  preferredBatch: string;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'COUNSELLING' | 'APPLIED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'ENROLLED';
  leadSource: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  courseId: string;
  source: string; // Website, Social Media, WhatsApp, etc.
  status: 'NEW' | 'CONTACTED' | 'INTERESTED' | 'COUNSELLING' | 'APPLICATION' | 'CONVERTED' | 'LOST';
  notes: string;
  assignedTo: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // INFO, WARNING, SUCCESS, ERROR
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  userName: string;
  action: string;
  entity: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress: string;
}

export interface AcademySettings {
  academyName: string;
  logoText: string;
  address: string;
  phone: string;
  adminWhatsAppPhone: string;
  email: string;
  website: string;
  currency: string;
  timezone: string;
  language: string;
}

// Global Static Data / Fallback for Fresh Launch
export const INITIAL_SETTINGS: AcademySettings = {
  academyName: "Swanaya Media Academy",
  logoText: "SWANAYA",
  address: "Thiruvananthapuram, Kerala, India",
  phone: "+91 94460 00000",
  adminWhatsAppPhone: "+91 94460 12345",
  email: "academy@swanayamedia.com",
  website: "https://academy.swanayamedia.com",
  currency: "INR (₹)",
  timezone: "Asia/Kolkata",
  language: "English"
};

export const INITIAL_COURSES: Course[] = [];
export const INITIAL_SEMESTERS: Semester[] = [];
export const INITIAL_SUBJECTS: Subject[] = [];
export const INITIAL_LESSONS: Lesson[] = [];
export const INITIAL_BATCHES: Batch[] = [];

export const INITIAL_USERS: User[] = [
  { id: "usr-md", username: "aadithyan", email: "aadithyan.menon@swanayamedia.com", name: "AADITHYAN M MENON (MD)", role: "MD", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Adithyan", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-navven", username: "navven", email: "navven.admin@swanayamedia.com", name: "NAVVEN (Administrator)", role: "ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Naveen", status: "ACTIVE", createdAt: "2026-01-02", isVerified: true },
  { id: "usr-reviewer", username: "reviewer", email: "reviewer@swanayamedia.com", name: "Academic Reviewer", role: "REVIEWER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer", status: "ACTIVE", createdAt: "2026-01-05", isVerified: true },
  { id: "usr-alumni", username: "alumni", email: "alumni@swanayamedia.com", name: "Alumni Graduate", role: "ALUMNI", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alumni", status: "ACTIVE", createdAt: "2026-01-08", isVerified: true }
];

export const INITIAL_INSTRUCTORS: Instructor[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_CLASSES: ClassSchedule[] = [];
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_ASSIGNMENTS: Assignment[] = [];
export const INITIAL_SUBMISSIONS: Submission[] = [];
export const INITIAL_EXAMS: Exam[] = [];
export const INITIAL_EXAM_RESULTS: ExamResult[] = [];
export const INITIAL_PROJECTS: Project[] = [];
export const INITIAL_HACKATHONS: Hackathon[] = [];
export const INITIAL_HACKATHON_REGISTRATIONS: HackathonRegistration[] = [];
export const INITIAL_CERTIFICATES: Certificate[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_LEADS: Lead[] = [];
export const INITIAL_APPLICATIONS: AdmissionApplication[] = [];
export const INITIAL_NOTIFICATIONS: Notification[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_EXAM_ANNOUNCEMENTS: ExamAnnouncement[] = [
  {
    id: "ann-1",
    title: "🚨 Mid-Term Examination Session Live: Advanced Web Architecture",
    message: "The official online examination for Subject WD-102 (React & TypeScript) is now live! Please review the attached PDF Question Paper, slide deck guidelines, and video stream instructions.",
    urgent: true,
    date: new Date().toISOString().split('T')[0],
    pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
    youtubeUrl: "https://www.youtube.com/embed/gB1F9G0J48A",
    active: true
  }
];

export const INITIAL_EXAM_SESSIONS: ExamSession[] = [
  {
    id: "session-101",
    title: "Mid-Term Technical Examination: TypeScript & React Architecture",
    subjectCode: "JS-102",
    subjectName: "TypeScript & React Modern Architecture",
    courseId: "c-1",
    batchId: "b-1",
    scheduledDate: new Date().toISOString().split('T')[0],
    startTime: "10:00 AM",
    endTime: "01:00 PM",
    durationMinutes: 180,
    totalMarks: 100,
    passMarks: 50,
    status: "LIVE",
    pdfQuestionPaperUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    pdfQuestionPaperName: "JS-102_MidTerm_Question_Paper.pdf",
    slidesEmbedUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
    youtubeVideoUrl: "https://www.youtube.com/embed/gB1F9G0J48A",
    instructions: [
      "1. Ensure stable internet connection during the 3-hour examination window.",
      "2. Review the embedded PDF Question Paper and YouTube briefing video before starting.",
      "3. Refer to the official Google Slides revision deck if needed.",
      "4. Submit your answer text, code repository link, or answer sheet file URL in the submission box.",
      "5. Late submissions after 01:00 PM will incur a 10% penalty."
    ],
    studentSubmissions: []
  },
  {
    id: "session-102",
    title: "AI Media Production & Video Editing Practical Evaluation",
    subjectCode: "AI-201",
    subjectName: "AI Video & Media Production Sandbox",
    courseId: "c-2",
    batchId: "b-2",
    scheduledDate: "2026-11-10",
    startTime: "02:00 PM",
    endTime: "05:00 PM",
    durationMinutes: 180,
    totalMarks: 100,
    passMarks: 60,
    status: "SCHEDULED",
    pdfQuestionPaperUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    pdfQuestionPaperName: "AI-201_Practical_Task_Sheet.pdf",
    slidesEmbedUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
    youtubeVideoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    instructions: [
      "1. Render and upload a 60-second AI-generated short clip.",
      "2. Submit your project link and prompt sheet PDF.",
      "3. Physical presence in Lab Beta or online video link is mandatory."
    ],
    studentSubmissions: []
  }
];

// Helper database controller with localStorage sync
export class SwanayaDatabase {
  private static isInitializing = false;

  static init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!localStorage.getItem("sma_database_purged_suresh_v4")) {
        localStorage.setItem("sma_database_purged_suresh_v4", "true");
        this.clearAllPreloadedData();
      }

      const keys = {
        settings: INITIAL_SETTINGS,
        courses: [],
        semesters: [],
        subjects: [],
        lessons: [],
        batches: [],
        users: INITIAL_USERS,
        instructors: [],
        students: [],
        classes: [],
        attendance: [],
        assignments: [],
        submissions: [],
        exams: [],
        results: [],
        projects: [],
        hackathons: [],
        hackathonRegistrations: [],
        certificates: [],
        invoices: [],
        leads: [],
        applications: [],
        notifications: [],
        auditLogs: [],
        examAnnouncements: INITIAL_EXAM_ANNOUNCEMENTS,
        examSessions: INITIAL_EXAM_SESSIONS
      };

      Object.entries(keys).forEach(([key, defaultValue]) => {
        if (!localStorage.getItem(`sma_${key}`)) {
          localStorage.setItem(`sma_${key}`, JSON.stringify(defaultValue));
        }
      });
    } finally {
      this.isInitializing = false;
    }
  }

  static get<T>(key: string): T {
    this.init();
    const data = localStorage.getItem(`sma_${key}`);
    return data ? JSON.parse(data) : ([] as unknown as T);
  }

  static set(key: string, value: any) {
    localStorage.setItem(`sma_${key}`, JSON.stringify(value));
  }

  static log(userEmail: string, userName: string, action: string, entity: string, previousValue?: string, newValue?: string) {
    const logs = this.get<AuditLog[]>("auditLogs");
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      userEmail,
      userName,
      action,
      entity,
      previousValue,
      newValue,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: "127.0.0.1 (Local Session)"
    };
    this.set("auditLogs", [newLog, ...logs]);
  }

  static clearAllPreloadedData() {
    const defaultAdmins: User[] = [
      {
        id: "usr-md",
        username: "aadithyan",
        email: "aadithyan.menon@swanayamedia.com",
        name: "AADITHYAN M MENON (MD)",
        role: "MD",
        status: "ACTIVE",
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      },
      {
        id: "usr-navven",
        username: "navven",
        email: "navven.admin@swanayamedia.com",
        name: "NAVVEN (Administrator)",
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      },
      {
        id: "usr-reviewer",
        username: "reviewer",
        email: "reviewer@swanayamedia.com",
        name: "Academic Reviewer",
        role: "REVIEWER",
        status: "ACTIVE",
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      },
      {
        id: "usr-alumni",
        username: "alumni",
        email: "alumni@swanayamedia.com",
        name: "Alumni Graduate",
        role: "ALUMNI",
        status: "ACTIVE",
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      }
    ];

    localStorage.setItem("sma_courses", JSON.stringify([]));
    localStorage.setItem("sma_semesters", JSON.stringify([]));
    localStorage.setItem("sma_subjects", JSON.stringify([]));
    localStorage.setItem("sma_lessons", JSON.stringify([]));
    localStorage.setItem("sma_batches", JSON.stringify([]));
    localStorage.setItem("sma_users", JSON.stringify(defaultAdmins));
    localStorage.setItem("sma_instructors", JSON.stringify([]));
    localStorage.setItem("sma_students", JSON.stringify([]));
    localStorage.setItem("sma_classes", JSON.stringify([]));
    localStorage.setItem("sma_attendance", JSON.stringify([]));
    localStorage.setItem("sma_assignments", JSON.stringify([]));
    localStorage.setItem("sma_submissions", JSON.stringify([]));
    localStorage.setItem("sma_exams", JSON.stringify([]));
    localStorage.setItem("sma_results", JSON.stringify([]));
    localStorage.setItem("sma_projects", JSON.stringify([]));
    localStorage.setItem("sma_hackathons", JSON.stringify([]));
    localStorage.setItem("sma_hackathonRegistrations", JSON.stringify([]));
    localStorage.setItem("sma_certificates", JSON.stringify([]));
    localStorage.setItem("sma_invoices", JSON.stringify([]));
    localStorage.setItem("sma_leads", JSON.stringify([]));
    localStorage.setItem("sma_applications", JSON.stringify([]));
    localStorage.setItem("sma_notifications", JSON.stringify([]));
    
    const initialLog: AuditLog = {
      id: `log-${Date.now()}`,
      userEmail: "aadithyan.menon@swanayamedia.com",
      userName: "AADITHYAN M MENON (MD)",
      action: "DATA_CLEAR",
      entity: "Cleared preloaded content for fresh entry",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: "127.0.0.1 (Local Session)"
    };
    localStorage.setItem("sma_auditLogs", JSON.stringify([initialLog]));
  }

  static restoreDefaultData() {
    const keys = {
      settings: INITIAL_SETTINGS,
      courses: INITIAL_COURSES,
      semesters: INITIAL_SEMESTERS,
      subjects: INITIAL_SUBJECTS,
      lessons: INITIAL_LESSONS,
      batches: INITIAL_BATCHES,
      users: INITIAL_USERS,
      instructors: INITIAL_INSTRUCTORS,
      students: INITIAL_STUDENTS,
      classes: INITIAL_CLASSES,
      attendance: INITIAL_ATTENDANCE,
      assignments: INITIAL_ASSIGNMENTS,
      submissions: INITIAL_SUBMISSIONS,
      exams: INITIAL_EXAMS,
      results: INITIAL_EXAM_RESULTS,
      projects: INITIAL_PROJECTS,
      hackathons: INITIAL_HACKATHONS,
      hackathonRegistrations: INITIAL_HACKATHON_REGISTRATIONS,
      certificates: INITIAL_CERTIFICATES,
      invoices: INITIAL_INVOICES,
      leads: INITIAL_LEADS,
      applications: INITIAL_APPLICATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: INITIAL_AUDIT_LOGS
    };

    Object.entries(keys).forEach(([key, defaultValue]) => {
      localStorage.setItem(`sma_${key}`, JSON.stringify(defaultValue));
    });
    this.log("aadithyan.menon@swanayamedia.com", "AADITHYAN M MENON (MD)", "DATA_RESTORE", "Restored initial seed demo data");
  }
}
