// Every job type and its payload. To add a job: add it here, write a
// JobHandler for it, and register the handler in JobsWorkerModule.
export interface JobPayloads {
  'mail.send-email-otp': {
    to: string;
    otp: string;
    expiresInMinutes: number;
  };
}

export type JobType = keyof JobPayloads;

export interface JobEnvelope<T extends JobType = JobType> {
  id: string;
  type: T;
  payload: JobPayloads[T];
  createdAt: string;
}

export interface JobContext {
  jobId: string;
  attempt: number;
}

export interface JobHandler<T extends JobType = JobType> {
  readonly type: T;
  // Drops the job from the dead-letter queue after this long, for payloads
  // holding a short-lived secret (an OTP). Unset keeps it until replayed.
  readonly deadLetterTtlMs?: number;
  handle(payload: JobPayloads[T], context: JobContext): Promise<void>;
}

export type AnyJobHandler = { [T in JobType]: JobHandler<T> }[JobType];
