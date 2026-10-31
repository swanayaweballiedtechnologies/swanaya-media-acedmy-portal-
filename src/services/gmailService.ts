/**
 * Gmail Integration Service
 * Uses Gmail REST API to send exam schedules, announcements, and results.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  accessToken: string;
}

// Convert string to URL-safe Base64 RFC 2822 email format
function createMimeMessage(to: string, subject: string, bodyText: string): string {
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    `<div font-family: sans-serif; font-size: 14px; color: #1e293b;">${bodyText.replace(/\n/g, '<br/>')}</div>`
  ];
  const emailStr = emailLines.join('\r\n');

  // Convert to Base64 URL-safe
  const base64Encoded = btoa(unescape(encodeURIComponent(emailStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64Encoded;
}

export const sendGmailMessage = async ({ to, subject, body, accessToken }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const rawMessage = createMimeMessage(to, subject, body);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: rawMessage
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Gmail API error HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('Failed to send Gmail message:', error);
    return { success: false, error: error.message || 'Unknown error sending email via Gmail.' };
  }
};
