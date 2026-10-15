export const MAIL_QUEUE = 'mail';
export const SEND_EMAIL_OTP_JOB = 'send-email-otp';

export interface SendEmailOtpJob {
  to: string;
  otp: string;
  expiresInMinutes: number;
}
