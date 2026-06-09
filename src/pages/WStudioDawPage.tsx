import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DawEngine } from "@/wstudio/daw/engine/DawEngine";
import { computePeaks } from "@/wstudio/daw/engine/Peaks";
import { useDawStore, newId } from "@/wstudio/daw/state/DawStore";
import { TransportBar } from "@/wstudio/daw/ui/TransportBar";
import { ArrangeView } from "@/wstudio/daw/ui/ArrangeView";
import { MixerView } from "@/wstudio/daw/ui/MixerView";
import { InstrumentPanel } from "@/wstudio/daw/ui/InstrumentPanel";
import { FxRack } from "@/wstudio/daw/ui/FxRack";
import { LibraryPanel } from "@/wstudio/daw/ui/LibraryPanel";
import { CollabSidebar } from "@/wstudio/daw/ui/CollabSidebar";
import { MenuBar } from "@/wstudio/daw/ui/MenuBar";

export default function WStudioDawPage({ sessionCode: sessionCodeProp }: { sessionCode?: string } = {}) {
  const [params] = useSearchParams();
  const sessionCode = sessionCodeProp ?? params.get("session");

  const engineRef = useRef<DawEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [fxTrackId, setFxTrackId] = useState<string | null>(null);
  const [collabOpen, setCollabOpen] = useState(true);

  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const metronome = useDawStore(s => s.transport.metronome);
  const bpm = useDawStore(s => s.transport.bpm);
  const setTransport = useDawStore(s => s.setTransport);
  const addClip = useDawStore(s => s.addClip);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const view = useDawStore(s => s.view);
  const masterVolume = useDawStore(s => s.masterVolume);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Init engine
  useEffect(() => {
    const e = new DawEngine();
    engineRef.current = e;
    e.onPositionChange = (pos) => setTransport({ position: pos });
    e.onRecordedClip = async (trackId, clip) => {
      clip.peaks = computePeaks(clip.buffer!);
      addClip(clip);
      setTransport({ isRecording: false, isPlaying: false });
    };
    setEngineReady(true);
    return () => { e.dispose(); engineRef.current = null; };
  }, [addClip, setTransport]);

  // Sync track chains + params
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    tracks.forEach(t => e.ensureTrackChain(t));
  }, [tracks]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    tracks.forEach(t => e.updateTrackParams(t));
  }, [tracks]);

  useEffect(() => {
    engineRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const handlePlay = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    await e.resume();
    if (e.playing) return; // already playing — no-op so spamming doesn't re-trigger
    const t = useDawStore.getState().transport;
    const tr = useDawStore.getState().tracks;
    const cl = useDawStore.getState().clips;
    setTransport({ isPlaying: true });
    e.play(t, tr, cl);
  }, [setTransport]);

  const handleStop = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.stop();
    setTransport({ isPlaying: false, isRecording: false });
  }, [setTransport]);

  const handlePlayPause = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    if (e.playing) { handleStop(); } else { await handlePlay(); }
  }, [handlePlay, handleStop]);

  const handleRewind = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    const wasPlaying = e.playing;
    e.stop();
    setTransport({ position: 0, isPlaying: false, isRecording: false });
    if (wasPlaying) {
      setTimeout(() => {
        const st = useDawStore.getState();
        setTransport({ isPlaying: true });
        e.play({ ...st.transport, position: 0 }, st.tracks, st.clips);
      }, 30);
    }
  }, [setTransport]);

  const handleSeek = useCallback((position: number) => {
    const e = engineRef.current;
    const next = Math.max(0, position);
    const wasPlaying = !!e?.playing;
    if (e && wasPlaying) e.stop();
    setTransport({ position: next, isPlaying: wasPlaying, isRecording: false });
    if (e && wasPlaying) {
      requestAnimationFrame(() => {
        const st = useDawStore.getState();
        e.play({ ...st.transport, position: next, isPlaying: true, isRecording: false }, st.tracks, st.clips);
      });
    }
  }, [setTransport]);

  const handleRecord = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    const st = useDawStore.getState();
    if (st.transport.isRecording) {
      e.stopRecording();
      setTransport({ isRecording: false });
      return;
    }
    let armed = st.tracks.find(t => t.armed && t.kind === "audio");
    if (!armed) {
      const id = addTrack("audio", `Take ${st.tracks.filter(t => t.kind === "audio").length + 1}`);
      updateTrack(id, { armed: true });
      await new Promise(r => setTimeout(r, 50));
      armed = useDawStore.getState().tracks.find(t => t.id === id);
    }
    try {
      await e.resume();
      const latest = useDawStore.getState();
      await e.startRecording(armed!.id, latest.transport.position, armed!.inputDeviceId);
      setTransport({ isRecording: true, isPlaying: true });
      e.play(latest.transport, latest.tracks, latest.clips);
    } catch (err: any) {
      toast.error("Mic access denied");
      setTransport({ isRecording: false });
    }
  }, [addTrack, updateTrack, setTransport]);

  // Sync metronome live
  useEffect(() => {
    engineRef.current?.setMetronome(metronome, bpm);
  }, [metronome, bpm]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement)?.isContentEditable) return;
      const meta = ev.metaKey || ev.ctrlKey;
      if (ev.code === "Space") {
        ev.preventDefault();
        if (ev.shiftKey) handleStop();
        else handlePlayPause();
      } else if (ev.code === "Enter") {
        ev.preventDefault();
        handleRewind();
      } else if (ev.key.toLowerCase() === "r" && !meta) {
        ev.preventDefault();
        handleRecord();
      } else if (meta && ev.key.toLowerCase() === "c") {
        const sel = useDawStore.getState().selectedClipId;
        if (sel) { useDawStore.getState().copyClip(sel); toast.success("Copied"); }
      } else if (meta && ev.key.toLowerCase() === "x") {
        const sel = useDawStore.getState().selectedClipId;
        if (sel) { useDawStore.getState().cutClip(sel); toast.success("Cut"); }
      } else if (meta && ev.key.toLowerCase() === "v") {
        const sel = useDawStore.getState().selectedClipId;
        const st = useDawStore.getState();
        const clip = st.clips.find(c => c.id === sel);
        const trackId = clip?.trackId ?? st.tracks[0]?.id;
        if (trackId) st.pasteClipAt(trackId, st.transport.position);
      } else if (meta && ev.key.toLowerCase() === "d") {
        ev.preventDefault();
        const sel = useDawStore.getState().selectedClipId;
        if (sel) useDawStore.getState().duplicateClip(sel);
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        const sel = useDawStore.getState().selectedClipId;
        if (sel) useDawStore.getState().removeClip(sel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlayPause, handleStop, handleRewind, handleRecord]);


  const handleArmToggle = useCallback((trackId: string) => {
    const t = tracks.find(x => x.id === trackId);
    if (!t) return;
    // Exclusive arm
    tracks.forEach(x => updateTrack(x.id, { armed: x.id === trackId ? !t.armed : false }));
  }, [tracks, updateTrack]);

  const importFiles = useCallback(async (files: FileList) => {
    const e = engineRef.current;
    if (!e) return;
    for (const file of Array.from(files)) {
      try {
        const buffer = await e.decodeFile(file);
        const trackId = addTrack("audio", file.name.replace(/\.[^.]+$/, ""));
        await new Promise(r => setTimeout(r, 30));
        const peaks = computePeaks(buffer);
        addClip({
          id: newId("clip"),
          trackId,
          startTime: useDawStore.getState().transport.position,
          duration: buffer.duration,
          offset: 0,
          buffer,
          peaks,
          name: file.name,
        });
      } catch (err) {
        toast.error(`Couldn't import ${file.name}`);
      }
    }
  }, [addTrack, addClip]);

  const handleExport = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    if (clips.length === 0) { toast.error("Nothing to export"); return; }
    const len = Math.max(...clips.map(c => c.startTime + c.duration)) + 0.5;
    toast.loading("Rendering...", { id: "exp" });
    try {
      const blob = await e.exportToWav(tracks, clips, len);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `wstudio-mix-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported WAV", { id: "exp" });
    } catch {
      toast.error("Export failed", { id: "exp" });
    }
  }, [tracks, clips]);

  // Drag and drop files onto window
  useEffect(() => {
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      importFiles(e.dataTransfer.files);
    };
    const over = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", drop);
    window.addEventListener("dragover", over);
    return () => { window.removeEventListener("drop", drop); window.removeEventListener("dragover", over); };
  }, [importFiles]);

  if (!engineReady || !engineRef.current) {
    return <div className="min-h-screen bg-black grid place-items-center text-neutral-400">Loading studio…</div>;
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col text-neutral-200 dark">
      <MenuBar
        onImport={() => importInputRef.current?.click()}
        onExport={handleExport}
        onAddAudio={() => addTrack("audio")}
        onAddInstrument={() => { const id = addTrack("instrument"); updateTrack(id, { instrument: "synth" }); }}
        onPlay={handlePlayPause}
        onStop={handleStop}
        onRecord={handleRecord}
        onRewind={handleRewind}
      />
      <TransportBar
        onPlay={handlePlayPause}
        onStop={handleStop}
        onRecord={handleRecord}
        onRewind={handleRewind}
        onSeek={handleSeek}
        onExport={handleExport}
        onAddAudio={() => addTrack("audio")}
        onAddInstrument={() => { const id = addTrack("instrument"); updateTrack(id, { instrument: "synth" }); }}
        onImport={() => importInputRef.current?.click()}
      />
      <input
        ref={importInputRef}
        type="file" multiple accept=".wav,.mp3,.ogg,.m4a,audio/*"
        className="hidden"
        onChange={(e) => e.target.files && importFiles(e.target.files)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <LibraryPanel
          onImportFiles={importFiles}
          onAddUserPlugin={(name) => toast.success(`Added plug-in: ${name}`)}
        />

        {view === "arrange" && <ArrangeView onArmToggle={handleArmToggle} onSeek={handleSeek} />}
        {view === "mixer" && <MixerView engine={engineRef.current} onOpenFx={setFxTrackId} />}
        {view === "instrument" && <InstrumentPanel engine={engineRef.current} />}

        {collabOpen ? (
          <CollabSidebar sessionCode={sessionCode} onClose={() => setCollabOpen(false)} />
        ) : (
          <button
            onClick={() => setCollabOpen(true)}
            className="absolute right-2 top-16 z-40 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-300"
          >Session</button>
        )}

        {fxTrackId && <FxRack trackId={fxTrackId} onClose={() => setFxTrackId(null)} />}
      </div>
    </div>
  );
}
