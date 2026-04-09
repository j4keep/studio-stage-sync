export type ConnectionState = "disconnected" | "connecting" | "connected" | "degraded";

export type SessionRole = "artist" | "engineer";

type SessionStripConnection = "connected" | "connecting" | "disconnected";

export function toSessionStripConnection(state: ConnectionState): SessionStripConnection {
  if (state === "connected") return "connected";
  if (state === "connecting") return "connecting";
  return "disconnected";
}
