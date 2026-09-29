import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FastForward,
  Image as ImageIcon,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  RadioTower,
  Scissors,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { deleteFromR2, getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";
import { useRadio, type RadioTrack } from "@/contexts/RadioContext";
import albumArt from "@/assets/album-1.jpg";
import podcastHost from "@/assets/podcast-1.jpg";
import djHost from "@/assets/artist-dj-onyx.jpg";

type StationMode = "mixed" | "music" | "podcast" | "live";
type AudioStationMode = "music" | "podcast";

type Station = {
  id: string;
  owner_user_id: string;
  name: string;
  tagline: string | null;
  genre: string | null;
  network_name: string | null;
  programming_mode: StationMode;
  logo_url: string | null;
  banner_url: string | null;
  is_live: boolean;
  live_session_id: string | null;
  live_title: string | null;
  live_started_at: string | null;
  updated_at: string;
};

const LIVE_HEARTBEAT_TTL_MS = 20_000;
const STATION_ART = [albumArt, podcastHost, djHost, albumArt, podcastHost];

function stationIsTrulyLive(station: Station) {
  if (!station.is_live || !station.live_session_id) return false;
  const stamp = station.updated_at || station.live_started_at;
  if (!stamp) return false;
  const age = Date.now() - new Date(stamp).getTime();
  // Allow modest device-clock skew while still expiring a silent host quickly.
  return Number.isFinite(age) && age >= -60_000 && age <= LIVE_HEARTBEAT_TTL_MS;
}

function stationCoverSrc(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

  // Current uploads should store the R2 object key. Serve it through YAJ's
  // authenticated download proxy rather than the private R2 S3 endpoint.
  if (!/^https?:\/\//i.test(value)) return getR2DownloadUrl(value);

  // Repair older station rows that saved the private R2 URL returned by the
  // upload function. Those URLs cannot be displayed directly in browsers.
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".r2.cloudflarestorage.com")) {
      const marker = "/wheuat-media/";
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        const key = decodeURIComponent(url.pathname.slice(index + marker.length));
        return getR2DownloadUrl(key);
      }
    }
  } catch {
    // Fall through to the original URL for normal public image providers.
  }

  return value;
}

export default function RadioStationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [liveStation, setLiveStation] = useState<Station | null>(null);
  const [playlistStation, setPlaylistStation] = useState<Station | null>(null);
  const [query, setQuery] = useState("");
  const [listenerCounts, setListenerCounts] = useState<Record<string, number>>({});
  const { playStationQueue } = useRadio();

  const load = async () => {
    try {
      await (supabase as any).rpc("cleanup_stale_radio_broadcasts");
    } catch {
      // The directory still applies the heartbeat freshness check locally.
    }

    const { data, error } = await (supabase as any)
      .from("radio_stations")
      .select("id,owner_user_id,name,tagline,genre,network_name,programming_mode,logo_url,banner_url,is_live,live_session_id,live_title,live_started_at,updated_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      toast({
        title: "Could not load radio stations",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const nextStations = (data || []) as Station[];
    setStations(nextStations);

    const ownerIds = Array.from(new Set(nextStations.map((station) => station.owner_user_id).filter(Boolean)));
    if (ownerIds.length) {
      const { data: hostRows } = await (supabase as any)
        .from("users")
        .select("id,name,username")
        .in("id", ownerIds);
      const nextNames: Record<string, string> = {};
      for (const row of hostRows || []) {
        nextNames[row.id] = row.name || row.username || "YAJ creator";
      }
      setHostNames(nextNames);
    } else {
      setHostNames({});
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();

    let timer: number | undefined;
    const channel = (supabase as any)
      .channel("yaj-radio-station-directory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_stations" },
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => void load(), 250);
        },
      )
      .subscribe();

    const staleTimer = window.setInterval(async () => {
      try {
        const { data } = await (supabase as any).rpc("cleanup_stale_radio_broadcasts");
        if (Number(data || 0) > 0) void load();
      } catch {
        // Older deployments can still rely on the local freshness filter.
      }
    }, 10_000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(staleTimer);
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const presence = (supabase as any).channel("yaj-radio-live-presence");

    const syncCounts = () => {
      const state = presence.presenceState() as Record<string, any[]>;
      const next: Record<string, number> = {};
      Object.values(state).flat().forEach((meta: any) => {
        if (meta?.role !== "audience" || !meta?.stationId || !meta?.sessionId) return;
        next[meta.stationId] = (next[meta.stationId] || 0) + 1;
      });
      setListenerCounts(next);
    };

    presence.on("presence", { event: "sync" }, syncCounts);
    presence.on("presence", { event: "join" }, syncCounts);
    presence.on("presence", { event: "leave" }, (payload: any) => {
      syncCounts();
      const hosts = (payload?.leftPresences || []).filter((meta: any) => meta?.role === "host");
      if (!hosts.length) return;
      setStations((current) =>
        current.map((station) =>
          hosts.some((meta: any) => meta?.stationId === station.id && meta?.sessionId === station.live_session_id)
            ? { ...station, is_live: false, live_session_id: null, live_title: null, live_started_at: null }
            : station,
        ),
      );
    });
    presence.subscribe();

    return () => {
      void (supabase as any).removeChannel(presence);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((station) =>
      [
        station.name,
        station.tagline,
        station.genre,
        station.network_name,
        hostNames[station.owner_user_id],
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [stations, query, hostNames]);

  const mine = filtered.filter((station) => station.owner_user_id === user?.id);
  const liveStations = filtered.filter((station) => stationIsTrulyLive(station));
  const musicStations = filtered.filter((station) => !stationIsTrulyLive(station) && station.programming_mode !== "podcast");
  const podcastStations = filtered.filter((station) => !stationIsTrulyLive(station) && station.programming_mode === "podcast");

  const listen = async (station: Station) => {
    if (stationIsTrulyLive(station) && station.live_session_id) {
      const params = new URLSearchParams({
        audience: "1",
        station: station.id,
        source: "radio",
        radioaudio: "1",
      });
      navigate(`/podcast/room/${encodeURIComponent(station.live_session_id)}?${params.toString()}`);
      return;
    }

    if (station.is_live) {
      setStations((current) =>
        current.map((item) =>
          item.id === station.id
            ? { ...item, is_live: false, live_session_id: null, live_title: null, live_started_at: null }
            : item,
        ),
      );
      try { await (supabase as any).rpc("cleanup_stale_radio_broadcasts"); } catch {}
    }

    const mode: AudioStationMode = station.programming_mode === "podcast" ? "podcast" : "music";
    let tracks: RadioTrack[] = [];

    if (mode === "podcast") {
      const { data, error } = await (supabase as any)
        .from("podcasts")
        .select("id,title,cover_url,media_url,episode,user_id,is_video,on_radio,plays,likes_count")
        .eq("user_id", station.owner_user_id)
        .eq("is_video", false)
        .eq("on_radio", true)
        .order("created_at", { ascending: false });

      if (error) {
        const missingStationPlaylist = error.message?.includes("radio_station_audio") || error.message?.includes("schema cache");
        toast({
          title: missingStationPlaylist ? "Station playlist setup is not finished" : "Could not play station",
          description: missingStationPlaylist
            ? "The station playlist database update still needs to be applied in Supabase."
            : error.message,
          variant: "destructive",
        });
        return;
      }

      tracks = (data || [])
        .filter((item: any) => !!item.media_url)
        .map((item: any) => ({
          id: item.id,
          source: "podcast" as const,
          title: item.title,
          artist_name: hostNames[station.owner_user_id] || station.name,
          album: item.episode || station.name,
          genre: "Podcasts",
          cover_url: item.cover_url || stationCoverSrc(station.banner_url || station.logo_url, podcastHost),
          audio_url: getR2DownloadUrl(item.media_url),
          plays: String(item.plays || "0"),
          likes_count: Number(item.likes_count || 0),
          user_id: item.user_id,
        }));
    } else {
      const { data, error } = await (supabase as any)
        .from("radio_station_audio")
        .select("id,title,audio_url,position,owner_user_id,trim_start_seconds,trim_end_seconds")
        .eq("station_id", station.id)
        .eq("enabled", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        toast({ title: "Could not play station", description: error.message, variant: "destructive" });
        return;
      }

      tracks = (data || [])
        .filter((item: any) => !!item.audio_url)
        .map((item: any) => ({
          id: item.id,
          source: "station" as const,
          title: item.title,
          artist_name: hostNames[station.owner_user_id] || station.name,
          album: station.name,
          genre: station.genre || "Music",
          cover_url: stationCoverSrc(station.banner_url || station.logo_url, albumArt),
          audio_url: getR2DownloadUrl(item.audio_url),
          plays: "0",
          likes_count: 0,
          user_id: item.owner_user_id,
          trim_start_seconds: Number(item.trim_start_seconds || 0),
          trim_end_seconds: item.trim_end_seconds == null ? null : Number(item.trim_end_seconds),
        }));
    }

    if (!tracks.length) {
      toast({
        title: "No station audio yet",
        description: "This station has not added any playable audio.",
      });
      return;
    }

    playStationQueue(tracks, station.name);
  };

  const manageAudio = (station: Station) => {
    if (station.programming_mode === "podcast") {
      const returnTo = encodeURIComponent("/radio/stations");
      navigate(`/my-podcasts?upload=1&returnTo=${returnTo}`);
      return;
    }
    setPlaylistStation(station);
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(9rem+env(safe-area-inset-bottom))] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/radio")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted"
            aria-label="Back to YAJ Radio"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">YAJ</p>
            <h1 className="text-3xl font-black tracking-tight">Radio</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="flex h-10 items-center gap-2 rounded-full bg-violet-600 px-4 text-[11px] font-black text-white"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-6xl items-center gap-2 rounded-2xl border border-border bg-muted/70 px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stations, genres, networks, hosts"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-9 px-4 pt-6">
        {loading ? (
          <section>
            <SectionTitle eyebrow="" title="Radio Stations" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item}>
                  <div className="aspect-square animate-pulse rounded-3xl bg-muted" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </section>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm">
            <RadioTower className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-base font-black">No radio stations found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another search or create a station.</p>
          </div>
        ) : (
          <>
            {liveStations.length > 0 && (
              <section>
                <SectionTitle eyebrow="Live now" title="Listen to Live Radio" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {liveStations.map((station, index) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      hostName={hostNames[station.owner_user_id]}
                      mine={station.owner_user_id === user?.id}
                      art={STATION_ART[index % STATION_ART.length]}
                      onListen={() => listen(station)}
                      onEdit={() => setEditStation(station)}
                      onManage={() => manageAudio(station)}
                      onGoLive={() => setLiveStation(station)}
                      listenerCount={listenerCounts[station.id] || 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {musicStations.length > 0 && (
              <section>
                <SectionTitle eyebrow="Music" title="Music Stations" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {musicStations.map((station, index) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      hostName={hostNames[station.owner_user_id]}
                      mine={station.owner_user_id === user?.id}
                      art={STATION_ART[(index + 1) % STATION_ART.length]}
                      onListen={() => listen(station)}
                      onEdit={() => setEditStation(station)}
                      onManage={() => manageAudio(station)}
                      onGoLive={() => setLiveStation(station)}
                      listenerCount={listenerCounts[station.id] || 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {podcastStations.length > 0 && (
              <section>
                <SectionTitle eyebrow="Talk & Podcast" title="Podcast Stations" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {podcastStations.map((station, index) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      hostName={hostNames[station.owner_user_id]}
                      mine={station.owner_user_id === user?.id}
                      art={STATION_ART[(index + 3) % STATION_ART.length]}
                      onListen={() => listen(station)}
                      onEdit={() => setEditStation(station)}
                      onManage={() => manageAudio(station)}
                      onGoLive={() => setLiveStation(station)}
                      listenerCount={listenerCounts[station.id] || 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {mine.length > 0 && (
              <section>
                <SectionTitle eyebrow="Your Radio" title="My Stations" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {mine.map((station, index) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      hostName={hostNames[station.owner_user_id]}
                      mine
                      art={STATION_ART[(index + 2) % STATION_ART.length]}
                      onListen={() => listen(station)}
                      onEdit={() => setEditStation(station)}
                      onManage={() => manageAudio(station)}
                      onGoLive={() => setLiveStation(station)}
                      listenerCount={listenerCounts[station.id] || 0}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {creatorOpen && (
        <CreateStationSheet
          onClose={() => setCreatorOpen(false)}
          onCreated={() => {
            setCreatorOpen(false);
            void load();
          }}
        />
      )}

      {playlistStation && (
        <StationPlaylistSheet station={playlistStation} onClose={() => setPlaylistStation(null)} />
      )}

      {liveStation && (
        <GoLiveAudioSheet
          station={liveStation}
          onClose={() => setLiveStation(null)}
        />
      )}

      {editStation && (
        <EditStationSheet
          station={editStation}
          onClose={() => setEditStation(null)}
          onSaved={() => {
            setEditStation(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.19em] text-violet-300">{eyebrow}</p>
        <h2 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {count ? (
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-black text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function StationCard({
  station,
  hostName,
  mine,
  art,
  onListen,
  onEdit,
  onManage,
  onGoLive,
  listenerCount,
}: {
  station: Station;
  hostName?: string;
  mine: boolean;
  art: string;
  onListen: () => void;
  onEdit: () => void;
  onManage: () => void;
  onGoLive: () => void;
  listenerCount: number;
}) {
  const mode = station.programming_mode === "podcast" ? "Podcast" : "Music";
  const subtitle = station.genre || station.network_name || hostName || mode;

  return (
    <article className="min-w-0">
      <button type="button" onClick={onListen} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden rounded-[26px] border border-border bg-card shadow-lg">
          <img
            src={stationCoverSrc(station.banner_url || station.logo_url, art)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          {stationIsTrulyLive(station) ? (
            <>
              <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                Live
              </span>
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                <Users className="h-3 w-3" />
                {listenerCount}
              </span>
            </>
          ) : (
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/80 backdrop-blur">
              {mode}
            </span>
          )}
          <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl">
            <Play className="ml-0.5 h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 truncate text-[15px] font-black">{station.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </button>

      {mine && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onManage}
            className="rounded-full bg-muted px-2.5 py-1.5 text-[9px] font-black text-foreground"
          >
            {station.programming_mode === "podcast" ? "Add Episode" : "Playlist"}
          </button>
          <button
            type="button"
            onClick={onGoLive}
            className={
              "rounded-full px-2.5 py-1.5 text-[9px] font-black text-white " +
              (stationIsTrulyLive(station) ? "bg-red-500" : "bg-violet-600")
            }
          >
            {stationIsTrulyLive(station) ? "Live" : "Go Live"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-label="Edit station"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </article>
  );
}


type StationAudioItem = {
  id: string;
  title: string;
  audio_url: string;
  position: number;
  trim_start_seconds: number;
  trim_end_seconds: number | null;
};

function StationPlaylistSheet({ station, onClose }: { station: Station; onClose: () => void }) {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<StationAudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTrackRef = useRef<StationAudioItem | null>(null);

  const isMissingStationAudioTable = (message?: string) =>
    Boolean(message && (message.includes("radio_station_audio") || message.includes("schema cache")));

  const loadTracks = async () => {
    const { data, error } = await (supabase as any)
      .from("radio_station_audio")
      .select("id,title,audio_url,position,trim_start_seconds,trim_end_seconds")
      .eq("station_id", station.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast({
        title: isMissingStationAudioTable(error.message) ? "Station playlist setup is not finished" : "Could not load station playlist",
        description: isMissingStationAudioTable(error.message)
          ? "The station playlist database update still needs to be applied in Supabase."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setTracks((data || []).map((item: any) => ({
      ...item,
      trim_start_seconds: Number(item.trim_start_seconds || 0),
      trim_end_seconds: item.trim_end_seconds == null ? null : Number(item.trim_end_seconds),
    })));
  };

  useEffect(() => { void loadTracks(); }, [station.id]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => {
      setPreviewTime(audio.currentTime || 0);
      const track = previewTrackRef.current;
      const end = Number(track?.trim_end_seconds);
      if (track && Number.isFinite(end) && end > 0 && audio.currentTime >= end) {
        audio.pause();
        setPreviewingId(null);
      }
    };
    const onMeta = () => setPreviewDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => setPreviewingId(null);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    previewTrackRef.current = null;
    setPreviewingId(null);
  };

  const playPreview = (track: StationAudioItem) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewingId === track.id && !audio.paused) {
      stopPreview();
      return;
    }

    previewTrackRef.current = track;
    const url = getR2DownloadUrl(track.audio_url);
    if (audio.src !== url) audio.src = url;
    const startAt = Math.max(0, Number(track.trim_start_seconds || 0));
    const begin = () => {
      audio.currentTime = startAt;
      setPreviewTime(startAt);
      void audio.play().then(() => setPreviewingId(track.id)).catch(() => {
        toast({ title: "Could not preview this track", variant: "destructive" });
      });
    };
    if (audio.readyState >= 1) begin();
    else audio.addEventListener("loadedmetadata", begin, { once: true });
  };

  const fastForwardPreview = (track: StationAudioItem) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (previewingId !== track.id) {
      playPreview(track);
      return;
    }
    const trimEndValue = Number(track.trim_end_seconds);
    const hardEnd = Number.isFinite(trimEndValue) && trimEndValue > 0
      ? trimEndValue
      : (Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 15);
    audio.currentTime = Math.min(audio.currentTime + 15, Math.max(0, hardEnd - 0.1));
  };

  const openTrim = (track: StationAudioItem) => {
    stopPreview();
    setTrimmingId(track.id);
    setTrimStart(String(Number(track.trim_start_seconds || 0)));
    setTrimEnd(track.trim_end_seconds == null ? "" : String(track.trim_end_seconds));
  };

  const saveTrim = async (track: StationAudioItem) => {
    const startValue = Math.max(0, Number(trimStart) || 0);
    const parsedEnd = trimEnd.trim() === "" ? null : Number(trimEnd);
    if (parsedEnd != null && (!Number.isFinite(parsedEnd) || parsedEnd <= startValue)) {
      toast({ title: "Trim end must be after trim start", variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any)
      .from("radio_station_audio")
      .update({
        trim_start_seconds: startValue,
        trim_end_seconds: parsedEnd,
      })
      .eq("id", track.id)
      .eq("owner_user_id", user?.id);

    if (error) {
      toast({ title: "Could not save trim", description: error.message, variant: "destructive" });
      return;
    }
    setTracks((items) => items.map((item) => item.id === track.id
      ? { ...item, trim_start_seconds: startValue, trim_end_seconds: parsedEnd }
      : item));
    setTrimmingId(null);
    toast({ title: "Track trim saved" });
  };

  const uploadFiles = async (files: File[]) => {
    if (!user || !files.length || uploading) return;
    setUploading(true);
    let nextPosition = tracks.length ? Math.max(...tracks.map((t) => Number(t.position) || 0)) + 1 : 0;
    let added = 0;
    let failed = 0;

    for (const [index, file] of files.entries()) {
      const upload = await uploadToR2(file, {
        folder: `radio-stations/${user.id}/${station.id}/audio`,
        fileName: `${Date.now()}-${index}-${file.name}`,
      });
      if (!upload.success || !upload.data?.key) { failed += 1; continue; }

      const { error } = await (supabase as any).from("radio_station_audio").insert({
        station_id: station.id,
        owner_user_id: user.id,
        title: file.name.replace(/\.[^.]+$/, "").trim() || "Untitled",
        audio_url: upload.data.key,
        position: nextPosition++,
        enabled: true,
        trim_start_seconds: 0,
        trim_end_seconds: null,
      });
      if (error) {
        failed += 1;
        void deleteFromR2(upload.data.key);
        if (isMissingStationAudioTable(error.message)) {
          toast({
            title: "Station playlist database update required",
            description: "The MP3 was not kept because the Supabase station-audio table has not been applied yet.",
            variant: "destructive",
          });
          break;
        }
      } else added += 1;
    }

    setUploading(false);
    await loadTracks();
    if (added) toast({ title: added === 1 ? "1 track added" : `${added} tracks added`, description: "These tracks belong to this station only." });
    if (failed && added) toast({ title: failed === 1 ? "1 track could not be added" : `${failed} tracks could not be added`, variant: "destructive" });
  };

  const removeTrack = async (track: StationAudioItem) => {
    if (!user) return;
    if (previewingId === track.id) stopPreview();
    const { error } = await (supabase as any).from("radio_station_audio").delete().eq("id", track.id).eq("owner_user_id", user.id);
    if (error) {
      toast({ title: "Could not remove track", description: error.message, variant: "destructive" });
      return;
    }
    setTracks((items) => items.filter((item) => item.id !== track.id));
    void deleteFromR2(track.audio_url);
  };

  const moveTrack = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= tracks.length) return;
    const current = tracks[index];
    const other = tracks[otherIndex];
    const next = [...tracks];
    next[index] = { ...other, position: current.position };
    next[otherIndex] = { ...current, position: other.position };
    setTracks(next);
    const [a, b] = await Promise.all([
      (supabase as any).from("radio_station_audio").update({ position: other.position }).eq("id", current.id),
      (supabase as any).from("radio_station_audio").update({ position: current.position }).eq("id", other.id),
    ]);
    if (a.error || b.error) {
      toast({ title: "Could not reorder playlist", variant: "destructive" });
      await loadTracks();
    }
  };

  return (
    <ModalShell onClose={() => { stopPreview(); onClose(); }}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Station Playlist</p>
        <h2 className="mt-1 text-2xl font-black">{station.name}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Upload MP3/audio files for this station only. They play top to bottom and continue automatically.
          Listeners can play or pause, but they cannot skip tracks.
        </p>

        <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-400/50 bg-violet-500/10 px-4 py-5 text-sm font-black text-violet-200">
          <Upload className="h-5 w-5" />
          {uploading ? "Uploading…" : "Upload MP3s"}
          <input type="file" accept="audio/mpeg,audio/mp3,audio/*" multiple disabled={uploading} className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.currentTarget.value = "";
              void uploadFiles(files);
            }}
          />
        </label>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">Loading playlist…</div>
          ) : tracks.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/40 p-5 text-center">
              <Music2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-black">No station tracks yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Upload the first MP3 above.</p>
            </div>
          ) : tracks.map((track, index) => (
            <div key={track.id} className="rounded-2xl border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Music2 className="h-4 w-4 shrink-0 text-violet-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{track.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Track {index + 1}
                    {track.trim_start_seconds > 0 || track.trim_end_seconds != null
                      ? ` · Trim ${track.trim_start_seconds.toFixed(1)}s–${track.trim_end_seconds == null ? "end" : `${track.trim_end_seconds.toFixed(1)}s`}`
                      : ""}
                  </p>
                </div>
                <button type="button" onClick={() => void removeTrack(track)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 text-red-400" aria-label="Delete track">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => playPreview(track)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-violet-600 px-3 text-[10px] font-black text-white">
                  {previewingId === track.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {previewingId === track.id ? "Pause" : "Play"}
                </button>
                <button type="button" onClick={() => fastForwardPreview(track)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-[10px] font-black">
                  <FastForward className="h-3.5 w-3.5" /> +15s
                </button>
                <button type="button" onClick={() => openTrim(track)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-[10px] font-black">
                  <Scissors className="h-3.5 w-3.5" /> Trim
                </button>
                <button type="button" onClick={() => void moveTrack(index, -1)} disabled={index === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background disabled:opacity-30" aria-label="Move track up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void moveTrack(index, 1)} disabled={index === tracks.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background disabled:opacity-30" aria-label="Move track down">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {previewingId === track.id && (
                <div className="mt-2 text-[9px] font-bold text-muted-foreground">
                  Preview {Math.floor(previewTime / 60)}:{String(Math.floor(previewTime % 60)).padStart(2, "0")}
                  {previewDuration > 0 ? ` / ${Math.floor(previewDuration / 60)}:${String(Math.floor(previewDuration % 60)).padStart(2, "0")}` : ""}
                </div>
              )}

              {trimmingId === track.id && (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] font-black">Trim this track</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">Set where station playback starts and ends. Leave End blank to play to the end.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-[9px] font-bold text-muted-foreground">
                      Start seconds
                      <input type="number" min="0" step="0.1" value={trimStart} onChange={(e) => setTrimStart(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-muted px-2 text-xs text-foreground" />
                    </label>
                    <label className="text-[9px] font-bold text-muted-foreground">
                      End seconds
                      <input type="number" min="0" step="0.1" value={trimEnd} onChange={(e) => setTrimEnd(e.target.value)}
                        placeholder="End"
                        className="mt-1 h-10 w-full rounded-lg border border-border bg-muted px-2 text-xs text-foreground" />
                    </label>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setTrimmingId(null)}
                      className="flex-1 rounded-full border border-border px-3 py-2 text-[10px] font-black">Cancel</button>
                    <button type="button" onClick={() => void saveTrim(track)}
                      className="flex-1 rounded-full bg-violet-600 px-3 py-2 text-[10px] font-black text-white">Save Trim</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={() => { stopPreview(); onClose(); }} className="mt-6 w-full rounded-full bg-violet-600 px-4 py-3 text-xs font-black text-white">Done</button>
      </div>
    </ModalShell>
  );
}

function GoLiveAudioSheet({
  station,
  onClose,
}: {
  station: Station;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [allowCallIns, setAllowCallIns] = useState(false);
  const [starting, setStarting] = useState(false);

  const start = async () => {
    if (starting) return;
    setStarting(true);

    const sessionId = stationIsTrulyLive(station) && station.live_session_id
      ? station.live_session_id
      : `radio-${station.id}-${crypto.randomUUID()}`;

    const { error } = await (supabase as any)
      .from("radio_stations")
      .update({
        live_title: station.programming_mode === "podcast"
          ? `${station.name} Live Podcast`
          : `${station.name} Live Radio`,
      })
      .eq("id", station.id);

    if (error) {
      setStarting(false);
      toast({ title: "Could not start live radio", description: error.message, variant: "destructive" });
      return;
    }

    const params = new URLSearchParams({
      station: station.id,
      source: "radio",
      radioaudio: "1",
      callins: allowCallIns ? "1" : "0",
    });
    navigate(`/podcast/room/${encodeURIComponent(sessionId)}?${params.toString()}`);
  };

  return (
    <ModalShell onClose={onClose}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">YAJ Radio Live Audio</p>
        <h2 className="mt-1 text-2xl font-black">Go live on {station.name}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This is audio-only. Your microphone goes live; your camera stays off.
          {station.programming_mode === "music"
            ? " Your station music library remains available for your show."
            : " Listeners can hear your live podcast in real time."}
        </p>

        <div className="mt-5 rounded-2xl border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">Allow listener call-ins</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Callers stay audio-only and must be accepted by you before they join.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowCallIns((value) => !value)}
              className={
                "relative h-7 w-12 rounded-full transition " +
                (allowCallIns ? "bg-emerald-500" : "bg-zinc-700")
              }
              aria-label="Toggle listener call-ins"
            >
              <span
                className={
                  "absolute top-1 h-5 w-5 rounded-full bg-white transition " +
                  (allowCallIns ? "left-6" : "left-1")
                }
              />
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-300">Live format</p>
          <p className="mt-1 text-sm font-black">
            {station.programming_mode === "podcast" ? "Live Audio Podcast" : "Live Music Radio"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">No video is published from YAJ Radio live rooms.</p>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border bg-muted px-4 py-3 text-xs font-black text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={starting}
            className="flex-1 rounded-full bg-red-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
          >
            {starting ? "Starting…" : stationIsTrulyLive(station) ? "Return Live" : "Go Live"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditStationSheet({
  station,
  onClose,
  onSaved,
}: {
  station: Station;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(station.name);
  const [networkName, setNetworkName] = useState(station.network_name || "");
  const [tagline, setTagline] = useState(station.tagline || "");
  const [genre, setGenre] = useState(station.genre || "");
  const [mode, setMode] = useState<AudioStationMode>(
    station.programming_mode === "podcast" ? "podcast" : "music",
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    station.banner_url || station.logo_url
      ? stationCoverSrc(station.banner_url || station.logo_url, albumArt)
      : null,
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);

    let bannerUrl = station.banner_url || station.logo_url || null;
    if (coverFile) {
      const upload = await uploadToR2(coverFile, {
        folder: `radio-stations/${user.id}`,
        fileName: `station-cover-${Date.now()}-${coverFile.name}`,
      });
      if (!upload.success || !upload.data?.url) {
        setSaving(false);
        toast({ title: "Cover upload failed", description: upload.error || "Please try another image.", variant: "destructive" });
        return;
      }
      bannerUrl = upload.data.key;
    }

    const { error } = await (supabase as any)
      .from("radio_stations")
      .update({
        name: name.trim(),
        network_name: networkName.trim() || null,
        tagline: tagline.trim() || null,
        genre: genre.trim() || null,
        programming_mode: mode,
        banner_url: bannerUrl,
        is_live: false,
        live_title: null,
        live_started_at: null,
        live_session_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", station.id)
      .eq("owner_user_id", user.id);

    setSaving(false);

    if (error) {
      toast({ title: "Could not update station", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Station updated" });
    onSaved();
  };

  const deleteStation = async () => {
    if (!user || deleting) return;
    const confirmed = window.confirm(`Delete "${station.name}"? This removes the station and its station playlist. This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    const { error } = await (supabase as any)
      .from("radio_stations")
      .delete()
      .eq("id", station.id)
      .eq("owner_user_id", user.id);

    if (error) {
      setDeleting(false);
      toast({ title: "Could not delete station", description: error.message, variant: "destructive" });
      return;
    }

    const coverKey = station.banner_url || station.logo_url;
    if (coverKey && !/^https?:\/\//i.test(coverKey)) void deleteFromR2(coverKey);
    toast({ title: "Station deleted" });
    onSaved();
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={save}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Station Manager</p>
        <h2 className="mt-1 text-2xl font-black">Edit your station</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Update the station identity and choose whether it plays Music or Podcasts.
        </p>

        <StationFields
          name={name}
          setName={setName}
          networkName={networkName}
          setNetworkName={setNetworkName}
          tagline={tagline}
          setTagline={setTagline}
          genre={genre}
          setGenre={setGenre}
          mode={mode}
          setMode={setMode}
          coverPreview={coverPreview}
          setCoverPreview={setCoverPreview}
          setCoverFile={setCoverFile}
        />

        <ModalActions onClose={onClose} disabled={saving || deleting || !name.trim()} label={saving ? "Saving…" : "Save Changes"} />
        <button
          type="button"
          onClick={() => void deleteStation()}
          disabled={saving || deleting}
          className="mt-3 w-full rounded-full border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-black text-red-400 disabled:opacity-50"
        >
          {deleting ? "Deleting Station…" : "Delete Station"}
        </button>
      </form>
    </ModalShell>
  );
}

function CreateStationSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [tagline, setTagline] = useState("");
  const [genre, setGenre] = useState("");
  const [mode, setMode] = useState<AudioStationMode>("music");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);

    let bannerUrl: string | null = null;
    if (coverFile) {
      const upload = await uploadToR2(coverFile, {
        folder: `radio-stations/${user.id}`,
        fileName: `station-cover-${Date.now()}-${coverFile.name}`,
      });
      if (!upload.success || !upload.data?.url) {
        setSaving(false);
        toast({ title: "Cover upload failed", description: upload.error || "Please try another image.", variant: "destructive" });
        return;
      }
      bannerUrl = upload.data.key;
    }

    const { data: createdStation, error } = await (supabase as any).from("radio_stations").insert({
      owner_user_id: user.id,
      name: name.trim(),
      network_name: networkName.trim() || null,
      tagline: tagline.trim() || null,
      genre: genre.trim() || null,
      programming_mode: mode,
      banner_url: bannerUrl,
      is_public: true,
      is_live: false,
      live_title: null,
      live_started_at: null,
      live_session_id: null,
    }).select("id").single();

    if (error || !createdStation?.id) {
      setSaving(false);
      toast({ title: "Could not create station", description: error?.message || "Please try again.", variant: "destructive" });
      return;
    }

    let uploadedCount = 0;
    let failedCount = 0;
    if (mode === "music" && audioFiles.length) {
      for (const [index, file] of audioFiles.entries()) {
        const upload = await uploadToR2(file, {
          folder: `radio-stations/${user.id}/${createdStation.id}/audio`,
          fileName: `${Date.now()}-${index}-${file.name}`,
        });
        if (!upload.success || !upload.data?.key) { failedCount += 1; continue; }
        const { error: audioError } = await (supabase as any).from("radio_station_audio").insert({
          station_id: createdStation.id,
          owner_user_id: user.id,
          title: file.name.replace(/\.[^.]+$/, "").trim() || "Untitled",
          audio_url: upload.data.key,
          position: index,
          enabled: true,
        });
        if (audioError) {
          failedCount += 1;
          void deleteFromR2(upload.data.key);
        } else uploadedCount += 1;
      }
    }

    setSaving(false);
    toast({
      title: "Station created",
      description: uploadedCount
        ? `${uploadedCount} station track${uploadedCount === 1 ? "" : "s"} added.${failedCount ? ` ${failedCount} could not be added.` : ""}`
        : failedCount
          ? "The station was created, but its audio could not be added yet."
          : "Listeners can now find your station on YAJ Radio.",
    });
    onCreated();
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={create}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Create on YAJ Radio</p>
        <h2 className="mt-1 text-2xl font-black">Start a radio station</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Choose Music or Podcast. Every YAJ Radio station is audio-only—no video.
        </p>

        <StationFields
          name={name}
          setName={setName}
          networkName={networkName}
          setNetworkName={setNetworkName}
          tagline={tagline}
          setTagline={setTagline}
          genre={genre}
          setGenre={setGenre}
          mode={mode}
          setMode={setMode}
          coverPreview={coverPreview}
          setCoverPreview={setCoverPreview}
          setCoverFile={setCoverFile}
        />

        {mode === "music" && (
          <label className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-violet-400/50 bg-violet-500/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-300"><Upload className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Upload station MP3s</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  These tracks belong to this station only and play continuously in the order selected.
                </p>
              </div>
            </div>
            {audioFiles.length > 0 && (
              <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-[10px] font-bold text-foreground">
                {audioFiles.length} audio file{audioFiles.length === 1 ? "" : "s"} selected
              </p>
            )}
            <input type="file" accept="audio/mpeg,audio/mp3,audio/*" multiple className="hidden"
              onChange={(event) => setAudioFiles(Array.from(event.target.files || []))} />
          </label>
        )}

        <ModalActions onClose={onClose} disabled={saving || !name.trim()} label={saving ? "Creating…" : "Create Station"} />
      </form>
    </ModalShell>
  );
}

function StationFields({
  name,
  setName,
  networkName,
  setNetworkName,
  tagline,
  setTagline,
  genre,
  setGenre,
  mode,
  setMode,
  coverPreview,
  setCoverPreview,
  setCoverFile,
}: {
  name: string;
  setName: (value: string) => void;
  networkName: string;
  setNetworkName: (value: string) => void;
  tagline: string;
  setTagline: (value: string) => void;
  genre: string;
  setGenre: (value: string) => void;
  mode: AudioStationMode;
  setMode: (value: AudioStationMode) => void;
  coverPreview: string | null;
  setCoverPreview: (value: string | null) => void;
  setCoverFile: (file: File | null) => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
        {coverPreview ? (
          <img src={coverPreview} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-28 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs font-black">Upload station cover</span>
            <span className="text-[10px]">Photo or artwork from your device</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setCoverFile(file);
            if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
            setCoverPreview(file ? URL.createObjectURL(file) : coverPreview);
          }}
        />
      </label>

      <Field value={name} onChange={setName} placeholder="Station name" />
      <Field value={networkName} onChange={setNetworkName} placeholder="Network name (optional)" />
      <Field value={tagline} onChange={setTagline} placeholder="Tagline" />
      <Field value={genre} onChange={setGenre} placeholder="Genre / format — Hip-Hop, Gospel, Talk…" />

      <div>
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Station format</p>
        <div className="grid grid-cols-2 gap-2">
          {(["music", "podcast"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={
                "min-h-11 rounded-xl border text-[10px] font-black capitalize transition " +
                (mode === item
                  ? "border-violet-400 bg-violet-500 text-white"
                  : "border-border bg-muted text-muted-foreground")
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end bg-black/45 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-border bg-card p-5 text-foreground shadow-2xl sm:max-w-lg sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  disabled,
  label,
}: {
  onClose: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div className="mt-6 flex gap-2">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-full border border-border bg-muted px-4 py-3 text-xs font-black text-foreground"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 rounded-full bg-violet-600 px-4 py-3 text-xs font-black disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}

function Field({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
    />
  );
}
