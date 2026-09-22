import { Request } from 'express';

export type ApiResponse<T = any> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: any;
      };
    };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface EmailJobData {
  emailId: string;
  senderId: string;
  userId: string;
  campaignId?: string;
  attemptCount?: number;
}

export interface ScheduleEmailInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO date string
  delayMs?: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface SearchEmailItem {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  senderId: string;
  campaignId?: string | null;
  userId: string;
}
