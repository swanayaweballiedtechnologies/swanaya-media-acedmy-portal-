import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp, QuerySnapshot } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import fs from 'fs';
import {
  createCaptchaChallenge,
  verifyCaptchaChallenge,
  consumeCaptchaToken,
  type CaptchaMode,
} from './serverCaptcha.ts';

dotenv.config();

// Initialize Firebase Admin
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let appletConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  appletConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
}

let db: any = null;
try {
  const adminApp = initializeApp({
    credential: applicationDefault(),
    projectId: appletConfig.projectId
  });
  db = appletConfig.firestoreDatabaseId ? getFirestore(adminApp, appletConfig.firestoreDatabaseId) : getFirestore(adminApp);
} catch (error) {
  try {
    db = appletConfig.firestoreDatabaseId ? getFirestore(appletConfig.firestoreDatabaseId) : getFirestore();
  } catch (e) {
    console.log('Firebase Admin Firestore fallback note:', e);
  }
}

// Mock Email Transporter (Logs to console in dev)
const transporter = nodemailer.createTransport({
  jsonTransport: true // For logging purposes in this environment
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Express route for AI Chatbot
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userRole, courseContext } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is missing on the server. Please check settings.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are DeepSeek V4.1 Flash, the official AI Student Learning Assistant for Swanaya Media Academy.
Swanaya Media Academy is a premier EdTech and Media Science institute offering programs like Advanced Diploma in AI Business & Digital Media, Advanced Diploma in Digital Journalism, Advanced Diploma in Data Analytics & Media Science, Graphic Design & Motion VFX, Film Direction & Scriptwriting.

Your mission:
- Provide supportive, intelligent, clear, and actionable learning guidance to students.
- Help students with course syllabus questions, assignment planning, code syntax, project portfolio strategies, exam prep, and media industry trends.
- Use encouraging, professional, and clear tone with rich markdown formatting (bullet points, bold text, code blocks).
- Context: Student is currently studying ${courseContext || 'Digital Media & Tech'} at Swanaya Media Academy.
`;

    // Format chat history for GoogleGenAI SDK
    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "I'm here to help! Could you clarify your question about your studies?";
    return res.json({ reply: replyText });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate AI response. Please try again.'
    });
  }
});

// Welcome Email Template
const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 20px auto; padding: 0; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .header { background-color: #003366; color: #ffffff; padding: 30px; text-align: center; }
  .content { padding: 30px; background-color: #ffffff; }
  .footer { text-align: center; font-size: 12px; color: #777; padding: 20px; background-color: #f9f9f9; }
  .button { display: inline-block; padding: 14px 28px; background-color: #003366; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin-top: 25px; font-weight: bold; }
  ul { padding-left: 20px; }
  li { margin-bottom: 10px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Swanaya Media Academy</h1>
    </div>
    <div class="content">
      <p>Dear {{studentName}},</p>
      <p>Congratulations! You have successfully registered for the <strong>{{courseName}}</strong> at Swanaya Media Academy.</p>
      <p>We are thrilled to have you join our community of media professionals and tech innovators. Your journey towards mastering {{courseCategory}} begins now.</p>
      <p>Our LMS portal is your gateway to:
        <ul>
          <li>Accessing course materials and schedules</li>
          <li>Attending examinations and viewing results</li>
          <li>Tracking your learning progress</li>
          <li>Downloading your certificates</li>
        </ul>
      </p>
      <p style="text-align: center;">
        <a href="{{portalUrl}}" class="button">Go to Student Dashboard</a>
      </p>
      <p>If you have any questions, feel free to reply to this email or contact our academic support desk.</p>
      <p>Best regards,<br/><strong>The Swanaya Media Academy Team</strong></p>
    </div>
    <div class="footer">
      &copy; 2024 Swanaya Media Academy. All rights reserved.<br/>
      Premium EdTech & Media Science Institute
    </div>
  </div>
</body>
</html>
`;

// CAPTCHA Challenge & Verification Routes
app.get('/api/captcha/challenge', (req, res) => {
  const modeParam = req.query.mode === 'math' ? 'math' : 'visual';
  const purposeParam =
    typeof req.query.purpose === 'string' && req.query.purpose.trim()
      ? req.query.purpose.trim()
      : 'signup';
  const challenge = createCaptchaChallenge(modeParam as CaptchaMode, purposeParam);
  res.setHeader('Cache-Control', 'no-store');
  return res.json(challenge);
});

app.post('/api/captcha/verify', (req, res) => {
  const { challengeId, selectedIds, answer, purpose } = req.body || {};
  const result = verifyCaptchaChallenge({ challengeId, selectedIds, answer, purpose });
  return res.status(result.status).json(result);
});

app.post('/api/registrations/verify-captcha', (req, res) => {
  const { captchaToken, purpose } = req.body || {};
  const verification = consumeCaptchaToken(captchaToken, purpose);
  if (!verification.valid) {
    return res.status(403).json({ valid: false, error: verification.error });
  }
  return res.json({ valid: true, tokenId: verification.tokenId });
});

app.post('/api/admissions/submit', (req, res) => {
  const { leadData } = req.body || {};
  if (!leadData || !leadData.name || !leadData.email || !leadData.phone) {
    return res.status(400).json({
      success: false,
      error: 'Please fill in your name, email address, and phone number.',
    });
  }

  return res.json({
    success: true,
    verifiedAt: new Date().toISOString(),
  });
});

// --- Persistent Multi-Device Profiles Storage ---
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROFILES_FILE = path.resolve(DATA_DIR, 'persistent_profiles.json');

interface PersistentStore {
  users: any[];
  students: any[];
  instructors: any[];
  updatedAt: string;
}

const DEFAULT_SEED_USERS = [
  { id: "usr-md", username: "aadithyan", email: "aadithyan.menon@swanayamedia.com", name: "AADITHYAN M MENON", role: "MD", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-principal", username: "principal", email: "principal@swanayamedia.com", name: "Academy Principal", role: "PRINCIPAL", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Principal", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true },
  { id: "usr-navven", username: "navven", email: "navven.admin@swanayamedia.com", name: "NAVVEN (Administrator)", role: "ADMIN", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Naveen", status: "ACTIVE", createdAt: "2026-01-02", isVerified: true },
  { id: "usr-reviewer", username: "reviewer", email: "reviewer@swanayamedia.com", name: "Academic Reviewer", role: "REVIEWER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer", status: "ACTIVE", createdAt: "2026-01-05", isVerified: true },
  { id: "usr-alumni", username: "alumni", email: "alumni@swanayamedia.com", name: "Alumni Graduate", role: "ALUMNI", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alumni", status: "ACTIVE", createdAt: "2026-01-08", isVerified: true }
];

function readPersistentStore(): PersistentStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_SEED_USERS],
        students: Array.isArray(parsed.students) ? parsed.students : [],
        instructors: Array.isArray(parsed.instructors) ? parsed.instructors : [],
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    }
  } catch (e) {
    console.warn('Error reading persistent profiles file:', e);
  }
  return {
    users: [...DEFAULT_SEED_USERS],
    students: [],
    instructors: [],
    updatedAt: new Date().toISOString()
  };
}

function writePersistentStore(store: PersistentStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent profiles file:', e);
  }
}

// 1. Fetch all cloud-synced profiles (for app startup & multi-device hydration)
app.get('/api/sync/profiles', async (req, res) => {
  try {
    const store = readPersistentStore();

    if (db) {
      try {
        const snap = await db.collection('users').get();
        snap.docs.forEach((d: any) => {
          const u = { id: d.id, ...d.data() };
          const idx = store.users.findIndex((x: any) => x.id === u.id || (u.email && x.email?.toLowerCase() === u.email?.toLowerCase()));
          if (idx >= 0) {
            store.users[idx] = { ...store.users[idx], ...u };
          } else {
            store.users.push(u);
          }
        });

        const stSnap = await db.collection('students').get();
        stSnap.docs.forEach((d: any) => {
          const st = { id: d.id, ...d.data() };
          const idx = store.students.findIndex((x: any) => x.id === st.id || x.userId === st.userId || (st.email && x.email?.toLowerCase() === st.email?.toLowerCase()));
          if (idx >= 0) {
            store.students[idx] = { ...store.students[idx], ...st };
          } else {
            store.students.push(st);
          }
        });
      } catch (err: any) {
        console.warn('Firestore profiles fetch note:', err.message);
      }
    }

    return res.json({
      success: true,
      users: store.users,
      students: store.students,
      instructors: store.instructors,
      updatedAt: store.updatedAt
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save or update a user profile, student record, or instructor record
app.post('/api/sync/profile', async (req, res) => {
  try {
    const { user, student, instructor } = req.body || {};
    if (!user || !user.id || !user.name) {
      return res.status(400).json({ success: false, error: 'User profile with id and name is required.' });
    }

    const store = readPersistentStore();
    const nowIso = new Date().toISOString();

    const userIndex = store.users.findIndex((u: any) => u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase()));
    const mergedUser = {
      ...(userIndex >= 0 ? store.users[userIndex] : {}),
      ...user,
      updatedAt: nowIso
    };
    if (userIndex >= 0) {
      store.users[userIndex] = mergedUser;
    } else {
      store.users.push(mergedUser);
    }

    let mergedStudent = null;
    if (student && (student.id || student.userId)) {
      const studentIndex = store.students.findIndex((s: any) => 
        (student.id && s.id === student.id) || 
        (student.userId && s.userId === student.userId) ||
        (student.email && s.email?.toLowerCase() === student.email?.toLowerCase())
      );
      mergedStudent = {
        ...(studentIndex >= 0 ? store.students[studentIndex] : {}),
        ...student,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || student.phone,
        avatarUrl: user.avatarUrl || student.avatarUrl,
        updatedAt: nowIso
      };
      if (studentIndex >= 0) {
        store.students[studentIndex] = mergedStudent;
      } else {
        store.students.push(mergedStudent);
      }
    }

    let mergedInstructor = null;
    if (instructor && (instructor.id || instructor.userId)) {
      const instIndex = store.instructors.findIndex((i: any) => 
        (instructor.id && i.id === instructor.id) || 
        (instructor.userId && i.userId === instructor.userId)
      );
      mergedInstructor = {
        ...(instIndex >= 0 ? store.instructors[instIndex] : {}),
        ...instructor,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || instructor.phone,
        avatarUrl: user.avatarUrl || instructor.avatarUrl,
        updatedAt: nowIso
      };
      if (instIndex >= 0) {
        store.instructors[instIndex] = mergedInstructor;
      } else {
        store.instructors.push(mergedInstructor);
      }
    }

    store.updatedAt = nowIso;
    writePersistentStore(store);

    if (db) {
      try {
        await db.collection('users').doc(user.id).set(mergedUser, { merge: true });
        if (mergedStudent) {
          await db.collection('students').doc(mergedStudent.id || mergedStudent.userId).set(mergedStudent, { merge: true });
        }
        if (mergedInstructor) {
          await db.collection('instructors').doc(mergedInstructor.id || mergedInstructor.userId).set(mergedInstructor, { merge: true });
        }
      } catch (cloudErr: any) {
        console.warn('Firestore Admin profile sync notice:', cloudErr.message);
      }
    }

    return res.json({
      success: true,
      user: mergedUser,
      student: mergedStudent,
      instructor: mergedInstructor
    });
  } catch (err: any) {
    console.error('Error in /api/sync/profile:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Central Login Authentication & Profile Hydration (works across any system/browser)
app.post('/api/sync/login', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ success: false, error: 'Identifier is required.' });
    }

    const clean = identifier.trim().toLowerCase();
    const store = readPersistentStore();

    let user = store.users.find((u: any) => 
      (u.username && u.username.toLowerCase() === clean) ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.name && u.name.toLowerCase() === clean)
    );

    if (!user && db) {
      try {
        const emailSnap = await db.collection('users').where('email', '==', clean).limit(1).get();
        if (!emailSnap.empty) {
          user = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() };
        } else {
          const usernameSnap = await db.collection('users').where('username', '==', clean).limit(1).get();
          if (!usernameSnap.empty) {
            user = { id: usernameSnap.docs[0].id, ...usernameSnap.docs[0].data() };
          }
        }
        if (user) {
          store.users.push(user);
          writePersistentStore(store);
        }
      } catch (err: any) {
        console.warn('Firestore login lookup note:', err.message);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found in system directory.' });
    }

    let student = store.students.find((s: any) => 
      s.userId === user.id || 
      (user.email && s.email && s.email.toLowerCase() === user.email.toLowerCase())
    );

    if (!student && (user.role === 'STUDENT' || user.role === 'ALUMNI')) {
      student = {
        id: `s-${user.id}`,
        studentId: user.studentId || `SMA-2026-${user.id.slice(-4).toUpperCase()}`,
        admissionNumber: `ADM-2026-${user.id.slice(-4).toUpperCase()}`,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '+91 94460 00000',
        whatsappPhone: user.whatsappPhone || user.phone || '+91 94460 00000',
        whatsappOptIn: user.whatsappOptIn ?? true,
        guardianName: user.guardianName || 'Parent / Guardian',
        guardianPhone: user.guardianPhone || '+91 94460 00000',
        academicBackground: user.academicBackground || 'Enrolled Scholar',
        avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`,
        status: user.status || 'ACTIVE',
        courseId: user.preferredCourseId || 'c-1',
        batchId: 'b-1',
        semesterId: 's-1-1',
        enrollmentDate: user.createdAt || new Date().toISOString().split('T')[0],
        skills: user.skills || ['Media Science'],
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: 0,
        careerReadinessScore: 50
      };
      store.students.push(student);
      writePersistentStore(store);
    }

    const instructor = store.instructors.find((i: any) => 
      i.userId === user.id || 
      (user.email && i.email && i.email.toLowerCase() === user.email.toLowerCase())
    );

    return res.json({
      success: true,
      user,
      student,
      instructor
    });
  } catch (err: any) {
    console.error('Error in /api/sync/login:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Express route to handle registration welcome emails
app.post('/api/registrations/welcome', async (req, res) => {
  try {
    const { studentName, studentEmail, courseTitle, courseCategory } = req.body;
    const emailHtml = WELCOME_EMAIL_TEMPLATE
      .replace('{{studentName}}', studentName || 'Student')
      .replace('{{courseName}}', courseTitle || 'Selected Course')
      .replace('{{courseCategory}}', courseCategory || 'Media Science')
      .replace('{{portalUrl}}', 'http://localhost:3000');

    const mailInfo = await transporter.sendMail({
      from: '"Swanaya Media Academy" <noreply@swanayamedia.com>',
      to: studentEmail || 'student@swanayamedia.com',
      subject: `Welcome to ${courseTitle || 'Swanaya Media Academy'}`,
      html: emailHtml,
    });

    const parsed = typeof mailInfo.message === 'string' ? JSON.parse(mailInfo.message) : mailInfo;
    console.log(`[Email] Registration welcome email sent to ${studentEmail || 'student'}`);
    return res.json({ success: true, messageId: parsed.messageId || 'SENT' });
  } catch (err: any) {
    console.error('Error in /api/registrations/welcome:', err);
    return res.status(500).json({ error: err.message });
  }
});

// "Cloud Function" Listener - Watches for new registrations
function setupRegistrationTrigger() {
  // If running without Google Cloud Application Default Credentials (ADC) or db is unavailable,
  // do not open long-polling gRPC streams that cause retry-exhaustion crashes in dev.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !db) {
    console.log('[Server] Registration background trigger: Operating in dev mode without ADC credentials. Welcome emails routed via /api/registrations/welcome.');
    return;
  }

  try {
    const startTime = Date.now();

    db.collection('registrations')
      .where('createdAt', '>=', Timestamp.fromMillis(startTime))
      .onSnapshot(async (snapshot: QuerySnapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const registrationData = change.doc.data();
            const registrationId = change.doc.id;

            try {
              console.log(`New registration detected: ${registrationId}. Triggering welcome sequence...`);

              // 1. Fetch student details
              const studentDoc = await db.collection('users').doc(registrationData.studentId).get();
              if (!studentDoc.exists) {
                console.error(`Student ${registrationData.studentId} not found for registration ${registrationId}`);
                continue;
              }
              const student = studentDoc.data();

              // 2. Fetch course details
              const courseDoc = await db.collection('courses').doc(registrationData.courseId).get();
              const course = courseDoc.exists ? courseDoc.data() : { title: 'Selected Course', category: 'Media Science' };

              // 3. Prepare Email
              const emailHtml = WELCOME_EMAIL_TEMPLATE
                .replace('{{studentName}}', student?.name || 'Student')
                .replace('{{courseName}}', course?.title || 'Selected Course')
                .replace('{{courseCategory}}', course?.category || 'Media Science')
                .replace('{{portalUrl}}', 'http://localhost:3000');

              // 4. Send Email
              const mailInfo = await transporter.sendMail({
                from: '"Swanaya Media Academy" <noreply@swanayamedia.com>',
                to: student?.email,
                subject: `Welcome to ${course?.title} - Swanaya Media Academy`,
                html: emailHtml,
              });

              console.log(`Welcome email sent to ${student?.email}. Message ID: ${JSON.parse(mailInfo.message).messageId}`);

              // 5. Log to Audit Ledger
              await db.collection('audit_ledger').add({
                event: 'STUDENT_REGISTRATION_WELCOME_EMAIL',
                timestamp: FieldValue.serverTimestamp(),
                actorId: 'SYSTEM',
                details: {
                  registrationId,
                  studentId: registrationData.studentId,
                  studentEmail: student?.email,
                  courseId: registrationData.courseId,
                  courseTitle: course?.title,
                  emailMessageId: JSON.parse(mailInfo.message).messageId
                }
              });

              console.log(`Audit log created for registration ${registrationId}`);

            } catch (error) {
              console.error(`Error in registration trigger for ${registrationId}:`, error);
            }
          }
        }
      }, (error: Error) => {
        console.warn('Registration trigger listener note:', error.message);
      });
  } catch (err: any) {
    console.warn('Could not initialize registration background listener:', err?.message);
  }
}

// Vite middleware integration for full-stack dev execution
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
    
    // Start the background trigger
    setupRegistrationTrigger();
  });
}

startServer();
