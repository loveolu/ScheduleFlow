import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";

export const metadata = {
  robots: "noindex",
};

export default async function EmbedBookingPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  const { username, eventSlug } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      timezone: true,
    },
  });

  if (!user) notFound();

  const eventType = await db.eventType.findFirst({
    where: { userId: user.id, slug: eventSlug, isActive: true },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      duration: true,
      color: true,
      locations: true,
      questions: true,
      hideEventTypeDetails: true,
    },
  });

  if (!eventType) notFound();

  return (
    <div className="min-h-screen bg-white p-4">
      <BookingFlow
        user={{
          name: user.name || "",
          username: user.username || "",
          avatarUrl: user.avatarUrl,
          timezone: user.timezone,
        }}
        eventType={{
          id: eventType.id,
          title: eventType.title,
          slug: eventType.slug,
          description: eventType.description,
          duration: eventType.duration,
          color: eventType.color,
          locations: eventType.locations as Array<{ type: string; value?: string; label?: string }>,
          questions: eventType.questions as Array<{
            id: string;
            type: string;
            label: string;
            required: boolean;
            options?: string[];
            placeholder?: string;
          }>,
          hideEventTypeDetails: eventType.hideEventTypeDetails,
        }}
      />
    </div>
  );
}
