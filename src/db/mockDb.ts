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
  email: "academy@swanayamedia.com",
  website: "https://academy.swanayamedia.com",
  currency: "INR (₹)",
  timezone: "Asia/Kolkata",
  language: "English"
};

export const INITIAL_COURSES: Course[] = [
  {
    id: "c-1",
    code: "SMA-ADWDVC",
    name: "Advanced Diploma in Web Development & Vibe Coding",
    description: "An intensive industry-oriented specialization bridging software engineering, creative UI design, high-frequency vibe coding, and AI collaboration tools. Build web-scale platforms with extreme aesthetic precision.",
    duration: "12 Months",
    level: "ADVANCED",
    eligibility: "Graduate / Equivalent Tech Background",
    fee: 145000,
    mode: "HYBRID",
    status: "ACTIVE",
    thumbnailUrl: "",
    coordinator: "Prof. Ananthakrishnan S.",
    learningObjectives: [
      "Master high-fidelity responsive frontend architectures via modern web frameworks.",
      "Achieve flow state using advanced AI programming workflows and vibe coding patterns.",
      "Engineer highly performant server architectures and robust persistent datastores."
    ],
    careerOutcomes: ["Lead Frontend Engineer", "Full-Stack Web Architect", "Vibe Coder / AI-Collaborative Developer", "SaaS Technical Lead"]
  },
  {
    id: "c-2",
    code: "SMA-DAIMPIDM",
    name: "Diploma in AI Media Production & Integrated Digital Marketing",
    description: "Conquer the content ecosystem. Learn modern cinematic media generation, generative AI text/image/video pipelines, and full-funnel customer acquisition campaigns across all channels.",
    duration: "6 Months",
    level: "DIPLOMA",
    eligibility: "12th Standard / Graduate of Any Discipline",
    fee: 85000,
    mode: "PHYSICAL",
    status: "ACTIVE",
    thumbnailUrl: "",
    coordinator: "Devika Menon",
    learningObjectives: [
      "Command generative AI models for commercial-grade graphic, copy, and video production.",
      "Design data-backed marketing funnels that convert cold traffic with measurable ROI.",
      "Manage social communities and execute premium digital distribution campaigns."
    ],
    careerOutcomes: ["AI Content Strategist", "Integrated Digital Marketer", "Media Production Lead", "Brand Operations Manager"]
  },
  {
    id: "c-3",
    code: "SMA-AIBC",
    name: "AI & Business Communication",
    description: "Accelerate your corporate throughput. Learn executive writing, collaborative AI systems, professional presenting, and personal branding configured for the automated knowledge economy.",
    duration: "3 Months",
    level: "INTERMEDIATE",
    eligibility: "Undergraduates / Professionals looking to upskill",
    fee: 45000,
    mode: "ONLINE",
    status: "ACTIVE",
    thumbnailUrl: "",
    coordinator: "Meera Nair",
    learningObjectives: [
      "Draft clean executive communications, technical specifications, and press materials using custom AI workflows.",
      "Master public speaking and client presentation delivery under pressure.",
      "Automate daily administrative operations to focus on high-leverage business strategy."
    ],
    careerOutcomes: ["Corporate Communications Specialist", "Executive AI Consultant", "PR Manager", "Client Relations Architect"]
  },
  {
    id: "c-4",
    code: "SMA-CCVF",
    name: "Content Creation & Videography Fundamentals",
    description: "From camera setup to storytelling. Learn visual physics, editing software mastery, narrative lighting, sound engineering, and social content structures.",
    duration: "3 Months",
    level: "BEGINNER",
    eligibility: "Open to anyone interested in visual creation",
    fee: 38000,
    mode: "PHYSICAL",
    status: "ACTIVE",
    thumbnailUrl: "",
    coordinator: "Rahul R. Pillai",
    learningObjectives: [
      "Film high-resolution footage using cinematic focus rules and dynamic camera choreography.",
      "Perform seamless video editing, color-grading, and post-production voice processing.",
      "Script stories with captivating hooks built for modern video-first digital networks."
    ],
    careerOutcomes: ["Cinematographer", "Independent Creator", "Video Editor", "Creative Assistant"]
  }
];

export const INITIAL_SEMESTERS: Semester[] = [
  { id: "s-1-1", courseId: "c-1", name: "Semester 1: Frontend & Design Engineering", code: "SMA-ADWDVC-S1" },
  { id: "s-1-2", courseId: "c-1", name: "Semester 2: Backend Architecture & Databases", code: "SMA-ADWDVC-S2" },
  { id: "s-1-3", courseId: "c-1", name: "Semester 3: Vibe Coding, AI & Capstone Project", code: "SMA-ADWDVC-S3" },
  { id: "s-2-1", courseId: "c-2", name: "Semester 1: Generative AI & Digital Marketing", code: "SMA-DAIMPIDM-S1" },
  { id: "s-3-1", courseId: "c-3", name: "Semester 1: Professional Communication & AI", code: "SMA-AIBC-S1" }
];

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: "sub-101",
    semesterId: "s-1-1",
    code: "SMA-WD-101",
    name: "Advanced HTML5, CSS3 & Tailwind Grid Systems",
    credits: 4,
    hours: 60,
    description: "Detailed study of structural markup, advanced CSS grid, responsive layout mathematics, container queries, and Tailwind v4 production styling patterns.",
    learningOutcomes: [
      "Construct clean, semantically compliant HTML5 templates with high accessibility scores.",
      "Implement flawless multi-column responsive grids with zero overlapping issues."
    ],
    instructorId: "inst-1",
    assessmentMethod: "Practical assignment + Internal review exam"
  },
  {
    id: "sub-102",
    semesterId: "s-1-1",
    code: "SMA-JS-102",
    name: "TypeScript & React Modern Architecture",
    credits: 5,
    hours: 75,
    description: "Exploring state management, effect lifecycle management, strict type checking, and custom hooks in React 19.",
    learningOutcomes: [
      "Build complex interactive states with seamless UI updates.",
      "Validate complex API boundaries with strict TypeScript schema definitions."
    ],
    instructorId: "inst-1",
    assessmentMethod: "LMS React App project submission"
  },
  {
    id: "sub-201",
    semesterId: "s-1-2",
    code: "SMA-BE-201",
    name: "Node.js Express & Relational Databases",
    credits: 5,
    hours: 80,
    description: "Understanding RESTful endpoint contracts, auth middleware, PostgreSQL databases, and Prisma ORM integration.",
    learningOutcomes: [
      "Program scalable server routes with deep query validation.",
      "Establish complex relational schemas and join tables with high query optimization."
    ],
    instructorId: "inst-2",
    assessmentMethod: "REST Backend API review"
  },
  {
    id: "sub-301",
    semesterId: "s-1-3",
    code: "SMA-VC-301",
    name: "Vibe Coding, AI Collaborations & Large Language Models",
    credits: 6,
    hours: 90,
    description: "Leveraging LLMs for ultra-fast full-stack development, managing prompt templates, structuring agent-led software builds, and prompt engineering.",
    learningOutcomes: [
      "Deploy scalable, multi-feature software systems built collaboratively with AI inside high-frequency environments.",
      "Analyze and resolve compiler issues instantly via prompt feedback cycles."
    ],
    instructorId: "inst-1",
    assessmentMethod: "High-level Capstone SaaS evaluation + Pitch"
  }
];

export const INITIAL_LESSONS: Lesson[] = [
  { id: "les-1", subjectId: "sub-101", title: "Tailwind CSS v4 Configuration & Architecture", description: "Deep dive into CSS theme directives, custom colors, fonts, utility compilation, and nesting rules in modern builds.", duration: "50 mins" },
  { id: "les-2", subjectId: "sub-101", title: "Visual Mathematics: Aspect Ratios, Containers & Spatial Grid Units", description: "Master layout math: margins, outer container padding calculations, and aligning headers and cards perfectly.", duration: "1 hr 10 mins" },
  { id: "les-3", subjectId: "sub-102", title: "State Machines, Context & Event Controllers in React", description: "Practical exercises to construct custom reducers and propagate synchronized actions down the component tree.", duration: "45 mins" },
  { id: "les-4", subjectId: "sub-301", title: "AI Prompt Engineering for High-Throughput Software Generation", description: "Step-by-step instruction on creating custom context prompts to write clean, complete modular functions with zero stubs.", duration: "1 hr 15 mins" }
];

export const INITIAL_BATCHES: Batch[] = [
  {
    id: "b-1",
    name: "Web Dev Elite Batch A (2026)",
    code: "SMA-WD-2026A",
    courseId: "c-1",
    startDate: "2026-02-15",
    endDate: "2027-02-15",
    schedule: "Mon, Wed, Fri (10:00 AM - 01:00 PM)",
    instructorId: "inst-1",
    status: "ACTIVE",
    maxCapacity: 2
  },
  {
    id: "b-2",
    name: "Integrated Marketing Cohort B",
    code: "SMA-DM-2026B",
    courseId: "c-2",
    startDate: "2026-04-10",
    endDate: "2026-10-10",
    schedule: "Tue, Thu, Sat (02:00 PM - 05:00 PM)",
    instructorId: "inst-2",
    status: "ACTIVE",
    maxCapacity: 25
  },
  {
    id: "b-3",
    name: "AI Business Executives (Weekend)",
    code: "SMA-AIBC-Weekend",
    courseId: "c-3",
    startDate: "2026-09-01",
    endDate: "2026-12-01",
    schedule: "Saturday & Sunday (09:00 AM - 12:00 PM)",
    instructorId: "inst-1",
    status: "ACTIVE",
    maxCapacity: 20
  }
];

export const INITIAL_USERS: User[] = [
  { id: "usr-md", username: "aadithyan", email: "aadithyan.menon@swanayamedia.com", name: "AADITHYAN M MENON (MD)", role: "MD", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Adithyan", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-navven", username: "navven", email: "navven.admin@swanayamedia.com", name: "NAVVEN (Administrator)", role: "ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Naveen", status: "ACTIVE", createdAt: "2026-01-02", isVerified: true },
  { id: "usr-reviewer", username: "reviewer", email: "reviewer@swanayamedia.com", name: "Academic Reviewer", role: "REVIEWER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer", status: "ACTIVE", createdAt: "2026-01-05", isVerified: true },
  { id: "usr-alumni", username: "alumni", email: "alumni@swanayamedia.com", name: "Alumni Graduate (Nikhil V.)", role: "ALUMNI", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alumni", status: "ACTIVE", createdAt: "2026-01-08", isVerified: true },
  { id: "usr-superadmin", username: "superadmin", email: "superadmin@swanayamedia.com", name: "Suresh Pillai", role: "SUPER_ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Suresh", status: "ACTIVE", createdAt: "2026-01-10", isVerified: true },
  { id: "usr-admin", username: "admin", email: "admin@swanayamedia.com", name: "Ananya Nair (Principal)", role: "ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya", status: "ACTIVE", createdAt: "2026-01-11", isVerified: true },
  { id: "usr-academic", username: "academic", email: "academic@swanayamedia.com", name: "Dr. K. Raghavan", role: "ACADEMIC_ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Raghavan", status: "ACTIVE", createdAt: "2026-01-15", isVerified: true },
  { id: "usr-inst1", username: "instructor1", email: "instructor1@swanayamedia.com", name: "Ananthakrishnan S.", role: "INSTRUCTOR", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananth", status: "ACTIVE", createdAt: "2026-01-20", isVerified: true },
  { id: "usr-inst2", username: "instructor2", email: "instructor2@swanayamedia.com", name: "Devika Menon", role: "INSTRUCTOR", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Devika", status: "ACTIVE", createdAt: "2026-01-22", isVerified: true },
  { id: "usr-stud1", username: "student1", email: "student1@swanayamedia.com", name: "Aravind K. Kumar", role: "STUDENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind", status: "ACTIVE", createdAt: "2026-02-01", isVerified: true },
  { id: "usr-stud2", username: "student2", email: "student2@swanayamedia.com", name: "Riya Maria Joseph", role: "STUDENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Riya", status: "ACTIVE", createdAt: "2026-02-05", isVerified: true },
  { id: "usr-stud3", username: "student3", email: "student3@swanayamedia.com", name: "Gautham S. Kumar", role: "STUDENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Gautham", status: "ACTIVE", createdAt: "2026-02-10", isVerified: true },
  { id: "usr-finance", username: "finance", email: "finance@swanayamedia.com", name: "Harisankar P.", role: "FINANCE", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hari", status: "ACTIVE", createdAt: "2026-01-12", isVerified: true },
  { id: "usr-counsel", username: "counsellor", email: "counsellor@swanayamedia.com", name: "Lakshmi S. Bose", role: "COUNSELLOR", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lakshmi", status: "ACTIVE", createdAt: "2026-01-14", isVerified: true },
  { id: "usr-career", username: "career", email: "career@swanayamedia.com", name: "Vikram R. Chandran", role: "CAREER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram", status: "ACTIVE", createdAt: "2026-01-18", isVerified: true },
  { id: "usr-parent1", username: "parent1", email: "parent1@swanayamedia.com", name: "K. Krishnakumar (Guardian)", role: "PARENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Krishnakumar", status: "ACTIVE", createdAt: "2026-02-01", isVerified: true, studentIds: ["stud-1", "stud-3"], guardianPin: "4012" },
  { id: "usr-parent2", username: "parent2", email: "parent2@swanayamedia.com", name: "Joseph Andrews (Guardian)", role: "PARENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Joseph", status: "ACTIVE", createdAt: "2026-02-05", isVerified: true, studentIds: ["stud-2"], guardianPin: "5544" }
];

export const INITIAL_INSTRUCTORS: Instructor[] = [
  {
    id: "inst-1",
    userId: "usr-inst1",
    name: "Ananthakrishnan S.",
    email: "instructor1@swanayamedia.com",
    phone: "+91 98450 11223",
    qualification: "M.Tech in Computer Science & AI Excellence",
    specialization: "SaaS Systems, Full Stack Engineering, AI Workflow Optimization",
    experience: "10+ Years in software architecture",
    bio: "Passionate developer advocating AI assistant capabilities. Former lead engineer at major SaaS enterprise, now teaching the training wing of Swanaya Media Enterprises.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananth",
    status: "ACTIVE",
    assignedSubjects: ["sub-101", "sub-102", "sub-301"]
  },
  {
    id: "inst-2",
    userId: "usr-inst2",
    name: "Devika Menon",
    email: "instructor2@swanayamedia.com",
    phone: "+91 94470 44556",
    qualification: "Postgraduate Diploma in Media & Public Relations",
    specialization: "Generative AI Video Production, Digital Distribution",
    experience: "8 Years in media agencies",
    bio: "Director of creative marketing. Specializes in multi-channel brand storytelling and video scripting techniques.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Devika",
    status: "ACTIVE",
    assignedSubjects: ["sub-201"]
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stud-1",
    studentId: "SMA-2026-001",
    admissionNumber: "ADM-2026-0101",
    userId: "usr-stud1",
    name: "Aravind K. Kumar",
    email: "student1@swanayamedia.com",
    phone: "+91 99951 23456",
    guardianName: "K. Krishnakumar",
    guardianPhone: "+91 99951 11222",
    academicBackground: "B.Sc Computer Science",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind",
    status: "ACTIVE",
    courseId: "c-1",
    batchId: "b-1",
    semesterId: "s-1-1",
    enrollmentDate: "2026-02-10",
    skills: ["HTML5", "CSS3 Grid", "React Component Lifecycle", "Tailwind CSS"],
    projectsCount: 2,
    certificatesCount: 0,
    attendancePercentage: 92.5,
    outstandingBalance: 45000,
    careerReadinessScore: 78
  },
  {
    id: "stud-2",
    studentId: "SMA-2026-002",
    admissionNumber: "ADM-2026-0102",
    userId: "usr-stud2",
    name: "Riya Maria Joseph",
    email: "student2@swanayamedia.com",
    phone: "+91 98950 98765",
    guardianName: "Joseph Andrews",
    guardianPhone: "+91 98950 55443",
    academicBackground: "B.A. English Literature & Creative Writing",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Riya",
    status: "ACTIVE",
    courseId: "c-2",
    batchId: "b-2",
    semesterId: "s-2-1",
    enrollmentDate: "2026-04-05",
    skills: ["Generative AI Prompts", "Copywriting", "Instagram Funnels"],
    projectsCount: 1,
    certificatesCount: 1,
    attendancePercentage: 88.0,
    outstandingBalance: 0,
    careerReadinessScore: 82
  },
  {
    id: "stud-3",
    studentId: "SMA-2026-003",
    admissionNumber: "ADM-2026-0103",
    userId: "usr-stud3",
    name: "Gautham S. Kumar",
    email: "student3@swanayamedia.com",
    phone: "+91 97440 24680",
    guardianName: "S. Suresh Kumar",
    guardianPhone: "+91 97440 11335",
    academicBackground: "High School Equivalent",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Gautham",
    status: "ACTIVE",
    courseId: "c-1",
    batchId: "b-1",
    semesterId: "s-1-1",
    enrollmentDate: "2026-02-12",
    skills: ["HTML Basics", "UI Mocking"],
    projectsCount: 1,
    certificatesCount: 0,
    attendancePercentage: 74.5, // triggers low attendance indicator (< 75%)
    outstandingBalance: 95000,
    careerReadinessScore: 45
  }
];

export const INITIAL_CLASSES: ClassSchedule[] = [
  {
    id: "cls-1",
    courseId: "c-1",
    batchId: "b-1",
    subjectId: "sub-101",
    instructorId: "inst-1",
    date: "2026-10-05", // Today's local date matches our current time metadata perfectly!
    startTime: "10:00 AM",
    endTime: "01:00 PM",
    room: "Lab Alpha (2nd Floor)",
    meetingLink: "https://zoom.us/j/944600123",
    type: "HYBRID"
  },
  {
    id: "cls-2",
    courseId: "c-2",
    batchId: "b-2",
    subjectId: "sub-201",
    instructorId: "inst-2",
    date: "2026-10-06",
    startTime: "02:00 PM",
    endTime: "05:00 PM",
    room: "Creative Studio Suite B",
    meetingLink: "https://zoom.us/j/944600456",
    type: "PHYSICAL"
  },
  {
    id: "cls-3",
    courseId: "c-1",
    batchId: "b-1",
    subjectId: "sub-102",
    instructorId: "inst-1",
    date: "2026-10-07",
    startTime: "10:00 AM",
    endTime: "01:00 PM",
    room: "Lab Alpha (2nd Floor)",
    meetingLink: "https://zoom.us/j/944600123",
    type: "LAB"
  }
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  { id: "att-1", classId: "cls-1", studentId: "stud-1", status: "PRESENT", date: "2026-10-05", hour: 1 },
  { id: "att-2", classId: "cls-1", studentId: "stud-3", status: "ABSENT", date: "2026-10-05", hour: 1 },
  { id: "att-3", classId: "cls-1", studentId: "stud-2", status: "PRESENT", date: "2026-10-05", hour: 1 }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: "asg-1",
    title: "Responsive Flex & Grid Dashboard Mockup",
    description: "Build an absolute pixel-perfect responsive dashboard using Tailwind CSS. Follow the typography rules: avoid code-comment headers and use zero-pill metadata representation. Submit GitHub repository link and hosted live URL.",
    subjectId: "sub-101",
    deadline: "2026-10-12",
    maxMarks: 100,
    submissionType: "LINK"
  },
  {
    id: "asg-2",
    title: "State Machine Implementation in Custom React Hook",
    description: "Develop a custom React hook `useFormValidator` to manage the complete verification pipeline of student application documents.",
    subjectId: "sub-102",
    deadline: "2026-10-18",
    maxMarks: 50,
    submissionType: "FILE"
  }
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: "subm-1",
    assignmentId: "asg-1",
    studentId: "stud-1",
    submittedAt: "2026-10-04 11:30 PM",
    content: "Live Link: https://dashboard-grid.vercel.app | Repo: https://github.com/aravind-kumar/grid-dashboard",
    status: "EVALUATED",
    marksObtained: 96,
    feedback: "Exceptional grid alignments and beautiful contrast ratios. Typography pairing matches Swanaya standards perfectly. Great job!",
    gradedBy: "Ananthakrishnan S."
  },
  {
    id: "subm-2",
    assignmentId: "asg-1",
    studentId: "stud-3",
    submittedAt: "2026-10-05 08:00 AM",
    content: "Repo link only: https://github.com/gautham-s/asg1",
    status: "SUBMITTED"
  }
];

export const INITIAL_EXAMS: Exam[] = [
  {
    id: "ex-1",
    name: "Midterm CSS Grid & Typography Assessment",
    courseId: "c-1",
    semesterId: "s-1-1",
    subjectId: "sub-101",
    date: "2026-10-10",
    duration: "2 Hours",
    maxMarks: 100,
    passingMarks: 50,
    type: "PRACTICAL"
  },
  {
    id: "ex-2",
    name: "React Hooks, Context & Props Viva Voce",
    courseId: "c-1",
    semesterId: "s-1-1",
    subjectId: "sub-102",
    date: "2026-10-25",
    duration: "15 Mins / Student",
    maxMarks: 50,
    passingMarks: 25,
    type: "VIVA"
  }
];

export const INITIAL_EXAM_RESULTS: ExamResult[] = [
  {
    id: "res-1",
    examId: "ex-1",
    studentId: "stud-1",
    marks: 92,
    grade: "A+",
    pass: true,
    remarks: "Incredible technical understanding of custom tailwind themes and layout integrity.",
    gradedBy: "Prof. Ananthakrishnan S."
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "proj-1",
    title: "VibeCoding SaaS Workspace Builder",
    description: "An advanced browser-based developer IDE with generative AI assistance triggers, automated code compiling simulation, and beautiful dark layouts.",
    studentId: "stud-1",
    instructorId: "inst-1",
    semesterId: "s-1-1",
    startDate: "2026-08-01",
    deadline: "2026-10-20",
    repoUrl: "https://github.com/aravind-kumar/vibe-workspace",
    liveUrl: "https://vibe-workspace.swanaya-devs.in",
    status: "DEVELOPMENT"
  },
  {
    id: "proj-2",
    title: "Generative AI Social Copy Generator",
    description: "A fast copywriting automation agent targeting Instagram visual posts, integrated directly into a local marketing distribution engine.",
    studentId: "stud-2",
    instructorId: "inst-2",
    semesterId: "s-2-1",
    startDate: "2026-05-10",
    deadline: "2026-09-20",
    repoUrl: "https://github.com/riya-maria/ai-copy",
    liveUrl: "https://ai-copy-marketeer.web.app",
    status: "COMPLETED",
    score: 95,
    feedback: "Stellar implementation of structured output prompts and dynamic text generators. Perfect presentation."
  }
];

export const INITIAL_HACKATHONS: Hackathon[] = [
  {
    id: "hack-1",
    name: "Swanaya Vibe Hackathon 2026",
    theme: "Generative AI Platforms for Malayalam Media Distribution",
    description: "A legendary 48-hour sprint building future-forward digital content generators, localized AI voice-overs, and automated subtitle tools tailored for Malayalam distribution networks.",
    date: "2026-11-12",
    duration: "48 Hours",
    location: "Main Auditorium, Swanaya Media Academy",
    mode: "HYBRID",
    registrationDeadline: "2026-11-05",
    prizes: ["1st Prize: ₹50,000 + Placement Priority", "2nd Prize: ₹25,000", "Best Innovation Badge"],
    rules: ["Maximum 3 members per team", "Must incorporate custom generative model pipelines", "Must create a fully functional interface mock-up"]
  }
];

export const INITIAL_HACKATHON_REGISTRATIONS: HackathonRegistration[] = [
  {
    id: "hr-1",
    hackathonId: "hack-1",
    studentId: "stud-1",
    teamName: "Team Polyglot Vibe",
    projectName: "SwaramAI",
    projectDescription: "Automatic localized Malayalam media translator with realistic native voice accent adjustments.",
    score: 98,
    rank: "1st Place"
  }
];

export const INITIAL_CERTIFICATES: Certificate[] = [
  {
    id: "CERT-SMA-11202",
    studentId: "stud-2",
    studentName: "Riya Maria Joseph",
    courseId: "c-2",
    courseName: "Diploma in AI Media Production & Integrated Digital Marketing",
    issueDate: "2026-09-30",
    completionDate: "2026-09-28",
    grade: "A+",
    type: "DIPLOMA",
    signatory: "Ananya Nair (Principal)",
    verificationUrl: "https://academy.swanayamedia.com/verify/CERT-SMA-11202"
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: "INV-2026-0001",
    studentId: "stud-1",
    courseId: "c-1",
    amount: 145000,
    dueDate: "2026-11-01",
    status: "PARTIAL",
    paidAmount: 100000,
    payments: [
      { id: "pay-1", amount: 50000, date: "2026-02-12", method: "UPI / Google Pay", receiptNo: "REC-40112" },
      { id: "pay-2", amount: 50000, date: "2026-06-15", method: "Bank Transfer", receiptNo: "REC-45600" }
    ]
  },
  {
    id: "INV-2026-0002",
    studentId: "stud-2",
    courseId: "c-2",
    amount: 85000,
    dueDate: "2026-04-10",
    status: "PAID",
    paidAmount: 85000,
    payments: [
      { id: "pay-3", amount: 85000, date: "2026-04-05", method: "Debit Card", receiptNo: "REC-39012" }
    ]
  },
  {
    id: "INV-2026-0003",
    studentId: "stud-3",
    courseId: "c-1",
    amount: 145000,
    dueDate: "2026-03-01",
    status: "PENDING",
    paidAmount: 50000,
    payments: [
      { id: "pay-4", amount: 50000, date: "2026-02-12", method: "Cash Deposit", receiptNo: "REC-40115" }
    ]
  }
];

export const INITIAL_LEADS: Lead[] = [
  { id: "ld-1", name: "Sandra Sunil", email: "sandra.sunil@gmail.com", phone: "+91 94462 12121", courseId: "c-1", source: "Instagram Campaign", status: "COUNSELLING", notes: "Very passionate about high-frequency web layouts, coming for counselling session this Wednesday.", assignedTo: "usr-counsel", createdAt: "2026-09-28" },
  { id: "ld-2", name: "Fasil Rahman", email: "fasil.rahman@hotmail.com", phone: "+91 98471 88990", courseId: "c-2", source: "Website Contact Form", status: "NEW", notes: "Requested fee structure and batch timings for Diploma in AI Media Production.", assignedTo: "usr-counsel", createdAt: "2026-10-04" },
  { id: "ld-3", name: "Jithin Mathew", email: "jithin.mathew@live.com", phone: "+91 99955 77889", courseId: "c-4", source: "Walk-in Inquiry", status: "INTERESTED", notes: "Met with counselors. Enjoys content creation, planning to enroll next week.", assignedTo: "usr-counsel", createdAt: "2026-09-15" }
];

export const INITIAL_APPLICATIONS: AdmissionApplication[] = [
  {
    id: "app-1",
    name: "Sandra Sunil",
    email: "sandra.sunil@gmail.com",
    phone: "+91 94462 12121",
    courseId: "c-1",
    qualification: "B.Tech in Computer Science",
    preferredBatch: "ADWDVC-2026-A",
    message: "I am specifically interested in building AI integrated tools and scaling web aesthetics.",
    status: "COUNSELLING",
    leadSource: "Instagram Campaign",
    createdAt: "2026-09-28"
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "not-1", userId: "usr-stud1", title: "New Assignment Published", message: "Responsive Flex & Grid Dashboard Mockup has been published. Due on Oct 12.", type: "INFO", read: false, createdAt: "2026-10-05 08:00 AM" },
  { id: "not-2", userId: "usr-stud1", title: "Fees Receipt Generated", message: "Your installment payment of ₹50,000 has been verified. Check Receipts.", type: "SUCCESS", read: true, createdAt: "2026-06-15 04:30 PM" },
  { id: "not-3", userId: "usr-stud3", title: "Attendance Warning Alert", message: "Your aggregate attendance is 74.5%, which is below the mandatory 75%. Please contact Professor S.", type: "WARNING", read: false, createdAt: "2026-10-05 08:15 AM" }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: "log-1", userEmail: "superadmin@swanayamedia.com", userName: "Suresh Pillai", action: "SETTINGS_UPDATE", entity: "Academy Configuration", previousValue: "Default Setup", newValue: "Verified SMA Standards", timestamp: "2026-10-05 08:00 AM", ipAddress: "192.168.1.101" },
  { id: "log-2", userEmail: "admin@swanayamedia.com", userName: "Ananya Nair", action: "BATCH_CREATE", entity: "AI Business Executives (Weekend)", timestamp: "2026-09-01 10:00 AM", ipAddress: "192.168.1.112" }
];

// Helper database controller with localStorage sync
export class SwanayaDatabase {
  private static isInitializing = false;

  static init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!localStorage.getItem("sma_database_cleaned_v1")) {
        localStorage.setItem("sma_database_cleaned_v1", "true");
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
        auditLogs: INITIAL_AUDIT_LOGS
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
      },
      {
        id: "usr-superadmin",
        username: "superadmin",
        email: "superadmin@swanayamedia.com",
        name: "Suresh Pillai",
        role: "SUPER_ADMIN",
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
      userEmail: "superadmin@swanayamedia.com",
      userName: "Suresh Pillai",
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
    this.log("superadmin@swanayamedia.com", "Suresh Pillai", "DATA_RESTORE", "Restored initial seed demo data");
  }
}
