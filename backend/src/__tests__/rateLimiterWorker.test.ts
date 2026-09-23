import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAndConsumeRateSlot, getHourKey, getNextHourWindow } from '../services/rateLimiter';
import { processEmailJob } from '../workers/emailWorker';
import redisClient from '../config/redis';
import * as mailer from '../integrations/ethereal/mailer';
import * as queueModule from '../queues/emailQueue';
import * as slackModule from '../integrations/slack/service';
import { EmailRepository } from '../repositories/emailRepository';
import { UserRepository } from '../repositories/userRepository';
import { EmailStatus } from '@prisma/client';

describe('Atomic Redis Rate Limiter Service', () => {
  it('should allow exactly 2 emails and throttle the 3rd email when limit is 2', async () => {
    const senderId = `test-sender-limit-2-${Date.now()}`;
    const limit = 2;

    const res1 = await checkAndConsumeRateSlot(senderId, limit);
    expect(res1.allowed).toBe(true);
    expect(res1.currentCount).toBe(1);
    expect(res1.limit).toBe(2);

    const res2 = await checkAndConsumeRateSlot(senderId, limit);
    expect(res2.allowed).toBe(true);
    expect(res2.currentCount).toBe(2);
    expect(res2.limit).toBe(2);

    // 3rd call MUST NOT be allowed
    const res3 = await checkAndConsumeRateSlot(senderId, limit);
    expect(res3.allowed).toBe(false);
    expect(res3.currentCount).toBe(2); // Counter must NOT increment beyond limit
    expect(res3.rescheduleDelayMs).toBeGreaterThan(0);
    expect(res3.nextWindowDate).toBeInstanceOf(Date);

    // Verify Redis counter directly
    const hourKey = getHourKey();
    const redisCount = await redisClient.get(`email-rate:${senderId}:${hourKey}`);
    expect(Number(redisCount)).toBe(2);
  });

  it('should maintain atomic concurrency when multiple workers race to claim slots', async () => {
    const senderId = `test-concurrent-sender-${Date.now()}`;
    const limit = 3;
    const workerCount = 10;

    // Simulate 10 workers simultaneously trying to consume a slot
    const promises = Array.from({ length: workerCount }, () =>
      checkAndConsumeRateSlot(senderId, limit)
    );

    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.allowed);
    const throttled = results.filter((r) => !r.allowed);

    expect(allowed).toHaveLength(3);
    expect(throttled).toHaveLength(7);

    // Redis counter must be exactly limit (3)
    const hourKey = getHourKey();
    const redisCount = await redisClient.get(`email-rate:${senderId}:${hourKey}`);
    expect(Number(redisCount)).toBe(3);
  });
});

describe('Live Worker Rate-Limiting & Rescheduling Flow', () => {
  let sendEmailSpy: any;
  let addJobSpy: any;
  let rescheduleSpy: any;
  let markSentSpy: any;
  let slackAlertSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    sendEmailSpy = vi.spyOn(mailer, 'sendEmailViaEthereal').mockResolvedValue({
      messageId: '<test-message-id@reachinbox.ai>',
      previewUrl: 'https://ethereal.email/message/test-preview-url',
    });

    addJobSpy = vi.spyOn(queueModule, 'addEmailJobToQueue').mockResolvedValue({
      jobId: 'rescheduled-bull-job-id',
    });

    rescheduleSpy = vi.spyOn(EmailRepository, 'rescheduleEmail').mockResolvedValue({} as any);
    markSentSpy = vi.spyOn(EmailRepository, 'markSent').mockResolvedValue({} as any);
    vi.spyOn(EmailRepository, 'claimEmailForProcessing').mockResolvedValue(true);
    vi.spyOn(UserRepository, 'getSlackConnection').mockResolvedValue(null);
    slackAlertSpy = vi.spyOn(slackModule, 'sendSlackRateLimitAlert').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reproduces test case: 3 emails with hourlyLimit=2 -> 2 allowed, 1 rescheduled, 0 third-email SMTP sends', async () => {
    const senderId = `worker-test-sender-${Date.now()}`;
    const campaignId = `campaign-${Date.now()}`;
    const userId = 'user-123';

    // Mock 3 emails with same sender and campaign (hourlyLimit = 2)
    const mockEmails: Record<string, any> = {
      'email-1': {
        id: 'email-1',
        userId,
        senderId,
        campaignId,
        recipient: 'bob@example.com',
        subject: 'Rate Limit Test',
        body: 'Hello Bob',
        status: EmailStatus.scheduled,
        scheduledAt: new Date(),
        sender: { id: senderId, name: 'Tester', email: 'sender@reachinbox.ai', hourlyLimit: 2 },
        campaign: { id: campaignId, hourlyLimit: 2, delayMs: 0 },
      },
      'email-2': {
        id: 'email-2',
        userId,
        senderId,
        campaignId,
        recipient: 'alice@example.com',
        subject: 'Rate Limit Test',
        body: 'Hello Alice',
        status: EmailStatus.scheduled,
        scheduledAt: new Date(),
        sender: { id: senderId, name: 'Tester', email: 'sender@reachinbox.ai', hourlyLimit: 2 },
        campaign: { id: campaignId, hourlyLimit: 2, delayMs: 0 },
      },
      'email-3': {
        id: 'email-3',
        userId,
        senderId,
        campaignId,
        recipient: 'john@example.com',
        subject: 'Rate Limit Test',
        body: 'Hello John',
        status: EmailStatus.scheduled,
        scheduledAt: new Date(),
        sender: { id: senderId, name: 'Tester', email: 'sender@reachinbox.ai', hourlyLimit: 2 },
        campaign: { id: campaignId, hourlyLimit: 2, delayMs: 0 },
      },
    };

    vi.spyOn(EmailRepository, 'findById').mockImplementation(async (id: string) => mockEmails[id] || null);

    // Worker processes Email 1
    const result1 = await processEmailJob({
      id: 'job-1',
      data: { emailId: 'email-1', senderId, userId, campaignId },
    });
    expect(result1.sent).toBe(true);

    // Worker processes Email 2
    const result2 = await processEmailJob({
      id: 'job-2',
      data: { emailId: 'email-2', senderId, userId, campaignId },
    });
    expect(result2.sent).toBe(true);

    // Worker processes Email 3 (MUST be rescheduled, MUST NOT send SMTP)
    const result3 = await processEmailJob({
      id: 'job-3',
      data: { emailId: 'email-3', senderId, userId, campaignId },
    });

    expect(result3.rescheduled).toBe(true);
    expect(result3.sent).toBeUndefined();
    expect(result3.nextWindow).toBeDefined();
    expect(result3.delayMs).toBeGreaterThan(0);

    // CRITICAL ASSERTION: SMTP was called EXACTLY 2 times, NOT 3 times
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);

    // Database markSent was called exactly 2 times
    expect(markSentSpy).toHaveBeenCalledTimes(2);

    // Database rescheduleEmail was called for email-3
    expect(rescheduleSpy).toHaveBeenCalledTimes(1);
    expect(rescheduleSpy).toHaveBeenCalledWith(
      'email-3',
      expect.any(Date),
      'rescheduled-bull-job-id'
    );

    // Delayed job added to BullMQ
    expect(addJobSpy).toHaveBeenCalledTimes(1);
    expect(addJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({ emailId: 'email-3', senderId, userId, campaignId }),
      expect.any(Number)
    );
  });

  it('enforces rate limit correctly when multiple workers process jobs concurrently', async () => {
    const senderId = `worker-concurrent-sender-${Date.now()}`;
    const campaignId = `campaign-conc-${Date.now()}`;
    const userId = 'user-conc';
    const limit = 2;

    const emailIds = ['conc-1', 'conc-2', 'conc-3', 'conc-4', 'conc-5'];
    const mockEmails: Record<string, any> = {};

    for (const id of emailIds) {
      mockEmails[id] = {
        id,
        userId,
        senderId,
        campaignId,
        recipient: `${id}@example.com`,
        subject: 'Concurrent Test',
        body: 'Testing concurrency',
        status: EmailStatus.scheduled,
        scheduledAt: new Date(),
        sender: { id: senderId, name: 'Concurrent Tester', email: 'conc@reachinbox.ai', hourlyLimit: limit },
        campaign: { id: campaignId, hourlyLimit: limit, delayMs: 0 },
      };
    }

    vi.spyOn(EmailRepository, 'findById').mockImplementation(async (id: string) => mockEmails[id] || null);

    // Run 5 worker jobs simultaneously
    const results = await Promise.all(
      emailIds.map((emailId, index) =>
        processEmailJob({
          id: `job-conc-${index}`,
          data: { emailId, senderId, userId, campaignId },
        })
      )
    );

    const sentResults = results.filter((r) => r.sent === true);
    const rescheduledResults = results.filter((r) => r.rescheduled === true);

    // Exactly 2 allowed and sent
    expect(sentResults).toHaveLength(2);

    // Exactly 3 rescheduled
    expect(rescheduledResults).toHaveLength(3);

    // Exactly 2 SMTP calls made (0 excess SMTP sends)
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);

    // Exactly 3 delayed BullMQ jobs created
    expect(addJobSpy).toHaveBeenCalledTimes(3);

    // Exactly 3 DB reschedules performed
    expect(rescheduleSpy).toHaveBeenCalledTimes(3);
  });

  it('correctly uses campaign hourlyLimit when sender has default 100 limit', async () => {
    const senderId = `worker-campaign-override-${Date.now()}`;
    const campaignId = `campaign-override-${Date.now()}`;
    const userId = 'user-override';

    // Sender has default 100, but Campaign specifies strict hourlyLimit = 1
    const mockEmail1 = {
      id: 'override-1',
      userId,
      senderId,
      campaignId,
      recipient: 'one@example.com',
      subject: 'Override Test',
      body: 'Body',
      status: EmailStatus.scheduled,
      scheduledAt: new Date(),
      sender: { id: senderId, name: 'Default Sender', email: 'default@reachinbox.ai', hourlyLimit: 100 },
      campaign: { id: campaignId, hourlyLimit: 1, delayMs: 0 },
    };

    const mockEmail2 = {
      id: 'override-2',
      userId,
      senderId,
      campaignId,
      recipient: 'two@example.com',
      subject: 'Override Test',
      body: 'Body',
      status: EmailStatus.scheduled,
      scheduledAt: new Date(),
      sender: { id: senderId, name: 'Default Sender', email: 'default@reachinbox.ai', hourlyLimit: 100 },
      campaign: { id: campaignId, hourlyLimit: 1, delayMs: 0 },
    };

    vi.spyOn(EmailRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === 'override-1') return mockEmail1 as any;
      if (id === 'override-2') return mockEmail2 as any;
      return null;
    });

    const res1 = await processEmailJob({
      id: 'override-job-1',
      data: { emailId: 'override-1', senderId, userId, campaignId },
    });
    expect(res1.sent).toBe(true);

    // 2nd email must be rescheduled even though sender has limit 100, because campaign has limit 1
    const res2 = await processEmailJob({
      id: 'override-job-2',
      data: { emailId: 'override-2', senderId, userId, campaignId },
    });
    expect(res2.rescheduled).toBe(true);
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });
});
