import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('demo@reachinbox.ai');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check for error in query parameters (e.g. from Google OAuth callback)
  const queryParams = new URLSearchParams(location.search);
  const oauthError = queryParams.get('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await login(email, password);
      navigate('/dashboard/scheduled');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirects to real Google OAuth backend flow
    window.location.href = authService.getGoogleAuthUrl();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      {/* Centered Login Card */}
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-card p-8">
        {/* Brand / Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 text-white font-bold text-base mb-3 shadow-sm">
            ONB
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Login</h1>
          <p className="text-xs text-gray-500 mt-1">Sign in to your ReachInbox scheduler</p>
        </div>

        {/* Error notification */}
        {(errorMsg || oauthError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">
            {errorMsg || oauthError}
          </div>
        )}

        {/* Google OAuth Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 
            border border-gray-300 rounded-md text-xs font-medium text-gray-700 shadow-sm transition-colors mb-5"
        >
          {/* Google G SVG */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative flex py-2 items-center mb-5">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-3 text-gray-400 text-[11px] uppercase tracking-wider">or email</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isLoading}
          >
            Login
          </Button>
        </form>
      </div>

      <p className="text-center text-[11px] text-gray-400 mt-6">
        ReachInbox Candidate Assignment — Outbox Labs
      </p>
    </div>
  );
};
