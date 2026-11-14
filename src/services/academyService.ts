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

  // --- COURSES ---
  async getCourses() {
    const path = 'courses';
    try {
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createCourse(course: any) {
    const path = 'courses';
    try {
      const docRef = doc(collection(db, path));
      await setDoc(docRef, { ...course, id: docRef.id, createdAt: serverTimestamp() });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  // --- REGISTRATIONS (COURSE SELECTION & VERIFICATION) ---
  async registerForCourse(registration: any, captchaToken?: string | null) {
    const path = 'registrations';
    if (!captchaToken) {
      throw new Error('Please complete the human verification CAPTCHA before submitting.');
    }

    const verifyRes = await fetch('/api/registrations/verify-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaToken, purpose: 'course_registration' }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.valid) {
      throw new Error(verifyData.error || 'CAPTCHA verification failed. Please verify again.');
    }

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

  async verifyExamCaptcha(captchaToken?: string | null) {
    if (!captchaToken) {
      throw new Error('Please complete the human verification CAPTCHA before registering.');
    }
    const verifyRes = await fetch('/api/registrations/verify-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaToken, purpose: 'exam_registration' }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.valid) {
      throw new Error(verifyData.error || 'CAPTCHA verification failed. Please verify again.');
    }
    return verifyData;
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
      await setDoc(docRef, {
        ...annData,
        id: docRef.id,
        createdAt: annData.createdAt || now,
        updatedAt: annData.updatedAt || now,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExamAnnouncement(annId: string, updateData: any) {
    const path = `exam_announcements/${annId}`;
    try {
      await updateDoc(doc(db, 'exam_announcements', annId), {
        ...updateData,
        updatedAt: new Date().toISOString(),
      });
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
