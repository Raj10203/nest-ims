export const JOBS_EXCHANGE = 'jobs';
export const JOBS_QUEUE = 'jobs';
export const DEAD_QUEUE = 'jobs.dead';
export const JOB_HANDLERS = Symbol('JOB_HANDLERS');
export const ATTEMPT_HEADER = 'x-attempt';

// Wait before retry 1, 2 and 3. After the last one the job goes to DEAD_QUEUE.
export const RETRY_DELAYS_MS = [5_000, 30_000, 300_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
export const retryQueue = (delayMs: number) => `jobs.retry.${delayMs}ms`;
