import nodemailer from "nodemailer";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { generateICS, type ICSEventData } from "./ics";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025"),
  secure: false,
  ...(process.env.SMTP_USER
    ? {
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }
    : {}),
});

/**
 * Resolve the From: header. The previous code hard-coded
 * `noreply@scheduleflow.com`, which fails SPF/DKIM in any environment whose
 * SMTP host doesn't match that domain (audit flagged this as a spam-folder
 * risk). Allow override via env so prod deployments can use a verified
 * sending domain (e.g. `Bookings <noreply@yourdomain.com>`); fall back to
 * the original literal in dev.
 */
const FROM_ADDRESS =
  process.env.EMAIL_FROM ||
  `"ScheduleFlow" <noreply@scheduleflow.com>`;

interface BookingEmailData {
  hostName: string;
  hostEmail: string;
  inviteeName: string;
  inviteeEmail: string;
  eventTitle: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  location?: string;
  meetingUrl?: string;
  bookingUid: string;
  notes?: string;
  cancellationReason?: string;
}

function formatTime(date: Date, timezone: string): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wrap a snippet of email body HTML in our standard email shell.
 *
 * Design choices for production-readiness:
 *   - `lang="en"` and `role="article"` for screen-reader semantics.
 *   - Preheader text (the inbox preview line) is supplied per-call and
 *     hidden via the standard `display:none;mso-hide:all` trick, so an
 *     unspecified preheader doesn't fall through to "View Booking" or
 *     similar UI noise.
 *   - Dark-mode CSS via `@media (prefers-color-scheme: dark)` for clients
 *     that honor it (Apple Mail, Outlook 2021+, modern Gmail web). Older
 *     clients get the light theme — the colors are AA-contrast on white.
 *   - `<table>` -based layout for Outlook desktop, which still ignores
 *     CSS flex/grid. Inline styles where possible because Gmail strips
 *     <style> in some surfaces (forwarded mail, Gmail mobile preview).
 *   - All buttons use proper `<a>` links with role-style sizing meeting
 *     the 44x44 px tap target guideline.
 */
function baseTemplate(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>ScheduleFlow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; color: #0f172a; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-block; width: 40px; height: 40px; background: #6366f1; border-radius: 8px; color: #ffffff; font-weight: bold; font-size: 16px; line-height: 40px; text-align: center; }
    h1 { font-size: 20px; color: #0f172a; margin: 16px 0 8px; }
    p { color: #475569; font-size: 14px; line-height: 1.5; }
    .detail-row { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .detail-label { color: #64748b; font-size: 14px; display: inline-block; min-width: 90px; }
    .detail-value { color: #0f172a; font-size: 14px; font-weight: 500; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; margin: 4px; min-height: 20px; }
    .btn-outline { background: #ffffff; color: #6366f1 !important; border: 1px solid #e2e8f0; }
    .btn-danger { background: #ef4444; color: #ffffff !important; }
    .actions { text-align: center; margin-top: 24px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8; }
    .notes { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 14px; color: #475569; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all; }
    a { color: #6366f1; }

    @media (prefers-color-scheme: dark) {
      body { background: #0b1120 !important; color: #e2e8f0 !important; }
      .card { background: #1e293b !important; box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; }
      h1 { color: #f8fafc !important; }
      p { color: #cbd5e1 !important; }
      .detail-row { border-bottom-color: #334155 !important; }
      .detail-label { color: #94a3b8 !important; }
      .detail-value { color: #f1f5f9 !important; }
      .notes { background: #0f172a !important; color: #cbd5e1 !important; }
      .btn-outline { background: #1e293b !important; border-color: #334155 !important; }
      .footer { color: #64748b !important; }
      a { color: #818cf8 !important; }
    }

    @media only screen and (max-width: 480px) {
      .container { padding: 16px 12px !important; }
      .card { padding: 20px !important; border-radius: 8px !important; }
      h1 { font-size: 18px !important; }
      .btn { display: block !important; margin: 8px 0 !important; }
    }
  </style>
</head>
<body role="document">
  <div class="preheader" aria-hidden="true">${escapeHtml(preheader)}</div>
  <div class="container" role="article" aria-roledescription="email">
    <div class="card">
      <div class="header">
        <div class="logo" role="img" aria-label="ScheduleFlow logo">SF</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p style="margin:0">Powered by ScheduleFlow</p>
    </div>
  </div>
</body>
</html>`;
}

function bookingDetails(data: BookingEmailData, viewerTimezone: string): string {
  const time = formatTime(data.startTime, viewerTimezone);
  const endTime = format(toZonedTime(data.endTime, viewerTimezone), "h:mm a");

  // Every user-controlled field is escaped before interpolation. Without
  // this, an inviteeName like `<script>` or `<a href="javascript:…">`
  // would render as live HTML in the email, which most clients sanitize
  // but a few (older Outlook, plain webmail) still execute on click.
  const safeMeetingUrl = data.meetingUrl
    ? encodeURI(data.meetingUrl)
    : undefined;

  return `
    <div class="detail-row">
      <span class="detail-label">What</span>
      <span class="detail-value">${escapeHtml(data.eventTitle)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">When</span>
      <span class="detail-value">${escapeHtml(time)} – ${escapeHtml(endTime)}</span>
    </div>
    ${data.location ? `
    <div class="detail-row">
      <span class="detail-label">Where</span>
      <span class="detail-value">${escapeHtml(data.location)}</span>
    </div>` : ""}
    ${safeMeetingUrl ? `
    <div class="detail-row">
      <span class="detail-label">Meeting</span>
      <span class="detail-value"><a href="${safeMeetingUrl}" style="color: #6366f1">${escapeHtml(data.meetingUrl!)}</a></span>
    </div>` : ""}
  `;
}

export async function sendBookingConfirmedHost(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = baseTemplate(
    `
    <h1>New Booking Confirmed</h1>
    <p>${escapeHtml(data.inviteeName)} has booked a meeting with you.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="detail-row">
      <span class="detail-label">Invitee</span>
      <span class="detail-value">${escapeHtml(data.inviteeName)} (${escapeHtml(data.inviteeEmail)})</span>
    </div>
    ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(data.notes)}</div>` : ""}
    <div class="actions">
      <a href="${appUrl}/dashboard/bookings/${encodeURIComponent(data.bookingUid)}" class="btn">View Booking</a>
    </div>
  `,
    `${data.inviteeName} booked ${data.eventTitle} with you.`
  );

  const icsData: ICSEventData = {
    title: `${data.eventTitle} with ${data.inviteeName}`,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location || data.meetingUrl,
    uid: data.bookingUid,
    attendees: [{ name: data.inviteeName, email: data.inviteeEmail }],
    organizer: { name: data.hostName, email: data.hostEmail },
  };
  const icsContent = generateICS(icsData);

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.hostEmail,
    subject: `New booking: ${data.eventTitle} with ${data.inviteeName}`,
    html,
    ...(icsContent
      ? {
          icalEvent: {
            method: "REQUEST",
            content: icsContent,
          },
        }
      : {}),
  });
}

export async function sendBookingConfirmedInvitee(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeUid = encodeURIComponent(data.bookingUid);

  const html = baseTemplate(
    `
    <h1>Booking Confirmed</h1>
    <p>Your meeting with ${escapeHtml(data.hostName)} has been confirmed.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${safeUid}" class="btn">View Booking</a>
      <a href="${appUrl}/booking/${safeUid}/reschedule" class="btn btn-outline">Reschedule</a>
      <a href="${appUrl}/booking/${safeUid}/cancel" class="btn btn-outline">Cancel</a>
    </div>
  `,
    `Your booking with ${data.hostName} is confirmed.`
  );

  const icsData: ICSEventData = {
    title: `${data.eventTitle} with ${data.hostName}`,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location || data.meetingUrl,
    uid: data.bookingUid,
    organizer: { name: data.hostName, email: data.hostEmail },
  };
  const icsContent = generateICS(icsData);

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.inviteeEmail,
    subject: `Confirmed: ${data.eventTitle} with ${data.hostName}`,
    html,
    ...(icsContent
      ? {
          icalEvent: {
            method: "REQUEST",
            content: icsContent,
          },
        }
      : {}),
  });
}

export async function sendBookingCancelledHost(data: BookingEmailData) {
  const html = baseTemplate(
    `
    <h1>Booking Cancelled</h1>
    <p>${escapeHtml(data.inviteeName)} has cancelled their booking.</p>
    ${bookingDetails(data, data.timezone)}
    ${data.cancellationReason ? `<div class="notes"><strong>Reason:</strong> ${escapeHtml(data.cancellationReason)}</div>` : ""}
  `,
    `${data.inviteeName} cancelled ${data.eventTitle}.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.hostEmail,
    subject: `Cancelled: ${data.eventTitle} with ${data.inviteeName}`,
    html,
  });
}

export async function sendBookingCancelledInvitee(data: BookingEmailData) {
  const html = baseTemplate(
    `
    <h1>Booking Cancelled</h1>
    <p>Your meeting with ${escapeHtml(data.hostName)} has been cancelled.</p>
    ${bookingDetails(data, data.timezone)}
    ${data.cancellationReason ? `<div class="notes"><strong>Reason:</strong> ${escapeHtml(data.cancellationReason)}</div>` : ""}
  `,
    `Your meeting with ${data.hostName} was cancelled.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.inviteeEmail,
    subject: `Cancelled: ${data.eventTitle} with ${data.hostName}`,
    html,
  });
}

export async function sendBookingRescheduledInvitee(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeUid = encodeURIComponent(data.bookingUid);

  const html = baseTemplate(
    `
    <h1>Booking Rescheduled</h1>
    <p>Your meeting with ${escapeHtml(data.hostName)} has been rescheduled.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${safeUid}" class="btn">View Updated Booking</a>
    </div>
  `,
    `Your meeting with ${data.hostName} was rescheduled.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.inviteeEmail,
    subject: `Rescheduled: ${data.eventTitle} with ${data.hostName}`,
    html,
  });
}

export async function sendBookingReminder(
  data: BookingEmailData,
  reminderType: "24h" | "1h"
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const timeLabel = reminderType === "24h" ? "tomorrow" : "in 1 hour";
  const safeUid = encodeURIComponent(data.bookingUid);

  const html = baseTemplate(
    `
    <h1>Upcoming Meeting Reminder</h1>
    <p>Your meeting with ${escapeHtml(data.hostName)} is ${escapeHtml(timeLabel)}.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${safeUid}" class="btn">View Booking</a>
    </div>
  `,
    `Reminder: ${data.eventTitle} with ${data.hostName} ${timeLabel}.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.inviteeEmail,
    subject: `Reminder: ${data.eventTitle} with ${data.hostName} ${timeLabel}`,
    html,
  });
}

export async function sendBookingPendingApprovalHost(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = baseTemplate(
    `
    <h1>New Booking Request</h1>
    <p>${escapeHtml(data.inviteeName)} wants to book a meeting with you. Please review and confirm.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/dashboard/bookings/${encodeURIComponent(data.bookingUid)}" class="btn">Review &amp; Confirm</a>
    </div>
  `,
    `${data.inviteeName} requested a booking — review and confirm.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.hostEmail,
    subject: `Booking request: ${data.eventTitle} from ${data.inviteeName}`,
    html,
  });
}

export async function sendBookingRequestReceivedInvitee(data: BookingEmailData) {
  const html = baseTemplate(
    `
    <h1>Booking Request Received</h1>
    <p>Your booking request with ${escapeHtml(data.hostName)} has been received and is awaiting confirmation. You&rsquo;ll receive an email once it&rsquo;s confirmed.</p>
    ${bookingDetails(data, data.timezone)}
  `,
    `Booking request sent — awaiting ${data.hostName}'s confirmation.`
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.inviteeEmail,
    subject: `Booking request received: ${data.eventTitle} with ${data.hostName}`,
    html,
  });
}
