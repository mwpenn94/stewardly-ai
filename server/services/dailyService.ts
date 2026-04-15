/**
 * Daily.co Video Conferencing Service
 *
 * Manages video rooms for client meetings, advisor consultations,
 * and team collaboration within WealthBridge AI.
 */
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

const log = logger.child({ service: "daily" });
const DAILY_API_BASE = "https://api.daily.co/v1";

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  config: {
    maxParticipants?: number;
    enableChat?: boolean;
    enableScreenshare?: boolean;
    enableRecording?: string;
    startVideoOff?: boolean;
    startAudioOff?: boolean;
    expiry?: number;
  };
}

export interface DailyMeetingToken {
  token: string;
  roomName: string;
  expiresAt: number;
}

async function dailyFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!ENV.dailyApiKey) {
    throw new Error("Daily.co API key not configured");
  }

  const response = await fetch(`${DAILY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ENV.dailyApiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    log.error({ status: response.status, path, error: errorText }, "Daily.co API error");
    throw new Error(`Daily.co API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Create a new video room for a meeting.
 */
export async function createRoom(options: {
  name?: string;
  maxParticipants?: number;
  enableRecording?: boolean;
  expiryMinutes?: number;
  isPrivate?: boolean;
}): Promise<DailyRoom | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const roomName = options.name ?? `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expirySeconds = options.expiryMinutes ? options.expiryMinutes * 60 : 3600; // default 1 hour

    const data = await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: roomName,
        privacy: options.isPrivate ? "private" : "public",
        properties: {
          max_participants: options.maxParticipants ?? 10,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: options.enableRecording ? "cloud" : undefined,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + expirySeconds,
        },
      }),
    });

    return {
      id: data.id,
      name: data.name,
      url: data.url,
      createdAt: data.created_at,
      config: {
        maxParticipants: data.config?.max_participants,
        enableChat: data.config?.enable_chat,
        enableScreenshare: data.config?.enable_screenshare,
        enableRecording: data.config?.enable_recording,
        expiry: data.config?.exp,
      },
    };
  } catch (err: any) {
    log.error({ error: err.message }, "Failed to create Daily.co room");
    return { error: `Room creation failed: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Get details of an existing room.
 */
export async function getRoom(roomName: string): Promise<DailyRoom | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const data = await dailyFetch(`/rooms/${roomName}`);
    return {
      id: data.id,
      name: data.name,
      url: data.url,
      createdAt: data.created_at,
      config: {
        maxParticipants: data.config?.max_participants,
        enableChat: data.config?.enable_chat,
        enableScreenshare: data.config?.enable_screenshare,
        enableRecording: data.config?.enable_recording,
        expiry: data.config?.exp,
      },
    };
  } catch (err: any) {
    return { error: `Failed to get room: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Delete a room.
 */
export async function deleteRoom(roomName: string): Promise<{ success: boolean } | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    await dailyFetch(`/rooms/${roomName}`, { method: "DELETE" });
    return { success: true };
  } catch (err: any) {
    return { error: `Failed to delete room: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Create a meeting token for a specific room and user.
 * Tokens control access and permissions for individual participants.
 */
export async function createMeetingToken(options: {
  roomName: string;
  userName?: string;
  userId?: string;
  isOwner?: boolean;
  expiryMinutes?: number;
  enableRecording?: boolean;
}): Promise<DailyMeetingToken | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const expirySeconds = options.expiryMinutes ? options.expiryMinutes * 60 : 3600;
    const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;

    const data = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: options.roomName,
          user_name: options.userName ?? "Participant",
          user_id: options.userId,
          is_owner: options.isOwner ?? false,
          exp: expiresAt,
          enable_recording: options.enableRecording ? "cloud" : undefined,
        },
      }),
    });

    return {
      token: data.token,
      roomName: options.roomName,
      expiresAt,
    };
  } catch (err: any) {
    return { error: `Token creation failed: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * List active rooms.
 */
export async function listRooms(limit = 50): Promise<DailyRoom[] | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const data = await dailyFetch(`/rooms?limit=${limit}`);
    return (data.data ?? []).map((room: any) => ({
      id: room.id,
      name: room.name,
      url: room.url,
      createdAt: room.created_at,
      config: {
        maxParticipants: room.config?.max_participants,
        enableChat: room.config?.enable_chat,
        enableScreenshare: room.config?.enable_screenshare,
        enableRecording: room.config?.enable_recording,
        expiry: room.config?.exp,
      },
    }));
  } catch (err: any) {
    return { error: `Failed to list rooms: ${err.message}`, code: "SERVICE_ERROR" };
  }
}

/**
 * Get recordings for a room.
 */
export async function getRoomRecordings(roomName: string): Promise<any[] | { error: string; code: string }> {
  if (!ENV.dailyApiKey) {
    return { error: "Daily.co API key not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const data = await dailyFetch(`/recordings?room_name=${roomName}`);
    return data.data ?? [];
  } catch (err: any) {
    return { error: `Failed to get recordings: ${err.message}`, code: "SERVICE_ERROR" };
  }
}
