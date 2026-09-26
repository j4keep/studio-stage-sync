import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Headphones,
  Image as ImageIcon,
  Pencil,
  Plus,
  RadioTower,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { uploadToR2 } from "@/lib/r2-storage";
import radioHost from "@/assets/wstudio-orbit-headphones.jpg";
import studioMic from "@/assets/wstudio-orbit-mic.jpg";
import studioMixer from "@/assets/wstudio-orbit-mixer.jpg";
import podcastHost from "@/assets/podcast-1.jpg";
import djHost from "@/assets/artist-dj-onyx.jpg";

type StationMode = "mixed" | "music" | "podcast" | "live";

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
  const [query, setQuery] = useState("");

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("radio_stations")
      .select("id,owner_user_id,name,tagline,genre,network_name,programming_mode,logo_url,banner_url")
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

  const listen = (_station: Station) => {
    navigate("/radio");
  };

  return (
    <div className="min-h-screen bg-[#080b12] pb-[calc(10rem+env(safe-area-inset-bottom))] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080b12]/92 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/radio")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"
            aria-label="Back to YAJ Radio"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">YAJ Radio</p>
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Radio Stations</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-violet-600 px-4 text-xs font-black"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Station</span>
          </button>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-6xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4">
          <Search className="h-4 w-4 text-white/45" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stations, networks, genres, hosts…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-9 px-4 pt-5">
        <section className="relative overflow-hidden rounded-[30px] border border-white/10 shadow-2xl">
          <img src={radioHost} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080b12] via-[#080b12]/92 to-[#080b12]/55" />
          <div className="relative z-10 max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.17em] text-violet-200">
              <RadioTower className="h-3.5 w-3.5" /> Your station. Your sound.
            </span>
            <h2 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">Create a radio station people can listen to.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              Build a station around your music, audio podcasts, genre, or network. YAJ Radio stays focused on listening—no extra live-broadcast system.
            </p>
            <button
              type="button"
              onClick={() => setCreatorOpen(true)}
              className="mt-5 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-black text-slate-950"
            >
              <Plus className="h-4 w-4" /> Create Radio Station
            </button>
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Discover" title="Stations & networks" count={filtered.length ? String(filtered.length) : undefined} />
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-72 animate-pulse rounded-[26px] bg-white/[0.05]" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={station}
                  hostName={hostNames[station.owner_user_id]}
                  mine={station.owner_user_id === user?.id}
                  art={STATION_ART[index % STATION_ART.length]}
                  onListen={() => listen(station)}
                  onEdit={() => setEditStation(station)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-8 text-center">
              <RadioTower className="mx-auto h-8 w-8 text-white/35" />
              <p className="mt-3 text-sm font-black">No stations found.</p>
              <p className="mt-1 text-xs text-white/45">Create the first one or try another search.</p>
            </div>
          )}
        </section>

        {mine.length > 0 && (
          <section>
            <SectionTitle eyebrow="My Radio" title="My stations" count={String(mine.length)} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={station}
                  hostName={hostNames[station.owner_user_id]}
                  mine
                  art={STATION_ART[(index + 2) % STATION_ART.length]}
                  onListen={() => listen(station)}
                  onEdit={() => setEditStation(station)}
                />
              ))}
            </div>
          </section>
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
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black text-white/60">
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
}: {
  station: Station;
  hostName?: string;
  mine: boolean;
  art: string;
  onListen: () => void;
  onEdit: () => void;
}) {
  const mode = station.programming_mode === "live" ? "mixed" : station.programming_mode;

  return (
    <article className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] shadow-xl transition hover:-translate-y-0.5 hover:bg-white/[0.065]">
      <div className="relative h-48 overflow-hidden">
        <img
          src={station.banner_url || station.logo_url || art}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d16] via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/80 backdrop-blur">
            {mode}
          </span>
          {station.genre ? (
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-bold text-white/70 backdrop-blur">
              {station.genre}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="truncate text-xl font-black">{station.name}</p>
          <p className="truncate text-[11px] text-white/60">
            {station.network_name || station.tagline || hostName || "Independent YAJ station"}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-300">Radio Station</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            {station.tagline || `Listen to ${station.name} on YAJ Radio.`}
          </p>
          {hostName ? <p className="mt-2 text-[10px] text-white/35">By {hostName}</p> : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onListen}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-3 py-2.5 text-xs font-black text-slate-950"
          >
            <Headphones className="h-4 w-4" /> Listen
          </button>
          {mine ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          ) : null}
        </div>
      </div>
    </article>
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
  const [mode, setMode] = useState<Exclude<StationMode, "live">>(
    station.programming_mode === "live" ? "mixed" : station.programming_mode,
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
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Update the station name, format, network and cover.
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
  const [mode, setMode] = useState<Exclude<StationMode, "live">>("mixed");
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
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Create your station identity and let listeners tune into your YAJ Radio content.
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
  mode: Exclude<StationMode, "live">;
  setMode: (value: Exclude<StationMode, "live">) => void;
  coverPreview: string | null;
  setCoverPreview: (value: string | null) => void;
  setCoverFile: (file: File | null) => void;
}) {
  return (
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
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">Station format</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["mixed", "music", "podcast"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={
                "min-h-11 rounded-xl border text-[10px] font-black capitalize transition " +
                (mode === item
                  ? "border-violet-400 bg-violet-500 text-white"
                  : "border-white/10 bg-white/[0.04] text-white/60")
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
      className="fixed inset-0 z-[120] flex items-end bg-black/75 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0d111b] p-5 shadow-2xl sm:max-w-lg sm:rounded-[28px]"
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
        className="flex-1 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-black"
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
      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/30"
    />
  );
}
