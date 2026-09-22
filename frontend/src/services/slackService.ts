import api from './api';
import { SlackStatus, ApiResponse } from '../types';

export const slackService = {
  async getStatus(): Promise<SlackStatus> {
    const res = await api.get<ApiResponse<SlackStatus>>('/slack/status');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch Slack status');
    }
    return res.data.data;
  },

  getConnectUrl(): string {
    return '/api/slack/connect';
  },

  async disconnect(): Promise<void> {
    const res = await api.post<ApiResponse<{ message: string }>>('/slack/disconnect');
    if (!res.data.success) {
      throw new Error(res.data.error?.message || 'Failed to disconnect Slack');
    }
  },
};
