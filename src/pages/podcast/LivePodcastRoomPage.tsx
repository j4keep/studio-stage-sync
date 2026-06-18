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
import { ArrowLeft, Circle, CircleHelp, Copy, Image, LayoutTemplate, Loader2, MessageSquareText, Mic, Music, Palette, Plus, Settings, Share2, Smile, Sparkles, StopCircle, Type, Users, Video } from "lucide-react";

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
  const [activeTool, setActiveTool] = useState<StudioTool>("Settings");

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
          <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 min-h-0">
                <Stage layoutMode={layoutMode} background={background} />
              </div>
              <div className="border-t border-border bg-card">
                <LocalRecorder episodeId={episode.id} participantIdentity={tokenInfo.identity} displayName={tokenInfo.displayName} quality={quality} background={background} />
                <ControlBar variation="minimal" controls={{ microphone: true, camera: true, screenShare: true, leave: true, chat: false }} />
              </div>
            </div>
            <div className="hidden w-[360px] border-l border-border bg-card/80 lg:block">
              <StudioSidePanel episodeId={episode.id} displayName={tokenInfo.displayName} activeTool={activeTool} quality={quality} setQuality={setQuality} layoutMode={layoutMode} setLayoutMode={setLayoutMode} background={background} setBackground={setBackground} />
            </div>
            <StudioToolDock activeTool={activeTool} setActiveTool={setActiveTool} />
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
};

type StudioTool = "People" | "Chat" | "Brand" | "Text" | "Media" | "Settings" | "Help";

const TOOL_ITEMS: { id: StudioTool; icon: JSX.Element }[] = [
  { id: "People", icon: <Users className="h-5 w-5" /> },
  { id: "Chat", icon: <MessageSquareText className="h-5 w-5" /> },
  { id: "Brand", icon: <Palette className="h-5 w-5" /> },
  { id: "Text", icon: <Type className="h-5 w-5" /> },
  { id: "Media", icon: <Music className="h-5 w-5" /> },
  { id: "Settings", icon: <Settings className="h-5 w-5" /> },
  { id: "Help", icon: <CircleHelp className="h-5 w-5" /> },
];

const StudioToolDock = ({ activeTool, setActiveTool }: { activeTool: StudioTool; setActiveTool: (tool: StudioTool) => void }) => (
  <nav className="hidden w-20 flex-col items-center gap-2 border-l border-border bg-background/95 py-4 lg:flex">
    {TOOL_ITEMS.map((tool) => (
      <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`flex w-16 flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] ${activeTool === tool.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
        {tool.icon}<span>{tool.id}</span>
      </button>
    ))}
  </nav>
);

const StudioSidePanel = ({
  episodeId,
  displayName,
  activeTool,
  quality,
  setQuality,
  layoutMode,
  setLayoutMode,
  background,
  setBackground,
}: {
  episodeId: string;
  displayName: string;
  activeTool: StudioTool;
  quality: "720p" | "1080p" | "4K";
  setQuality: (quality: "720p" | "1080p" | "4K") => void;
  layoutMode: "Grid" | "Speaker" | "Screen";
  setLayoutMode: (layout: "Grid" | "Speaker" | "Screen") => void;
  background: StudioBackground;
  setBackground: (background: StudioBackground) => void;
}) => {
  const [messages, setMessages] = useState<{ id: string; sender_name: string; body: string; created_at: string }[]>([]);
  const [chatText, setChatText] = useState("");
  const [lowerThird, setLowerThird] = useState("Subscribe • Like • Share");

  useEffect(() => {
    if (activeTool !== "Chat") return;
    let alive = true;
    const loadMessages = async () => {
      const { data } = await supabase.from("podcast_chat_messages").select("id,sender_name,body,created_at").eq("episode_id", episodeId).order("created_at", { ascending: true }).limit(40);
      if (alive) setMessages((data as typeof messages) ?? []);
    };
    loadMessages();
    const interval = window.setInterval(loadMessages, 2500);
    return () => { alive = false; window.clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, episodeId]);

  const sendMessage = async () => {
    if (!chatText.trim()) return;
    const { error } = await supabase.from("podcast_chat_messages").insert({ episode_id: episodeId, sender_name: displayName, body: chatText.trim() });
    if (error) {
      toast({ title: "Chat failed", description: error.message, variant: "destructive" });
      return;
    }
    setChatText("");
  };

  return (
    <aside className="flex h-full flex-col p-4">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{activeTool}</h2>
        <Sparkles className="h-4 w-4 text-primary" />
      </div>

      {activeTool === "People" && <ToolSection title="Participants" body="Host and guests show here while they join."><div className="rounded-lg border border-border p-3"><div className="font-semibold">{displayName}</div><div className="text-xs text-muted-foreground">In studio now</div></div><Button className="mt-3 w-full" variant="secondary"><Plus className="mr-2 h-4 w-4" /> Invite guest</Button></ToolSection>}

      {activeTool === "Chat" && <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-lg border border-border p-3">{messages.length ? messages.map((message) => <div key={message.id} className="rounded-md bg-muted p-2 text-sm"><div className="text-xs font-semibold text-primary">{message.sender_name}</div>{message.body}</div>) : <div className="text-sm text-muted-foreground">No chat yet.</div>}</div><div className="mt-3 flex gap-2"><Input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Message guests" onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} /><Button onClick={sendMessage}>Send</Button></div></div>}

      {activeTool === "Brand" && <ToolSection title="Brand kit" body="Choose overlays and virtual backgrounds."><div className="space-y-3"><Control label="AI / preset background"><BackgroundPicker value={background} onChange={setBackground} /></Control><Control label="Lower third"><Input value={lowerThird} onChange={(event) => setLowerThird(event.target.value)} /></Control><div className="rounded-lg border border-border p-3 text-sm"><div className="font-semibold">Overlay preview</div><div className="mt-2 rounded-md bg-primary/15 p-2 text-primary">{lowerThird}</div></div></div></ToolSection>}

      {activeTool === "Text" && <ToolSection title="On-screen text" body="Add titles, lower thirds, and captions for the recording."><div className="space-y-2"><Input placeholder="Title text" /><Button className="w-full" variant="secondary"><Type className="mr-2 h-4 w-4" /> Add text layer</Button><Button className="w-full" variant="outline">Captions after transcript</Button></div></ToolSection>}

      {activeTool === "Media" && <ToolSection title="Media" body="Bring in audio, video, images, and screen share assets."><div className="grid grid-cols-2 gap-2"><MediaButton icon={<UploadIcon />} label="Upload" /><MediaButton icon={<Share2 className="h-4 w-4" />} label="Share screen" /><MediaButton icon={<Music className="h-4 w-4" />} label="Audio" /><MediaButton icon={<Image className="h-4 w-4" />} label="Image" /></div></ToolSection>}

      {activeTool === "Settings" && <ToolSection title="Quick settings" body="Set recording quality before starting."><div className="space-y-4"><Control label="Recording resolution"><Segmented value={quality} options={["720p", "1080p", "4K"]} onChange={(v) => setQuality(v as "720p" | "1080p" | "4K")} /></Control><Control label="Layout"><Segmented value={layoutMode} options={["Grid", "Speaker", "Screen"]} onChange={(v) => setLayoutMode(v as "Grid" | "Speaker" | "Screen")} /></Control><Control label="Noise reduction"><div className="rounded-md border border-border p-3 text-sm">Magic Audio is available in the editor export.</div></Control></div></ToolSection>}

      {activeTool === "Help" && <ToolSection title="Help" body="Studio support tools."><div className="space-y-2"><Button className="w-full" variant="secondary">Chat support</Button><Button className="w-full" variant="secondary">Help center</Button><Button className="w-full" variant="outline" onClick={() => navigator.clipboard.writeText(`${navigator.userAgent}\nEpisode: ${episodeId}`)}>Copy tech details</Button></div></ToolSection>}
    </aside>
  );
};

const ToolSection = ({ title, body, children }: { title: string; body: string; children: JSX.Element | JSX.Element[] }) => <section><h3 className="font-semibold">{title}</h3><p className="mt-1 mb-4 text-sm text-muted-foreground">{body}</p>{children}</section>;
const MediaButton = ({ icon, label }: { icon: JSX.Element; label: string }) => <button className="rounded-lg border border-border p-4 text-left hover:bg-muted"><span className="text-primary">{icon}</span><div className="mt-3 text-sm font-semibold">{label}</div></button>;
const UploadIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 16v4H4v-4"/></svg>;

const Stage = ({ layoutMode, background }: { layoutMode: "Grid" | "Speaker" | "Screen"; background: StudioBackground }) => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const stageClass = layoutMode === "Speaker" ? "h-full [&_.lk-grid-layout]:grid-cols-1" : layoutMode === "Screen" ? "h-full [&_.lk-grid-layout]:grid-cols-1" : "h-full";
  return (
    <div className="relative h-full overflow-hidden" style={{ backgroundImage: background.css, backgroundSize: "cover", backgroundPosition: "center" }}>
      {background.imageUrl && <img src={background.imageUrl} alt="Studio background" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-background/20" />
      <GridLayout tracks={tracks} className={`relative z-10 ${stageClass}`}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
};

const LocalRecorder = ({
  episodeId,
  participantIdentity,
  displayName,
  quality,
  background,
}: {
  episodeId: string;
  participantIdentity: string;
  displayName: string;
  quality: "720p" | "1080p" | "4K";
  background: StudioBackground;
}) => {
  const { localParticipant } = useLocalParticipant();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [savedRecording, setSavedRecording] = useState<{ id: string; chunks: number; seconds: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const uploadedChunksRef = useRef(0);
  const secondsRef = useRef(0);
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
    const url = `https://cdcdlqbjyptamtleitdp.supabase.co/functions/v1/r2-upload`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-upload-key": key,
        "x-upload-content-type": mime,
        "Content-Type": mime,
        "Content-Length": String(buf.byteLength),
      },
      body: buf,
    });
    if (!res.ok) throw new Error(`Chunk ${index + 1} upload failed (${res.status})`);
  };

  const start = async () => {
    try {
      const stream = await captureCombinedStream();
      const mime = pickMime();
      chunkIndexRef.current = 0;
      uploadedChunksRef.current = 0;
      secondsRef.current = 0;

      const { data: rec, error } = await supabase
        .from("podcast_recordings")
        .insert({
          episode_id: episodeId,
          uploader_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
          mime_type: mime,
          r2_prefix: "pending",
          status: "recording",
        })
        .select("id")
        .single();
      if (error) throw error;
      const safeId = participantIdentity.replace(/[^a-zA-Z0-9_-]/g, "_");
      const prefix = `podcast/${episodeId}/${rec.id}-${safeId}/`;
      r2PrefixRef.current = prefix;
      await supabase.from("podcast_recordings").update({ r2_prefix: prefix }).eq("id", rec.id);
      setRecordingId(rec.id);

      const videoBitsPerSecond = quality === "4K" ? 14_000_000 : quality === "1080p" ? 8_000_000 : 4_000_000;
      const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = async (ev) => {
        if (ev.data && ev.data.size > 0) {
          const idx = chunkIndexRef.current++;
          try {
            await uploadChunk(ev.data, idx, mime);
            uploadedChunksRef.current += 1;
            await supabase
              .from("podcast_recordings")
              .update({ chunk_count: uploadedChunksRef.current })
              .eq("id", rec.id);
          } catch (e) {
            toast({ title: "Recording chunk failed", description: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
          }
        }
      };
      mr.onstop = async () => {
        await supabase.from("podcast_recordings").update({ status: uploadedChunksRef.current > 0 ? "uploaded" : "failed", duration_seconds: secondsRef.current, chunk_count: uploadedChunksRef.current }).eq("id", rec.id);
        if (uploadedChunksRef.current > 0) setSavedRecording({ id: rec.id, chunks: uploadedChunksRef.current, seconds: secondsRef.current });
      };
      mr.start(5000); // 5s chunks
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => { secondsRef.current = s + 1; return s + 1; }), 1000);
      toast({ title: "Recording started", description: `${displayName}'s ${quality} take is saving with ${background.name} background.` });
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
      <div className="flex min-w-0 items-center gap-2">
        {recording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono">{formatTime(seconds)}</span>
            <span className="text-xs text-zinc-400">Recording locally</span>
          </>
        ) : savedRecording ? (
          <button onClick={() => navigate(`/tv/podcast/${episodeId}/recording/${savedRecording.id}/editor`)} className="min-w-0 text-left text-xs text-muted-foreground hover:text-foreground">
            <span className="font-semibold text-foreground">Saved take</span> · {formatTime(savedRecording.seconds)} · {savedRecording.chunks} chunks · tap to trim
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Not recording</span>
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

const BackgroundPicker = ({ value, onChange }: { value: StudioBackground; onChange: (background: StudioBackground) => void }) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("premium podcast studio, cinematic lights");
  const [generated, setGenerated] = useState<StudioBackground[]>([]);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-podcast-background", { body: { prompt } });
      if (error) throw error;
      const imageUrl = (data as { imageUrl?: string; error?: string })?.imageUrl;
      if (!imageUrl) throw new Error((data as { error?: string })?.error || "No background generated");
      const bg: StudioBackground = { id: `ai-${Date.now()}`, name: "AI", imageUrl, css: "linear-gradient(135deg, hsl(var(--background)), hsl(var(--muted)))" };
      setGenerated((items) => [bg, ...items].slice(0, 4));
      onChange(bg);
      toast({ title: "AI background ready" });
    } catch (e) {
      toast({ title: "Background failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const options = [...BACKGROUND_PRESETS, ...generated];

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-secondary flex items-center gap-1">
        <Image className="w-3 h-3" /> {value.name}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
          <div className="grid grid-cols-2 gap-2">
            {options.map((bg) => (
              <button key={bg.id} onClick={() => onChange(bg)} className={`overflow-hidden rounded-md border text-left ${value.id === bg.id ? "border-primary" : "border-border"}`}>
                <div className="h-14 bg-cover bg-center" style={{ backgroundImage: bg.imageUrl ? `url(${bg.imageUrl})` : bg.css }} />
                <div className="truncate px-2 py-1 text-xs font-medium">{bg.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="AI studio background" className="h-9 text-xs" />
            <Button size="sm" onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
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
