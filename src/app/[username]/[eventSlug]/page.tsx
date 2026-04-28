import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";

const RESERVED_USERNAMES = [
  "dashboard",
  "login",
  "signup",
  "api",
  "booking",
  "polls",
  "route",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { username, eventSlug } = await params;

  if (RESERVED_USERNAMES.includes(username)) {
    return { title: "Not found" };
  }

  // generateMetadata runs in parallel with the page render; both call the
  // same query but Next/React will dedupe the request internally.
  const eventType = await db.eventType.findFirst({
    where: {
      slug: eventSlug,
      isActive: true,
      user: { username },
    },
    select: {
      title: true,
      description: true,
      duration: true,
      user: { select: { name: true, username: true, avatarUrl: true } },
    },
  });

  if (!eventType) return { title: "Not found" };

  const hostName = eventType.user.name || eventType.user.username || "host";
  const title = `${eventType.title} with ${hostName}`;
  const description =
    eventType.description ||
    `Book a ${eventType.duration}-minute meeting with ${hostName}.`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const url = appUrl
    ? `${appUrl}/${eventType.user.username}/${eventSlug}`
    : undefined;
  const image = eventType.user.avatarUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "ScheduleFlow",
      type: "website",
      ...(image
        ? { images: [{ url: image, alt: `${hostName}'s avatar` }] }
        : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: { index: true, follow: true },
    alternates: url ? { canonical: url } : undefined,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  const { username, eventSlug } = await params;

  if (RESERVED_USERNAMES.includes(username)) {
    notFound();
  }

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
    <div className="min-h-screen bg-slate-50">
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
