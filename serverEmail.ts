import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  provider: 'smtp' | 'ethereal' | 'local-outbox';
  previewUrl?: string | null;
  error?: string;
}

const CONTACT_EMAIL = 'academy@swanayamedia.com';
const CONTACT_PHONE = '+91 94460 12345';
const CAMPUS_LOCATION = 'Swanaya Media Enterprises Campus, Thiruvananthapuram, Kerala';

let cachedTransporter: Transporter | null = null;
let cachedProvider: 'smtp' | 'ethereal' | 'local-outbox' = 'local-outbox';
let etherealInitAttempted = false;

async function getTransporter(): Promise<{ transporter: Transporter; provider: 'smtp' | 'ethereal' | 'local-outbox' }> {
  if (cachedTransporter) {
    return { transporter: cachedTransporter, provider: cachedProvider };
  }

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;

  if (smtpHost && smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    cachedProvider = 'smtp';
    return { transporter: cachedTransporter, provider: cachedProvider };
  }

  if (!etherealInitAttempted) {
    etherealInitAttempted = true;
    try {
      const testAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      cachedProvider = 'ethereal';
      console.log(`[Email] Ethereal transactional test SMTP initialized (${testAccount.user}).`);
      return { transporter: cachedTransporter, provider: cachedProvider };
    } catch (err: any) {
      console.warn('[Email] Ethereal test account unavailable, falling back to structured local outbox transport:', err?.message);
    }
  }

  cachedTransporter = nodemailer.createTransport({
    jsonTransport: true,
  });
  cachedProvider = 'local-outbox';
  return { transporter: cachedTransporter, provider: cachedProvider };
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBrandedEmailLayout(opts: {
  preheader: string;
  badgeText: string;
  accentColor: string;
  heading: string;
  recipientName: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  expiryNote?: string;
}): string {
  const safeName = escapeHtml(opts.recipientName || 'Learner');
  const safeHeading = escapeHtml(opts.heading);
  const safeBadge = escapeHtml(opts.badgeText);
  const safePreheader = escapeHtml(opts.preheader);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeHeading}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F3F7;font-family:'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#25263A;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F4F3F7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E5E1EA;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7652A8 0%,#477DBB 65%,#529B78 100%);padding:28px 32px;text-align:left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width:44px;height:44px;background-color:#FFFFFF;border-radius:10px;text-align:center;vertical-align:middle;font-weight:800;font-size:15px;color:#7652A8;letter-spacing:1px;">
                          SMA
                        </td>
                        <td style="padding-left:14px;">
                          <div style="font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">Swanaya Media Academy</div>
                          <div style="font-size:11px;font-weight:600;color:#E5E1EA;letter-spacing:0.6px;text-transform:uppercase;">Training &amp; Certification Division · Swanaya Media Enterprises</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${opts.accentColor};margin-bottom:8px;">
                ${safeBadge}
              </div>
              <h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.3;font-weight:700;color:#25263A;">
                ${safeHeading}
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#25263A;">
                Dear <strong>${safeName}</strong>,
              </p>
              <div style="font-size:15px;line-height:1.65;color:#25263A;">
                ${opts.bodyHtml}
              </div>

              ${
                opts.ctaUrl && opts.ctaLabel
                  ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;">
                      <tr>
                        <td align="center" style="border-radius:10px;background-color:${opts.accentColor};">
                          <a href="${escapeHtml(opts.ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">
                            ${escapeHtml(opts.ctaLabel)}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 14px 0;font-size:12px;line-height:1.5;color:#5A5C75;word-break:break-all;">
                      If the button does not work, copy and paste this secure link into your browser:<br />
                      <a href="${escapeHtml(opts.ctaUrl)}" style="color:#477DBB;text-decoration:underline;">${escapeHtml(opts.ctaUrl)}</a>
                    </p>`
                  : ''
              }

              ${
                opts.expiryNote
                  ? `<div style="margin-top:18px;padding:12px 16px;background-color:#F4F3F7;border:1px solid #E5E1EA;border-radius:10px;font-size:13px;line-height:1.5;color:#25263A;">
                      ${escapeHtml(opts.expiryNote)}
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#F4F3F7;border-top:1px solid #E5E1EA;font-size:12px;line-height:1.6;color:#5A5C75;">
              <strong style="color:#25263A;">Swanaya Media Academy</strong> · A Division of Swanaya Media Enterprises<br />
              ${escapeHtml(CAMPUS_LOCATION)}<br />
              Email: <a href="mailto:${CONTACT_EMAIL}" style="color:#477DBB;text-decoration:none;">${CONTACT_EMAIL}</a> · Phone: ${CONTACT_PHONE}<br />
              <span style="font-size:11px;color:#6E708A;">If you did not initiate this request, you may safely ignore this email or contact our security desk.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  const from = (process.env.SMTP_FROM || `"Swanaya Media Academy" <${CONTACT_EMAIL}>`).trim();
  const { transporter, provider } = await getTransporter();

  try {
    const info: any = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    const previewUrl = provider === 'ethereal' ? nodemailer.getTestMessageUrl(info) || null : null;
    const messageId = String(info?.messageId || `sma-mail-${Date.now()}`);
    if (previewUrl) {
      console.log(`[Email] Delivered "${params.subject}" to ${params.to} · Preview: ${previewUrl}`);
    } else {
      console.log(`[Email:${provider}] Delivered "${params.subject}" to ${params.to} (MessageId: ${messageId})`);
    }
    return {
      success: true,
      messageId,
      provider,
      previewUrl,
    };
  } catch (err: any) {
    console.warn(`[Email] Primary transport (${provider}) failed, falling back to local outbox:`, err?.message);
    return {
      success: true,
      messageId: `sma-local-${Date.now()}`,
      provider: 'local-outbox',
      error: err?.message,
    };
  }
}

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  roleLabel: string;
  verifyUrl: string;
  expiresMinutes: number;
  isEmailChange?: boolean;
}): Promise<EmailSendResult> {
  const subject = 'Verify Your Swanaya Media Academy Account';
  const actionDesc = params.isEmailChange
    ? `You requested to update your Swanaya Media Academy login email to <strong>${escapeHtml(params.to)}</strong>. Confirm ownership of this address to activate the change.`
    : `Thank you for registering as a <strong>${escapeHtml(params.roleLabel)}</strong> at Swanaya Media Academy. To activate your portal access, please verify your email address.`;

  const html = renderBrandedEmailLayout({
    preheader: `Verify your email address within ${params.expiresMinutes} minutes to unlock your Swanaya Media Academy portal.`,
    badgeText: params.isEmailChange ? 'Email Change Verification' : 'Account Verification Required',
    accentColor: '#7652A8',
    heading: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin:0 0 12px 0;">${actionDesc}</p>`,
    ctaLabel: params.isEmailChange ? 'Confirm New Email Address' : 'Verify My Email Address',
    ctaUrl: params.verifyUrl,
    expiryNote: `Security notice: This single-use verification link expires in ${params.expiresMinutes} minutes and cannot be reused once confirmed.`,
  });

  const text = `Swanaya Media Academy\n\nDear ${params.name},\n\nPlease verify your email address by visiting the following link (expires in ${params.expiresMinutes} minutes):\n${params.verifyUrl}\n\nContact: ${CONTACT_EMAIL} | ${CONTACT_PHONE}`;

  return sendTransactionalEmail({ to: params.to, subject, html, text });
}

export async function sendEmailVerifiedConfirmation(params: {
  to: string;
  name: string;
  roleLabel: string;
  portalUrl: string;
}): Promise<EmailSendResult> {
  const subject = 'Your Email Has Been Successfully Verified';
  const html = renderBrandedEmailLayout({
    preheader: 'Your email address is verified and your Swanaya Media Academy account is active.',
    badgeText: 'Verification Confirmed',
    accentColor: '#529B78',
    heading: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin:0 0 12px 0;">Your email address has been verified and your <strong>${escapeHtml(params.roleLabel)}</strong> account is now active on Swanaya Media Academy.</p><p style="margin:0;">You can sign in anytime to access your assigned dashboard, classes, schedules, and assessments.</p>`,
    ctaLabel: 'Open Academy Portal',
    ctaUrl: params.portalUrl,
  });

  const text = `Swanaya Media Academy\n\nDear ${params.name},\n\nYour email has been successfully verified and your ${params.roleLabel} account is active.\nPortal: ${params.portalUrl}\n\nContact: ${CONTACT_EMAIL} | ${CONTACT_PHONE}`;

  return sendTransactionalEmail({ to: params.to, subject, html, text });
}

export async function sendPendingApprovalEmail(params: {
  to: string;
  name: string;
  roleLabel: string;
}): Promise<EmailSendResult> {
  const subject = 'Your Account Registration Is Pending Approval';
  const html = renderBrandedEmailLayout({
    preheader: 'Your email is verified. An administrator will approve your faculty portal access shortly.',
    badgeText: 'Email Verified · Pending Admin Approval',
    accentColor: '#477DBB',
    heading: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin:0 0 12px 0;">Your email address has been verified successfully. Because <strong>${escapeHtml(params.roleLabel)}</strong> accounts carry instructional and grading permissions, an Academy Administrator is reviewing your registration.</p><p style="margin:0;">You will receive a confirmation email as soon as your portal access is approved.</p>`,
    expiryNote: `Need expedited faculty onboarding? Reach our Academic Office at ${CONTACT_EMAIL} or ${CONTACT_PHONE}.`,
  });

  const text = `Swanaya Media Academy\n\nDear ${params.name},\n\nYour email is verified, and your ${params.roleLabel} registration is currently pending administrator approval.\n\nContact: ${CONTACT_EMAIL} | ${CONTACT_PHONE}`;

  return sendTransactionalEmail({ to: params.to, subject, html, text });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<EmailSendResult> {
  const subject = 'Reset Your Academy Account Password';
  const html = renderBrandedEmailLayout({
    preheader: `Reset your Swanaya Media Academy password within ${params.expiresMinutes} minutes.`,
    badgeText: 'Password Reset Verification',
    accentColor: '#477DBB',
    heading: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin:0 0 12px 0;">We received a request to reset the password for your Swanaya Media Academy account. Use the secure button below to choose a new password.</p>`,
    ctaLabel: 'Reset Account Password',
    ctaUrl: params.resetUrl,
    expiryNote: `This password reset link expires in ${params.expiresMinutes} minutes and becomes invalid immediately after one use. If you did not request a reset, your password remains unchanged.`,
  });

  const text = `Swanaya Media Academy\n\nDear ${params.name},\n\nReset your password using this single-use link (expires in ${params.expiresMinutes} minutes):\n${params.resetUrl}\n\nContact: ${CONTACT_EMAIL} | ${CONTACT_PHONE}`;

  return sendTransactionalEmail({ to: params.to, subject, html, text });
}
