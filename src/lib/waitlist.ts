import nodemailer from "nodemailer";
import { db } from "@/lib/db";

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
 * Called when a booking is cancelled. Checks if there are waitlist entries
 * for the same event type and date range. If found, sends an email to the
 * first person in the waitlist with a link to book.
 */
export async function checkAndNotifyWaitlist(
  eventTypeId: string,
  date: Date
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const waitlistEntries = await db.booking.findMany({
    where: {
      eventTypeId,
      status: "PENDING",
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      metadata: {
        path: ["waitlist"],
        equals: true,
      },
    },
    include: {
      eventType: {
        select: { title: true, slug: true },
      },
      user: {
        select: { username: true, name: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 1,
  });

  if (waitlistEntries.length === 0) {
    return;
  }

  const entry = waitlistEntries[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const bookingLink = `${appUrl}/${entry.user.username}/${entry.eventType.slug}`;

  const html = `
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
    p { color: #64748b; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px; }
    .actions { text-align: center; margin-top: 24px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">SF</div>
      </div>
      <h1>A Spot Has Opened Up!</h1>
      <p>Good news, ${entry.inviteeName}! A spot has become available for <strong>${entry.eventType.title}</strong> with ${entry.user.name || "the host"}.</p>
      <p>Click the button below to book your spot before it fills up again.</p>
      <div class="actions">
        <a href="${bookingLink}" class="btn">Book Now</a>
      </div>
    </div>
    <div class="footer">
      <p>Powered by ScheduleFlow</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"ScheduleFlow" <noreply@scheduleflow.com>`,
      to: entry.inviteeEmail,
      subject: `A spot opened up for ${entry.eventType.title}!`,
      html,
    });

    // Remove the notified entry from the waitlist
    await db.booking.delete({
      where: { id: entry.id },
    });
  } catch (error) {
    console.error("Failed to send waitlist notification:", error);
  }
}
