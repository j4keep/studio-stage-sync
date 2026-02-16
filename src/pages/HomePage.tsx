import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, TrendingUp, Music, Video, DollarSign, Headphones, Radio, Building2, ShoppingBag, CircleDollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRadio } from "@/contexts/RadioContext";
import { useAuth } from "@/contexts/AuthContext";
import whetuatLogo from "@/assets/wheuat-logo.png";
import album1 from "@/assets/album-1.jpg";
import artistNiaVox from "@/assets/artist-nia-vox.jpg";
import artistKingMelo from "@/assets/artist-king-melo.jpg";
import artistZaraBeats from "@/assets/artist-zara-beats.jpg";
import artistDjOnyx from "@/assets/artist-dj-onyx.jpg";
import artistLyricSoul from "@/assets/artist-lyric-soul.jpg";
import artistNovaWave from "@/assets/artist-nova-wave.jpg";

import cardRadio from "@/assets/card-radio.jpg";
import cardStore from "@/assets/card-store.jpg";
import cardStudios from "@/assets/card-studios.jpg";
import cardSongs from "@/assets/card-songs.jpg";
import cardVideos from "@/assets/card-videos.jpg";
import cardProjects from "@/assets/card-projects.jpg";
import cardDollarClub from "@/assets/card-dollarclub.jpg";

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

interface TrendingArtist {
  id: string;
  name: string;
  img: string;
}

const PLACEHOLDER_ARTISTS: TrendingArtist[] = [
  { id: "placeholder-1", name: "Nia Vox", img: artistNiaVox },
  { id: "placeholder-2", name: "King Melo", img: artistKingMelo },
  { id: "placeholder-3", name: "Zara Beats", img: artistZaraBeats },
  { id: "placeholder-4", name: "DJ Onyx", img: artistDjOnyx },
  { id: "placeholder-5", name: "Lyric Soul", img: artistLyricSoul },
  { id: "placeholder-6", name: "Nova Wave", img: artistNovaWave },
];

const fetchTrendingArtists = async (userId?: string): Promise<TrendingArtist[]> => {
  // Fetch artists who have uploaded songs to radio
  const { data: radioSongs } = await (supabase as any)
    .from("songs")
    .select("user_id")
    .eq("on_radio", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const realArtists: TrendingArtist[] = [];

  if (radioSongs && radioSongs.length > 0) {
    const uniqueUserIds = [...new Set(radioSongs.map((s: any) => s.user_id))] as string[];
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", uniqueUserIds);

    if (profiles) {
      const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
      uniqueUserIds.forEach((uid) => {
        const p = profileMap.get(uid) as any;
        if (p && p.display_name) {
          realArtists.push({ id: p.user_id, name: p.display_name, img: p.avatar_url || "" });
        }
      });
    }
  }

  // Add current user if they have a profile and aren't already listed
  if (userId && !realArtists.find((a) => a.id === userId)) {
    const { data: profile } = await (supabase as any).from("profiles").select("user_id, display_name, avatar_url").eq("user_id", userId).maybeSingle();
    if (profile?.display_name) {
      realArtists.push({ id: profile.user_id, name: profile.display_name, img: profile.avatar_url || "" });
    }
  }

  // Fill remaining spots with placeholders
  const needed = Math.max(0, 6 - realArtists.length);
  return [...realArtists, ...PLACEHOLDER_ARTISTS.slice(0, needed)];
};

// All cards now navigate to dedicated pages
const CATEGORY_CARDS = [
  { label: "Radio", img: cardRadio, path: "/radio", wide: true, icon: Radio },
  { label: "Store", img: cardStore, path: "/store", wide: false, icon: ShoppingBag },
  { label: "Studios", img: cardStudios, path: "/studios", wide: false, icon: Building2 },
  { label: "Songs", img: cardSongs, path: "/browse-songs", wide: false, icon: Music },
  { label: "Videos", img: cardVideos, path: "/browse-videos", wide: false, icon: Video },
  { label: "Projects", img: cardProjects, path: "/my-projects", wide: true, icon: DollarSign },
  { label: "Dollar Club", img: cardDollarClub, path: "/dollar-club", wide: true, icon: CircleDollarSign },
];

const HomePage = () => {
  const navigate = useNavigate();
  const radio = useRadio();
  const { user } = useAuth();

  const { data: trendingArtists = [] } = useQuery({
    queryKey: ["homepage-trending-artists", user?.id],
    queryFn: () => fetchTrendingArtists(user?.id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const currentRadioTrack = radio.currentTrack;

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-center mb-6">
        <img src={whetuatLogo} alt="WHEUAT" className="h-8 mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* WHEUAT Radio Mini Player */}
      <motion.section {...fadeUp} className="mb-8">
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

      {/* Trending Artists */}
      <motion.section {...fadeUp} transition={{ delay: 0.05 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">Trending Artists</h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {trendingArtists.length > 0 ? trendingArtists.map((a) => (
            <button key={a.id} onClick={() => !a.id.startsWith("placeholder") && navigate(`/profile?user=${a.id}`)} className="flex flex-col items-center gap-2 min-w-[72px] group">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all bg-muted">
                {a.img ? <img src={a.img} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">{a.name[0]}</div>}
              </div>
              <span className="text-[11px] font-medium text-foreground truncate w-full text-center">{a.name}</span>
            </button>
          )) : (
            <p className="text-xs text-muted-foreground">No artists yet</p>
          )}
        </div>
      </motion.section>

      {/* Category Cards Grid */}
      <motion.section {...fadeUp} transition={{ delay: 0.1 }} className="mb-8">
        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_CARDS.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={card.wide ? "col-span-2" : ""}>
              <button
                onClick={() => navigate(card.path)}
                className={`relative overflow-hidden rounded-xl w-full ${card.wide ? "aspect-[2.5/1]" : "aspect-square"} group`}
              >
                <img src={card.img} alt={card.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/20" />
                <span className="absolute bottom-3 left-3 flex items-center gap-2 text-white font-display font-bold text-sm tracking-wide drop-shadow-lg">
                  <card.icon className="w-5 h-5" />
                  {card.label}
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
};

export default HomePage;
