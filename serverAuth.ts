import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUTH_STORE_FILE = path.resolve(DATA_DIR, 'persistent_auth.json');

export type TokenPurpose = 'EMAIL_VERIFY' | 'PASSWORD_RESET' | 'EMAIL_CHANGE';
export type VerificationChannel = 'WHATSAPP' | 'PHONE';
export type PhoneOtpPurpose = 'REGISTER' | 'COURSE_REGISTER' | 'CHANGE_NUMBER' | 'LOGIN';

export const DEFAULT_ACADEMY_VERIFICATION_PHONE = '+91 94460 55555';

export const AADITHYAN_ADMIN_ALIASES = new Set<string>([
  'aadithyan.menon@swanayamedia.com',
  'swanayamediaenterprisesadmins@gmail.com',
  'swanyamediaenterprisesadmins@gmail.com',
  'aadithyan@swanayamedia.com',
  'aadithyanmmenon@gmail.com',
]);

export function isAadithyanIdentifier(identifier: string): boolean {
  const raw = String(identifier || '').trim().toLowerCase();
  const clean = raw.replace(/[^a-z0-9]/g, '');
  return (
    raw === 'aadithyan' ||
    raw === 'aadithyan m menon' ||
    clean === 'aadithyan' ||
    clean === 'aadithyanmmenon' ||
    AADITHYAN_ADMIN_ALIASES.has(raw) ||
    AADITHYAN_ADMIN_ALIASES.has(clean)
  );
}

export interface AuthCredentialRecord {
  userId: string;
  email: string;
  username?: string;
  phone?: string;
  whatsappPhone?: string;
  phone_verified?: boolean;
  phoneVerifiedAt?: string;
  passwordSalt: string;
  passwordHash: string;
  bootstrapHashes?: Array<{ salt: string; hash: string }>;
  email_verified: boolean;
  emailVerifiedAt?: string;
  updatedAt: string;
}

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  email: string;
  pendingEmail?: string;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string | null;
}

export interface PhoneVerificationCodeRecord {
  id: string;
  userId?: string;
  email?: string;
  phone: string;
  phoneDigits: string;
  channel: VerificationChannel;
  purpose: PhoneOtpPurpose;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string | null;
}

export interface ConfirmationMessageRecord {
  id: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  academyPhone: string;
  channel: VerificationChannel;
  type: 'COURSE_REGISTRATION' | 'REGISTRATION_ACCEPTED' | 'PHONE_VERIFIED';
  courseId?: string;
  courseTitle?: string;
  messageText: string;
  whatsappUrl: string;
  sentAt: string;
}

export interface VerificationSettingsRecord {
  academyVerificationPhone: string;
  defaultChannel: VerificationChannel;
  updatedAt: string;
  updatedBy?: string;
}

export interface AuthAuditLogRecord {
  id: string;
  event: string;
  userId?: string;
  email?: string;
  role?: string;
  ip?: string;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  message: string;
  createdAt: string;
}

export interface EmailOutboxRecord {
  id: string;
  to: string;
  subject: string;
  purpose: string;
  provider: string;
  messageId: string;
  previewUrl?: string | null;
  sentAt: string;
}

export interface PersistentAuthStore {
  credentials: Record<string, AuthCredentialRecord>; // keyed by lower email
  tokens: VerificationTokenRecord[];
  phoneOtps: PhoneVerificationCodeRecord[];
  confirmationMessages: ConfirmationMessageRecord[];
  verificationSettings: VerificationSettingsRecord;
  auditLogs: AuthAuditLogRecord[];
  outbox: EmailOutboxRecord[];
  updatedAt: string;
}

const SESSION_SECRET =
  (process.env.AUTH_SESSION_SECRET || '').trim() ||
  crypto
    .createHash('sha256')
    .update(`swanaya-media-academy-session-seed:${process.cwd()}`)
    .digest('hex');

export const VERIFICATION_EXPIRY_MINUTES = 30;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function readAuthStore(): PersistentAuthStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(AUTH_STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(AUTH_STORE_FILE, 'utf8'));
      return {
        credentials: raw?.credentials && typeof raw.credentials === 'object' ? raw.credentials : {},
        tokens: Array.isArray(raw?.tokens) ? raw.tokens : [],
        phoneOtps: Array.isArray(raw?.phoneOtps) ? raw.phoneOtps : [],
        confirmationMessages: Array.isArray(raw?.confirmationMessages) ? raw.confirmationMessages : [],
        verificationSettings:
          raw?.verificationSettings && raw.verificationSettings.academyVerificationPhone
            ? raw.verificationSettings
            : {
                academyVerificationPhone: DEFAULT_ACADEMY_VERIFICATION_PHONE,
                defaultChannel: 'WHATSAPP',
                updatedAt: new Date().toISOString(),
              },
        auditLogs: Array.isArray(raw?.auditLogs) ? raw.auditLogs : [],
        outbox: Array.isArray(raw?.outbox) ? raw.outbox : [],
        updatedAt: raw?.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[AuthStore] Unable to read persistent auth store:', err);
  }
  return {
    credentials: {},
    tokens: [],
    phoneOtps: [],
    confirmationMessages: [],
    verificationSettings: {
      academyVerificationPhone: DEFAULT_ACADEMY_VERIFICATION_PHONE,
      defaultChannel: 'WHATSAPP',
      updatedAt: new Date().toISOString(),
    },
    auditLogs: [],
    outbox: [],
    updatedAt: new Date().toISOString(),
  };
}

export function writeAuthStore(store: PersistentAuthStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[AuthStore] Unable to write persistent auth store:', err);
  }
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  if (!password || !salt || !storedHash) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(storedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function verifyCredentialPassword(password: string, cred: AuthCredentialRecord): boolean {
  if (verifyPassword(password, cred.passwordSalt, cred.passwordHash)) {
    return true;
  }
  if (Array.isArray(cred.bootstrapHashes) && cred.bootstrapHashes.length > 0) {
    return cred.bootstrapHashes.some((entry) => verifyPassword(password, entry.salt, entry.hash));
  }
  return false;
}

export function ensureMdBootstrapCredential(): void {
  const mdEmail = 'aadithyan.menon@swanayamedia.com';
  const store = readAuthStore();
  const existing = store.credentials[mdEmail];

  // Never rotate or replace an existing MD credential during ordinary server startup.
  // Bootstrap is allowed only for a genuinely missing record and an explicitly
  // configured secret supplied by the backend environment.
  if (existing) {
    return;
  }

  const bootstrapPassword = String(process.env.SMA_MD_BOOTSTRAP_PASSWORD || '').trim();
  if (!bootstrapPassword) {
    console.warn('[AuthStore] MD bootstrap skipped: no existing credential and no SMA_MD_BOOTSTRAP_PASSWORD configured.');
    return;
  }

  const primary = hashPassword(bootstrapPassword);
  const nowIso = new Date().toISOString();
  store.credentials[mdEmail] = {
    userId: 'usr-md',
    email: mdEmail,
    username: 'aadithyan',
    passwordSalt: primary.salt,
    passwordHash: primary.hash,
    email_verified: true,
    emailVerifiedAt: nowIso,
    updatedAt: nowIso,
  };
  writeAuthStore(store);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken || '').trim()).digest('hex');
}

export function createHashedVerificationToken(params: {
  userId: string;
  email: string;
  purpose: TokenPurpose;
  pendingEmail?: string;
  ttlMinutes?: number;
}): { rawToken: string; record: VerificationTokenRecord } {
  const cleanEmail = normalizeEmail(params.email);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const ttlMs = (params.ttlMinutes ?? VERIFICATION_EXPIRY_MINUTES) * 60 * 1000;
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();

  const store = readAuthStore();
  // Invalidate previous active tokens of same purpose & email to prevent stale reuse
  store.tokens = store.tokens
    .map((t) => {
      if (t.email === cleanEmail && t.purpose === params.purpose && !t.consumedAt) {
        return { ...t, consumedAt: nowIso };
      }
      return t;
    })
    .slice(-500);

  const record: VerificationTokenRecord = {
    id: `tok_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    userId: params.userId,
    email: cleanEmail,
    ...(params.pendingEmail ? { pendingEmail: normalizeEmail(params.pendingEmail) } : {}),
    purpose: params.purpose,
    tokenHash,
    expiresAt,
    createdAt: nowIso,
    consumedAt: null,
  };

  store.tokens.push(record);
  writeAuthStore(store);

  return { rawToken, record };
}

export function consumeHashedVerificationToken(params: {
  rawToken: string;
  expectedPurpose?: TokenPurpose;
}):
  | { ok: true; record: VerificationTokenRecord }
  | { ok: false; code: 'INVALID_TOKEN' | 'TOKEN_USED' | 'TOKEN_EXPIRED'; error: string; email?: string; purpose?: TokenPurpose } {
  const cleanRaw = String(params.rawToken || '').trim();
  if (!cleanRaw || cleanRaw.length < 16) {
    return { ok: false, code: 'INVALID_TOKEN', error: 'Invalid verification token format.' };
  }

  const targetHash = hashToken(cleanRaw);
  const store = readAuthStore();
  const idx = store.tokens.findIndex((t) => t.tokenHash === targetHash);
  if (idx < 0) {
    return { ok: false, code: 'INVALID_TOKEN', error: 'Verification link is invalid or unrecognized.' };
  }

  const tokenRecord = store.tokens[idx];
  if (params.expectedPurpose && tokenRecord.purpose !== params.expectedPurpose) {
    return { ok: false, code: 'INVALID_TOKEN', error: 'Verification token does not match the requested action.' };
  }

  if (tokenRecord.consumedAt) {
    return {
      ok: false,
      code: 'TOKEN_USED',
      error: 'This verification link has already been used. Please sign in or request a new link.',
      email: tokenRecord.pendingEmail || tokenRecord.email,
      purpose: tokenRecord.purpose,
    };
  }

  if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
    return {
      ok: false,
      code: 'TOKEN_EXPIRED',
      error: 'This verification link has expired. Request a fresh link below.',
      email: tokenRecord.pendingEmail || tokenRecord.email,
      purpose: tokenRecord.purpose,
    };
  }

  const nowIso = new Date().toISOString();
  store.tokens[idx] = { ...tokenRecord, consumedAt: nowIso };
  writeAuthStore(store);

  return { ok: true, record: store.tokens[idx] };
}

export function recordAuthAudit(entry: Omit<AuthAuditLogRecord, 'id' | 'createdAt'>): void {
  const store = readAuthStore();
  const record: AuthAuditLogRecord = {
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  store.auditLogs = [record, ...store.auditLogs].slice(0, 1000);
  writeAuthStore(store);
}

export function recordEmailOutbox(entry: Omit<EmailOutboxRecord, 'id' | 'sentAt'>): void {
  const store = readAuthStore();
  const record: EmailOutboxRecord = {
    id: `mail_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    sentAt: new Date().toISOString(),
    ...entry,
  };
  store.outbox = [record, ...store.outbox].slice(0, 300);
  writeAuthStore(store);
}

// --- PHONE & WHATSAPP VERIFICATION CODE HELPERS ---
export function normalizePhoneDigits(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '');
}

export function formatWhatsappDigits(phone: string): string {
  const raw = String(phone || '').trim();
  const digits = normalizePhoneDigits(raw);
  if (!digits) return '919446055555';
  if (raw.startsWith('+')) {
    return digits;
  }
  if (digits.length === 8 || digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 8 && db.length >= 8) {
    return da.endsWith(db) || db.endsWith(da);
  }
  return false;
}

export function createPhoneVerificationCode(params: {
  phone: string;
  channel: VerificationChannel;
  purpose: PhoneOtpPurpose;
  userId?: string;
  email?: string;
  ttlMinutes?: number;
}): { code: string; record: PhoneVerificationCodeRecord; whatsappUrl: string } {
  const rawPhone = String(params.phone || '').trim() || DEFAULT_ACADEMY_VERIFICATION_PHONE;
  const phoneDigits = normalizePhoneDigits(rawPhone);
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashToken(`${phoneDigits}:${code}`);
  const now = Date.now();
  const ttlMs = (params.ttlMinutes ?? 10) * 60 * 1000;
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();

  const store = readAuthStore();
  store.phoneOtps = store.phoneOtps
    .map((otp) => {
      if (!otp.consumedAt && phonesMatch(otp.phoneDigits, phoneDigits) && otp.purpose === params.purpose) {
        return { ...otp, consumedAt: nowIso };
      }
      return otp;
    })
    .slice(-400);

  const record: PhoneVerificationCodeRecord = {
    id: `potp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.email ? { email: normalizeEmail(params.email) } : {}),
    phone: rawPhone,
    phoneDigits,
    channel: params.channel,
    purpose: params.purpose,
    codeHash,
    expiresAt,
    createdAt: nowIso,
    consumedAt: null,
  };

  store.phoneOtps.push(record);
  writeAuthStore(store);

  const waDigits = formatWhatsappDigits(rawPhone);
  const message = `Swanaya Media Academy Verification Code: ${code} (valid for ${params.ttlMinutes ?? 10} minutes).`;
  const whatsappUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;

  return { code, record, whatsappUrl };
}

export function verifyPhoneVerificationCode(params: {
  phone: string;
  code: string;
  purpose?: PhoneOtpPurpose;
}):
  | { ok: true; record: PhoneVerificationCodeRecord }
  | { ok: false; code: 'INVALID_CODE' | 'CODE_USED' | 'CODE_EXPIRED'; error: string } {
  const cleanDigits = normalizePhoneDigits(params.phone);
  const cleanCode = String(params.code || '').replace(/\s+/g, '').trim();

  if (!cleanDigits || cleanDigits.length < 6) {
    return { ok: false, code: 'INVALID_CODE', error: 'Please enter a valid Phone or WhatsApp number.' };
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, code: 'INVALID_CODE', error: 'Please enter the 6-digit verification code.' };
  }

  const store = readAuthStore();
  // Match any unconsumed or recently issued OTP whose phone matches and codeHash matches
  const matches = store.phoneOtps
    .map((otp, idx) => ({ otp, idx }))
    .filter(({ otp }) => {
      if (!phonesMatch(otp.phoneDigits, cleanDigits)) return false;
      if (params.purpose && otp.purpose !== params.purpose) return false;
      const expectedHash = hashToken(`${otp.phoneDigits}:${cleanCode}`);
      return otp.codeHash === expectedHash;
    });

  if (matches.length === 0) {
    return { ok: false, code: 'INVALID_CODE', error: 'Incorrect verification code. Please check the 6-digit code sent to your Phone or WhatsApp.' };
  }

  const latest = matches[matches.length - 1];
  if (latest.otp.consumedAt) {
    return { ok: false, code: 'CODE_USED', error: 'This verification code has already been used. Request a fresh code.' };
  }
  if (new Date(latest.otp.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: 'CODE_EXPIRED', error: 'This verification code has expired. Please request a fresh code.' };
  }

  const nowIso = new Date().toISOString();
  store.phoneOtps[latest.idx] = { ...latest.otp, consumedAt: nowIso };
  writeAuthStore(store);

  return { ok: true, record: store.phoneOtps[latest.idx] };
}

export function getVerificationSettings(): VerificationSettingsRecord {
  const store = readAuthStore();
  return store.verificationSettings || {
    academyVerificationPhone: DEFAULT_ACADEMY_VERIFICATION_PHONE,
    defaultChannel: 'WHATSAPP',
    updatedAt: new Date().toISOString(),
  };
}

export function updateVerificationSettings(params: {
  academyVerificationPhone: string;
  defaultChannel?: VerificationChannel;
  updatedBy?: string;
}): VerificationSettingsRecord {
  const store = readAuthStore();
  const next: VerificationSettingsRecord = {
    academyVerificationPhone: String(params.academyVerificationPhone || '').trim() || DEFAULT_ACADEMY_VERIFICATION_PHONE,
    defaultChannel: params.defaultChannel || store.verificationSettings?.defaultChannel || 'WHATSAPP',
    updatedAt: new Date().toISOString(),
    updatedBy: params.updatedBy,
  };
  store.verificationSettings = next;
  writeAuthStore(store);
  return next;
}

export function recordConfirmationMessage(
  entry: Omit<ConfirmationMessageRecord, 'id' | 'sentAt'>
): ConfirmationMessageRecord {
  const store = readAuthStore();
  const record: ConfirmationMessageRecord = {
    id: `CONF-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    sentAt: new Date().toISOString(),
    ...entry,
  };
  store.confirmationMessages = [record, ...store.confirmationMessages].slice(0, 500);
  writeAuthStore(store);
  return record;
}

// --- RATE LIMITING ---
const rateBucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateBucket.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  rateBucket.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

// --- SIGNED SESSION COOKIE & BACKEND MIDDLEWARE ---
export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  email_verified: boolean;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

export function setSessionCookie(res: Response, req: Request, payload: Omit<SessionPayload, 'exp'>): string {
  const token = signSessionToken(payload);
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').toLowerCase();
  const isHttps = proto.includes('https');
  const attrs = [
    `sma_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    attrs.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
  return token;
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http').toLowerCase();
  const isHttps = proto.includes('https');
  const attrs = [
    'sma_session=',
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    attrs.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function getRequestOriginHttps(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured && !configured.includes('MY_APP_URL')) {
    return configured.startsWith('http://localhost') || configured.startsWith('http://127.0.0.1')
      ? configured
      : configured.replace(/^http:\/\//i, 'https://');
  }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').trim();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (isLocal) {
    return `http://${host}`;
  }
  return `https://${host}`;
}

export interface AuthedRequest extends Request {
  authSession?: SessionPayload;
}

export function requireVerifiedAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = String(req.headers.authorization || '').startsWith('Bearer ')
    ? String(req.headers.authorization || '').slice(7).trim()
    : null;
  const session = verifySessionToken(cookies.sma_session || bearer);
  if (!session) {
    return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', error: 'Authentication session required.' });
  }
  if (!session.email_verified) {
    return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', error: 'Verified email required for access.' });
  }
  req.authSession = session;
  return next();
}
