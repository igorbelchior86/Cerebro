import nodemailer from 'nodemailer';
import { operationalLogger } from '../../lib/operational-logger.js';

type InviteMailInput = {
  to: string;
  inviteUrl: string;
  role: string;
  inviterEmail: string;
  tenantName: string;
};

function smtpEnabled(): boolean {
  return String(process.env.SMTP_ENABLED || 'true').toLowerCase() === 'true';
}

function smtpTransport() {
  const host = process.env.SMTP_HOST || 'localhost';
  const port = Number(process.env.SMTP_PORT || 1025);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass } } : {}),
  });
}

export async function sendInviteEmail(input: InviteMailInput): Promise<{ sent: boolean; reason?: string }> {
  if (!smtpEnabled()) {
    return { sent: false, reason: 'smtp_disabled' };
  }
  try {
    const transporter = smtpTransport();
    const from = process.env.SMTP_FROM || 'Cerebro <no-reply@cerebro.local>';
    await transporter.sendMail({
      from,
      to: input.to,
      subject: `Invite to ${input.tenantName} on Cerebro`,
      text:
        `You were invited by ${input.inviterEmail} to join ${input.tenantName} as ${input.role}.\n\n` +
        `Activate your account here:\n${input.inviteUrl}\n`,
      html:
        `<p>You were invited by <strong>${input.inviterEmail}</strong> to join <strong>${input.tenantName}</strong> as <strong>${input.role}</strong>.</p>` +
        `<p><a href="${input.inviteUrl}">Activate your account</a></p>`,
    });
    return { sent: true };
  } catch (error) {
    operationalLogger.error('identity.mailer.send_invite.failed', error, {
      module: 'services.identity.mailer',
      operation: 'sendInviteEmail',
    });
    return { sent: false, reason: 'smtp_send_failed' };
  }
}

