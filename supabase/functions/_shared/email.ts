/**
 * Welcome-email builder + dispatch — portable (Deno edge runtime + Node.js).
 *
 * Two providers, chosen by env:
 *
 *   EMAIL_PROVIDER=log (default)
 *     Builds the email and returns the HTML so the pipeline can store it on
 *     the license record (email_preview_html). Nothing is sent. You can see
 *     exactly what customers would receive via the preview-email function.
 *
 *   EMAIL_PROVIDER=resend  (+ RESEND_API_KEY, EMAIL_FROM)
 *     Sends through the Resend API with a plain fetch — no SDK dependency.
 *     When you're ready: create resend.com account, verify your domain,
 *     add RESEND_API_KEY, set EMAIL_FROM=Pravely <noreply@yourdomain.com>,
 *     flip EMAIL_PROVIDER=resend. Done — no code changes.
 */

export interface EmailEnv {
  emailProvider?: string;
  resendApiKey?: string;
  emailFrom?: string;
}

export interface WelcomeEmailContext {
  productName: string;
  customerName: string;
  customerEmail: string;
  licenseId: string;
  /** Stable page on your site that mints fresh signed links. */
  downloadPageUrl: string;
  siteUrl: string;
  supportEmail: string;
}

export interface EmailDispatchResult {
  provider: 'resend' | 'log';
  messageId?: string;
  /** Full HTML — stored on the license record when provider=log. */
  previewHtml: string;
}

export interface ReleaseUpdateEmailContext {
  productName: string;
  customerName: string;
  licenseId: string;
  version: string;
  summary?: string | null;
  added: string[];
  changed: string[];
  fixed: string[];
  downloadPageUrl: string;
  changelogUrl: string;
  preferencesUrl: string;
  supportEmail: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char] ?? char);
}

export function buildReleaseUpdateEmail(ctx: ReleaseUpdateEmailContext): { subject: string; html: string; text: string } {
  const firstName = ctx.customerName.trim().split(/\s+/)[0] || 'there';
  const groups = [
    ['Added', ctx.added],
    ['Changed', ctx.changed],
    ['Fixed', ctx.fixed],
  ] as const;
  const textNotes = groups.filter(([, items]) => items.length).map(([label, items]) =>
    `${label}:\n${items.map((item) => `- ${item}`).join('\n')}`
  ).join('\n\n');
  const htmlNotes = groups.filter(([, items]) => items.length).map(([label, items]) =>
    `<h2 style="font-size:16px;margin:24px 0 8px;">${label}</h2><ul style="margin:0;padding-left:20px;color:#374151;">${items.map((item) => `<li style="margin:6px 0;">${escapeHtml(item)}</li>`).join('')}</ul>`
  ).join('');
  const subject = `${ctx.productName} ${ctx.version} is available`;
  const text = `Hi ${firstName},\n\nVersion ${ctx.version} of ${ctx.productName} is available.${ctx.summary ? `\n\n${ctx.summary}` : ''}\n\n${textNotes}\n\nGet the latest licensed version: ${ctx.downloadPageUrl}\nFull changelog: ${ctx.changelogUrl}\n\nLicense ID: ${ctx.licenseId}\nManage email preferences or unsubscribe: ${ctx.preferencesUrl}\nQuestions? ${ctx.supportEmail}`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;"><tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;"><tr><td style="padding:36px 40px;"><p style="font-weight:800;margin:0;">PRAVELY</p><h1 style="font-size:24px;margin:24px 0 12px;">Your ${escapeHtml(ctx.productName)} update is ready.</h1><p style="color:#4b5563;line-height:1.6;">Hi ${escapeHtml(firstName)} — version ${escapeHtml(ctx.version)} is now available.${ctx.summary ? ` ${escapeHtml(ctx.summary)}` : ''}</p>${htmlNotes}<p style="text-align:center;margin:32px 0 10px;"><a href="${ctx.downloadPageUrl}" style="display:inline-block;background:#075c42;color:#fff;text-decoration:none;font-weight:700;padding:15px 30px;border-radius:999px;">Get the latest licensed version</a></p><p style="font-size:13px;color:#4b5563;text-align:center;line-height:1.6;">Your existing licensed page prepares the latest eligible version. License ID: ${escapeHtml(ctx.licenseId)}<br><a href="${ctx.changelogUrl}" style="color:#0a0a0a;">View the full changelog</a></p><p style="font-size:13px;color:#4b5563;border-top:1px solid #d1d5db;padding-top:20px;margin-top:28px;">Questions? <a href="mailto:${ctx.supportEmail}" style="color:#0a0a0a;">${ctx.supportEmail}</a><br><a href="${ctx.preferencesUrl}" style="color:#0a0a0a;">Manage email preferences or unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

export function buildWelcomeEmail(ctx: WelcomeEmailContext): { subject: string; html: string; text: string } {
  const subject = `Your ${ctx.productName} is ready ✓`;
  const firstName = ctx.customerName.trim().split(/\s+/)[0] || 'there';

  const text =
    `Hi ${firstName},\n\n` +
    `Payment received — your ${ctx.productName} is ready to download.\n\n` +
    `License ID: ${ctx.licenseId}\n` +
    `Licensed to: ${ctx.customerName} / ${ctx.customerEmail}\n\n` +
    `Download: ${ctx.downloadPageUrl}\n\n` +
    `This page gives you a fresh, secure download link every time you visit, so bookmark it — you'll also get future workbook updates there.\n\n` +
    `Questions? Reply to this email or write to ${ctx.supportEmail}.\n\n` +
    `— Pravely`;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:36px 40px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td><img src="${ctx.siteUrl}/images/pravely-app-icon.png" alt="Pravely" width="36" height="36" style="display:block;border-radius:8px;"/></td>
            <td style="padding-left:12px;font-weight:800;font-size:16px;letter-spacing:-0.01em;color:#0a0a0a;">PRAVELY</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#0a0a0a;">Your ${ctx.productName} is ready.</h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#6b7280;">
            Hi ${firstName} — payment received, and your personally licensed workbook is waiting for you.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12px;color:#6b7280;">
                <tr><td style="padding:2px 0;">License ID</td><td style="padding:2px 0 2px 24px;color:#0a0a0a;font-weight:700;">${ctx.licenseId}</td></tr>
                <tr><td style="padding:2px 0;">Licensed to</td><td style="padding:2px 0 2px 24px;color:#0a0a0a;">${ctx.customerName}</td></tr>
                <tr><td style="padding:2px 0;">Email</td><td style="padding:2px 0 2px 24px;color:#0a0a0a;">${ctx.customerEmail}</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:32px 40px 8px;">
          <a href="${ctx.downloadPageUrl}" style="display:inline-block;background:#075c42;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:999px;">Your Pravely Toolkit Is Ready</a>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
            For security, download links expire — this page creates a fresh one each time you visit, so bookmark it. It's also where future workbook updates will be delivered.
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #e5e7eb;margin-top:8px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
            Questions? Just reply to this email, or write to <a href="mailto:${ctx.supportEmail}" style="color:#0a0a0a;text-decoration:underline;">${ctx.supportEmail}</a>.<br/>
            Works in Microsoft Excel and Google Sheets. No subscription. No login.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px;">© ${new Date().getFullYear()} Pravely · You're receiving this because ${ctx.productName} was issued to this email address.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Sends (or logs) the welcome email. When provider=log (the default until you
 * connect a provider), the caller stores previewHtml on the license record.
 */
export async function dispatchWelcomeEmail(
  env: EmailEnv,
  ctx: WelcomeEmailContext,
): Promise<EmailDispatchResult> {
  const { subject, html, text } = buildWelcomeEmail(ctx);

  if (env.emailProvider === 'resend' && env.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom || 'Pravely <onboarding@resend.dev>',
        to: [ctx.customerEmail],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { id?: string };
    return { provider: 'resend', messageId: data.id, previewHtml: html };
  }

  return { provider: 'log', previewHtml: html };
}
