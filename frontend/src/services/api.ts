import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to attach Bearer token if stored in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses for uniform error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('reachinbox_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
