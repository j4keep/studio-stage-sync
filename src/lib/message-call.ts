/** Call invites inside chat messages — encoded in the message content, no schema change. */

export type MessageCallKind = "video" | "audio";

const PREFIX = "[[yaj-call:";

export function callRoomId(conversationId: string): string {
  return `chat-call-${conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

export function encodeCallInvite(kind: MessageCallKind, conversationId: string): string {
  return `${PREFIX}${kind}:${conversationId}]]`;
}

export function parseCallInvite(content: string | null | undefined): {
  kind: MessageCallKind;
  conversationId: string;
} | null {
  if (!content || !content.startsWith(PREFIX)) return null;
  const inner = content.slice(PREFIX.length, content.indexOf("]]"));
  const [kind, conversationId] = inner.split(":");
  if (!conversationId) return null;
  return { kind: kind === "audio" ? "audio" : "video", conversationId };
}

export function callInviteLabel(kind: MessageCallKind, mine: boolean): string {
  const what = kind === "audio" ? "Audio call" : "Video call";
  return mine ? `${what} started` : `Incoming ${what.toLowerCase()}`;
}
