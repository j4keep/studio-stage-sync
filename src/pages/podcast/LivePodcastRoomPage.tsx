import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track, VideoPresets, ScreenSharePresets } from "livekit-client";
import "@livekit/components-styles";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Circle, Copy, Download, Image, Loader2, Radio, Scissors, Sparkles, StopCircle } from "lucide-react";

type TokenResponse = {
  token: string;
  url: string;
  room: string;
  identity: string;
  role: string;
  displayName: string;
};

type StudioBackground = {
  id: string;
  name: string;
  imageUrl?: string;
  css: string;
};

const BACKGROUND_PRESETS: StudioBackground[] = [
  { id: "none", name: "Clean", css: "linear-gradient(135deg, hsl(var(--background)), hsl(var(--muted)))" },
  { id: "newsroom", name: "Newsroom", css: "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.35), transparent 28%), linear-gradient(135deg, hsl(220 24% 10%), hsl(0 0% 4%))" },
  { id: "cinema", name: "Cinema", css: "linear-gradient(135deg, hsl(0 78% 14%), hsl(240 18% 5%) 58%, hsl(204 100% 18%))" },
  { id: "gallery", name: "Gallery", css: "linear-gradient(135deg, hsl(38 18% 16%), hsl(190 18% 9%))" },
];

const LivePodcastRoomPage = () => {
  const { episodeId } = useParams();
  const [search] = useSearchParams();
  const inviteToken = search.get("invite") || undefined;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [episode, setEpisode] = useState<{ id: string; title: string; host_user_id: string; livekit_room: string } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [askGuestName, setAskGuestName] = useState(false);
  const [quality, setQuality] = useState<"720p" | "1080p" | "4K">("1080p");
  const [layoutMode, setLayoutMode] = useState<"Grid" | "Speaker" | "Screen">("Grid");
  const [background, setBackground] = useState<StudioBackground>(BACKGROUND_PRESETS[0]);

  const videoOptions = useMemo(() => {
    const preset = quality === "4K" ? VideoPresets.h2160 : quality === "1080p" ? VideoPresets.h1080 : VideoPresets.h720;
    return {
      resolution: preset.resolution,
    };
  }, [quality]);

  const publishOptions = useMemo(() => {
    const preset = quality === "4K" ? VideoPresets.h2160 : quality === "1080p" ? VideoPresets.h1080 : VideoPresets.h720;
    return {
      videoEncoding: preset.encoding,
      screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
      simulcast: quality !== "4K",
    };
  }, [quality]);

  useEffect(() => {
    const load = async () => {
      if (!episodeId) return;
      const { data, error } = await supabase
        .from("podcast_episodes")
        .select("id,title,host_user_id,livekit_room")
        .eq("id", episodeId)
        .maybeSingle();
      if (error || !data) {
        setError("Episode not found");
        return;
      }
      setEpisode(data);
    };
    load();
  }, [episodeId]);

  const requestToken = async () => {
    if (!episodeId) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { episodeId, inviteToken },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setTokenInfo(data as TokenResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const copyInviteLink = async () => {
    if (!episode || !user || episode.host_user_id !== user.id) return;
    // Create or fetch a generic guest invite
    const displayName = prompt("Guest's display name?")?.trim();
    if (!displayName) return;
    const { data, error } = await supabase
      .from("podcast_participants")
      .insert({ episode_id: episode.id, display_name: displayName, role: "guest" })
      .select("invite_token")
      .single();
    if (error || !data) {
      toast({ title: "Couldn't create invite", description: error?.message, variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/#/tv/podcast/${episode.id}?invite=${data.invite_token}`;
    await navigator.clipboard.writeText(link);
    toast({ title: "Invite link copied", description: link });
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-destructive font-medium">{error}</p>
        <Button onClick={() => navigate("/tv/podcast")} className="mt-4" variant="outline">Back to lobby</Button>
      </div>
    );
  }

  if (!episode) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!tokenInfo) {
    const isHost = !!user && user.id === episode.host_user_id;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-md mx-auto">
        <button onClick={() => navigate(isHost ? "/tv/podcast" : "/tv")} className="self-start mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-display font-bold mb-1 text-center">{episode.title}</h1>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          {isHost ? "Ready to host this episode?" : "You've been invited to join this podcast."}
        </p>
        {!user && !inviteToken && (
          <p className="text-sm text-destructive mb-3">Sign in or use a valid invite link.</p>
        )}
        <Button size="lg" onClick={requestToken} disabled={joining} className="w-full">
          {joining ? "Joining…" : "Enter Studio"}
        </Button>
        {isHost && (
          <Button variant="outline" className="w-full mt-3" onClick={copyInviteLink}>
            <Copy className="w-4 h-4 mr-2" /> Create Guest Invite Link
          </Button>
        )}
      </div>
    );
  }

  const isHost = tokenInfo.role === "host";

  return (
    <div className="dark h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-card border-b border-border">
        <button onClick={() => navigate(isHost ? "/tv/podcast" : "/tv")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Leave
        </button>
        <div className="min-w-0 flex-1 text-center text-sm font-medium truncate">{episode.title}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Segmented value={quality} options={["720p", "1080p", "4K"]} onChange={(v) => setQuality(v as "720p" | "1080p" | "4K")} />
          <Segmented value={layoutMode} options={["Grid", "Speaker", "Screen"]} onChange={(v) => setLayoutMode(v as "Grid" | "Speaker" | "Screen")} />
            <BackgroundPicker value={background} onChange={setBackground} />
          {isHost && <GoLiveButton episodeId={episode.id} />}
          {isHost && (
            <button onClick={copyInviteLink} className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-secondary flex items-center gap-1">
              <Copy className="w-3 h-3" /> Invite
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <LiveKitRoom
          token={tokenInfo.token}
          serverUrl={tokenInfo.url}
          connect
          video={videoOptions}
          audio
          options={{ videoCaptureDefaults: videoOptions, publishDefaults: publishOptions }}
          data-lk-theme="default"
          className="h-full"
          onDisconnected={() => navigate(isHost ? "/tv/podcast" : "/tv")}
        >
          <RoomAudioRenderer />
          <div className="flex h-full flex-col">
            <div className="flex-1 min-h-0">
              <Stage layoutMode={layoutMode} background={background} />
            </div>
            <div className="border-t border-border bg-card">
              <LocalRecorder episodeId={episode.id} participantIdentity={tokenInfo.identity} displayName={tokenInfo.displayName} quality={quality} background={background} />
              <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, leave: true, chat: false }} />
            </div>
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
};

const Stage = ({ layoutMode }: { layoutMode: "Grid" | "Speaker" | "Screen" }) => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const stageClass = layoutMode === "Speaker" ? "h-full [&_.lk-grid-layout]:grid-cols-1" : layoutMode === "Screen" ? "h-full [&_.lk-grid-layout]:grid-cols-1" : "h-full";
  return (
    <GridLayout tracks={tracks} className={stageClass}>
      <ParticipantTile />
    </GridLayout>
  );
};

const LocalRecorder = ({
  episodeId,
  participantIdentity,
  displayName,
  quality,
}: {
  episodeId: string;
  participantIdentity: string;
  displayName: string;
  quality: "720p" | "1080p" | "4K";
}) => {
  const { localParticipant } = useLocalParticipant();
  const [recording, setRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const r2PrefixRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, []);

  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];

  const pickMime = () => mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const captureCombinedStream = async (): Promise<MediaStream> => {
    // Combine local microphone + camera tracks from LiveKit's local publications.
    const stream = new MediaStream();
    const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
    if (camPub?.track?.mediaStreamTrack) stream.addTrack(camPub.track.mediaStreamTrack);
    if (micPub?.track?.mediaStreamTrack) stream.addTrack(micPub.track.mediaStreamTrack);
    if (stream.getTracks().length === 0) {
      // Fallback: getUserMedia directly
      const direct = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      direct.getTracks().forEach((t) => stream.addTrack(t));
    }
    return stream;
  };

  const uploadChunk = async (blob: Blob, index: number, mime: string) => {
    const key = `${r2PrefixRef.current}${index.toString().padStart(6, "0")}.webm`;
    const buf = await blob.arrayBuffer();
    try {
      const url = `https://cdcdlqbjyptamtleitdp.supabase.co/functions/v1/r2-upload`;
      await fetch(url, {
        method: "POST",
        headers: {
          "x-upload-key": key,
          "x-upload-content-type": mime,
          "Content-Type": mime,
          "Content-Length": String(buf.byteLength),
        },
        body: buf,
      });
    } catch (e) {
      console.error("chunk upload failed", e);
    }
  };

  const start = async () => {
    try {
      const stream = await captureCombinedStream();
      const mime = pickMime();
      const safeId = participantIdentity.replace(/[^a-zA-Z0-9_-]/g, "_");
      const prefix = `podcast/${episodeId}/${safeId}/`;
      r2PrefixRef.current = prefix;
      chunkIndexRef.current = 0;

      const { data: rec, error } = await supabase
        .from("podcast_recordings")
        .insert({
          episode_id: episodeId,
          uploader_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
          mime_type: mime,
          r2_prefix: prefix,
          status: "recording",
        })
        .select("id")
        .single();
      if (error) throw error;
      setRecordingId(rec.id);

      const videoBitsPerSecond = quality === "4K" ? 14_000_000 : quality === "1080p" ? 8_000_000 : 4_000_000;
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = async (ev) => {
        if (ev.data && ev.data.size > 0) {
          const idx = chunkIndexRef.current++;
          await uploadChunk(ev.data, idx, mime);
          await supabase
            .from("podcast_recordings")
            .update({ chunk_count: idx + 1 })
            .eq("id", rec.id);
        }
      };
      mr.onstop = async () => {
        await supabase.from("podcast_recordings").update({ status: "uploaded", duration_seconds: seconds }).eq("id", rec.id);
      };
      mr.start(5000); // 5s chunks
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      toast({ title: "Recording started", description: "Your tracks upload to your library as you talk." });
    } catch (e) {
      toast({ title: "Couldn't start recording", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    toast({ title: "Recording stopped", description: "Final chunks uploading…" });
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 text-white text-sm">
      <div className="flex items-center gap-2">
        {recording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono">{formatTime(seconds)}</span>
            <span className="text-xs text-zinc-400">Recording locally</span>
          </>
        ) : (
          <span className="text-xs text-zinc-400">Not recording</span>
        )}
      </div>
      <div>
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            <StopCircle className="w-4 h-4 mr-1" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={start}>
            <Circle className="w-4 h-4 mr-1 fill-current" /> Record
          </Button>
        )}
      </div>
    </div>
  );
};

const GoLiveButton = ({ episodeId }: { episodeId: string }) => {
  const [live, setLive] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(() => localStorage.getItem(`egress_${episodeId}`));
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (egressId) setLive(true); }, [egressId]);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("livekit-egress", { body: { action: "start", episodeId } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const id = (data as { egressId?: string }).egressId;
      setEgressId(id ?? null);
      if (id) localStorage.setItem(`egress_${episodeId}`, id);
      setLive(true);
      toast({
        title: "You're live!",
        description: (data as { inAppOnly?: boolean }).inAppOnly ? "Live on WHEUAT. Add RTMP to simulcast." : "Streaming to all enabled destinations.",
      });
    } catch (e) {
      toast({ title: "Couldn't go live", description: e instanceof Error ? e.message : "Add a destination first.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const { error, data } = await supabase.functions.invoke("livekit-egress", { body: { action: "stop", episodeId, egressId } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setLive(false);
      setEgressId(null);
      localStorage.removeItem(`egress_${episodeId}`);
      toast({ title: "Stream stopped" });
    } catch (e) {
      toast({ title: "Couldn't stop", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return live ? (
    <button onClick={stop} disabled={busy} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE — Stop
    </button>
  ) : (
    <button onClick={start} disabled={busy} className="text-xs px-2 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white flex items-center gap-1">
      <RadioBroadcast /> Go Live
    </button>
  );
};

const RadioBroadcast = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M8 8a5.66 5.66 0 0 0 0 8M16 8a5.66 5.66 0 0 1 0 8M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" />
  </svg>
);

const Segmented = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <div className="flex rounded-md border border-border bg-background p-0.5">
    {options.map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={`rounded px-2 py-1 text-xs font-semibold ${value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
      >
        {option}
      </button>
    ))}
  </div>
);

const formatTime = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export default LivePodcastRoomPage;
