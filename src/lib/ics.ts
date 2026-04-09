import { createEvents, type EventAttributes } from "ics";
import { format } from "date-fns";

export interface ICSEventData {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
  uid?: string;
  url?: string;
}

function dateToArray(d: Date): [number, number, number, number, number] {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

export function generateICS(event: ICSEventData): string | null {
  const icsEvent: EventAttributes = {
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    start: dateToArray(event.startTime),
    end: dateToArray(event.endTime),
    startInputType: "utc",
    startOutputType: "utc",
    endInputType: "utc",
    endOutputType: "utc",
    uid: event.uid,
    url: event.url,
    status: "CONFIRMED",
    busyStatus: "BUSY",
    organizer: event.organizer
      ? { name: event.organizer.name, email: event.organizer.email }
      : undefined,
    attendees: event.attendees?.map((a) => ({
      name: a.name,
      email: a.email,
      rsvp: true,
      partstat: "ACCEPTED",
      role: "REQ-PARTICIPANT",
    })),
  };

  const { error, value } = createEvents([icsEvent]);
  if (error || !value) return null;
  return value;
}

export function getGoogleCalendarUrl(event: ICSEventData): string {
  const startStr = format(event.startTime, "yyyyMMdd'T'HHmmss'Z'");
  const endStr = format(event.endTime, "yyyyMMdd'T'HHmmss'Z'");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: event.description || "",
    location: event.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getOutlookCalendarUrl(event: ICSEventData): string {
  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: event.startTime.toISOString(),
    enddt: event.endTime.toISOString(),
    body: event.description || "",
    location: event.location || "",
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
