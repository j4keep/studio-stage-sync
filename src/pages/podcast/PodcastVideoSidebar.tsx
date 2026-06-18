import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Video, VideoOff, Mic, Upload, X, Users, Link as LinkIcon, Circle, Square } from "lucide-react";
import { useDawStore, newId } from "@/wstudio/daw/state/DawStore";
import { computePeaks } from "@/wstudio/daw/engine/Peaks";
import { usePodcastVideoStore } from "./podcastVideoStore";
import type { DawEngine } from "@/wstudio/daw/engine/DawEngine";

type Props = {
  engine: DawEngine | null;
  onClose: () => void;
};

/**
 * Right-side panel for the Live Podcast studio.
 * Recording flow:
 *  - Audio is captured by the DAW engine (so the live waveform draws on
 *    the track as you speak — like a real studio session).
 *  - Video is captured separately via MediaRecorder on the camera-only
 *    stream and stashed as "pending" for the track. When the engine
 *    emits the recorded clip, PodcastStudioPage calls attachPending()
 *    to link the video blob to that clip id.
 *  - Drag/dropped or uploaded videos extract audio into a new track and
 *    pair the video blob with the resulting clip.
 */
export function PodcastVideoSidebar({ engine, onClose }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addTrack = useDawStore(s => s.addTrack);
  const addClip = useDawStore(s => s.addClip);
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const setTransport = useDawStore(s => s.setTransport);
  const videos = usePodcastVideoStore(s => s.videos);
  const setVideo = usePodcastVideoStore(s => s.setVideo);
  const removeVideo = usePodcastVideoStore(s => s.removeVideo);
  const setPending = usePodcastVideoStore(s => s.setPending);
  const clearPending = usePodcastVideoStore(s => s.clearPending);

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTrackIdRef = useRef<string | null>(null);
  const recMimeRef = useRef<string>("video/webm");
  const recStartRef = useRef<number>(0);

  const [camOn, setCamOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => stopCamera(), []);

  const startCamera = useCallback(async () => {
    try {
      setBusy(true);
      // Camera ONLY — mic is captured by the DAW engine when we record so
      // the live waveform overlay draws while you speak.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      camStreamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play().catch(() => {});
      }
      setCamOn(true);
    } catch (err: any) {
      toast.error(err?.message || "Camera access denied");
    } finally {
      setBusy(false);
    }
  }, []);

  function stopCamera() {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    setRecording(false);
    const s = camStreamRef.current;
    if (s) { s.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    if (previewRef.current) previewRef.current.srcObject = null;
    setCamOn(false);
  }

  const ensureRecordTrack = useCallback((): string => {
    const sel = tracks.find(t => t.id === selectedTrackId && t.kind === "audio");
    if (sel) return sel.id;
    const audioTrack = tracks.find(t => t.kind === "audio");
    if (audioTrack) { selectTrack(audioTrack.id); return audioTrack.id; }
    const id = addTrack("audio", `Track ${tracks.length + 1}`);
    selectTrack(id);
    return id;
  }, [tracks, selectedTrackId, addTrack, selectTrack]);

  const startRecord = useCallback(async () => {
    const cam = camStreamRef.current;
    if (!cam || !engine) { toast.error("Turn the camera on first"); return; }
    const trackId = ensureRecordTrack();

    // Arm exclusively
    useDawStore.getState().tracks.forEach(t => updateTrack(t.id, { armed: t.id === trackId }));
    selectTrack(trackId);

    try {
      await engine.resume();
      const startPos = useDawStore.getState().transport.position;
      await engine.startRecording(trackId, startPos);
      setTransport({ isRecording: true, isPlaying: true });
      const st = useDawStore.getState();
      engine.play({ ...st.transport, isRecording: true, isPlaying: true, position: startPos }, st.tracks, st.clips);

      // Video-only stream from the camera
      const videoOnly = new MediaStream(cam.getVideoTracks());
      const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        .find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
      const rec = new MediaRecorder(videoOnly, { mimeType: mime });
      recChunksRef.current = [];
      recTrackIdRef.current = trackId;
      recMimeRef.current = mime;
      recStartRef.current = startPos;
      rec.ondataavailable = (ev) => { if (ev.data?.size) recChunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mime });
        recChunksRef.current = [];
        const dur = useDawStore.getState().transport.position - recStartRef.current;
        const trackLabel = useDawStore.getState().tracks.find(t => t.id === recTrackIdRef.current!)?.name ?? "Host";
        setPending(recTrackIdRef.current!, {
          trackId: recTrackIdRef.current!,
          startTime: recStartRef.current,
          blob,
          mime,
          durationSec: Math.max(0.1, dur),
          participantLabel: trackLabel,
        });
        // The engine's onRecordedClip handler in PodcastStudioPage will call
        // attachPending() so the new clip id receives this video blob.
      };
      rec.start(250);
      recorderRef.current = rec;
      setRecording(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not start recording");
      try { engine.stopRecording(); } catch {}
      setTransport({ isRecording: false, isPlaying: false });
    }
  }, [engine, ensureRecordTrack, updateTrack, selectTrack, setTransport, setPending]);

  const stopRecord = useCallback(() => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    setRecording(false);
    if (engine) {
      engine.stopRecording();
      engine.stop();
    }
    setTransport({ isRecording: false, isPlaying: false });
  }, [engine, setTransport]);

  const handleUploadVideo = useCallback(async (file: File) => {
    if (!engine) return;
    setBusy(true);
    try {
      const buffer = await engine.decodeFile(file);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const trackId = addTrack("audio", baseName, { inputEnabled: false });
      await new Promise(r => setTimeout(r, 30));
      const peaks = computePeaks(buffer);
      const clipId = newId("clip");
      addClip({
        id: clipId, trackId,
        startTime: useDawStore.getState().transport.position,
        duration: buffer.duration, offset: 0,
        buffer, peaks, name: baseName,
      } as any);
      setVideo(clipId, { blob: file, mime: file.type || "video/mp4", durationSec: buffer.duration, participantLabel: baseName });
      toast.success(`Imported "${file.name}" — audio extracted to its own track`);
    } catch (err: any) {
      toast.error(err?.message || "Could not import that video");
    } finally {
      setBusy(false);
    }
  }, [engine, addTrack, addClip, setVideo]);

  const inviteGuest = useCallback(() => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const url = `${window.location.origin}/#/tv/podcast/join/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Guest invite link copied", { description: url });
  }, []);

  const videoEntries = Object.entries(videos);

  return (
    <div className="w-[320px] shrink-0 h-full bg-neutral-950 border-l border-neutral-800 flex flex-col">
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-200">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          Video Chat
        </div>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-neutral-800">
        <div className="relative aspect-video bg-black rounded overflow-hidden border border-neutral-800">
          <video ref={previewRef} muted playsInline className="w-full h-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 grid place-items-center text-[11px] text-neutral-500">
              Camera off
            </div>
          )}
          {recording && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
              <Circle className="w-2 h-2 fill-white" /> REC
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
            {tracks.find(t => t.id === selectedTrackId)?.name ?? "Host"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {!camOn ? (
            <button
              onClick={startCamera} disabled={busy}
              className="col-span-2 h-8 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" /> Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="h-8 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium flex items-center justify-center gap-1.5"
              >
                <VideoOff className="w-3.5 h-3.5" /> Stop Cam
              </button>
              {!recording ? (
                <button
                  onClick={startRecord}
                  className="h-8 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium flex items-center justify-center gap-1.5"
                >
                  <Circle className="w-3 h-3 fill-white" /> Record
                </button>
              ) : (
                <button
                  onClick={stopRecord}
                  className="h-8 rounded bg-red-700 hover:bg-red-600 text-white text-[11px] font-medium flex items-center justify-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-white" /> Stop Rec
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-[10px] text-neutral-500 leading-snug">
          Waveform appears live on the track while you record. Video clips lock to the track and can be cut/trimmed together.
        </p>
      </div>

      <div className="p-3 space-y-1.5 border-b border-neutral-800">
        <button
          onClick={() => uploadRef.current?.click()}
          className="w-full h-8 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-[11px] flex items-center justify-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" /> Upload Video to Track
        </button>
        <input
          ref={uploadRef} type="file" accept="video/*,.mp4,.webm,.mov,.m4v" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadVideo(f); e.target.value = ""; }}
        />
        <button
          onClick={inviteGuest}
          className="w-full h-8 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-[11px] flex items-center justify-center gap-1.5"
        >
          <LinkIcon className="w-3.5 h-3.5" /> Invite Guest (magic link)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
          Linked Clips ({videoEntries.length})
        </div>
        {videoEntries.length === 0 && (
          <div className="text-[11px] text-neutral-600">
            Nothing yet. Record or upload a video — it'll appear here paired with its track.
          </div>
        )}
        {videoEntries.map(([clipId, v]) => (
          <div key={clipId} className="rounded overflow-hidden border border-neutral-800 bg-neutral-900">
            <div className="relative aspect-video bg-black">
              <video src={v.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="text-[11px] text-neutral-200 truncate">{v.participantLabel || "Track"}</div>
                <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5" />
                  {v.durationSec ? `${v.durationSec.toFixed(1)}s` : "—"}
                </div>
              </div>
              <button
                onClick={() => removeVideo(clipId)}
                className="p-1 text-neutral-500 hover:text-red-400" title="Unlink video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
