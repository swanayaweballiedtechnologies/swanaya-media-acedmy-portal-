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
  CaptchaMode,
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
  const { captchaToken, leadData } = req.body || {};
  const verification = consumeCaptchaToken(captchaToken, 'admissions');
  if (!verification.valid) {
    return res.status(403).json({ success: false, error: verification.error });
  }

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
