import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  MAIL_QUEUE,
  SEND_EMAIL_OTP_JOB,
  SendEmailOtpJob,
} from './mail.constants.js';

@Injectable()
export class MailQueueService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue) {}

  async enqueueEmailOtp(data: SendEmailOtpJob): Promise<void> {
    await this.queue.add(SEND_EMAIL_OTP_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      // The job holds a plaintext OTP, so do not keep finished jobs around.
      removeOnComplete: true,
      removeOnFail: { age: 3600 },
    });
  }
}
