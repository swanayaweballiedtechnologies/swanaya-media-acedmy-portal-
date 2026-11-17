import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
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
import { SwanayaDatabase, User, Student, Instructor, Course } from '../db/mockDb';

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
          const targetRef = doc(db, 'users', user.id);
          await setDoc(targetRef, user, { merge: true });
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
      await setDoc(doc(db, 'users', uid), { ...profile, id: uid, createdAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateUserProfile(uid: string, profile: any) {
    const path = `users/${uid}`;
    try {
      const targetRef = doc(db, 'users', uid);
      const existingSnap = await getDoc(targetRef);
      if (existingSnap.exists()) {
        await updateDoc(targetRef, {
          ...profile,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await setDoc(targetRef, {
          ...profile,
          id: uid,
          createdAt: profile.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

  // --- COURSES (ADMIN TO FRONTEND & MULTI-DEVICE PERSISTENCE) ---
  async getCourses(): Promise<Course[]> {
    let cloudCourses: Course[] = [];
    // 1. Fetch from server persistent store & Admin Firestore
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.courses) && data.courses.length > 0) {
          cloudCourses = data.courses;
        }
      }
    } catch (e) {
      console.warn('API courses fetch notice:', e);
    }

    // 2. Fallback to client Firestore if API was unreachable or empty
    if (cloudCourses.length === 0) {
      try {
        const q = query(collection(db, 'courses'));
        const snapshot = await getDocs(q);
        const fsCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
        if (fsCourses.length > 0) {
          cloudCourses = fsCourses;
        }
      } catch (err) {
        console.warn('Firestore direct getCourses notice:', err);
      }
    }

    // 3. Fallback to local store
    if (cloudCourses.length === 0) {
      cloudCourses = SwanayaDatabase.get<Course[]>('courses') || [];
    }

    // Always keep local storage updated so front-end components have instant access
    if (cloudCourses.length > 0) {
      SwanayaDatabase.set('courses', cloudCourses);
    }
    return cloudCourses;
  },

  async createCourse(course: Partial<Course> & { id?: string; name?: string; code?: string }): Promise<string> {
    const courseId = course.id || `c-${Date.now()}`;
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
      status: course.status || 'ACTIVE',
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

    // 1. Immediately update SwanayaDatabase so front-end gets instant update
    const localCourses = SwanayaDatabase.get<Course[]>('courses') || [];
    const idx = localCourses.findIndex(c => c.id === courseId || (sanitized.code && c.code === sanitized.code));
    let updated: Course[];
    if (idx >= 0) {
      updated = localCourses.map((c, i) => i === idx ? { ...c, ...sanitized } : c);
    } else {
      updated = [...localCourses, sanitized];
    }
    SwanayaDatabase.set('courses', updated);

    // 2. Call backend server endpoint (disk store + Admin Firestore)
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized)
      });
      if (res.ok) {
        const result = await res.json();
        if (result?.course?.id) {
          return result.course.id;
        }
      }
    } catch (e) {
      console.warn('API /api/courses POST notice:', e);
    }

    // 3. Direct client Firestore write fallback
    try {
      const docRef = doc(db, 'courses', courseId);
      await setDoc(docRef, { ...sanitized, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (fsErr) {
      console.warn('Client Firestore course write notice:', fsErr);
    }

    return courseId;
  },

  async updateCourse(courseId: string, updateData: Partial<Course>) {
    return this.createCourse({ ...updateData, id: courseId });
  },

  async deleteCourse(courseId: string) {
    const local = SwanayaDatabase.get<Course[]>('courses') || [];
    SwanayaDatabase.set('courses', local.filter(c => c.id !== courseId));

    try {
      await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('API delete course notice:', e);
    }

    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (err) {
      console.warn('Firestore delete course notice:', err);
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
    const path = 'library_posts';
    try {
      const docRef = doc(collection(db, path));
      await setDoc(docRef, { ...post, id: docRef.id, createdAt: serverTimestamp() });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
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
  async getQuestionPapers() {
    const path = 'exam_question_papers';
    try {
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

  async getMcqExams() {
    const path = 'mcq_exams';
    try {
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
        ? query(collection(db, path), where('userId', '==', studentUid), orderBy('submittedAt', 'desc'))
        : query(collection(db, path), orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
    } catch (error) {
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
  }
};
