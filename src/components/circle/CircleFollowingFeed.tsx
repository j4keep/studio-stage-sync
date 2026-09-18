import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CircleContentCard from "@/components/circle/CircleContentCard";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import { fetchFeedItems } from "@/lib/feed-items";
import type { CircleContent } from "@/lib/circle-content";
import type { CircleMember } from "@/lib/circles";

const sb = supabase as any;

type CircleSummary = {
  id: string;
  name: string;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  owner_id: string;
};

type CircleFeedItem = {
  type: "circle";
  createdAt: string;
  content: CircleContent;
  circle: CircleSummary;
  authorName: string;
  authorAvatar: string | null;
};

type SocialFeedItem = {
  type: "social";
  createdAt: string;
  post: any;
  circle: CircleSummary;
};

type FeedItem = CircleFeedItem | SocialFeedItem;

export default function CircleFollowingFeed({ userId, ownCircleId }: { userId: string; ownCircleId?: string | null }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: membershipRows, error: membershipError } = await sb
        .from("circle_members")
        .select("circle_id, role, status")
        .eq("user_id", userId)
        .eq("status", "approved");
      if (membershipError) throw membershipError;

      const memberships = ((membershipRows as Pick<CircleMember, "circle_id" | "role" | "status">[]) || []);
      const roleByCircle = new Map(memberships.map((m) => [m.circle_id, m.role]));
      const circleIds = Array.from(new Set([
        ...memberships.map((m) => m.circle_id),
        ...(ownCircleId ? [ownCircleId] : []),
      ]));

      if (!circleIds.length) {
        setItems([]);
        return;
      }

      const [{ data: circlesData, error: circlesError }, { data: contentData, error: contentError }] = await Promise.all([
        sb
          .from("circles")
          .select("id,name,cover_url,is_private,member_count,owner_id")
          .in("id", circleIds),
        sb
          .from("circle_contents")
          .select("*")
          .in("circle_id", circleIds)
          .neq("activity_type", "exclusive")
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      if (circlesError) throw circlesError;
      if (contentError) throw contentError;

      const circles = (circlesData || []) as CircleSummary[];
      const circleMap = new Map(circles.map((c) => [c.id, c]));
      const circleByOwner = new Map(circles.map((c) => [c.owner_id, c]));

      const contents = ((contentData as CircleContent[]) || []).filter((item) => {
        if (item.visibility === "only_me") return item.author_id === userId;
        if (item.visibility !== "paid_members") return true;
        const circle = circleMap.get(item.circle_id);
        if (circle?.owner_id === userId) return true;
        const role = roleByCircle.get(item.circle_id);
        return role === "paid_member" || role === "owner" || role === "admin";
      });

      const authorIds = Array.from(new Set(contents.map((c) => c.author_id)));
      const { data: profiles } = authorIds.length
        ? await sb.from("profiles").select("user_id,display_name,avatar_url").in("user_id", authorIds)
        : { data: [] };
      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, { name: p.display_name || "YAJ member", avatar: p.avatar_url || null }]),
      );

      const circleItems: CircleFeedItem[] = contents
        .map((content) => {
          const circle = circleMap.get(content.circle_id);
          if (!circle) return null;
          const profile = profileMap.get(content.author_id) as { name: string; avatar: string | null } | undefined;
          return {
            type: "circle" as const,
            createdAt: content.created_at,
            content,
            circle,
            authorName: profile?.name || "YAJ member",
            authorAvatar: profile?.avatar || null,
          };
        })
        .filter((item): item is CircleFeedItem => Boolean(item));

      // A Circle Home should also surface the normal YAJ posts made by the people whose
      // Circles the viewer joined. That is the same post stream users see on the main Feed,
      // while Exclusive Circle posts remain gated separately.
      const ownerIds = Array.from(new Set(circles.map((circle) => circle.owner_id)));
      const socialGroups = await Promise.all(
        ownerIds.map(async (ownerId) => {
          try {
            const feed = await fetchFeedItems({ currentUserId: userId, userId: ownerId });
            return feed
              .filter((item: any) => item.itemType === "post")
              .slice(0, 20)
              .map((post: any) => ({
                type: "social" as const,
                createdAt: post.created_at,
                post,
                circle: circleByOwner.get(ownerId)!,
              }))
              .filter((item) => Boolean(item.circle));
          } catch {
            return [] as SocialFeedItem[];
          }
        }),
      );

      const combined: FeedItem[] = [...circleItems, ...socialGroups.flat()];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(combined.slice(0, 100));
    } catch {
      setItems([]);
    }
  }, [ownCircleId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (items === null) {
    return <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">Loading Circle updates…</p>;
  }

  if (!items.length) {
    return (
      <div className="mx-4 mt-6 rounded-[28px] border border-border bg-card px-6 py-12 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-black">Your Circle feed is ready</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Join a Circle and new posts from those Circle owners and members will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 lg:px-6">
      {items.map((item) => {
        if (item.type === "social") {
          return (
            <section key={`social-${item.post.id}`} className="overflow-hidden rounded-[24px]">
              <CircleHeader circle={item.circle} onOpen={() => navigate(`/circle/c/${item.circle.id}`)} />
              <FeedThumbCard
                post={item.post}
                onOpen={() => navigate(`/feed?post=${encodeURIComponent(item.post.id)}`)}
              />
            </section>
          );
        }

        return (
          <section key={`circle-${item.content.id}`} className="overflow-hidden rounded-[24px]">
            <CircleHeader
              circle={item.circle}
              authorName={item.authorName}
              authorAvatar={item.authorAvatar}
              onOpen={() => navigate(`/circle/c/${item.circle.id}`)}
            />
            <CircleContentCard
              item={item.content}
              userId={userId}
              canInteract
              onChanged={load}
            />
          </section>
        );
      })}
    </div>
  );
}

function CircleHeader({
  circle,
  authorName,
  authorAvatar,
  onOpen,
}: {
  circle: CircleSummary;
  authorName?: string;
  authorAvatar?: string | null;
  onOpen: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-3 px-1">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
          {circle.cover_url ? <img src={circle.cover_url} alt="" className="h-full w-full object-cover" /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-[13px] font-black">
            {circle.name}
            {circle.is_private ? <LockKeyhole className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
          </span>
          {authorName ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {authorAvatar ? <img src={authorAvatar} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
              {authorName}
            </span>
          ) : (
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">Latest post</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-black text-muted-foreground"
      >
        View Circle
      </button>
    </div>
  );
}
