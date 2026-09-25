import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  Headphones,
  Mic2,
  Music2,
  Plus,
  Radio,
  Image as ImageIcon,
  Pencil,
  Search,
  TowerControl,
  Waves,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PodcastSessionStore } from "@/pages/podcast/podcastSessionStore";
import { uploadToR2 } from "@/lib/r2-storage";
import radioHost from "@/assets/wstudio-orbit-headphones.jpg";
import studioMic from "@/assets/wstudio-orbit-mic.jpg";
import studioMixer from "@/assets/wstudio-orbit-mixer.jpg";
import podcastHost from "@/assets/podcast-1.jpg";
import djHost from "@/assets/artist-dj-onyx.jpg";

type Station = {
  id: string;
  owner_user_id: string;
  name: string;
  tagline: string | null;
  genre: string | null;
  network_name: string | null;
  programming_mode: "live" | "music" | "podcast" | "mixed";
  is_live: boolean;
  live_title: string | null;
  live_started_at: string | null;
  live_session_id: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

type Show = {
  id: string;
  station_id: string;
  title: string;
  show_type: string;
  scheduled_at: string | null;
  duration_minutes: number;
  status: string;
};

const STATION_ART = [radioHost, podcastHost, studioMic, djHost, studioMixer];

export default function RadioStationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stations, setStations] = useState<Station[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [scheduleStation, setScheduleStation] = useState<Station | null>(null);
  const [liveStation, setLiveStation] = useState<Station | null>(null);
  const [editStation, setEditStation] = useState<Station | null>(null);
  const [query, setQuery] = useState("");
  const [radioBackendReady, setRadioBackendReady] = useState(true);
  const [presenceReady, setPresenceReady] = useState(false);
  const [liveHostSessions, setLiveHostSessions] = useState<Set<string>>(new Set());
  const [listenerCounts, setListenerCounts] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const [stationResult, showResult] = await Promise.all([
      (supabase as any)
        .from("radio_stations")
        .select("id,owner_user_id,name,tagline,genre,network_name,programming_mode,is_live,live_title,live_started_at,live_session_id,logo_url,banner_url")
        .eq("is_public", true)
        .order("is_live", { ascending: false })
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("radio_station_shows")
        .select("id,station_id,title,show_type,scheduled_at,duration_minutes,status")
        .in("status", ["scheduled", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(40),
    ]);

    const backendMissing = Boolean(
      stationResult?.error?.message?.includes("radio_stations") ||
      showResult?.error?.message?.includes("radio_station_shows"),
    );

    setRadioBackendReady(!backendMissing);
    setStations((stationResult?.data || []) as Station[]);
    setShows((showResult?.data || []) as Show[]);
    setLoading(false);
  };

  useEffect(() => {
    const channel = (supabase as any).channel("yaj-radio-live-presence");

    const sync = () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const metas = Object.values(state).flat();

      const hosts = new Set<string>();
      const listeners: Record<string, number> = {};

      for (const meta of metas as any[]) {
        const sessionId = meta?.sessionId;
        if (!sessionId) continue;
        if (meta.role === "host") hosts.add(sessionId);
        if (meta.role === "audience") listeners[sessionId] = (listeners[sessionId] || 0) + 1;
      }

      setLiveHostSessions(hosts);
      setListenerCounts(listeners);
      setPresenceReady(true);
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") sync();
    });

    return () => {
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    void load();

    const channel = (supabase as any)
      .channel("yaj-radio-directory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_stations" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_station_shows" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void (supabase as any).removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((station) =>
      [station.name, station.tagline, station.genre, station.network_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [stations, query]);

  const isActuallyLive = (station: Station) => {
    if (!station.is_live || !station.live_session_id) return false;
    return presenceReady ? liveHostSessions.has(station.live_session_id) : station.is_live;
  };

  const liveStations = filtered.filter(isActuallyLive);
  const discover = filtered.filter((station) => !isActuallyLive(station));
  const mine = filtered.filter((station) => station.owner_user_id === user?.id);
  const upcoming = shows.filter((show) => show.status === "scheduled").slice(0, 8);

  useEffect(() => {
    if (!presenceReady || !user?.id) return;

    const stale = stations.filter((station) => {
      if (station.owner_user_id !== user.id || !station.is_live || !station.live_session_id) return false;
      if (liveHostSessions.has(station.live_session_id)) return false;
      const started = station.live_started_at ? new Date(station.live_started_at).getTime() : 0;
      return !started || Date.now() - started > 20_000;
    });

    for (const station of stale) {
      void (supabase as any)
        .from("radio_stations")
        .update({
          is_live: false,
          live_title: null,
          live_started_at: null,
          live_session_id: null,
        })
        .eq("id", station.id)
        .eq("owner_user_id", user.id);
    }

    if (stale.length) window.setTimeout(() => void load(), 500);
  }, [presenceReady, stations, liveHostSessions, user?.id]);

  const openCreateStation = () => {
    if (!radioBackendReady) {
      toast({
        title: "Radio setup pending",
        description: "The station database still needs to be activated before stations can be created.",
      });
      return;
    }
    setCreatorOpen(true);
  };

  const beginLiveFlow = () => {
    if (!radioBackendReady) {
      toast({
        title: "Radio setup pending",
        description: "The station database still needs to be activated before live station broadcasting can start.",
      });
      return;
    }
    if (mine.length) {
      setLiveStation(mine[0]);
      return;
    }
    setCreatorOpen(true);
    toast({
      title: "Create your station first",
      description: "Create the station once, then Go Live opens the broadcast setup.",
    });
  };

  useEffect(() => {
    if (loading || searchParams.get("start") !== "live") return;
    beginLiveFlow();
    // Only respond once to the entry request.
    navigate("/radio/stations", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stations.length, user?.id]);

  return (
    <div className="min-h-screen bg-[#080b12] pb-28 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080b12]/92 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/radio")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
            aria-label="Back to radio"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">YAJ Radio Network</p>
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Stations & Live Broadcasts</h1>
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-6xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4">
          <Search className="h-4 w-4 text-white/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stations, networks, genres, hosts…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 pt-5">
        <BroadcastHero
          liveCount={liveStations.length}
          stationCount={stations.length}
          upcomingCount={upcoming.length}
          onCreate={openCreateStation}
          onGoLive={beginLiveFlow}
        />

        <section>
          <SectionTitle eyebrow="On Air Now" title="Live radio shows" count={liveStations.length ? String(liveStations.length) : undefined} />
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-[26px] bg-white/[0.05]" />)}
            </div>
          ) : liveStations.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-3 lg:overflow-visible">
              {liveStations.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={{ ...station, is_live: isActuallyLive(station) }}
                  listenerCount={station.live_session_id ? listenerCounts[station.live_session_id] || 0 : 0}
                  shows={shows}
                  mine={station.owner_user_id === user?.id}
                  art={STATION_ART[index % STATION_ART.length]}
                  featured
                  onChanged={load}
                  onSchedule={() => setScheduleStation(station)}
                  onGoLive={() => setLiveStation(station)}
                  onEdit={() => setEditStation(station)}
                />
              ))}
            </div>
          ) : (
            <EmptyLive />
          )}
        </section>

        {upcoming.length ? (
          <section>
            <SectionTitle eyebrow="Coming Up" title="Scheduled broadcasts" />
            <div className="grid gap-2 lg:grid-cols-2">
              {upcoming.map((show, index) => {
                const station = stations.find((item) => item.id === show.station_id);
                return (
                  <div key={show.id} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 transition hover:bg-white/[0.07]">
                    <img src={STATION_ART[(index + 2) % STATION_ART.length]} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-violet-200">{show.show_type}</span>
                        <span className="text-[9px] font-bold text-white/35">{show.duration_minutes} min</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-black">{show.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-white/45">
                        {station?.name || "YAJ Station"} · {show.scheduled_at ? new Date(show.scheduled_at).toLocaleString() : "Time TBA"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5" />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle eyebrow="Discover" title="Stations & networks" />
          {discover.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {discover.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={{ ...station, is_live: isActuallyLive(station) }}
                  listenerCount={station.live_session_id ? listenerCounts[station.live_session_id] || 0 : 0}
                  shows={shows}
                  mine={station.owner_user_id === user?.id}
                  art={STATION_ART[(index + 1) % STATION_ART.length]}
                  onChanged={load}
                  onSchedule={() => setScheduleStation(station)}
                  onGoLive={() => setLiveStation(station)}
                  onEdit={() => setEditStation(station)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 text-center">
              <TowerControl className="mx-auto h-8 w-8 text-white/35" />
              <p className="mt-3 text-sm font-black">Your station directory is just getting started.</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-white/45">Create the first station, build a network, and start programming shows for listeners.</p>
            </div>
          )}
        </section>

        {mine.length ? (
          <section>
            <SectionTitle eyebrow="My Radio" title="My stations" count={String(mine.length)} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={{ ...station, is_live: isActuallyLive(station) }}
                  listenerCount={station.live_session_id ? listenerCounts[station.live_session_id] || 0 : 0}
                  shows={shows}
                  mine
                  art={STATION_ART[(index + 3) % STATION_ART.length]}
                  onChanged={load}
                  onSchedule={() => setScheduleStation(station)}
                  onGoLive={() => setLiveStation(station)}
                  onEdit={() => setEditStation(station)}
                />
              ))}
            </div>
          </section>
        ) : null}

      </main>

      {creatorOpen ? (
        <CreateStationSheet
          onClose={() => setCreatorOpen(false)}
          onCreated={() => {
            setCreatorOpen(false);
            void load();
          }}
        />
      ) : null}

      {scheduleStation ? (
        <ScheduleShowSheet
          station={scheduleStation}
          onClose={() => setScheduleStation(null)}
          onSaved={() => {
            setScheduleStation(null);
            void load();
          }}
        />
      ) : null}

      {editStation ? (
        <EditStationSheet
          station={editStation}
          onClose={() => setEditStation(null)}
          onSaved={() => {
            setEditStation(null);
            void load();
          }}
        />
      ) : null}

      {liveStation ? (
        <StartBroadcastSheet
          station={liveStation}
          onClose={() => setLiveStation(null)}
          onStarted={() => {
            setLiveStation(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function BroadcastHero({
  liveCount,
  stationCount,
  upcomingCount,
  onCreate,
  onGoLive,
}: {
  liveCount: number;
  stationCount: number;
  upcomingCount: number;
  onCreate: () => void;
  onGoLive: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 shadow-2xl">
      <div className="absolute inset-0">
        <img src={radioHost} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b12] via-[#080b12]/88 to-[#080b12]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080b12] via-transparent to-transparent" />
      </div>
      <div className="relative z-10 max-w-2xl px-5 py-7 sm:px-8 sm:py-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.17em]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live Broadcasting
        </span>
        <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-tight sm:text-5xl">Build your broadcast station.</h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
          Morning shows, live podcasts, DJ sets, interviews and 24/7 music programming—all under your own station or network.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={onGoLive} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-slate-950">
            <Mic2 className="h-4 w-4" /> Go Live
          </button>
          <button onClick={onCreate} className="flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-xs font-black">
            <Plus className="h-4 w-4" /> Create Station
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Stat value={liveCount} label="Live now" />
          <Stat value={stationCount} label="Stations" />
          <Stat value={upcomingCount} label="Upcoming" />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className={"text-[10px] font-black uppercase tracking-[0.19em] " + (eyebrow === "On Air Now" ? "text-red-400" : "text-violet-300")}>{eyebrow}</p>
        <h2 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {count ? <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black text-white/60">{count}</span> : null}
    </div>
  );
}

function StationCard({
  station,
  listenerCount,
  shows,
  mine,
  art,
  featured = false,
  onChanged,
  onSchedule,
  onGoLive,
  onEdit,
}: {
  station: Station;
  listenerCount: number;
  shows: Show[];
  mine: boolean;
  art: string;
  featured?: boolean;
  onChanged: () => void;
  onSchedule: () => void;
  onGoLive: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const nextShow = shows.find((show) => show.station_id === station.id && show.status === "scheduled");

  const tuneIn = () => {
    if (station.is_live && station.live_session_id) {
      navigate(
        "/podcast/room/" +
          encodeURIComponent(station.live_session_id) +
          "?audience=1&station=" +
          encodeURIComponent(station.id) +
          "&source=radio",
      );
      return;
    }
    toast({
      title: station.is_live ? "Live room is starting" : "Station followed",
      description: station.is_live
        ? "The host has not opened the live room yet."
        : "You can find this station here anytime.",
    });
  };

  return (
    <article className={"group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] shadow-xl transition hover:-translate-y-0.5 hover:bg-white/[0.065] " + (featured ? "min-w-[82vw] sm:min-w-[360px] lg:min-w-0" : "")}>
      <div className="relative h-44 overflow-hidden">
        <img src={station.banner_url || station.logo_url || art} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d16] via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className={"rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] " + (station.is_live ? "bg-red-500 text-white" : "bg-black/55 text-white/75 backdrop-blur")}>
            {station.is_live ? "● LIVE" : station.programming_mode}
          </span>
          {station.genre ? <span className="rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-bold text-white/70 backdrop-blur">{station.genre}</span> : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="truncate text-lg font-black">{station.name}</p>
          <p className="truncate text-[11px] text-white/60">{station.network_name || station.tagline || "Independent YAJ station"}</p>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        {station.is_live ? (
          <div className="rounded-2xl border border-red-400/15 bg-red-500/10 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-red-300">Now on air</p>
            <p className="mt-1 text-sm font-black">{station.live_title || "Live Show"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
              <Waves className="h-3.5 w-3.5" /> Live broadcast in progress · {listenerCount} listening
            </p>
          </div>
        ) : nextShow ? (
          <div className="rounded-2xl bg-white/[0.05] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-300">Next broadcast</p>
            <p className="mt-1 truncate text-sm font-black">{nextShow.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
              <Clock3 className="h-3.5 w-3.5" /> {nextShow.scheduled_at ? new Date(nextShow.scheduled_at).toLocaleString() : "Time TBA"}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-[10px] text-white/45">
            {station.programming_mode === "music" ? <Music2 className="h-4 w-4 text-cyan-200" /> : <Radio className="h-4 w-4 text-violet-200" />}
            <span>{station.programming_mode === "music" ? "Music programming" : "Station currently off air"}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={tuneIn} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-3 py-2.5 text-xs font-black text-slate-950">
            <Headphones className="h-4 w-4" /> {station.is_live ? "Tune In" : "Follow"}
          </button>
          {mine ? (
            <>
              <button onClick={onEdit} className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black">
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button onClick={onSchedule} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black">Schedule</button>
              <button onClick={onGoLive} className="rounded-full bg-violet-600 px-3 py-2.5 text-[10px] font-black">Go Live</button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyLive() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10">
      <img src={podcastHost} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090c13] via-[#090c13]/90 to-[#090c13]/55" />
      <div className="relative z-10 max-w-xl p-6 sm:p-8">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <Radio className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-2xl font-black">The air is open.</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          No station is live right now. Live broadcasts will appear here automatically when a station goes on air.
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20 rounded-xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/40">{label}</p>
    </div>
  );
}

function StartBroadcastSheet({
  station,
  onClose,
  onStarted,
}: {
  station: Station;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [title, setTitle] = useState(station.live_title || station.name + " Live");
  const [type, setType] = useState("talk");
  const [duration, setDuration] = useState(60);
  const [inviteAfterStart, setInviteAfterStart] = useState(false);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim()) return;
    setStarting(true);

    const hostName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Host";

    const session = PodcastSessionStore.create({
      title: title.trim(),
      description: type === "podcast" ? "Live podcast on YAJ Radio" : "Live " + type + " broadcast on YAJ Radio",
      hostId: user.id,
      hostName,
      scheduledAt: Date.now(),
      durationMin: duration,
      visibility: "public",
    });
    PodcastSessionStore.markLive(session.id);

    const { error: stationError } = await (supabase as any)
      .from("radio_stations")
      .update({
        is_live: true,
        live_title: title.trim(),
        live_started_at: new Date().toISOString(),
        live_session_id: session.id,
      })
      .eq("id", station.id)
      .eq("owner_user_id", user.id);

    if (stationError) {
      setStarting(false);
      toast({
        title: "Radio database is not ready",
        description: "The YAJ Radio station migration still needs to be applied in Supabase before live station syncing can work.",
        variant: "destructive",
      });
      return;
    }

    await (supabase as any).from("radio_station_shows").insert({
      station_id: station.id,
      host_user_id: user.id,
      title: title.trim(),
      show_type: type,
      scheduled_at: new Date().toISOString(),
      duration_minutes: duration,
      status: "live",
      live_session_id: session.id,
    });

    setStarting(false);
    onStarted();
    navigate(
      "/podcast/room/" +
        encodeURIComponent(session.id) +
        "?station=" +
        encodeURIComponent(station.id) +
        "&source=radio" +
        (inviteAfterStart ? "&invite=1" : ""),
    );
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={start}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Start Broadcast · {station.name}</p>
        <h2 className="mt-1 text-2xl font-black">Go on air</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Enter the show once here. Starting takes you directly into the broadcast room and publishes the station under On Air Now.
        </p>

        <div className="mt-5 space-y-3">
          <Field value={title} onChange={setTitle} placeholder="Broadcast title" />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none"
          >
            <option value="talk" className="bg-slate-950">Talk show</option>
            <option value="podcast" className="bg-slate-950">Live podcast</option>
            <option value="interview" className="bg-slate-950">Interview</option>
            <option value="music" className="bg-slate-950">Music show</option>
            <option value="mix" className="bg-slate-950">DJ / Mix</option>
          </select>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none"
          >
            <option value={30} className="bg-slate-950">30 minutes</option>
            <option value={60} className="bg-slate-950">1 hour</option>
            <option value={90} className="bg-slate-950">90 minutes</option>
            <option value={120} className="bg-slate-950">2 hours</option>
          </select>

          <button
            type="button"
            onClick={() => setInviteAfterStart((value) => !value)}
            className={
              "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition " +
              (inviteAfterStart
                ? "border-violet-400 bg-violet-500/15"
                : "border-white/10 bg-white/[0.04]")
            }
          >
            <span>
              <span className="block text-xs font-black">Invite guests after starting</span>
              <span className="mt-0.5 block text-[10px] text-white/45">Open the speaker invite sheet as soon as you go live.</span>
            </span>
            <span className={"h-5 w-9 rounded-full p-0.5 transition " + (inviteAfterStart ? "bg-violet-500" : "bg-white/10")}>
              <span className={"block h-4 w-4 rounded-full bg-white transition " + (inviteAfterStart ? "translate-x-4" : "")} />
            </span>
          </button>
        </div>

        <ModalActions
          onClose={onClose}
          disabled={starting || !title.trim()}
          label={starting ? "Starting…" : "Go On Air"}
        />
      </form>
    </ModalShell>
  );
}

function ScheduleShowSheet({ station, onClose, onSaved }: { station: Station; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("talk");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim() || !scheduledAt) return;
    setSaving(true);
    const { error } = await (supabase as any).from("radio_station_shows").insert({
      station_id: station.id,
      host_user_id: user.id,
      title: title.trim(),
      show_type: type,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: duration,
      status: "scheduled",
    });
    setSaving(false);

    if (error) {
      toast({ title: "Could not schedule show", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Show scheduled", description: title.trim() + " will appear in upcoming broadcasts." });
    onSaved();
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={save}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">{station.name}</p>
        <h2 className="mt-1 text-2xl font-black">Schedule a broadcast</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">Morning shows, live podcasts, interviews, music blocks and DJ sets all start here.</p>

        <div className="mt-5 space-y-3">
          <Field value={title} onChange={setTitle} placeholder="Show title" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none">
            <option value="talk" className="bg-slate-950">Talk show</option>
            <option value="podcast" className="bg-slate-950">Live podcast</option>
            <option value="interview" className="bg-slate-950">Interview</option>
            <option value="music" className="bg-slate-950">Music show</option>
            <option value="mix" className="bg-slate-950">DJ / Mix</option>
          </select>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none" />
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none">
            <option value={30} className="bg-slate-950">30 minutes</option>
            <option value={60} className="bg-slate-950">1 hour</option>
            <option value={90} className="bg-slate-950">90 minutes</option>
            <option value={120} className="bg-slate-950">2 hours</option>
          </select>
        </div>

        <ModalActions onClose={onClose} disabled={saving || !title.trim() || !scheduledAt} label={saving ? "Scheduling…" : "Schedule Show"} />
      </form>
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
  const [name, setName] = useState(station.name);
  const [networkName, setNetworkName] = useState(station.network_name || "");
  const [tagline, setTagline] = useState(station.tagline || "");
  const [genre, setGenre] = useState(station.genre || "");
  const [mode, setMode] = useState<Station["programming_mode"]>(station.programming_mode);
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
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Update the station identity, format and cover image whenever you want.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.04]">
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-28 flex-col items-center justify-center gap-2 text-white/45">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs font-black">Upload station cover</span>
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
          <Field value={genre} onChange={setGenre} placeholder="Format — Hip-Hop, Talk, News, Gospel…" />

          <div className="grid grid-cols-4 gap-1.5">
            {(["mixed", "live", "music", "podcast"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={"min-h-11 rounded-xl border text-[10px] font-black capitalize transition " + (mode === item ? "border-violet-400 bg-violet-500 text-white" : "border-white/10 bg-white/[0.04] text-white/60")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

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
  const [mode, setMode] = useState<Station["programming_mode"]>("mixed");
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
    });
    setSaving(false);

    if (error) {
      const missingTable = String(error.message || "").includes("radio_stations");
      toast({
        title: missingTable ? "Radio setup pending" : "Could not create station",
        description: missingTable
          ? "The station database has not been activated yet."
          : error.message,
        variant: missingTable ? "default" : "destructive",
      });
      return;
    }

    toast({ title: "Station created", description: "Schedule shows, program music, or go live." });
    onCreated();
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={create}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Create on YAJ Radio</p>
        <h2 className="mt-1 text-2xl font-black">Start a station or network</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">Build a real broadcast identity for live talk, podcasts, interviews, DJ sets and 24/7 music.</p>

        <div className="mt-5 space-y-3">
          <label className="block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.04]">
            {coverPreview ? (
              <img src={coverPreview} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-28 flex-col items-center justify-center gap-2 text-white/45">
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
                if (coverPreview) URL.revokeObjectURL(coverPreview);
                setCoverPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <Field value={name} onChange={setName} placeholder="Station name" />
          <Field value={networkName} onChange={setNetworkName} placeholder="Network name (optional)" />
          <Field value={tagline} onChange={setTagline} placeholder="Tagline" />
          <Field value={genre} onChange={setGenre} placeholder="Format — Hip-Hop, Talk, News, Gospel…" />

          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Programming style</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["mixed", "live", "music", "podcast"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={"min-h-11 rounded-xl border text-[10px] font-black capitalize transition " + (mode === item ? "border-violet-400 bg-violet-500 text-white" : "border-white/10 bg-white/[0.04] text-white/60")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ModalActions onClose={onClose} disabled={saving || !name.trim()} label={saving ? "Creating…" : "Create Station"} />
      </form>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-black/75 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full rounded-t-[30px] border border-white/10 bg-[#0d111b] p-5 text-white shadow-2xl sm:max-w-md sm:rounded-[30px] sm:p-6">
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, disabled, label }: { onClose: () => void; disabled: boolean; label: string }) {
  return (
    <div className="mt-6 flex gap-2">
      <button type="button" onClick={onClose} className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black">Cancel</button>
      <button disabled={disabled} type="submit" className="flex-1 rounded-full bg-violet-600 px-4 py-3 text-sm font-black disabled:opacity-40">{label}</button>
    </div>
  );
}

function Field({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400"
    />
  );
}
