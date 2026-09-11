# ScheduleFlow

A self-hosted scheduling app in the style of Calendly. You define event types and
your weekly availability, share a booking link, and people pick a free slot. Bookings
can sync to Google Calendar or Outlook, get a Zoom link attached, and optionally be
paid for through Stripe Checkout.

Built with Next.js 16 (App Router), React 19, TypeScript, Prisma 7 on PostgreSQL,
NextAuth 5, Tailwind 4 and shadcn/ui.

## What it does

Scheduling
- Event types with duration, buffers before and after, minimum notice, booking window,
  daily caps, custom questions, and an optional confirmation step.
- Weekly availability plus per-date overrides. Slot generation is timezone aware
  (date-fns-tz) and checks existing bookings and connected calendars for conflicts.
- Group events (several attendees on one slot), polls where invitees vote on times,
  routing forms that send people to the right event type, and a waitlist that fills
  cancelled slots.
- Public booking pages at `/{username}` and `/{username}/{event}`, an embeddable
  widget (`/embed/...` plus `public/embed.js`), and reschedule and cancel links.

Integrations
- Google Calendar and Outlook: OAuth connect, read busy times, write and delete events.
- Zoom: creates a meeting on confirmation and removes it on cancel.
- Stripe Checkout for paid event types, with a webhook that marks bookings paid and
  handles refunds. Events are de-duplicated by Stripe event id.
- Outgoing webhooks to your own endpoints on booking events.

Email
- Confirmation, cancellation and reschedule emails over SMTP via nodemailer, with an
  `.ics` invite attached. Points at a local Mailpit or MailHog on port 1025 by default.

Accounts and teams
- Sign in with email and password, Google, or GitHub.
- Teams with owner, admin and member roles and shared event types.
- Dashboard with bookings, availability, integrations, analytics, billing and settings.

Hardening that is in place: `NEXTAUTH_SECRET` is required at startup, per-route rate
limits, an SSRF guard on outbound webhook URLs, ownership checks on booking reads and
cancels, idempotent booking creation with race-safe conflict detection, and standard
security headers from `next.config.ts`.

## Running it locally

You need Node 20 or newer, npm, and Docker (or any PostgreSQL 16).

```bash
npm install
cp .env.example .env        # then set NEXTAUTH_SECRET, see below
docker compose up -d        # PostgreSQL on localhost:5434
npx prisma migrate dev      # applies migrations and generates the client
npm run dev
```

Open http://localhost:3000, sign up, and finish onboarding to get a username and a
booking page.

`npm run build` needs the generated Prisma client, so run `npx prisma generate`
first on a fresh checkout or in CI.

## Environment variables

The app refuses to start without `NEXTAUTH_SECRET`. Generate one with
`openssl rand -base64 32`.

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The compose file listens on port 5434. |
| `NEXTAUTH_SECRET` | Session signing. Required. `AUTH_SECRET` is accepted as an alias. |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | Base URL of the app, used in links and OAuth callbacks. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in and Google Calendar. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub sign-in. |
| `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET` | Outlook calendar. |
| `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Zoom meetings. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid event types. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Outgoing mail. Defaults to localhost:1025 with no auth. |

Everything except the database, secret and URLs is optional. Features whose keys are
missing just stay disconnected.

## Deploying

Works anywhere Next.js runs. `GET /api/health` returns 200 when the process is up and
Postgres answers `SELECT 1`, and 503 otherwise, so it serves as both liveness and
readiness probe.

Things to know before running more than one instance:

- The rate limiter is in-memory, so each replica keeps its own counters. Swap in a
  Redis-backed limiter for horizontal scaling.
- Reminder emails (`sendBookingReminder`) exist in `src/lib/email.ts` but nothing
  schedules them yet. Wire a cron job if you want reminders.
- There is no Content-Security-Policy header yet.

## Layout

```
prisma/           schema and migrations
src/app/          routes: (auth), dashboard, public booking pages, api/
src/components/   booking flow, dashboard shell, shadcn/ui primitives
src/lib/          auth, db, slots, email, ics, stripe, rate-limit, ssrf-guard,
                  webhooks, waitlist, integrations/{google,outlook,zoom}
public/embed.js   drop-in script for the embeddable booking widget
```
