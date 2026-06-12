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
import { PluginWindow } from "@/wstudio/daw/ui/PluginWindow";
import { LibraryPanel } from "@/wstudio/daw/ui/LibraryPanel";
import { SoundLibraryPanel } from "@/wstudio/daw/ui/SoundLibraryPanel";
import { BottomDock } from "@/wstudio/daw/ui/BottomDock";
import { CollabSidebar } from "@/wstudio/daw/ui/CollabSidebar";
import { MenuBar } from "@/wstudio/daw/ui/MenuBar";
import { FloatingKeyboard } from "@/wstudio/daw/ui/FloatingKeyboard";
import { ShortcutsModal } from "@/wstudio/daw/ui/ShortcutsModal";
import { useShortcutsStore, matchAction } from "@/wstudio/daw/state/ShortcutsStore";
import type { Clip, Track, AutomationPoint } from "@/wstudio/daw/engine/types";
import { saveProjectTo, saveAsProject, openProject } from "@/wstudio/daw/lib/projectIO";

/** Linearly interpolate between automation breakpoints at the given timeline position. */
function interpAutomation(points: AutomationPoint[], pos: number, fallback: number): number {
  if (!points.length) return fallback;
  if (pos <= points[0].t) return points[0].v;
  if (pos >= points[points.length - 1].t) return points[points.length - 1].v;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (pos >= a.t && pos <= b.t) {
      const r = (pos - a.t) / Math.max(0.0001, b.t - a.t);
      return a.v + (b.v - a.v) * r;
    }
  }
  return fallback;
}

const isInputAudioTrack = (track: Track, allClips: Clip[]) => (
  track.kind === "instrument" || (
    track.kind === "audio"
    && track.inputEnabled !== false
    && !(track.inputEnabled === undefined && allClips.some(c => c.trackId === track.id && c.buffer && c.name !== "Recording"))
  )
);


export default function WStudioDawPage({ sessionCode: sessionCodeProp }: { sessionCode?: string } = {}) {
  const [params] = useSearchParams();
  const sessionCode = sessionCodeProp ?? params.get("session");

  const engineRef = useRef<DawEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [, setEngineGraphVersion] = useState(0);
  const [openPlugins, setOpenPlugins] = useState<{ trackId: string; effectId: string; order: number }[]>([]);
  const [pluginOrder, setPluginOrder] = useState(1);
  const openPluginWindow = useCallback((trackId: string, effectId: string) => {
    setOpenPlugins(prev => {
      const next = pluginOrder + 1;
      setPluginOrder(next);
      if (prev.some(p => p.effectId === effectId)) {
        return prev.map(p => p.effectId === effectId ? { ...p, order: next } : p);
      }
      return [...prev, { trackId, effectId, order: next }];
    });
  }, [pluginOrder]);
  const closePluginWindow = useCallback((effectId: string) => {
    setOpenPlugins(prev => prev.filter(p => p.effectId !== effectId));
  }, []);

  const [collabOpen, setCollabOpen] = useState(true);
  const [soundLibOpen, setSoundLibOpen] = useState(true);
  const [soundLibTab, setSoundLibTab] = useState<"sounds" | "packs">("sounds");
  const [dockOpen, setDockOpen] = useState(false);
  const [dockTab, setDockTab] = useState<"instrument" | "chords" | "pianoroll" | "effects">("instrument");
  const openDock = (t: typeof dockTab) => { setDockTab(t); setDockOpen(true); };
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("wstudio:daw:theme") as "light" | "dark") || "dark";
  });
  useEffect(() => {
    try { localStorage.setItem("wstudio:daw:theme", themeMode); } catch {}
  }, [themeMode]);



  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const metronome = useDawStore(s => s.transport.metronome);
  const metronomeVolume = useDawStore(s => s.transport.metronomeVolume);
  const metroAccent = useDawStore(s => s.transport.metroAccent);
  const metroOutputDeviceId = useDawStore(s => s.transport.metroOutputDeviceId);
  const bpm = useDawStore(s => s.transport.bpm);
  const timeSigNum = useDawStore(s => s.transport.timeSigNum);
  const setTransport = useDawStore(s => s.setTransport);
  const addClip = useDawStore(s => s.addClip);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const view = useDawStore(s => s.view);
  const masterVolume = useDawStore(s => s.masterVolume);
  const pxPerSec = useDawStore(s => s.pxPerSec);
  const verticalZoom = useDawStore(s => s.verticalZoom);
  const projectName = useDawStore(s => s.projectName);
  const setProjectName = useDawStore(s => s.setProjectName);
  const projectFileHandle = useDawStore(s => s.projectFileHandle);
  const setProjectFileHandle = useDawStore(s => s.setProjectFileHandle);
  const resetProject = useDawStore(s => s.resetProject);
  const loadProject = useDawStore(s => s.loadProject);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [newProjectPrompt, setNewProjectPrompt] = useState<string | null>(null);

  // Init engine
  useEffect(() => {
    const e = new DawEngine();
    engineRef.current = e;
    e.onPositionChange = (pos) => {
      setTransport({ position: pos });
      // Apply automation lanes (volume/pan) live without thrashing the store.
      const allTracks = useDawStore.getState().tracks;
      for (const tr of allTracks) {
        const volPts = tr.automation?.volume;
        if (volPts && volPts.length > 0) {
          e.setLiveTrackVolume(tr.id, interpAutomation(volPts, pos, tr.volume));
        }
        const panPts = tr.automation?.pan;
        if (panPts && panPts.length > 0) {
          e.setLiveTrackPan(tr.id, interpAutomation(panPts, pos, tr.pan));
        }
      }
    };
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
    const resolvedTracks = tracks.map(t => isInputAudioTrack(t, clips) ? t : t.kind === "audio" ? { ...t, inputEnabled: false, armed: false } : t);
    resolvedTracks.forEach(t => e.ensureTrackChain(t));
    e.syncInputMonitoring(resolvedTracks);
    setEngineGraphVersion(v => v + 1);
  }, [tracks, clips]);

  useEffect(() => {
    tracks.forEach((track) => {
      const hasImportedAudio = track.kind === "audio" && track.inputEnabled === undefined && clips.some(c => c.trackId === track.id && c.buffer && c.name !== "Recording");
      if (hasImportedAudio) updateTrack(track.id, { inputEnabled: false, armed: false });
    });
  }, [tracks, clips, updateTrack]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    tracks.forEach(t => e.updateTrackParams(t, tracks));
  }, [tracks]);

  // Prune plug-in windows whose effect no longer exists (deleted via "No plug-in" or track removal).
  useEffect(() => {
    setOpenPlugins(prev => prev.filter(p => {
      const tr = tracks.find(t => t.id === p.trackId);
      return tr?.effects.some(e => e.id === p.effectId);
    }));
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
    let armed = st.tracks.find(t => isInputAudioTrack(t, st.clips) && t.armed && t.id === st.selectedTrackId)
      ?? st.tracks.find(t => isInputAudioTrack(t, st.clips) && t.armed);
    if (!armed && st.selectedTrackId) {
      const selectedAudio = st.tracks.find(t => t.id === st.selectedTrackId && isInputAudioTrack(t, st.clips));
      if (selectedAudio) {
        st.tracks.forEach(t => updateTrack(t.id, { armed: t.id === selectedAudio.id }));
        armed = selectedAudio;
      }
    }
    if (!armed) {
      toast.error("Select an audio or instrument track and press R to record");
      return;
    }
    st.tracks.forEach(t => updateTrack(t.id, { armed: t.id === armed!.id }));
    selectTrack(armed.id);
    try {
      await e.resume();
      const countBars = useDawStore.getState().transport.metroCountInBars || 0;
      if (countBars > 0) {
        const t0 = useDawStore.getState().transport;
        toast.message(`Count-in: ${countBars} bar${countBars > 1 ? "s" : ""}`);
        await e.countIn(countBars, t0.timeSigNum || 4, t0.bpm);
      }
      const latest = useDawStore.getState();
      const recordTrack = latest.tracks.find(t => t.id === armed!.id) ?? armed;
      if (recordTrack.kind === "instrument") {
        setTransport({ isRecording: true, isPlaying: true });
        if (!e.playing) e.play(latest.transport, latest.tracks, latest.clips);
        return;
      }
      await e.startRecording(recordTrack.id, latest.transport.position, recordTrack.inputDeviceId);
      setTransport({ isRecording: true, isPlaying: true });
      e.play(latest.transport, latest.tracks, latest.clips);
    } catch (err: any) {
      toast.error("Mic access denied");
      setTransport({ isRecording: false });
    }
  }, [selectTrack, updateTrack, setTransport]);

  // Sync metronome live (enabled, tempo, bar length)
  useEffect(() => {
    engineRef.current?.setMetronome(metronome, bpm, timeSigNum);
  }, [metronome, bpm, timeSigNum]);

  // Sync metronome volume independently from master mix
  useEffect(() => {
    engineRef.current?.setMetronomeVolume(metronomeVolume);
  }, [metronomeVolume]);

  // Sync metronome accent
  useEffect(() => {
    engineRef.current?.setMetronomeAccent(metroAccent);
  }, [metroAccent]);

  // Sync separate metronome output device
  useEffect(() => {
    engineRef.current?.setMetronomeOutputDevice(metroOutputDeviceId);
  }, [metroOutputDeviceId]);


  // Keyboard shortcuts (customizable — see ShortcutsStore)
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const handleExportRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement)?.isContentEditable) return;
      const bindings = useShortcutsStore.getState().bindings;
      const action = matchAction(ev, bindings);
      if (!action) return;
      const st = useDawStore.getState();
      switch (action) {
        case "play":           ev.preventDefault(); handlePlayPause(); break;
        case "stop":           ev.preventDefault(); handleStop(); break;
        case "record":         ev.preventDefault(); handleRecord(); break;
        case "rewind":         ev.preventDefault(); handleRewind(); break;
        case "forward5":       ev.preventDefault(); st.setTransport({ position: st.transport.position + 5 }); break;
        case "back5":          ev.preventDefault(); st.setTransport({ position: Math.max(0, st.transport.position - 5) }); break;
        case "loop":           ev.preventDefault(); st.setTransport({ loopEnabled: !st.transport.loopEnabled }); break;
        case "export":         ev.preventDefault(); handleExportRef.current?.(); break;
        case "undo":           ev.preventDefault(); st.undo(); break;
        case "redo":           ev.preventDefault(); st.redo(); break;
        case "copy":           { const sel = st.selectedClipId; if (sel) { st.copyClip(sel); toast.success("Copied"); } break; }
        case "cut":            { const sel = st.selectedClipId; if (sel) { st.cutClip(sel); toast.success("Cut"); } break; }
        case "paste":          { const sel = st.selectedClipId; const clip = st.clips.find(c => c.id === sel); const trackId = clip?.trackId ?? st.tracks[0]?.id; if (trackId) st.pasteClipAt(trackId, st.transport.position); break; }
        case "duplicate":      { ev.preventDefault(); const sel = st.selectedClipId; if (sel) st.duplicateClip(sel); break; }
        case "deleteClip":     { const sel = st.selectedClipId; if (sel) st.removeClip(sel); break; }
        case "toggleKeyboard": ev.preventDefault(); setKeyboardOpen(o => !o); break;
        case "toggleTheme":    ev.preventDefault(); setThemeMode(m => m === "dark" ? "light" : "dark"); break;
        case "toolPointer":    st.setTool("pointer"); break;
        case "toolPencil":     st.setTool("pencil"); break;
        case "toolEraser":     st.setTool("eraser"); break;
        case "toolScissors":   st.setTool("scissors"); break;
        case "viewEdit":       st.setView("arrange"); break;
        case "viewMixer":      st.setView("mixer"); break;
        case "openShortcuts":  ev.preventDefault(); setShortcutsOpen(o => !o); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlayPause, handleStop, handleRewind, handleRecord]);


  const handleArmToggle = useCallback((trackId: string) => {
    const t = tracks.find(x => x.id === trackId);
    if (!t) return;
    if (!isInputAudioTrack(t, clips)) {
      toast.error("Imported beat/audio tracks are playback-only");
      return;
    }
    // Exclusive arm — input monitoring is always-on for audio tracks, so the
    // R button just decides which track will capture when record is pressed.
    const shouldArm = !t.armed;
    selectTrack(trackId);
    tracks.forEach(x => updateTrack(x.id, { armed: x.id === trackId ? shouldArm : false }));
  }, [tracks, clips, updateTrack, selectTrack]);

  const importFiles = useCallback(async (files: FileList) => {
    const e = engineRef.current;
    if (!e) return;
    for (const file of Array.from(files)) {
      try {
        const buffer = await e.decodeFile(file);
        const trackId = addTrack("audio", file.name.replace(/\.[^.]+$/, ""), { inputEnabled: false });
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

  // Drop files onto an existing track lane: import as a clip at the drop time
  // and lock that track to playback-only (no recording input) so the imported
  // beat/sample doesn't get overwritten by the mic.
  const importFilesAt = useCallback(async (trackId: string, startTime: number, files: FileList) => {
    const e = engineRef.current;
    if (!e) return;
    let cursor = startTime;
    for (const file of Array.from(files)) {
      try {
        const buffer = await e.decodeFile(file);
        const peaks = computePeaks(buffer);
        addClip({
          id: newId("clip"),
          trackId,
          startTime: cursor,
          duration: buffer.duration,
          offset: 0,
          buffer,
          peaks,
          name: file.name,
        });
        cursor += buffer.duration;
        updateTrack(trackId, { inputEnabled: false, armed: false });
      } catch (err) {
        toast.error(`Couldn't import ${file.name}`);
      }
    }
  }, [addClip, updateTrack]);

  const [exportPrompt, setExportPrompt] = useState<{ defaultName: string } | null>(null);
  const handleExport = useCallback(() => {
    if (clips.length === 0) { toast.error("Nothing to export"); return; }
    setExportPrompt({ defaultName: `wstudio-mix-${Date.now()}` });
  }, [clips]);
  useEffect(() => { handleExportRef.current = handleExport; }, [handleExport]);

  const runExport = useCallback(async (filename: string) => {
    const e = engineRef.current;
    if (!e) return;
    setExportPrompt(null);
    const len = Math.max(...clips.map(c => c.startTime + c.duration)) + 0.5;
    toast.loading("Rendering...", { id: "exp" });
    try {
      const blob = await e.exportToWav(tracks, clips, len);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = (filename || "wstudio-mix").replace(/[\\/:*?"<>|]+/g, "_").trim() || "wstudio-mix";
      a.href = url; a.download = `${safe}.wav`;
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
    <div className={`fixed inset-0 z-[60] flex flex-col ${themeMode === "dark" ? "bg-black text-neutral-200 dark" : "daw-light"}`}>

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
        onAddMany={(kind, count) => {
          for (let i = 0; i < count; i++) {
            const id = addTrack(kind);
            if (kind === "instrument") updateTrack(id, { instrument: "synth" });
          }
          toast.success(`Added ${count} ${kind} track${count > 1 ? "s" : ""}`);
        }}
        onImport={() => importInputRef.current?.click()}
        onToggleKeyboard={() => setKeyboardOpen(o => !o)}
        keyboardOpen={keyboardOpen}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode(m => m === "dark" ? "light" : "dark")}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onToggleLibrary={() => setSoundLibOpen(o => !o)}
        libraryOpen={soundLibOpen}
        onToggleSession={() => setCollabOpen(o => !o)}
        sessionOpen={collabOpen}

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
          onBrowseLoops={() => { setSoundLibTab("sounds"); setSoundLibOpen(true); }}
          onPatterns={() => {
            const existingDrum = tracks.find(t => t.kind === "instrument" && t.instrument === "drum");
            if (existingDrum) {
              selectTrack(existingDrum.id);
            } else {
              const id = addTrack("instrument", "Drums");
              updateTrack(id, { instrument: "drum" });
              selectTrack(id);
            }
            openDock("chords");
          }}
          onPlaySynth={() => {
            const existingSynth = tracks.find(t => t.kind === "instrument" && t.instrument === "synth");
            if (existingSynth) {
              selectTrack(existingSynth.id);
            } else {
              const id = addTrack("instrument", "Synth");
              updateTrack(id, { instrument: "synth" });
              selectTrack(id);
            }
            openDock("instrument");
          }}
          onAddTrack={() => addTrack("audio")}
          onImport={() => importInputRef.current?.click()}
        />

        <div className="flex-1 relative flex flex-col overflow-hidden">
          {view === "arrange" && <ArrangeView onArmToggle={handleArmToggle} onSeek={handleSeek} engine={engineRef.current} onOpenInstrumentEditor={(tid) => { selectTrack(tid); openDock("instrument"); }} onImportFilesAt={importFilesAt} />}
          {view === "mixer" && <MixerView engine={engineRef.current} onOpenPlugin={openPluginWindow} onArmToggle={handleArmToggle} />}
          {view === "instrument" && <InstrumentPanel engine={engineRef.current} />}

          {view === "arrange" && (
            <BottomDock
              engine={engineRef.current}
              open={dockOpen}
              tab={dockTab}
              onTab={setDockTab}
              onClose={() => setDockOpen(false)}
            />
          )}
        </div>


        <SoundLibraryPanel
          engine={engineRef.current}
          open={soundLibOpen}
          onClose={() => setSoundLibOpen(false)}
          initialTab={soundLibTab}
        />
        {!soundLibOpen ? null : null}

        {collabOpen && (
          <CollabSidebar sessionCode={sessionCode} onClose={() => setCollabOpen(false)} />
        )}


        {openPlugins.map((p, i) => (
          <PluginWindow
            key={p.effectId}
            trackId={p.trackId}
            effectId={p.effectId}
            initialX={220 + i * 32}
            initialY={120 + i * 28}
            zIndex={60 + p.order}
            onFocus={() => openPluginWindow(p.trackId, p.effectId)}
            onClose={() => closePluginWindow(p.effectId)}
          />
        ))}
      </div>

      {keyboardOpen && (
        <FloatingKeyboard engine={engineRef.current} onClose={() => setKeyboardOpen(false)} />
      )}

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />


      {exportPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/60 grid place-items-center" onClick={() => setExportPrompt(null)}>
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 w-[360px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-neutral-200 font-medium mb-1">Name your bounce</div>
            <div className="text-[11px] text-neutral-500 mb-3">Saved as a WAV file to your downloads.</div>
            <input
              autoFocus
              defaultValue={exportPrompt.defaultName}
              onKeyDown={(e) => { if (e.key === "Enter") runExport((e.target as HTMLInputElement).value); if (e.key === "Escape") setExportPrompt(null); }}
              id="wstudio-export-name"
              className="w-full h-9 px-3 rounded bg-neutral-900 border border-neutral-800 text-neutral-100 text-sm outline-none focus:border-cyan-400/60"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setExportPrompt(null)} className="h-8 px-3 rounded text-xs text-neutral-300 hover:text-neutral-100">Cancel</button>
              <button
                onClick={() => {
                  const el = document.getElementById("wstudio-export-name") as HTMLInputElement | null;
                  runExport(el?.value || exportPrompt.defaultName);
                }}
                className="h-8 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
              >Export</button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
