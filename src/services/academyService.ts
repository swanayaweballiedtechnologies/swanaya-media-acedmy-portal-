import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  getDocsFromServer,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import {
  SwanayaDatabase,
  User,
  Student,
  Instructor,
  Course,
  CoursePaper,
  CoursePaperCategory,
  AttendanceQrSession,
  AttendanceCheckIn,
  AttendanceRecord,
  ClassSchedule,
  LiveClassSession,
  AdminGrant,
  CourseCategory,
  CourseModuleItem,
  CourseCreditSpec,
  TutorCourseAllocation,
  StudentCourseSelection,
  CourseEnrollmentRecord,
  CourseApprovalLog,
  CourseSelectionPolicy,
  TutorStudentProgressReport,
} from '../db/mockDb';
import type { AcademyThemeConfig } from '../types/theme';

export function normalizeGoogleMeetUrl(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(val)) {
    return `https://meet.google.com/${val.toLowerCase()}`;
  }
  if (/^https?:\/\//i.test(val)) {
    return val.replace(/^http:\/\//i, 'https://');
  }
  return `https://${val.replace(/^\/+/, '')}`;
}

export function normalizeWhatsappUrl(raw?: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) {
    return val.replace(/^http:\/\//i, 'https://');
  }
  if (/^(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)\//i.test(val)) {
    return `https://${val}`;
  }
  const digits = val.replace(/[^0-9]/g, '');
  if (digits.length >= 8 && digits.length <= 15 && !/[a-z]/i.test(val)) {
    return `https://wa.me/${digits}`;
  }
  return `https://${val.replace(/^\/+/, '')}`;
}

export const MAX_COURSE_PAPER_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_USER_KEYS = new Set([
  'id', 'name', 'designation', 'email', 'role', 'avatarUrl', 'avatarFocus',
  'phone', 'whatsappPhone', 'guardianName', 'guardianPhone',
  'academicBackground', 'skills', 'bio', 'status', 'createdAt', 'updatedAt',
  'username', 'isVerified', 'email_verified', 'emailVerifiedAt', 'tutorApprovalStatus',
  'adminAcceptanceStatus',
  'whatsappOptIn', 'preferredCourseId', 'courseId',
  'enrolledCourseIds', 'studentIds', 'guardianPin', 'grantId'
]);

function sanitizeUserDoc(user: any): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.entries(user || {}).forEach(([k, v]) => {
    if (ALLOWED_USER_KEYS.has(k) && v !== undefined) {
      clean[k] = v;
    }
  });
  return clean;
}

export function normalizeCourse(raw: any): Course {
  const rawStatus = String(raw?.status || '').toUpperCase();
  const isPublished =
    typeof raw?.isPublished === 'boolean'
      ? raw.isPublished
      : rawStatus !== 'ARCHIVED';
  const status: 'ACTIVE' | 'ARCHIVED' =
    rawStatus === 'ARCHIVED' || !isPublished ? 'ARCHIVED' : 'ACTIVE';

  return {
    id: String(raw?.id || ''),
    code: String(raw?.code || String(raw?.id || 'SMA').slice(0, 8)).trim().toUpperCase(),
    name: String(raw?.name || raw?.title || 'Academy Program').trim(),
    description: String(raw?.description || ''),
    duration: String(raw?.duration || '6 Months'),
    level: (['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'DIPLOMA'].includes(String(raw?.level || '').toUpperCase())
      ? String(raw.level).toUpperCase()
      : 'DIPLOMA') as Course['level'],
    eligibility: String(raw?.eligibility || '12th Standard or Equivalent'),
    fee: Number(raw?.fee ?? raw?.fees ?? 0),
    mode: (['PHYSICAL', 'ONLINE', 'HYBRID'].includes(String(raw?.mode || '').toUpperCase())
      ? String(raw.mode).toUpperCase()
      : 'HYBRID') as Course['mode'],
    status,
    isPublished,
    thumbnailUrl: String(raw?.thumbnailUrl || ''),
    coordinator: String(raw?.coordinator || 'Academic Director'),
    learningObjectives: Array.isArray(raw?.learningObjectives) ? raw.learningObjectives : [],
    careerOutcomes: Array.isArray(raw?.careerOutcomes) ? raw.careerOutcomes : [],
  };
}

export function isPublishedCourse(c: Partial<Course> | null | undefined): boolean {
  if (!c) return false;
  if (c.isPublished === false) return false;
  if (String(c.status || '').toUpperCase() === 'ARCHIVED') return false;
  return true;
}

export function validateCoursePaperFile(file: File): string | null {
  if (!file) return 'No file selected.';
  const isPdfType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfType) {
    return `Invalid file type for "${file.name}". Only PDF (.pdf) documents are allowed.`;
  }
  if (file.size <= 0) {
    return `File "${file.name}" appears to be empty.`;
  }
  if (file.size > MAX_COURSE_PAPER_SIZE_BYTES) {
    return `"${file.name}" exceeds the 25 MB maximum upload limit.`;
  }
  return null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const academyService = {
  // --- MULTI-DEVICE PERSISTENT PROFILE SYNCHRONIZATION ---
  async syncProfileToCloud(user: User, student?: Student | null, instructor?: Instructor | null) {
    try {
      const res = await fetch('/api/sync/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, student, instructor })
      });
      const data = await res.json();
      
      if (auth.currentUser && user?.id) {
        try {
          const targetRef = doc(db, 'users', auth.currentUser.uid);
          const payload = sanitizeUserDoc({
            ...user,
            id: auth.currentUser.uid,
            updatedAt: new Date().toISOString(),
          });
          await setDoc(targetRef, payload, { merge: true });
        } catch (e: any) {
          console.warn('Direct Firestore user write notice:', e.message);
        }
      }

      if (user) {
        const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
        const idx = currentUsers.findIndex(u => u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase()));
        if (idx >= 0) {
          currentUsers[idx] = { ...currentUsers[idx], ...user };
        } else {
          currentUsers.push(user);
        }
        SwanayaDatabase.set('users', currentUsers);
      }

      if (student) {
        const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
        const idx = currentStudents.findIndex(s => s.id === student.id || s.userId === student.userId || (student.email && s.email?.toLowerCase() === student.email.toLowerCase()));
        if (idx >= 0) {
          currentStudents[idx] = { ...currentStudents[idx], ...student };
        } else {
          currentStudents.push(student);
        }
        SwanayaDatabase.set('students', currentStudents);
      }

      if (instructor) {
        const currentInstructors = SwanayaDatabase.get<Instructor[]>('instructors') || [];
        const idx = currentInstructors.findIndex(i => i.id === instructor.id || i.userId === instructor.userId);
        if (idx >= 0) {
          currentInstructors[idx] = { ...currentInstructors[idx], ...instructor };
        } else {
          currentInstructors.push(instructor);
        }
        SwanayaDatabase.set('instructors', currentInstructors);
      }

      return data?.user || user;
    } catch (err: any) {
      console.warn('Sync profile deferred:', err.message);
      return user;
    }
  },

  async fetchAllProfilesFromCloud() {
    try {
      const res = await fetch('/api/sync/profiles');
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success) return null;

      if (Array.isArray(data.users) && data.users.length > 0) {
        const localUsers = SwanayaDatabase.get<User[]>('users') || [];
        const userMap = new Map<string, User>();
        localUsers.forEach(u => u?.id && userMap.set(u.id, u));
        data.users.forEach((u: User) => {
          if (u?.id) {
            userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u });
          }
        });
        SwanayaDatabase.set('users', Array.from(userMap.values()));
      }

      if (Array.isArray(data.students) && data.students.length > 0) {
        const localStudents = SwanayaDatabase.get<Student[]>('students') || [];
        const studentMap = new Map<string, Student>();
        localStudents.forEach(s => s?.id && studentMap.set(s.id, s));
        data.students.forEach((s: Student) => {
          if (s?.id) {
            studentMap.set(s.id, { ...(studentMap.get(s.id) || {}), ...s });
          }
        });
        SwanayaDatabase.set('students', Array.from(studentMap.values()));
      }

      if (Array.isArray(data.instructors) && data.instructors.length > 0) {
        const localInstructors = SwanayaDatabase.get<Instructor[]>('instructors') || [];
        const instMap = new Map<string, Instructor>();
        localInstructors.forEach(i => i?.id && instMap.set(i.id, i));
        data.instructors.forEach((i: Instructor) => {
          if (i?.id) {
            instMap.set(i.id, { ...(instMap.get(i.id) || {}), ...i });
          }
        });
        SwanayaDatabase.set('instructors', Array.from(instMap.values()));
      }

      return data;
    } catch (err: any) {
      console.warn('Fetch all profiles deferred:', err.message);
      return null;
    }
  },

  async lookupUserForLogin(identifier: string): Promise<{ user: User; student?: Student; instructor?: Instructor } | null> {
    try {
      const res = await fetch('/api/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.user) return null;

      const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
      const userIdx = currentUsers.findIndex(u => u.id === data.user.id || (data.user.email && u.email?.toLowerCase() === data.user.email.toLowerCase()));
      if (userIdx >= 0) {
        currentUsers[userIdx] = { ...currentUsers[userIdx], ...data.user };
      } else {
        currentUsers.push(data.user);
      }
      SwanayaDatabase.set('users', currentUsers);

      if (data.student) {
        const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
        const sIdx = currentStudents.findIndex(s => s.id === data.student.id || s.userId === data.student.userId || (data.student.email && s.email?.toLowerCase() === data.student.email.toLowerCase()));
        if (sIdx >= 0) {
          currentStudents[sIdx] = { ...currentStudents[sIdx], ...data.student };
        } else {
          currentStudents.push(data.student);
        }
        SwanayaDatabase.set('students', currentStudents);
      }

      if (data.instructor) {
        const currentInstructors = SwanayaDatabase.get<Instructor[]>('instructors') || [];
        const iIdx = currentInstructors.findIndex(i => i.id === data.instructor.id || i.userId === data.instructor.userId);
        if (iIdx >= 0) {
          currentInstructors[iIdx] = { ...currentInstructors[iIdx], ...data.instructor };
        } else {
          currentInstructors.push(data.instructor);
        }
        SwanayaDatabase.set('instructors', currentInstructors);
      }

      return { user: data.user, student: data.student, instructor: data.instructor };
    } catch (err: any) {
      console.warn('Lookup user login note:', err.message);
      return null;
    }
  },

  // --- USER PROFILES ---
  async getUserProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async createUserProfile(uid: string, profile: any) {
    const path = `users/${uid}`;
    try {
      const payload = sanitizeUserDoc({
        ...profile,
        id: uid,
        createdAt: profile.createdAt || new Date().toISOString(),
      });
      await setDoc(doc(db, 'users', uid), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateUserProfile(uid: string, profile: any) {
    const path = `users/${uid}`;
    try {
      const targetRef = doc(db, 'users', uid);
      const existingSnap = await getDoc(targetRef);
      const payload = sanitizeUserDoc({
        ...profile,
        id: uid,
        updatedAt: new Date().toISOString(),
      });
      if (existingSnap.exists()) {
        await updateDoc(targetRef, payload);
      } else {
        await setDoc(targetRef, {
          ...payload,
          createdAt: profile.createdAt || new Date().toISOString(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async uploadProfileFaceImage(
    uid: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `avatars/${uid}/${Date.now()}_${safeName}`;
    const fileRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type || 'image/jpeg',
      });

      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            task.cancel();
          } catch {
            // ignore cancel error
          }
          reject(new Error('Storage upload timed out'));
        }
      }, 15000);

      task.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            onProgress?.(pct);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(err);
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              onProgress?.(100);
              resolve(downloadUrl);
            }
          } catch (err) {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              reject(err);
            }
          }
        }
      );
    });
  },

  // --- BLOGS ---
  async getBlogs(publishedOnly = true) {
    const path = 'blogs';
    try {
      const q = publishedOnly
        ? query(collection(db, path), where('status', '==', 'PUBLISHED'))
        : query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createBlog(blogData: any) {
    const path = 'blogs';
    try {
      const docRef = doc(collection(db, path));
      const id = docRef.id;
      const data = {
        ...blogData,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, data);
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateBlog(blogId: string, blogData: any) {
    const path = `blogs/${blogId}`;
    try {
      await updateDoc(doc(db, 'blogs', blogId), {
        ...blogData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteBlog(blogId: string) {
    const path = `blogs/${blogId}`;
    try {
      await deleteDoc(doc(db, 'blogs', blogId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- MEDIA ASSETS ---
  async getMediaAssets() {
    const path = 'media_assets';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async uploadMedia(file: File, type: 'IMAGE' | 'VIDEO' | 'DOCUMENT', uploadedBy: string) {
    const path = 'media_assets';
    try {
      const storagePath = `media/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const docRef = doc(collection(db, path));
      const id = docRef.id;
      await setDoc(docRef, {
        id,
        title: file.name,
        url,
        type,
        size: file.size,
        storagePath,
        uploadedBy,
        createdAt: new Date().toISOString()
      });
      return { id, url };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteMedia(assetId: string, storagePath: string) {
    const path = `media_assets/${assetId}`;
    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
      await deleteDoc(doc(db, 'media_assets', assetId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- COURSES (FIRESTORE SINGLE SOURCE OF TRUTH & REAL-TIME SYNC) ---
  subscribeCourses(options: {
    includeUnpublished?: boolean;
    onData: (courses: Course[]) => void;
    onError?: (error: Error) => void;
  }): () => void {
    const { includeUnpublished = false, onData, onError } = options;
    let activeUnsub: (() => void) | null = null;
    let cancelled = false;

    const attach = (allDocs: boolean) => {
      const baseRef = collection(db, 'courses');
      const q = allDocs ? query(baseRef) : query(baseRef, where('status', '==', 'ACTIVE'));

      activeUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (cancelled) return;
          const mapped = snapshot.docs
            .map((d) => normalizeCourse({ id: d.id, ...d.data() }))
            .filter((c) => (allDocs ? true : isPublishedCourse(c)))
            .sort((a, b) => a.code.localeCompare(b.code));

          if (allDocs) {
            SwanayaDatabase.set('courses', mapped.filter((c) => isPublishedCourse(c)));
          } else {
            SwanayaDatabase.set('courses', mapped);
          }
          onData(mapped);
        },
        (error) => {
          if (cancelled) return;
          // If admin query failed because session isn't Firebase-authenticated as admin, retry active-only query
          if (allDocs && String((error as any)?.code || error.message).includes('permission-denied')) {
            if (activeUnsub) activeUnsub();
            attach(false);
            return;
          }
          console.error('Firestore subscribeCourses error:', error);
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      );
    };

    attach(includeUnpublished);

    return () => {
      cancelled = true;
      if (activeUnsub) activeUnsub();
    };
  },

  async getCourses(includeUnpublished = false): Promise<Course[]> {
    const path = 'courses';
    let cloudCourses: Course[] = [];

    // 1. Firestore is the authoritative single source of truth across dev & Netlify production
    try {
      const baseRef = collection(db, path);
      const q = includeUnpublished ? query(baseRef) : query(baseRef, where('status', '==', 'ACTIVE'));
      let snapshot;
      try {
        snapshot = await getDocsFromServer(q);
      } catch {
        snapshot = await getDocs(q);
      }
      cloudCourses = snapshot.docs
        .map((d) => normalizeCourse({ id: d.id, ...d.data() }))
        .filter((c) => (includeUnpublished ? true : isPublishedCourse(c)))
        .sort((a, b) => a.code.localeCompare(b.code));

      SwanayaDatabase.set('courses', includeUnpublished ? cloudCourses.filter((c) => isPublishedCourse(c)) : cloudCourses);
      return cloudCourses;
    } catch (fsErr: any) {
      // If includeUnpublished failed due to local-only admin auth, retry public ACTIVE query
      if (includeUnpublished) {
        try {
          const publicSnap = await getDocs(query(collection(db, path), where('status', '==', 'ACTIVE')));
          cloudCourses = publicSnap.docs
            .map((d) => normalizeCourse({ id: d.id, ...d.data() }))
            .filter((c) => isPublishedCourse(c))
            .sort((a, b) => a.code.localeCompare(b.code));
          SwanayaDatabase.set('courses', cloudCourses);
          return cloudCourses;
        } catch {
          // continue to dev server API fallback if offline
        }
      }
      console.warn('Firestore getCourses notice:', fsErr?.message || fsErr);
    }

    // 2. Express backend JSON fallback only if it returns genuine JSON (not Netlify SPA HTML)
    try {
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.courses)) {
          cloudCourses = data.courses
            .map((c: any) => normalizeCourse(c))
            .filter((c: Course) => (includeUnpublished ? true : isPublishedCourse(c)));
          SwanayaDatabase.set('courses', cloudCourses);
          return cloudCourses;
        }
      }
    } catch {
      // Ignore on static hosting or offline
    }

    throw new Error('Unable to load published courses from the database. Please check your connection and retry.');
  },

  async createCourse(course: Partial<Course> & { id?: string; name?: string; code?: string }): Promise<string> {
    const courseId = course.id || `c-${Date.now()}`;
    const isPublished =
      typeof course.isPublished === 'boolean'
        ? course.isPublished
        : String(course.status || 'ACTIVE').toUpperCase() !== 'ARCHIVED';
    const status: 'ACTIVE' | 'ARCHIVED' = isPublished ? 'ACTIVE' : 'ARCHIVED';
    const nowIso = new Date().toISOString();

    const sanitized: Course = {
      id: courseId,
      code: (course.code || 'SMA-NEW').trim().toUpperCase(),
      name: (course.name || (course as any).title || 'New Academy Program').trim(),
      description: course.description || '',
      duration: course.duration || '6 Months',
      level: course.level || 'DIPLOMA',
      eligibility: course.eligibility || '12th Standard or Equivalent',
      fee: Number(course.fee ?? (course as any).fees ?? 0),
      mode: course.mode || 'PHYSICAL',
      coordinator: course.coordinator || 'Devika Menon',
      status,
      isPublished,
      thumbnailUrl: course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
      learningObjectives: Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0 
        ? course.learningObjectives 
        : [
          'Master core concepts and tools',
          'Build production-ready portfolios'
        ],
      careerOutcomes: Array.isArray(course.careerOutcomes) && course.careerOutcomes.length > 0
        ? course.careerOutcomes
        : [
          'Industry Professional',
          'Certified Media Specialist'
        ]
    };

    const firestorePayload: Record<string, any> = {
      ...sanitized,
      createdAt: (course as any).createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 1. Ensure authenticated Firebase Admin before writing to Firestore
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Please connect your Admin Google Account to create or update courses in Firestore.');
    }

    try {
      const docRef = doc(db, 'courses', courseId);
      await setDoc(docRef, firestorePayload, { merge: true });
    } catch (fsErr) {
      handleFirestoreError(fsErr, OperationType.WRITE, `courses/${courseId}`);
    }

    // 2. Sync local mirror + Express dev endpoint best-effort
    const localCourses = SwanayaDatabase.get<Course[]>('courses') || [];
    const idx = localCourses.findIndex(c => c.id === courseId);
    const updatedLocal = idx >= 0
      ? localCourses.map((c, i) => i === idx ? sanitized : c)
      : [...localCourses, sanitized];
    SwanayaDatabase.set('courses', updatedLocal.filter((c) => isPublishedCourse(c)));

    fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firestorePayload)
    }).catch(() => undefined);

    return courseId;
  },

  async updateCourse(courseId: string, updateData: Partial<Course>) {
    return this.createCourse({ ...updateData, id: courseId });
  },

  async setCoursePublishState(courseId: string, isPublished: boolean): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Please connect your Admin Google Account to publish or unpublish courses in Firestore.');
    }
    const path = `courses/${courseId}`;
    const status: 'ACTIVE' | 'ARCHIVED' = isPublished ? 'ACTIVE' : 'ARCHIVED';
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        isPublished,
        status,
        updatedAt,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    const local = SwanayaDatabase.get<Course[]>('courses') || [];
    const updatedLocal = isPublished
      ? local.map((c) => (c.id === courseId ? { ...c, isPublished, status } : c))
      : local.filter((c) => c.id !== courseId);
    SwanayaDatabase.set('courses', updatedLocal);

    fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: courseId, isPublished, status, updatedAt }),
    }).catch(() => undefined);
  },

  async deleteCourse(courseId: string) {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Please connect your Admin Google Account to delete courses from Firestore.');
    }
    const path = `courses/${courseId}`;
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }

    const local = SwanayaDatabase.get<Course[]>('courses') || [];
    SwanayaDatabase.set('courses', local.filter(c => c.id !== courseId));

    fetch(`/api/courses/${courseId}`, { method: 'DELETE' }).catch(() => undefined);
  },

  // --- COURSE PAPERS & LEARNING MATERIALS (FIREBASE STORAGE + FIRESTORE) ---
  subscribeCoursePapers(options: {
    mode: 'ADMIN' | 'STUDENT';
    courseIds?: string[];
    onData: (papers: CoursePaper[]) => void;
    onError?: (error: Error) => void;
  }): () => void {
    const { mode, courseIds = [], onData, onError } = options;
    const baseRef = collection(db, 'course_papers');

    if (mode === 'STUDENT') {
      const cleanIds = Array.from(new Set(courseIds.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 30);
      if (cleanIds.length === 0) {
        onData([]);
        return () => undefined;
      }
      const q =
        cleanIds.length === 1
          ? query(baseRef, where('courseId', '==', cleanIds[0]), where('isPublished', '==', true))
          : query(baseRef, where('courseId', 'in', cleanIds), where('isPublished', '==', true));

      return onSnapshot(
        q,
        (snapshot) => {
          const papers = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as CoursePaper))
            .filter((p) => p.isPublished === true)
            .sort((a, b) =>
              String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || ''))
            );
          onData(papers);
        },
        (error) => {
          console.error('Firestore subscribeCoursePapers (STUDENT) error:', error);
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      );
    }

    // ADMIN mode: listen to all course papers (published + unpublished)
    return onSnapshot(
      query(baseRef),
      (snapshot) => {
        const papers = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as CoursePaper))
          .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        onData(papers);
      },
      (error) => {
        console.error('Firestore subscribeCoursePapers (ADMIN) error:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    );
  },

  async uploadCoursePaperPdf(
    courseId: string,
    paperId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{
    fileUrl: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    fileType: 'application/pdf';
  }> {
    const validationError = validateCoursePaperFile(file);
    if (validationError) {
      throw new Error(validationError);
    }
    if (!auth.currentUser) {
      throw new Error('Please connect your Admin Google Account before uploading PDFs to Firebase Storage.');
    }

    const safeCourseId = (courseId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `course_papers/${safeCourseId}/${paperId}_${Date.now()}_${safeName}`;
    const fileRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, file, {
        contentType: 'application/pdf',
        customMetadata: {
          courseId: safeCourseId,
          paperId,
          uploadedByUid: auth.currentUser?.uid || '',
        },
      });

      const timeoutId = setTimeout(() => {
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error(`Upload timed out for "${file.name}". Please check your network connection and Firebase Storage configuration.`));
      }, 60000);

      task.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            onProgress?.(pct);
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          try {
            const fileUrl = await getDownloadURL(task.snapshot.ref);
            clearTimeout(timeoutId);
            onProgress?.(100);
            resolve({
              fileUrl,
              storagePath,
              fileName: file.name,
              fileSize: file.size,
              fileType: 'application/pdf',
            });
          } catch (err) {
            clearTimeout(timeoutId);
            reject(err);
          }
        }
      );
    });
  },

  async createCoursePaper(paper: {
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
    uploadedByName?: string;
  }): Promise<CoursePaper> {
    if (!auth.currentUser) {
      throw new Error('Admin Firebase Authentication required to save course papers.');
    }
    const now = new Date().toISOString();
    const payload: CoursePaper = {
      id: paper.id,
      courseId: paper.courseId,
      courseCode: paper.courseCode || '',
      courseName: paper.courseName || '',
      semester: paper.semester.trim(),
      subject: paper.subject.trim(),
      module: paper.module.trim(),
      title: paper.title.trim(),
      description: (paper.description || '').trim(),
      category: paper.category,
      fileUrl: paper.fileUrl,
      storagePath: paper.storagePath,
      fileName: paper.fileName,
      fileSize: paper.fileSize,
      fileType: 'application/pdf',
      isPublished: Boolean(paper.isPublished),
      ...(paper.isPublished ? { publishedAt: now } : {}),
      uploadedById: auth.currentUser.uid,
      uploadedByName: paper.uploadedByName || auth.currentUser.displayName || auth.currentUser.email || 'Admin',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'course_papers', payload.id), payload);
      return payload;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `course_papers/${payload.id}`);
      throw error;
    }
  },

  async updateCoursePaper(paperId: string, updates: Partial<CoursePaper>): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Admin Firebase Authentication required to update course papers.');
    }
    const path = `course_papers/${paperId}`;
    const now = new Date().toISOString();
    const cleanUpdates = Object.fromEntries(
      Object.entries({
        ...updates,
        updatedAt: now,
      }).filter(([k, v]) => k !== 'id' && k !== 'createdAt' && v !== undefined)
    );

    try {
      await updateDoc(doc(db, 'course_papers', paperId), cleanUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async replaceCoursePaperPdf(
    existingPaper: CoursePaper,
    newFile: File,
    onProgress?: (percent: number) => void
  ): Promise<{ fileUrl: string; storagePath: string; fileName: string; fileSize: number }> {
    const uploaded = await this.uploadCoursePaperPdf(
      existingPaper.courseId,
      existingPaper.id,
      newFile,
      onProgress
    );

    await this.updateCoursePaper(existingPaper.id, {
      fileUrl: uploaded.fileUrl,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      fileSize: uploaded.fileSize,
      fileType: 'application/pdf',
    });

    if (existingPaper.storagePath && existingPaper.storagePath !== uploaded.storagePath) {
      try {
        await deleteObject(ref(storage, existingPaper.storagePath));
      } catch (err: any) {
        if (!String(err?.code || '').includes('object-not-found')) {
          console.warn('Old PDF cleanup notice:', err);
        }
      }
    }

    return uploaded;
  },

  async toggleCoursePaperPublish(paperId: string, isPublished: boolean): Promise<void> {
    const now = new Date().toISOString();
    await this.updateCoursePaper(paperId, {
      isPublished,
      ...(isPublished ? { publishedAt: now } : {}),
    });
  },

  async deleteCoursePaper(paper: CoursePaper): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Admin Firebase Authentication required to delete course papers.');
    }
    const path = `course_papers/${paper.id}`;
    try {
      await deleteDoc(doc(db, 'course_papers', paper.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }

    if (paper.storagePath) {
      try {
        await deleteObject(ref(storage, paper.storagePath));
      } catch (err: any) {
        if (!String(err?.code || '').includes('object-not-found')) {
          console.warn('Storage PDF deletion notice:', err);
        }
      }
    }
  },

  // --- REGISTRATIONS (COURSE SELECTION & VERIFICATION) ---
  async registerForCourse(registration: any) {
    const path = 'registrations';
    const nowIso = new Date().toISOString();
    const recordId = registration.id || `creg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
      id: recordId,
      userId: auth.currentUser?.uid || registration.userId || registration.studentId,
      studentId: registration.studentId,
      studentName: registration.studentName,
      studentEmail: registration.studentEmail || '',
      studentPhone: registration.studentPhone || '',
      source: registration.source || 'PORTAL_COURSE_SELECTION',
      courseId: registration.courseId,
      courseCode: registration.courseCode || '',
      courseTitle: registration.courseTitle,
      courseCategory: registration.courseCategory || 'Media Science',
      answers: registration.answers || {},
      status: 'PENDING',
      departmentVerificationStatus: 'PENDING',
      mdVerificationStatus: 'PENDING_MD',
      captchaVerifiedAt: nowIso,
      timestamp: registration.timestamp || nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      if (auth.currentUser) {
        await setDoc(doc(db, path, recordId), payload);
      }

      // Trigger welcome email notification via server endpoint
      fetch('/api/registrations/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: registration.studentName,
          studentEmail: registration.studentEmail,
          courseTitle: registration.courseTitle,
          courseCategory: registration.courseCategory || 'Media Science'
        })
      }).catch(e => console.warn('Welcome email trigger notice:', e));

      return payload;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getRegistrations(userIdOrStudentId?: string) {
    const path = 'registrations';
    try {
      const q = userIdOrStudentId
        ? query(collection(db, path), where('userId', '==', userIdOrStudentId))
        : query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.updatedAt || b.timestamp || '').localeCompare(String(a.updatedAt || a.timestamp || '')));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async updateCourseRegistration(regId: string, updateData: any) {
    const path = `registrations/${regId}`;
    try {
      await updateDoc(doc(db, 'registrations', regId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- LIBRARY / POSTS ---
  async getLibraryPosts() {
    const path = 'library_posts';
    try {
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createLibraryPost(post: any) {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Please connect your Admin Google Account to publish resources to Cloud Library.');
    }
    const path = 'library_posts';
    try {
      const docRef = doc(collection(db, path));
      await setDoc(docRef, { ...post, id: docRef.id, createdAt: serverTimestamp() });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async deleteLibraryPost(postId: string) {
    if (!auth.currentUser) {
      throw new Error('ADMIN_FIREBASE_AUTH_REQUIRED: Please connect your Admin Google Account to delete resources from Cloud Library.');
    }
    const path = `library_posts/${postId}`;
    try {
      await deleteDoc(doc(db, 'library_posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- EXAMINATION SESSIONS & REGISTRATIONS ---
  async getExamSessions() {
    const path = 'exam_sessions';
    try {
      const q = query(collection(db, path), orderBy('scheduledDate', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createExamSession(sessionData: any) {
    const path = 'exam_sessions';
    try {
      const docRef = sessionData.id ? doc(db, path, sessionData.id) : doc(collection(db, path));
      await setDoc(docRef, {
        ...sessionData,
        id: docRef.id,
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExamSession(sessionId: string, sessionData: any) {
    const path = `exam_sessions/${sessionId}`;
    try {
      await updateDoc(doc(db, 'exam_sessions', sessionId), sessionData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async verifyExamCaptcha(_captchaToken?: string | null) {
    return { valid: true };
  },

  async registerForExam(registrationData: any) {
    const path = 'exam_registrations';
    try {
      const docRef = registrationData.id ? doc(db, path, registrationData.id) : doc(collection(db, path));
      await setDoc(docRef, {
        ...registrationData,
        id: docRef.id,
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExamRegistration(regId: string, updateData: any) {
    const path = `exam_registrations/${regId}`;
    try {
      await updateDoc(doc(db, 'exam_registrations', regId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- ACADEMY REVIEWS ---
  async getReviews(publishedOnly = true) {
    const path = 'reviews';
    try {
      const q = publishedOnly
        ? query(collection(db, path), where('status', '==', 'PUBLISHED'))
        : query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createReview(reviewData: any) {
    const path = 'reviews';
    try {
      const docRef = reviewData.id ? doc(db, path, reviewData.id) : doc(collection(db, path));
      const now = new Date().toISOString();
      const payload = {
        ...reviewData,
        id: docRef.id,
        createdAt: reviewData.createdAt || now,
        updatedAt: reviewData.updatedAt || now,
      };
      await setDoc(docRef, payload);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateReview(reviewId: string, updateData: any) {
    const path = `reviews/${reviewId}`;
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteReview(reviewId: string) {
    const path = `reviews/${reviewId}`;
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- QUESTION PAPERS, MCQ EXAMS & ANSWERBOOK SUBMISSIONS ---
  async getQuestionPapers(options?: { onlyVerified?: boolean; createdById?: string }) {
    const path = 'exam_question_papers';
    try {
      if (options?.onlyVerified && options?.createdById) {
        const [verifiedSnap, ownSnap] = await Promise.all([
          getDocs(query(collection(db, path), where('mdVerificationStatus', '==', 'VERIFIED'))),
          getDocs(query(collection(db, path), where('createdById', '==', options.createdById))),
        ]);
        const merged = new Map<string, any>();
        verifiedSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
        ownSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
        return Array.from(merged.values()).sort((a: any, b: any) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
      }

      if (options?.onlyVerified) {
        const q = query(collection(db, path), where('mdVerificationStatus', '==', 'VERIFIED'));
        const snapshot = await getDocs(q);
        return snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
      }

      if (options?.createdById) {
        const q = query(collection(db, path), where('createdById', '==', options.createdById));
        const snapshot = await getDocs(q);
        return snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
      }

      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createQuestionPaper(paperData: any) {
    const path = 'exam_question_papers';
    try {
      const docRef = paperData.id ? doc(db, path, paperData.id) : doc(collection(db, path));
      const now = new Date().toISOString();
      await setDoc(docRef, {
        ...paperData,
        id: docRef.id,
        createdAt: paperData.createdAt || now,
        updatedAt: paperData.updatedAt || now,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateQuestionPaper(paperId: string, updateData: any) {
    const path = `exam_question_papers/${paperId}`;
    try {
      await updateDoc(doc(db, 'exam_question_papers', paperId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getMcqExams(options?: { onlyVerified?: boolean; createdById?: string }) {
    const path = 'mcq_exams';
    try {
      if (options?.onlyVerified && options?.createdById) {
        const [verifiedSnap, ownSnap] = await Promise.all([
          getDocs(query(collection(db, path), where('mdVerificationStatus', '==', 'VERIFIED'))),
          getDocs(query(collection(db, path), where('createdById', '==', options.createdById))),
        ]);
        const merged = new Map<string, any>();
        verifiedSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
        ownSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
        return Array.from(merged.values()).sort((a: any, b: any) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
      }

      if (options?.onlyVerified) {
        const q = query(collection(db, path), where('mdVerificationStatus', '==', 'VERIFIED'));
        const snapshot = await getDocs(q);
        return snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
      }

      if (options?.createdById) {
        const q = query(collection(db, path), where('createdById', '==', options.createdById));
        const snapshot = await getDocs(q);
        return snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
      }

      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createMcqExam(examData: any) {
    const path = 'mcq_exams';
    try {
      const docRef = examData.id ? doc(db, path, examData.id) : doc(collection(db, path));
      const now = new Date().toISOString();
      await setDoc(docRef, {
        ...examData,
        id: docRef.id,
        createdAt: examData.createdAt || now,
        updatedAt: examData.updatedAt || now,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateMcqExam(examId: string, updateData: any) {
    const path = `mcq_exams/${examId}`;
    try {
      await updateDoc(doc(db, 'mcq_exams', examId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getExamSubmissions(studentUid?: string) {
    const path = 'exam_submissions';
    try {
      const q = studentUid
        ? query(collection(db, path), where('userId', '==', studentUid))
        : query(collection(db, path), orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createExamSubmission(subData: any) {
    const path = 'exam_submissions';
    try {
      const docRef = subData.id ? doc(db, path, subData.id) : doc(collection(db, path));
      const now = new Date().toISOString();
      await setDoc(docRef, {
        ...subData,
        id: docRef.id,
        submittedAt: subData.submittedAt || now,
        updatedAt: subData.updatedAt || now,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExamSubmission(subId: string, updateData: any) {
    const path = `exam_submissions/${subId}`;
    try {
      await updateDoc(doc(db, 'exam_submissions', subId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // --- EXAMINATION ANNOUNCEMENTS ---
  async getExamAnnouncements(officialActiveOnly = true) {
    const path = 'exam_announcements';
    try {
      const q = officialActiveOnly
        ? query(
            collection(db, path),
            where('active', '==', true),
            where('approvalStatus', '==', 'OFFICIAL')
          )
        : query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) =>
          String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
        );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createExamAnnouncement(annData: any) {
    const path = 'exam_announcements';
    try {
      const docRef = annData.id ? doc(db, path, annData.id) : doc(collection(db, path));
      const now = new Date().toISOString();
      const sanitized = Object.fromEntries(
        Object.entries({
          ...annData,
          id: docRef.id,
          createdAt: annData.createdAt || now,
          updatedAt: annData.updatedAt || now,
        }).filter(([, value]) => value !== undefined)
      );
      await setDoc(docRef, sanitized);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExamAnnouncement(annId: string, updateData: any) {
    const path = `exam_announcements/${annId}`;
    try {
      const sanitized = Object.fromEntries(
        Object.entries({
          ...updateData,
          updatedAt: new Date().toISOString(),
        }).filter(([, value]) => value !== undefined)
      );
      await updateDoc(doc(db, 'exam_announcements', annId), sanitized);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteExamAnnouncement(annId: string) {
    const path = `exam_announcements/${annId}`;
    try {
      await deleteDoc(doc(db, 'exam_announcements', annId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // --- FRONT PAGE / SITE SETTINGS ---
  async getFrontPageConfig() {
    const path = 'site_settings/front_page';
    try {
      const snapshot = await getDoc(doc(db, 'site_settings', 'front_page'));
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (error?.code === 'unavailable' || msg.includes('client is offline')) {
        console.warn('Front page config cloud read skipped while offline; using local configuration.');
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async saveFrontPageConfig(config: any) {
    const path = 'site_settings/front_page';
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'site_settings', 'front_page'), {
        ...config,
        id: 'front_page',
        updatedAt: now,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // --- DYNAMIC QR CODE ATTENDANCE ---
  async createAttendanceQrSession(params: {
    classId: string;
    courseId: string;
    courseName?: string;
    subjectName?: string;
    date: string;
    hour: number;
    instructorId: string;
    instructorName?: string;
    ttlMinutes?: number;
  }): Promise<AttendanceQrSession> {
    const now = new Date();
    const ttlMs = (params.ttlMinutes || 5) * 60 * 1000;
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const id = `qrs-${Date.now()}-${randomPart.toLowerCase()}`;
    const token = `SMA-${randomPart}`;

    const session: AttendanceQrSession = {
      id,
      token,
      classId: params.classId,
      courseId: params.courseId,
      courseName: params.courseName || 'Academy Lecture',
      subjectName: params.subjectName || 'Live Class Session',
      date: params.date,
      hour: Number(params.hour) || 1,
      instructorId: params.instructorId,
      instructorName: params.instructorName || 'Instructor',
      active: true,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      createdAt: now.toISOString(),
    };

    // Always persist in localStorage DB so same-browser or local sessions work immediately
    const existingLocal = SwanayaDatabase.get<AttendanceQrSession[]>('attendanceQrSessions') || [];
    const updatedLocal = [
      session,
      ...existingLocal.map((s) =>
        s.classId === session.classId && s.hour === session.hour && s.date === session.date
          ? { ...s, active: false }
          : s
      ),
    ];
    SwanayaDatabase.set('attendanceQrSessions', updatedLocal);

    // Sync to Firestore when Firebase Auth user is active
    if (auth.currentUser) {
      try {
        const cleanPayload: Record<string, any> = {
          id: session.id,
          token: session.token,
          classId: session.classId,
          courseId: session.courseId,
          courseName: session.courseName,
          subjectName: session.subjectName,
          date: session.date,
          hour: session.hour,
          instructorId: auth.currentUser.uid,
          instructorName: session.instructorName,
          active: true,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
        };
        await setDoc(doc(db, 'attendance_qr_sessions', session.id), cleanPayload);
      } catch (err: any) {
        console.warn('Firestore QR session sync fallback to local:', err?.message || err);
      }
    }

    return session;
  },

  async expireAttendanceQrSession(sessionId: string): Promise<void> {
    const existingLocal = SwanayaDatabase.get<AttendanceQrSession[]>('attendanceQrSessions') || [];
    const updatedLocal = existingLocal.map((s) => (s.id === sessionId ? { ...s, active: false } : s));
    SwanayaDatabase.set('attendanceQrSessions', updatedLocal);

    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'attendance_qr_sessions', sessionId), { active: false });
      } catch (err: any) {
        console.warn('Firestore QR session expire notice:', err?.message || err);
      }
    }
  },

  subscribeActiveQrSessions(
    onData: (sessions: AttendanceQrSession[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const mergeAndEmit = (cloudSessions: AttendanceQrSession[]) => {
      const localSessions = SwanayaDatabase.get<AttendanceQrSession[]>('attendanceQrSessions') || [];
      const map = new Map<string, AttendanceQrSession>();
      localSessions.forEach((s) => s?.id && map.set(s.id, s));
      cloudSessions.forEach((s) => s?.id && map.set(s.id, s));
      const nowMs = Date.now();
      const activeList = Array.from(map.values())
        .filter((s) => s.active && new Date(s.expiresAt).getTime() > nowMs)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      onData(activeList);
    };

    // Immediate emit from local storage
    mergeAndEmit([]);

    const handleStorageOrSave = () => mergeAndEmit([]);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageOrSave);
      window.addEventListener('sma-autosave', handleStorageOrSave);
    }

    let unsubFirestore = () => {};
    if (auth.currentUser) {
      try {
        const q = query(collection(db, 'attendance_qr_sessions'), where('active', '==', true));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceQrSession));
            mergeAndEmit(list);
          },
          (err) => {
            console.warn('QR sessions Firestore listener notice:', err?.message);
            if (onError) onError(err);
            mergeAndEmit([]);
          }
        );
      } catch (err: any) {
        console.warn('Unable to attach QR session listener:', err?.message);
      }
    }

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageOrSave);
        window.removeEventListener('sma-autosave', handleStorageOrSave);
      }
    };
  },

  subscribeAttendanceCheckIns(
    sessionId: string,
    onData: (checkins: AttendanceCheckIn[]) => void
  ): () => void {
    if (!sessionId) {
      onData([]);
      return () => {};
    }

    const mergeAndEmit = (cloudList: AttendanceCheckIn[]) => {
      const localList = (SwanayaDatabase.get<AttendanceCheckIn[]>('attendanceCheckins') || []).filter(
        (c) => c.sessionId === sessionId
      );
      const map = new Map<string, AttendanceCheckIn>();
      localList.forEach((c) => c?.id && map.set(c.id, c));
      cloudList.forEach((c) => c?.id && map.set(c.id, c));
      const merged = Array.from(map.values()).sort((a, b) =>
        String(b.checkedInAt).localeCompare(String(a.checkedInAt))
      );
      onData(merged);
    };

    mergeAndEmit([]);

    const handleLocalUpdate = () => mergeAndEmit([]);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleLocalUpdate);
      window.addEventListener('sma-autosave', handleLocalUpdate);
    }

    let unsubFirestore = () => {};
    if (auth.currentUser) {
      try {
        const q = query(collection(db, 'attendance_checkins'), where('sessionId', '==', sessionId));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceCheckIn));
            mergeAndEmit(list);
          },
          (err) => {
            console.warn('Attendance check-in listener notice:', err?.message);
            mergeAndEmit([]);
          }
        );
      } catch (err: any) {
        console.warn('Unable to attach check-in listener:', err?.message);
      }
    }

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleLocalUpdate);
        window.removeEventListener('sma-autosave', handleLocalUpdate);
      }
    };
  },

  async findQrSessionByTokenOrPayload(rawInput: string): Promise<AttendanceQrSession | null> {
    const trimmed = String(rawInput || '').trim();
    if (!trimmed) return null;

    let targetSessionId = '';
    let targetToken = trimmed.toUpperCase();

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (parsed.sessionId) targetSessionId = String(parsed.sessionId).trim();
        if (parsed.token) targetToken = String(parsed.token).trim().toUpperCase();
      }
    } catch {
      // Plain token string like SMA-AB12CD
    }

    const localSessions = SwanayaDatabase.get<AttendanceQrSession[]>('attendanceQrSessions') || [];
    const localMatch = localSessions.find(
      (s) =>
        (targetSessionId && s.id === targetSessionId) ||
        s.token.toUpperCase() === targetToken
    );
    if (localMatch) return localMatch;

    if (auth.currentUser) {
      try {
        if (targetSessionId) {
          const snap = await getDoc(doc(db, 'attendance_qr_sessions', targetSessionId));
          if (snap.exists()) {
            return { id: snap.id, ...snap.data() } as AttendanceQrSession;
          }
        }
        const q = query(collection(db, 'attendance_qr_sessions'), where('token', '==', targetToken));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          return { id: d.id, ...d.data() } as AttendanceQrSession;
        }
      } catch (err: any) {
        console.warn('Firestore QR lookup fallback:', err?.message);
      }
    }

    return null;
  },

  async submitQrAttendanceCheckIn(params: {
    session: AttendanceQrSession;
    student: Student;
    userId: string;
  }): Promise<{ ok: boolean; duplicate?: boolean; message: string; checkIn?: AttendanceCheckIn }> {
    const { session, student, userId } = params;
    const now = new Date();

    if (!session.active) {
      return { ok: false, message: 'This attendance QR session has been closed by the instructor.' };
    }
    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, message: 'This dynamic QR code has expired. Please scan the newly rotated QR code.' };
    }

    const allAttendance = SwanayaDatabase.get<AttendanceRecord[]>('attendance') || [];
    const existingRecord = allAttendance.some(
      (r) =>
        r.classId === session.classId &&
        r.studentId === student.id &&
        r.hour === session.hour &&
        r.date === session.date
    );

    const localCheckins = SwanayaDatabase.get<AttendanceCheckIn[]>('attendanceCheckins') || [];
    const existingCheckin = localCheckins.some(
      (c) =>
        c.studentId === student.id &&
        ((c.sessionId === session.id) ||
          (c.classId === session.classId && c.hour === session.hour && c.date === session.date))
    );

    if (existingRecord || existingCheckin) {
      return {
        ok: false,
        duplicate: true,
        message: `Attendance already marked for ${session.subjectName || 'this session'} (Hour ${session.hour} on ${session.date}).`,
      };
    }

    const checkIn: AttendanceCheckIn = {
      id: `chk-${session.id}-${student.id}`,
      sessionId: session.id,
      token: session.token,
      classId: session.classId,
      courseId: session.courseId,
      date: session.date,
      hour: Number(session.hour) || 1,
      studentId: student.id,
      studentName: student.name,
      userId: auth.currentUser?.uid || userId,
      status: 'PRESENT',
      checkedInAt: now.toISOString(),
    };

    // Sync to Firestore if signed in
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'attendance_checkins', checkIn.id), checkIn);
      } catch (err: any) {
        console.warn('Firestore check-in write notice:', err?.message || err);
      }
    }

    // Update local Check-Ins list
    SwanayaDatabase.set('attendanceCheckins', [checkIn, ...localCheckins]);

    // Save into hourly AttendanceRecord & recalculate attendance percentage
    const newAttendanceRecord: AttendanceRecord = {
      id: `att-${session.classId}-${student.id}-${session.hour}-${Date.now()}`,
      classId: session.classId,
      studentId: student.id,
      status: 'PRESENT',
      date: session.date,
      hour: Number(session.hour) || 1,
    };
    const finalAttendance = [...allAttendance, newAttendanceRecord];
    SwanayaDatabase.set('attendance', finalAttendance);

    const studentRecords = finalAttendance.filter((r) => r.studentId === student.id);
    const presents = studentRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const rate = studentRecords.length > 0 ? Math.round((presents / studentRecords.length) * 100) : 100;

    const allStudents = SwanayaDatabase.get<Student[]>('students') || [];
    const updatedStudents = allStudents.map((s) =>
      s.id === student.id ? { ...s, attendancePercentage: rate } : s
    );
    SwanayaDatabase.set('students', updatedStudents);

    SwanayaDatabase.log(
      student.email,
      student.name,
      'ATTENDANCE_QR_SCAN',
      `Student marked PRESENT via Dynamic QR (${session.token}) for ${session.subjectName || session.classId} · Hour ${session.hour}`
    );

    return {
      ok: true,
      checkIn,
      message: `Present marked for ${session.subjectName || session.courseName} (Hour ${session.hour}) via token ${session.token}.`,
    };
  },

  // --- LIVE CLASS GOOGLE MEET & WHATSAPP GROUP MANAGEMENT ---
  subscribeClassSessions(options: {
    includeInactive?: boolean;
    courseId?: string;
    onData: (sessions: LiveClassSession[]) => void;
    onError?: (error: Error) => void;
  }): () => void {
    const { includeInactive = false, courseId, onData, onError } = options;

    const normalizeItem = (item: any): LiveClassSession => {
      const meet = normalizeGoogleMeetUrl(item?.googleMeetUrl || item?.meetingLink || '');
      const wa = normalizeWhatsappUrl(item?.whatsappGroupUrl || '');
      return {
        id: String(item?.id || `cls-${Date.now()}`),
        title: String(item?.title || item?.subjectName || item?.courseName || 'Live Class Session'),
        courseId: String(item?.courseId || 'general'),
        courseCode: item?.courseCode ? String(item.courseCode) : '',
        courseName: item?.courseName ? String(item.courseName) : '',
        batchId: String(item?.batchId || 'b-1'),
        batchName: item?.batchName ? String(item.batchName) : '',
        subjectId: String(item?.subjectId || ''),
        subjectName: item?.subjectName ? String(item.subjectName) : '',
        instructorId: String(item?.instructorId || 'inst-1'),
        instructorName: item?.instructorName ? String(item.instructorName) : '',
        date: String(item?.date || new Date().toISOString().split('T')[0]),
        startTime: String(item?.startTime || '10:00 AM'),
        endTime: String(item?.endTime || '11:30 AM'),
        room: String(item?.room || (meet ? 'Google Meet Studio' : 'Main Campus')),
        type: (['ONLINE', 'HYBRID', 'PHYSICAL', 'WORKSHOP', 'LAB', 'HACKATHON'].includes(String(item?.type))
          ? item.type
          : 'HYBRID') as ClassSchedule['type'],
        meetingLink: meet,
        googleMeetUrl: meet,
        whatsappGroupUrl: wa,
        whatsappGroupName: item?.whatsappGroupName ? String(item.whatsappGroupName) : '',
        facultyWhatsapp: item?.facultyWhatsapp ? normalizeWhatsappUrl(item.facultyWhatsapp) : '',
        notes: item?.notes ? String(item.notes) : '',
        isActive: item?.isActive !== false,
        createdById: String(item?.createdById || 'system'),
        createdAt: String(item?.createdAt || new Date().toISOString()),
        updatedAt: String(item?.updatedAt || new Date().toISOString()),
      };
    };

    const mergeAndEmit = (cloudList: LiveClassSession[]) => {
      const localList = (SwanayaDatabase.get<ClassSchedule[]>('classes') || []).map(normalizeItem);
      const map = new Map<string, LiveClassSession>();
      localList.forEach((s) => map.set(s.id, s));
      cloudList.forEach((s) => map.set(s.id, normalizeItem(s)));

      const result = Array.from(map.values())
        .filter((s) => (includeInactive ? true : s.isActive !== false))
        .filter((s) => (!courseId || courseId === 'ALL' ? true : s.courseId === courseId))
        .sort((a, b) => String(b.updatedAt || b.date).localeCompare(String(a.updatedAt || a.date)));
      onData(result);
    };

    mergeAndEmit([]);

    const handleLocalUpdate = () => mergeAndEmit([]);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleLocalUpdate);
      window.addEventListener('sma-autosave', handleLocalUpdate);
    }

    let unsubFirestore = () => {};
    if (auth.currentUser) {
      try {
        const baseRef = collection(db, 'class_sessions');
        const q = includeInactive ? query(baseRef) : query(baseRef, where('isActive', '==', true));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => normalizeItem({ id: d.id, ...d.data() }));
            mergeAndEmit(list);
          },
          (err) => {
            console.warn('Firestore class_sessions listener notice:', err?.message);
            if (onError) onError(err instanceof Error ? err : new Error(String(err)));
            mergeAndEmit([]);
          }
        );
      } catch (err: any) {
        console.warn('Unable to attach class_sessions listener:', err?.message);
      }
    }

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleLocalUpdate);
        window.removeEventListener('sma-autosave', handleLocalUpdate);
      }
    };
  },

  async saveClassSession(input: {
    id?: string;
    existingCreatedAt?: string;
    existingCreatedById?: string;
    title: string;
    courseId: string;
    courseCode?: string;
    courseName?: string;
    batchId: string;
    batchName?: string;
    subjectId?: string;
    subjectName?: string;
    instructorId?: string;
    instructorName?: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
    type: ClassSchedule['type'];
    googleMeetUrl?: string;
    whatsappGroupUrl?: string;
    whatsappGroupName?: string;
    facultyWhatsapp?: string;
    notes?: string;
    isActive?: boolean;
  }): Promise<{ session: LiveClassSession; syncedCloud: boolean }> {
    const now = new Date().toISOString();
    const id = input.id && /^[a-zA-Z0-9_-]+$/.test(input.id) ? input.id : `cls-${Date.now()}`;
    const googleMeetUrl = normalizeGoogleMeetUrl(input.googleMeetUrl);
    const whatsappGroupUrl = normalizeWhatsappUrl(input.whatsappGroupUrl);
    const facultyWhatsapp = normalizeWhatsappUrl(input.facultyWhatsapp);

    const payload: LiveClassSession = {
      id,
      title: input.title.trim().slice(0, 240),
      courseId: (input.courseId || 'general').trim().slice(0, 128),
      courseCode: (input.courseCode || '').trim().slice(0, 64),
      courseName: (input.courseName || '').trim().slice(0, 240),
      batchId: (input.batchId || 'b-1').trim().slice(0, 128),
      batchName: (input.batchName || '').trim().slice(0, 160),
      subjectId: (input.subjectId || '').trim().slice(0, 128),
      subjectName: (input.subjectName || '').trim().slice(0, 200),
      instructorId: (input.instructorId || 'inst-1').trim().slice(0, 128),
      instructorName: (input.instructorName || 'Faculty').trim().slice(0, 150),
      date: input.date.trim().slice(0, 32),
      startTime: input.startTime.trim().slice(0, 32),
      endTime: input.endTime.trim().slice(0, 32),
      room: (input.room || (googleMeetUrl ? 'Google Meet Classroom' : 'Campus Studio')).trim().slice(0, 160),
      type: input.type,
      meetingLink: googleMeetUrl,
      googleMeetUrl,
      whatsappGroupUrl,
      whatsappGroupName: (input.whatsappGroupName || '').trim().slice(0, 160),
      facultyWhatsapp,
      notes: (input.notes || '').trim().slice(0, 2000),
      isActive: input.isActive !== false,
      createdById: input.existingCreatedById || auth.currentUser?.uid || 'local-faculty',
      createdAt: input.existingCreatedAt || now,
      updatedAt: now,
    };

    const existingLocal = SwanayaDatabase.get<ClassSchedule[]>('classes') || [];
    const nextLocal = [payload, ...existingLocal.filter((c) => c.id !== payload.id)];
    SwanayaDatabase.set('classes', nextLocal);

    let syncedCloud = false;
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'class_sessions', payload.id), payload);
        syncedCloud = true;
      } catch (err: any) {
        handleFirestoreError(err, input.id ? OperationType.UPDATE : OperationType.CREATE, `class_sessions/${payload.id}`);
        throw err;
      }
    }

    return { session: payload, syncedCloud };
  },

  async toggleClassSessionActive(session: LiveClassSession, isActive: boolean): Promise<void> {
    const now = new Date().toISOString();
    const updated: LiveClassSession = {
      ...session,
      isActive,
      updatedAt: now,
    };
    const existingLocal = SwanayaDatabase.get<ClassSchedule[]>('classes') || [];
    SwanayaDatabase.set(
      'classes',
      existingLocal.map((c) => (c.id === session.id ? updated : c))
    );

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'class_sessions', session.id), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `class_sessions/${session.id}`);
        throw err;
      }
    }
  },

  async deleteClassSession(sessionId: string): Promise<void> {
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'class_sessions', sessionId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `class_sessions/${sessionId}`);
        throw err;
      }
    }
    const existingLocal = SwanayaDatabase.get<ClassSchedule[]>('classes') || [];
    SwanayaDatabase.set(
      'classes',
      existingLocal.filter((c) => c.id !== sessionId)
    );
  },

  // --- MANAGING DIRECTOR (MD) EXCLUSIVE ADMIN ACCESS MANAGEMENT ---
  async findActiveAdminGrantByEmail(email: string): Promise<AdminGrant | null> {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;

    if (auth.currentUser) {
      try {
        const q = query(
          collection(db, 'admin_grants'),
          where('email', '==', cleanEmail),
          where('status', '==', 'ACTIVE')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return { id: snap.docs[0].id, ...snap.docs[0].data() } as AdminGrant;
        }
      } catch {
        // Fallback to local / backend check
      }
    }

    const localUsers = SwanayaDatabase.get<User[]>('users') || [];
    const matchedLocal = localUsers.find(
      (u) =>
        String(u.email || '').trim().toLowerCase() === cleanEmail &&
        u.status === 'ACTIVE' &&
        ['ADMIN', 'ACADEMIC_ADMIN'].includes(String(u.role || '').toUpperCase())
    );
    if (matchedLocal) {
      return {
        id: matchedLocal.grantId || matchedLocal.id,
        email: cleanEmail,
        username: matchedLocal.username,
        name: matchedLocal.name,
        role: matchedLocal.role === 'ACADEMIC_ADMIN' ? 'ACADEMIC_ADMIN' : 'ADMIN',
        phone: matchedLocal.phone,
        status: 'ACTIVE',
        grantedByUid: 'usr-md',
        createdAt: matchedLocal.createdAt || new Date().toISOString(),
        updatedAt: matchedLocal.updatedAt || new Date().toISOString(),
      };
    }

    return null;
  },

  subscribeAdminGrants(options: {
    onData: (grants: AdminGrant[]) => void;
    onError?: (err: Error) => void;
  }): () => void {
    const hydrateLocal = (): AdminGrant[] => {
      const localUsers = SwanayaDatabase.get<User[]>('users') || [];
      return localUsers
        .filter((u) => ['ADMIN', 'ACADEMIC_ADMIN'].includes(String(u.role || '').toUpperCase()))
        .map((u) => ({
          id: u.grantId || u.id,
          email: String(u.email || '').toLowerCase(),
          username: u.username,
          name: u.name,
          role: u.role === 'ACADEMIC_ADMIN' ? 'ACADEMIC_ADMIN' : 'ADMIN',
          phone: u.phone,
          status: u.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          grantedByUid: 'usr-md',
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
        }));
    };

    if (!auth.currentUser) {
      options.onData(hydrateLocal());
      return () => {};
    }

    const unsub = onSnapshot(
      collection(db, 'admin_grants'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AdminGrant))
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        options.onData(list);
      },
      (err) => {
        options.onData(hydrateLocal());
        options.onError?.(err);
      }
    );
    return unsub;
  },

  async createAdminFromMd(input: {
    name: string;
    email: string;
    username?: string;
    phone?: string;
    role: 'ADMIN' | 'ACADEMIC_ADMIN';
    grantedByUser: User;
  }): Promise<{ grant: AdminGrant; user: User; syncedCloud: boolean }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanUsername = (input.username || cleanEmail.split('@')[0] || 'admin')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    const now = new Date().toISOString();
    const grantId = `grant_${cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 80)}`;
    const preUserId = `usr_${grantId}`;

    const grant: AdminGrant = {
      id: grantId,
      email: cleanEmail,
      username: cleanUsername,
      name: input.name.trim(),
      role: input.role,
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      status: 'ACTIVE',
      grantedByUid: auth.currentUser?.uid || input.grantedByUser.id,
      grantedByName: input.grantedByUser.name || 'Managing Director',
      grantedByEmail: input.grantedByUser.email || '',
      createdAt: now,
      updatedAt: now,
    };

    const userRecord: User = {
      id: preUserId,
      username: cleanUsername,
      email: cleanEmail,
      name: input.name.trim(),
      role: input.role,
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name.trim())}`,
      status: 'ACTIVE',
      isVerified: true,
      grantId,
      createdAt: now.split('T')[0],
      updatedAt: now,
    };

    let syncedCloud = false;
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'admin_grants', grantId), grant);
        await setDoc(doc(db, 'users', preUserId), sanitizeUserDoc(userRecord));
        syncedCloud = true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `admin_grants/${grantId}`);
        throw err;
      }
    }

    const existingUsers = SwanayaDatabase.get<User[]>('users') || [];
    const filtered = existingUsers.filter(
      (u) => u.id !== preUserId && String(u.email || '').trim().toLowerCase() !== cleanEmail
    );
    SwanayaDatabase.set('users', [...filtered, userRecord]);

    await academyService.syncProfileToCloud(userRecord).catch(() => {});
    return { grant, user: userRecord, syncedCloud };
  },

  async toggleAdminGrantStatus(grant: AdminGrant, nextStatus: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const now = new Date().toISOString();
    const updatedGrant: AdminGrant = {
      ...grant,
      status: nextStatus,
      updatedAt: now,
    };

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'admin_grants', grant.id), updatedGrant);
        const q = query(collection(db, 'users'), where('email', '==', grant.email.toLowerCase()));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          if (['ADMIN', 'ACADEMIC_ADMIN'].includes(String(d.role || '').toUpperCase())) {
            await updateDoc(doc(db, 'users', docSnap.id), { status: nextStatus, updatedAt: now });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `admin_grants/${grant.id}`);
        throw err;
      }
    }

    const existingUsers = SwanayaDatabase.get<User[]>('users') || [];
    const updatedUsers = existingUsers.map((u) =>
      String(u.email || '').trim().toLowerCase() === grant.email.toLowerCase()
        ? { ...u, status: nextStatus, updatedAt: now }
        : u
    );
    SwanayaDatabase.set('users', updatedUsers);

    const matchedUser = updatedUsers.find(
      (u) => String(u.email || '').trim().toLowerCase() === grant.email.toLowerCase()
    );
    if (matchedUser) {
      await academyService.syncProfileToCloud(matchedUser).catch(() => {});
    }
  },

  async removeAdminGrantAndUser(grant: AdminGrant): Promise<void> {
    const cleanEmail = grant.email.trim().toLowerCase();
    const preUserId = `usr_${grant.id}`;

    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'admin_grants', grant.id));
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          if (['ADMIN', 'ACADEMIC_ADMIN'].includes(String(d.role || '').toUpperCase())) {
            if (docSnap.id !== auth.currentUser.uid) {
              await deleteDoc(doc(db, 'users', docSnap.id));
            }
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `admin_grants/${grant.id}`);
        throw err;
      }
    }

    const existingUsers = SwanayaDatabase.get<User[]>('users') || [];
    SwanayaDatabase.set(
      'users',
      existingUsers.filter(
        (u) =>
          u.id !== preUserId &&
          u.grantId !== grant.id &&
          !(
            String(u.email || '').trim().toLowerCase() === cleanEmail &&
            ['ADMIN', 'ACADEMIC_ADMIN'].includes(String(u.role || '').toUpperCase())
          )
      )
    );

    try {
      await fetch('/api/sync/admin-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: preUserId, email: cleanEmail, grantId: grant.id }),
      });
    } catch {
      // Ignore offline server sync errors
    }
  },

  // --- SECURE EMAIL VERIFICATION, PASSWORD RESET & SESSION API ---
  async registerAccount(payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: 'STUDENT' | 'INSTRUCTOR';
    phone?: string;
    whatsappPhone?: string;
    whatsappOptIn?: boolean;
    courseId?: string;
  }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Registration failed.'), { code: data?.code, status: res.status });
    }
    return data;
  },

  async verifyEmailToken(token: string) {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Verification failed.'), {
        code: data?.code,
        email: data?.email,
        canResend: data?.canResend,
        status: res.status,
      });
    }
    return data;
  },

  async resendVerificationEmail(email: string) {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Could not resend verification email.'), {
        retryAfterSec: data?.retryAfterSec,
        status: res.status,
      });
    }
    return data;
  },

  async loginWithCredentials(payload: {
    identifier: string;
    password: string;
    portalTab: 'ADMIN' | 'TUTOR' | 'STUDENT';
  }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Sign-in failed.'), {
        code: data?.code,
        requiresVerification: data?.requiresVerification,
        email: data?.email,
        status: res.status,
      });
    }
    if (data?.user) {
      const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
      const idx = currentUsers.findIndex((u) => u.id === data.user.id || u.email?.toLowerCase() === data.user.email?.toLowerCase());
      if (idx >= 0) currentUsers[idx] = { ...currentUsers[idx], ...data.user };
      else currentUsers.push(data.user);
      SwanayaDatabase.set('users', currentUsers);
    }
    if (data?.student) {
      const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
      const idx = currentStudents.findIndex((s) => s.id === data.student.id || s.userId === data.student.userId);
      if (idx >= 0) currentStudents[idx] = { ...currentStudents[idx], ...data.student };
      else currentStudents.push(data.student);
      SwanayaDatabase.set('students', currentStudents);
    }
    if (data?.instructor) {
      const currentInst = SwanayaDatabase.get<Instructor[]>('instructors') || [];
      const idx = currentInst.findIndex((i) => i.id === data.instructor.id || i.userId === data.instructor.userId);
      if (idx >= 0) currentInst[idx] = { ...currentInst[idx], ...data.instructor };
      else currentInst.push(data.instructor);
      SwanayaDatabase.set('instructors', currentInst);
    }
    return data;
  },

  async reauthenticateWithCredentials(payload: {
    identifier: string;
    password: string;
    expectedUserId?: string;
    requireSameUser?: boolean;
    portalTab?: 'ADMIN' | 'TUTOR' | 'STUDENT';
  }) {
    const res = await fetch('/api/auth/reauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        identifier: payload.identifier,
        username: payload.identifier,
        password: payload.password,
        expectedUserId: payload.expectedUserId,
        requireSameUser: payload.requireSameUser,
        portalTab: payload.portalTab,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Re-authentication failed.'), {
        code: data?.code,
        status: res.status,
      });
    }
    if (data?.user) {
      const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
      const idx = currentUsers.findIndex((u) => u.id === data.user.id || u.email?.toLowerCase() === data.user.email?.toLowerCase());
      if (idx >= 0) currentUsers[idx] = { ...currentUsers[idx], ...data.user };
      else currentUsers.push(data.user);
      SwanayaDatabase.set('users', currentUsers);
    }
    if (data?.student) {
      const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
      const idx = currentStudents.findIndex((s) => s.id === data.student.id || s.userId === data.student.userId);
      if (idx >= 0) currentStudents[idx] = { ...currentStudents[idx], ...data.student };
      else currentStudents.push(data.student);
      SwanayaDatabase.set('students', currentStudents);
    }
    if (data?.instructor) {
      const currentInst = SwanayaDatabase.get<Instructor[]>('instructors') || [];
      const idx = currentInst.findIndex((i) => i.id === data.instructor.id || i.userId === data.instructor.userId);
      if (idx >= 0) currentInst[idx] = { ...currentInst[idx], ...data.instructor };
      else currentInst.push(data.instructor);
      SwanayaDatabase.set('instructors', currentInst);
    }
    return data;
  },

  async establishFirebaseBackendSession(payload: {
    userId: string;
    email: string;
    role: string;
    emailVerified: boolean;
  }) {
    const res = await fetch('/api/auth/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async logoutBackendSession() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  },

  async getCurrentSessionUser(): Promise<User | null> {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.success && data?.user ? (data.user as User) : null;
    } catch {
      return null;
    }
  },

  async requestPasswordReset(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not initiate password reset.');
    }
    return data;
  },

  async completePasswordReset(token: string, newPassword: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Password reset failed.'), { code: data?.code, status: res.status });
    }
    return data;
  },

  async requestEmailChange(userId: string, currentEmail: string, newEmail: string) {
    const res = await fetch('/api/auth/request-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, currentEmail, newEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not start email change verification.');
    }
    return data;
  },

  async confirmEmailChange(token: string) {
    const res = await fetch('/api/auth/confirm-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Email change verification failed.'), { code: data?.code, status: res.status });
    }
    return data;
  },

  async approvePendingTutor(payload: {
    tutorUserId: string;
    decision: 'APPROVED' | 'REJECTED';
    adminEmail?: string;
    adminName?: string;
  }) {
    const res = await fetch('/api/auth/admin-approve-tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not update tutor approval status.');
    }
    return data;
  },

  async getAuthAuditLogs() {
    const res = await fetch('/api/auth/audit-logs', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not load authentication audit logs.');
    }
    return Array.isArray(data?.auditLogs) ? data.auditLogs : [];
  },

  // --- PHONE / WHATSAPP 6-DIGIT VERIFICATION & NUMBER SWITCHING ---
  async getAcademyVerificationPhone(): Promise<{ academyVerificationPhone: string; defaultChannel: 'WHATSAPP' | 'PHONE' }> {
    try {
      const res = await fetch('/api/settings/verification-phone', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.settings) return data.settings;
    } catch {
      // fallback
    }
    return { academyVerificationPhone: '+91 94460 55555', defaultChannel: 'WHATSAPP' };
  },

  async updateAcademyVerificationPhone(payload: {
    academyVerificationPhone: string;
    defaultChannel?: 'WHATSAPP' | 'PHONE';
    updatedBy?: string;
  }) {
    const res = await fetch('/api/settings/verification-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not update verification phone number.');
    }
    return data;
  },

  async sendPhoneVerificationCode(payload: {
    phone: string;
    channel?: 'WHATSAPP' | 'PHONE';
    purpose?: 'REGISTER' | 'COURSE_REGISTER' | 'CHANGE_NUMBER' | 'LOGIN';
    userId?: string;
    email?: string;
  }) {
    const res = await fetch('/api/auth/send-phone-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Failed to send verification code.'), {
        retryAfterSec: data?.retryAfterSec,
        status: res.status,
      });
    }
    return data;
  },

  async verifyPhoneCode(payload: {
    phone: string;
    code: string;
    channel?: 'WHATSAPP' | 'PHONE';
    purpose?: 'REGISTER' | 'COURSE_REGISTER' | 'CHANGE_NUMBER' | 'LOGIN';
    userId?: string;
    email?: string;
  }) {
    const res = await fetch('/api/auth/verify-phone-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error || 'Invalid or expired verification code.'), {
        code: data?.code,
        status: res.status,
      });
    }
    if (data?.user) {
      const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
      const idx = currentUsers.findIndex((u) => u.id === data.user.id || u.email?.toLowerCase() === data.user.email?.toLowerCase());
      if (idx >= 0) currentUsers[idx] = { ...currentUsers[idx], ...data.user };
      else currentUsers.push(data.user);
      SwanayaDatabase.set('users', currentUsers);
    }
    if (data?.student) {
      const currentStudents = SwanayaDatabase.get<Student[]>('students') || [];
      const idx = currentStudents.findIndex((s) => s.id === data.student.id || s.userId === data.student.userId);
      if (idx >= 0) currentStudents[idx] = { ...currentStudents[idx], ...data.student };
      else currentStudents.push(data.student);
      SwanayaDatabase.set('students', currentStudents);
    }
    return data;
  },

  async changeVerificationPhone(payload: {
    userId?: string;
    email?: string;
    newPhone: string;
    channel?: 'WHATSAPP' | 'PHONE';
    purpose?: 'REGISTER' | 'COURSE_REGISTER' | 'CHANGE_NUMBER' | 'LOGIN';
    sendCode?: boolean;
  }) {
    const res = await fetch('/api/auth/change-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to change verification number.');
    }
    if (data?.user) {
      const currentUsers = SwanayaDatabase.get<User[]>('users') || [];
      const idx = currentUsers.findIndex((u) => u.id === data.user.id);
      if (idx >= 0) {
        currentUsers[idx] = { ...currentUsers[idx], ...data.user };
        SwanayaDatabase.set('users', currentUsers);
      }
    }
    return data;
  },

  async sendCourseRegistrationConfirmation(payload: {
    registrationId?: string;
    userId?: string;
    studentId?: string;
    studentName: string;
    studentEmail?: string;
    phone: string;
    channel?: 'WHATSAPP' | 'PHONE';
    courseId?: string;
    courseCode?: string;
    courseTitle: string;
    preferredBatch?: string;
    studyMode?: string;
    preferredSchedule?: string;
    qualification?: string;
    careerGoals?: string;
    source?: string;
    phoneVerified?: boolean;
  }) {
    const res = await fetch('/api/registrations/course-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not send confirmation message.');
    }
    return data;
  },

  async getRegistrationsQueue() {
    const res = await fetch('/api/registrations/queue', { cache: 'no-store', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to load registration queue.');
    }
    return data;
  },

  async acceptRegistrationDecision(payload: {
    targetType: 'USER' | 'COURSE_REGISTRATION' | 'APPLICATION';
    targetId: string;
    decision: 'ACCEPTED' | 'REJECTED';
    adminName?: string;
    adminEmail?: string;
    remarks?: string;
    registrationSnapshot?: any;
  }) {
    const res = await fetch('/api/registrations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Could not process registration acceptance.');
    }
    return data;
  },

  // --- Global Theme & Colour System ---
  async getGlobalThemeSettings(): Promise<AcademyThemeConfig | null> {
    const res = await fetch('/api/theme-settings', { cache: 'no-store', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to load theme settings.');
    }
    return data?.config || null;
  },

  async saveGlobalThemeSettings(config: AcademyThemeConfig): Promise<AcademyThemeConfig> {
    const res = await fetch('/api/theme-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ config }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to save theme settings.');
    }
    return data.config;
  },

  async resetGlobalThemeSettings(): Promise<AcademyThemeConfig> {
    const res = await fetch('/api/theme-settings/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to reset theme settings.');
    }
    return data.config;
  },

  // --- Major & Minor Course Management ---
  async getCourseManagementOverview(): Promise<{
    courses: Course[];
    categories: CourseCategory[];
    modules: CourseModuleItem[];
    credits: CourseCreditSpec[];
    tutorAllocations: TutorCourseAllocation[];
    selections: StudentCourseSelection[];
    enrollments: CourseEnrollmentRecord[];
    approvalLogs: CourseApprovalLog[];
    progressReports: TutorStudentProgressReport[];
    policy: CourseSelectionPolicy;
    tutors: Array<{ id: string; userId?: string; name: string; email?: string; qualification?: string; specialization?: string; status?: string; avatarUrl?: string }>;
    students: Student[];
  }> {
    const res = await fetch('/api/course-management/overview', {
      cache: 'no-store',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to load Major & Minor course catalogue.');
    }
    if (Array.isArray(data.courses)) SwanayaDatabase.set('courses', data.courses);
    if (Array.isArray(data.categories)) SwanayaDatabase.set('courseCategories', data.categories);
    if (Array.isArray(data.modules)) SwanayaDatabase.set('courseModules', data.modules);
    if (Array.isArray(data.credits)) SwanayaDatabase.set('courseCredits', data.credits);
    if (Array.isArray(data.tutorAllocations)) SwanayaDatabase.set('tutorCourseAllocations', data.tutorAllocations);
    if (Array.isArray(data.selections)) SwanayaDatabase.set('studentCourseSelections', data.selections);
    if (Array.isArray(data.enrollments)) SwanayaDatabase.set('courseEnrollments', data.enrollments);
    if (Array.isArray(data.approvalLogs)) SwanayaDatabase.set('courseApprovalLogs', data.approvalLogs);
    if (Array.isArray(data.progressReports)) SwanayaDatabase.set('tutorProgressReports', data.progressReports);
    if (data.policy) SwanayaDatabase.set('courseSelectionPolicy', data.policy);
    return data;
  },

  async saveManagedCourse(payload: Partial<Course> & { syllabusModules?: CourseModuleItem[] }) {
    const method = payload.id ? 'PUT' : 'POST';
    const endpoint = payload.id
      ? `/api/course-management/courses/${encodeURIComponent(payload.id)}`
      : '/api/course-management/courses';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to save course configuration.');
    }
    return data.course as Course;
  },

  async saveCourseCategory(payload: Partial<CourseCategory>) {
    const res = await fetch('/api/course-management/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to save category.');
    return data;
  },

  async updateCourseSelectionPolicy(policy: Partial<CourseSelectionPolicy>) {
    const res = await fetch('/api/course-management/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(policy),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to update course policy.');
    return data.policy as CourseSelectionPolicy;
  },

  async allocateTutorToCourse(payload: {
    courseId: string;
    tutorId: string;
    tutorName?: string;
    tutorEmail?: string;
    allocationRole?: 'LEAD' | 'CO_TUTOR';
  }) {
    const res = await fetch('/api/course-management/tutor-allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to allocate tutor.');
    return data;
  },

  async removeTutorAllocation(allocationId: string) {
    const res = await fetch(`/api/course-management/tutor-allocations/${encodeURIComponent(allocationId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to remove tutor allocation.');
    return data;
  },

  async submitStudentCourseSelection(payload: {
    majorCourseId: string;
    minorCourseIds: string[];
    mode: 'DRAFT' | 'SUBMITTED';
    remarks?: string;
    studentId?: string;
    studentName?: string;
  }) {
    const res = await fetch('/api/course-management/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to submit course selection.');
    return data.selection as StudentCourseSelection;
  },

  async reviewStudentCourseSelection(selectionId: string, decision: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUIRED' | 'UNDER_REVIEW', remarks?: string) {
    const res = await fetch(`/api/course-management/selections/${encodeURIComponent(selectionId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ decision, remarks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to review course selection.');
    return data;
  },

  async submitTutorProgressReport(payload: {
    studentId: string;
    studentName?: string;
    courseId: string;
    courseType: 'major' | 'minor';
    progressPercent: number;
    assessmentScore?: number;
    status: 'ON_TRACK' | 'NEEDS_SUPPORT' | 'COMPLETED';
    remarks?: string;
  }) {
    const res = await fetch('/api/course-management/tutor-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to submit progress report.');
    return data;
  },

  getCourseSelectionExportUrl(format: 'csv' | 'json' = 'csv') {
    return `/api/course-management/reports/export?format=${format}`;
  },
};
