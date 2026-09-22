export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  googleId?: string | null;
  senders?: Sender[];
  slackConnected?: boolean;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  name: string;
  hourlyLimit: number;
  enabled: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
}

export interface Email {
  id: string;
  userId: string;
  campaignId?: string | null;
  senderId: string;
  sender?: Sender;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  attempts: number;
  idempotencyKey: string;
  bullJobId?: string | null;
  error?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO String
  delayMs: number;
  hourlyLimit: number;
  senderId?: string;
}

export interface ScheduleResponse {
  campaignId: string;
  totalRequested: number;
  totalValid: number;
  totalScheduled: number;
  effectiveDelayMs: number;
  scheduledEmails: Array<{
    id: string;
    recipient: string;
    scheduledAt: string;
    bullJobId: string;
  }>;
  errors?: Array<{ recipient: string; error: string }>;
}

export interface SlackStatus {
  connected: boolean;
  teamId?: string | null;
  channelId?: string | null;
}

export interface SearchResponse {
  results: Email[];
  source?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
