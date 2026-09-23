import api from './api';
import { User, ApiResponse } from '../types';

export const authService = {
  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch user profile');
    }
    return res.data.data;
  },

  async standardLogin(email: string, password = 'password123'): Promise<{ token: string; user: User }> {
    const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', {
      email,
      password,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Login failed');
    }
    localStorage.setItem('reachinbox_token', res.data.data.token);
    return res.data.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('reachinbox_token');
      window.location.href = '/login';
    }
  },

  getGoogleAuthUrl(): string {
    return `${import.meta.env.VITE_API_URL || '/api'}/auth/google`;
  },
};
