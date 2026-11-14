import crypto from 'crypto';

export type CaptchaMode = 'visual' | 'math';
export type CaptchaPurpose = 'signup' | 'admissions' | 'course_registration' | string;

interface ChallengeRecord {
  id: string;
  mode: CaptchaMode;
  purpose: CaptchaPurpose;
  expectedSelectionIds?: string[];
  expectedAnswer?: number;
  attemptsRemaining: number;
  expiresAt: number;
}

interface VerifiedTokenRecord {
  tokenId: string;
  purpose: CaptchaPurpose;
  expiresAt: number;
  consumed: boolean;
}

const CAPTCHA_SECRET =
  process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString('hex');

const CHALLENGE_TTL_MS = 3 * 60 * 1000; // 3 minutes to solve
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes to submit after solving
const MAX_ATTEMPTS = 5;
const MAX_STORE_SIZE = 2000;

const activeChallenges = new Map<string, ChallengeRecord>();
const verifiedTokens = new Map<string, VerifiedTokenRecord>();

type SymbolKey = 'aperture' | 'quill' | 'waveform' | 'compass' | 'film' | 'prism';

const SYMBOL_KEYS: SymbolKey[] = [
  'aperture',
  'quill',
  'waveform',
  'compass',
  'film',
  'prism',
];

function pruneExpiredStores() {
  const now = Date.now();
  for (const [id, ch] of activeChallenges.entries()) {
    if (now > ch.expiresAt) {
      activeChallenges.delete(id);
    }
  }
  for (const [id, tok] of verifiedTokens.entries()) {
    if (now > tok.expiresAt || tok.consumed) {
      verifiedTokens.delete(id);
    }
  }
  if (activeChallenges.size > MAX_STORE_SIZE) {
    const excess = activeChallenges.size - MAX_STORE_SIZE;
    let count = 0;
    for (const key of activeChallenges.keys()) {
      activeChallenges.delete(key);
      count++;
      if (count >= excess) break;
    }
  }
  if (verifiedTokens.size > MAX_STORE_SIZE) {
    const excess = verifiedTokens.size - MAX_STORE_SIZE;
    let count = 0;
    for (const key of verifiedTokens.keys()) {
      verifiedTokens.delete(key);
      count++;
      if (count >= excess) break;
    }
  }
}

function getSymbolInnerSvg(key: SymbolKey, strokeColor: string): string {
  switch (key) {
    case 'aperture':
      return `
        <polygon points="32,8 52,20 52,44 32,56 12,44 12,20" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="32" cy="32" r="9.5" fill="none" stroke="${strokeColor}" stroke-width="2.4"/>
        <circle cx="32" cy="32" r="2.8" fill="${strokeColor}"/>
      `;
    case 'quill':
      return `
        <path d="M32 8 L46 28 L38 54 L26 54 L18 28 Z" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linejoin="round"/>
        <line x1="32" y1="8" x2="32" y2="34" stroke="${strokeColor}" stroke-width="2.2"/>
        <circle cx="32" cy="36" r="3" fill="${strokeColor}"/>
      `;
    case 'waveform':
      return `
        <line x1="14" y1="26" x2="14" y2="38" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="23" y1="17" x2="23" y2="47" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="32" y1="10" x2="32" y2="54" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="41" y1="19" x2="41" y2="45" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="50" y1="27" x2="50" y2="37" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round"/>
      `;
    case 'compass':
      return `
        <polygon points="32,7 38,26 57,32 38,38 32,57 26,38 7,32 26,26" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="32" cy="32" r="4" fill="${strokeColor}"/>
      `;
    case 'film':
      return `
        <rect x="11" y="14" width="42" height="36" rx="4" fill="none" stroke="${strokeColor}" stroke-width="2.5"/>
        <line x1="20" y1="14" x2="20" y2="50" stroke="${strokeColor}" stroke-width="2"/>
        <line x1="44" y1="14" x2="44" y2="50" stroke="${strokeColor}" stroke-width="2"/>
        <polygon points="28,25 39,32 28,39" fill="${strokeColor}"/>
      `;
    case 'prism':
      return `
        <polygon points="32,10 54,50 10,50" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linejoin="round"/>
        <line x1="8" y1="31" x2="25" y2="31" stroke="${strokeColor}" stroke-width="2.1" stroke-linecap="round"/>
        <line x1="39" y1="31" x2="56" y2="39" stroke="${strokeColor}" stroke-width="2.1" stroke-linecap="round"/>
      `;
  }
}

function generateNoiseOverlay(): string {
  const x1 = crypto.randomInt(4, 20);
  const y1 = crypto.randomInt(8, 56);
  const cx = crypto.randomInt(20, 44);
  const cy = crypto.randomInt(6, 58);
  const x2 = crypto.randomInt(44, 60);
  const y2 = crypto.randomInt(8, 56);

  const d1x = crypto.randomInt(8, 56);
  const d1y = crypto.randomInt(8, 56);
  const d2x = crypto.randomInt(8, 56);
  const d2y = crypto.randomInt(8, 56);

  return `
    <path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="rgba(148,163,184,0.18)" stroke-width="1.2"/>
    <circle cx="${d1x}" cy="${d1y}" r="1.2" fill="rgba(212,175,55,0.22)"/>
    <circle cx="${d2x}" cy="${d2y}" r="1" fill="rgba(148,163,184,0.22)"/>
  `;
}

function buildSvgDataUri(svgContent: string, width = 64, height = 64): string {
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${svgContent}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(fullSvg, 'utf8').toString('base64')}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createCaptchaChallenge(
  mode: CaptchaMode = 'visual',
  purpose: CaptchaPurpose = 'signup'
) {
  pruneExpiredStores();

  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;

  if (mode === 'math') {
    const useSubtraction = crypto.randomInt(0, 2) === 1;
    let a = crypto.randomInt(6, 24);
    let b = crypto.randomInt(2, 15);
    if (useSubtraction && b > a) {
      [a, b] = [b, a];
    }
    const operator = useSubtraction ? '-' : '+';
    const expectedAnswer = useSubtraction ? a - b : a + b;
    const expression = `${a} ${operator} ${b} = ?`;

    const yOffset = crypto.randomInt(26, 33);
    const tilt = crypto.randomInt(-3, 4);
    const svgContent = `
      <rect width="180" height="48" rx="6" fill="#070A10"/>
      ${generateNoiseOverlay()}
      <text x="90" y="${yOffset}" text-anchor="middle" font-family="monospace" font-size="20" font-weight="700" fill="#F3CD5B" transform="rotate(${tilt} 90 24)">${expression}</text>
    `;

    activeChallenges.set(challengeId, {
      id: challengeId,
      mode: 'math',
      purpose,
      expectedAnswer,
      attemptsRemaining: MAX_ATTEMPTS,
      expiresAt,
    });

    return {
      challengeId,
      mode: 'math' as const,
      prompt: 'Enter the result of the equation below',
      accessiblePrompt: `Calculate ${a} ${useSubtraction ? 'minus' : 'plus'} ${b}`,
      mathImageUri: buildSvgDataUri(svgContent, 180, 48),
      expiresAt,
    };
  }

  // Visual Emblem Match Challenge
  const shuffledSymbols = shuffleArray(SYMBOL_KEYS);
  const targetSymbol = shuffledSymbols[0];
  const decoyPool = shuffledSymbols.slice(1);

  // Target reference preview (clean gold on dark surface)
  const targetSvg = `
    <rect width="64" height="64" rx="8" fill="#070A10"/>
    ${generateNoiseOverlay()}
    ${getSymbolInnerSvg(targetSymbol, '#D4AF37')}
  `;

  // Pick 2 matching tiles + 4 decoy tiles
  const tileSpecs: Array<{ symbol: SymbolKey; isTarget: boolean }> = [
    { symbol: targetSymbol, isTarget: true },
    { symbol: targetSymbol, isTarget: true },
    { symbol: decoyPool[0], isTarget: false },
    { symbol: decoyPool[1], isTarget: false },
    { symbol: decoyPool[2], isTarget: false },
    { symbol: decoyPool[3], isTarget: false },
  ];

  const randomizedTiles = shuffleArray(tileSpecs);
  const expectedSelectionIds: string[] = [];

  const tiles = randomizedTiles.map((spec) => {
    const tileId = `t-${crypto.randomUUID().slice(0, 8)}`;
    if (spec.isTarget) {
      expectedSelectionIds.push(tileId);
    }
    const rotation = crypto.randomInt(-18, 19);
    const scale = (crypto.randomInt(88, 106) / 100).toFixed(2);
    const strokeColors = ['#E2E8F0', '#CBD5E1', '#F3CD5B', '#F8FAFC'];
    const strokeColor = strokeColors[crypto.randomInt(0, strokeColors.length)];

    const tileSvg = `
      <rect width="64" height="64" rx="8" fill="#0B0F18"/>
      ${generateNoiseOverlay()}
      <g transform="translate(32 32) rotate(${rotation}) scale(${scale}) translate(-32 -32)">
        ${getSymbolInnerSvg(spec.symbol, strokeColor)}
      </g>
    `;

    return {
      id: tileId,
      imageUri: buildSvgDataUri(tileSvg, 64, 64),
    };
  });

  activeChallenges.set(challengeId, {
    id: challengeId,
    mode: 'visual',
    purpose,
    expectedSelectionIds,
    attemptsRemaining: MAX_ATTEMPTS,
    expiresAt,
  });

  return {
    challengeId,
    mode: 'visual' as const,
    prompt: 'Select the 2 tiles matching this emblem',
    requiredSelections: 2,
    targetImageUri: buildSvgDataUri(targetSvg, 64, 64),
    tiles,
    expiresAt,
  };
}

function signPayload(payload: object): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', CAPTCHA_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyCaptchaChallenge(input: {
  challengeId?: string;
  selectedIds?: string[];
  answer?: string | number;
  purpose?: CaptchaPurpose;
}) {
  pruneExpiredStores();

  const { challengeId, selectedIds, answer, purpose } = input;
  if (!challengeId || typeof challengeId !== 'string') {
    return { verified: false, status: 400, error: 'Missing CAPTCHA challenge ID.' };
  }

  const record = activeChallenges.get(challengeId);
  if (!record) {
    return {
      verified: false,
      expired: true,
      status: 400,
      error: 'Verification challenge expired. Please try the new challenge.',
    };
  }

  if (Date.now() > record.expiresAt) {
    activeChallenges.delete(challengeId);
    return {
      verified: false,
      expired: true,
      status: 400,
      error: 'Verification challenge timed out. Loading a fresh challenge.',
    };
  }

  record.attemptsRemaining -= 1;

  let isMatch = false;
  if (record.mode === 'visual') {
    const expected = record.expectedSelectionIds || [];
    if (Array.isArray(selectedIds) && selectedIds.length === expected.length) {
      const uniqueSelected = new Set(selectedIds);
      isMatch =
        uniqueSelected.size === expected.length &&
        expected.every((id) => uniqueSelected.has(id));
    }
  } else {
    const numericAnswer = Number(String(answer ?? '').trim());
    isMatch = Number.isFinite(numericAnswer) && numericAnswer === record.expectedAnswer;
  }

  if (!isMatch) {
    if (record.attemptsRemaining <= 0) {
      activeChallenges.delete(challengeId);
      return {
        verified: false,
        expired: true,
        status: 400,
        error: 'Maximum attempts reached. Please solve the new challenge.',
      };
    }
    return {
      verified: false,
      expired: false,
      attemptsRemaining: record.attemptsRemaining,
      status: 400,
      error: 'Selection did not match. Please try again.',
    };
  }

  // Solved cleanly: remove challenge so it cannot be solved again
  activeChallenges.delete(challengeId);

  const tokenId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const resolvedPurpose = purpose || record.purpose;

  verifiedTokens.set(tokenId, {
    tokenId,
    purpose: resolvedPurpose,
    expiresAt,
    consumed: false,
  });

  const captchaToken = signPayload({
    tokenId,
    purpose: resolvedPurpose,
    issuedAt,
    expiresAt,
  });

  return {
    verified: true,
    status: 200,
    captchaToken,
    expiresAt,
  };
}

export function consumeCaptchaToken(
  captchaToken?: string | null,
  expectedPurpose?: CaptchaPurpose
): { valid: boolean; error?: string; tokenId?: string } {
  pruneExpiredStores();

  if (!captchaToken || typeof captchaToken !== 'string') {
    return { valid: false, error: 'Please complete the CAPTCHA verification first.' };
  }

  const parts = captchaToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid CAPTCHA verification token.' };
  }

  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', CAPTCHA_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false, error: 'CAPTCHA signature verification failed.' };
  }

  let payload: { tokenId: string; purpose: CaptchaPurpose; expiresAt: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Malformed CAPTCHA token payload.' };
  }

  if (!payload.tokenId || Date.now() > payload.expiresAt) {
    return {
      valid: false,
      error: 'CAPTCHA verification expired. Please complete a fresh challenge.',
    };
  }

  const stored = verifiedTokens.get(payload.tokenId);
  if (!stored || stored.consumed || Date.now() > stored.expiresAt) {
    return {
      valid: false,
      error: 'CAPTCHA token has already been used or expired. Please verify again.',
    };
  }

  if (expectedPurpose && stored.purpose !== expectedPurpose) {
    return {
      valid: false,
      error: 'CAPTCHA token does not match this registration form.',
    };
  }

  // Consume atomically to prevent replay attacks
  stored.consumed = true;
  verifiedTokens.delete(payload.tokenId);

  return { valid: true, tokenId: payload.tokenId };
}
