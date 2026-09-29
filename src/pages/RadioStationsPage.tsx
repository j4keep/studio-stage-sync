import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Headphones,
  Image as ImageIcon,
  Pause,
  Pencil,
  Play,
  Plus,
  RadioTower,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";
import radioHost from "@/assets/wstudio-orbit-headphones.jpg";
import studioMic from "@/assets/wstudio-orbit-mic.jpg";
import studioMixer from "@/assets/wstudio-orbit-mixer.jpg";
import podcastHost from "@/assets/podcast-1.jpg";
import djHost from "@/assets/artist-dj-onyx.jpg";

type StationMode = "mixed" | "music" | "podcast" | "live";
type AudioStationMode = "music" | "podcast";

type StationTrack = {
  id: string;
  title: string;
  subtitle: string;
  cover_url: string | null;
  audio_url: string;
};

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
};

const STATION_ART = [radioHost, podcastHost, studioMic, djHost, studioMixer];

export default function RadioStationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [playerStation, setPlayerStation] = useState<Station | null>(null);
  const [liveStation, setLiveStation] = useState<Station | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("radio_stations")
      .select("id,owner_user_id,name,tagline,genre,network_name,programming_mode,logo_url,banner_url,is_live,live_session_id,live_title")
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

    return () => {
      window.clearTimeout(timer);
      void (supabase as any).removeChannel(channel);
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
  const liveStations = filtered.filter((station) => station.is_live);
  const musicStations = filtered.filter((station) => !station.is_live && station.programming_mode !== "podcast");
  const podcastStations = filtered.filter((station) => !station.is_live && station.programming_mode === "podcast");

  const listen = (station: Station) => {
    if (station.is_live && station.live_session_id) {
      const params = new URLSearchParams({
        audience: "1",
        station: station.id,
        source: "radio",
        radioaudio: "1",
      });
      navigate(`/podcast/room/${encodeURIComponent(station.live_session_id)}?${params.toString()}`);
      return;
    }
    setPlayerStation(station);
  };

  const manageAudio = (station: Station) => {
    const returnTo = encodeURIComponent("/radio/stations");
    navigate(
      station.programming_mode === "podcast"
        ? `/my-podcasts?upload=1&returnTo=${returnTo}`
        : `/my-songs?upload=1&returnTo=${returnTo}`,
    );
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

      {liveStation && (
        <GoLiveAudioSheet
          station={liveStation}
          onClose={() => setLiveStation(null)}
        />
      )}

      {playerStation && (
        <StationAudioPlayer
          station={playerStation}
          hostName={hostNames[playerStation.owner_user_id]}
          onClose={() => setPlayerStation(null)}
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
}: {
  station: Station;
  hostName?: string;
  mine: boolean;
  art: string;
  onListen: () => void;
  onEdit: () => void;
  onManage: () => void;
  onGoLive: () => void;
}) {
  const mode = station.programming_mode === "podcast" ? "Podcast" : "Music";
  const subtitle = station.genre || station.network_name || hostName || mode;

  return (
    <article className="min-w-0">
      <button type="button" onClick={onListen} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden rounded-[26px] border border-border bg-card shadow-lg">
          <img
            src={station.banner_url || station.logo_url || art}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          {station.is_live ? (
            <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
              Live
            </span>
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
            Add Audio
          </button>
          <button
            type="button"
            onClick={onGoLive}
            className={
              "rounded-full px-2.5 py-1.5 text-[9px] font-black text-white " +
              (station.is_live ? "bg-red-500" : "bg-violet-600")
            }
          >
            {station.is_live ? "Live" : "Go Live"}
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

    const sessionId = station.is_live && station.live_session_id
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
            {starting ? "Starting…" : station.is_live ? "Return Live" : "Go Live"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StationAudioPlayer({
  station,
  hostName,
  onClose,
}: {
  station: Station;
  hostName?: string;
  onClose: () => void;
}) {
  const mode: AudioStationMode = station.programming_mode === "podcast" ? "podcast" : "music";
  const [tracks, setTracks] = useState<StationTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);

      if (mode === "podcast") {
        const { data, error } = await (supabase as any)
          .from("podcasts")
          .select("id,title,cover_url,media_url,episode,user_id,is_video,on_radio")
          .eq("user_id", station.owner_user_id)
          .eq("is_video", false)
          .eq("on_radio", true)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (error) {
          setTracks([]);
          setLoading(false);
          return;
        }

        setTracks(
          (data || [])
            .filter((item: any) => !!item.media_url)
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              subtitle: item.episode || "Podcast episode",
              cover_url: item.cover_url || station.banner_url || station.logo_url,
              audio_url: getR2DownloadUrl(item.media_url),
            })),
        );
      } else {
        const { data, error } = await (supabase as any)
          .from("songs")
          .select("id,title,cover_url,audio_url,album,user_id,on_radio")
          .eq("user_id", station.owner_user_id)
          .eq("on_radio", true)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (error) {
          setTracks([]);
          setLoading(false);
          return;
        }

        setTracks(
          (data || [])
            .filter((item: any) => !!item.audio_url)
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              subtitle: item.album || "Music",
              cover_url: item.cover_url || station.banner_url || station.logo_url,
              audio_url: getR2DownloadUrl(item.audio_url),
            })),
        );
      }

      setIndex(0);
      setPlaying(false);
      setLoading(false);
    })();

    return () => {
      active = false;
      audioRef.current?.pause();
    };
  }, [station.id, station.owner_user_id, mode]);

  const current = tracks[index] || null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.audio_url;
    audio.currentTime = 0;
    if (playing) void audio.play().catch(() => setPlaying(false));
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (playing) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, current?.id]);

  const next = () => {
    if (!tracks.length) return;
    setIndex((value) => (value + 1) % tracks.length);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end bg-black/55 backdrop-blur-md sm:items-center sm:justify-center sm:p-5">
      <div className="relative max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] border border-border bg-card p-5 text-foreground shadow-2xl sm:max-w-lg sm:rounded-[30px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-foreground"
          aria-label="Close station player"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">YAJ Radio · {mode}</p>
          <h2 className="mt-1 text-2xl font-black">{station.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hostName ? `By ${hostName} · ` : ""}{mode === "podcast" ? "Audio Podcast Station" : "Music Station"}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading station…</p>
          </div>
        ) : !current ? (
          <div className="mt-6 rounded-3xl border border-border bg-muted/40 p-8 text-center">
            <Headphones className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-black">No audio has been added yet.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {mode === "podcast"
                ? "This creator needs to add an audio podcast to YAJ Radio."
                : "This creator needs to add music to YAJ Radio."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-muted/30">
              <img
                src={current.cover_url || station.banner_url || station.logo_url || radioHost}
                alt=""
                className="aspect-square w-full object-cover"
              />
              <div className="p-4">
                <p className="truncate text-lg font-black">{current.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{current.subtitle}</p>
              </div>
            </div>

            <audio
              ref={audioRef}
              preload="metadata"
              onEnded={next}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className="hidden"
            />

            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-950/40"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
              </button>
              <p className="mt-3 text-center text-[10px] font-semibold text-muted-foreground">
                Programmed by the station · listeners cannot skip tracks
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {mode === "podcast" ? "Station Episodes" : "Station Playlist"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tracks.length} item{tracks.length === 1 ? "" : "s"} · next item starts automatically
                  </p>
                </div>
                <Headphones className="h-5 w-5 text-violet-300" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
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
  const [name, setName] = useState(station.name);
  const [networkName, setNetworkName] = useState(station.network_name || "");
  const [tagline, setTagline] = useState(station.tagline || "");
  const [genre, setGenre] = useState(station.genre || "");
  const [mode, setMode] = useState<AudioStationMode>(
    station.programming_mode === "podcast" ? "podcast" : "music",
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(station.banner_url || station.logo_url);

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
      bannerUrl = upload.data.url;
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

        <ModalActions onClose={onClose} disabled={saving || !name.trim()} label={saving ? "Saving…" : "Save Changes"} />
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
      bannerUrl = upload.data.url;
    }

    const { error } = await (supabase as any).from("radio_stations").insert({
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
    });

    setSaving(false);

    if (error) {
      toast({ title: "Could not create station", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Station created",
      description: "Listeners can now find your station on YAJ Radio.",
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
