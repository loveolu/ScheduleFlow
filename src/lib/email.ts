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

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-block; width: 40px; height: 40px; background: #6366f1; border-radius: 8px; color: white; font-weight: bold; font-size: 16px; line-height: 40px; text-align: center; }
    h1 { font-size: 20px; color: #0f172a; margin: 16px 0 8px; }
    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .detail-label { color: #64748b; font-size: 14px; min-width: 100px; }
    .detail-value { color: #0f172a; font-size: 14px; font-weight: 500; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; margin: 4px; }
    .btn-outline { background: white; color: #6366f1; border: 1px solid #e2e8f0; }
    .btn-danger { background: #ef4444; }
    .actions { text-align: center; margin-top: 24px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8; }
    .notes { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 16px; font-size: 14px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">SF</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>Powered by ScheduleFlow</p>
    </div>
  </div>
</body>
</html>`;
}

function bookingDetails(data: BookingEmailData, viewerTimezone: string): string {
  const time = formatTime(data.startTime, viewerTimezone);
  const endTime = format(toZonedTime(data.endTime, viewerTimezone), "h:mm a");

  return `
    <div class="detail-row">
      <span class="detail-label">What</span>
      <span class="detail-value">${data.eventTitle}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">When</span>
      <span class="detail-value">${time} - ${endTime}</span>
    </div>
    ${data.location ? `
    <div class="detail-row">
      <span class="detail-label">Where</span>
      <span class="detail-value">${data.location}</span>
    </div>` : ""}
    ${data.meetingUrl ? `
    <div class="detail-row">
      <span class="detail-label">Meeting</span>
      <span class="detail-value"><a href="${data.meetingUrl}" style="color: #6366f1">${data.meetingUrl}</a></span>
    </div>` : ""}
  `;
}

export async function sendBookingConfirmedHost(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = baseTemplate(`
    <h1>New Booking Confirmed</h1>
    <p style="color: #64748b; font-size: 14px;">${data.inviteeName} has booked a meeting with you.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="detail-row">
      <span class="detail-label">Invitee</span>
      <span class="detail-value">${data.inviteeName} (${data.inviteeEmail})</span>
    </div>
    ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>` : ""}
    <div class="actions">
      <a href="${appUrl}/dashboard/bookings/${data.bookingUid}" class="btn">View Booking</a>
    </div>
  `);

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
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
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

  const html = baseTemplate(`
    <h1>Booking Confirmed</h1>
    <p style="color: #64748b; font-size: 14px;">Your meeting with ${data.hostName} has been confirmed.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${data.bookingUid}" class="btn">View Booking</a>
      <a href="${appUrl}/booking/${data.bookingUid}/reschedule" class="btn btn-outline">Reschedule</a>
      <a href="${appUrl}/booking/${data.bookingUid}/cancel" class="btn btn-outline">Cancel</a>
    </div>
  `);

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
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
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
  const html = baseTemplate(`
    <h1>Booking Cancelled</h1>
    <p style="color: #64748b; font-size: 14px;">${data.inviteeName} has cancelled their booking.</p>
    ${bookingDetails(data, data.timezone)}
    ${data.cancellationReason ? `<div class="notes"><strong>Reason:</strong> ${data.cancellationReason}</div>` : ""}
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
    to: data.hostEmail,
    subject: `Cancelled: ${data.eventTitle} with ${data.inviteeName}`,
    html,
  });
}

export async function sendBookingCancelledInvitee(data: BookingEmailData) {
  const html = baseTemplate(`
    <h1>Booking Cancelled</h1>
    <p style="color: #64748b; font-size: 14px;">Your meeting with ${data.hostName} has been cancelled.</p>
    ${bookingDetails(data, data.timezone)}
    ${data.cancellationReason ? `<div class="notes"><strong>Reason:</strong> ${data.cancellationReason}</div>` : ""}
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
    to: data.inviteeEmail,
    subject: `Cancelled: ${data.eventTitle} with ${data.hostName}`,
    html,
  });
}

export async function sendBookingRescheduledInvitee(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = baseTemplate(`
    <h1>Booking Rescheduled</h1>
    <p style="color: #64748b; font-size: 14px;">Your meeting with ${data.hostName} has been rescheduled.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${data.bookingUid}" class="btn">View Updated Booking</a>
    </div>
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
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

  const html = baseTemplate(`
    <h1>Upcoming Meeting Reminder</h1>
    <p style="color: #64748b; font-size: 14px;">Your meeting with ${data.hostName} is ${timeLabel}.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/booking/${data.bookingUid}" class="btn">View Booking</a>
    </div>
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
    to: data.inviteeEmail,
    subject: `Reminder: ${data.eventTitle} with ${data.hostName} ${timeLabel}`,
    html,
  });
}

export async function sendBookingPendingApprovalHost(data: BookingEmailData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const html = baseTemplate(`
    <h1>New Booking Request</h1>
    <p style="color: #64748b; font-size: 14px;">${data.inviteeName} wants to book a meeting with you. Please review and confirm.</p>
    ${bookingDetails(data, data.timezone)}
    <div class="actions">
      <a href="${appUrl}/dashboard/bookings/${data.bookingUid}" class="btn">Review & Confirm</a>
    </div>
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
    to: data.hostEmail,
    subject: `Booking request: ${data.eventTitle} from ${data.inviteeName}`,
    html,
  });
}

export async function sendBookingRequestReceivedInvitee(data: BookingEmailData) {
  const html = baseTemplate(`
    <h1>Booking Request Received</h1>
    <p style="color: #64748b; font-size: 14px;">Your booking request with ${data.hostName} has been received and is awaiting confirmation. You'll receive an email once it's confirmed.</p>
    ${bookingDetails(data, data.timezone)}
  `);

  await transporter.sendMail({
    from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
    to: data.inviteeEmail,
    subject: `Booking request received: ${data.eventTitle} with ${data.hostName}`,
    html,
  });
}
