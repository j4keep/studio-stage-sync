import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, TrendingUp, Music, Headphones, Radio, ShoppingBag, Swords, Film, Heart, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRadio } from "@/contexts/RadioContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTakeABreak } from "@/hooks/use-take-a-break";
import TakeABreakGate from "@/components/TakeABreakGate";
import whetuatLogo from "@/assets/wheuat-logo.png";
import album1 from "@/assets/album-1.jpg";
import artistNiaVox from "@/assets/artist-nia-vox.jpg";
import artistKingMelo from "@/assets/artist-king-melo.jpg";
import artistZaraBeats from "@/assets/artist-zara-beats.jpg";
import artistDjOnyx from "@/assets/artist-dj-onyx.jpg";
import artistLyricSoul from "@/assets/artist-lyric-soul.jpg";
import artistNovaWave from "@/assets/artist-nova-wave.jpg";

import cardRadio from "@/assets/card-radio.jpg";
import cardSongs from "@/assets/card-songs.jpg";
import cardBattles from "@/assets/card-battles.jpg";
import FeedPostCard from "@/components/feed/FeedPostCard";
import { fetchFeedItems } from "@/lib/feed-items";

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

interface TrendingCreator {
  id: string;
  name: string;
  img: string;
  score: number;
}

const PLACEHOLDER_CREATORS: TrendingCreator[] = [
  { id: "placeholder-1", name: "Nia Vox", img: artistNiaVox, score: 0 },
  { id: "placeholder-2", name: "King Melo", img: artistKingMelo, score: 0 },
  { id: "placeholder-3", name: "Zara Beats", img: artistZaraBeats, score: 0 },
  { id: "placeholder-4", name: "DJ Onyx", img: artistDjOnyx, score: 0 },
  { id: "placeholder-5", name: "Lyric Soul", img: artistLyricSoul, score: 0 },
  { id: "placeholder-6", name: "Nova Wave", img: artistNovaWave, score: 0 },
];

const fetchTrendingCreators = async (): Promise<TrendingCreator[]> => {
  // Score = total likes + total views across posts/songs/videos.
  const [{ data: posts }, { data: songs }, { data: videos }, { data: likes }] = await Promise.all([
    (supabase as any).from("posts").select("id, user_id"),
    (supabase as any).from("songs").select("user_id, play_count"),
    (supabase as any).from("videos").select("user_id, views"),
    (supabase as any).from("likes").select("content_id, content_type"),
  ]);

  const score = new Map<string, number>();

  // Views from songs/videos
  (songs || []).forEach((s: any) => {
    if (!s.user_id) return;
    score.set(s.user_id, (score.get(s.user_id) || 0) + (s.play_count || 0));
  });
  (videos || []).forEach((v: any) => {
    if (!v.user_id) return;
    score.set(v.user_id, (score.get(v.user_id) || 0) + (v.views || 0));
  });

  // Likes on posts
  const postOwners = new Map<string, string>();
  (posts || []).forEach((p: any) => postOwners.set(p.id, p.user_id));
  (likes || []).forEach((l: any) => {
    if (l.content_type !== "post") return;
    const owner = postOwners.get(l.content_id);
    if (owner) score.set(owner, (score.get(owner) || 0) + 1);
  });

  const userIds = [...score.keys()];
  if (!userIds.length) return PLACEHOLDER_CREATORS;

  const { data: profiles } = await (supabase as any)
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);

  const list: TrendingCreator[] = (profiles || [])
    .filter((p: any) => p.display_name)
    .map((p: any) => ({
      id: p.user_id,
      name: p.display_name,
      img: p.avatar_url || "",
      score: score.get(p.user_id) || 0,
    }))
    .sort((a: TrendingCreator, b: TrendingCreator) => b.score - a.score);

  if (list.length < 6) {
    return [...list, ...PLACEHOLDER_CREATORS.slice(0, 6 - list.length)];
  }
  return list.slice(0, 12);
};

const QUICK_TABS = [
  { label: "Radio", path: "/radio", Icon: Radio },
  { label: "Battle", path: "/battles", Icon: Swords },
  { label: "WHEUAT.TV", path: "/tv/wheuat", Icon: Film },
  { label: "Songs", path: "/browse-songs", Icon: Music },
  { label: "Support", path: "/dollar-club", Icon: Heart, iconOnly: true },
];

const CATEGORY_CARDS = [
  { label: "Radio", img: cardRadio, path: "/radio", wide: true, Icon: Radio },
  { label: "Battles", img: cardBattles, path: "/battles", wide: true, Icon: Swords },
  { label: "WHEUAT.TV", img: cardSongs, path: "/tv/wheuat", wide: true, Icon: Film },
  { label: "Songs", img: cardSongs, path: "/browse-songs", wide: false, Icon: Music },
  { label: "Shop", img: cardRadio, path: "/store", wide: false, Icon: ShoppingBag },
];

const HomePage = () => {
  const navigate = useNavigate();
  const radio = useRadio();
  const { user } = useAuth();
  const { onBreak } = useTakeABreak();

  const { data: trendingCreators = [] } = useQuery({
    queryKey: ["homepage-trending-creators"],
    queryFn: fetchTrendingCreators,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const { data: items = [], isLoading: feedLoading } = useQuery({
    queryKey: ["home-feed-posts"],
    queryFn: () => fetchFeedItems({ currentUserId: user?.id }),
    enabled: !onBreak,
  });
  const feedPosts = items.filter((i: any) => i.itemType === "post");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(idx)) setCurrentIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 },
    );
    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feedPosts.length]);

  const currentRadioTrack = radio.currentTrack;

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-center mb-4">
        <img src={whetuatLogo} alt="WHEUAT" className="h-8 mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Quick tabs row (replaces For You/Following/Trending/New) */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {QUICK_TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => navigate(t.path)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-card border border-border hover:border-primary/50 hover:text-primary transition-colors text-xs font-semibold"
            title={t.label}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {!t.iconOnly && <span>{t.label}</span>}
          </button>
        ))}
        <button
          onClick={() => navigate("/browse-songs")}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-card border border-border hover:border-primary/50 transition-colors ml-auto"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Radio mini player */}
      <motion.section {...fadeUp} className="mb-6">
        <button onClick={() => navigate("/radio")} className="w-full p-4 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-all group">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <img src={currentRadioTrack?.cover_url || album1} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
                <motion.div animate={radio.isPlaying ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <Headphones className="w-5 h-5 text-primary" />
                </motion.div>
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">WHEUAT Radio</span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-muted-foreground">LIVE</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{currentRadioTrack?.title || "Tap to tune in"}</p>
              <p className="text-xs text-muted-foreground">{currentRadioTrack?.artist_name || ""}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); radio.toggle(); }} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center glow-primary shrink-0">
              {radio.isPlaying ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
            </button>
          </div>
        </button>
      </motion.section>

      {/* Trending Creators (auto-ranked: likes + views) */}
      <motion.section {...fadeUp} transition={{ delay: 0.05 }} className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Trending Creators</h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {trendingCreators.map((a) => (
            <button
              key={a.id}
              onClick={() => !a.id.startsWith("placeholder") && navigate(`/artist/${a.id}`)}
              className="flex flex-col items-center gap-2 min-w-[72px] group"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all bg-muted">
                {a.img ? <img src={a.img} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">{a.name[0]}</div>}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate w-full text-center">{a.name}</span>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Category cards (Radio/Battles/WHEUAT.TV/Songs/Shop) */}
      <motion.section {...fadeUp} transition={{ delay: 0.08 }} className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_CARDS.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={card.wide ? "col-span-2" : ""}>
              <button
                onClick={() => navigate(card.path)}
                className={`relative overflow-hidden rounded-xl w-full ${card.wide ? "aspect-[2.5/1]" : "aspect-square"} group`}
              >
                <img src={card.img} alt={card.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/30" />
                <span className="absolute bottom-3 left-3 flex items-center gap-2 text-white font-display font-bold text-sm tracking-wide drop-shadow-lg">
                  <card.Icon className="w-5 h-5" />
                  {card.label}
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Feed */}
      <TakeABreakGate area="The Feed">
        <motion.section {...fadeUp} transition={{ delay: 0.12 }}>
          <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide mb-3">Feed</h2>
          {feedLoading ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedPosts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No posts yet — tap the + button to create one.</div>
          ) : (
            <div
              ref={scrollRef}
              className="h-[80vh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide rounded-2xl bg-black"
              style={{ scrollSnapType: "y mandatory" }}
            >
              {feedPosts.map((item: any, index: number) => (
                <div
                  key={item.id}
                  data-index={index}
                  className="h-[80vh] w-full snap-start snap-always relative"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <FeedPostCard post={item} currentUserId={user?.id} isActive={index === currentIndex} />
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </TakeABreakGate>
    </div>
  );
};

export default HomePage;
