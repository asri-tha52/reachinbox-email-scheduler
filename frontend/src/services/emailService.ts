import api from './api';
import { Email, ScheduleRequest, ScheduleResponse, ApiResponse } from '../types';

export const emailService = {
  async schedule(data: ScheduleRequest): Promise<ScheduleResponse> {
    const res = await api.post<ApiResponse<ScheduleResponse>>('/emails/schedule', data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to schedule emails');
    }
    return res.data.data;
  },

  async getScheduled(page = 1, limit = 50): Promise<Email[]> {
    const res = await api.get<ApiResponse<{ emails: Email[] }>>('/emails/scheduled', {
      params: { page, limit },
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch scheduled emails');
    }
    return res.data.data.emails;
  },

  async getSent(page = 1, limit = 50): Promise<Email[]> {
    const res = await api.get<ApiResponse<{ emails: Email[] }>>('/emails/sent', {
      params: { page, limit },
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch sent emails');
    }
    return res.data.data.emails;
  },

  async getById(id: string): Promise<Email> {
    const res = await api.get<ApiResponse<Email>>(`/emails/${id}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch email details');
    }
    return res.data.data;
  },

  async search(query: string): Promise<{ results: Email[]; source?: string }> {
    const res = await api.get<ApiResponse<{ results: Email[]; source?: string }>>('/emails/search', {
      params: { q: query },
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Search request failed');
    }
    return res.data.data;
  },
};
