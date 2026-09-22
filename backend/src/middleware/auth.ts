import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AuthenticatedRequest, AuthUser } from '../types';
import { sendError } from '../utils/response';
import { UserRepository } from '../repositories/userRepository';

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Check DEV_AUTH_BYPASS for local automated testing without live credentials
  if (config.DEV_AUTH_BYPASS) {
    let devUser = await UserRepository.findByEmail('demo@reachinbox.ai');
    if (!devUser) {
      devUser = await UserRepository.upsertGoogleUser({
        googleId: 'dev-google-mock-123',
        email: 'demo@reachinbox.ai',
        name: 'ReachInbox Demo User',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
      });
    }

    if (devUser) {
      req.user = {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        avatar: devUser.avatar,
      };
      return next();
    }
  }

  // 2. Extract token from header or cookie
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    sendError(res, 'UNAUTHORIZED', 'Authentication required to access this resource', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    req.user = decoded;
    return next();
  } catch (err: any) {
    sendError(res, 'INVALID_TOKEN', 'Session has expired or is invalid. Please log in again.', 401);
    return;
  }
}
