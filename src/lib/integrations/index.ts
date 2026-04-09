/**
 * Integration orchestrator — coordinates calendar + conferencing integrations
 * for the booking flow.
 */

import { db } from "@/lib/db";
import type { BusyInterval } from "@/lib/slots";

// Lazy imports to avoid circular dependencies
async function getGoogleCalendar() {
  const { GoogleCalendarService } = await import("./google-calendar");
  return GoogleCalendarService;
}

async function getOutlookCalendar() {
  const { OutlookCalendarService } = await import("./outlook-calendar");
  return OutlookCalendarService;
}

async function getZoomService() {
  const { ZoomService } = await import("./zoom");
  return ZoomService;
}

/**
 * Get all busy times from connected calendars for a user in a date range.
 */
export async function getExternalBusyTimes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BusyInterval[]> {
  const integrations = await db.integration.findMany({
    where: { userId, type: { in: ["GOOGLE", "OUTLOOK"] } },
  });

  const busyTimes: BusyInterval[] = [];

  for (const integration of integrations) {
    try {
      if (integration.type === "GOOGLE") {
        const GoogleCalendar = await getGoogleCalendar();
        const times = await GoogleCalendar.getBusyTimes(userId, startDate, endDate);
        busyTimes.push(...times);
      } else if (integration.type === "OUTLOOK") {
        const OutlookCalendar = await getOutlookCalendar();
        const times = await OutlookCalendar.getBusyTimes(userId, startDate, endDate);
        busyTimes.push(...times);
      }
    } catch (error) {
      console.error(`Failed to get busy times from ${integration.type}:`, error);
    }
  }

  return busyTimes;
}

/**
 * Create calendar events on all connected calendars when a booking is confirmed.
 */
export async function createCalendarEvents(
  userId: string,
  event: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees: { name: string; email: string }[];
    location?: string;
  }
): Promise<{ calendarEventIds: Record<string, string>; meetingUrl?: string }> {
  const integrations = await db.integration.findMany({
    where: { userId, type: { in: ["GOOGLE", "OUTLOOK"] } },
  });

  const calendarEventIds: Record<string, string> = {};

  for (const integration of integrations) {
    try {
      if (integration.type === "GOOGLE") {
        const GoogleCalendar = await getGoogleCalendar();
        const result = await GoogleCalendar.createEvent(userId, event);
        if (result) {
          calendarEventIds.google = result.eventId;
        }
      } else if (integration.type === "OUTLOOK") {
        const OutlookCalendar = await getOutlookCalendar();
        const result = await OutlookCalendar.createEvent(userId, event);
        if (result) {
          calendarEventIds.outlook = result.eventId;
        }
      }
    } catch (error) {
      console.error(`Failed to create event on ${integration.type}:`, error);
    }
  }

  return { calendarEventIds };
}

/**
 * Delete calendar events from all connected calendars when a booking is cancelled.
 */
export async function deleteCalendarEvents(
  userId: string,
  calendarEventIds: Record<string, string>
): Promise<void> {
  for (const [provider, eventId] of Object.entries(calendarEventIds)) {
    try {
      if (provider === "google") {
        const GoogleCalendar = await getGoogleCalendar();
        await GoogleCalendar.deleteEvent(userId, eventId);
      } else if (provider === "outlook") {
        const OutlookCalendar = await getOutlookCalendar();
        await OutlookCalendar.deleteEvent(userId, eventId);
      }
    } catch (error) {
      console.error(`Failed to delete event from ${provider}:`, error);
    }
  }
}

/**
 * Create a Zoom meeting for a booking if Zoom is connected.
 * Returns the meeting URL or undefined.
 */
export async function createConferencingLink(
  userId: string,
  meeting: {
    topic: string;
    startTime: Date;
    duration: number;
    agenda?: string;
  }
): Promise<string | undefined> {
  const zoomIntegration = await db.integration.findUnique({
    where: { userId_type: { userId, type: "ZOOM" } },
  });

  if (!zoomIntegration) return undefined;

  try {
    const Zoom = await getZoomService();
    const result = await Zoom.createMeeting(userId, meeting);
    return result?.meetingUrl;
  } catch (error) {
    console.error("Failed to create Zoom meeting:", error);
    return undefined;
  }
}

/**
 * Determine the best location/meeting URL for a booking based on event type
 * locations and connected integrations.
 */
export async function resolveBookingLocation(
  userId: string,
  locations: Array<{ type: string; value?: string }>,
  bookingDetails: {
    title: string;
    startTime: Date;
    duration: number;
  }
): Promise<{ location: string; meetingUrl?: string }> {
  if (!locations || locations.length === 0) {
    return { location: "Not specified" };
  }

  const primary = locations[0];

  switch (primary.type) {
    case "zoom": {
      const meetingUrl = await createConferencingLink(userId, {
        topic: bookingDetails.title,
        startTime: bookingDetails.startTime,
        duration: bookingDetails.duration,
      });
      return {
        location: "Zoom",
        meetingUrl: meetingUrl || primary.value,
      };
    }

    case "google-meet": {
      // Google Meet links are generated when creating Google Calendar events
      // with conferenceData. We'll handle this in the calendar event creation.
      return { location: "Google Meet" };
    }

    case "teams": {
      return { location: "Microsoft Teams" };
    }

    case "phone": {
      return { location: `Phone: ${primary.value || ""}` };
    }

    case "in-person": {
      return { location: primary.value || "In-Person" };
    }

    case "custom": {
      return {
        location: primary.value || "Custom",
        meetingUrl: primary.value,
      };
    }

    default:
      return { location: primary.type };
  }
}
