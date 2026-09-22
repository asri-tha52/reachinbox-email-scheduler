import { OAuth2Client } from 'google-auth-library';
import config from '../../config';

export function getGoogleOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_CALLBACK_URL
  );
}

export function generateGoogleAuthUrl(state?: string): string {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
    state,
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export async function verifyAndExtractGoogleProfile(code: string): Promise<GoogleProfile> {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('Google OAuth did not return an ID token');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Could not retrieve email from Google profile');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture || null,
  };
}
