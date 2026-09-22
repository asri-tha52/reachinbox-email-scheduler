import { WebClient } from '@slack/web-api';
import config from '../../config';
import redisClient from '../../config/redis';

export function generateSlackOAuthUrl(userId: string): string {
  const scopes = ['chat:write', 'chat:write.public', 'channels:read'];
  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    scope: scopes.join(','),
    redirect_uri: config.SLACK_REDIRECT_URI,
    state: userId,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface SlackOAuthResult {
  accessToken: string;
  teamId: string;
  channelId?: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResult> {
  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: config.SLACK_CLIENT_ID,
    client_secret: config.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: config.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token || !response.team) {
    throw new Error(`Slack OAuth failed: ${response.error || 'Unknown error'}`);
  }

  return {
    accessToken: response.access_token,
    teamId: typeof response.team === 'object' ? response.team.id! : (response.team as string),
    channelId: (response.incoming_webhook as any)?.channel_id,
  };
}

/**
 * Sends rate limit alert to Slack with atomic Redis deduplication per sender per hour
 */
export async function sendSlackRateLimitAlert(
  senderId: string,
  senderEmail: string,
  hourlyLimit: number,
  hourKey: string,
  accessToken: string,
  channel = config.SLACK_DEFAULT_CHANNEL
): Promise<boolean> {
  const deduplicationKey = `slack-rate-notified:${senderId}:${hourKey}`;

  // Atomic SET NX with 2-hour TTL to guarantee only ONE notification per hour window across all workers
  const acquired = await redisClient.set(deduplicationKey, '1', 'EX', 7200, 'NX');
  if (!acquired) {
    // Already notified for this sender in this hour window
    return false;
  }

  try {
    const client = new WebClient(accessToken);
    await client.chat.postMessage({
      channel,
      text: `⚠️ *ReachInbox Scheduler Alert*: Sender \`${senderEmail}\` reached the hourly limit of *${hourlyLimit} emails*. Remaining emails have been rescheduled to the next hour.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚡ ReachInbox Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${senderEmail}* has reached the limit of *${hourlyLimit} emails* for the current hour (\`${hourKey}\`).`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⏰ Excess queued emails have been automatically preserved and rescheduled to the next hourly window.',
            },
          ],
        },
      ],
    });
    console.log(`✅ Sent Slack rate limit notification for sender ${senderEmail} (${hourKey})`);
    return true;
  } catch (err: any) {
    console.warn(`⚠️ Failed to post Slack notification:`, err.message);
    return false;
  }
}
