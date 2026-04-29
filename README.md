# ScheduleFlow

A full-stack scheduling and booking platform — think Calendly. Users create event types with availability rules, share a public booking page, and let guests pick open slots. Integrates with Google Calendar, Outlook, and Zoom; handles payments via Stripe.

---

## Features

- **Event types** — one-on-one, group events, round-robin, and poll-style scheduling
- **Availability rules** — recurring weekly schedule with per-date overrides and buffer times
- **Public booking page** — shareable URL with real-time slot availability
- **Calendar sync** — Google Calendar and Outlook read/write via OAuth
- **Video conferencing** — automatic Zoom link generation on confirmed bookings
- **Payments** — Stripe Checkout integration; optional paid event types
- **Email notifications** — booking confirmation and reminders via Resend
- **iCalendar** — `.ics` invite attached to all confirmation emails
- **Security** — SSRF guard on outbound webhooks, rate limits per route, NEXTAUTH_SECRET enforced at startup

---

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Auth:** NextAuth 5 (Google + Outlook OAuth, credentials)
- **Database:** PostgreSQL + Prisma 7
- **Payments:** Stripe
- **Email:** Resend + Nodemailer
- **UI:** Tailwind CSS 4, Shadcn/UI, React Hook Form, TanStack Query

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- PostgreSQL (Docker recommended)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in the values — see the table below

# 3. Start Postgres (optional — Docker)
docker compose up -d

# 4. Apply the database schema
pnpm prisma migrate dev

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | App base URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth | Google Calendar integration |
| `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` | OAuth | Outlook integration |
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | OAuth | Auto Zoom links |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | Paid event types |
| `RESEND_API_KEY` | Email | Booking confirmation emails |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL |

---

## Deploy

Deployable to any platform that supports Next.js (Vercel, Railway, Render, self-hosted).

Health and readiness probes are exposed at:
- `GET /api/health` — liveness (no DB touch)
- `GET /api/ready` — readiness (pings DB)

---

## License

MIT
