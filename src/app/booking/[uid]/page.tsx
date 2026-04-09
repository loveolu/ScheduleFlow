import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getGoogleCalendarUrl, getOutlookCalendarUrl } from "@/lib/ics";
import Link from "next/link";

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: true,
      user: {
        select: { name: true, username: true, avatarUrl: true, timezone: true },
      },
    },
  });

  if (!booking) notFound();

  const timezone = booking.inviteeTimezone;
  const startZoned = toZonedTime(booking.startTime, timezone);
  const endZoned = toZonedTime(booking.endTime, timezone);

  const statusColors: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    CANCELLED: "bg-red-100 text-red-700",
    RESCHEDULED: "bg-blue-100 text-blue-700",
    NO_SHOW: "bg-slate-100 text-slate-700",
  };

  const hostInitials = booking.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  const googleUrl = getGoogleCalendarUrl({
    title: `${booking.eventType.title} with ${booking.user.name}`,
    startTime: booking.startTime,
    endTime: booking.endTime,
    location: booking.location || booking.meetingUrl || undefined,
  });

  const outlookUrl = getOutlookCalendarUrl({
    title: `${booking.eventType.title} with ${booking.user.name}`,
    startTime: booking.startTime,
    endTime: booking.endTime,
    location: booking.location || booking.meetingUrl || undefined,
  });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Avatar className="w-14 h-14 mx-auto mb-3">
            <AvatarImage src={booking.user.avatarUrl || undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              {hostInitials}
            </AvatarFallback>
          </Avatar>
          <Badge className={statusColors[booking.status] || ""}>
            {booking.status}
          </Badge>
        </div>

        <h1 className="text-xl font-bold text-slate-900 text-center mb-6">
          {booking.eventType.title}
        </h1>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Date</span>
            <span className="font-medium">{format(startZoned, "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Time</span>
            <span className="font-medium">
              {format(startZoned, "h:mm a")} - {format(endZoned, "h:mm a")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Timezone</span>
            <span className="font-medium">{timezone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Host</span>
            <span className="font-medium">{booking.user.name}</span>
          </div>
          {booking.location && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Location</span>
              <span className="font-medium">{booking.location}</span>
            </div>
          )}
          {booking.meetingUrl && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Meeting link</span>
              <a href={booking.meetingUrl} className="font-medium text-indigo-600 hover:underline">
                Join meeting
              </a>
            </div>
          )}
        </div>

        {booking.status === "CONFIRMED" && (
          <>
            <div className="border-t border-slate-100 pt-4 mb-4">
              <p className="text-xs text-slate-400 mb-2 text-center">Add to calendar</p>
              <div className="flex justify-center gap-2">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Google
                </a>
                <a
                  href={outlookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Outlook
                </a>
                <a
                  href={`/api/bookings/${uid}/ics`}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  .ics file
                </a>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/booking/${uid}/reschedule`}
                className="flex-1 text-center px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Reschedule
              </Link>
              <Link
                href={`/booking/${uid}/cancel`}
                className="flex-1 text-center px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </>
        )}

        {booking.cancellationReason && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            <strong>Cancellation reason:</strong> {booking.cancellationReason}
          </div>
        )}
      </div>
    </div>
  );
}
