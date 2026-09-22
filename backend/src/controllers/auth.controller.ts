import { Request, Response } from 'express';
import { z } from 'zod';
import config from '../config';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { generateGoogleAuthUrl, verifyAndExtractGoogleProfile } from '../integrations/google/oauth';
import { UserRepository } from '../repositories/userRepository';
import { generateToken } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
      return;
    }

    const user = await UserRepository.findById(req.user.id);
    if (!user) {
      sendError(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      googleId: user.googleId,
      senders: user.senders,
      slackConnected: user.slackConnection ? user.slackConnection.connected : false,
    });
  }

  static initiateGoogleAuth(req: Request, res: Response): void {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      // If credentials are not yet configured in .env, provide an informative redirect/error
      console.warn('⚠️ Google Client ID or Secret missing in .env');
    }

    try {
      const authUrl = generateGoogleAuthUrl();
      res.redirect(authUrl);
    } catch (err: any) {
      sendError(res, 'OAUTH_CONFIG_ERROR', `Google OAuth initialization failed: ${err.message}`, 500);
    }
  }

  static async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      res.redirect(`${config.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.redirect(`${config.FRONTEND_URL}/login?error=no_code_provided`);
      return;
    }

    try {
      const googleProfile = await verifyAndExtractGoogleProfile(code);
      const user = await UserRepository.upsertGoogleUser({
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      });

      const token = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      });

      // Set secure HTTP-only cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend dashboard with token parameter for client storage
      res.redirect(`${config.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (err: any) {
      console.error('Google OAuth callback error:', err);
      res.redirect(`${config.FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  static async standardLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = loginSchema.parse(req.body);

    let user = await UserRepository.findByEmail(email);
    if (!user) {
      // Create user profile for Figma UI email/password login
      user = await UserRepository.upsertGoogleUser({
        googleId: `local-${Date.now()}`,
        email,
        name: email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      });
    }

    if (!user) {
      sendError(res, 'AUTH_FAILED', 'Could not authenticate user', 500);
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    res.cookie('jwt', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  }

  static logout(req: Request, res: Response): void {
    res.clearCookie('jwt');
    sendSuccess(res, { message: 'Logged out successfully' });
  }
}
