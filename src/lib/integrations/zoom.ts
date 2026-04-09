import { db } from "@/lib/db";
import type { Integration } from "@/generated/prisma/client";

const ZOOM_API_URL = "https://api.zoom.us/v2";
const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

function getRedirectUri() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;
}

/**
 * Generate the Zoom OAuth consent URL.
 */
function getAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    state: userId,
  });

  return `${ZOOM_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code for tokens and save the integration.
 */
async function handleCallback(
  code: string,
  userId: string
): Promise<{ success: boolean } | null> {
  try {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(ZOOM_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    if (!response.ok) {
      console.error("Zoom token exchange failed:", await response.text());
      return null;
    }

    const tokens = await response.json();

    // Fetch Zoom user profile for metadata
    const profileRes = await fetch(`${ZOOM_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let metadata: Record<string, string> = {};
    if (profileRes.ok) {
      const profile = await profileRes.json();
      metadata = {
        email: profile.email ?? "",
        displayName: profile.first_name
          ? `${profile.first_name} ${profile.last_name || ""}`.trim()
          : profile.email ?? "",
        accountId: profile.account_id ?? "",
      };
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.integration.upsert({
      where: { userId_type: { userId, type: "ZOOM" } },
      create: {
        userId,
        type: "ZOOM",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        metadata: metadata as never,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        metadata: metadata as never,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Zoom callback error:", error);
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
    console.error("No refresh token available for Zoom integration");
    return null;
  }

  try {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(ZOOM_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: integration.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Zoom token refresh failed:", await response.text());
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
    console.error("Zoom token refresh error:", error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 */
async function getValidToken(userId: string): Promise<string | null> {
  const integration = await db.integration.findUnique({
    where: { userId_type: { userId, type: "ZOOM" } },
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
 * Create a Zoom meeting.
 * Returns meeting URL, meeting ID, and password, or null on failure.
 */
async function createMeeting(
  userId: string,
  meeting: {
    topic: string;
    startTime: Date;
    duration: number;
    agenda?: string;
  }
): Promise<{ meetingUrl: string; meetingId: string; password: string } | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  try {
    const response = await fetch(`${ZOOM_API_URL}/users/me/meetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: meeting.topic,
        type: 2, // Scheduled meeting
        start_time: meeting.startTime.toISOString(),
        duration: meeting.duration,
        timezone: "UTC",
        agenda: meeting.agenda || "",
        settings: {
          join_before_host: true,
          waiting_room: false,
          auto_recording: "none",
        },
      }),
    });

    if (!response.ok) {
      console.error("Zoom createMeeting failed:", await response.text());
      return null;
    }

    const data = await response.json();

    return {
      meetingUrl: data.join_url,
      meetingId: String(data.id),
      password: data.password || "",
    };
  } catch (error) {
    console.error("Zoom createMeeting error:", error);
    return null;
  }
}

/**
 * Delete a Zoom meeting.
 */
async function deleteMeeting(
  userId: string,
  meetingId: string
): Promise<boolean> {
  const token = await getValidToken(userId);
  if (!token) return false;

  try {
    const response = await fetch(`${ZOOM_API_URL}/meetings/${meetingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok && response.status !== 404) {
      console.error("Zoom deleteMeeting failed:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Zoom deleteMeeting error:", error);
    return false;
  }
}

export const ZoomService = {
  getAuthUrl,
  handleCallback,
  refreshAccessToken,
  createMeeting,
  deleteMeeting,
};
