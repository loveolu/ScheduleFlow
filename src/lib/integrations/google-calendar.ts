import { db } from "@/lib/db";
import { IntegrationType } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or NEXTAUTH_URL must be set for Google Calendar integration"
    );
  }
  return `${base}/api/integrations/google/callback`;
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Google Calendar integration"
    );
  }
  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleTimePeriod {
  start: string;
  end: string;
}

interface FreeBusyResponse {
  calendars: Record<
    string,
    { busy: GoogleTimePeriod[]; errors?: { domain: string; reason: string }[] }
  >;
}

interface GoogleEvent {
  id: string;
  hangoutLink?: string;
  htmlLink?: string;
}

export interface BusyTime {
  start: Date;
  end: Date;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[] | { name: string; email: string }[];
  location?: string;
}

export interface CreateEventResult {
  eventId: string;
  meetLink: string | null;
  htmlLink: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the Google integration row for a user, or return null.
 */
async function getIntegration(userId: string) {
  return db.integration.findUnique({
    where: {
      userId_type: { userId, type: IntegrationType.GOOGLE },
    },
  });
}

/**
 * Return a valid access token for the user, refreshing if necessary.
 * Returns null when no integration exists or refresh fails.
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const integration = await getIntegration(userId);
  if (!integration?.accessToken) return null;

  // If the token is still valid (with 5-minute buffer), return it directly.
  if (
    integration.expiresAt &&
    integration.expiresAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return integration.accessToken;
  }

  // Token expired or about to expire -- refresh.
  if (!integration.refreshToken) return null;

  const refreshed = await refreshAccessToken({
    id: integration.id,
    refreshToken: integration.refreshToken,
    expiresAt: integration.expiresAt,
  });

  return refreshed;
}

/**
 * Generic wrapper around Google API fetch. Handles JSON parsing and basic
 * error logging. Returns null on failure so callers can degrade gracefully.
 */
async function googleFetch<T>(
  url: string,
  options: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.text();
      console.error(`Google API error [${res.status}]: ${body}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("Google API fetch failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the Google OAuth consent URL. The `state` parameter carries the
 * userId so the callback can associate the tokens with the right user.
 */
export function getAuthUrl(userId: string): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });
  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code for access + refresh tokens and persist
 * them in the Integration table (upsert on userId + type).
 */
export async function handleCallback(
  code: string,
  userId: string
): Promise<boolean> {
  const { clientId, clientSecret } = getClientCredentials();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });

  const tokens = await googleFetch<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokens) return false;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.integration.upsert({
    where: {
      userId_type: { userId, type: IntegrationType.GOOGLE },
    },
    create: {
      userId,
      type: IntegrationType.GOOGLE,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      metadata: {},
    },
    update: {
      accessToken: tokens.access_token,
      // Only overwrite refreshToken if Google returned a new one.
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    },
  });

  return true;
}

/**
 * Refresh the access token using the stored refresh token. Updates the DB
 * row and returns the new access token, or null on failure.
 */
export async function refreshAccessToken(integration: {
  id: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}): Promise<string | null> {
  if (!integration.refreshToken) return null;

  const { clientId, clientSecret } = getClientCredentials();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refreshToken,
    grant_type: "refresh_token",
  });

  const tokens = await googleFetch<TokenResponse>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokens) return null;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.integration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      expiresAt,
      // Google may (rarely) rotate the refresh token.
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}

/**
 * Query the Google Calendar FreeBusy API and return an array of busy
 * time-ranges. Returns an empty array on any error.
 */
export async function getBusyTimes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BusyTime[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const payload = {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    items: [{ id: "primary" }],
  };

  const data = await googleFetch<FreeBusyResponse>(
    `${GOOGLE_CALENDAR_API}/freeBusy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!data?.calendars?.primary) return [];

  return data.calendars.primary.busy.map((period) => ({
    start: new Date(period.start),
    end: new Date(period.end),
  }));
}

/**
 * Create an event on the user's primary Google Calendar.
 * Requests a Google Meet link via conferenceDataVersion.
 * Returns the event ID and Meet link, or null on failure.
 */
export async function createEvent(
  userId: string,
  event: CreateEventInput
): Promise<CreateEventResult | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const payload: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? "",
    start: {
      dateTime: event.startTime.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: event.endTime.toISOString(),
      timeZone: "UTC",
    },
    conferenceData: {
      createRequest: {
        requestId: `sf-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  if (event.attendees?.length) {
    payload.attendees = event.attendees.map((a) =>
      typeof a === "string" ? { email: a } : { email: a.email, displayName: a.name }
    );
  }

  if (event.location) {
    payload.location = event.location;
  }

  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`);
  url.searchParams.set("conferenceDataVersion", "1");
  url.searchParams.set("sendUpdates", "all");

  const created = await googleFetch<GoogleEvent>(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!created) return null;

  return {
    eventId: created.id,
    meetLink: created.hangoutLink ?? null,
    htmlLink: created.htmlLink ?? null,
  };
}

/**
 * Delete a calendar event by its Google event ID. Returns true on success.
 */
export async function deleteEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;

  try {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Google returns 204 on successful delete, 410 if already deleted.
    return res.status === 204 || res.status === 410;
  } catch (err) {
    console.error("Google Calendar deleteEvent failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Namespace export — used by the integration orchestrator (index.ts)
// ---------------------------------------------------------------------------

export const GoogleCalendarService = {
  getAuthUrl,
  handleCallback,
  refreshAccessToken,
  getBusyTimes,
  createEvent,
  deleteEvent,
};
