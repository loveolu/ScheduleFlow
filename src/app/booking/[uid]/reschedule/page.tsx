import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: { select: { slug: true } },
      user: { select: { username: true } },
    },
  });

  if (!booking) notFound();

  if (booking.status === "CANCELLED") {
    redirect(`/booking/${uid}`);
  }

  // Redirect to the booking page with reschedule flag
  // The booking flow will detect this and handle the reschedule
  redirect(
    `/${booking.user.username}/${booking.eventType.slug}?rescheduleUid=${uid}`
  );
}
