import { Worker, Job } from 'bullmq';
import config from '../config';
import { redisConnectionOptions } from '../config/redis';
import { EMAIL_QUEUE_NAME, addEmailJobToQueue } from '../queues/emailQueue';
import { EmailRepository } from '../repositories/emailRepository';
import { UserRepository } from '../repositories/userRepository';
import { checkAndConsumeRateSlot } from '../services/rateLimiter';
import { sendEmailViaEthereal } from '../integrations/ethereal/mailer';
import { indexEmailDocument } from '../integrations/elasticsearch/client';
import { sendSlackRateLimitAlert } from '../integrations/slack/service';
import { EmailJobData } from '../types';
import { EmailStatus } from '@prisma/client';

export async function processEmailJob(job: { id?: string | number; data: EmailJobData }) {
  const { emailId, senderId, userId } = job.data;
  console.log(`📨 [Worker Job ${job.id}] Processing email ${emailId}`);

  // 1. Fetch Email from PostgreSQL (Source of Truth)
  const email = await EmailRepository.findById(emailId);
  if (!email) {
    console.warn(`⚠️ [Worker Job ${job.id}] Email ${emailId} not found in database. Skipping.`);
    return { skipped: true, reason: 'NOT_FOUND' };
  }

  // 2. IDEMPOTENCY & CONCURRENCY GUARD: Atomically claim email
  if (email.status === EmailStatus.sent) {
    console.log(`🔒 [Worker Job ${job.id}] Email ${emailId} is already marked SENT. Idempotency guard triggered.`);
    return { skipped: true, reason: 'ALREADY_SENT' };
  }

  const claimed = await EmailRepository.claimEmailForProcessing(emailId);
  if (!claimed) {
    console.log(`🔒 [Worker Job ${job.id}] Email ${emailId} could not be claimed (already processing or sent).`);
    return { skipped: true, reason: 'ALREADY_CLAIMED_OR_SENT' };
  }

  // 3. Distributed Rate Limiting Check (Atomic reservation in Redis BEFORE SMTP send)
  // Effective hourly limit is determined by campaign, sender, or global config.
  let hourlyLimit = config.MAX_EMAILS_PER_HOUR;
  const campaignLimit = email.campaign?.hourlyLimit;
  const senderLimit = email.sender?.hourlyLimit;

  if (campaignLimit && campaignLimit > 0 && senderLimit && senderLimit > 0) {
    hourlyLimit = Math.min(campaignLimit, senderLimit);
  } else if (campaignLimit && campaignLimit > 0) {
    hourlyLimit = campaignLimit;
  } else if (senderLimit && senderLimit > 0) {
    hourlyLimit = senderLimit;
  }

  const rateCheck = await checkAndConsumeRateSlot(senderId, hourlyLimit);

  if (!rateCheck.allowed) {
    console.warn(
      `⏳ [Worker Job ${job.id}] Sender ${senderId} reached hourly limit (${rateCheck.currentCount}/${rateCheck.limit}). Rescheduling...`
    );

    // A. Reschedule job to the start of the next hour
    const { jobId: newJobId } = await addEmailJobToQueue(
      {
        emailId,
        senderId,
        userId,
        campaignId: email.campaignId || undefined,
      },
      rateCheck.rescheduleDelayMs
    );

    // B. Update database record with new scheduled time & revert status to scheduled
    await EmailRepository.rescheduleEmail(emailId, rateCheck.nextWindowDate, newJobId);

    // C. Send Slack rate limit notification if user has connected Slack
    const slackConn = await UserRepository.getSlackConnection(userId);
    if (slackConn && slackConn.connected && slackConn.accessToken) {
      const senderEmail = email.sender?.email || 'Unknown Sender';
      await sendSlackRateLimitAlert(
        senderId,
        senderEmail,
        rateCheck.limit,
        rateCheck.hourKey,
        slackConn.accessToken,
        slackConn.channelId || config.SLACK_DEFAULT_CHANNEL
      );
    }

    return {
      rescheduled: true,
      nextWindow: rateCheck.nextWindowDate.toISOString(),
      delayMs: rateCheck.rescheduleDelayMs,
    };
  }

  // 5. Enforce minimum inter-email delay if configured (bypass in automated tests)
  const effectiveDelay = email.campaign?.delayMs ?? config.MIN_EMAIL_DELAY_MS;
  if (effectiveDelay > 0 && config.NODE_ENV !== 'test') {
    await new Promise((resolve) => setTimeout(resolve, Math.min(effectiveDelay, 10000)));
  }

  // 6. Send via Ethereal SMTP
  try {
    const fromAddress = email.sender ? `"${email.sender.name}" <${email.sender.email}>` : 'ReachInbox Scheduler <scheduler@reachinbox.ai>';

    const sendResult = await sendEmailViaEthereal({
      from: fromAddress,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    console.log(`✅ [Worker Job ${job.id}] Email ${emailId} sent successfully via Ethereal. Preview: ${sendResult.previewUrl}`);

    // 7. Update PostgreSQL on success
    await EmailRepository.markSent(emailId, sendResult.previewUrl);

    // 8. Index into Elasticsearch (resilient, non-blocking)
    await indexEmailDocument({
      id: email.id,
      userId: email.userId,
      senderId: email.senderId,
      campaignId: email.campaignId,
      recipient: email.recipient,
      subject: email.subject,
      status: 'sent',
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: new Date().toISOString(),
    });

    return {
      sent: true,
      messageId: sendResult.messageId,
      previewUrl: sendResult.previewUrl,
    };
  } catch (sendError: any) {
    console.error(`❌ [Worker Job ${job.id}] Failed to send email ${emailId}:`, sendError.message);

    // Record error and attempt count in DB
    await EmailRepository.markFailed(emailId, sendError.message);

    // Re-throw so BullMQ handles automatic retries according to queue backoff
    throw sendError;
  }
}

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => processEmailJob(job),
    {
      connection: redisConnectionOptions,
      concurrency: config.WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`🎉 [Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`💥 [Worker] Job ${job?.id} permanently failed with error:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`⚠️ [Worker System Error]:`, err.message);
  });

  return worker;
}

export const emailWorker = createEmailWorker();
export default emailWorker;
