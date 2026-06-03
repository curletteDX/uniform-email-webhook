import { Resend } from 'resend';

export interface SendEmailInput {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

/**
 * Tiny Resend wrapper so callers don't import Resend directly.
 * Throws on failure so the caller can choose what to do.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = new Resend(input.apiKey);

  const { data, error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : JSON.stringify(error);
    throw new Error(`Resend rejected the email: ${message}`);
  }

  if (!data?.id) {
    throw new Error('Resend returned no email id');
  }

  return { id: data.id };
}
