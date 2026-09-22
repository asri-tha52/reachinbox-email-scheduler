import { EmailStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';

export class EmailRepository {
  static async createEmail(data: {
    userId: string;
    senderId: string;
    campaignId?: string | null;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    idempotencyKey: string;
  }) {
    return prisma.email.create({
      data: {
        userId: data.userId,
        senderId: data.senderId,
        campaignId: data.campaignId,
        recipient: data.recipient,
        subject: data.subject,
        body: data.body,
        scheduledAt: data.scheduledAt,
        idempotencyKey: data.idempotencyKey,
        status: EmailStatus.scheduled,
      },
    });
  }

  static async updateBullJobId(emailId: string, bullJobId: string) {
    return prisma.email.update({
      where: { id: emailId },
      data: { bullJobId },
    });
  }

  static async findById(id: string) {
    return prisma.email.findUnique({
      where: { id },
      include: {
        sender: true,
        campaign: true,
      },
    });
  }

  static async findByIdForUser(id: string, userId: string) {
    return prisma.email.findFirst({
      where: { id, userId },
      include: {
        sender: true,
        campaign: true,
      },
    });
  }

  static async findScheduledByUserId(userId: string, skip = 0, take = 50) {
    return prisma.email.findMany({
      where: {
        userId,
        status: { in: [EmailStatus.scheduled, EmailStatus.processing] },
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take,
    });
  }

  static async findSentByUserId(userId: string, skip = 0, take = 50) {
    return prisma.email.findMany({
      where: {
        userId,
        status: { in: [EmailStatus.sent, EmailStatus.failed] },
      },
      include: { sender: true },
      orderBy: { sentAt: 'desc' },
      skip,
      take,
    });
  }

  static async claimEmailForProcessing(id: string): Promise<boolean> {
    const res = await prisma.email.updateMany({
      where: {
        id,
        status: { in: [EmailStatus.scheduled, EmailStatus.failed] },
      },
      data: {
        status: EmailStatus.processing,
        attempts: { increment: 1 },
      },
    });
    return res.count > 0;
  }

  static async markProcessing(id: string) {
    return prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.processing,
        attempts: { increment: 1 },
      },
    });
  }

  static async markSent(id: string, previewUrl?: string | null) {
    return prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.sent,
        sentAt: new Date(),
        error: null,
        previewUrl: previewUrl || null,
      },
    });
  }

  static async markFailed(id: string, errorMessage: string) {
    return prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.failed,
        error: errorMessage,
      },
    });
  }

  static async rescheduleEmail(id: string, newScheduledAt: Date, newBullJobId: string) {
    return prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.scheduled,
        scheduledAt: newScheduledAt,
        bullJobId: newBullJobId,
        error: 'Rescheduled due to hourly rate limit',
      },
    });
  }

  static async searchDatabaseFallback(userId: string, query: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    return prisma.email.findMany({
      where: {
        userId,
        OR: [
          { recipient: { contains: cleanQuery, mode: 'insensitive' } },
          { subject: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });
  }
}
