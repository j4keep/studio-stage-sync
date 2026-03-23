import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ContentType = "song" | "video" | "podcast";

export const useLikes = (contentType: ContentType, contentIds: string[]) => {
  const { user } = useAuth();
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (contentIds.length === 0) return;
    
    // Fetch like counts from the content tables
    const table = contentType === "song" ? "songs" : contentType === "video" ? "videos" : "podcasts";
    (supabase as any)
      .from(table)
      .select("id, likes_count")
      .in("id", contentIds)
      .then(({ data }: any) => {
        if (data) {
          const counts: Record<string, number> = {};
          data.forEach((d: any) => { counts[d.id] = d.likes_count || 0; });
          setLikeCounts(counts);
        }
      });

    // Fetch user's likes
    if (user) {
      (supabase as any)
        .from("likes")
        .select("content_id")
        .eq("user_id", user.id)
        .eq("content_type", contentType)
        .in("content_id", contentIds)
        .then(({ data }: any) => {
          if (data) {
            setUserLikes(new Set(data.map((d: any) => d.content_id)));
          }
        });
    }
  }, [contentIds.join(","), user?.id, contentType]);

  const toggleLike = useCallback(async (contentId: string) => {
    if (!user) return;
    
    const isLiked = userLikes.has(contentId);
    
    // Optimistic update
    setUserLikes(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(contentId) : next.add(contentId);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [contentId]: (prev[contentId] || 0) + (isLiked ? -1 : 1),
    }));

    if (isLiked) {
      await (supabase as any)
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("content_type", contentType)
        .eq("content_id", contentId);
    } else {
      await (supabase as any)
        .from("likes")
        .insert({ user_id: user.id, content_type: contentType, content_id: contentId });
    }
  }, [user, userLikes, contentType]);

  const isLiked = useCallback((contentId: string) => userLikes.has(contentId), [userLikes]);
  const getLikeCount = useCallback((contentId: string) => likeCounts[contentId] || 0, [likeCounts]);

  return { toggleLike, isLiked, getLikeCount };
};

// Increment play count for a song
export const incrementSongPlays = async (songId: string) => {
  await (supabase as any).rpc("increment_song_plays", { song_id: songId });
};

// Increment view count for a video
export const incrementVideoViews = async (videoId: string) => {
  await (supabase as any).rpc("increment_video_views", { video_id: videoId });
};

// Increment play count for a podcast
export const incrementPodcastPlays = async (podcastId: string) => {
  await (supabase as any).rpc("increment_podcast_plays", { podcast_id: podcastId });
};

// Increment view count for a post
export const incrementPostViews = async (postId: string) => {
  await (supabase as any).rpc("increment_post_views", { post_id: postId });
};

// Increment view count for a battle
export const incrementBattleViews = async (battleId: string) => {
  await (supabase as any).rpc("increment_battle_views", { battle_id: battleId });
};
