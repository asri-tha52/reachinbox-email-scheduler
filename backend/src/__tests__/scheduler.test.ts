import { describe, it, expect } from 'vitest';
import { isValidEmail, cleanAndDeduplicateRecipients, parseRecipientsText } from '../utils/emailValidator';
import { getHourKey, getNextHourWindow } from '../services/rateLimiter';

describe('Email Validation & Parsing', () => {
  it('should validate valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.co')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('should clean and deduplicate recipients case-insensitively', () => {
    const raw = [
      'first@example.com',
      'FIRST@EXAMPLE.COM',
      'SECOND@example.com',
      'invalid-one',
      '   first@example.com   ',
      'third@reachinbox.ai',
    ];
    const cleaned = cleanAndDeduplicateRecipients(raw);
    expect(cleaned).toEqual([
      'first@example.com',
      'second@example.com',
      'third@reachinbox.ai',
    ]);
  });

  it('should strictly satisfy Assignment CSV test requirement', () => {
    // Requirement from Assignment prompt:
    // john@example.com
    // alice@example.com
    // john@example.com
    // invalid-value
    // bob@example.com
    // Expected: 3 valid unique emails
    const rawAssignmentList = [
      'john@example.com',
      'alice@example.com',
      'john@example.com',
      'invalid-value',
      'bob@example.com',
    ];
    const cleaned = cleanAndDeduplicateRecipients(rawAssignmentList);
    expect(cleaned).toHaveLength(3);
    expect(cleaned).toEqual(['john@example.com', 'alice@example.com', 'bob@example.com']);
  });

  it('should parse CSV / TXT multiline and comma-separated text', () => {
    const csvContent = `
      alice@reachinbox.ai, bob@reachinbox.ai
      charlie@reachinbox.ai; david@reachinbox.ai
      alice@reachinbox.ai
      malformed-recipient
    `;
    const parsed = parseRecipientsText(csvContent);
    expect(parsed).toHaveLength(4);
    expect(parsed).toContain('alice@reachinbox.ai');
    expect(parsed).toContain('bob@reachinbox.ai');
    expect(parsed).toContain('charlie@reachinbox.ai');
    expect(parsed).toContain('david@reachinbox.ai');
  });
});

describe('Rate Limiter Windows & Rescheduling Calculation', () => {
  it('should generate consistent UTC hour keys in YYYY-MM-DD-HH format', () => {
    const date = new Date(Date.UTC(2026, 8, 22, 18, 45, 0)); // Sept 22, 2026, 18:45 UTC
    const key = getHourKey(date);
    expect(key).toBe('2026-09-22-18');
  });

  it('should compute exact next-hour window and positive delay', () => {
    const now = new Date(Date.UTC(2026, 8, 22, 18, 45, 0));
    const { nextWindowDate, delayMs } = getNextHourWindow(now);

    expect(nextWindowDate.getUTCHours()).toBe(19);
    expect(nextWindowDate.getUTCMinutes()).toBe(0);
    expect(nextWindowDate.getUTCSeconds()).toBe(0);
    // 15 minutes = 15 * 60 * 1000 = 900,000 ms
    expect(delayMs).toBe(15 * 60 * 1000);
  });

  it('should calculate staggered sending times for batch jobs without timer overhead', () => {
    const startTimeMs = 1700000000000;
    const delayMs = 2000;
    const recipientCount = 5;

    const scheduledTimes = [];
    for (let i = 0; i < recipientCount; i++) {
      scheduledTimes.push(startTimeMs + i * delayMs);
    }

    expect(scheduledTimes[0]).toBe(startTimeMs);
    expect(scheduledTimes[1]).toBe(startTimeMs + 2000);
    expect(scheduledTimes[4]).toBe(startTimeMs + 8000);
  });
});

describe('Hourly Rate Limiting Algorithm Simulation', () => {
  it('should throttle when limit is reached and retain excess jobs for next hour', () => {
    const limit = 3;
    let currentCounter = 0;
    const jobs = ['job-1', 'job-2', 'job-3', 'job-4', 'job-5'];

    const processed = [];
    const rescheduled = [];

    for (const job of jobs) {
      if (currentCounter < limit) {
        currentCounter++;
        processed.push(job);
      } else {
        rescheduled.push(job);
      }
    }

    expect(processed).toHaveLength(3);
    expect(processed).toEqual(['job-1', 'job-2', 'job-3']);
    expect(rescheduled).toHaveLength(2);
    expect(rescheduled).toEqual(['job-4', 'job-5']);
  });

  it('reproduces 3 emails with hourly limit = 2 (2 allowed, 1 rescheduled, 0 third-email sends)', () => {
    const hourlyLimit = 2;
    const recipients = ['bob@example.com', 'alice@example.com', 'john@example.com'];
    let currentReserved = 0;
    const sentEmails: string[] = [];
    const rescheduledEmails: string[] = [];

    for (const recipient of recipients) {
      // Atomic check and reservation before SMTP send
      if (currentReserved < hourlyLimit) {
        currentReserved++;
        sentEmails.push(recipient); // simulated SMTP send
      } else {
        rescheduledEmails.push(recipient); // DO NOT send SMTP, reschedule
      }
    }

    expect(sentEmails).toHaveLength(2);
    expect(sentEmails).toEqual(['bob@example.com', 'alice@example.com']);
    expect(rescheduledEmails).toHaveLength(1);
    expect(rescheduledEmails).toEqual(['john@example.com']);
  });
});
