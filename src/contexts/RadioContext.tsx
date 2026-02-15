import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { incrementSongPlays } from "@/hooks/use-likes";
import album1 from "@/assets/album-1.jpg";

interface RadioTrack {
  id: string;
  title: string;
  artist_name: string;
  genre: string;
  cover_url: string;
  audio_url?: string;
  plays: string;
  likes_count: number;
  user_id?: string;
}

interface RadioContextType {
  isPlaying: boolean;
  currentTrack: RadioTrack | null;
  queue: RadioTrack[];
  allTracks: RadioTrack[];
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skip: () => void;
  skipsLeft: number;
  playTrack: (track: RadioTrack) => void;
  setGenreFilter: (genre: string) => void;
  activeGenre: string;
  loading: boolean;
  fetchRadioSongs: () => Promise<void>;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
}

const RadioContext = createContext<RadioContextType | null>(null);

export const useRadio = () => {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used within RadioProvider");
  return ctx;
};

export const RadioProvider = ({ children }: { children: ReactNode }) => {
  const [songs, setSongs] = useState<RadioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(6);
  const [activeGenre, setActiveGenre] = useState("All");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef<Set<string>>(new Set());

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      setCurrentIndex(prev => {
        const filtered = getFiltered();
        if (filtered.length <= 1) return prev;
        return (prev + 1) % filtered.length;
      });
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    audio.addEventListener("durationchange", () => {
      setDuration(audio.duration);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const getFiltered = useCallback(() => {
    return songs.filter(s => activeGenre === "All" || s.genre === activeGenre);
  }, [songs, activeGenre]);

  const filteredSongs = getFiltered();
  const safeIndex = filteredSongs.length > 0 ? currentIndex % filteredSongs.length : 0;
  const currentTrack = filteredSongs[safeIndex] || null;
  const queue = filteredSongs.filter((_, i) => i !== safeIndex);

  // Handle audio src changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audio_url) return;

    if (audio.src !== currentTrack.audio_url) {
      audio.src = currentTrack.audio_url;
    }

    if (isPlaying) {
      audio.play().catch(() => {});
      if (!playTracked.current.has(currentTrack.id)) {
        playTracked.current.add(currentTrack.id);
        incrementSongPlays(currentTrack.id);
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id, currentTrack?.audio_url]);

  // Reset index on genre change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [activeGenre]);

  const fetchRadioSongs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("songs")
      .select("id, title, cover_url, audio_url, plays, genre, user_id, likes_count")
      .eq("on_radio", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.display_name || "Artist"; });

      setSongs(data.map((s: any) => ({
        id: s.id,
        title: s.title,
        artist_name: profileMap[s.user_id] || "Artist",
        genre: s.genre || "All Music",
        cover_url: s.cover_url || album1,
        audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
        plays: s.plays || "0",
        likes_count: s.likes_count || 0,
        user_id: s.user_id,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRadioSongs(); }, [fetchRadioSongs]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying(p => !p), []);

  const skip = useCallback(() => {
    if (skipsLeft > 0 && filteredSongs.length > 1) {
      setCurrentIndex(prev => (prev + 1) % filteredSongs.length);
      setSkipsLeft(s => s - 1);
    }
  }, [skipsLeft, filteredSongs.length]);

  const playTrack = useCallback((track: RadioTrack) => {
    const idx = filteredSongs.findIndex(s => s.id === track.id);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setIsPlaying(true);
    }
  }, [filteredSongs]);

  const setGenreFilter = useCallback((genre: string) => {
    setActiveGenre(genre);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  return (
    <RadioContext.Provider value={{
      isPlaying, currentTrack, queue, allTracks: filteredSongs,
      play, pause, toggle, skip, skipsLeft, playTrack,
      setGenreFilter, activeGenre, loading, fetchRadioSongs,
      currentTime, duration, seek,
    }}>
      {children}
    </RadioContext.Provider>
  );
};
