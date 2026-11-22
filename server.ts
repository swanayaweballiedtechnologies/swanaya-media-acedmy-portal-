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
import crypto from 'crypto';
import {
  createCaptchaChallenge,
  verifyCaptchaChallenge,
  consumeCaptchaToken,
  type CaptchaMode,
} from './serverCaptcha.ts';
import {
  sendVerificationEmail,
  sendEmailVerifiedConfirmation,
  sendPendingApprovalEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
} from './serverEmail.ts';
import {
  readAuthStore,
  writeAuthStore,
  normalizeEmail,
  isValidEmailFormat,
  hashPassword,
  verifyPassword,
  verifyCredentialPassword,
  ensureMdBootstrapCredential,
  createHashedVerificationToken,
  consumeHashedVerificationToken,
  createPhoneVerificationCode,
  verifyPhoneVerificationCode,
  getVerificationSettings,
  updateVerificationSettings,
  recordConfirmationMessage,
  normalizePhoneDigits,
  formatWhatsappDigits,
  phonesMatch,
  DEFAULT_ACADEMY_VERIFICATION_PHONE,
  isAadithyanIdentifier,
  recordAuthAudit,
  recordEmailOutbox,
  checkRateLimit,
  getClientIp,
  setSessionCookie,
  clearSessionCookie,
  getRequestOriginHttps,
  requireVerifiedAuth,
  type AuthedRequest,
  type VerificationChannel,
  type PhoneOtpPurpose,
} from './serverAuth.ts';

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

    const systemInstruction = `You are the official AI Guide & Account Recovery Assistant for Swanaya Media Academy, represented by our academic advisor mascot.
- Help students, tutors, and staff with course guidance, portal navigation, email verification recovery, and password reset steps.
- If a user asks for a sample verification reference code, provide a unique session reference (e.g. \`SMA-VERIFY-${Math.floor(100000 + Math.random() * 900000)}\`) and explain how official verification links are delivered via their registered email.
- If a user needs password recovery, guide them to use the in-chat "Reset Password" recovery panel or click "Forgot Password?" on Sign In / Re-Auth to trigger an official email reset link.
- Never invent or disclose administrative passwords. Keep responses concise, helpful, and formatted cleanly in Markdown.
- Active context: ${courseContext || `Swanaya Media Academy (${userRole || 'Visitor'})`}
`;

    // Format chat history for GoogleGenAI SDK
    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contents,
      config: {
        systemInstruction,
      },
    });

    const replyText =
      response.text ||
      "Hello! I'm your Swanaya Media Academy Guide. Ask me about courses, verification steps, or click 'Reset Password' below to recover your account.";
    return res.json({ reply: replyText });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate AI response. Please try again.'
    });
  }
});

// --- PUBLIC LIBRARY: WIKIPEDIA & GOOGLE SEARCH GROUNDING ---
function getServerGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchWikipediaSearchResults(searchTerm: string, limit = 8) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', searchTerm);
  url.searchParams.set('gsrlimit', String(limit));
  url.searchParams.set('prop', 'extracts|pageimages|info');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('exsentences', '3');
  url.searchParams.set('inprop', 'url');
  url.searchParams.set('piprop', 'thumbnail');
  url.searchParams.set('pithumbsize', '360');
  url.searchParams.set('format', 'json');

  const wpRes = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'SwanayaMediaAcademyLibrary/1.0 (https://academy.swanayamedia.com)',
      'Accept': 'application/json',
    },
  });

  if (!wpRes.ok) {
    throw new Error(`Wikipedia API returned HTTP ${wpRes.status}`);
  }

  const data: any = await wpRes.json();
  const pagesObj = data?.query?.pages || {};
  const pages = Object.values(pagesObj) as any[];
  return pages
    .sort((a, b) => (a.index ?? 999) - (b.index ?? 999))
    .map((p) => ({
      pageid: p.pageid,
      title: p.title,
      extract: p.extract || 'No summary snippet available.',
      fullurl: p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title || '').replace(/ /g, '_'))}`,
      thumbnailUrl: p.thumbnail?.source || null,
    }));
}

async function fetchGoogleSearchGroundedResults(searchTerm: string) {
  const ai = getServerGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Check Settings > Secrets.');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Research query for the Swanaya Media Academy Digital Library: "${searchTerm}".
Provide a concise, well-structured academic reference overview with key facts, core concepts, and practical applications grounded in current web search results.`,
    config: {
      systemInstruction:
        'You are a scholarly research librarian for Swanaya Media Academy. Summarize verified web findings clearly with short headings and bullet points so students and faculty can review key facts and inspect the cited web sources.',
      tools: [{ googleSearch: {} }],
    },
  });

  const summary = response.text || '';
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const rawChunks = metadata?.groundingChunks || [];
  const seenUrls = new Set<string>();
  const sources: Array<{ title: string; uri: string; domain: string }> = [];

  for (const chunk of rawChunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && !seenUrls.has(uri)) {
      seenUrls.add(uri);
      let domain = '';
      try {
        domain = new URL(uri).hostname.replace(/^www\./, '');
      } catch {
        domain = 'web';
      }
      sources.push({
        title: title || domain || uri,
        uri,
        domain,
      });
    }
  }

  const searchQueries = Array.isArray(metadata?.webSearchQueries) ? metadata.webSearchQueries : [];

  return {
    summary,
    sources,
    searchQueries,
  };
}

app.get('/api/library/wikipedia', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }
  try {
    const results = await fetchWikipediaSearchResults(q, 8);
    return res.json({ query: q, results });
  } catch (err: any) {
    console.error('Wikipedia search error:', err);
    return res.status(502).json({ error: err?.message || 'Failed to query Wikipedia.' });
  }
});

app.get('/api/library/wikipedia/article', async (req, res) => {
  const title = String(req.query.title || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'Article "title" parameter is required.' });
  }
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('titles', title);
    url.searchParams.set('redirects', '1');
    url.searchParams.set('prop', 'extracts|pageimages|info');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('exchars', '6000');
    url.searchParams.set('inprop', 'url');
    url.searchParams.set('piprop', 'thumbnail');
    url.searchParams.set('pithumbsize', '640');
    url.searchParams.set('format', 'json');

    const wpRes = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'SwanayaMediaAcademyLibrary/1.0 (https://academy.swanayamedia.com)',
        'Accept': 'application/json',
      },
    });
    if (!wpRes.ok) {
      throw new Error(`Wikipedia article fetch returned HTTP ${wpRes.status}`);
    }
    const data: any = await wpRes.json();
    const pagesObj = data?.query?.pages || {};
    const page: any = Object.values(pagesObj)[0];
    if (!page || page.missing !== undefined) {
      return res.status(404).json({ error: `Wikipedia article "${title}" was not found.` });
    }

    return res.json({
      article: {
        pageid: page.pageid,
        title: page.title,
        extract: page.extract || '',
        fullurl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title || '').replace(/ /g, '_'))}`,
        thumbnailUrl: page.thumbnail?.source || null,
      },
    });
  } catch (err: any) {
    console.error('Wikipedia article error:', err);
    return res.status(502).json({ error: err?.message || 'Failed to load Wikipedia article.' });
  }
});

function formatGeminiError(err: any): { status: number; message: string } {
  const raw = String(err?.message || 'Failed to query Google Search.');
  let status = Number(err?.status || err?.code || 500);
  let message = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) {
      status = Number(parsed.error.code || status || 500);
      message = parsed.error.message || raw;
    }
  } catch {
    // plain text error message
  }
  if (status === 429) {
    return {
      status: 429,
      message: 'Google Search API quota exceeded (429). Check your Gemini API plan/billing in Settings > Secrets, or open the query directly on Google.',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message,
  };
}

app.post('/api/library/google-search', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search "query" is required.' });
  }
  try {
    const data = await fetchGoogleSearchGroundedResults(query);
    return res.json({ query, ...data });
  } catch (err: any) {
    console.error('Google Search grounding error:', err);
    const formatted = formatGeminiError(err);
    return res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/library/research', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  const mode = String(req.body?.mode || 'all');
  if (!query) {
    return res.status(400).json({ error: 'Search "query" is required.' });
  }

  const wantWiki = mode === 'all' || mode === 'wikipedia';
  const wantGoogle = mode === 'all' || mode === 'google';

  const [wikiSettled, googleSettled] = await Promise.allSettled([
    wantWiki ? fetchWikipediaSearchResults(query, 8) : Promise.resolve(null),
    wantGoogle ? fetchGoogleSearchGroundedResults(query) : Promise.resolve(null),
  ]);

  return res.json({
    query,
    wikipedia:
      wikiSettled.status === 'fulfilled'
        ? { ok: true, results: wikiSettled.value || [], error: null }
        : { ok: false, results: [], error: wikiSettled.reason?.message || 'Wikipedia search failed.' },
    googleSearch:
      googleSettled.status === 'fulfilled'
        ? { ok: true, data: googleSettled.value, error: null }
        : { ok: false, data: null, error: formatGeminiError(googleSettled.reason).message },
  });
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
  courseRegistrations: any[];
  applications: any[];
  updatedAt: string;
}

const DEFAULT_SEED_USERS = [
  { id: "usr-md", username: "aadithyan", email: "aadithyan.menon@swanayamedia.com", name: "AADITHYAN M MENON", designation: "Managing Director", role: "MD", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true, email_verified: true, phone: "+91 94460 55555", adminAcceptanceStatus: "ACCEPTED" },
  { id: "usr-principal", username: "principal", email: "principal@swanayamedia.com", name: "Academy Principal", role: "PRINCIPAL", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Principal", status: "ACTIVE", createdAt: "2026-01-01", isVerified: true, email_verified: true, adminAcceptanceStatus: "ACCEPTED" },
  { id: "usr-reviewer", username: "reviewer", email: "reviewer@swanayamedia.com", name: "Academic Reviewer", role: "REVIEWER", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer", status: "ACTIVE", createdAt: "2026-01-05", isVerified: true, email_verified: true, adminAcceptanceStatus: "ACCEPTED" },
  { id: "usr-alumni", username: "alumni", email: "alumni@swanayamedia.com", name: "Alumni Graduate", role: "ALUMNI", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alumni", status: "ACTIVE", createdAt: "2026-01-08", isVerified: true, email_verified: true, adminAcceptanceStatus: "ACCEPTED" }
];

function readPersistentStore(): PersistentStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const users = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_SEED_USERS];
      if (!users.some((u: any) => u.id === 'usr-md' || String(u.username || '').toLowerCase() === 'aadithyan')) {
        users.unshift(DEFAULT_SEED_USERS[0]);
      }
      return {
        users,
        students: Array.isArray(parsed.students) ? parsed.students : [],
        instructors: Array.isArray(parsed.instructors) ? parsed.instructors : [],
        courseRegistrations: Array.isArray(parsed.courseRegistrations) ? parsed.courseRegistrations : [],
        applications: Array.isArray(parsed.applications) ? parsed.applications : [],
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
    courseRegistrations: [],
    applications: [],
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

// 2b. Remove an MD-provisioned admin record from persistent store
app.post('/api/sync/admin-remove', async (req, res) => {
  try {
    const { userId, email, grantId } = req.body || {};
    if (!userId && !email && !grantId) {
      return res.status(400).json({ success: false, error: 'Admin userId, email, or grantId is required.' });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const store = readPersistentStore();
    store.users = store.users.filter((u: any) => {
      if (userId && u.id === userId) return false;
      if (grantId && u.grantId === grantId) return false;
      if (cleanEmail && String(u.email || '').trim().toLowerCase() === cleanEmail && ['ADMIN', 'ACADEMIC_ADMIN'].includes(String(u.role || '').toUpperCase())) {
        return false;
      }
      return true;
    });
    store.updatedAt = new Date().toISOString();
    writePersistentStore(store);

    if (db) {
      try {
        if (grantId) await db.collection('admin_grants').doc(grantId).delete();
        if (userId) await db.collection('users').doc(userId).delete();
      } catch (cloudErr: any) {
        console.warn('Firestore admin-remove notice:', cloudErr.message);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
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

    let user: any = null;
    if (isAadithyanIdentifier(clean)) {
      const mdBase = store.users.find((u: any) => u.id === 'usr-md' || String(u.username || '').toLowerCase() === 'aadithyan') || DEFAULT_SEED_USERS[0];
      user = {
        ...mdBase,
        id: mdBase.id || 'usr-md',
        username: 'aadithyan',
        name: 'AADITHYAN M MENON',
        designation: 'Managing Director',
        role: 'MD',
        status: 'ACTIVE',
        email_verified: true,
        isVerified: true,
        adminAcceptanceStatus: 'ACCEPTED',
      };
    } else {
      user = store.users.find((u: any) =>
        (u.username && u.username.toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean) ||
        (u.name && u.name.toLowerCase() === clean)
      );
    }

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
        phone: user.phone || '',
        guardianName: user.guardianName || 'Parent / Guardian',
        guardianPhone: user.guardianPhone || '',
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

// ============================================================================
// SWANAYA MEDIA ACADEMY — SECURE AUTHENTICATION & EMAIL VERIFICATION ENGINE
// ============================================================================

function sanitizeUserForClient(u: any) {
  if (!u || typeof u !== 'object') return u;
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}

async function syncUserToFirestoreAdmin(user: any) {
  if (!db || !user?.id) return;
  try {
    await db.collection('users').doc(user.id).set(sanitizeUserForClient(user), { merge: true });
  } catch (err: any) {
    console.warn('[Auth] Firestore user mirror note:', err?.message);
  }
}

async function findUserAcrossStores(identifier: string) {
  const clean = normalizeEmail(identifier);
  const store = readPersistentStore();

  if (isAadithyanIdentifier(clean)) {
    const mdUser =
      store.users.find((u: any) => u.id === 'usr-md' || normalizeEmail(u.username || '') === 'aadithyan') ||
      DEFAULT_SEED_USERS[0];
    return {
      ...mdUser,
      id: mdUser.id || 'usr-md',
      username: 'aadithyan',
      name: 'AADITHYAN M MENON',
      designation: 'Managing Director',
      role: 'MD',
      status: 'ACTIVE',
      email_verified: true,
      isVerified: true,
      adminAcceptanceStatus: 'ACCEPTED',
    };
  }

  let user = store.users.find(
    (u: any) =>
      normalizeEmail(u.email) === clean ||
      (u.username && normalizeEmail(u.username) === clean) ||
      u.id === identifier
  );

  if (!user) {
    const authStore = readAuthStore();
    const matchedCred = Object.values(authStore.credentials).find(
      (c) =>
        normalizeEmail(c.email) === clean ||
        (c.username && normalizeEmail(c.username) === clean) ||
        c.userId === identifier
    );
    if (matchedCred) {
      user = store.users.find(
        (u: any) => u.id === matchedCred.userId || normalizeEmail(u.email) === normalizeEmail(matchedCred.email)
      );
    }
  }

  if (!user && db) {
    try {
      const emailSnap = await db.collection('users').where('email', '==', clean).limit(1).get();
      if (!emailSnap.empty) {
        user = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() };
      } else {
        const unameSnap = await db.collection('users').where('username', '==', clean).limit(1).get();
        if (!unameSnap.empty) {
          user = { id: unameSnap.docs[0].id, ...unameSnap.docs[0].data() };
        }
      }
      if (user) {
        store.users.push(user);
        writePersistentStore(store);
      }
    } catch {
      // Ignore offline Firestore read errors
    }
  }
  return user || null;
}

// 1. User Registration with Mandatory Email Verification (Students & Tutors ONLY)
app.post('/api/auth/register', async (req, res) => {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`register:${ip}`, 12, 10 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many registration attempts. Please wait ${rl.retryAfterSec} seconds.`,
    });
  }

  try {
    const {
      name,
      username,
      email,
      password,
      role,
      phone,
      whatsappPhone,
      whatsappOptIn,
      courseId,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);
    const cleanUsername = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const rawPassword = String(password || '');
    const requestedRole = String(role || 'STUDENT').toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your full name.' });
    }
    if (!isValidEmailFormat(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }
    if (!cleanUsername || cleanUsername.length < 2) {
      return res.status(400).json({ success: false, error: 'Please choose a valid username (at least 2 characters).' });
    }
    if (rawPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Strict restriction: NO public admin registration
    if (!['STUDENT', 'INSTRUCTOR'].includes(requestedRole)) {
      recordAuthAudit({
        event: 'REGISTER_BLOCKED_ROLE',
        email: cleanEmail,
        role: requestedRole,
        ip,
        outcome: 'DENIED',
        message: `Rejected public registration attempt for restricted role ${requestedRole}`,
      });
      return res.status(403).json({
        success: false,
        error: 'Public registration is restricted to Student and Tutor accounts. Admin accounts are provisioned solely by the Managing Director.',
      });
    }

    // Block registering Aadithyan's protected admin email/username as a public Student/Tutor
    if (isAadithyanIdentifier(cleanEmail) || isAadithyanIdentifier(cleanUsername)) {
      return res.status(409).json({
        success: false,
        code: 'PROTECTED_ADMIN_ACCOUNT',
        error: 'This email/username is reserved for the Managing Director Admin Portal. Please sign in via the Admin Portal.',
      });
    }

    const store = readPersistentStore();
    const authStore = readAuthStore();

    const duplicateEmail =
      Boolean(authStore.credentials[cleanEmail]) ||
      store.users.some((u: any) => normalizeEmail(u.email) === cleanEmail);

    if (duplicateEmail) {
      recordAuthAudit({
        event: 'REGISTER_DUPLICATE_EMAIL',
        email: cleanEmail,
        role: requestedRole,
        ip,
        outcome: 'DENIED',
        message: 'Blocked duplicate email registration attempt.',
      });
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_EMAIL',
        error: 'An account with this email address already exists. Please sign in or reset your password.',
      });
    }

    const duplicateUsername = store.users.some(
      (u: any) => u.username && normalizeEmail(u.username) === cleanUsername
    );
    if (duplicateUsername) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_USERNAME',
        error: 'This username is already taken. Please choose a different username.',
      });
    }

    if (db) {
      try {
        const fsDup = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
        if (!fsDup.empty) {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_EMAIL',
            error: 'An account with this email address already exists in cloud records.',
          });
        }
      } catch {
        // Fallback to local verification above
      }
    }

    const userId = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const { salt, hash } = hashPassword(rawPassword);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`;
    const resolvedCourseId = String(courseId || '').trim();
    const cleanPhone = String(phone || whatsappPhone || '').trim();

    const newUser: any = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      role: requestedRole,
      avatarUrl,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      ...(resolvedCourseId
        ? {
            preferredCourseId: resolvedCourseId,
            courseId: resolvedCourseId,
            enrolledCourseIds: [resolvedCourseId],
          }
        : {}),
      status: 'PENDING_VERIFICATION',
      email_verified: false,
      isVerified: false,
      adminAcceptanceStatus: 'PENDING_ACCEPTANCE',
      ...(requestedRole === 'INSTRUCTOR' ? { tutorApprovalStatus: 'PENDING_APPROVAL' } : {}),
      createdAt: nowIso.split('T')[0],
      updatedAt: nowIso,
    };

    store.users.push(newUser);

    if (requestedRole === 'STUDENT') {
      const newStudent = {
        id: `s-${Date.now()}`,
        studentId: `SMA-2026-${Math.floor(100 + Math.random() * 900)}`,
        admissionNumber: `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        guardianName: 'Self / Guardian',
        guardianPhone: cleanPhone,
        academicBackground: 'Registered Student',
        avatarUrl,
        status: 'INACTIVE',
        courseId: resolvedCourseId || 'c-1',
        batchId: 'b-1',
        semesterId: 's-1-1',
        enrollmentDate: nowIso.split('T')[0],
        skills: ['Enrolled Student'],
        projectsCount: 0,
        certificatesCount: 0,
        attendancePercentage: 100,
        outstandingBalance: 0,
        careerReadinessScore: 50,
      };
      store.students.push(newStudent);
    } else if (requestedRole === 'INSTRUCTOR') {
      const newInstructor = {
        id: `inst-${Date.now()}`,
        userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        qualification: 'Faculty Applicant',
        specialization: 'Digital Media & Engineering',
        experience: 'Pending Verification',
        bio: 'Registered Tutor awaiting email verification & admin approval.',
        avatarUrl,
        status: 'INACTIVE',
        assignedSubjects: [],
      };
      store.instructors.push(newInstructor);
    }

    store.updatedAt = nowIso;
    writePersistentStore(store);

    authStore.credentials[cleanEmail] = {
      userId,
      email: cleanEmail,
      username: cleanUsername,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      passwordSalt: salt,
      passwordHash: hash,
      email_verified: false,
      updatedAt: nowIso,
    };
    writeAuthStore(authStore);

    await syncUserToFirestoreAdmin(newUser);

    const { rawToken } = createHashedVerificationToken({
      userId,
      email: cleanEmail,
      purpose: 'EMAIL_VERIFY',
      ttlMinutes: 30,
    });
    const verifyUrl = `${getRequestOriginHttps(req)}/?authAction=verify-email&token=${rawToken}`;
    const roleLabel = requestedRole === 'INSTRUCTOR' ? 'Faculty / Tutor' : 'Student Scholar';
    const mailRes = await sendVerificationEmail({
      to: cleanEmail,
      name: cleanName,
      roleLabel,
      verifyUrl,
      expiresMinutes: 30,
    });
    recordEmailOutbox({
      to: cleanEmail,
      subject: 'Verify Your Swanaya Media Academy Account',
      purpose: 'EMAIL_VERIFY',
      provider: mailRes.provider,
      messageId: mailRes.messageId,
      previewUrl: mailRes.previewUrl,
    });

    recordAuthAudit({
      event: 'AUTH_REGISTER_PENDING_VERIFICATION',
      userId,
      email: cleanEmail,
      role: requestedRole,
      ip,
      outcome: 'SUCCESS',
      message: `Account created (${requestedRole}); verification link emailed via ${mailRes.provider}.`,
    });

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      userId,
      email: cleanEmail,
      role: requestedRole,
      expiresInMinutes: 30,
      previewUrl: mailRes.previewUrl,
      message: `Verification email sent to ${cleanEmail}. Please open the verification link to activate your account.`,
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/register:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Registration failed.' });
  }
});

// Helper to verify token & activate user
async function executeEmailVerification(rawToken: string, origin: string, ip: string) {
  const tokenResult = consumeHashedVerificationToken({
    rawToken,
    expectedPurpose: 'EMAIL_VERIFY',
  });

  if (!tokenResult.ok) {
    recordAuthAudit({
      event: 'EMAIL_VERIFICATION_FAILED',
      email: tokenResult.email,
      ip,
      outcome: 'DENIED',
      message: tokenResult.error,
    });
    return {
      status: tokenResult.code === 'TOKEN_EXPIRED' ? 410 : 400,
      payload: {
        success: false,
        code: tokenResult.code,
        error: tokenResult.error,
        email: tokenResult.email,
        canResend: tokenResult.code === 'TOKEN_EXPIRED' || tokenResult.code === 'TOKEN_USED',
      },
    };
  }

  const { record } = tokenResult;
  const nowIso = new Date().toISOString();
  const store = readPersistentStore();
  const authStore = readAuthStore();

  const uIdx = store.users.findIndex(
    (u: any) => u.id === record.userId || normalizeEmail(u.email) === record.email
  );
  if (uIdx < 0) {
    return {
      status: 404,
      payload: { success: false, code: 'USER_NOT_FOUND', error: 'Associated account was not found.' },
    };
  }

  const existingUser = store.users[uIdx];
  const isTutorPendingApproval =
    existingUser.role === 'INSTRUCTOR' &&
    existingUser.tutorApprovalStatus !== 'APPROVED';

  const updatedUser = {
    ...existingUser,
    email_verified: true,
    isVerified: true,
    emailVerifiedAt: nowIso,
    status: isTutorPendingApproval ? 'ACTIVE' : 'ACTIVE',
    ...(existingUser.role === 'INSTRUCTOR'
      ? { tutorApprovalStatus: existingUser.tutorApprovalStatus || 'PENDING_APPROVAL' }
      : {}),
    updatedAt: nowIso,
  };
  store.users[uIdx] = updatedUser;

  // Activate linked Student profile or keep pending Tutor status synced
  if (updatedUser.role === 'STUDENT') {
    store.students = store.students.map((st: any) =>
      st.userId === updatedUser.id || normalizeEmail(st.email) === record.email
        ? { ...st, status: 'ACTIVE' }
        : st
    );
  }
  if (updatedUser.role === 'INSTRUCTOR' && !isTutorPendingApproval) {
    store.instructors = store.instructors.map((inst: any) =>
      inst.userId === updatedUser.id || normalizeEmail(inst.email) === record.email
        ? { ...inst, status: 'ACTIVE' }
        : inst
    );
  }

  store.updatedAt = nowIso;
  writePersistentStore(store);

  if (authStore.credentials[record.email]) {
    authStore.credentials[record.email] = {
      ...authStore.credentials[record.email],
      email_verified: true,
      emailVerifiedAt: nowIso,
      updatedAt: nowIso,
    };
    writeAuthStore(authStore);
  }

  await syncUserToFirestoreAdmin(updatedUser);

  const roleLabel = updatedUser.role === 'INSTRUCTOR' ? 'Faculty / Tutor' : 'Student Scholar';
  if (isTutorPendingApproval) {
    const mailRes = await sendPendingApprovalEmail({
      to: updatedUser.email,
      name: updatedUser.name,
      roleLabel,
    });
    recordEmailOutbox({
      to: updatedUser.email,
      subject: 'Your Account Registration Is Pending Approval',
      purpose: 'PENDING_APPROVAL',
      provider: mailRes.provider,
      messageId: mailRes.messageId,
      previewUrl: mailRes.previewUrl,
    });
  } else {
    const mailRes = await sendEmailVerifiedConfirmation({
      to: updatedUser.email,
      name: updatedUser.name,
      roleLabel,
      portalUrl: origin,
    });
    recordEmailOutbox({
      to: updatedUser.email,
      subject: 'Your Email Has Been Successfully Verified',
      purpose: 'EMAIL_VERIFIED_CONFIRMATION',
      provider: mailRes.provider,
      messageId: mailRes.messageId,
      previewUrl: mailRes.previewUrl,
    });
  }

  recordAuthAudit({
    event: 'EMAIL_VERIFIED',
    userId: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    ip,
    outcome: 'SUCCESS',
    message: isTutorPendingApproval
      ? 'Tutor email verified; awaiting Admin approval.'
      : 'Student email verified and account activated.',
  });

  return {
    status: 200,
    payload: {
      success: true,
      verified: true,
      email: updatedUser.email,
      role: updatedUser.role,
      tutorApprovalStatus: updatedUser.tutorApprovalStatus || 'APPROVED',
      pendingApproval: isTutorPendingApproval,
      message: isTutorPendingApproval
        ? 'Your email has been verified. Your Faculty / Tutor account is now pending Administrator approval.'
        : 'Your email has been verified and your account is now active. You may sign in to your dashboard.',
    },
  };
}

// 2. Verify Email Token (POST & GET)
app.post('/api/auth/verify-email', async (req, res) => {
  const { token } = req.body || {};
  const result = await executeEmailVerification(
    String(token || ''),
    getRequestOriginHttps(req),
    getClientIp(req)
  );
  return res.status(result.status).json(result.payload);
});

app.get('/api/auth/verify-email', async (req, res) => {
  const token = String(req.query.token || '');
  const result = await executeEmailVerification(
    token,
    getRequestOriginHttps(req),
    getClientIp(req)
  );
  return res.status(result.status).json(result.payload);
});

// 3. Resend Verification Email (Rate-Limited + Anti-Enumeration + Secure Token Regeneration)
app.post('/api/auth/resend-verification', async (req, res) => {
  const ip = getClientIp(req);
  const cleanEmail = normalizeEmail(req.body?.email);
  if (!isValidEmailFormat(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  const ipLimit = checkRateLimit(`resend-ip:${ip}`, 8, 5 * 60 * 1000);
  const emailLimit = checkRateLimit(`resend-email:${cleanEmail}`, 1, 45 * 1000);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec);
    return res.status(429).json({
      success: false,
      retryAfterSec: retryAfter,
      error: `Verification email requested recently. Please wait ${retryAfter} seconds before trying again.`,
    });
  }

  const user = await findUserAcrossStores(cleanEmail);
  const authStore = readAuthStore();
  const cred = authStore.credentials[cleanEmail];
  const alreadyVerified = Boolean(cred?.email_verified ?? user?.email_verified ?? user?.isVerified);

  if (user && !alreadyVerified) {
    const { rawToken } = createHashedVerificationToken({
      userId: user.id,
      email: cleanEmail,
      purpose: 'EMAIL_VERIFY',
      ttlMinutes: 30,
    });
    const verifyUrl = `${getRequestOriginHttps(req)}/?authAction=verify-email&token=${rawToken}`;
    const roleLabel = user.role === 'INSTRUCTOR' ? 'Faculty / Tutor' : 'Student Scholar';
    const mailRes = await sendVerificationEmail({
      to: cleanEmail,
      name: user.name || 'Scholar',
      roleLabel,
      verifyUrl,
      expiresMinutes: 30,
    });
    recordEmailOutbox({
      to: cleanEmail,
      subject: 'Verify Your Swanaya Media Academy Account',
      purpose: 'EMAIL_RESEND',
      provider: mailRes.provider,
      messageId: mailRes.messageId,
      previewUrl: mailRes.previewUrl,
    });
    recordAuthAudit({
      event: 'EMAIL_VERIFICATION_RESENT',
      userId: user.id,
      email: cleanEmail,
      role: user.role,
      ip,
      outcome: 'SUCCESS',
      message: 'Regenerated single-use verification token and resent verification email.',
    });
  } else {
    recordAuthAudit({
      event: 'EMAIL_VERIFICATION_RESEND_NOOP',
      email: cleanEmail,
      ip,
      outcome: 'SUCCESS',
      message: 'Generic anti-enumeration response returned for resend request.',
    });
  }

  // Anti-account-enumeration generic confirmation
  return res.json({
    success: true,
    message: 'If an unverified account exists for this email address, a fresh verification link has been sent.',
  });
});

// 4. Secure Credential Login (Enforces Email Verification, Role Boundaries & Scrypt Password Verification)
app.post('/api/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many sign-in attempts. Please try again in ${rl.retryAfterSec} seconds.`,
    });
  }

  try {
    const { identifier, password, portalTab } = req.body || {};
    const clean = normalizeEmail(identifier);
    const rawPassword = String(password || '');
    const selectedTab = String(portalTab || '').toUpperCase();

    if (!clean || !rawPassword) {
      return res.status(400).json({ success: false, error: 'Email/Username and Password are required.' });
    }

    const user = await findUserAcrossStores(clean);
    if (!user) {
      recordAuthAudit({
        event: 'LOGIN_FAILED_NOT_FOUND',
        email: clean,
        ip,
        outcome: 'DENIED',
        message: 'Sign-in attempt for unrecognized identifier.',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please check your username, email address, or password.',
      });
    }

    const userEmail = normalizeEmail(user.email);
    const isMdAccount = user.id === 'usr-md' || isAadithyanIdentifier(clean) || isAadithyanIdentifier(userEmail);
    if (isMdAccount) {
      ensureMdBootstrapCredential();
    }
    const authStore = readAuthStore();
    const cred =
      authStore.credentials[userEmail] ||
      (isMdAccount ? authStore.credentials['aadithyan.menon@swanayamedia.com'] : undefined);

    if (cred?.passwordHash) {
      const validPass = verifyCredentialPassword(rawPassword, cred);
      if (!validPass) {
        recordAuthAudit({
          event: 'LOGIN_FAILED_BAD_PASSWORD',
          userId: user.id,
          email: userEmail,
          role: user.role,
          ip,
          outcome: 'DENIED',
          message: 'Invalid password rejected.',
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Please check your username, email address, or password.',
        });
      }
    } else {
      // Accounts provisioned via Google Sign-In without a password must authenticate via Google or set a password via Forgot Password
      recordAuthAudit({
        event: 'LOGIN_PASSWORD_NOT_SET',
        userId: user.id,
        email: userEmail,
        role: user.role,
        ip,
        outcome: 'DENIED',
        message: 'Credential login attempted for Google/MD-seeded account with no local password set.',
      });
      return res.status(401).json({
        success: false,
        code: 'USE_GOOGLE_OR_RESET',
        error: 'This account uses Google Sign-In. Please click "Continue with Google" or use Forgot Password to configure a password.',
      });
    }

    const isEmailVerified = isMdAccount || Boolean(cred?.email_verified || user.email_verified || user.isVerified);
    if (!isEmailVerified) {
      recordAuthAudit({
        event: 'LOGIN_BLOCKED_UNVERIFIED_EMAIL',
        userId: user.id,
        email: userEmail,
        role: user.role,
        ip,
        outcome: 'DENIED',
        message: 'Blocked credential login prior to email verification.',
      });
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        email: userEmail,
        error: 'Please verify your email address using the link sent to your inbox before signing in.',
      });
    }

    if (user.status === 'INACTIVE' || user.adminAcceptanceStatus === 'DECLINED') {
      recordAuthAudit({
        event: 'LOGIN_BLOCKED_INACTIVE',
        userId: user.id,
        email: userEmail,
        role: user.role,
        ip,
        outcome: 'DENIED',
        message: 'Blocked sign-in for suspended/deactivated user.',
      });
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        error: 'This account is inactive or declined. Please contact the Managing Director.',
      });
    }

    if (user.role === 'INSTRUCTOR' && user.tutorApprovalStatus === 'PENDING_APPROVAL') {
      recordAuthAudit({
        event: 'LOGIN_BLOCKED_TUTOR_PENDING',
        userId: user.id,
        email: userEmail,
        role: user.role,
        ip,
        outcome: 'DENIED',
        message: 'Tutor login pending Admin acceptance in panel.',
      });
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_PENDING',
        email: userEmail,
        error: 'Your Faculty / Tutor registration is awaiting acceptance in the Admin Panel.',
      });
    }

    if (user.role === 'INSTRUCTOR' && user.tutorApprovalStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REJECTED',
        error: 'Your tutor application was not approved by administration.',
      });
    }

    const upperRole = String(user.role || '').toUpperCase();
    const isAdminRole = ['MD', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'ACADEMIC_ADMIN', 'REVIEWER'].includes(upperRole);
    const isTutorRole = ['INSTRUCTOR', 'REVIEWER'].includes(upperRole);
    const isStudentRole = ['STUDENT', 'ALUMNI', 'PARENT'].includes(upperRole);

    if (selectedTab === 'ADMIN' && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'This account does not have Administrator authorization. Admin accounts can only be added by the MD.',
      });
    }
    if (selectedTab === 'TUTOR' && !isTutorRole && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'Please sign in via the Student Portal tab for student accounts.',
      });
    }
    if (selectedTab === 'STUDENT' && !isStudentRole && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'Please sign in via the Tutor or Admin Portal tab matching your account role.',
      });
    }

    const store = readPersistentStore();
    const student = store.students.find(
      (s: any) => s.userId === user.id || (user.email && normalizeEmail(s.email) === userEmail)
    );
    const instructor = store.instructors.find(
      (i: any) => i.userId === user.id || (user.email && normalizeEmail(i.email) === userEmail)
    );

    const safeUser = sanitizeUserForClient({ ...user, email_verified: true, isVerified: true });
    setSessionCookie(res, req, {
      userId: safeUser.id,
      email: userEmail,
      role: safeUser.role,
      email_verified: true,
    });

    recordAuthAudit({
      event: 'LOGIN_SUCCESS',
      userId: safeUser.id,
      email: userEmail,
      role: safeUser.role,
      ip,
      outcome: 'SUCCESS',
      message: `Authenticated via ${selectedTab || safeUser.role} portal.`,
    });

    return res.json({
      success: true,
      user: safeUser,
      student,
      instructor,
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/login:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Sign-in failed.' });
  }
});

// 4b. Re-Authenticate Active or Switched Session via Username & Password
app.post('/api/auth/reauth', async (req, res) => {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`reauth:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many re-authentication attempts. Please try again in ${rl.retryAfterSec} seconds.`,
    });
  }

  try {
    const { identifier, username, password, expectedUserId, portalTab } = req.body || {};
    const rawIdentifier = String(username || identifier || '').trim();
    const clean = normalizeEmail(rawIdentifier);
    const rawPassword = String(password || '');
    const selectedTab = String(portalTab || '').toUpperCase();

    if (!clean || !rawPassword) {
      return res.status(400).json({ success: false, error: 'Username (or Email) and Password are required to re-authenticate.' });
    }

    const user = await findUserAcrossStores(clean);
    if (!user) {
      recordAuthAudit({
        event: 'REAUTH_FAILED_NOT_FOUND',
        email: clean,
        ip,
        outcome: 'DENIED',
        message: 'Re-authentication failed for unrecognized username/email.',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password. Please check your credentials.',
      });
    }

    if (expectedUserId && user.id !== expectedUserId && String(req.body?.requireSameUser || '') === 'true') {
      return res.status(403).json({
        success: false,
        error: 'Entered username does not match the currently active session.',
      });
    }

    const userEmail = normalizeEmail(user.email);
    const isMdAccount = user.id === 'usr-md' || isAadithyanIdentifier(clean) || isAadithyanIdentifier(userEmail);
    if (isMdAccount) {
      ensureMdBootstrapCredential();
    }
    const authStore = readAuthStore();
    const cred =
      authStore.credentials[userEmail] ||
      (isMdAccount ? authStore.credentials['aadithyan.menon@swanayamedia.com'] : undefined);

    if (!cred?.passwordHash || !verifyCredentialPassword(rawPassword, cred)) {
      recordAuthAudit({
        event: 'REAUTH_FAILED_BAD_PASSWORD',
        userId: user.id,
        email: userEmail,
        role: user.role,
        ip,
        outcome: 'DENIED',
        message: 'Invalid password rejected during username/password re-authentication.',
      });
      return res.status(401).json({
        success: false,
        error: !cred?.passwordHash
          ? 'No local password is configured for this account yet. Use Forgot Password or Google Sign-In.'
          : 'Invalid username or password. Please check your credentials.',
      });
    }

    if (user.status === 'INACTIVE' || user.adminAcceptanceStatus === 'DECLINED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        error: 'This account is inactive or declined. Please contact the Managing Director.',
      });
    }

    if (user.role === 'INSTRUCTOR' && user.tutorApprovalStatus === 'PENDING_APPROVAL') {
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_PENDING',
        error: 'Your Faculty / Tutor registration is awaiting acceptance in the Admin Panel.',
      });
    }

    if (user.role === 'INSTRUCTOR' && user.tutorApprovalStatus === 'REJECTED') {
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REJECTED',
        error: 'Your tutor application was not approved by administration.',
      });
    }

    const upperRole = String(user.role || '').toUpperCase();
    const isAdminRole = ['MD', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'ACADEMIC_ADMIN', 'REVIEWER'].includes(upperRole);
    const isTutorRole = ['INSTRUCTOR', 'REVIEWER'].includes(upperRole);
    const isStudentRole = ['STUDENT', 'ALUMNI', 'PARENT'].includes(upperRole);

    if (selectedTab === 'ADMIN' && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'This account does not have Administrator authorization.',
      });
    }
    if (selectedTab === 'TUTOR' && !isTutorRole && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'This account does not belong to the Tutor portal.',
      });
    }
    if (selectedTab === 'STUDENT' && !isStudentRole && !isAdminRole) {
      return res.status(403).json({
        success: false,
        error: 'This account does not belong to the Student portal.',
      });
    }

    const store = readPersistentStore();
    const student = store.students.find(
      (s: any) => s.userId === user.id || (user.email && normalizeEmail(s.email) === userEmail)
    );
    const instructor = store.instructors.find(
      (i: any) => i.userId === user.id || (user.email && normalizeEmail(i.email) === userEmail)
    );

    const safeUser = sanitizeUserForClient({ ...user, email_verified: true, isVerified: true });
    setSessionCookie(res, req, {
      userId: safeUser.id,
      email: userEmail,
      role: safeUser.role,
      email_verified: true,
    });

    const reauthenticatedAt = new Date().toISOString();
    recordAuthAudit({
      event: 'REAUTH_SUCCESS',
      userId: safeUser.id,
      email: userEmail,
      role: safeUser.role,
      ip,
      outcome: 'SUCCESS',
      message: `Re-authenticated with username/password (${safeUser.username || userEmail}).`,
    });

    return res.json({
      success: true,
      user: safeUser,
      student,
      instructor,
      reauthenticatedAt,
      message: `Re-authenticated as ${safeUser.username || safeUser.name} successfully.`,
    });
  } catch (err: any) {
    console.error('Error in POST /api/auth/reauth:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Re-authentication failed.' });
  }
});

// 5. Establish Backend Verified Session for Google/Firebase Verified Sign-In
app.post('/api/auth/firebase-session', async (req, res) => {
  try {
    const { userId, email, role, emailVerified } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    if (!userId || !cleanEmail || !emailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Verified Google email session is required.',
      });
    }
    const resolvedRole = isAadithyanIdentifier(cleanEmail) ? 'MD' : String(role || 'STUDENT');
    setSessionCookie(res, req, {
      userId: String(userId),
      email: cleanEmail,
      role: resolvedRole,
      email_verified: true,
    });
    recordAuthAudit({
      event: 'GOOGLE_SESSION_ESTABLISHED',
      userId: String(userId),
      email: cleanEmail,
      role: resolvedRole,
      ip: getClientIp(req),
      outcome: 'SUCCESS',
      message: 'Verified Firebase Google session synchronized.',
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 6. Logout Session
app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res, req);
  return res.json({ success: true });
});

// 7. Protected Backend Middleware Check (Enforces Active Status Across Reloads/Logouts)
app.get('/api/auth/me', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const session = req.authSession!;
  const user = await findUserAcrossStores(session.userId) || await findUserAcrossStores(session.email);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Account not found.' });
  }
  if (user.status === 'INACTIVE') {
    clearSessionCookie(res, req);
    return res.status(403).json({ success: false, code: 'ACCOUNT_INACTIVE', error: 'Account inactive.' });
  }
  return res.json({
    success: true,
    user: sanitizeUserForClient({ ...user, email_verified: true, isVerified: true }),
  });
});

// ============================================================================
// PHONE & WHATSAPP 6-DIGIT VERIFICATION, NUMBER CHANGE, COURSE CONFIRM & ACCEPT
// ============================================================================

app.get('/api/settings/verification-phone', (_req, res) => {
  const settings = getVerificationSettings();
  return res.json({ success: true, settings });
});

app.post('/api/settings/verification-phone', (req, res) => {
  try {
    const { academyVerificationPhone, defaultChannel, updatedBy } = req.body || {};
    const cleanPhone = String(academyVerificationPhone || '').trim();
    if (!cleanPhone || normalizePhoneDigits(cleanPhone).length < 6) {
      return res.status(400).json({ success: false, error: 'Please provide a valid Phone or WhatsApp verification number (at least 6 digits).' });
    }
    const channel: VerificationChannel = String(defaultChannel || '').toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP';
    const settings = updateVerificationSettings({
      academyVerificationPhone: cleanPhone,
      defaultChannel: channel,
      updatedBy: updatedBy ? String(updatedBy) : 'Admin',
    });
    recordAuthAudit({
      event: 'VERIFICATION_PHONE_SETTING_UPDATED',
      email: updatedBy ? String(updatedBy) : undefined,
      ip: getClientIp(req),
      outcome: 'SUCCESS',
      message: `Updated Academy Phone/WhatsApp verification desk to ${settings.academyVerificationPhone} (${settings.defaultChannel}).`,
    });
    return res.json({ success: true, settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to save verification number.' });
  }
});

app.post('/api/auth/send-phone-code', (req, res) => {
  const ip = getClientIp(req);
  try {
    const { phone, channel, purpose, userId, email } = req.body || {};
    const verificationSettings = getVerificationSettings();
    const targetPhone = String(phone || '').trim() || verificationSettings.academyVerificationPhone || DEFAULT_ACADEMY_VERIFICATION_PHONE;
    const digits = normalizePhoneDigits(targetPhone);
    if (!digits || digits.length < 6) {
      return res.status(400).json({ success: false, error: 'Please enter a valid Phone or WhatsApp number.' });
    }

    const rl = checkRateLimit(`phone-otp:${ip}:${digits}`, 15, 5 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        retryAfterSec: rl.retryAfterSec,
        error: `Verification code sent recently. Please wait ${rl.retryAfterSec} seconds.`,
      });
    }

    const resolvedChannel: VerificationChannel =
      String(channel || '').toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP';
    const allowedPurposes: PhoneOtpPurpose[] = ['REGISTER', 'COURSE_REGISTER', 'CHANGE_NUMBER', 'LOGIN'];
    const upperPurpose = String(purpose || 'REGISTER').toUpperCase() as PhoneOtpPurpose;
    const resolvedPurpose: PhoneOtpPurpose = allowedPurposes.includes(upperPurpose) ? upperPurpose : 'REGISTER';

    const otp = createPhoneVerificationCode({
      phone: targetPhone,
      channel: resolvedChannel,
      purpose: resolvedPurpose,
      userId: userId ? String(userId) : undefined,
      email: email ? normalizeEmail(email) : undefined,
      ttlMinutes: 10,
    });

    recordAuthAudit({
      event: 'PHONE_VERIFICATION_CODE_SENT',
      userId: userId ? String(userId) : undefined,
      email: email ? normalizeEmail(email) : undefined,
      ip,
      outcome: 'SUCCESS',
      message: `Dispatched 6-digit ${resolvedChannel} code to ${targetPhone} (${resolvedPurpose}).`,
    });

    return res.json({
      success: true,
      phone: targetPhone,
      channel: resolvedChannel,
      purpose: resolvedPurpose,
      expiresInMinutes: 10,
      whatsappUrl: otp.whatsappUrl,
      devCode: otp.code,
      academyVerificationPhone: verificationSettings.academyVerificationPhone,
      message: `6-digit ${resolvedChannel === 'WHATSAPP' ? 'WhatsApp' : 'Phone'} verification code ready for ${targetPhone}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to generate verification code.' });
  }
});

app.post('/api/auth/verify-phone-code', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const { phone, code, purpose, userId, email, channel } = req.body || {};
    const targetPhone = String(phone || '').trim() || getVerificationSettings().academyVerificationPhone || DEFAULT_ACADEMY_VERIFICATION_PHONE;
    const allowedPurposes: PhoneOtpPurpose[] = ['REGISTER', 'COURSE_REGISTER', 'CHANGE_NUMBER', 'LOGIN'];
    const upperPurpose = String(purpose || '').toUpperCase() as PhoneOtpPurpose;
    const expectedPurpose = allowedPurposes.includes(upperPurpose) ? upperPurpose : undefined;

    const verifyRes = verifyPhoneVerificationCode({
      phone: targetPhone,
      code: String(code || ''),
      purpose: expectedPurpose,
    });

    if (!verifyRes.ok) {
      recordAuthAudit({
        event: 'PHONE_VERIFICATION_FAILED',
        userId: userId ? String(userId) : undefined,
        email: email ? normalizeEmail(email) : undefined,
        ip,
        outcome: 'DENIED',
        message: verifyRes.error,
      });
      return res.status(verifyRes.code === 'CODE_EXPIRED' ? 410 : 400).json({
        success: false,
        code: verifyRes.code,
        error: verifyRes.error,
      });
    }

    const nowIso = new Date().toISOString();
    const resolvedChannel: VerificationChannel =
      verifyRes.record.channel || (String(channel || '').toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP');
    const lookupIdentifier = String(userId || verifyRes.record.userId || email || verifyRes.record.email || '').trim();
    const store = readPersistentStore();
    const authStore = readAuthStore();
    let updatedUser: any = null;
    let linkedStudent: any = null;
    let linkedInstructor: any = null;

    if (lookupIdentifier) {
      const uIdx = store.users.findIndex(
        (u: any) =>
          u.id === lookupIdentifier ||
          normalizeEmail(u.email) === normalizeEmail(lookupIdentifier) ||
          (u.username && normalizeEmail(u.username) === normalizeEmail(lookupIdentifier))
      );
      if (uIdx >= 0) {
        const current = store.users[uIdx];
        const nextStatus = current.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : current.status || 'ACTIVE';
        updatedUser = {
          ...current,
          phone: targetPhone,
          whatsappPhone: targetPhone,
          verifiedPhone: targetPhone,
          phone_verified: true,
          phoneVerifiedAt: nowIso,
          verificationChannel: resolvedChannel,
          email_verified: true,
          isVerified: true,
          status: nextStatus,
          updatedAt: nowIso,
        };
        store.users[uIdx] = updatedUser;

        store.students = store.students.map((st: any) => {
          if (st.userId === updatedUser.id || normalizeEmail(st.email) === normalizeEmail(updatedUser.email)) {
            const nextSt = {
              ...st,
              phone: targetPhone,
              whatsappPhone: targetPhone,
              phone_verified: true,
              verifiedPhone: targetPhone,
              status: st.status === 'INACTIVE' ? 'ACTIVE' : st.status,
            };
            linkedStudent = nextSt;
            return nextSt;
          }
          return st;
        });

        store.instructors = store.instructors.map((inst: any) => {
          if (inst.userId === updatedUser.id || normalizeEmail(inst.email) === normalizeEmail(updatedUser.email)) {
            linkedInstructor = { ...inst, phone: targetPhone };
            return linkedInstructor;
          }
          return inst;
        });

        store.updatedAt = nowIso;
        writePersistentStore(store);

        const credKey = normalizeEmail(updatedUser.email);
        if (authStore.credentials[credKey]) {
          authStore.credentials[credKey] = {
            ...authStore.credentials[credKey],
            phone: targetPhone,
            whatsappPhone: targetPhone,
            phone_verified: true,
            phoneVerifiedAt: nowIso,
            email_verified: true,
            updatedAt: nowIso,
          };
          writeAuthStore(authStore);
        }

        await syncUserToFirestoreAdmin(updatedUser);

        if (updatedUser.role !== 'INSTRUCTOR' || updatedUser.tutorApprovalStatus === 'APPROVED') {
          setSessionCookie(res, req, {
            userId: updatedUser.id,
            email: normalizeEmail(updatedUser.email),
            role: updatedUser.role,
            email_verified: true,
          });
        }
      }
    }

    const academyPhone = getVerificationSettings().academyVerificationPhone || DEFAULT_ACADEMY_VERIFICATION_PHONE;
    const waDigits = formatWhatsappDigits(targetPhone);
    const confirmText = `Swanaya Media Academy: Your ${resolvedChannel === 'WHATSAPP' ? 'WhatsApp' : 'Phone'} number (${targetPhone}) has been verified successfully.`;
    recordConfirmationMessage({
      recipientName: updatedUser?.name || 'Academy User',
      recipientPhone: targetPhone,
      recipientEmail: updatedUser?.email,
      academyPhone,
      channel: resolvedChannel,
      type: 'PHONE_VERIFIED',
      messageText: confirmText,
      whatsappUrl: `https://wa.me/${waDigits}?text=${encodeURIComponent(confirmText)}`,
    });

    recordAuthAudit({
      event: 'PHONE_VERIFICATION_SUCCESS',
      userId: updatedUser?.id,
      email: updatedUser?.email,
      role: updatedUser?.role,
      ip,
      outcome: 'SUCCESS',
      message: `Verified ${resolvedChannel} number ${targetPhone} with 6-digit code.`,
    });

    return res.json({
      success: true,
      verified: true,
      phone: targetPhone,
      channel: resolvedChannel,
      user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
      student: linkedStudent,
      instructor: linkedInstructor,
      message: `${resolvedChannel === 'WHATSAPP' ? 'WhatsApp' : 'Phone'} number ${targetPhone} verified successfully!`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Phone verification failed.' });
  }
});

app.post('/api/auth/change-phone', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const { userId, email, newPhone, channel, sendCode, purpose } = req.body || {};
    const cleanNewPhone = String(newPhone || '').trim();
    if (!cleanNewPhone || normalizePhoneDigits(cleanNewPhone).length < 6) {
      return res.status(400).json({ success: false, error: 'Please enter a valid new Phone or WhatsApp number (at least 6 digits).' });
    }

    const resolvedChannel: VerificationChannel =
      String(channel || '').toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP';
    const lookupIdentifier = String(userId || email || '').trim();
    const nowIso = new Date().toISOString();
    let updatedUser: any = null;

    if (lookupIdentifier) {
      const store = readPersistentStore();
      const authStore = readAuthStore();
      const uIdx = store.users.findIndex(
        (u: any) =>
          u.id === lookupIdentifier ||
          normalizeEmail(u.email) === normalizeEmail(lookupIdentifier)
      );
      if (uIdx >= 0) {
        updatedUser = {
          ...store.users[uIdx],
          phone: cleanNewPhone,
          whatsappPhone: cleanNewPhone,
          verificationChannel: resolvedChannel,
          phone_verified: false,
          verifiedPhone: undefined,
          updatedAt: nowIso,
        };
        store.users[uIdx] = updatedUser;
        store.students = store.students.map((st: any) =>
          st.userId === updatedUser.id || normalizeEmail(st.email) === normalizeEmail(updatedUser.email)
            ? { ...st, phone: cleanNewPhone, whatsappPhone: cleanNewPhone, phone_verified: false }
            : st
        );
        store.instructors = store.instructors.map((inst: any) =>
          inst.userId === updatedUser.id || normalizeEmail(inst.email) === normalizeEmail(updatedUser.email)
            ? { ...inst, phone: cleanNewPhone }
            : inst
        );
        store.updatedAt = nowIso;
        writePersistentStore(store);

        const credKey = normalizeEmail(updatedUser.email);
        if (authStore.credentials[credKey]) {
          authStore.credentials[credKey] = {
            ...authStore.credentials[credKey],
            phone: cleanNewPhone,
            whatsappPhone: cleanNewPhone,
            phone_verified: false,
            updatedAt: nowIso,
          };
          writeAuthStore(authStore);
        }
        await syncUserToFirestoreAdmin(updatedUser);
      }
    }

    let otpResult: { code: string; whatsappUrl: string } | null = null;
    if (sendCode !== false) {
      const allowedPurposes: PhoneOtpPurpose[] = ['REGISTER', 'COURSE_REGISTER', 'CHANGE_NUMBER', 'LOGIN'];
      const upperPurpose = String(purpose || 'CHANGE_NUMBER').toUpperCase() as PhoneOtpPurpose;
      const resolvedPurpose: PhoneOtpPurpose = allowedPurposes.includes(upperPurpose) ? upperPurpose : 'CHANGE_NUMBER';
      const created = createPhoneVerificationCode({
        phone: cleanNewPhone,
        channel: resolvedChannel,
        purpose: resolvedPurpose,
        userId: updatedUser?.id || (userId ? String(userId) : undefined),
        email: updatedUser?.email || (email ? normalizeEmail(email) : undefined),
        ttlMinutes: 10,
      });
      otpResult = { code: created.code, whatsappUrl: created.whatsappUrl };
    }

    recordAuthAudit({
      event: 'VERIFICATION_PHONE_CHANGED',
      userId: updatedUser?.id,
      email: updatedUser?.email || email,
      ip,
      outcome: 'SUCCESS',
      message: `Updated verification number to ${cleanNewPhone} (${resolvedChannel}).`,
    });

    return res.json({
      success: true,
      phone: cleanNewPhone,
      channel: resolvedChannel,
      user: updatedUser ? sanitizeUserForClient(updatedUser) : null,
      devCode: otpResult?.code,
      whatsappUrl: otpResult?.whatsappUrl,
      expiresInMinutes: 10,
      message: `Verification number changed to ${cleanNewPhone}. A new 6-digit ${resolvedChannel === 'WHATSAPP' ? 'WhatsApp' : 'Phone'} code has been sent.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Could not change verification number.' });
  }
});

// Course Registration Confirmation Message Dispatch & Persistence
app.post('/api/registrations/course-confirm', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const {
      registrationId,
      userId,
      studentId,
      studentName,
      studentEmail,
      phone,
      channel,
      courseId,
      courseCode,
      courseTitle,
      preferredBatch,
      studyMode,
      preferredSchedule,
      qualification,
      careerGoals,
      source,
      phoneVerified,
    } = req.body || {};

    const cleanName = String(studentName || '').trim() || 'Student Applicant';
    const verificationSettings = getVerificationSettings();
    const academyPhone = verificationSettings.academyVerificationPhone || DEFAULT_ACADEMY_VERIFICATION_PHONE;
    const recipientPhone = String(phone || '').trim() || academyPhone;
    const resolvedChannel: VerificationChannel =
      String(channel || '').toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP';
    const cleanCourseTitle = String(courseTitle || 'Academy Program').trim();
    const cleanBatch = String(preferredBatch || 'Next Available Intake').trim();
    const cleanMode = String(studyMode || 'HYBRID').trim();
    const nowIso = new Date().toISOString();

    const messageText = `Hello ${cleanName}, your course registration at Swanaya Media Academy for "${cleanCourseTitle}" (${cleanMode} · Batch: ${cleanBatch}) has been received! Status: Pending Admin Acceptance.`;

    const recipientWaDigits = formatWhatsappDigits(recipientPhone);
    const academyWaDigits = formatWhatsappDigits(academyPhone);
    const whatsappUrl = `https://wa.me/${recipientWaDigits}?text=${encodeURIComponent(messageText)}`;
    const academyWhatsappUrl = `https://wa.me/${academyWaDigits}?text=${encodeURIComponent(
      `New Course Registration Confirmation · ${cleanName} (${recipientPhone}) registered for ${cleanCourseTitle} (${cleanBatch}).`
    )}`;

    const confRecord = recordConfirmationMessage({
      recipientName: cleanName,
      recipientPhone,
      recipientEmail: studentEmail ? normalizeEmail(studentEmail) : undefined,
      academyPhone,
      channel: resolvedChannel,
      type: 'COURSE_REGISTRATION',
      courseId: courseId ? String(courseId) : undefined,
      courseTitle: cleanCourseTitle,
      messageText,
      whatsappUrl,
    });

    const store = readPersistentStore();
    const regId = String(registrationId || `reg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`);
    const regEntry = {
      id: regId,
      userId: userId || '',
      studentId: studentId || '',
      studentName: cleanName,
      studentEmail: studentEmail ? normalizeEmail(studentEmail) : '',
      studentPhone: recipientPhone,
      verifiedPhone: phoneVerified ? recipientPhone : undefined,
      verificationChannel: resolvedChannel,
      confirmationMessageSent: true,
      confirmationSentAt: confRecord.sentAt,
      confirmationId: confRecord.id,
      confirmationMessageText: messageText,
      source: source || 'COURSE_REGISTRATION',
      courseId: courseId || 'c-1',
      courseCode: courseCode || '',
      courseTitle: cleanCourseTitle,
      answers: {
        studyMode: cleanMode,
        preferredBatch: cleanBatch,
        preferredSchedule: preferredSchedule || 'WEEKDAY_INTENSIVE',
        qualification: qualification || 'Applicant',
        careerGoals: careerGoals || 'Academic Progression',
      },
      status: 'PENDING',
      departmentVerificationStatus: 'PENDING',
      mdVerificationStatus: 'PENDING_MD',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const rIdx = store.courseRegistrations.findIndex((r: any) => r.id === regId);
    if (rIdx >= 0) {
      store.courseRegistrations[rIdx] = { ...store.courseRegistrations[rIdx], ...regEntry };
    } else {
      store.courseRegistrations.unshift(regEntry);
    }
    store.updatedAt = nowIso;
    writePersistentStore(store);

    if (db) {
      try {
        await db.collection('course_registrations').doc(regId).set(regEntry, { merge: true });
      } catch {
        // Offline / rules fallback preserved locally
      }
    }

    recordAuthAudit({
      event: 'COURSE_REGISTRATION_CONFIRMED',
      userId: userId ? String(userId) : undefined,
      email: studentEmail ? normalizeEmail(studentEmail) : undefined,
      ip,
      outcome: 'SUCCESS',
      message: `Course registration confirmation (${confRecord.id}) sent to ${recipientPhone} for ${cleanCourseTitle}.`,
    });

    return res.json({
      success: true,
      confirmationId: confRecord.id,
      recipientPhone,
      academyVerificationPhone: academyPhone,
      channel: resolvedChannel,
      messageText,
      whatsappUrl,
      academyWhatsappUrl,
      sentAt: confRecord.sentAt,
      registration: regEntry,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to send confirmation message.' });
  }
});

// Unified Admin Queue: View New Account Registrations & New Course Registrations
app.get('/api/registrations/queue', (_req, res) => {
  try {
    const store = readPersistentStore();
    const authStore = readAuthStore();

    const newUsers = store.users
      .filter((u: any) => ['STUDENT', 'INSTRUCTOR'].includes(String(u.role || '').toUpperCase()))
      .map((u: any) => sanitizeUserForClient(u))
      .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    return res.json({
      success: true,
      newUsers,
      courseRegistrations: store.courseRegistrations,
      applications: store.applications,
      confirmationMessages: authStore.confirmationMessages.slice(0, 50),
      verificationSettings: getVerificationSettings(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to load registration queue.' });
  }
});

// Admin Panel Action: Accept or Decline New Account / Course Registration / Application
app.post('/api/registrations/accept', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const {
      targetType,
      targetId,
      decision,
      adminName,
      adminEmail,
      remarks,
    } = req.body || {};

    const cleanType = String(targetType || '').toUpperCase();
    const upperDecision = String(decision || 'ACCEPTED').toUpperCase() === 'REJECTED' ? 'REJECTED' : 'ACCEPTED';
    if (!targetId || !['USER', 'COURSE_REGISTRATION', 'APPLICATION'].includes(cleanType)) {
      return res.status(400).json({ success: false, error: 'targetType (USER|COURSE_REGISTRATION|APPLICATION) and targetId are required.' });
    }

    const store = readPersistentStore();
    const authStore = readAuthStore();
    const nowIso = new Date().toISOString();
    const verifier = String(adminName || adminEmail || 'Academy Admin').trim();
    const academyPhone = getVerificationSettings().academyVerificationPhone || DEFAULT_ACADEMY_VERIFICATION_PHONE;

    let recipientName = 'Applicant';
    let recipientPhone = academyPhone;
    let recipientEmail = '';
    let courseTitle = '';
    let updatedEntity: any = null;

    if (cleanType === 'USER') {
      const uIdx = store.users.findIndex((u: any) => u.id === targetId);
      if (uIdx < 0) {
        return res.status(404).json({ success: false, error: 'Registered user account not found.' });
      }
      const existing = store.users[uIdx];
      recipientName = existing.name || 'Member';
      recipientPhone = existing.whatsappPhone || existing.phone || academyPhone;
      recipientEmail = existing.email || '';

      updatedEntity = {
        ...existing,
        adminAcceptanceStatus: upperDecision === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED',
        status: upperDecision === 'ACCEPTED' ? 'ACTIVE' : 'INACTIVE',
        isVerified: upperDecision === 'ACCEPTED',
        email_verified: true,
        ...(existing.role === 'INSTRUCTOR'
          ? { tutorApprovalStatus: upperDecision === 'ACCEPTED' ? 'APPROVED' : 'REJECTED' }
          : {}),
        acceptedBy: verifier,
        acceptedAt: nowIso,
        updatedAt: nowIso,
      };
      store.users[uIdx] = updatedEntity;

      if (existing.role === 'STUDENT') {
        store.students = store.students.map((st: any) =>
          st.userId === existing.id || normalizeEmail(st.email) === normalizeEmail(existing.email)
            ? { ...st, status: upperDecision === 'ACCEPTED' ? 'ACTIVE' : 'INACTIVE' }
            : st
        );
      }
      if (existing.role === 'INSTRUCTOR') {
        store.instructors = store.instructors.map((inst: any) =>
          inst.userId === existing.id || normalizeEmail(inst.email) === normalizeEmail(existing.email)
            ? { ...inst, status: upperDecision === 'ACCEPTED' ? 'ACTIVE' : 'INACTIVE' }
            : inst
        );
      }

      const credKey = normalizeEmail(existing.email);
      if (authStore.credentials[credKey]) {
        authStore.credentials[credKey] = {
          ...authStore.credentials[credKey],
          email_verified: true,
          updatedAt: nowIso,
        };
        writeAuthStore(authStore);
      }

      await syncUserToFirestoreAdmin(updatedEntity);
    } else if (cleanType === 'COURSE_REGISTRATION') {
      const rIdx = store.courseRegistrations.findIndex((r: any) => r.id === targetId);
      const rawReg = rIdx >= 0 ? store.courseRegistrations[rIdx] : (req.body?.registrationSnapshot || null);
      if (!rawReg) {
        return res.status(404).json({ success: false, error: 'Course registration record not found.' });
      }
      recipientName = rawReg.studentName || 'Student Scholar';
      recipientPhone = rawReg.verifiedPhone || rawReg.studentPhone || academyPhone;
      recipientEmail = rawReg.studentEmail || '';
      courseTitle = rawReg.courseTitle || 'Academy Program';

      updatedEntity = {
        ...rawReg,
        status: upperDecision === 'ACCEPTED' ? 'MD_VERIFIED' : 'REJECTED',
        departmentVerificationStatus: upperDecision === 'ACCEPTED' ? 'VERIFIED' : 'REJECTED',
        departmentVerifiedBy: rawReg.departmentVerifiedBy || verifier,
        departmentVerifiedAt: rawReg.departmentVerifiedAt || nowIso,
        mdVerificationStatus: upperDecision === 'ACCEPTED' ? 'VERIFIED' : 'REJECTED',
        mdVerifiedBy: verifier,
        mdVerifiedAt: nowIso,
        mdRemarks: remarks || (upperDecision === 'ACCEPTED' ? `Accepted in Admin Panel by ${verifier}` : 'Declined by Admin'),
        updatedAt: nowIso,
      };
      if (rIdx >= 0) store.courseRegistrations[rIdx] = updatedEntity;
      else store.courseRegistrations.unshift(updatedEntity);

      if (upperDecision === 'ACCEPTED' && (rawReg.studentId || rawReg.userId || rawReg.studentEmail)) {
        store.students = store.students.map((st: any) =>
          st.id === rawReg.studentId ||
          st.userId === rawReg.userId ||
          (rawReg.studentEmail && normalizeEmail(st.email) === normalizeEmail(rawReg.studentEmail))
            ? { ...st, status: 'ACTIVE', courseId: rawReg.courseId || st.courseId }
            : st
        );
        store.users = store.users.map((u: any) => {
          if (
            u.id === rawReg.userId ||
            (rawReg.studentEmail && normalizeEmail(u.email) === normalizeEmail(rawReg.studentEmail))
          ) {
            const existingEnrolled = Array.isArray(u.enrolledCourseIds) ? u.enrolledCourseIds : [];
            const nextEnrolled = rawReg.courseId && !existingEnrolled.includes(rawReg.courseId)
              ? [...existingEnrolled, rawReg.courseId]
              : existingEnrolled;
            return {
              ...u,
              status: 'ACTIVE',
              adminAcceptanceStatus: 'ACCEPTED',
              courseId: rawReg.courseId || u.courseId,
              enrolledCourseIds: nextEnrolled,
              updatedAt: nowIso,
            };
          }
          return u;
        });
      }

      if (db) {
        try {
          await db.collection('course_registrations').doc(targetId).set(updatedEntity, { merge: true });
        } catch {
          // fallback preserved
        }
      }
    } else if (cleanType === 'APPLICATION') {
      const aIdx = store.applications.findIndex((a: any) => a.id === targetId);
      const rawApp = aIdx >= 0 ? store.applications[aIdx] : (req.body?.registrationSnapshot || null);
      if (!rawApp) {
        return res.status(404).json({ success: false, error: 'Application record not found.' });
      }
      recipientName = rawApp.name || 'Applicant';
      recipientPhone = rawApp.verifiedPhone || rawApp.phone || academyPhone;
      recipientEmail = rawApp.email || '';
      courseTitle = rawApp.courseTitle || rawApp.courseId || 'Academy Program';

      updatedEntity = {
        ...rawApp,
        status: upperDecision === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED',
        departmentVerificationStatus: upperDecision === 'ACCEPTED' ? 'VERIFIED' : 'REJECTED',
        mdVerificationStatus: upperDecision === 'ACCEPTED' ? 'VERIFIED' : 'REJECTED',
        mdVerifiedBy: verifier,
        mdVerifiedAt: nowIso,
        mdRemarks: remarks || undefined,
      };
      if (aIdx >= 0) store.applications[aIdx] = updatedEntity;
      else store.applications.unshift(updatedEntity);
    }

    store.updatedAt = nowIso;
    writePersistentStore(store);

    const waDigits = formatWhatsappDigits(recipientPhone);
    const confirmationText =
      upperDecision === 'ACCEPTED'
        ? `Congratulations ${recipientName}! Your registration${courseTitle ? ` for ${courseTitle}` : ''} at Swanaya Media Academy has been ACCEPTED by ${verifier}.`
        : `Hello ${recipientName}, your registration request at Swanaya Media Academy could not be accepted at this time. Contact ${academyPhone} for assistance.`;

    const confRecord = recordConfirmationMessage({
      recipientName,
      recipientPhone,
      recipientEmail: recipientEmail ? normalizeEmail(recipientEmail) : undefined,
      academyPhone,
      channel: 'WHATSAPP',
      type: 'REGISTRATION_ACCEPTED',
      courseTitle: courseTitle || undefined,
      messageText: confirmationText,
      whatsappUrl: `https://wa.me/${waDigits}?text=${encodeURIComponent(confirmationText)}`,
    });

    recordAuthAudit({
      event: `ADMIN_REGISTRATION_${upperDecision}`,
      email: recipientEmail || undefined,
      ip,
      outcome: 'SUCCESS',
      message: `${verifier} ${upperDecision.toLowerCase()} ${cleanType} registration (${targetId}).`,
    });

    const serializedEntity = cleanType === 'USER' ? sanitizeUserForClient(updatedEntity) : updatedEntity;

    return res.json({
      success: true,
      decision: upperDecision,
      targetType: cleanType,
      targetId,
      updated: serializedEntity,
      updatedEntity: serializedEntity,
      confirmationMessage: confRecord,
      message: `${recipientName}'s registration ${upperDecision === 'ACCEPTED' ? 'accepted' : 'declined'} successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to process registration decision.' });
  }
});

// 8. Forgot Password (Anti-Enumeration + Rate-Limited + Hashed Reset Token)
app.post('/api/auth/forgot-password', async (req, res) => {
  const ip = getClientIp(req);
  const cleanEmail = normalizeEmail(req.body?.email);
  if (!isValidEmailFormat(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  const rl = checkRateLimit(`forgot:${ip}:${cleanEmail}`, 4, 5 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many password reset requests. Please try again in ${rl.retryAfterSec} seconds.`,
    });
  }

  const user = await findUserAcrossStores(cleanEmail);
  if (user) {
    const { rawToken } = createHashedVerificationToken({
      userId: user.id,
      email: cleanEmail,
      purpose: 'PASSWORD_RESET',
      ttlMinutes: 30,
    });
    const resetUrl = `${getRequestOriginHttps(req)}/?authAction=reset-password&token=${rawToken}`;
    const mailRes = await sendPasswordResetEmail({
      to: cleanEmail,
      name: user.name || 'Scholar',
      resetUrl,
      expiresMinutes: 30,
    });
    recordEmailOutbox({
      to: cleanEmail,
      subject: 'Reset Your Academy Account Password',
      purpose: 'PASSWORD_RESET',
      provider: mailRes.provider,
      messageId: mailRes.messageId,
      previewUrl: mailRes.previewUrl,
    });
    recordAuthAudit({
      event: 'PASSWORD_RESET_REQUESTED',
      userId: user.id,
      email: cleanEmail,
      role: user.role,
      ip,
      outcome: 'SUCCESS',
      message: 'Password reset link generated and sent.',
    });
  } else {
    recordAuthAudit({
      event: 'PASSWORD_RESET_REQUEST_NOOP',
      email: cleanEmail,
      ip,
      outcome: 'SUCCESS',
      message: 'Anti-enumeration response issued for password reset.',
    });
  }

  return res.json({
    success: true,
    message: 'If an account exists for that email address, password reset instructions have been sent.',
  });
});

// 9. Reset Password Completion
app.post('/api/auth/reset-password', async (req, res) => {
  const ip = getClientIp(req);
  const { token, newPassword } = req.body || {};
  const rawPass = String(newPassword || '');
  if (rawPass.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
  }

  const tokenResult = consumeHashedVerificationToken({
    rawToken: String(token || ''),
    expectedPurpose: 'PASSWORD_RESET',
  });
  if (!tokenResult.ok) {
    recordAuthAudit({
      event: 'PASSWORD_RESET_FAILED',
      email: tokenResult.email,
      ip,
      outcome: 'DENIED',
      message: tokenResult.error,
    });
    return res.status(tokenResult.code === 'TOKEN_EXPIRED' ? 410 : 400).json({
      success: false,
      code: tokenResult.code,
      error: tokenResult.error,
    });
  }

  const { record } = tokenResult;
  const user = await findUserAcrossStores(record.userId) || await findUserAcrossStores(record.email);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Account not found.' });
  }

  const { salt, hash } = hashPassword(rawPass);
  const nowIso = new Date().toISOString();
  const authStore = readAuthStore();
  const existingCred = authStore.credentials[record.email];
  const emailVerified = Boolean(existingCred?.email_verified ?? user.email_verified ?? user.isVerified);

  authStore.credentials[record.email] = {
    userId: user.id,
    email: record.email,
    username: user.username,
    passwordSalt: salt,
    passwordHash: hash,
    email_verified: emailVerified,
    emailVerifiedAt: existingCred?.emailVerifiedAt || user.emailVerifiedAt,
    updatedAt: nowIso,
  };
  writeAuthStore(authStore);

  recordAuthAudit({
    event: 'PASSWORD_RESET_COMPLETED',
    userId: user.id,
    email: record.email,
    role: user.role,
    ip,
    outcome: 'SUCCESS',
    message: 'Password updated cleanly using single-use reset token.',
  });

  return res.json({
    success: true,
    message: 'Your password has been reset successfully. You can now sign in with your new password.',
  });
});

// 10. Email Change Verification Request
app.post('/api/auth/request-email-change', async (req: AuthedRequest, res) => {
  const ip = getClientIp(req);
  const { userId, currentEmail, newEmail } = req.body || {};
  const cleanNew = normalizeEmail(newEmail);
  const cleanOld = normalizeEmail(currentEmail);

  if (!userId || !isValidEmailFormat(cleanNew)) {
    return res.status(400).json({ success: false, error: 'Valid account ID and new email address are required.' });
  }
  if (cleanNew === cleanOld) {
    return res.status(400).json({ success: false, error: 'Please enter a different email address.' });
  }

  const rl = checkRateLimit(`email-change:${ip}:${userId}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many email change requests. Try again in ${rl.retryAfterSec} seconds.`,
    });
  }

  const user = await findUserAcrossStores(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User profile not found.' });
  }

  const store = readPersistentStore();
  const authStore = readAuthStore();
  const conflict =
    Boolean(authStore.credentials[cleanNew]) ||
    store.users.some((u: any) => u.id !== user.id && normalizeEmail(u.email) === cleanNew);

  if (conflict) {
    return res.status(409).json({ success: false, error: 'That email address is already registered to another account.' });
  }

  const { rawToken } = createHashedVerificationToken({
    userId: user.id,
    email: normalizeEmail(user.email),
    pendingEmail: cleanNew,
    purpose: 'EMAIL_CHANGE',
    ttlMinutes: 30,
  });

  const confirmUrl = `${getRequestOriginHttps(req)}/?authAction=confirm-email-change&token=${rawToken}`;
  const mailRes = await sendVerificationEmail({
    to: cleanNew,
    name: user.name || 'User',
    roleLabel: user.role,
    verifyUrl: confirmUrl,
    expiresMinutes: 30,
    isEmailChange: true,
  });

  recordEmailOutbox({
    to: cleanNew,
    subject: 'Verify Your Swanaya Media Academy Account',
    purpose: 'EMAIL_CHANGE',
    provider: mailRes.provider,
    messageId: mailRes.messageId,
    previewUrl: mailRes.previewUrl,
  });

  recordAuthAudit({
    event: 'EMAIL_CHANGE_REQUESTED',
    userId: user.id,
    email: cleanNew,
    role: user.role,
    ip,
    outcome: 'SUCCESS',
    message: `Requested email change from ${user.email} to ${cleanNew}.`,
  });

  return res.json({
    success: true,
    message: `Verification link sent to ${cleanNew}. Open it within 30 minutes to complete your email change.`,
  });
});

// 11. Confirm Email Change Token
app.post('/api/auth/confirm-email-change', async (req, res) => {
  const ip = getClientIp(req);
  const { token } = req.body || {};

  const tokenResult = consumeHashedVerificationToken({
    rawToken: String(token || ''),
    expectedPurpose: 'EMAIL_CHANGE',
  });
  if (!tokenResult.ok) {
    return res.status(tokenResult.code === 'TOKEN_EXPIRED' ? 410 : 400).json({
      success: false,
      code: tokenResult.code,
      error: tokenResult.error,
    });
  }

  const { record } = tokenResult;
  const newEmail = normalizeEmail(record.pendingEmail || '');
  if (!isValidEmailFormat(newEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid pending email in verification token.' });
  }

  const store = readPersistentStore();
  const authStore = readAuthStore();

  const conflict = store.users.some(
    (u: any) => u.id !== record.userId && normalizeEmail(u.email) === newEmail
  );
  if (conflict) {
    return res.status(409).json({ success: false, error: 'Target email is now associated with another account.' });
  }

  const uIdx = store.users.findIndex((u: any) => u.id === record.userId);
  if (uIdx < 0) {
    return res.status(404).json({ success: false, error: 'Account record not found.' });
  }

  const nowIso = new Date().toISOString();
  const oldEmail = normalizeEmail(store.users[uIdx].email);
  const updatedUser = {
    ...store.users[uIdx],
    email: newEmail,
    email_verified: true,
    isVerified: true,
    emailVerifiedAt: nowIso,
    updatedAt: nowIso,
  };
  store.users[uIdx] = updatedUser;
  store.students = store.students.map((s: any) =>
    s.userId === record.userId ? { ...s, email: newEmail } : s
  );
  store.instructors = store.instructors.map((i: any) =>
    i.userId === record.userId ? { ...i, email: newEmail } : i
  );
  store.updatedAt = nowIso;
  writePersistentStore(store);

  const oldCred = authStore.credentials[oldEmail];
  if (oldCred) {
    delete authStore.credentials[oldEmail];
    authStore.credentials[newEmail] = {
      ...oldCred,
      email: newEmail,
      email_verified: true,
      emailVerifiedAt: nowIso,
      updatedAt: nowIso,
    };
    writeAuthStore(authStore);
  }

  await syncUserToFirestoreAdmin(updatedUser);

  await sendEmailVerifiedConfirmation({
    to: newEmail,
    name: updatedUser.name,
    roleLabel: updatedUser.role,
    portalUrl: getRequestOriginHttps(req),
  });

  recordAuthAudit({
    event: 'EMAIL_CHANGED_VERIFIED',
    userId: updatedUser.id,
    email: newEmail,
    role: updatedUser.role,
    ip,
    outcome: 'SUCCESS',
    message: `Email address updated and verified (${oldEmail} -> ${newEmail}).`,
  });

  setSessionCookie(res, req, {
    userId: updatedUser.id,
    email: newEmail,
    role: updatedUser.role,
    email_verified: true,
  });

  return res.json({
    success: true,
    email: newEmail,
    user: sanitizeUserForClient(updatedUser),
    message: `Email address updated to ${newEmail} and verified successfully.`,
  });
});

// 12. Admin Approval for Pending Verified Tutors
app.post('/api/auth/admin-approve-tutor', async (req, res) => {
  try {
    const { tutorUserId, decision, adminEmail, adminName } = req.body || {};
    if (!tutorUserId || !['APPROVED', 'REJECTED'].includes(String(decision || '').toUpperCase())) {
      return res.status(400).json({ success: false, error: 'tutorUserId and decision (APPROVED|REJECTED) required.' });
    }

    const store = readPersistentStore();
    const uIdx = store.users.findIndex((u: any) => u.id === tutorUserId);
    if (uIdx < 0) {
      return res.status(404).json({ success: false, error: 'Tutor user not found.' });
    }

    const upperDecision = String(decision).toUpperCase() as 'APPROVED' | 'REJECTED';
    const nowIso = new Date().toISOString();
    const updatedUser = {
      ...store.users[uIdx],
      tutorApprovalStatus: upperDecision,
      status: upperDecision === 'APPROVED' ? 'ACTIVE' : 'INACTIVE',
      updatedAt: nowIso,
    };
    store.users[uIdx] = updatedUser;
    store.instructors = store.instructors.map((inst: any) =>
      inst.userId === tutorUserId
        ? { ...inst, status: upperDecision === 'APPROVED' ? 'ACTIVE' : 'INACTIVE' }
        : inst
    );
    store.updatedAt = nowIso;
    writePersistentStore(store);

    await syncUserToFirestoreAdmin(updatedUser);

    if (upperDecision === 'APPROVED') {
      await sendEmailVerifiedConfirmation({
        to: updatedUser.email,
        name: updatedUser.name,
        roleLabel: 'Faculty / Tutor',
        portalUrl: getRequestOriginHttps(req),
      });
    }

    recordAuthAudit({
      event: upperDecision === 'APPROVED' ? 'TUTOR_APPROVED' : 'TUTOR_REJECTED',
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      ip: getClientIp(req),
      outcome: 'SUCCESS',
      message: `Admin ${adminName || adminEmail || 'Admin'} marked tutor as ${upperDecision}.`,
    });

    return res.json({ success: true, user: sanitizeUserForClient(updatedUser) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 13. Admin / MD Authentication Audit Logs Endpoint (Protected)
app.get('/api/auth/audit-logs', requireVerifiedAuth, (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!['MD', 'SUPER_ADMIN', 'ADMIN', 'ACADEMIC_ADMIN', 'PRINCIPAL'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }
  const store = readAuthStore();
  return res.json({ success: true, auditLogs: store.auditLogs.slice(0, 100) });
});

// --- PERSISTENT COURSES STORAGE (MULTI-DEVICE & ADMIN-TO-FRONTEND PERSISTENCE) ---
const COURSES_FILE = path.resolve(DATA_DIR, 'persistent_courses.json');

const DEFAULT_SEED_COURSES = [
  {
    id: "c-1",
    code: "SMA-AIMCD",
    name: "Advanced Diploma in AI Media & Creative Direction",
    description: "Master modern AI video production, narrative storytelling, generative media workflows, visual effects, and digital branding for high-impact commercial campaigns.",
    duration: "12 Months",
    level: "DIPLOMA",
    eligibility: "12th Standard or Equivalent",
    fee: 75000,
    mode: "PHYSICAL",
    coordinator: "Devika Menon",
    status: "ACTIVE",
    thumbnailUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80",
    learningObjectives: [
      "Generative media models & prompting for production",
      "Cinematic direction, color grading, and video editing",
      "AI-driven commercial campaign design & delivery"
    ],
    careerOutcomes: ["Creative Director", "AI Media Specialist", "Visual Producer"]
  },
  {
    id: "c-2",
    code: "SMA-ADWDVC",
    name: "Advanced Diploma in Full-Stack Web Development & Vibe Coding",
    description: "Industry-aligned immersive program combining modern frontend architecture, scalable cloud microservices, real-time reactive apps, and rapid AI-assisted vibe coding.",
    duration: "12 Months",
    level: "DIPLOMA",
    eligibility: "12th Standard / Graduate",
    fee: 85000,
    mode: "HYBRID",
    coordinator: "Aadithyan M Menon",
    status: "ACTIVE",
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    learningObjectives: [
      "TypeScript, React, Next.js, and modern full-stack web engineering",
      "Cloud architecture, PostgreSQL, and scalable API services",
      "Vibe coding with modern generative AI coding tools"
    ],
    careerOutcomes: ["Full-Stack Software Engineer", "Frontend Architect", "Tech Lead"]
  },
  {
    id: "c-3",
    code: "SMA-DJMS",
    name: "Advanced Diploma in Digital Journalism & Media Science",
    description: "Comprehensive training in multi-platform news reporting, investigative journalism, digital ethics, podcast production, and high-velocity digital broadcasting.",
    duration: "6 Months",
    level: "DIPLOMA",
    eligibility: "Any Degree or 12th Standard",
    fee: 55000,
    mode: "PHYSICAL",
    coordinator: "Dr. Lakshmi Warrier",
    status: "ACTIVE",
    thumbnailUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80",
    learningObjectives: [
      "Digital investigative reporting & source verification",
      "Broadcast anchoring, podcasting, and media law",
      "Social media distribution and audience analytics"
    ],
    careerOutcomes: ["Digital Journalist", "News Anchor", "Editorial Producer"]
  },
  {
    id: "c-4",
    code: "SMA-VFX",
    name: "Professional Certificate in Video Editing & Motion VFX",
    description: "Hands-on studio masterclass focused on Adobe Premiere Pro, After Effects, DaVinci Resolve, motion typography, and sound design for television and streaming platforms.",
    duration: "3 Months",
    level: "ADVANCED",
    eligibility: "10th Standard or Above",
    fee: 35000,
    mode: "PHYSICAL",
    coordinator: "Rahul R",
    status: "ACTIVE",
    thumbnailUrl: "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=800&q=80",
    learningObjectives: [
      "Non-linear multi-camera editing and speed cutting",
      "Motion graphics, VFX compositing, and green screen keys",
      "Studio color grading and spatial audio mastering"
    ],
    careerOutcomes: ["Motion Graphics Artist", "Video Editor", "Post-Production Lead"]
  }
];

interface PersistentCoursesStore {
  courses: any[];
  updatedAt: string;
}

function readCoursesStore(): PersistentCoursesStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(COURSES_FILE)) {
      const raw = fs.readFileSync(COURSES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.courses) && parsed.courses.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading persistent courses file:', e);
  }
  return {
    courses: [...DEFAULT_SEED_COURSES],
    updatedAt: new Date().toISOString()
  };
}

function writeCoursesStore(store: PersistentCoursesStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COURSES_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent courses file:', e);
  }
}

// 4. Fetch all courses (persisted across restarts, devices, and synchronized with Firestore)
app.get('/api/courses', async (req, res) => {
  try {
    const store = readCoursesStore();

    if (db) {
      try {
        const snap = await db.collection('courses').get();
        if (!snap.empty) {
          snap.docs.forEach((doc: any) => {
            const data = { id: doc.id, ...doc.data() };
            const idx = store.courses.findIndex((c: any) => c.id === data.id || (data.code && c.code === data.code));
            if (idx >= 0) {
              store.courses[idx] = { ...store.courses[idx], ...data };
            } else {
              store.courses.push(data);
            }
          });
        } else {
          // Initial seed of Firestore courses collection if empty
          for (const c of store.courses) {
            await db.collection('courses').doc(c.id).set(c, { merge: true });
          }
        }
      } catch (cloudErr: any) {
        console.warn('Firestore courses fetch notice:', cloudErr.message);
      }
    }

    writeCoursesStore(store);
    return res.json({
      success: true,
      courses: store.courses,
      count: store.courses.length,
      updatedAt: store.updatedAt
    });
  } catch (err: any) {
    console.error('Error in GET /api/courses:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Create or update course (Admin Panel -> Database -> Instant Front-End reflection)
app.post('/api/courses', async (req, res) => {
  try {
    const course = req.body;
    if (!course || (!course.name && !course.title)) {
      return res.status(400).json({ success: false, error: 'Course name is required.' });
    }

    const courseId = course.id || `c-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const sanitizedCourse = {
      ...course,
      id: courseId,
      code: (course.code || 'SMA-NEW').trim().toUpperCase(),
      name: (course.name || course.title || 'New Academy Program').trim(),
      title: (course.title || course.name || 'New Academy Program').trim(),
      description: course.description || '',
      duration: course.duration || '6 Months',
      level: course.level || 'DIPLOMA',
      eligibility: course.eligibility || '12th Standard or Equivalent',
      fee: Number(course.fee ?? course.fees ?? 0),
      fees: Number(course.fee ?? course.fees ?? 0),
      mode: course.mode || 'PHYSICAL',
      coordinator: course.coordinator || 'Academic Director',
      status: course.status || 'ACTIVE',
      thumbnailUrl: course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
      learningObjectives: Array.isArray(course.learningObjectives) ? course.learningObjectives : [
        'Master core concepts and tools',
        'Build production-ready portfolios'
      ],
      careerOutcomes: Array.isArray(course.careerOutcomes) ? course.careerOutcomes : [
        'Industry Professional',
        'Certified Media Specialist'
      ],
      updatedAt: nowIso,
      createdAt: course.createdAt || nowIso
    };

    const store = readCoursesStore();
    const existingIndex = store.courses.findIndex((c: any) => c.id === courseId || (sanitizedCourse.code && c.code === sanitizedCourse.code));
    if (existingIndex >= 0) {
      store.courses[existingIndex] = { ...store.courses[existingIndex], ...sanitizedCourse };
    } else {
      store.courses.push(sanitizedCourse);
    }
    store.updatedAt = nowIso;
    writeCoursesStore(store);

    // Save to Firestore via Firebase Admin SDK
    if (db) {
      try {
        await db.collection('courses').doc(courseId).set(sanitizedCourse, { merge: true });
      } catch (cloudErr: any) {
        console.warn('Firestore Admin course write notice:', cloudErr.message);
      }
    }

    console.log(`[Courses] Course saved to database: "${sanitizedCourse.name}" (${sanitizedCourse.code})`);
    return res.json({ success: true, course: sanitizedCourse });
  } catch (err: any) {
    console.error('Error in POST /api/courses:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete a course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store = readCoursesStore();
    store.courses = store.courses.filter((c: any) => c.id !== id);
    store.updatedAt = new Date().toISOString();
    writeCoursesStore(store);

    if (db) {
      try {
        await db.collection('courses').doc(id).delete();
      } catch (cloudErr: any) {
        console.warn('Firestore Admin course delete notice:', cloudErr.message);
      }
    }

    return res.json({ success: true, message: `Course ${id} deleted` });
  } catch (err: any) {
    console.error('Error in DELETE /api/courses:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- SWANAYA FEE COLLECTION: GPAY / UPI & RAZORPAY GATEWAY API ---
const PAYMENTS_FILE = path.resolve(DATA_DIR, 'persistent_fee_payments.json');

interface PersistentPaymentsStore {
  transactions: any[];
  auditLogs: any[];
  updatedAt: string;
}

function readPaymentsStore(): PersistentPaymentsStore {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8'));
      return {
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        auditLogs: Array.isArray(parsed?.auditLogs) ? parsed.auditLogs : [],
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[Payments] Unable to read persistent payments store:', err);
  }
  return { transactions: [], auditLogs: [], updatedAt: new Date().toISOString() };
}

function writePaymentsStore(store: PersistentPaymentsStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Payments] Unable to write persistent payments store:', err);
  }
}

async function appendPaymentAudit(entry: {
  action: string;
  actorEmail: string;
  actorName: string;
  entity: string;
  details?: Record<string, any>;
}) {
  const store = readPaymentsStore();
  const auditRecord = {
    id: `pay-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.auditLogs = [auditRecord, ...store.auditLogs].slice(0, 500);
  store.updatedAt = new Date().toISOString();
  writePaymentsStore(store);

  if (db) {
    try {
      await db.collection('audit_ledger').add({
        event: entry.action,
        timestamp: FieldValue.serverTimestamp(),
        actorId: entry.actorEmail,
        details: {
          actorName: entry.actorName,
          entity: entry.entity,
          ...(entry.details || {}),
        },
      });
    } catch {
      // Non-blocking audit mirror
    }
  }
}

// 1. Check Razorpay gateway availability
app.get('/api/payments/gateway-status', (_req, res) => {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const configured = Boolean(keyId && keySecret);
  return res.json({
    razorpayConfigured: configured,
    keyId: configured ? keyId : null,
    supportedMethods: configured
      ? ['RAZORPAY_UPI', 'GPAY_UPI', 'UPI_QR', 'UPI_INTENT']
      : ['GPAY_UPI', 'UPI_QR', 'UPI_INTENT'],
  });
});

// 2. List all fee transactions (synced across browsers)
app.get('/api/payments/transactions', (_req, res) => {
  const store = readPaymentsStore();
  return res.json({
    success: true,
    transactions: store.transactions,
    auditLogs: store.auditLogs,
    updatedAt: store.updatedAt,
  });
});

// 3. Create / upsert a payment request (NEVER marks VERIFIED automatically)
app.post('/api/payments/request', async (req, res) => {
  try {
    const tx = req.body?.transaction;
    if (!tx || !tx.id || !tx.invoiceNumber || !tx.studentId || !(Number(tx.amount) > 0)) {
      return res.status(400).json({ success: false, error: 'Invalid payment request payload.' });
    }

    const store = readPaymentsStore();
    const existingByInvoice = store.transactions.find(
      (item: any) => item.invoiceNumber === tx.invoiceNumber && item.id !== tx.id
    );
    if (existingByInvoice) {
      return res.status(409).json({
        success: false,
        error: `Duplicate invoice number detected (${tx.invoiceNumber}). Please generate a fresh invoice request.`,
      });
    }

    const sanitized = {
      ...tx,
      status: 'AWAITING_PAYMENT', // Enforce server-side: new requests cannot self-verify
      receiptNumber: undefined,
      verifiedBy: undefined,
      verifiedAt: undefined,
      gatewaySignatureVerified: false,
      updatedAt: new Date().toISOString(),
    };

    const idx = store.transactions.findIndex((item: any) => item.id === sanitized.id);
    if (idx >= 0) {
      if (store.transactions[idx].status === 'VERIFIED') {
        return res.status(409).json({ success: false, error: 'Payment transaction is already verified.' });
      }
      store.transactions[idx] = sanitized;
    } else {
      store.transactions = [sanitized, ...store.transactions];
    }
    store.updatedAt = new Date().toISOString();
    writePaymentsStore(store);

    await appendPaymentAudit({
      action: 'PAYMENT_REQUEST_CREATED',
      actorEmail: tx.studentEmail || tx.studentId,
      actorName: tx.studentName || 'Student',
      entity: `Invoice ${tx.invoiceNumber} · ₹${Number(tx.amount).toLocaleString('en-IN')}`,
      details: { invoiceNumber: tx.invoiceNumber, amount: Number(tx.amount), upiIdPaidTo: tx.upiIdPaidTo },
    });

    return res.json({ success: true, transaction: sanitized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Unable to create payment request.' });
  }
});

// 4. Submit UTR reference for manual GPay / UPI verification (NEVER marks VERIFIED; enforces unique UTR)
app.post('/api/payments/utr-submit', async (req, res) => {
  try {
    const { transactionId, utrNumber, upiAppName, proofNote, transactionFallback } = req.body || {};
    const cleanUtr = String(utrNumber || '').trim().toUpperCase();

    if (!cleanUtr || !/^[A-Z0-9]{10,26}$/.test(cleanUtr)) {
      return res.status(400).json({
        success: false,
        error: 'Enter a valid 10-26 character alphanumeric UPI Reference / UTR number (e.g. 12-digit UTR).',
      });
    }

    const store = readPaymentsStore();
    const duplicateUtr = store.transactions.find(
      (t: any) =>
        t.id !== transactionId &&
        t.status !== 'REJECTED' &&
        String(t.utrNumber || '').trim().toUpperCase() === cleanUtr
    );
    if (duplicateUtr) {
      return res.status(409).json({
        success: false,
        error: `Duplicate transaction blocked: UTR ${cleanUtr} has already been submitted for Invoice ${duplicateUtr.invoiceNumber}.`,
      });
    }

    let idx = store.transactions.findIndex((t: any) => t.id === transactionId);
    if (idx < 0 && transactionFallback?.id) {
      store.transactions = [{ ...transactionFallback, status: 'AWAITING_PAYMENT' }, ...store.transactions];
      idx = 0;
    }
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Payment request record not found.' });
    }

    const current = store.transactions[idx];
    if (current.status === 'VERIFIED') {
      return res.status(409).json({ success: false, error: 'This payment is already verified and locked.' });
    }

    const updated = {
      ...current,
      utrNumber: cleanUtr,
      upiAppName: String(upiAppName || current.upiAppName || 'Google Pay (GPay)').trim(),
      proofNote: String(proofNote || '').trim().slice(0, 300),
      status: 'PENDING_VERIFICATION',
      rejectionReason: undefined,
      updatedAt: new Date().toISOString(),
    };

    store.transactions[idx] = updated;
    store.updatedAt = new Date().toISOString();
    writePaymentsStore(store);

    await appendPaymentAudit({
      action: 'UPI_UTR_SUBMITTED',
      actorEmail: updated.studentEmail || updated.studentId,
      actorName: updated.studentName || 'Student',
      entity: `UTR ${cleanUtr} submitted for ${updated.invoiceNumber} (₹${updated.amount})`,
      details: { transactionId: updated.id, invoiceNumber: updated.invoiceNumber, utrNumber: cleanUtr },
    });

    return res.json({ success: true, transaction: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Unable to submit UTR.' });
  }
});

// 5. Admin Verification / Rejection endpoint
app.post('/api/payments/admin-review', async (req, res) => {
  try {
    const { transactionId, decision, adminName, adminEmail, adminId, rejectionReason, transactionFallback } = req.body || {};
    if (!['VERIFY', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Invalid verification decision.' });
    }

    const store = readPaymentsStore();
    let idx = store.transactions.findIndex((t: any) => t.id === transactionId);
    if (idx < 0 && transactionFallback?.id) {
      store.transactions = [transactionFallback, ...store.transactions];
      idx = 0;
    }
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Payment transaction not found.' });
    }

    const current = store.transactions[idx];
    if (current.status === 'VERIFIED') {
      return res.status(409).json({ success: false, error: 'Duplicate verification prevented: transaction already verified.' });
    }

    const nowIso = new Date().toISOString();

    if (decision === 'VERIFY') {
      const cleanUtr = String(current.utrNumber || '').trim().toUpperCase();
      if (cleanUtr) {
        const dup = store.transactions.find(
          (t: any) =>
            t.id !== current.id &&
            t.status === 'VERIFIED' &&
            String(t.utrNumber || '').trim().toUpperCase() === cleanUtr
        );
        if (dup) {
          return res.status(409).json({
            success: false,
            error: `UTR ${cleanUtr} is already verified against Invoice ${dup.invoiceNumber}.`,
          });
        }
      }

      const receiptNumber =
        current.receiptNumber || `REC-SMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const updated = {
        ...current,
        status: 'VERIFIED',
        receiptNumber,
        verifiedBy: adminName || 'Academy Finance Admin',
        verifiedById: adminId || 'admin',
        verifiedAt: nowIso,
        rejectionReason: undefined,
        updatedAt: nowIso,
      };
      store.transactions[idx] = updated;
      store.updatedAt = nowIso;
      writePaymentsStore(store);

      await appendPaymentAudit({
        action: 'PAYMENT_VERIFIED_APPROVED',
        actorEmail: adminEmail || 'admin@swanayamedia.com',
        actorName: adminName || 'Admin',
        entity: `Verified ${updated.invoiceNumber} · UTR ${cleanUtr || 'N/A'} · Receipt ${receiptNumber}`,
        details: { transactionId: updated.id, amount: updated.amount, receiptNumber, utrNumber: cleanUtr },
      });

      return res.json({ success: true, transaction: updated });
    } else {
      const reason = String(rejectionReason || 'UTR could not be matched with Academy bank statement.').trim();
      const updated = {
        ...current,
        status: 'REJECTED',
        rejectionReason: reason,
        verifiedBy: adminName || 'Academy Finance Admin',
        verifiedById: adminId || 'admin',
        verifiedAt: nowIso,
        updatedAt: nowIso,
      };
      store.transactions[idx] = updated;
      store.updatedAt = nowIso;
      writePaymentsStore(store);

      await appendPaymentAudit({
        action: 'PAYMENT_REJECTED',
        actorEmail: adminEmail || 'admin@swanayamedia.com',
        actorName: adminName || 'Admin',
        entity: `Rejected ${updated.invoiceNumber} · Reason: ${reason}`,
        details: { transactionId: updated.id, reason },
      });

      return res.json({ success: true, transaction: updated });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Admin review failed.' });
  }
});

// 6. Razorpay Order Creation (only active when RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET are configured)
app.post('/api/payments/razorpay/create-order', async (req, res) => {
  try {
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay gateway keys are not configured. Please pay via Verified Google Pay / UPI QR and submit your UTR for Admin Verification.',
      });
    }

    const { amountInr, invoiceNumber, studentId, courseId } = req.body || {};
    const amountPaise = Math.round(Number(amountInr) * 100);
    if (!(amountPaise >= 100)) {
      return res.status(400).json({ success: false, error: 'Minimum payable amount is ₹1.00.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: String(invoiceNumber || `INV-${Date.now()}`).slice(0, 40),
        notes: {
          studentId: String(studentId || ''),
          courseId: String(courseId || ''),
          academy: 'Swanaya Media Academy',
        },
      }),
    });

    const data = await rzpRes.json().catch(() => ({}));
    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({
        success: false,
        error: data?.error?.description || 'Failed to create Razorpay order.',
      });
    }

    return res.json({ success: true, order: data, keyId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Razorpay order error.' });
  }
});

// 7. Razorpay Cryptographic Signature Verification (Automatic UPI Confirmation)
app.post('/api/payments/razorpay/verify', async (req, res) => {
  try {
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(503).json({ success: false, error: 'Razorpay secret is not configured.' });
    }

    const { transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionFallback } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing Razorpay payment signature fields.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Cryptographic payment signature verification failed.' });
    }

    const store = readPaymentsStore();
    let idx = store.transactions.findIndex((t: any) => t.id === transactionId);
    if (idx < 0 && transactionFallback?.id) {
      store.transactions = [transactionFallback, ...store.transactions];
      idx = 0;
    }

    const receiptNumber = `REC-RZP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    if (idx >= 0) {
      const current = store.transactions[idx];
      const updated = {
        ...current,
        paymentMethod: 'RAZORPAY_UPI',
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignatureVerified: true,
        utrNumber: razorpay_payment_id,
        status: 'VERIFIED',
        receiptNumber,
        verifiedBy: 'Razorpay Gateway (HMAC Verified)',
        verifiedAt: nowIso,
        updatedAt: nowIso,
      };
      store.transactions[idx] = updated;
      store.updatedAt = nowIso;
      writePaymentsStore(store);

      await appendPaymentAudit({
        action: 'RAZORPAY_UPI_VERIFIED',
        actorEmail: updated.studentEmail || updated.studentId,
        actorName: updated.studentName || 'Student',
        entity: `Razorpay Verified ${updated.invoiceNumber} · ${razorpay_payment_id} · ${receiptNumber}`,
        details: { transactionId: updated.id, razorpay_order_id, razorpay_payment_id, receiptNumber },
      });

      return res.json({ success: true, verified: true, transaction: updated });
    }

    return res.json({ success: true, verified: true, receiptNumber });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Razorpay verification failed.' });
  }
});

// ============================================================================
// SWANAYA MEDIA ACADEMY — GLOBAL THEME & COLOUR MANAGEMENT ENGINE
// ============================================================================
const THEME_SETTINGS_FILE = path.resolve(DATA_DIR, 'persistent_theme_settings.json');
const ADMIN_ONLY_ROLES = ['MD', 'SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'ACADEMIC_ADMIN'];

const DEFAULT_THEME_PALETTE_SERVER = {
  primary: '#6941C6',
  secondary: '#243B70',
  accent: '#269B78',
  background: '#F7F7FA',
  surface: '#FFFFFF',
  textPrimary: '#20243A',
  textSecondary: '#74798A',
  border: '#E5E5ED',
  darkBackground: '#151525',
  darkSurface: '#202038',
  darkTextPrimary: '#F5F4FA',
  darkTextSecondary: '#B3B6CA',
  darkBorder: '#333452',
};

const DEFAULT_THEME_CONFIG_SERVER = {
  id: 'theme_config',
  defaultMode: 'light',
  allowUserModeToggle: true,
  palette: { ...DEFAULT_THEME_PALETTE_SERVER },
  sectionOverrides: {
    landing: { enabled: false },
    login: { enabled: false },
    student: { enabled: false },
    tutor: { enabled: false },
  },
  updatedAt: '2026-10-01T00:00:00.000Z',
  updatedBy: 'System Default',
};

function normalizeHexServer(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9A-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

function sanitizePaletteServer(partial: any, base = DEFAULT_THEME_PALETTE_SERVER) {
  const src = partial && typeof partial === 'object' ? partial : {};
  return {
    primary: normalizeHexServer(src.primary, base.primary),
    secondary: normalizeHexServer(src.secondary, base.secondary),
    accent: normalizeHexServer(src.accent, base.accent),
    background: normalizeHexServer(src.background, base.background),
    surface: normalizeHexServer(src.surface, base.surface),
    textPrimary: normalizeHexServer(src.textPrimary, base.textPrimary),
    textSecondary: normalizeHexServer(src.textSecondary, base.textSecondary),
    border: normalizeHexServer(src.border, base.border),
    darkBackground: normalizeHexServer(src.darkBackground, base.darkBackground),
    darkSurface: normalizeHexServer(src.darkSurface, base.darkSurface),
    darkTextPrimary: normalizeHexServer(src.darkTextPrimary, base.darkTextPrimary),
    darkTextSecondary: normalizeHexServer(src.darkTextSecondary, base.darkTextSecondary),
    darkBorder: normalizeHexServer(src.darkBorder, base.darkBorder),
  };
}

function sanitizeThemeConfigServer(partial: any) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const defaultMode = src.defaultMode === 'dark' || src.mode === 'dark' ? 'dark' : 'light';
  const allowUserModeToggle = typeof src.allowUserModeToggle === 'boolean' ? src.allowUserModeToggle : true;
  const basePalette = sanitizePaletteServer(src.palette, DEFAULT_THEME_PALETTE_SERVER);
  const rawOverrides = src.sectionOverrides && typeof src.sectionOverrides === 'object' ? src.sectionOverrides : {};
  const sectionOverrides: Record<string, any> = {};
  for (const key of ['landing', 'login', 'student', 'tutor']) {
    const ov = rawOverrides[key] && typeof rawOverrides[key] === 'object' ? rawOverrides[key] : {};
    sectionOverrides[key] = {
      enabled: Boolean(ov.enabled),
      ...(ov.mode === 'light' || ov.mode === 'dark' ? { mode: ov.mode } : {}),
      ...(ov.primary ? { primary: normalizeHexServer(ov.primary, basePalette.primary) } : {}),
      ...(ov.secondary ? { secondary: normalizeHexServer(ov.secondary, basePalette.secondary) } : {}),
      ...(ov.accent ? { accent: normalizeHexServer(ov.accent, basePalette.accent) } : {}),
      ...(ov.background ? { background: normalizeHexServer(ov.background, basePalette.background) } : {}),
      ...(ov.surface ? { surface: normalizeHexServer(ov.surface, basePalette.surface) } : {}),
      ...(ov.textPrimary ? { textPrimary: normalizeHexServer(ov.textPrimary, basePalette.textPrimary) } : {}),
      ...(ov.textSecondary ? { textSecondary: normalizeHexServer(ov.textSecondary, basePalette.textSecondary) } : {}),
      ...(ov.darkBackground ? { darkBackground: normalizeHexServer(ov.darkBackground, basePalette.darkBackground) } : {}),
      ...(ov.darkSurface ? { darkSurface: normalizeHexServer(ov.darkSurface, basePalette.darkSurface) } : {}),
    };
  }
  return {
    id: 'theme_config',
    defaultMode,
    allowUserModeToggle,
    palette: basePalette,
    sectionOverrides,
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : new Date().toISOString(),
    updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : 'Administrator',
  };
}

function readThemeSettingsStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(THEME_SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(THEME_SETTINGS_FILE, 'utf8'));
      return sanitizeThemeConfigServer(parsed);
    }
  } catch (err) {
    console.warn('Error reading theme settings store:', err);
  }
  return { ...DEFAULT_THEME_CONFIG_SERVER };
}

function writeThemeSettingsStore(config: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(THEME_SETTINGS_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing theme settings store:', err);
  }
}

app.get('/api/theme-settings', async (req, res) => {
  try {
    let config = readThemeSettingsStore();
    if (db) {
      try {
        const snap = await db.collection('site_settings').doc('theme_config').get();
        if (snap.exists) {
          config = sanitizeThemeConfigServer({ id: 'theme_config', ...snap.data() });
          writeThemeSettingsStore(config);
        }
      } catch (cloudErr: any) {
        console.warn('Firestore theme fetch fallback note:', cloudErr?.message);
      }
    }
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to load theme settings.' });
  }
});

app.put('/api/theme-settings', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      error: 'Administrator privileges required to modify academy colour and theme settings.',
    });
  }

  try {
    const incoming = req.body?.config || req.body || {};
    const nowIso = new Date().toISOString();
    const sanitized = sanitizeThemeConfigServer({
      ...incoming,
      id: 'theme_config',
      updatedAt: nowIso,
      updatedBy: req.authSession?.email || 'Administrator',
    });

    writeThemeSettingsStore(sanitized);

    if (db) {
      try {
        await db.collection('site_settings').doc('theme_config').set(sanitized, { merge: true });
      } catch (cloudErr: any) {
        console.warn('Firestore theme save fallback note:', cloudErr?.message);
      }
    }

    recordAuthAudit({
      event: 'THEME_SETTINGS_UPDATED',
      userId: req.authSession?.userId,
      email: req.authSession?.email,
      role,
      ip: getClientIp(req),
      outcome: 'SUCCESS',
      message: `Global theme updated (Primary: ${sanitized.palette.primary}, Secondary: ${sanitized.palette.secondary}, Accent: ${sanitized.palette.accent}).`,
    });

    return res.json({ success: true, config: sanitized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save theme settings.' });
  }
});

app.post('/api/theme-settings/reset', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      error: 'Administrator privileges required to reset academy theme settings.',
    });
  }

  try {
    const nowIso = new Date().toISOString();
    const resetConfig = sanitizeThemeConfigServer({
      ...DEFAULT_THEME_CONFIG_SERVER,
      updatedAt: nowIso,
      updatedBy: req.authSession?.email || 'Administrator',
    });

    writeThemeSettingsStore(resetConfig);

    if (db) {
      try {
        await db.collection('site_settings').doc('theme_config').set(resetConfig, { merge: false });
      } catch (cloudErr: any) {
        console.warn('Firestore theme reset fallback note:', cloudErr?.message);
      }
    }

    recordAuthAudit({
      event: 'THEME_SETTINGS_RESET',
      userId: req.authSession?.userId,
      email: req.authSession?.email,
      role,
      ip: getClientIp(req),
      outcome: 'SUCCESS',
      message: 'Global theme settings reset to Swanaya Media Academy canonical defaults.',
    });

    return res.json({ success: true, config: resetConfig });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reset theme settings.' });
  }
});

// ============================================================================
// SWANAYA MEDIA ACADEMY — MAJOR & MINOR COURSE MANAGEMENT ENGINE
// ============================================================================
const COURSE_MGMT_FILE = path.resolve(DATA_DIR, 'persistent_course_management.json');

interface CourseMgmtStore {
  categories: any[];
  modules: any[];
  credits: any[];
  tutorAllocations: any[];
  selections: any[];
  enrollments: any[];
  approvalLogs: any[];
  progressReports: any[];
  policy: {
    id: string;
    maxMinorSelections: number;
    minMinorSelections: number;
    maxTotalCredits: number;
    selectionLocked: boolean;
    selectionDeadline?: string;
    requireAdminApproval: boolean;
    updatedAt: string;
    updatedBy?: string;
  };
  updatedAt: string;
}

const DEFAULT_COURSE_CATEGORIES = [
  { id: 'cat-media', name: 'AI Media & Creative Direction', slug: 'ai-media', description: 'Generative media production, creative direction, and commercial studio craft.' },
  { id: 'cat-tech', name: 'Full-Stack Web & Vibe Coding', slug: 'full-stack-web', description: 'Software engineering, cloud APIs, React/TypeScript, and AI-assisted systems.' },
  { id: 'cat-journalism', name: 'Digital Journalism & Media Science', slug: 'digital-journalism', description: 'Broadcast storytelling, investigative media ethics, and multi-platform anchoring.' },
  { id: 'cat-post', name: 'Motion VFX & Post-Production', slug: 'motion-vfx', description: 'Editing, colour grading, compositing, and sound design studio electives.' },
];

function buildDefaultCourseModules(courses: any[]) {
  const mods: any[] = [];
  for (const c of courses) {
    const cid = c.id;
    const topics: string[] = Array.isArray(c.learningObjectives) && c.learningObjectives.length > 0
      ? c.learningObjectives
      : ['Foundations & Core Principles', 'Studio Workshop & Applied Practice', 'Capstone Assessment'];
    topics.forEach((topic, idx) => {
      mods.push({
        id: `mod-${cid}-${idx + 1}`,
        courseId: cid,
        title: `Module ${idx + 1}: ${topic}`,
        description: `Structured curriculum unit covering ${topic.toLowerCase()}.`,
        order: idx + 1,
        durationHours: 18 + idx * 6,
        assessmentType: idx === topics.length - 1 ? 'CAPSTONE' : 'EXAM',
        isRequired: true,
      });
    });
  }
  return mods;
}

function enrichCourseRecord(c: any) {
  const inferredMinor =
    c.courseType === 'minor' ||
    String(c.level || '').toUpperCase() === 'CERTIFICATE' ||
    String(c.code || '').includes('VFX');
  const courseType = c.courseType === 'major' || c.courseType === 'minor' ? c.courseType : inferredMinor ? 'minor' : 'major';
  const defaultCredits = courseType === 'major' ? 12 : 4;
  return {
    ...c,
    title: c.title || c.name,
    name: c.name || c.title,
    courseType,
    categoryId: c.categoryId || (courseType === 'minor' ? 'cat-post' : 'cat-media'),
    category: c.category || (courseType === 'minor' ? 'Motion VFX & Post-Production' : 'Academy Core Specialization'),
    credits: Number(c.credits ?? defaultCredits),
    prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
    maxSeats: Number(c.maxSeats ?? 40),
    enrolledCount: Number(c.enrolledCount ?? 0),
    assignedTutorIds: Array.isArray(c.assignedTutorIds) ? c.assignedTutorIds : [],
    examRequirements: c.examRequirements || (courseType === 'major'
      ? 'Minimum 75% attendance, continuous module assessments, and final studio capstone defence.'
      : 'Applied lab evaluation and end-term elective examination.'),
  };
}

function readCourseMgmtStore(): CourseMgmtStore {
  const coursesStore = readCoursesStore();
  const enrichedCourses = coursesStore.courses.map(enrichCourseRecord);
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(COURSE_MGMT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(COURSE_MGMT_FILE, 'utf8'));
      return {
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_COURSE_CATEGORIES],
        modules: Array.isArray(parsed.modules) && parsed.modules.length > 0 ? parsed.modules : buildDefaultCourseModules(enrichedCourses),
        credits: Array.isArray(parsed.credits) ? parsed.credits : enrichedCourses.map((c: any) => ({
          id: `cred-${c.id}`,
          courseId: c.id,
          theoryCredits: Math.max(1, Math.floor((c.credits || 4) / 2)),
          practicalCredits: Math.max(1, Math.ceil((c.credits || 4) / 2)),
          totalCredits: c.credits || 4,
          minimumPassingPercentage: 50,
        })),
        tutorAllocations: Array.isArray(parsed.tutorAllocations) ? parsed.tutorAllocations : [],
        selections: Array.isArray(parsed.selections) ? parsed.selections : [],
        enrollments: Array.isArray(parsed.enrollments) ? parsed.enrollments : [],
        approvalLogs: Array.isArray(parsed.approvalLogs) ? parsed.approvalLogs : [],
        progressReports: Array.isArray(parsed.progressReports) ? parsed.progressReports : [],
        policy: {
          id: 'default',
          maxMinorSelections: Number(parsed.policy?.maxMinorSelections ?? 2),
          minMinorSelections: Number(parsed.policy?.minMinorSelections ?? 1),
          maxTotalCredits: Number(parsed.policy?.maxTotalCredits ?? 24),
          selectionLocked: Boolean(parsed.policy?.selectionLocked ?? false),
          selectionDeadline: parsed.policy?.selectionDeadline || '2026-12-31',
          requireAdminApproval: parsed.policy?.requireAdminApproval !== false,
          updatedAt: parsed.policy?.updatedAt || new Date().toISOString(),
          updatedBy: parsed.policy?.updatedBy || 'Academic Director',
        },
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Error reading course management store:', err);
  }
  return {
    categories: [...DEFAULT_COURSE_CATEGORIES],
    modules: buildDefaultCourseModules(enrichedCourses),
    credits: enrichedCourses.map((c: any) => ({
      id: `cred-${c.id}`,
      courseId: c.id,
      theoryCredits: Math.max(1, Math.floor((c.credits || 4) / 2)),
      practicalCredits: Math.max(1, Math.ceil((c.credits || 4) / 2)),
      totalCredits: c.credits || 4,
      minimumPassingPercentage: 50,
    })),
    tutorAllocations: [],
    selections: [],
    enrollments: [],
    approvalLogs: [],
    progressReports: [],
    policy: {
      id: 'default',
      maxMinorSelections: 2,
      minMinorSelections: 1,
      maxTotalCredits: 24,
      selectionLocked: false,
      selectionDeadline: '2026-12-31',
      requireAdminApproval: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Academic Director',
    },
    updatedAt: new Date().toISOString(),
  };
}

function writeCourseMgmtStore(store: CourseMgmtStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(COURSE_MGMT_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing course management store:', err);
  }
}

function sanitizeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

// 1. Overview feed (courses, categories, modules, policy, allocations, selections, enrollments, logs, reports)
app.get('/api/course-management/overview', async (req, res) => {
  try {
    const coursesStore = readCoursesStore();
    const mgmt = readCourseMgmtStore();
    const profiles = readPersistentStore();

    // Ensure non-destructive seat counts reflect approved/active enrollments
    const activeEnrollCounts: Record<string, number> = {};
    for (const enr of mgmt.enrollments) {
      if (enr.status === 'ACTIVE' || enr.status === 'COMPLETED') {
        activeEnrollCounts[enr.courseId] = (activeEnrollCounts[enr.courseId] || 0) + 1;
      }
    }

    const courses = coursesStore.courses.map((raw: any) => {
      const enriched = enrichCourseRecord(raw);
      const allocatedTutors = mgmt.tutorAllocations
        .filter((a: any) => a.courseId === enriched.id)
        .map((a: any) => a.tutorId);
      const mergedTutorIds = Array.from(new Set([...(enriched.assignedTutorIds || []), ...allocatedTutors]));
      return {
        ...enriched,
        enrolledCount: activeEnrollCounts[enriched.id] ?? enriched.enrolledCount ?? 0,
        assignedTutorIds: mergedTutorIds,
      };
    });

    const tutors = profiles.instructors.map((inst: any) => ({
      id: inst.id,
      userId: inst.userId,
      name: inst.name,
      email: inst.email,
      qualification: inst.qualification,
      specialization: inst.specialization,
      status: inst.status,
      avatarUrl: inst.avatarUrl,
    }));

    return res.json({
      success: true,
      courses,
      categories: mgmt.categories,
      modules: mgmt.modules,
      credits: mgmt.credits,
      tutorAllocations: mgmt.tutorAllocations,
      selections: mgmt.selections,
      enrollments: mgmt.enrollments,
      approvalLogs: mgmt.approvalLogs,
      progressReports: mgmt.progressReports,
      policy: mgmt.policy,
      tutors,
      students: profiles.students,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to load course management data.' });
  }
});

// 2. Admin: Create Major or Minor Course
app.post('/api/course-management/courses', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const body = req.body || {};
    const name = String(body.name || body.title || '').trim();
    const code = String(body.code || '').trim().toUpperCase();
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Course name and course code are required.' });
    }

    const courseType = body.courseType === 'minor' ? 'minor' : 'major';
    const nowIso = new Date().toISOString();
    const coursesStore = readCoursesStore();
    const mgmt = readCourseMgmtStore();

    const duplicateCode = coursesStore.courses.some(
      (c: any) => c.id !== body.id && String(c.code || '').trim().toUpperCase() === code
    );
    if (duplicateCode) {
      return res.status(409).json({ success: false, error: `Course code "${code}" already exists.` });
    }

    const courseId = body.id || `c-${Date.now()}`;
    const creditsNum = Math.max(1, Math.min(40, Number(body.credits ?? (courseType === 'major' ? 12 : 4))));
    const categoryObj = mgmt.categories.find((cat: any) => cat.id === body.categoryId);

    const newCourse = enrichCourseRecord({
      id: courseId,
      code,
      name,
      title: name,
      courseType,
      categoryId: body.categoryId || mgmt.categories[0]?.id || 'cat-media',
      category: categoryObj?.name || body.category || 'Academic Program',
      description: String(body.description || '').trim(),
      duration: String(body.duration || (courseType === 'major' ? '12 Months' : '4 Months')).trim(),
      level: body.level || (courseType === 'major' ? 'DIPLOMA' : 'CERTIFICATE'),
      eligibility: String(body.eligibility || '12th Standard or Equivalent').trim(),
      fee: Number(body.fee ?? 0),
      fees: Number(body.fee ?? 0),
      credits: creditsNum,
      maxSeats: Math.max(1, Number(body.maxSeats ?? 40)),
      prerequisites: Array.isArray(body.prerequisites) ? body.prerequisites : [],
      mode: body.mode || 'HYBRID',
      coordinator: String(body.coordinator || req.authSession?.email || 'Academic Director').trim(),
      status: body.status || 'ACTIVE',
      isPublished: body.status !== 'ARCHIVED',
      thumbnailUrl: body.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
      learningObjectives: Array.isArray(body.learningObjectives) ? body.learningObjectives : [],
      careerOutcomes: Array.isArray(body.careerOutcomes) ? body.careerOutcomes : [],
      examRequirements: String(body.examRequirements || '').trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const existingIdx = coursesStore.courses.findIndex((c: any) => c.id === courseId);
    if (existingIdx >= 0) {
      coursesStore.courses[existingIdx] = { ...coursesStore.courses[existingIdx], ...newCourse };
    } else {
      coursesStore.courses.unshift(newCourse);
    }
    coursesStore.updatedAt = nowIso;
    writeCoursesStore(coursesStore);

    if (Array.isArray(body.syllabusModules) && body.syllabusModules.length > 0) {
      mgmt.modules = [
        ...mgmt.modules.filter((m: any) => m.courseId !== courseId),
        ...body.syllabusModules.map((m: any, idx: number) => ({
          id: m.id || `mod-${courseId}-${idx + 1}`,
          courseId,
          title: String(m.title || `Module ${idx + 1}`).trim(),
          description: String(m.description || '').trim(),
          order: Number(m.order ?? idx + 1),
          durationHours: Number(m.durationHours ?? 15),
          assessmentType: m.assessmentType || 'EXAM',
          isRequired: m.isRequired !== false,
        })),
      ];
    } else if (!mgmt.modules.some((m: any) => m.courseId === courseId)) {
      mgmt.modules.push(...buildDefaultCourseModules([newCourse]));
    }

    const credIdx = mgmt.credits.findIndex((cr: any) => cr.courseId === courseId);
    const creditSpec = {
      id: `cred-${courseId}`,
      courseId,
      theoryCredits: Math.max(1, Math.floor(creditsNum / 2)),
      practicalCredits: Math.max(1, Math.ceil(creditsNum / 2)),
      totalCredits: creditsNum,
      minimumPassingPercentage: 50,
    };
    if (credIdx >= 0) mgmt.credits[credIdx] = creditSpec;
    else mgmt.credits.push(creditSpec);

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    if (db) {
      try {
        await db.collection('courses').doc(courseId).set(newCourse, { merge: true });
      } catch {
        // local persistence retained
      }
    }

    return res.json({ success: true, course: newCourse });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save course.' });
  }
});

// 3. Admin: Edit / Archive Course
app.put('/api/course-management/courses/:id', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const courseId = req.params.id;
    const body = req.body || {};
    const coursesStore = readCoursesStore();
    const mgmt = readCourseMgmtStore();
    const idx = coursesStore.courses.findIndex((c: any) => c.id === courseId);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Course not found.' });
    }

    const existing = enrichCourseRecord(coursesStore.courses[idx]);
    const nowIso = new Date().toISOString();
    const categoryObj = mgmt.categories.find((cat: any) => cat.id === (body.categoryId || existing.categoryId));

    const updated = enrichCourseRecord({
      ...existing,
      ...body,
      id: courseId,
      title: body.name || body.title || existing.title,
      name: body.name || body.title || existing.name,
      code: (body.code || existing.code).trim().toUpperCase(),
      categoryId: body.categoryId || existing.categoryId,
      category: categoryObj?.name || body.category || existing.category,
      credits: Number(body.credits ?? existing.credits),
      maxSeats: Math.max(1, Number(body.maxSeats ?? existing.maxSeats ?? 40)),
      updatedAt: nowIso,
    });

    coursesStore.courses[idx] = updated;
    coursesStore.updatedAt = nowIso;
    writeCoursesStore(coursesStore);

    if (Array.isArray(body.syllabusModules)) {
      mgmt.modules = [
        ...mgmt.modules.filter((m: any) => m.courseId !== courseId),
        ...body.syllabusModules.map((m: any, mIdx: number) => ({
          id: m.id || `mod-${courseId}-${mIdx + 1}`,
          courseId,
          title: String(m.title || `Module ${mIdx + 1}`).trim(),
          description: String(m.description || '').trim(),
          order: Number(m.order ?? mIdx + 1),
          durationHours: Number(m.durationHours ?? 15),
          assessmentType: m.assessmentType || 'EXAM',
          isRequired: m.isRequired !== false,
        })),
      ];
    }
    const credIdx = mgmt.credits.findIndex((cr: any) => cr.courseId === courseId);
    const creditSpec = {
      id: `cred-${courseId}`,
      courseId,
      theoryCredits: Math.max(1, Math.floor((updated.credits || 4) / 2)),
      practicalCredits: Math.max(1, Math.ceil((updated.credits || 4) / 2)),
      totalCredits: updated.credits || 4,
      minimumPassingPercentage: 50,
    };
    if (credIdx >= 0) mgmt.credits[credIdx] = creditSpec;
    else mgmt.credits.push(creditSpec);

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    if (db) {
      try {
        await db.collection('courses').doc(courseId).set(updated, { merge: true });
      } catch {
        // fallback retained
      }
    }

    return res.json({ success: true, course: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update course.' });
  }
});

// 4. Admin: Create or update Category
app.post('/api/course-management/categories', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const { id, name, description } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }
    const mgmt = readCourseMgmtStore();
    const catId = id || `cat-${Date.now()}`;
    const catRecord = {
      id: catId,
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: String(description || '').trim(),
    };
    const idx = mgmt.categories.findIndex((c: any) => c.id === catId);
    if (idx >= 0) mgmt.categories[idx] = catRecord;
    else mgmt.categories.push(catRecord);

    mgmt.updatedAt = new Date().toISOString();
    writeCourseMgmtStore(mgmt);
    return res.json({ success: true, category: catRecord, categories: mgmt.categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save category.' });
  }
});

// 5. Admin: Configure Major/Minor Policy (Max minors, credit limits, deadlines, selection lock)
app.put('/api/course-management/policy', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const body = req.body || {};
    const mgmt = readCourseMgmtStore();
    const minMinor = Math.max(0, Math.min(5, Number(body.minMinorSelections ?? mgmt.policy.minMinorSelections)));
    const maxMinor = Math.max(minMinor, Math.min(6, Number(body.maxMinorSelections ?? mgmt.policy.maxMinorSelections)));
    const maxCredits = Math.max(4, Math.min(60, Number(body.maxTotalCredits ?? mgmt.policy.maxTotalCredits)));

    mgmt.policy = {
      id: 'default',
      minMinorSelections: minMinor,
      maxMinorSelections: maxMinor,
      maxTotalCredits: maxCredits,
      selectionLocked: Boolean(body.selectionLocked ?? mgmt.policy.selectionLocked),
      selectionDeadline: typeof body.selectionDeadline === 'string' ? body.selectionDeadline : mgmt.policy.selectionDeadline,
      requireAdminApproval: body.requireAdminApproval !== undefined ? Boolean(body.requireAdminApproval) : mgmt.policy.requireAdminApproval,
      updatedAt: new Date().toISOString(),
      updatedBy: req.authSession?.email || 'Administrator',
    };
    mgmt.updatedAt = mgmt.policy.updatedAt;
    writeCourseMgmtStore(mgmt);

    return res.json({ success: true, policy: mgmt.policy });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save policy.' });
  }
});

// 6. Admin: Allocate / Remove Tutor for Major or Minor Course
app.post('/api/course-management/tutor-allocations', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const { courseId, tutorId, allocationRole } = req.body || {};
    if (!courseId || !tutorId) {
      return res.status(400).json({ success: false, error: 'courseId and tutorId are required.' });
    }

    const coursesStore = readCoursesStore();
    const profiles = readPersistentStore();
    const mgmt = readCourseMgmtStore();

    const course = coursesStore.courses.find((c: any) => c.id === courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found.' });

    const tutor = profiles.instructors.find(
      (i: any) => i.id === tutorId || i.userId === tutorId || (i.email && i.email.toLowerCase() === String(tutorId).toLowerCase())
    );
    const tutorName = tutor?.name || String(req.body?.tutorName || tutorId);
    const tutorEmail = tutor?.email || String(req.body?.tutorEmail || '');

    const nowIso = new Date().toISOString();
    const existingIdx = mgmt.tutorAllocations.findIndex(
      (a: any) => a.courseId === courseId && a.tutorId === (tutor?.id || tutorId)
    );
    const record = {
      id: existingIdx >= 0 ? mgmt.tutorAllocations[existingIdx].id : `talloc-${Date.now()}`,
      courseId,
      courseType: enrichCourseRecord(course).courseType,
      tutorId: tutor?.id || tutorId,
      tutorName,
      tutorEmail,
      role: allocationRole === 'CO_TUTOR' ? 'CO_TUTOR' : 'LEAD',
      allocatedAt: nowIso,
      allocatedBy: req.authSession?.email || 'Administrator',
    };

    if (existingIdx >= 0) mgmt.tutorAllocations[existingIdx] = record;
    else mgmt.tutorAllocations.push(record);

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    return res.json({ success: true, allocation: record, tutorAllocations: mgmt.tutorAllocations });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to allocate tutor.' });
  }
});

app.delete('/api/course-management/tutor-allocations/:id', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const mgmt = readCourseMgmtStore();
    mgmt.tutorAllocations = mgmt.tutorAllocations.filter((a: any) => a.id !== req.params.id);
    mgmt.updatedAt = new Date().toISOString();
    writeCourseMgmtStore(mgmt);
    return res.json({ success: true, tutorAllocations: mgmt.tutorAllocations });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to remove tutor allocation.' });
  }
});

// 7. Student / Admin: Save Draft or Submit Major & Minor Course Selection
app.post('/api/course-management/selections', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  try {
    const callerRole = String(req.authSession?.role || '').toUpperCase();
    const isAdmin = ADMIN_ONLY_ROLES.includes(callerRole);
    const profiles = readPersistentStore();
    const coursesStore = readCoursesStore();
    const mgmt = readCourseMgmtStore();

    const { majorCourseId, minorCourseIds, mode, remarks, studentId: reqStudentId } = req.body || {};
    const submitMode = mode === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';

    // Identify student safely from authenticated session unless Admin specifies studentId
    let studentRecord = isAdmin && reqStudentId
      ? profiles.students.find((s: any) => s.id === reqStudentId || s.userId === reqStudentId)
      : profiles.students.find(
          (s: any) =>
            s.userId === req.authSession?.userId ||
            (req.authSession?.email && s.email && normalizeEmail(s.email) === normalizeEmail(req.authSession.email))
        );

    const callerUser = profiles.users.find(
      (u: any) =>
        u.id === req.authSession?.userId ||
        (req.authSession?.email && normalizeEmail(u.email) === normalizeEmail(req.authSession.email))
    );

    const effectiveStudentId = studentRecord?.id || reqStudentId || `stud-${req.authSession?.userId || Date.now()}`;
    const effectiveUserId = studentRecord?.userId || callerUser?.id || req.authSession?.userId || effectiveStudentId;
    const effectiveName = studentRecord?.name || callerUser?.name || req.body?.studentName || 'Academy Student';
    const effectiveEmail = studentRecord?.email || callerUser?.email || req.authSession?.email || '';

    // Check lock / deadline for non-admins
    if (!isAdmin) {
      if (mgmt.policy.selectionLocked) {
        return res.status(423).json({
          success: false,
          error: 'Course selection window is currently locked by Academic Administration.',
        });
      }
      if (mgmt.policy.selectionDeadline) {
        const today = new Date().toISOString().split('T')[0];
        if (today > mgmt.policy.selectionDeadline) {
          return res.status(423).json({
            success: false,
            error: `Course selection deadline (${mgmt.policy.selectionDeadline}) has passed.`,
          });
        }
      }
    }

    const existingIdx = mgmt.selections.findIndex(
      (s: any) =>
        s.studentId === effectiveStudentId ||
        s.userId === effectiveUserId ||
        (effectiveEmail && s.studentEmail && normalizeEmail(s.studentEmail) === normalizeEmail(effectiveEmail))
    );

    if (existingIdx >= 0 && mgmt.selections[existingIdx].approvalStatus === 'APPROVED' && !isAdmin) {
      return res.status(409).json({
        success: false,
        error: 'Your course selection has already been approved and locked. Contact Administration for curriculum changes.',
      });
    }

    const allCourses = coursesStore.courses.map(enrichCourseRecord);
    const majorCourse = allCourses.find((c: any) => c.id === majorCourseId);
    if (!majorCourse || majorCourse.courseType !== 'major' || majorCourse.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'Please select an active Major Course.' });
    }

    const cleanMinorIds: string[] = Array.isArray(minorCourseIds)
      ? Array.from(new Set(minorCourseIds.map((id: any) => String(id).trim()).filter(Boolean)))
      : [];

    if (cleanMinorIds.includes(majorCourse.id)) {
      return res.status(400).json({ success: false, error: 'A course cannot be selected as both Major and Minor.' });
    }

    const minorCourses = cleanMinorIds
      .map((id) => allCourses.find((c: any) => c.id === id))
      .filter((c: any) => Boolean(c) && c.courseType === 'minor' && c.status === 'ACTIVE');

    if (minorCourses.length !== cleanMinorIds.length) {
      return res.status(400).json({ success: false, error: 'One or more selected Minor Courses are invalid or inactive.' });
    }

    if (submitMode === 'SUBMITTED') {
      if (cleanMinorIds.length < mgmt.policy.minMinorSelections) {
        return res.status(400).json({
          success: false,
          error: `Please select at least ${mgmt.policy.minMinorSelections} Minor Course(s) before submitting.`,
        });
      }
      if (cleanMinorIds.length > mgmt.policy.maxMinorSelections) {
        return res.status(400).json({
          success: false,
          error: `You can select a maximum of ${mgmt.policy.maxMinorSelections} Minor Course(s).`,
        });
      }
    }

    const totalCredits = Number(majorCourse.credits || 0) + minorCourses.reduce((acc, m: any) => acc + Number(m.credits || 0), 0);
    if (totalCredits > mgmt.policy.maxTotalCredits) {
      return res.status(400).json({
        success: false,
        error: `Selected credits (${totalCredits}) exceed the policy limit of ${mgmt.policy.maxTotalCredits} credits.`,
      });
    }

    // Seat availability check
    for (const c of [majorCourse, ...minorCourses]) {
      const seatCount = mgmt.enrollments.filter((e: any) => e.courseId === c.id && e.status === 'ACTIVE').length;
      if (c.maxSeats && seatCount >= c.maxSeats) {
        return res.status(409).json({
          success: false,
          error: `Course "${c.name}" has reached maximum seat capacity (${c.maxSeats} seats).`,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const prevRecord = existingIdx >= 0 ? mgmt.selections[existingIdx] : null;
    const selectionId = prevRecord?.id || `sel-${Date.now()}`;
    const approvalStatus =
      submitMode === 'DRAFT'
        ? 'DRAFT'
        : mgmt.policy.requireAdminApproval
        ? 'SUBMITTED'
        : 'APPROVED';

    const selectionRecord = {
      id: selectionId,
      studentId: effectiveStudentId,
      userId: effectiveUserId,
      studentName: effectiveName,
      studentEmail: effectiveEmail,
      majorCourseId: majorCourse.id,
      minorCourseIds: cleanMinorIds,
      totalCredits,
      approvalStatus,
      submittedAt: submitMode === 'SUBMITTED' ? nowIso : prevRecord?.submittedAt,
      approvedBy: approvalStatus === 'APPROVED' ? 'Auto-Approved (Policy)' : prevRecord?.approvedBy,
      approvedAt: approvalStatus === 'APPROVED' ? nowIso : prevRecord?.approvedAt,
      remarks: typeof remarks === 'string' ? remarks.trim() : prevRecord?.remarks,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) mgmt.selections[existingIdx] = selectionRecord;
    else mgmt.selections.unshift(selectionRecord);

    mgmt.approvalLogs.unshift({
      id: `clog-${Date.now()}`,
      selectionId,
      studentId: effectiveStudentId,
      studentName: effectiveName,
      previousStatus: prevRecord?.approvalStatus || 'NONE',
      nextStatus: approvalStatus,
      actorId: req.authSession?.userId || effectiveUserId,
      actorName: effectiveName,
      actorRole: callerRole || 'STUDENT',
      remarks: submitMode === 'DRAFT' ? 'Saved course selection draft' : 'Submitted Major & Minor selection for review',
      timestamp: nowIso,
    });

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    return res.json({ success: true, selection: selectionRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to process course selection.' });
  }
});

// 8. Admin: Approve / Reject / Return Student Course Selection
app.post('/api/course-management/selections/:id/review', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  try {
    const selectionId = req.params.id;
    const { decision, remarks } = req.body || {};
    const cleanDecision = String(decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'MODIFICATION_REQUIRED', 'UNDER_REVIEW'].includes(cleanDecision)) {
      return res.status(400).json({ success: false, error: 'Invalid review decision.' });
    }

    const mgmt = readCourseMgmtStore();
    const sIdx = mgmt.selections.findIndex((s: any) => s.id === selectionId);
    if (sIdx < 0) {
      return res.status(404).json({ success: false, error: 'Student course selection not found.' });
    }

    const current = mgmt.selections[sIdx];
    const nowIso = new Date().toISOString();
    const actorEmail = req.authSession?.email || 'Administrator';

    const updatedSelection = {
      ...current,
      approvalStatus: cleanDecision,
      reviewedBy: actorEmail,
      reviewedAt: nowIso,
      ...(cleanDecision === 'APPROVED' ? { approvedBy: actorEmail, approvedAt: nowIso } : {}),
      remarks: typeof remarks === 'string' && remarks.trim() ? remarks.trim() : current.remarks,
      updatedAt: nowIso,
    };

    mgmt.selections[sIdx] = updatedSelection;

    // Sync normalized course_enrollments on APPROVAL
    if (cleanDecision === 'APPROVED') {
      mgmt.enrollments = mgmt.enrollments.filter((e: any) => e.selectionId !== selectionId && e.studentId !== current.studentId);
      mgmt.enrollments.push({
        id: `enr-${selectionId}-${current.majorCourseId}`,
        selectionId,
        studentId: current.studentId,
        studentName: current.studentName,
        studentEmail: current.studentEmail,
        courseId: current.majorCourseId,
        courseType: 'major',
        status: 'ACTIVE',
        progressPercent: 0,
        enrolledAt: nowIso,
      });
      for (const minorId of current.minorCourseIds || []) {
        mgmt.enrollments.push({
          id: `enr-${selectionId}-${minorId}`,
          selectionId,
          studentId: current.studentId,
          studentName: current.studentName,
          studentEmail: current.studentEmail,
          courseId: minorId,
          courseType: 'minor',
          status: 'ACTIVE',
          progressPercent: 0,
          enrolledAt: nowIso,
        });
      }

      // Sync major courseId back into persistent student record safely
      const profiles = readPersistentStore();
      let profileChanged = false;
      profiles.students = profiles.students.map((st: any) => {
        if (st.id === current.studentId || st.userId === current.userId) {
          profileChanged = true;
          return { ...st, courseId: current.majorCourseId, updatedAt: nowIso };
        }
        return st;
      });
      if (profileChanged) {
        profiles.updatedAt = nowIso;
        writePersistentStore(profiles);
      }
    }

    mgmt.approvalLogs.unshift({
      id: `clog-${Date.now()}`,
      selectionId,
      studentId: current.studentId,
      studentName: current.studentName,
      previousStatus: current.approvalStatus,
      nextStatus: cleanDecision,
      actorId: req.authSession?.userId || actorEmail,
      actorName: actorEmail,
      actorRole: role,
      remarks: remarks || `Selection marked ${cleanDecision}`,
      timestamp: nowIso,
    });

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    return res.json({
      success: true,
      selection: updatedSelection,
      enrollments: mgmt.enrollments,
      approvalLogs: mgmt.approvalLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unable to review selection.' });
  }
});

// 9. Tutor / Admin: Submit Student Academic Progress Report for an Assigned Course
app.post('/api/course-management/tutor-progress', requireVerifiedAuth, async (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  const isAdmin = ADMIN_ONLY_ROLES.includes(role);
  const isTutor = role === 'INSTRUCTOR' || role === 'REVIEWER';
  if (!isAdmin && !isTutor) {
    return res.status(403).json({ success: false, error: 'Tutor or Administrator privileges required.' });
  }

  try {
    const { studentId, studentName, courseId, courseType, progressPercent, assessmentScore, status, remarks } = req.body || {};
    if (!studentId || !courseId) {
      return res.status(400).json({ success: false, error: 'studentId and courseId are required.' });
    }

    const mgmt = readCourseMgmtStore();
    const profiles = readPersistentStore();

    if (!isAdmin) {
      const tutorRecord = profiles.instructors.find(
        (i: any) =>
          i.userId === req.authSession?.userId ||
          (req.authSession?.email && i.email && normalizeEmail(i.email) === normalizeEmail(req.authSession.email))
      );
      const isAllocated = mgmt.tutorAllocations.some(
        (a: any) =>
          a.courseId === courseId &&
          (a.tutorId === tutorRecord?.id ||
            a.tutorId === req.authSession?.userId ||
            (a.tutorEmail && req.authSession?.email && normalizeEmail(a.tutorEmail) === normalizeEmail(req.authSession.email)))
      );
      if (!isAllocated && mgmt.tutorAllocations.some((a: any) => a.courseId === courseId)) {
        return res.status(403).json({
          success: false,
          error: 'You are not allocated to this course. Tutors can only update progress for assigned courses.',
        });
      }
    }

    const nowIso = new Date().toISOString();
    const pct = Math.max(0, Math.min(100, Number(progressPercent ?? 0)));
    const report = {
      id: `tprog-${Date.now()}`,
      studentId,
      studentName: studentName || 'Student',
      courseId,
      courseType: courseType === 'minor' ? 'minor' : 'major',
      tutorId: req.authSession?.userId || 'tutor',
      tutorName: req.authSession?.email || 'Tutor',
      progressPercent: pct,
      assessmentScore: assessmentScore !== undefined && assessmentScore !== '' ? Number(assessmentScore) : undefined,
      status: ['ON_TRACK', 'NEEDS_SUPPORT', 'COMPLETED'].includes(String(status)) ? status : 'ON_TRACK',
      remarks: String(remarks || '').trim(),
      submittedAt: nowIso,
    };

    mgmt.progressReports.unshift(report);
    mgmt.enrollments = mgmt.enrollments.map((e: any) =>
      e.studentId === studentId && e.courseId === courseId
        ? {
            ...e,
            progressPercent: pct,
            status: pct >= 100 || report.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
          }
        : e
    );

    mgmt.updatedAt = nowIso;
    writeCourseMgmtStore(mgmt);

    return res.json({ success: true, report, enrollments: mgmt.enrollments });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save progress report.' });
  }
});

// 10. Admin: Export Course Selection & Allocation Report (JSON or CSV)
app.get('/api/course-management/reports/export', requireVerifiedAuth, (req: AuthedRequest, res) => {
  const role = String(req.authSession?.role || '').toUpperCase();
  if (!ADMIN_ONLY_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Administrator privileges required.' });
  }

  const format = String(req.query.format || 'csv').toLowerCase();
  const coursesStore = readCoursesStore();
  const mgmt = readCourseMgmtStore();
  const courseMap = new Map(coursesStore.courses.map((c: any) => [c.id, enrichCourseRecord(c)]));

  const rows = mgmt.selections.map((sel: any) => {
    const major = courseMap.get(sel.majorCourseId);
    const minors = (sel.minorCourseIds || []).map((id: string) => courseMap.get(id)).filter(Boolean);
    return {
      selectionId: sel.id,
      studentId: sel.studentId,
      studentName: sel.studentName,
      studentEmail: sel.studentEmail,
      majorCode: major?.code || '',
      majorName: major?.name || sel.majorCourseId,
      minorCodes: minors.map((m: any) => m.code).join(' | '),
      minorNames: minors.map((m: any) => m.name).join(' | '),
      totalCredits: sel.totalCredits,
      approvalStatus: sel.approvalStatus,
      submittedAt: sel.submittedAt || '',
      approvedBy: sel.approvedBy || '',
      approvedAt: sel.approvedAt || '',
      remarks: sel.remarks || '',
    };
  });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="swanaya-course-selections.json"');
    return res.send(JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, rows }, null, 2));
  }

  const headers = [
    'Selection ID',
    'Student ID',
    'Student Name',
    'Student Email',
    'Major Code',
    'Major Course',
    'Minor Codes',
    'Minor Courses',
    'Total Credits',
    'Approval Status',
    'Submitted At',
    'Approved By',
    'Approved At',
    'Remarks',
  ];
  const csvLines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((r) =>
      [
        r.selectionId,
        r.studentId,
        r.studentName,
        r.studentEmail,
        r.majorCode,
        r.majorName,
        r.minorCodes,
        r.minorNames,
        r.totalCredits,
        r.approvalStatus,
        r.submittedAt,
        r.approvedBy,
        r.approvedAt,
        r.remarks,
      ]
        .map(sanitizeCsvCell)
        .join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="swanaya-course-selections.csv"');
  return res.send(csvLines.join('\n'));
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

    const mailInfo = await sendTransactionalEmail({
      to: studentEmail || 'student@swanayamedia.com',
      subject: `Welcome to ${courseTitle || 'Swanaya Media Academy'}`,
      html: emailHtml,
      text: `Welcome to ${courseTitle || 'Swanaya Media Academy'}, ${studentName || 'Student'}!`,
    });

    console.log(`[Email] Registration welcome email sent to ${studentEmail || 'student'}`);
    return res.json({ success: true, messageId: mailInfo.messageId || 'SENT' });
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
              const mailInfo = await sendTransactionalEmail({
                to: student?.email,
                subject: `Welcome to ${course?.title} - Swanaya Media Academy`,
                html: emailHtml,
                text: `Welcome to ${course?.title} at Swanaya Media Academy, ${student?.name || 'Student'}!`,
              });

              console.log(`Welcome email sent to ${student?.email}. Message ID: ${mailInfo.messageId}`);

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
                  emailMessageId: mailInfo.messageId
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
  ensureMdBootstrapCredential();
  app.get('/googlef7eba3382952800a.html', (_req, res) => {
    res.type('text/html; charset=utf-8').send('google-site-verification: googlef7eba3382952800a.html');
  });
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
