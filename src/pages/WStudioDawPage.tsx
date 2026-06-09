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

export default function WStudioDawPage({ sessionCode: sessionCodeProp }: { sessionCode?: string } = {}) {
  const [params] = useSearchParams();
  const sessionCode = sessionCodeProp ?? params.get("session");

  const engineRef = useRef<DawEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [fxTrackId, setFxTrackId] = useState<string | null>(null);
  const [collabOpen, setCollabOpen] = useState(true);

  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const transport = useDawStore(s => s.transport);
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
    if (transport.isPlaying) { e.stop(); setTransport({ isPlaying: false }); return; }
    setTransport({ isPlaying: true });
    e.play(transport, tracks, clips);
  }, [transport, tracks, clips, setTransport]);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    setTransport({ isPlaying: false, isRecording: false });
  }, [setTransport]);

  const handleRewind = useCallback(() => {
    engineRef.current?.stop();
    setTransport({ position: 0, isPlaying: false, isRecording: false });
  }, [setTransport]);

  const handleRecord = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    if (transport.isRecording) {
      e.stopRecording();
      setTransport({ isRecording: false });
      return;
    }
    let armed = tracks.find(t => t.armed && t.kind === "audio");
    if (!armed) {
      const id = addTrack("audio", `Take ${tracks.filter(t => t.kind === "audio").length + 1}`);
      updateTrack(id, { armed: true });
      // wait a tick for engine chain
      await new Promise(r => setTimeout(r, 50));
      armed = useDawStore.getState().tracks.find(t => t.id === id);
    }
    try {
      await e.resume();
      await e.startRecording(armed!.id, transport.position, armed!.inputDeviceId);
      setTransport({ isRecording: true, isPlaying: true });
      e.play(transport, tracks, clips);
    } catch (err: any) {
      toast.error("Mic access denied");
      setTransport({ isRecording: false });
    }
  }, [transport, tracks, clips, addTrack, updateTrack, setTransport]);

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
          startTime: 0,
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
      <TransportBar
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleRecord}
        onRewind={handleRewind}
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

        {view === "arrange" && <ArrangeView onArmToggle={handleArmToggle} />}
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
