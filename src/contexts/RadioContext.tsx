import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { incrementSongPlays } from "@/hooks/use-likes";
import album1 from "@/assets/album-1.jpg";

interface RadioTrack {
  id: string;
  title: string;
  artist_name: string;
  album: string;
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
  previous: () => void;
  skipsLeft: number;
  playTrack: (track: RadioTrack) => void;
  setGenreFilter: (genre: string) => void;
  activeGenre: string;
  loading: boolean;
  fetchRadioSongs: () => Promise<void>;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  shuffled: boolean;
  toggleShuffle: () => void;
}

const RadioContext = createContext<RadioContextType | null>(null);

export const useRadio = () => {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used within RadioProvider");
  return ctx;
};

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const RadioProvider = ({ children }: { children: ReactNode }) => {
  const [songs, setSongs] = useState<RadioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(6);
  const [activeGenre, setActiveGenre] = useState("All");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffled, setShuffled] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef<Set<string>>(new Set());

  // Use refs so the ended handler always has fresh state
  const songsRef = useRef(songs);
  const activeGenreRef = useRef(activeGenre);
  const shuffledRef = useRef(shuffled);
  const shuffleOrderRef = useRef(shuffleOrder);

  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { activeGenreRef.current = activeGenre; }, [activeGenre]);
  useEffect(() => { shuffledRef.current = shuffled; }, [shuffled]);
  useEffect(() => { shuffleOrderRef.current = shuffleOrder; }, [shuffleOrder]);

  const getFilteredFromRef = () => {
    return songsRef.current.filter(s => activeGenreRef.current === "All" || s.genre === activeGenreRef.current);
  };

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("ended", () => {
      const filtered = getFilteredFromRef();
      if (filtered.length === 0) return;

      if (filtered.length === 1) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      // Advance to next track (loops back to 0)
      setCurrentIndex(prev => (prev + 1) % filtered.length);
      setIsPlaying(true);
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
    const filtered = songs.filter(s => activeGenre === "All" || s.genre === activeGenre);
    if (!shuffled || shuffleOrder.length !== filtered.length) return filtered;
    // Return in shuffle order
    return shuffleOrder.map(i => filtered[i]).filter(Boolean);
  }, [songs, activeGenre, shuffled, shuffleOrder]);

  const filteredSongs = getFiltered();
  const safeIndex = filteredSongs.length > 0 ? currentIndex % filteredSongs.length : 0;
  const currentTrack = filteredSongs[safeIndex] || null;
  const queue = filteredSongs.filter((_, i) => i !== safeIndex);

  // Generate shuffle order when needed
  const regenerateShuffle = useCallback((len: number) => {
    const order = shuffleArray(Array.from({ length: len }, (_, i) => i));
    setShuffleOrder(order);
  }, []);

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

  // Apply volume changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Reset index on genre change & regenerate shuffle
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    const filtered = songs.filter(s => activeGenre === "All" || s.genre === activeGenre);
    if (shuffled && filtered.length > 0) regenerateShuffle(filtered.length);
  }, [activeGenre, songs, shuffled, regenerateShuffle]);

  const fetchRadioSongs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("songs")
      .select("id, title, cover_url, audio_url, plays, genre, user_id, likes_count, album")
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
        album: s.album || "Unknown Album",
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

  const previous = useCallback(() => {
    if (filteredSongs.length > 1) {
      setCurrentIndex(prev => (prev - 1 + filteredSongs.length) % filteredSongs.length);
    }
  }, [filteredSongs.length]);

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

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffled(prev => {
      const next = !prev;
      if (next) {
        const filtered = songsRef.current.filter(s => activeGenreRef.current === "All" || s.genre === activeGenreRef.current);
        regenerateShuffle(filtered.length);
      }
      setCurrentIndex(0);
      return next;
    });
  }, [regenerateShuffle]);

  return (
    <RadioContext.Provider value={{
      isPlaying, currentTrack, queue, allTracks: filteredSongs,
      play, pause, toggle, skip, previous, skipsLeft, playTrack,
      setGenreFilter, activeGenre, loading, fetchRadioSongs,
      currentTime, duration, seek,
      volume, setVolume, shuffled, toggleShuffle,
    }}>
      {children}
    </RadioContext.Provider>
  );
};
