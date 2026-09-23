import crypto from 'crypto';
import config from '../config';
import { cleanAndDeduplicateRecipients } from '../utils/emailValidator';
import { EmailRepository } from '../repositories/emailRepository';
import { UserRepository } from '../repositories/userRepository';
import { addEmailJobToQueue } from '../queues/emailQueue';
import prisma from '../config/database';
import { ScheduleEmailInput } from '../types';

export class EmailService {
  /**
   * Schedules emails with staggered delays and creates BullMQ delayed jobs
   */
  static async scheduleEmails(userId: string, input: ScheduleEmailInput) {
    const rawRecipients = input.recipients || [];
    const validRecipients = cleanAndDeduplicateRecipients(rawRecipients);

    if (validRecipients.length === 0) {
      throw new Error('No valid email recipients provided');
    }

    if (!input.subject || !input.subject.trim()) {
      throw new Error('Email subject is required');
    }

    if (!input.body || !input.body.trim()) {
      throw new Error('Email body is required');
    }

    // Resolve or find default sender
    let senderId = input.senderId;
    if (!senderId) {
      const senders = await UserRepository.getUserSenders(userId);
      if (senders.length > 0) {
        senderId = senders[0].id;
      } else {
        const user = await UserRepository.findById(userId);
        if (!user) throw new Error('User not found');
        const defaultSender = await UserRepository.ensureDefaultSender(user.id, user.email, user.name);
        senderId = defaultSender.id;
      }
    }

    // Delay calculation with minimum floor
    const minDelay = config.MIN_EMAIL_DELAY_MS;
    const requestedDelay = Number(input.delayMs) || minDelay;
    const effectiveDelayMs = Math.max(minDelay, requestedDelay);

    // Base start time
    const parsedStart = new Date(input.startTime);
    const baseStartTime = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
    const now = Date.now();

    // Create Campaign record if batch has multiple recipients or for tracking
    const configuredHourlyLimit = input.hourlyLimit && input.hourlyLimit > 0 ? input.hourlyLimit : config.MAX_EMAILS_PER_HOUR;
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        subject: input.subject,
        body: input.body,
        startTime: baseStartTime,
        delayMs: effectiveDelayMs,
        hourlyLimit: configuredHourlyLimit,
      },
    });

    // Synchronize sender's hourly limit in database with the configured rate limit
    if (senderId && configuredHourlyLimit) {
      await prisma.sender.update({
        where: { id: senderId },
        data: { hourlyLimit: configuredHourlyLimit },
      });
    }

    const scheduledEmails = [];
    const schedulingErrors = [];

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];

      // Staggered scheduled time for each recipient
      const scheduledTimeMs = Math.max(now, baseStartTime.getTime()) + i * effectiveDelayMs;
      const scheduledAt = new Date(scheduledTimeMs);
      const delayFromNow = Math.max(0, scheduledTimeMs - now);

      // Generate cryptographically unique idempotency key
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${userId}-${campaign.id}-${recipient}-${scheduledTimeMs}-${crypto.randomBytes(8).toString('hex')}`)
        .digest('hex');

      try {
        // 1. Create DB record in PostgreSQL (source of truth)
        const emailRecord = await EmailRepository.createEmail({
          userId,
          senderId,
          campaignId: campaign.id,
          recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt,
          idempotencyKey,
        });

        // 2. Add delayed job to BullMQ
        const { jobId } = await addEmailJobToQueue(
          {
            emailId: emailRecord.id,
            senderId,
            userId,
            campaignId: campaign.id,
          },
          delayFromNow
        );

        // 3. Update email with BullMQ job ID
        await EmailRepository.updateBullJobId(emailRecord.id, jobId);

        scheduledEmails.push({
          id: emailRecord.id,
          recipient: emailRecord.recipient,
          scheduledAt: emailRecord.scheduledAt,
          bullJobId: jobId,
        });
      } catch (err: any) {
        console.error(`Failed to schedule email for ${recipient}:`, err.message);
        schedulingErrors.push({ recipient, error: err.message });
      }
    }

    return {
      campaignId: campaign.id,
      totalRequested: rawRecipients.length,
      totalValid: validRecipients.length,
      totalScheduled: scheduledEmails.length,
      effectiveDelayMs,
      scheduledEmails,
      errors: schedulingErrors,
    };
  }
}
