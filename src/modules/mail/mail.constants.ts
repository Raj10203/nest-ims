export const MAIL_OPTIONS = Symbol('MAIL_OPTIONS');

export interface MailOptions {
  host: string;
  port: number;
  from: string;
  // true for implicit TLS (usually port 465); STARTTLS is negotiated otherwise.
  secure?: boolean;
  auth?: { user: string; pass: string };
}
