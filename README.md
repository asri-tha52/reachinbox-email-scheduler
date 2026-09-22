# ReachInbox / Outbox Labs — Distributed Email Scheduling Platform

A production-grade, distributed email scheduling platform built with **Node.js, Express, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, Ethereal SMTP, Elasticsearch, and React**.

Designed for high reliability, restart persistence, distributed hourly rate limiting, strict idempotency, multi-worker safety, and load handling of 1,000+ simultaneous delayed jobs.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Folder Structure](#5-folder-structure)
6. [Docker Setup](#6-docker-setup)
7. [PostgreSQL Setup](#7-postgresql-setup)
8. [Redis Setup](#8-redis-setup)
9. [Elasticsearch Setup](#9-elasticsearch-setup)
10. [Environment Variables](#10-environment-variables)
11. [Google OAuth 2.0 Setup](#11-google-oauth-20-setup)
12. [Slack OAuth & Rate Limit Alert Setup](#12-slack-oauth--rate-limit-alert-setup)
13. [Ethereal SMTP Setup](#13-ethereal-smtp-setup)
14. [Backend Setup & Execution](#14-backend-setup--execution)
15. [Frontend Setup & Execution](#15-frontend-setup--execution)
16. [Database Migrations & Prisma Schema](#16-database-migrations--prisma-schema)
17. [Worker Architecture & Execution](#17-worker-architecture--execution)
18. [Bull Board Queue Dashboard](#18-bull-board-queue-dashboard)
19. [API Documentation](#19-api-documentation)
20. [Scheduling Architecture](#20-scheduling-architecture)
21. [Restart Persistence Guarantee](#21-restart-persistence-guarantee)
22. [Idempotency Strategy](#22-idempotency-strategy)
23. [Distributed Hourly Rate Limiting](#23-distributed-hourly-rate-limiting)
24. [Worker Concurrency](#24-worker-concurrency)
25. [Minimum Email Delay](#25-minimum-email-delay)
26. [1,000+ Email Load Handling](#26-1000-email-load-handling)
27. [Architectural Assumptions](#27-architectural-assumptions)
28. [Engineering Trade-offs](#28-engineering-trade-offs)
29. [Automated Testing & Verification](#29-automated-testing--verification)
30. [End-to-End Demo Instructions](#30-end-to-end-demo-instructions)

---

## 1. Project Overview

ReachInbox Email Scheduler is built to address cold email outreach scheduling challenges: sending thousands of targeted emails over precise time windows while respecting strict per-sender hourly limits, preventing spam penalties through staggered minimum delays, surviving sudden process failures without duplicates, and notifying outreach managers via Slack when sending throttles are hit.

---

## 2. Features

- **BullMQ Delayed Scheduling**: Native Redis-backed delayed jobs (`scheduledAt - now`). No fragile cron or in-memory timers.
- **Strict Idempotency**: SHA-256 unique `idempotencyKey` + database atomic status guards ensure no email is ever sent twice across retries or restarts.
- **Distributed Hourly Rate Limiting**: Per-sender atomic Redis counters (`email-rate:{senderId}:{YYYY-MM-DD-HH}`) prevent quota breaches.
- **Automatic Job Rescheduling**: When hourly limits are reached, excess jobs are rescheduled to the top of the next hour window rather than dropped.
- **Slack Alerting with Atomic Hourly Deduplication**: Alerts managers via Slack once per hour window using Redis `SET NX` locks.
- **Live Ethereal SMTP**: Nodemailer transporter generating test email preview links.
- **Full-Text Search with Elasticsearch**: Fast multi-match search over recipients, subjects, and statuses with resilient PostgreSQL fallback.
- **Bull Board Dashboard**: Real-time queue metrics exposed at `/admin/queues`.
- **Figma-Aligned Modern Frontend**: Clean white interface, emerald accent color, CSV/TXT drag-and-drop parsing, chip recipient displays, and rich WYSIWYG editor.

---

## 3. Architecture

```
[React + Vite Frontend (Figma Style)]
       │ (REST APIs + Bearer / Cookie Auth)
       ▼
[Express + TypeScript Backend]
  ├── /api/auth (Google OAuth 2.0 / Local Session)
  ├── /api/emails (Schedule, List Scheduled, List Sent, Get Details, Search)
  ├── /api/slack (OAuth Connect, Status, Disconnect)
  ├── /admin/queues (Bull Board UI)
  │
  ├── PostgreSQL (via Prisma ORM) — Single Source of Truth
  │     ├── User, Sender, Campaign, Email, SlackConnection
  │
  ├── Redis
  │     ├── BullMQ Queues (Email delayed jobs)
  │     ├── Distributed Hourly Rate Limiter (atomic keys)
  │     └── Slack Notification Deduplication (hourly locks)
  │
  └── BullMQ Worker
        ├── Idempotency Guard (skip if already marked sent)
        ├── Minimum Delay Enforcement (MIN_EMAIL_DELAY_MS)
        ├── Distributed Hourly Rate Limit Check
        │     └── If limit reached: calculate next hour, reschedule job, trigger Slack alert
        ├── Nodemailer SMTP (Ethereal Email)
        ├── Update PostgreSQL (status: sent / failed, sentAt, attempts, previewUrl)
        └── Elasticsearch Email Indexing (resilient: try/catch without crashing worker)
```

---

## 4. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router DOM, Axios
- **Backend**: Node.js 20+, TypeScript 5+, Express.js 4
- **Database & ORM**: PostgreSQL 16, Prisma ORM 5
- **Queue & Distributed Cache**: Redis 7, BullMQ 5, ioredis
- **Queue Metrics**: `@bull-board/express`, `@bull-board/api`
- **Email Delivery**: Nodemailer, Ethereal SMTP
- **Search Engine**: Elasticsearch 8.11+
- **Authentication**: Google OAuth 2.0 (`google-auth-library`), JWT, HTTP-only cookies
- **Integrations**: Slack Web API (`@slack/web-api`)
- **Validation**: Zod
- **Infrastructure**: Docker Compose with health checks and persistent volumes

---

## 5. Folder Structure

```
reachinbox-email-scheduler/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/               # Zod environment config, Prisma & Redis singletons
│   │   ├── controllers/          # Request handlers (auth, email, slack, health)
│   │   ├── routes/               # Express route definitions
│   │   ├── services/             # Core business logic (EmailService, RateLimiter)
│   │   ├── repositories/         # Prisma query abstraction layer
│   │   ├── middleware/           # JWT auth guard, centralized error handling
│   │   ├── queues/               # BullMQ queue definition & Bull Board
│   │   ├── workers/              # BullMQ concurrency worker & standalone script
│   │   ├── integrations/
│   │   │   ├── google/           # Google OAuth 2.0 verification
│   │   │   ├── slack/            # Slack OAuth & rate limit alerting
│   │   │   ├── ethereal/         # Nodemailer Ethereal SMTP transporter
│   │   │   └── elasticsearch/    # ES client, index mapping, search & fallback
│   │   ├── utils/                # Standard responses, email validator, CSV parser
│   │   ├── types/                # TypeScript interfaces
│   │   ├── app.ts                # Express application configuration
│   │   ├── server.ts             # Main backend server entry point
│   │   └── __tests__/            # Vitest unit & integration test suites
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ui/               # Button, Input, Badge, Spinner, EmptyState
    │   │   ├── layout/           # Header, Sidebar, AppShell
    │   │   ├── compose/          # RecipientUpload, EmailEditor, ScheduleControls
    │   │   └── emails/           # EmailRow, EmailList
    │   ├── context/              # AuthContext & token management
    │   ├── pages/                # LoginPage, ScheduledEmailsPage, SentEmailsPage, etc.
    │   ├── services/             # Axios API services (auth, email, slack)
    │   ├── types/                # Frontend TypeScript models
    │   ├── App.tsx               # Client router
    │   ├── main.tsx              # React DOM mounting
    │   └── index.css             # Tailwind base & custom styles
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 6. Docker Setup

To launch the entire infrastructure stack (PostgreSQL, Redis, Elasticsearch):

```bash
docker-compose up -d
```

Check health status:
```bash
docker-compose ps
```

All services use persistent Docker volumes (`pgdata`, `redisdata`, `esdata`) ensuring data survives container restarts.

---

## 7. PostgreSQL Setup

When running outside Docker, ensure PostgreSQL is running locally on port `5432` with a database named `reachinbox_db`.
Set `DATABASE_URL` in `backend/.env`:
```env
DATABASE_URL="postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public"
```

Apply Prisma migrations:
```bash
cd backend
npx prisma db push
```

---

## 8. Redis Setup

Redis is required for BullMQ delayed queues, distributed rate limiting, and Slack alert deduplication locks.
Ensure Redis is running with AOF (append-only file) enabled:
```bash
redis-server --appendonly yes
```
Configured in `backend/.env`:
```env
REDIS_URL="redis://localhost:6379"
```

---

## 9. Elasticsearch Setup

Elasticsearch provides fast multi-field search across `recipient`, `subject`, and `status`.
Start Elasticsearch on port `9200`. The backend automatically initializes the `reachinbox-emails` index on startup. If Elasticsearch is temporarily unreachable, the system gracefully falls back to PostgreSQL `ILIKE` queries without crashing.

---

## 10. Environment Variables

Create `.env` in both `backend/` and root:
```env
PORT=5000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox_db?schema=public"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_URL="http://localhost:9200"

GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/callback"
SLACK_DEFAULT_CHANNEL="#general"

SESSION_SECRET="reachinbox_session_secret_change_in_production_32_chars"
JWT_SECRET="reachinbox_jwt_secret_change_in_production_32_chars"

ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587
ETHEREAL_USER=""
ETHEREAL_PASSWORD=""

WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100

NODE_ENV=development
DEV_AUTH_BYPASS=false
```

---

## 11. Google OAuth 2.0 Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create an OAuth 2.0 Client ID for a Web Application.
3. Add Authorized Redirect URI: `http://localhost:5000/api/auth/google/callback`.
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env`.
5. On the frontend, clicking **Continue with Google** initiates the OAuth flow. Upon successful callback, a JWT session is issued, user details (name, email, avatar) are stored in PostgreSQL, and the user is redirected to the dashboard.

---

## 12. Slack OAuth & Rate Limit Alert Setup

1. Create a Slack App at [api.slack.com/apps](https://api.slack.com/apps).
2. Under OAuth & Permissions, add redirect URL: `http://localhost:5000/api/slack/callback`.
3. Add Bot Scopes: `chat:write`, `chat:write.public`, `channels:read`.
4. Set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` in `.env`.
5. Clicking **Connect Slack** in the app header initiates authorization. When any sender hits the hourly rate limit, a Slack block alert is dispatched to the team channel with exact sender and limit details.

---

## 13. Ethereal SMTP Setup

The application uses Ethereal Email (a fake SMTP service by Nodemailer).
- If `ETHEREAL_USER` and `ETHEREAL_PASSWORD` are left blank, the backend automatically generates a disposable test account via `nodemailer.createTestAccount()`.
- Every sent email generates an Ethereal preview link visible in the Sent Emails table and the Email Detail view.

---

## 14. Backend Setup & Execution

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

To run the BullMQ worker as a separate dedicated process:
```bash
npm run worker
```

---

## 15. Frontend Setup & Execution

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 16. Database Migrations & Prisma Schema

Prisma manages our PostgreSQL schema:
- `User`: Accounts, Google ID, email, name, avatar.
- `Sender`: Multiple email identities per user, each with its own `hourlyLimit`.
- `Campaign`: Batch metadata, base start time, delay, and hourly limit.
- `Email`: Recipient, subject, body, status (`scheduled`, `processing`, `sent`, `failed`), scheduled time, sent time, attempts, preview URL, and unique `idempotencyKey`.
- `SlackConnection`: User's OAuth token and team settings.

Commands:
```bash
npx prisma db push      # Push schema changes to database
npx prisma studio       # Open visual database browser
```

---

## 17. Worker Architecture & Execution

The BullMQ worker runs with configurable concurrency (`WORKER_CONCURRENCY`, default 5):
1. **Pulls Job**: BullMQ delivers job when `delay` elapses.
2. **Idempotency Guard**: Checks if database record status is already `sent`. If so, skips execution immediately.
3. **Rate Limit Evaluation**: Runs atomic Lua script against Redis counter `email-rate:{senderId}:{YYYY-MM-DD-HH}`.
4. **Rescheduling Throttled Jobs**: If limit is reached, calculates the start of next hour in UTC, re-queues the job into BullMQ, updates database timestamp, and dispatches a deduplicated Slack notification.
5. **Smoothing Delay**: Enforces `MIN_EMAIL_DELAY_MS`.
6. **Delivery**: Dispatches via Ethereal SMTP.
7. **Persistence**: Updates status to `sent`, records `sentAt` and `previewUrl`, and indexes document into Elasticsearch.

---

## 18. Bull Board Queue Dashboard

Bull Board is mounted at:
[http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)

Inspect:
- **Delayed**: Emails queued for future dispatch.
- **Active**: Currently executing sends across worker threads.
- **Completed**: Successfully delivered emails.
- **Failed**: Emails with delivery exceptions and retry attempts.

---

## 19. API Documentation

### Health Check
- `GET /api/health`: Returns health status of API, PostgreSQL, Redis, and Elasticsearch.

### Authentication
- `GET /api/auth/me`: Current user session and connected senders.
- `GET /api/auth/google`: Initiates Google OAuth redirect.
- `GET /api/auth/google/callback`: OAuth callback handler.
- `POST /api/auth/login`: Standard credentials login for Figma login screen.
- `POST /api/auth/logout`: Clears authentication session.

### Email Scheduling
- `POST /api/emails/schedule`: Schedule batch or single email.
  ```json
  {
    "subject": "Quarterly Update",
    "body": "<p>Hello team...</p>",
    "recipients": ["alice@reachinbox.ai", "bob@reachinbox.ai"],
    "startTime": "2026-09-22T19:00:00.000Z",
    "delayMs": 2000,
    "hourlyLimit": 100
  }
  ```
- `GET /api/emails/scheduled`: Lists user's scheduled/processing emails.
- `GET /api/emails/sent`: Lists user's sent/failed emails.
- `GET /api/emails/:id`: Complete email details and delivery telemetry.
- `GET /api/emails/search?q=query`: Full-text search across recipients, subjects, and statuses.

### Slack Integration
- `GET /api/slack/connect`: Initiates Slack OAuth.
- `GET /api/slack/callback`: Handles authorization callback.
- `GET /api/slack/status`: Returns connection status.
- `POST /api/slack/disconnect`: Disconnects team integration.

---

## 20. Scheduling Architecture

Scheduling uses BullMQ delayed jobs backed by Redis sorted sets (`zset`).
- When a batch of $N$ recipients is submitted with start time $T_0$ and delay $D$ (where $D \ge \text{MIN\_EMAIL\_DELAY\_MS}$):
  - Recipient 0: Scheduled for $T_0$ (delay: $\max(0, T_0 - \text{now})$)
  - Recipient 1: Scheduled for $T_0 + 1 \times D$
  - Recipient 2: Scheduled for $T_0 + 2 \times D$
  - Recipient $i$: Scheduled for $T_0 + i \times D$
- Each job is stored with a unique BullMQ job ID and tracked in PostgreSQL.

---

## 21. Restart Persistence Guarantee

To verify restart persistence:
1. Schedule 10 emails with start time 5 minutes in the future.
2. Stop the backend process (`Ctrl+C`).
3. Keep Redis and PostgreSQL running (via Docker or local services).
4. Restart the backend:
   ```bash
   npm run dev
   ```
5. **Result**: BullMQ retains delayed jobs in Redis. When the scheduled timestamp arrives, the worker wakes up and sends all emails on schedule without losing any state or creating duplicate jobs.

---

## 22. Idempotency Strategy

- Every email record has a cryptographic `idempotencyKey` with a unique constraint in PostgreSQL.
- Before sending, the worker inspects `email.status === 'sent'`. If true, the worker aborts immediately and marks the job complete without invoking SMTP.
- Survives worker crashes, retries, and multiple parallel worker processes.

---

## 23. Distributed Hourly Rate Limiting

- Key Pattern: `email-rate:{senderId}:{YYYY-MM-DD-HH}` (in UTC).
- Atomic Lua Script:
  ```lua
  local current = tonumber(redis.call('get', KEYS[1]) or "0")
  if current < tonumber(ARGV[1]) then
    local next_val = redis.call('incr', KEYS[1])
    if next_val == 1 then redis.call('expire', KEYS[1], 7200) end
    return {1, next_val}
  else
    return {0, current}
  end
  ```
- **Rescheduling**: When throttled, remaining delay until the next UTC hour window is computed:
  ```ts
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const delayMs = nextHour.getTime() - now.getTime();
  ```
  The job is re-added to BullMQ with `delay: delayMs`, preserving the email in the queue without loss.

---

## 24. Worker Concurrency

Configured via `WORKER_CONCURRENCY` in `.env` (default 5).
BullMQ distributes active jobs across worker threads. Concurrency can be scaled horizontally across multiple servers pointing to the same Redis instance without race conditions due to atomic Lua rate limiting.

---

## 25. Minimum Email Delay

Configured via `MIN_EMAIL_DELAY_MS` (default 2000 ms).
Enforced at both the scheduling layer (staggering scheduled timestamps) and the worker layer (execution smoothing).

---

## 26. 1,000+ Email Load Handling

For 1,000+ recipients scheduled at once:
- The API does **not** send emails synchronously; it validates recipients, creates database rows, and queues BullMQ delayed jobs in batch.
- Jobs enter Redis sorted sets with staggered delays.
- Worker threads process jobs concurrently up to `WORKER_CONCURRENCY`.
- If an hourly limit is exceeded, excess jobs are rescheduled to the subsequent hour window.

---

## 27. Architectural Assumptions

- Time calculations are evaluated in UTC to eliminate daylight-savings and timezone anomalies across distributed nodes.
- Ethereal SMTP is used for candidate demo purposes; in production, Nodemailer can be configured with Amazon SES, SendGrid, or Google Workspace SMTP via environment variables.

---

## 28. Engineering Trade-offs

- **Delayed Jobs vs Redis Streams**: BullMQ delayed jobs were chosen because Redis sorted sets provide native timing triggers without requiring active polling loops.
- **PostgreSQL Source of Truth vs Redis Only**: Keeping PostgreSQL as the authoritative state guarantees auditability, durable reporting, and relational constraints even if Redis cache is flushed.

---

## 29. Automated Testing & Verification

Run backend unit tests:
```bash
cd backend
npx vitest run
```

Run TypeScript compilation checks:
```bash
cd backend && npx tsc --noEmit
cd frontend && npm run build
```

---

## 30. End-to-End Demo Instructions

1. Start services:
   ```bash
   docker-compose up -d
   ```
2. Start backend:
   ```bash
   cd backend && npm run dev
   ```
3. Start frontend:
   ```bash
   cd frontend && npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173).
5. Log in using Google OAuth or test credentials (`demo@reachinbox.ai` / `password123`).
6. Click **Compose** from the sidebar.
7. Upload a `.csv` or `.txt` recipient list or type test emails. Notice the parsed chips and `+N` badge.
8. Customize the subject, rich email body, delay, and hourly limit.
9. Click **Send Later**. The emails will appear under **Scheduled**.
10. As the schedule elapses, open **Sent Emails** to view the delivered emails and click **Preview** to inspect the live Ethereal test message!
11. View real-time queue states at [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues).
