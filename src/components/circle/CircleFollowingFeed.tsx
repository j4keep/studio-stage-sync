import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CircleContentCard from "@/components/circle/CircleContentCard";
import FeedThumbCard from "@/components/feed/FeedThumbCard";
import FeedFullscreenViewer from "@/components/feed/FeedFullscreenViewer";
import { listCircleContents, type CircleContent } from "@/lib/circle-content";
import { getCircle, type CircleMember } from "@/lib/circles";
import { listBlockedPeerIds } from "@/lib/blocks";

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
  source: "circle";
  content: CircleContent;
  circle: CircleSummary;
  authorName: string;
  authorAvatar: string | null;
};

type SocialFeedItem = {
  source: "social";
  post: any;
};

type FeedItem = CircleFeedItem | SocialFeedItem;

export default function CircleFollowingFeed({ userId, ownCircleId }: { userId: string; ownCircleId?: string | null }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [socialViewerIndex, setSocialViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [membershipResult, followingResult, followerResult, blockedIds] = await Promise.all([
        sb.from("circle_members").select("circle_id, role, status").eq("user_id", userId).eq("status", "approved"),
        sb.from("follows").select("following_id").eq("follower_id", userId),
        sb.from("follows").select("follower_id").eq("following_id", userId),
        listBlockedPeerIds(userId),
      ]);
      const { data: membershipRows, error: membershipError } = membershipResult;
      if (membershipError) throw membershipError;

      const memberships = ((membershipRows as Pick<CircleMember, "circle_id" | "role" | "status">[]) || []);
      const roleByCircle = new Map(memberships.map((m) => [m.circle_id, m.role]));
      const circleIds = Array.from(
        new Set([
          ...memberships.map((m) => m.circle_id),
          ...(ownCircleId ? [ownCircleId] : []),
        ]),
      );

      // Shared feed: posts from my own Circle, Circles I joined, and Circles owned by
      // people I follow. The RPC applies visibility rules server-side.
      let contentData: CircleContent[] = [];
      const { data: rpcRows, error: rpcError } = await sb.rpc("yaj_my_circle_home_contents");
      if (!rpcError && Array.isArray(rpcRows)) {
        contentData = rpcRows as CircleContent[];
      } else {
        // Compatibility fallback for deployments where the new feed RPC is not live yet.
        const perCircle = await Promise.all(
          circleIds.map(async (circleId) => {
            try {
              return await listCircleContents(circleId, { userId });
            } catch {
              return [] as CircleContent[];
            }
          }),
        );
        contentData = perCircle.flat();
      }

      // Resolve every Circle referenced by the feed — including Circles I follow but
      // have not joined — so followed creators' posts are not dropped.
      const allCircleIds = Array.from(
        new Set([...circleIds, ...contentData.map((item) => item.circle_id)]),
      );

      if (!allCircleIds.length) {
        setItems([]);
        return;
      }

      const circles = (
        await Promise.all(
          allCircleIds.map(async (circleId) => {
            try {
              return await getCircle(circleId);
            } catch {
              return null;
            }
          }),
        )
      ).filter((circle): circle is NonNullable<typeof circle> => Boolean(circle)) as CircleSummary[];

      const circleMap = new Map(circles.map((c) => [c.id, c]));

      const contents = contentData.filter((item) => {
        if (item.visibility === "only_me") return item.author_id === userId;
        if (item.visibility === "paid_members") {
          const circle = circleMap.get(item.circle_id);
          if (circle?.owner_id === userId) return true;
          const role = roleByCircle.get(item.circle_id);
          return role === "paid_member" || role === "owner" || role === "admin";
        }
        return true;
      });


      const authorIds = Array.from(new Set(contents.map((c) => c.author_id)));
      const { data: profiles } = authorIds.length
        ? await sb.from("profiles").select("user_id,display_name,avatar_url").in("user_id", authorIds)
        : { data: [] };
      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, { name: p.display_name || "YAJ member", avatar: p.avatar_url || null }]),
      );

      const circleItems = contents
          .map((content) => {
            const circle = circleMap.get(content.circle_id);
            if (!circle) return null;
            const profile = profileMap.get(content.author_id) as { name: string; avatar: string | null } | undefined;
            return {
              source: "circle" as const,
              content,
              circle,
              authorName: profile?.name || "YAJ member",
              authorAvatar: profile?.avatar || null,
            } satisfies CircleFeedItem;
          })
          .filter((item): item is CircleFeedItem => Boolean(item));

      // Circle Home is the user's people feed: include their own regular posts, people
      // they follow, and people following them. Blocking always wins over a connection.
      const connectedUserIds = new Set<string>([userId]);
      for (const row of followingResult.data || []) connectedUserIds.add(row.following_id);
      for (const row of followerResult.data || []) connectedUserIds.add(row.follower_id);
      for (const blockedId of blockedIds) connectedUserIds.delete(blockedId);

      let socialItems: SocialFeedItem[] = [];
      if (connectedUserIds.size) {
        const { data: posts, error: postsError } = await sb
          .from("posts")
          .select("*")
          .in("user_id", Array.from(connectedUserIds))
          .order("created_at", { ascending: false })
          .limit(150);
        if (postsError) throw postsError;

        const socialPosts = posts || [];
        const socialAuthorIds = Array.from(new Set(socialPosts.map((post: any) => post.user_id)));
        const socialPostIds = socialPosts.map((post: any) => post.id);
        const [{ data: socialProfiles }, { data: postLikes }] = await Promise.all([
          socialAuthorIds.length
            ? sb.from("profiles").select("user_id,display_name,avatar_url").in("user_id", socialAuthorIds)
            : Promise.resolve({ data: [] }),
          socialPostIds.length
            ? sb.from("likes").select("content_id,user_id").eq("content_type", "post").in("content_id", socialPostIds)
            : Promise.resolve({ data: [] }),
        ]);
        const socialProfileMap = new Map((socialProfiles || []).map((profile: any) => [profile.user_id, profile]));
        const likeCounts = new Map<string, number>();
        const likedIds = new Set<string>();
        for (const like of postLikes || []) {
          likeCounts.set(like.content_id, (likeCounts.get(like.content_id) || 0) + 1);
          if (like.user_id === userId) likedIds.add(like.content_id);
        }
        socialItems = socialPosts.map((post: any) => ({
          source: "social" as const,
          post: {
            ...post,
            itemType: "post",
            profile: socialProfileMap.get(post.user_id) || { display_name: "YAJ member", avatar_url: null },
            likes_count: likeCounts.get(post.id) ?? post.likes_count ?? 0,
            isLiked: likedIds.has(post.id),
          },
        }));
      }

      setItems(
        [...circleItems, ...socialItems].sort((a, b) => {
          const aDate = a.source === "circle" ? a.content.created_at : a.post.created_at;
          const bDate = b.source === "circle" ? b.content.created_at : b.post.created_at;
          return String(bDate).localeCompare(String(aDate));
        }),
      );
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
        <h2 className="mt-4 text-xl font-black">No Circle posts yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Your posts and posts from people or Circles connected to you will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 lg:px-6">
      {items.map((item) => item.source === "social" ? (
        <section key={`social-${item.post.id}`} className="overflow-hidden rounded-[24px]">
          <FeedThumbCard
            post={item.post}
            onOpen={() => {
              const socialItems = items.filter((candidate): candidate is SocialFeedItem => candidate.source === "social");
              setSocialViewerIndex(socialItems.findIndex((candidate) => candidate.post.id === item.post.id));
            }}
          />
        </section>
      ) : (
        <section key={`circle-${item.content.id}`} className="overflow-hidden rounded-[24px]">
          <div className="mb-2 flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${item.circle.id}`)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                {item.circle.cover_url ? <img src={item.circle.cover_url} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-black">
                  {item.circle.name}
                  {item.circle.is_private ? <LockKeyhole className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  {item.authorAvatar ? <img src={item.authorAvatar} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
                  {item.authorName}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${item.circle.id}`)}
              className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-black text-muted-foreground"
            >
              View Circle
            </button>
          </div>

          <CircleContentCard
            item={item.content}
            userId={userId}
            canInteract
            onChanged={load}
          />
        </section>
      ))}
      {socialViewerIndex !== null && socialViewerIndex >= 0 ? (
        <FeedFullscreenViewer
          items={items
            .filter((item): item is SocialFeedItem => item.source === "social")
            .map((item) => item.post)}
          startIndex={socialViewerIndex}
          currentUserId={userId}
          onClose={() => setSocialViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}
