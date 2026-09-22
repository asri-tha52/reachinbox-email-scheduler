import { Response } from 'express';
import config from '../config';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { generateSlackOAuthUrl, exchangeSlackCode } from '../integrations/slack/service';
import { UserRepository } from '../repositories/userRepository';

export class SlackController {
  static connect(req: AuthenticatedRequest, res: Response): void {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    try {
      const url = generateSlackOAuthUrl(req.user.id);
      res.redirect(url);
    } catch (err: any) {
      sendError(res, 'SLACK_ERROR', `Failed to generate Slack authorization URL: ${err.message}`, 500);
    }
  }

  static async callback(req: AuthenticatedRequest, res: Response): Promise<void> {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error_missing_params`);
      return;
    }

    try {
      const result = await exchangeSlackCode(code);
      await UserRepository.upsertSlackConnection({
        userId,
        accessToken: result.accessToken,
        teamId: result.teamId,
        channelId: result.channelId,
      });

      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err: any) {
      console.error('Slack OAuth exchange error:', err);
      res.redirect(`${config.FRONTEND_URL}/dashboard?slack=error_${encodeURIComponent(err.message)}`);
    }
  }

  static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const connection = await UserRepository.getSlackConnection(req.user.id);
    sendSuccess(res, {
      connected: connection ? connection.connected : false,
      teamId: connection?.teamId || null,
      channelId: connection?.channelId || null,
    });
  }

  static async disconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    await UserRepository.disconnectSlack(req.user.id);
    sendSuccess(res, { message: 'Slack disconnected successfully' });
  }
}
