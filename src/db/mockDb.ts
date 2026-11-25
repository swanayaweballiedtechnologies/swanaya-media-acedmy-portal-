/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Types & Database Schema
export type UserRole =
  | 'SUPER_ADMIN'
  | 'MD'
  | 'PRINCIPAL'
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
  avatarFocus?: 'center' | 'top';
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  academicBackground?: string;
  skills?: string[];
  bio?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
  isVerified?: boolean;
  email_verified?: boolean;
  grantId?: string;
  studentIds?: string[];
  guardianPin?: string;
  whatsappPhone?: string;
  whatsappOptIn?: boolean;
  preferredCourseId?: string;
  courseId?: string;
  enrolledCourseIds?: string[];
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

export type CourseSpecializationType = 'major' | 'minor' | 'MAJOR' | 'MINOR';

export interface Course {
  id: string;
  code: string; // e.g. SMA-ADWDVC
  name: string;
  title?: string;
  courseType?: CourseSpecializationType;
  category?: string;
  categoryId?: string;
  description: string;
  duration: string; // e.g. "12 Months"
  credits?: number;
  prerequisites?: string[]; // course codes or prerequisite descriptions
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'DIPLOMA' | 'CERTIFICATE';
  eligibility: string;
  fee: number; // in INR
  fees?: number;
  mode: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  status: 'ACTIVE' | 'ARCHIVED';
  isPublished?: boolean;
  maxSeats?: number;
  enrolledCount?: number;
  assignedTutorIds?: string[];
  examRequirements?: string;
  thumbnailUrl: string;
  coordinator: string;
  learningObjectives: string[];
  careerOutcomes: string[];
  syllabusModules?: CourseModuleItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
}

export interface CourseModuleItem {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  moduleCode?: string;
  order?: number;
  orderIndex?: number;
  durationHours: number;
  assessmentType?: string;
  isRequired?: boolean;
  topics?: string[];
  learningOutcome?: string;
}

export interface CourseCreditSpec {
  id: string;
  courseId: string;
  totalCredits: number;
  theoryCredits?: number;
  practicalCredits?: number;
  projectCredits?: number;
  minPassingGrade?: string;
  passingScore?: number;
}

export interface TutorCourseAllocation {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  courseType: CourseSpecializationType;
  tutorId: string;
  tutorUserId?: string;
  tutorName: string;
  tutorEmail: string;
  role?: 'LEAD' | 'CO_TUTOR';
  roleLabel?: 'PRIMARY_FACULTY' | 'CO_TUTOR' | 'LAB_MENTOR';
  batchId?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  allocatedBy?: string;
  allocatedAt: string;
}

export type MajorMinorApprovalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'MODIFICATION_REQUIRED';

export interface StudentCourseSelection {
  id: string;
  studentId: string;
  userId?: string;
  studentName: string;
  studentEmail?: string;
  studentRegisterNo?: string;
  academicTerm?: string;
  majorCourseId: string;
  majorCourseCode?: string;
  majorCourseName?: string;
  minorCourseIds: string[];
  minorCourseNames?: string[];
  totalCredits: number;
  studyMode?: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  statementOfPurpose?: string;
  remarks?: string;
  approvalStatus: MajorMinorApprovalStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  adminRemarks?: string;
  locked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseEnrollmentRecord {
  id: string;
  selectionId: string;
  studentId: string;
  userId?: string;
  studentName: string;
  studentEmail?: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  courseType: CourseSpecializationType;
  credits?: number;
  progressPercent?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  enrolledAt: string;
}

export interface CourseApprovalLog {
  id: string;
  selectionId: string;
  studentId: string;
  studentName?: string;
  action?: 'CREATED_DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUIRED' | 'LOCK_TOGGLED' | 'ALLOCATED_TUTOR';
  previousStatus?: string;
  nextStatus?: string;
  newStatus?: string;
  actorId?: string;
  actorName: string;
  actorRole?: string;
  remarks?: string;
  timestamp: string;
}

export interface CourseSelectionPolicy {
  id: string;
  academicTerm?: string;
  maxMinorSelections: number;
  minMinorSelections: number;
  maxTotalCredits: number;
  selectionLocked: boolean;
  selectionDeadline: string;
  requireAdminApproval: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface TutorStudentProgressReport {
  id: string;
  courseId: string;
  courseType: CourseSpecializationType;
  studentId: string;
  studentName?: string;
  tutorId?: string;
  tutorName: string;
  progressPercent?: number;
  modulesCompleted?: number;
  totalModules?: number;
  assessmentScore?: number;
  attendanceRate?: number;
  status?: 'ON_TRACK' | 'NEEDS_SUPPORT' | 'COMPLETED';
  progressStatus?: 'ON_TRACK' | 'EXCELLING' | 'NEEDS_ATTENTION' | 'COMPLETED';
  remarks: string;
  submittedAt: string;
}


export type CoursePaperCategory =
  | 'Study Materials'
  | 'Course Notes'
  | 'Examination Question Papers'
  | 'Previous Year Question Papers'
  | 'Assignments'
  | 'Practical Records'
  | 'Reference Materials';

export const COURSE_PAPER_CATEGORIES: CoursePaperCategory[] = [
  'Study Materials',
  'Course Notes',
  'Examination Question Papers',
  'Previous Year Question Papers',
  'Assignments',
  'Practical Records',
  'Reference Materials',
];

export interface CoursePaper {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  semester: string;
  subject: string;
  module: string;
  title: string;
  description?: string;
  category: CoursePaperCategory;
  fileUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  isPublished: boolean;
  publishedAt?: string;
  uploadedById: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
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
  title?: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  batchId: string;
  batchName?: string;
  subjectId: string;
  subjectName?: string;
  instructorId: string;
  instructorName?: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  meetingLink?: string;
  googleMeetUrl?: string;
  whatsappGroupUrl?: string;
  whatsappGroupName?: string;
  facultyWhatsapp?: string;
  notes?: string;
  isActive?: boolean;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
  type: 'PHYSICAL' | 'ONLINE' | 'HYBRID' | 'WORKSHOP' | 'LAB' | 'HACKATHON';
}

export type LiveClassSession = ClassSchedule & {
  title: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  date: string;
  hour: number; // Hourly tracking (e.g. Hour 1, Hour 2, Hour 3, Hour 4)
}

export interface AttendanceQrSession {
  id: string;
  token: string;
  classId: string;
  courseId: string;
  courseName?: string;
  subjectName?: string;
  date: string;
  hour: number;
  instructorId: string;
  instructorName?: string;
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface AttendanceCheckIn {
  id: string;
  sessionId: string;
  token: string;
  classId: string;
  courseId?: string;
  date: string;
  hour: number;
  studentId: string;
  studentName: string;
  userId: string;
  status: 'PRESENT' | 'LATE';
  checkedInAt: string;
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
  examDate?: string;
  startTime?: string;
  endTime?: string;
  examType?: 'SEMESTER_FINAL' | 'MID_TERM' | 'MCQ_ASSESSMENT' | 'PRACTICAL_JURY' | 'RE_EXAM';
  subjectCode?: string;
  subjectName?: string;
  courseId?: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  examId?: string;
  venue?: string;
  deliveryMode?: 'ONLINE_PORTAL' | 'CAMPUS_CENTER' | 'HYBRID';
  registrationDeadline?: string;
  instructions?: string;
  pdfUrl?: string;
  youtubeUrl?: string;
  active: boolean;
  approvalStatus?: 'OFFICIAL' | 'DRAFT' | 'PENDING_MD' | 'ARCHIVED';
  createdById?: string;
  createdByName?: string;
  createdByRole?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface ExamCenter {
  id: string;
  name: string;
  location: string;
  totalCapacity: number;
  availableSeats: number;
}

export interface ExamRegistration {
  id: string;
  examSessionId: string;
  examTitle: string;
  subjectCode: string;
  subjectName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegisterNo: string;
  courseId: string;
  courseName: string;
  batchId: string;
  batchName: string;
  registrationDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hallTicketNo?: string;
  seatNumber?: string;
  examCenterId?: string; // Link to ExamCenter
  examCenterName?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  feePaid: boolean;
  attendanceEligible: boolean;
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
  registrationOpen?: boolean;
  registrationDeadline?: string;
  examFee?: number;
  venue?: string;
  pdfQuestionPaperUrl?: string;
  pdfQuestionPaperName?: string;
  youtubeVideoUrl?: string;
  instructions: string[];
  studentSubmissions?: ExamStudentSubmission[];
}

export interface ExamQuestionPaper {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  courseId: string;
  courseName: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  instructions: string;
  paperContent: string;
  paperFileName?: string;
  paperFileType?: string;
  paperFileDataUrl?: string;
  createdById: string;
  createdByName: string;
  mdVerificationStatus: 'PENDING_MD' | 'VERIFIED' | 'REJECTED';
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface McqQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  marks: number;
}

export interface McqExam {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  courseId: string;
  courseName: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  questions: McqQuestion[];
  createdById: string;
  createdByName: string;
  mdVerificationStatus: 'PENDING_MD' | 'VERIFIED' | 'REJECTED';
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentExamSubmission {
  id: string;
  mode: 'ANSWERBOOK' | 'MCQ';
  examRefId: string;
  examTitle: string;
  subjectCode: string;
  userId: string;
  studentId: string;
  studentName: string;
  studentRegisterNo: string;
  answerNotes?: string;
  answerFileName?: string;
  answerFileType?: string;
  answerFileDataUrl?: string;
  mcqAnswers?: Record<string, number>;
  autoScore?: number;
  maxMarks: number;
  passMarks: number;
  marksObtained?: number;
  grade?: string;
  pass?: boolean;
  evaluationStatus: 'SUBMITTED' | 'INSTRUCTOR_EVALUATED' | 'MD_VERIFIED' | 'RETURNED';
  evaluatorId?: string;
  evaluatorName?: string;
  evaluatorRemarks?: string;
  evaluatedAt?: string;
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdVerificationRemarks?: string;
  submittedAt: string;
  updatedAt: string;
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

export interface AcademyReview {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  courseId: string;
  courseName: string;
  rating: number;
  title: string;
  comment: string;
  status: 'PUBLISHED' | 'FLAGGED';
  verifiedStudent: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
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
  invoiceNumber?: string;
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
    utrNumber?: string;
    verifiedBy?: string;
  }>;
}

export interface FeePaymentTransaction {
  id: string;
  invoiceNumber: string;
  invoiceId: string;
  studentId: string;
  userId: string;
  studentName: string;
  studentEmail?: string;
  courseId: string;
  courseName?: string;
  amount: number;
  currency: 'INR';
  paymentMethod: 'GPAY_UPI' | 'UPI_QR' | 'UPI_INTENT' | 'RAZORPAY_UPI' | 'BANK_TRANSFER';
  upiIdPaidTo: string;
  utrNumber?: string;
  upiAppName?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignatureVerified?: boolean;
  proofNote?: string;
  status: 'AWAITING_PAYMENT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  receiptNumber?: string;
  verifiedBy?: string;
  verifiedById?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
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
  levelFilter?: string;
  studyMode?: 'HYBRID' | 'PHYSICAL' | 'ONLINE';
  preferredSchedule?: string;
  experienceLevel?: string;
  careerTrack?: string;
  status: 'NEW' | 'CONTACTED' | 'COUNSELLING' | 'APPLIED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'ENROLLED';
  leadSource: string;
  createdAt: string;
  departmentVerificationStatus?: 'PENDING' | 'VERIFIED' | 'RETURNED' | 'REJECTED';
  departmentVerifiedBy?: string;
  departmentVerifiedRole?: string;
  departmentVerifiedAt?: string;
  departmentRemarks?: string;
  mdVerificationStatus?: 'PENDING_MD' | 'VERIFIED' | 'REJECTED';
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdRemarks?: string;
}

export interface CourseSelectionRegistration {
  id: string;
  userId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  source?: string;
  courseId: string;
  courseCode?: string;
  courseTitle: string;
  courseCategory?: string;
  answers?: {
    levelFilter?: string;
    studyMode?: string;
    preferredBatch?: string;
    preferredSchedule?: string;
    qualification?: string;
    experienceLevel?: string;
    priorExperience?: string;
    careerGoals?: string;
    reason?: string;
  };
  status: 'PENDING' | 'DEPARTMENT_VERIFIED' | 'MD_VERIFIED' | 'APPROVED' | 'RETURNED' | 'REJECTED';
  departmentVerificationStatus: 'PENDING' | 'VERIFIED' | 'RETURNED' | 'REJECTED';
  departmentVerifiedBy?: string;
  departmentVerifiedRole?: string;
  departmentVerifiedAt?: string;
  departmentRemarks?: string;
  mdVerificationStatus: 'PENDING_MD' | 'VERIFIED' | 'REJECTED';
  mdVerifiedBy?: string;
  mdVerifiedAt?: string;
  mdRemarks?: string;
  captchaVerifiedAt?: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  confirmationMessageSent?: boolean;
  confirmationId?: string;
  confirmationSentAt?: string;
  confirmationMessageText?: string;
}

export interface AdminGrant {
  id: string;
  userId?: string;
  email: string;
  name?: string;
  username?: string;
  role: UserRole;
  phone?: string;
  status?: string;
  grantedBy?: string;
  grantedByUid?: string;
  grantedByName?: string;
  grantedByEmail?: string;
  grantedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  upiId?: string;
  upiPayeeName?: string;
  upiMerchantCode?: string;
  upiVerified?: boolean;
  configEditingEnabled?: boolean;
}

export interface FrontPageCohortItem {
  title: string;
  subtitle: string;
  badgeText: string;
}

export interface FrontPagePillar {
  title: string;
  description: string;
}

export interface FrontPagePosterItem {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface FrontPageConfig {
  id: string;
  faviconUrl: string;
  brandLogoUrl: string;
  brandWordmark: string;
  brandSubtitle: string;
  portalButtonLabel: string;
  heroEyebrow: string;
  heroHeadlinePrefix: string;
  heroHeadlineHighlight: string;
  heroHeadlineSuffix: string;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  cohortCardTitle: string;
  cohortLocationLabel: string;
  cohortItems: FrontPageCohortItem[];
  programsEyebrow: string;
  programsTitle: string;
  programsSubtitle: string;
  philosophyEyebrow: string;
  philosophyTitle: string;
  philosophyDescription: string;
  philosophyPillars: FrontPagePillar[];
  testimonialQuote: string;
  testimonialAuthor: string;
  testimonialRole: string;
  testimonialAvatarUrl: string;
  reviewsEyebrow: string;
  reviewsTitle: string;
  reviewsSubtitle: string;
  blogEyebrow: string;
  blogTitle: string;
  blogSubtitle: string;
  admissionsEyebrow: string;
  admissionsTitle: string;
  admissionsSubtitle: string;
  footerBrandTitle: string;
  footerDescription: string;
  contactEmail: string;
  contactPhone: string;
  contactLocation: string;
  copyrightText: string;
  showReviewsSection: boolean;
  showBlogSection: boolean;
  showAdmissionsSection: boolean;
  showMediaShowcaseSection: boolean;
  mediaSectionEyebrow: string;
  mediaSectionTitle: string;
  mediaSectionSubtitle: string;
  featuredVideoTitle: string;
  featuredVideoCaption: string;
  featuredVideoUrl: string;
  featuredVideoPosterUrl: string;
  posters: FrontPagePosterItem[];
  editingEnabled?: boolean;
  updatedAt: string;
  updatedBy: string;
}

// Global Static Data / Fallback for Fresh Launch
export const INITIAL_SETTINGS: AcademySettings = {
  academyName: "Swanaya Media Academy",
  logoText: "SWANAYA",
  address: "Thiruvananthapuram, Kerala, India",
  phone: "+91 94460 00000",
  adminWhatsAppPhone: "+91 94460 12345",
  email: "swanayamediaacedmins@gmail.com",
  website: "https://academy.swanayamedia.com",
  currency: "INR (₹)",
  timezone: "Asia/Kolkata",
  language: "English",
  upiId: "swanayamedia@okaxis",
  upiPayeeName: "Swanaya Media Academy",
  upiMerchantCode: "8299",
  upiVerified: true,
  configEditingEnabled: true
};

export const INITIAL_FRONT_PAGE_CONFIG: FrontPageConfig = {
  id: "front_page",
  faviconUrl: "/favicon.svg",
  brandLogoUrl: "",
  brandWordmark: "SWANAYA",
  brandSubtitle: "ACADEMY",
  portalButtonLabel: "Enterprise Portal",
  heroEyebrow: "Swanaya Media Enterprises Wing",
  heroHeadlinePrefix: "Training that builds",
  heroHeadlineHighlight: "job-ready professionals",
  heroHeadlineSuffix: "— not just certificates.",
  heroDescription: "Swanaya Media Academy delivers elite industry-focused certification programs in AI Media Production, High-Frequency Web Development, and Digital Strategy. Crafted by real professionals for high-caliber learners.",
  heroPrimaryCta: "Apply Online",
  heroSecondaryCta: "Explore Curriculum",
  cohortCardTitle: "Next Cohorts Starting Oct 2026",
  cohortLocationLabel: "Location · Trivandrum & Online",
  cohortItems: [
    {
      title: "Web Development & Vibe Coding",
      subtitle: "Duration: 12 Months · Advanced Diploma",
      badgeText: "Limited Seats"
    },
    {
      title: "AI Media & Integrated Marketing",
      subtitle: "Duration: 6 Months · Diploma",
      badgeText: "Filling Fast"
    },
    {
      title: "AI & Business Communication",
      subtitle: "Duration: 3 Months · Professional Certification",
      badgeText: "Open"
    }
  ],
  programsEyebrow: "ACADEMIC ECOSYSTEM",
  programsTitle: "Programs of Swanaya Media Academy",
  programsSubtitle: "Strict industry curriculum engineered to elevate digital skills to corporate standards.",
  philosophyEyebrow: "THE COGNITIVE SHIFT",
  philosophyTitle: "Why Swanaya Media Academy?",
  philosophyDescription: "Most educational systems teach outdated, generic documentation. At Swanaya, we build real code alongside LLMs in high-frequency vibe environments. We shoot real cinema on high-grade cameras. We deploy live, monetizable SaaS platforms.",
  philosophyPillars: [
    {
      title: "100% Industry Aligned",
      description: "Direct integration with Swanaya Media Enterprise projects."
    },
    {
      title: "Vibe Coding Mastery",
      description: "Continuous AI collaboration tools to ship software at extreme speeds."
    },
    {
      title: "Production Studio Access",
      description: "Professional cameras, lighting sets, and audio post-suites."
    },
    {
      title: "Verified Student Reviews",
      description: "Transparent peer ratings and feedback across every program."
    }
  ],
  testimonialQuote: "Swanaya Media Academy transformed my perspective on engineering. I didn't just learn React; I learned how to build production-grade interfaces using advanced AI prompts. Within three weeks of completing my Advanced Diploma, I was hired by a major regional SaaS team.",
  testimonialAuthor: "Aravind K. Kumar",
  testimonialRole: "Lead Web Architect · Alumnus 2026",
  testimonialAvatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aravind",
  reviewsEyebrow: "STUDENT FEEDBACK",
  reviewsTitle: "Academy Reviews & Ratings",
  reviewsSubtitle: "Read candid feedback from enrolled scholars and graduates, or share your experience with our curriculum and studio mentorship.",
  blogEyebrow: "INTELLECTUAL CAPITAL",
  blogTitle: "Academy Blog & Insights",
  blogSubtitle: "Deep dives into AI engineering, digital strategy, and the future of media production from our expert faculty.",
  admissionsEyebrow: "ONLINE APPLICATION",
  admissionsTitle: "Join the Next Cohort",
  admissionsSubtitle: "No complex procedures. Fill in your details and an admission counselor will contact you within 24 hours.",
  footerBrandTitle: "SWANEXA AI",
  footerDescription: "An EdTech Solution by Swanaya Media Enterprises. SWANEXA AI is an integrated Education Technology platform designed to digitally transform schools, colleges, universities and educational institutions. Combining institutional ERP, Learning Management Systems (LMS), college website development, academic administration and AI-powered solutions, SWANEXA AI provides a unified digital ecosystem for modern education.\n\nTagline: Transforming Education Through Intelligence.\nParent Company: Swanaya Media Enterprises\nIndustry: Education Technology (EdTech)\nBusiness Model: B2B SaaS & Institutional Technology Solutions",
  contactEmail: "swanayamediaacedmins@gmail.com",
  contactPhone: "+91 94460 00000",
  contactLocation: "Thiruvananthapuram, Kerala",
  copyrightText: "© 2026 Swanaya Media Academy. Training & Certification Wing of Swanaya Media Enterprises. All Rights Reserved.",
  showReviewsSection: true,
  showBlogSection: true,
  showAdmissionsSection: true,
  showMediaShowcaseSection: true,
  mediaSectionEyebrow: "CAMPUS SPOTLIGHT",
  mediaSectionTitle: "Posters & Featured Video",
  mediaSectionSubtitle: "Explore official academy posters, upcoming studio workshops, and featured campus reels.",
  featuredVideoTitle: "Inside Swanaya Media Academy",
  featuredVideoCaption: "Take a closer look at our cinema stages, AI engineering studios, and live cohort builds.",
  featuredVideoUrl: "",
  featuredVideoPosterUrl: "",
  posters: [],
  editingEnabled: true,
  updatedAt: "2026-10-01T00:00:00.000Z",
  updatedBy: "System Default"
};

export const INITIAL_COURSES: Course[] = [];
export const INITIAL_SEMESTERS: Semester[] = [];
export const INITIAL_SUBJECTS: Subject[] = [];
export const INITIAL_LESSONS: Lesson[] = [];
export const INITIAL_BATCHES: Batch[] = [];

export const INITIAL_USERS: User[] = [
  { id: "usr-md", username: "aadithyan", email: "aadithyan.menon@swanayamedia.com", name: "AADITHYAN M MENON", role: "MD", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-principal", username: "principal", email: "principal@swanayamedia.com", name: "Academy Principal", role: "PRINCIPAL", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Principal", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-navven", username: "navven", email: "navven.admin@swanayamedia.com", name: "NAVVEN (Administrator)", role: "ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Naveen", status: "ACTIVE", createdAt: "2026-01-02", isVerified: true },
  { id: "usr-tutor", username: "instructor", email: "instructor@swanaya.edu", name: "Prof. Vikram Sen", role: "INSTRUCTOR", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=VikramSen", status: "ACTIVE", createdAt: "2026-01-03", isVerified: true },
  { id: "usr-student", username: "student", email: "student@swanaya.edu", name: "Arjun Ramesh", role: "STUDENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ArjunRamesh", status: "ACTIVE", createdAt: "2026-01-04", isVerified: true },
  { id: "usr-reviewer", username: "reviewer", email: "reviewer@swanayamedia.com", name: "Academic Reviewer", role: "REVIEWER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer", status: "ACTIVE", createdAt: "2026-01-05", isVerified: true },
  { id: "usr-alumni", username: "alumni", email: "alumni@swanayamedia.com", name: "Alumni Graduate", role: "ALUMNI", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alumni", status: "ACTIVE", createdAt: "2026-01-08", isVerified: true }
];

export const INITIAL_INSTRUCTORS: Instructor[] = [
  {
    id: "inst-1",
    userId: "usr-tutor",
    name: "Prof. Vikram Sen",
    email: "instructor@swanaya.edu",
    phone: "+91 94460 11223",
    qualification: "M.Tech in Digital Media & AI Systems",
    specialization: "AI Production Pipelines & VFX",
    experience: "8+ Years Academic & Industry",
    bio: "Lead Faculty in Media Science, Visual Effects and Generative AI at Swanaya Media Academy.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=VikramSen",
    status: "ACTIVE",
    assignedSubjects: ["sub-101", "sub-102"]
  },
  {
    id: "inst-2",
    userId: "usr-md",
    name: "AADITHYAN M MENON",
    email: "aadithyan.menon@swanayamedia.com",
    phone: "+91 94460 77889",
    qualification: "MBA in Media Management & Creative Technology",
    specialization: "Digital Strategy & Media Direction",
    experience: "10+ Years",
    bio: "Managing Director and Senior Mentor in Advanced Media at Swanaya.",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon",
    status: "ACTIVE",
    assignedSubjects: ["sub-103"]
  }
];
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

export const INITIAL_EXAM_ANNOUNCEMENTS: ExamAnnouncement[] = [];

export const INITIAL_EXAM_SESSIONS: ExamSession[] = [];

export const INITIAL_EXAM_REGISTRATIONS: ExamRegistration[] = [];

export const INITIAL_REVIEWS: AcademyReview[] = [];

export const INITIAL_QUESTION_PAPERS: ExamQuestionPaper[] = [];

export const INITIAL_MCQ_EXAMS: McqExam[] = [];

export const INITIAL_EXAM_SUBMISSIONS: StudentExamSubmission[] = [];

// Helper database controller with localStorage sync
export class SwanayaDatabase {
  private static isInitializing = false;

  static init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      // Preservation guard: initialization must never clear existing browser data.
      // The former first-run demo purge overwrote sma_* records before migration.

      const keys = {
        settings: INITIAL_SETTINGS,
        frontPageConfig: INITIAL_FRONT_PAGE_CONFIG,
        courses: [],
        semesters: [],
        subjects: [],
        lessons: [],
        batches: [],
        users: [],
        instructors: [],
        students: [],
        classes: [],
        attendance: [],
        attendanceQrSessions: [],
        attendanceCheckins: [],
        assignments: [],
        submissions: [],
        exams: [],
        results: [],
        projects: [],
        hackathons: [],
        hackathonRegistrations: [],
        certificates: [],
        invoices: [],
        paymentTransactions: [],
        leads: [],
        applications: [],
        courseRegistrations: [],
        notifications: [],
        auditLogs: [],
        examAnnouncements: [],
        examSessions: [],
        examRegistrations: [],
        reviews: [],
        questionPapers: [],
        mcqExams: [],
        examSubmissions: [],
        courseCategories: [],
        courseModules: [],
        courseCredits: [],
        tutorCourseAllocations: [],
        studentCourseSelections: [],
        courseEnrollments: [],
        courseApprovalLogs: [],
        tutorProgressReports: []
      };

      Object.entries(keys).forEach(([key, defaultValue]) => {
        if (!localStorage.getItem(`sma_${key}`)) {
          localStorage.setItem(`sma_${key}`, JSON.stringify(defaultValue));
        }
      });

      // Do not auto-insert demo/principal/tutor accounts into a live data store.
      // Real accounts are provisioned through the authenticated registration/admin workflows.

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sma-autosave', { detail: { key, timestamp: new Date().toISOString() } }));
    }
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
        name: "AADITHYAN M MENON",
        role: "MD",
        status: "ACTIVE",
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true
      },
      {
        id: "usr-principal",
        username: "principal",
        email: "principal@swanayamedia.com",
        name: "Academy Principal",
        role: "PRINCIPAL",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Principal",
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
    localStorage.setItem("sma_attendanceQrSessions", JSON.stringify([]));
    localStorage.setItem("sma_attendanceCheckins", JSON.stringify([]));
    localStorage.setItem("sma_assignments", JSON.stringify([]));
    localStorage.setItem("sma_submissions", JSON.stringify([]));
    localStorage.setItem("sma_exams", JSON.stringify([]));
    localStorage.setItem("sma_results", JSON.stringify([]));
    localStorage.setItem("sma_projects", JSON.stringify([]));
    localStorage.setItem("sma_hackathons", JSON.stringify([]));
    localStorage.setItem("sma_hackathonRegistrations", JSON.stringify([]));
    localStorage.setItem("sma_certificates", JSON.stringify([]));
    localStorage.setItem("sma_invoices", JSON.stringify([]));
    localStorage.setItem("sma_paymentTransactions", JSON.stringify([]));
    localStorage.setItem("sma_leads", JSON.stringify([]));
    localStorage.setItem("sma_applications", JSON.stringify([]));
    localStorage.setItem("sma_courseRegistrations", JSON.stringify([]));
    localStorage.setItem("sma_notifications", JSON.stringify([]));
    localStorage.setItem("sma_examAnnouncements", JSON.stringify([]));
    localStorage.setItem("sma_examSessions", JSON.stringify([]));
    localStorage.setItem("sma_examRegistrations", JSON.stringify([]));
    localStorage.setItem("sma_reviews", JSON.stringify([]));
    localStorage.setItem("sma_questionPapers", JSON.stringify([]));
    localStorage.setItem("sma_mcqExams", JSON.stringify([]));
    localStorage.setItem("sma_examSubmissions", JSON.stringify([]));
    
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
      frontPageConfig: INITIAL_FRONT_PAGE_CONFIG,
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
      attendanceQrSessions: [],
      attendanceCheckins: [],
      assignments: INITIAL_ASSIGNMENTS,
      submissions: INITIAL_SUBMISSIONS,
      exams: INITIAL_EXAMS,
      results: INITIAL_EXAM_RESULTS,
      projects: INITIAL_PROJECTS,
      hackathons: INITIAL_HACKATHONS,
      hackathonRegistrations: INITIAL_HACKATHON_REGISTRATIONS,
      certificates: INITIAL_CERTIFICATES,
      invoices: INITIAL_INVOICES,
      paymentTransactions: [],
      leads: INITIAL_LEADS,
      applications: INITIAL_APPLICATIONS,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
      reviews: INITIAL_REVIEWS,
      questionPapers: INITIAL_QUESTION_PAPERS,
      mcqExams: INITIAL_MCQ_EXAMS,
      examSubmissions: INITIAL_EXAM_SUBMISSIONS
    };

    Object.entries(keys).forEach(([key, defaultValue]) => {
      localStorage.setItem(`sma_${key}`, JSON.stringify(defaultValue));
    });
    this.log("aadithyan.menon@swanayamedia.com", "AADITHYAN M MENON (MD)", "DATA_RESTORE", "Restored initial seed demo data");
  }
}
