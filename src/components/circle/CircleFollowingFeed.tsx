import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CircleContentCard from "@/components/circle/CircleContentCard";
import { listCircleContents, type CircleContent } from "@/lib/circle-content";
import { getCircle, type CircleMember } from "@/lib/circles";
import { sessionLooksExclusive, type CircleLiveSession } from "@/lib/circle-live";

const sb = supabase as any;

type CircleSummary = {
  id: string;
  name: string;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  owner_id: string;
};

type FeedItem = {
  content: CircleContent;
  circle: CircleSummary;
  authorName: string;
  authorAvatar: string | null;
};

type LiveFeedItem = {
  session: CircleLiveSession;
  circle: CircleSummary;
  hostName: string;
  hostAvatar: string | null;
};

export default function CircleFollowingFeed({ userId, ownCircleId }: { userId: string; ownCircleId?: string | null }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [liveItems, setLiveItems] = useState<LiveFeedItem[]>([]);

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
        setLiveItems([]);
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


      const { data: liveRows } = await sb
        .from("circle_live_sessions")
        .select("*")
        .in("circle_id", allCircleIds)
        .eq("status", "live")
        .order("started_at", { ascending: false });

      const visibleLives = ((liveRows as CircleLiveSession[]) || []).filter(
        (session) => Boolean(session.circle_id) && !sessionLooksExclusive(session),
      );

      const profileIds = Array.from(
        new Set([
          ...contents.map((content) => content.author_id),
          ...visibleLives.map((session) => session.host_user_id),
        ]),
      );
      const { data: profiles } = profileIds.length
        ? await sb.from("profiles").select("user_id,display_name,avatar_url").in("user_id", profileIds)
        : { data: [] };
      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, { name: p.display_name || "YAJ member", avatar: p.avatar_url || null }]),
      );

      setLiveItems(
        visibleLives
          .map((session) => {
            const circle = session.circle_id ? circleMap.get(session.circle_id) : null;
            if (!circle) return null;
            const profile = profileMap.get(session.host_user_id) as { name: string; avatar: string | null } | undefined;
            return {
              session,
              circle,
              hostName: profile?.name || "YAJ member",
              hostAvatar: profile?.avatar || null,
            } satisfies LiveFeedItem;
          })
          .filter((item): item is LiveFeedItem => Boolean(item)),
      );

      setItems(
        contents
          .map((content) => {
            const circle = circleMap.get(content.circle_id);
            if (!circle) return null;
            const profile = profileMap.get(content.author_id) as { name: string; avatar: string | null } | undefined;
            return {
              content,
              circle,
              authorName: profile?.name || "YAJ member",
              authorAvatar: profile?.avatar || null,
            } satisfies FeedItem;
          })
          .filter((item): item is FeedItem => Boolean(item)),
      );
    } catch {
      setItems([]);
      setLiveItems([]);
    }
  }, [ownCircleId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`circle-home-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_live_sessions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  if (items === null) {
    return <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">Loading Circle updates…</p>;
  }

  if (!items.length && liveItems.length === 0) {
    return (
      <div className="mx-4 mt-6 rounded-[28px] border border-border bg-card px-6 py-12 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-black">No Circle posts yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Posts created inside your Circle and Circles you joined will appear here. Main Feed posts stay on the main Feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 lg:px-6">
      {liveItems.map(({ session, circle, hostName, hostAvatar }) => (
        <section
          key={session.id}
          className="overflow-hidden rounded-[26px] border border-red-500/20 bg-card shadow-sm"
        >
          <button
            type="button"
            onClick={() => navigate(`/circle/c/${circle.id}/live`)}
            className="block w-full text-left"
          >
            <div className="relative aspect-[16/8.5] overflow-hidden bg-neutral-950">
              {circle.cover_url ? (
                <img src={circle.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-red-600" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/15" />

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.14em]">Live now</span>
              </div>

              <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white bg-muted shadow-lg">
                  {hostAvatar ? (
                    <img src={hostAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/20 text-sm font-black text-white">
                      {hostName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-white">
                  <p className="truncate text-[16px] font-black">{hostName} is live</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-white/75">{circle.name}</p>
                </div>
                <span className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-[11px] font-black text-black">
                  <Radio className="h-4 w-4 text-red-600" />
                  Watch
                </span>
              </div>
            </div>
          </button>
        </section>
      ))}

      {items.map(({ content, circle, authorName, authorAvatar }) => (
        <section key={content.id} className="overflow-hidden rounded-[24px]">
          <div className="mb-2 flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${circle.id}`)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                {circle.cover_url ? <img src={circle.cover_url} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-black">
                  {circle.name}
                  {circle.is_private ? <LockKeyhole className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  {authorAvatar ? <img src={authorAvatar} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
                  {authorName}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/circle/c/${circle.id}`)}
              className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-black text-muted-foreground"
            >
              View Circle
            </button>
          </div>

          <CircleContentCard
            item={content}
            userId={userId}
            canInteract
            onChanged={load}
          />
        </section>
      ))}
    </div>
  );
}
