import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type CircleType = "friends" | "local" | "gaming" | "fitness" | "networking" | "creator" | "private" | "custom";
export type PostVisibility = "everyone" | "circle_members" | "paid_members" | "selected_members" | "only_me";
export type MemberRole = "owner" | "admin" | "moderator" | "member" | "paid_member";
export type MemberStatus = "pending" | "approved" | "blocked";

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
};

export async function createCircle(input: CreateCircleInput): Promise<Circle> {
  const { data, error } = await sb
    .from("circles")
    .insert({
      owner_id: input.ownerId,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category || null,
      city: input.city || null,
      avatar_url: input.avatarUrl || null,
      cover_url: input.coverUrl || null,
      is_private: input.isPrivate ?? false,
      is_discoverable: input.isDiscoverable ?? true,
      requires_approval: input.requiresApproval ?? false,
      is_paid: input.isPaid ?? false,
      price_cents: input.isPaid ? input.priceCents ?? null : null,
      welcome_message: input.welcomeMessage || null,
      default_post_visibility: input.defaultPostVisibility ?? "circle_members",
      member_posting_allowed: input.memberPostingAllowed ?? false,
      member_comments_allowed: input.memberCommentsAllowed ?? true,
      member_invites_allowed: input.memberInvitesAllowed ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Circle;
}

export async function getCircle(id: string): Promise<Circle | null> {
  const { data, error } = await sb.from("circles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Circle | null;
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Circle;
}

/** Circles the user owns or is an approved member of. */
export async function listMyCircles(userId: string): Promise<{ circle: Circle; membership: CircleMember }[]> {
  const { data, error } = await sb
    .from("circle_members")
    .select("*, circles(*)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || [])
    .filter((row) => row.circles)
    .map((row) => ({ circle: row.circles as Circle, membership: row as CircleMember }));
}

export async function listCreatedCircles(userId: string): Promise<Circle[]> {
  const { data, error } = await sb.from("circles").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Circle[]) || [];
}

export type DiscoverCirclesOpts = {
  type?: CircleType;
  search?: string;
  city?: string;
  limit?: number;
};

export async function listDiscoverableCircles(opts: DiscoverCirclesOpts = {}): Promise<Circle[]> {
  let q = sb.from("circles").select("*").eq("is_discoverable", true).order("member_count", { ascending: false }).limit(opts.limit ?? 30);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.city) q = q.eq("city", opts.city);
  if (opts.search?.trim()) q = q.ilike("name", `%${opts.search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Circle[]) || [];
}

export async function listExclusiveCircles(limit = 20): Promise<Circle[]> {
  const { data, error } = await sb
    .from("circles")
    .select("*")
    .eq("type", "creator")
    .eq("is_discoverable", true)
    .order("member_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Circle[]) || [];
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

export async function approveMember(memberId: string, approvedBy: string): Promise<void> {
  const { error } = await sb
    .from("circle_members")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: approvedBy })
    .eq("id", memberId);
  if (error) throw error;
}

export async function denyMember(memberId: string): Promise<void> {
  const { error } = await sb.from("circle_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await sb.from("circle_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function blockMember(memberId: string): Promise<void> {
  const { error } = await sb.from("circle_members").update({ status: "blocked" }).eq("id", memberId);
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
