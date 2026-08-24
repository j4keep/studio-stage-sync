import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type CircleType = "friends" | "local" | "gaming" | "fitness" | "networking" | "creator" | "private" | "custom";
export type PostVisibility = "everyone" | "circle_members" | "paid_members" | "selected_members" | "only_me";
export type MemberRole = "owner" | "admin" | "moderator" | "member" | "paid_member";
export type MemberStatus = "pending" | "approved";

export type Circle = {
  id: string;
  owner_id: string;
  type: CircleType;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  description: string | null;
  category: string | null;
  city: string | null;
  is_private: boolean;
  is_discoverable: boolean;
  requires_approval: boolean;
  is_paid: boolean;
  price_cents: number | null;
  welcome_message: string | null;
  default_post_visibility: PostVisibility;
  member_posting_allowed: boolean;
  member_comments_allowed: boolean;
  member_invites_allowed: boolean;
  member_count: number;
  /** Every user gets exactly one — their own gated "My Circle" fan space, distinct
   *  from the group Circles they can additionally create. Auto-provisioned on first
   *  visit via getOrCreatePersonalCircle(). */
  is_personal: boolean;
  /** Owner-level prefs, editable any time from Circle Settings. */
  notify_new_requests: boolean;
  notify_new_members: boolean;
  created_at: string;
  updated_at: string;
};

export type CircleMember = {
  id: string;
  circle_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export const CIRCLE_TYPE_META: Record<CircleType, { label: string; emoji: string }> = {
  friends: { label: "Friends & Social", emoji: "👥" },
  local: { label: "Local Community", emoji: "📍" },
  gaming: { label: "Gaming", emoji: "🎮" },
  fitness: { label: "Fitness", emoji: "🏋️" },
  networking: { label: "Networking", emoji: "💼" },
  creator: { label: "Creator / Exclusive Content", emoji: "🎥" },
  private: { label: "Private Friends & Family", emoji: "🔒" },
  custom: { label: "Custom Circle", emoji: "✨" },
};

export type CreateCircleInput = {
  ownerId: string;
  type: CircleType;
  name: string;
  description?: string;
  category?: string;
  city?: string;
  avatarUrl?: string;
  coverUrl?: string;
  isPrivate?: boolean;
  isDiscoverable?: boolean;
  requiresApproval?: boolean;
  isPaid?: boolean;
  priceCents?: number;
  welcomeMessage?: string;
  defaultPostVisibility?: PostVisibility;
  memberPostingAllowed?: boolean;
  memberCommentsAllowed?: boolean;
  memberInvitesAllowed?: boolean;
  notifyNewRequests?: boolean;
  notifyNewMembers?: boolean;
};

export async function getCircle(id: string): Promise<Circle | null> {
  const { data, error } = await sb.from("circles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Circle | null;
}

/** Every user's own gated "My Circle" — created lazily the first time anyone (usually
 *  the owner, but also whoever taps their "My Circle" icon first) resolves it. Always
 *  private + approval-required: the personal circle is meant to work exactly like the
 *  request-to-join flow the user described, not an optional toggle.
 *
 *  Goes through the get_or_create_personal_circle RPC (SECURITY DEFINER) rather than a
 *  plain insert — the normal "Users create circles" RLS policy requires
 *  auth.uid() = owner_id, which would reject provisioning someone *else's* personal
 *  circle (e.g. tapping their "My Circle" icon on a post before they've ever opened
 *  their own). The RPC does the find-or-create atomically for any target user. */
export async function getOrCreatePersonalCircle(userId: string, displayName?: string): Promise<Circle> {
  const { data, error } = await sb.rpc("get_or_create_personal_circle", {
    p_user_id: userId,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as Circle;
}

export async function updateCircle(id: string, patch: Partial<CreateCircleInput>): Promise<Circle> {
  const { data, error } = await sb
    .from("circles")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
      ...(patch.coverUrl !== undefined ? { cover_url: patch.coverUrl } : {}),
      ...(patch.isPrivate !== undefined ? { is_private: patch.isPrivate } : {}),
      ...(patch.isDiscoverable !== undefined ? { is_discoverable: patch.isDiscoverable } : {}),
      ...(patch.requiresApproval !== undefined ? { requires_approval: patch.requiresApproval } : {}),
      ...(patch.isPaid !== undefined ? { is_paid: patch.isPaid } : {}),
      ...(patch.priceCents !== undefined ? { price_cents: patch.priceCents } : {}),
      ...(patch.welcomeMessage !== undefined ? { welcome_message: patch.welcomeMessage } : {}),
      ...(patch.defaultPostVisibility !== undefined ? { default_post_visibility: patch.defaultPostVisibility } : {}),
      ...(patch.memberPostingAllowed !== undefined ? { member_posting_allowed: patch.memberPostingAllowed } : {}),
      ...(patch.memberCommentsAllowed !== undefined ? { member_comments_allowed: patch.memberCommentsAllowed } : {}),
      ...(patch.memberInvitesAllowed !== undefined ? { member_invites_allowed: patch.memberInvitesAllowed } : {}),
      ...(patch.notifyNewRequests !== undefined ? { notify_new_requests: patch.notifyNewRequests } : {}),
      ...(patch.notifyNewMembers !== undefined ? { notify_new_members: patch.notifyNewMembers } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Circle;
}

/** Personal circles can't be deleted — every user needs exactly one. */
export async function deleteCircle(id: string): Promise<void> {
  const { error } = await sb.from("circles").delete().eq("id", id).eq("is_personal", false);
  if (error) throw error;
}

export async function getMyMembership(circleId: string, userId: string): Promise<CircleMember | null> {
  const { data, error } = await sb
    .from("circle_members")
    .select("*")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as CircleMember | null;
}

/** Joins immediately if the circle doesn't require approval, otherwise files a pending request. */
export async function requestToJoin(circleId: string, userId: string, requiresApproval: boolean): Promise<CircleMember> {
  const { data, error } = await sb
    .from("circle_members")
    .upsert(
      {
        circle_id: circleId,
        user_id: userId,
        role: "member",
        status: requiresApproval ? "pending" : "approved",
        approved_at: requiresApproval ? null : new Date().toISOString(),
      },
      { onConflict: "circle_id,user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  if (requiresApproval) {
    // Best-effort — the requester's own join succeeded either way, notifying the owner
    // just makes them aware faster. Goes through a SECURITY DEFINER RPC since a plain
    // insert can't write a notification row for someone else (RLS: auth.uid() = user_id).
    // supabase-js query/RPC builders are thenable but not real Promises, so .catch() isn't
    // callable directly on them — await inside a try/catch instead.
    void (async () => {
      try {
        await sb.rpc("notify_circle_join_request", { p_circle_id: circleId });
      } catch {
        /* best-effort */
      }
    })();
  }
  return data as CircleMember;
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  const { error } = await sb.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", userId);
  if (error) throw error;
}

export async function listCircleMembers(circleId: string, status: MemberStatus = "approved"): Promise<CircleMember[]> {
  const { data, error } = await sb
    .from("circle_members")
    .select("*")
    .eq("circle_id", circleId)
    .eq("status", status)
    .order("approved_at", { ascending: false });
  if (error) throw error;
  return (data as CircleMember[]) || [];
}

/** Lightweight count for the red "pending requests" badge — avoids fetching full rows. */
export async function countPendingMembers(circleId: string): Promise<number> {
  const { count, error } = await sb
    .from("circle_members")
    .select("*", { count: "exact", head: true })
    .eq("circle_id", circleId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function approveMember(memberId: string, approvedBy: string): Promise<void> {
  const { error } = await sb
    .from("circle_members")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: approvedBy })
    .eq("id", memberId);
  if (error) throw error;
  void (async () => {
    try {
      await sb.rpc("notify_circle_join_approved", { p_member_id: memberId });
    } catch {
      /* best-effort */
    }
  })();
}

export async function denyMember(memberId: string): Promise<void> {
  const { error } = await sb.from("circle_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await sb.from("circle_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function setMemberRole(memberId: string, role: MemberRole): Promise<void> {
  const { error } = await sb.from("circle_members").update({ role }).eq("id", memberId);
  if (error) throw error;
}

/** Uploads a circle avatar/cover image to the shared `media` bucket, same convention as post uploads. */
export async function uploadCircleImage(userId: string, file: File, kind: "avatar" | "cover"): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `circles/${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  const { data } = sb.storage.from("media").getPublicUrl(path);
  return data.publicUrl as string;
}

/** Uploads a YAJ-AI-generated data: URL (from generateYajImage) to the same place a
 *  device-picked cover would go, so it isn't stored as a giant base64 string. */
export async function uploadCircleImageFromDataUrl(userId: string, dataUrl: string, kind: "avatar" | "cover"): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.split("/")[1] || "png";
  const path = `circles/${userId}/${kind}-ai-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "image/png" });
  if (error) throw error;
  const { data } = sb.storage.from("media").getPublicUrl(path);
  return data.publicUrl as string;
}
