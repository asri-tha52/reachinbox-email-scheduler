import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from backend root or workspace root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const configSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BACKEND_URL: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Database & Cache
  DATABASE_URL: z.string().default('postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // Authentication
  JWT_SECRET: z.string().default('reachinbox_jwt_super_secret_production_key_32_characters'),
  SESSION_SECRET: z.string().default('reachinbox_session_super_secret_production_key_32'),
  DEV_AUTH_BYPASS: z.string().transform((v) => v === 'true').default('false'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),
  SLACK_DEFAULT_CHANNEL: z.string().default('#general'),

  // SMTP / Ethereal
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASSWORD: z.string().optional().default(''),

  // Worker & Rates
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(100),
});

export type Config = z.infer<typeof configSchema>;

let parsedConfig: Config;

try {
  parsedConfig = configSchema.parse(process.env);
} catch (err: any) {
  console.warn('⚠️ Warning: Environment config validation issue, using defaults with warnings:', err.errors || err.message);
  parsedConfig = configSchema.parse({});
}

export const config = parsedConfig;
export default config;
