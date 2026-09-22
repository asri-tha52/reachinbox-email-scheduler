import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { EmailService } from '../services/emailService';
import { EmailRepository } from '../repositories/emailRepository';
import { searchEmailsIndex } from '../integrations/elasticsearch/client';

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'startTime must be a valid ISO date string',
  }),
  delayMs: z.coerce.number().optional().default(2000),
  hourlyLimit: z.coerce.number().optional().default(100),
  senderId: z.string().optional(),
});

export class EmailController {
  static async schedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const validated = scheduleSchema.parse(req.body);
    const result = await EmailService.scheduleEmails(req.user.id, validated);

    sendSuccess(res, result, 201);
  }

  static async getScheduled(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const emails = await EmailRepository.findScheduledByUserId(req.user.id, skip, limit);
    sendSuccess(res, { emails, page, limit });
  }

  static async getSent(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const emails = await EmailRepository.findSentByUserId(req.user.id, skip, limit);
    sendSuccess(res, { emails, page, limit });
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const emailId = req.params.id;
    const email = await EmailRepository.findByIdForUser(emailId, req.user.id);

    if (!email) {
      sendError(res, 'NOT_FOUND', 'Email not found or access denied', 404);
      return;
    }

    sendSuccess(res, email);
  }

  static async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      sendSuccess(res, { results: [] });
      return;
    }

    // 1. Try Elasticsearch primary search
    const esResults = await searchEmailsIndex(query, req.user.id);
    if (esResults !== null) {
      sendSuccess(res, { results: esResults, source: 'elasticsearch' });
      return;
    }

    // 2. Resilient fallback to PostgreSQL
    const dbResults = await EmailRepository.searchDatabaseFallback(req.user.id, query);
    sendSuccess(res, { results: dbResults, source: 'postgresql_fallback' });
  }
}
