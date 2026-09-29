import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { incrementPodcastPlays, incrementSongPlays } from "@/hooks/use-likes";
import album1 from "@/assets/album-1.jpg";
import podcast1 from "@/assets/podcast-1.jpg";

export interface RadioTrack {
  id: string;
  source: "song" | "podcast" | "station";
  title: string;
  artist_name: string;
  album: string;
  genre: string;
  cover_url: string;
  audio_url?: string;
  plays: string;
  likes_count: number;
  user_id?: string;
  /** Optional station-programmed in/out points, in seconds. */
  trim_start_seconds?: number;
  trim_end_seconds?: number | null;
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
  /** Number of songs played since last ad was shown */
  songPlayCount: number;
  /** Reset the song play counter (called after ad is shown) */
  resetSongPlayCount: () => void;
  stationMode: boolean;
  stationName: string | null;
  playStationQueue: (tracks: RadioTrack[], stationName: string) => void;
  clearStationQueue: () => void;
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
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(6);
  const [activeGenre, setActiveGenre] = useState("All");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songPlayCount, setSongPlayCount] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffled, setShuffled] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const [stationQueue, setStationQueue] = useState<RadioTrack[] | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTracked = useRef<Set<string>>(new Set());
  const currentTrackRef = useRef<RadioTrack | null>(null);
  const trimAdvancingRef = useRef(false);

  // Use refs so the ended handler always has fresh state
  const songsRef = useRef(songs);
  const stationQueueRef = useRef<RadioTrack[] | null>(null);
  const activeGenreRef = useRef(activeGenre);
  const shuffledRef = useRef(shuffled);
  const shuffleOrderRef = useRef(shuffleOrder);

  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { stationQueueRef.current = stationQueue; }, [stationQueue]);
  useEffect(() => { activeGenreRef.current = activeGenre; }, [activeGenre]);
  useEffect(() => { shuffledRef.current = shuffled; }, [shuffled]);
  useEffect(() => { shuffleOrderRef.current = shuffleOrder; }, [shuffleOrder]);

  const getFilteredFromRef = () => {
    if (stationQueueRef.current) return stationQueueRef.current;
    return songsRef.current.filter(
      s => s.source === "song" && (activeGenreRef.current === "All" || s.genre === activeGenreRef.current),
    );
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
        const start = Number(currentTrackRef.current?.trim_start_seconds || 0);
        audio.currentTime = Number.isFinite(start) && start > 0 ? start : 0;
        audio.play().catch(() => {});
        return;
      }

      // Advance to next track (loops back to 0)
      setCurrentIndex(prev => (prev + 1) % filtered.length);
      setSongPlayCount(prev => prev + 1);
      setIsPlaying(true);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);

      const track = currentTrackRef.current;
      const end = Number(track?.trim_end_seconds);
      if (
        track?.source === "station" &&
        Number.isFinite(end) &&
        end > 0 &&
        audio.currentTime >= end - 0.05 &&
        !trimAdvancingRef.current
      ) {
        trimAdvancingRef.current = true;
        const filtered = getFilteredFromRef();
        if (!filtered.length) return;
        if (filtered.length === 1) {
          const start = Number(track.trim_start_seconds || 0);
          audio.currentTime = Number.isFinite(start) && start > 0 ? start : 0;
          trimAdvancingRef.current = false;
          audio.play().catch(() => {});
          return;
        }
        setCurrentIndex(prev => (prev + 1) % filtered.length);
        setSongPlayCount(prev => prev + 1);
        setIsPlaying(true);
      }
    });

    audio.addEventListener("loadedmetadata", () => {
      const start = Number(currentTrackRef.current?.trim_start_seconds || 0);
      if (Number.isFinite(start) && start > 0 && start < audio.duration) {
        audio.currentTime = start;
        setCurrentTime(start);
      }
      const end = Number(currentTrackRef.current?.trim_end_seconds);
      setDuration(Number.isFinite(end) && end > start ? Math.min(end, audio.duration) : audio.duration);
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
    if (stationQueue) return stationQueue;
    const filtered = songs.filter(
      s => s.source === "song" && (activeGenre === "All" || s.genre === activeGenre),
    );
    if (!shuffled || shuffleOrder.length !== filtered.length) return filtered;
    return shuffleOrder.map(i => filtered[i]).filter(Boolean);
  }, [songs, activeGenre, shuffled, shuffleOrder, stationQueue]);

  const filteredSongs = getFiltered();
  const safeIndex = filteredSongs.length > 0 ? currentIndex % filteredSongs.length : 0;
  const currentTrack = filteredSongs[safeIndex] || null;
  const queue = filteredSongs.filter((_, i) => i !== safeIndex);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    trimAdvancingRef.current = false;
  }, [currentTrack?.id]);

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
      trimAdvancingRef.current = false;
    }

    if (audio.readyState >= 1 && currentTrack.source === "station") {
      const start = Number(currentTrack.trim_start_seconds || 0);
      if (Number.isFinite(start) && start >= 0 && audio.currentTime < start) {
        audio.currentTime = start;
        setCurrentTime(start);
      }
    }

    if (isPlaying) {
      audio.play().catch(() => {});
      if (!playTracked.current.has(currentTrack.id)) {
        playTracked.current.add(currentTrack.id);
        if (currentTrack.source === "podcast") incrementPodcastPlays(currentTrack.id);
        else if (currentTrack.source === "song") incrementSongPlays(currentTrack.id);
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
    const filtered = songs.filter(
      s => s.source === "song" && (activeGenre === "All" || s.genre === activeGenre),
    );
    if (shuffled && filtered.length > 0) regenerateShuffle(filtered.length);
  }, [activeGenre, songs, shuffled, regenerateShuffle]);

  const fetchRadioSongs = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, podcastsRes] = await Promise.all([
      (supabase as any)
      .from("songs")
      .select("id, title, cover_url, audio_url, plays, genre, user_id, likes_count, album")
      .eq("on_radio", true)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("podcasts")
        .select("id, title, cover_url, media_url, plays, user_id, likes_count, episode, duration, is_video, on_radio")
        .eq("is_video", false)
        .eq("on_radio", true)
        .order("created_at", { ascending: false }),
    ]);

    if (!error || !podcastsRes.error) {
      const songsData = !error && data ? data : [];
      const podcastsData = !podcastsRes.error && podcastsRes.data ? podcastsRes.data : [];
      const userIds = [...new Set([...songsData, ...podcastsData].map((s: any) => s.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await (supabase as any)
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds)
        : { data: [] };

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || "Artist"; });

      setSongs([
        ...songsData.map((s: any) => ({
        id: s.id,
        source: "song" as const,
        title: s.title,
        artist_name: profileMap[s.user_id] || "Artist",
        album: s.album || "Unknown Album",
        genre: s.genre || "All Music",
        cover_url: s.cover_url || album1,
        audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
        plays: s.plays || "0",
        likes_count: s.likes_count || 0,
        user_id: s.user_id,
        })),
        ...podcastsData.map((p: any) => ({
          id: p.id,
          source: "podcast" as const,
          title: p.title,
          artist_name: profileMap[p.user_id] || "Creator",
          album: p.episode || "Podcast",
          genre: "Podcasts",
          cover_url: p.cover_url || podcast1,
          audio_url: p.media_url ? getR2DownloadUrl(p.media_url) : undefined,
          plays: p.plays || "0",
          likes_count: p.likes_count || 0,
          user_id: p.user_id,
        })),
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handler = () => fetchRadioSongs();
    window.addEventListener("wheuat-radio-updated", handler);
    return () => window.removeEventListener("wheuat-radio-updated", handler);
  }, [fetchRadioSongs]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying(p => !p), []);

  const skip = useCallback(() => {
    if (filteredSongs.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % filteredSongs.length);
    }
  }, [filteredSongs.length]);

  const previous = useCallback(() => {
    if (filteredSongs.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + filteredSongs.length) % filteredSongs.length);
    }
  }, [filteredSongs.length]);

  const playTrack = useCallback((track: RadioTrack) => {
    setStationQueue(null);
    setStationName(null);
    const general = songs.filter(
      s => s.source === "song" && (activeGenre === "All" || s.genre === activeGenre),
    );
    const idx = general.findIndex(s => s.id === track.id);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setIsPlaying(true);
    }
  }, [songs, activeGenre]);

  const setGenreFilter = useCallback((genre: string) => {
    setStationQueue(null);
    setStationName(null);
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
        const filtered = songsRef.current.filter(
          s => s.source === "song" && (activeGenreRef.current === "All" || s.genre === activeGenreRef.current),
        );
        regenerateShuffle(filtered.length);
      }
      setCurrentIndex(0);
      return next;
    });
  }, [regenerateShuffle]);

  const playStationQueue = useCallback((tracks: RadioTrack[], name: string) => {
    if (!tracks.length) return;
    setShuffled(false);
    setShuffleOrder([]);
    setStationQueue(tracks);
    setStationName(name);
    setCurrentIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, []);

  const clearStationQueue = useCallback(() => {
    setStationQueue(null);
    setStationName(null);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  return (
    <RadioContext.Provider value={{
      isPlaying, currentTrack, queue, allTracks: filteredSongs,
      play, pause, toggle, skip, previous, skipsLeft, playTrack,
      setGenreFilter, activeGenre, loading, fetchRadioSongs,
      currentTime, duration, seek,
      volume, setVolume, shuffled, toggleShuffle,
      songPlayCount, resetSongPlayCount: () => setSongPlayCount(0),
      stationMode: Boolean(stationQueue),
      stationName,
      playStationQueue,
      clearStationQueue,
    }}>
      {children}
    </RadioContext.Provider>
  );
};
