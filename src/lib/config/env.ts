import { z } from 'zod';

/**
 * Every environment variable the app touches, validated once at import
 * time. Adapters and route handlers import `env` from here rather than
 * reading `process.env` directly, so:
 *  - a missing/malformed var fails immediately and legibly at boot
 *  - there is exactly one place that knows the full configuration surface
 *  - TypeScript gives autocomplete + type safety on every var
 *
 * NOTE: required-ness is intentionally permissive (`.optional()`) for
 * provider credentials that only matter once that provider is selected
 * (e.g. HUBSPOT_API_KEY is irrelevant while CRM_PROVIDER=google_sheets).
 * Each adapter/service is responsible for asserting its own required vars
 * are present at the point it actually needs them — see
 * `assertRequired` below.
 */
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AI
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),

  // CRM
  CRM_PROVIDER: z
    .enum(['google_sheets', 'hubspot', 'gohighlevel', 'pipedrive', 'airtable'])
    .default('google_sheets'),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  HUBSPOT_API_KEY: z.string().optional(),
  GOHIGHLEVEL_API_KEY: z.string().optional(),
  PIPEDRIVE_API_KEY: z.string().optional(),
  AIRTABLE_API_KEY: z.string().optional(),
  AIRTABLE_BASE_ID: z.string().optional(),

  // Booking
  CALENDLY_API_TOKEN: z.string().optional(),
  CALENDLY_EVENT_TYPE_URI: z.string().optional(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_CALENDLY_BOOKING_URL: z.string().url(),

  // Email
  EMAIL_PROVIDER: z.enum(['gmail_smtp', 'resend', 'sendgrid']).default('gmail_smtp'),
  EMAIL_FROM: z.string().default('RelayOps <no-reply@yourdomain.com>'),
  FOUNDER_NOTIFICATION_EMAIL: z.string().email(),
  GMAIL_SMTP_USER: z.string().optional(),
  GMAIL_SMTP_APP_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),

  // Automation
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),

  // Future toggles
  ENABLE_SLACK_NOTIFICATIONS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ENABLE_WHATSAPP_NOTIFICATIONS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ENABLE_SMS_NOTIFICATIONS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration. Check .env.local against .env.example:\n${issues}`
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();

/**
 * Throws a clear configuration error naming exactly which var is missing
 * and which feature needs it. Call this at the top of a provider
 * implementation (e.g. the Google Sheets adapter, the Gemini client)
 * rather than letting `undefined` propagate into a third-party SDK call.
 */
export function assertRequired<K extends keyof Env>(
  keys: K[],
  context: string
): { [P in K]: NonNullable<Env[P]> } {
  const missing = keys.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) for ${context}: ${missing.join(', ')}. ` +
        `See .env.example.`
    );
  }
  return env as unknown as { [P in K]: NonNullable<Env[P]> };
}
