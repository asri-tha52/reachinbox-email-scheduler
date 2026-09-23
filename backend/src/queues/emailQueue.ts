import { Queue, JobsOptions } from 'bullmq';
import { getBullMQConnectionOptions } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: getBullMQConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 2000,
    removeOnFail: 5000,
  },
});

export async function addEmailJobToQueue(
  data: EmailJobData,
  delayMs: number,
  customJobId?: string
): Promise<{ jobId: string }> {
  const options: JobsOptions = {
    delay: Math.max(0, delayMs),
    jobId: customJobId || `email-job-${data.emailId}-${Date.now()}`,
  };

  const job = await emailQueue.add('send-email', data, options);
  return { jobId: String(job.id) };
}
