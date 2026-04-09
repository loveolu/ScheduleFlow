import { db } from "@/lib/db";
import type { Integration } from "@/generated/prisma/client";

const MS_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0";
const SCOPES = "Calendars.ReadWrite offline_access";

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/outlook/callback`;
}

/**
 * Generate the Azure AD OAuth consent URL.
 */
function getAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    response_mode: "query",
    state: userId,
  });

  return `${MS_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens and save the integration.
 */
async function handleCallback(
  code: string,
  userId: string
): Promise<{ success: boolean } | null> {
  try {
    const response = await fetch(`${MS_AUTH_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        code,
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
        scope: SCOPES,
      }),
    });

    if (!response.ok) {
      console.error("Outlook token exchange failed:", await response.text());
      return null;
    }

    const tokens = await response.json();

    // Fetch user profile for metadata
    const profileRes = await fetch(`${MS_GRAPH_URL}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let metadata: Record<string, string> = {};
    if (profileRes.ok) {
      const profile = await profileRes.json();
      metadata = {
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
      };
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.integration.upsert({
      where: { userId_type: { userId, type: "OUTLOOK" } },
      create: {
        userId,
        type: "OUTLOOK",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        metadata,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        metadata,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Outlook callback error:", error);
    return null;
  }
}

/**
 * Refresh the access token if it has expired.
 * Returns the updated integration or null on failure.
 */
async function refreshAccessToken(
  integration: Integration
): Promise<Integration | null> {
  if (!integration.refreshToken) {
    console.error("No refresh token available for Outlook integration");
    return null;
  }

  try {
    const response = await fetch(`${MS_AUTH_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        refresh_token: integration.refreshToken,
        grant_type: "refresh_token",
        scope: SCOPES,
      }),
    });

    if (!response.ok) {
      console.error("Outlook token refresh failed:", await response.text());
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const updated = await db.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? integration.refreshToken,
        expiresAt,
      },
    });

    return updated;
  } catch (error) {
    console.error("Outlook token refresh error:", error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 */
async function getValidToken(userId: string): Promise<string | null> {
  const integration = await db.integration.findUnique({
    where: { userId_type: { userId, type: "OUTLOOK" } },
  });

  if (!integration) return null;

  // Refresh if token expires within the next 5 minutes
  const bufferMs = 5 * 60 * 1000;
  if (integration.expiresAt && integration.expiresAt.getTime() < Date.now() + bufferMs) {
    const refreshed = await refreshAccessToken(integration);
    return refreshed?.accessToken ?? null;
  }

  return integration.accessToken;
}

/**
 * Get busy times from Outlook Calendar using the getSchedule endpoint.
 */
async function getBusyTimes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const token = await getValidToken(userId);
  if (!token) return [];

  try {
    // Fetch the user's email for the schedule request
    const integration = await db.integration.findUnique({
      where: { userId_type: { userId, type: "OUTLOOK" } },
    });

    const email =
      (integration?.metadata as Record<string, unknown>)?.email as string | undefined;

    if (!email) {
      console.error("No email found in Outlook integration metadata");
      return [];
    }

    const response = await fetch(`${MS_GRAPH_URL}/me/calendar/getSchedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedules: [email],
        startTime: {
          dateTime: startDate.toISOString(),
          timeZone: "UTC",
        },
        endTime: {
          dateTime: endDate.toISOString(),
          timeZone: "UTC",
        },
        availabilityViewInterval: 15,
      }),
    });

    if (!response.ok) {
      console.error("Outlook getBusyTimes failed:", await response.text());
      return [];
    }

    const data = await response.json();
    const scheduleItems = data.value?.[0]?.scheduleItems ?? [];

    return scheduleItems
      .filter(
        (item: { status: string }) =>
          item.status === "busy" ||
          item.status === "oof" ||
          item.status === "tentative"
      )
      .map((item: { start: { dateTime: string }; end: { dateTime: string } }) => ({
        start: new Date(item.start.dateTime),
        end: new Date(item.end.dateTime),
      }));
  } catch (error) {
    console.error("Outlook getBusyTimes error:", error);
    return [];
  }
}

/**
 * Create a calendar event in Outlook via MS Graph.
 * Returns the event ID or null on failure.
 */
async function createEvent(
  userId: string,
  event: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { name: string; email: string }[];
  }
): Promise<{ eventId: string } | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  try {
    const body: Record<string, unknown> = {
      subject: event.title,
      body: {
        contentType: "text",
        content: event.description || "",
      },
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: "UTC",
      },
    };

    if (event.attendees && event.attendees.length > 0) {
      body.attendees = event.attendees.map((a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      }));
    }

    const response = await fetch(`${MS_GRAPH_URL}/me/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Outlook createEvent failed:", await response.text());
      return null;
    }

    const created = await response.json();
    return { eventId: created.id };
  } catch (error) {
    console.error("Outlook createEvent error:", error);
    return null;
  }
}

/**
 * Delete a calendar event from Outlook.
 */
async function deleteEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const token = await getValidToken(userId);
  if (!token) return false;

  try {
    const response = await fetch(`${MS_GRAPH_URL}/me/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok && response.status !== 404) {
      console.error("Outlook deleteEvent failed:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Outlook deleteEvent error:", error);
    return false;
  }
}

export const OutlookCalendarService = {
  getAuthUrl,
  handleCallback,
  refreshAccessToken,
  getBusyTimes,
  createEvent,
  deleteEvent,
};
