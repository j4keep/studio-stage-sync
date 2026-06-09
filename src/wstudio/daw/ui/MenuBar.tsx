import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useDawStore } from "../state/DawStore";
import { toast } from "sonner";
import { memo } from "react";

interface Props {
  onImport: () => void;
  onExport: () => void;
  onAddAudio: () => void;
  onAddInstrument: () => void;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
}

// Defined OUTSIDE the component so React doesn't remount these items on every
// position-tick re-render (which was making the dropdown items lose clicks).
const Item = memo(function Item({ children, shortcut, onClick, disabled }: any) {
  return (
    <DropdownMenuItem onClick={onClick} disabled={disabled} className="flex justify-between gap-6 text-[12px]">
      <span>{children}</span>
      {shortcut && <span className="text-[10px] text-neutral-500 tracking-wider">{shortcut}</span>}
    </DropdownMenuItem>
  );
});

export function MenuBar({ onImport, onExport, onAddAudio, onAddInstrument, onPlay, onStop, onRecord, onRewind }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const selectedClipId = useDawStore(s => s.selectedClipId);
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const removeTrack = useDawStore(s => s.removeTrack);
  const copyClip = useDawStore(s => s.copyClip);
  const cutClip = useDawStore(s => s.cutClip);
  const pasteClipAt = useDawStore(s => s.pasteClipAt);
  const duplicateClip = useDawStore(s => s.duplicateClip);
  const removeClip = useDawStore(s => s.removeClip);
  const splitClipAt = useDawStore(s => s.splitClipAt);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const setView = useDawStore(s => s.setView);

  const triggerClass = "h-7 px-2.5 text-[12px] text-neutral-200 hover:bg-neutral-800 rounded-sm outline-none data-[state=open]:bg-neutral-800";

  return (
    <div className="h-7 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 flex items-center px-2 gap-0.5 text-neutral-200 select-none">
      <div className="text-[11px] font-semibold text-cyan-300 tracking-wider px-2">W.STUDIO</div>
      <div className="w-px h-4 bg-neutral-800 mx-1" />

      {/* File */}
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClass}>File</DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
          <Item shortcut="⌘N" onClick={() => { useDawStore.getState().tracks.forEach(t => removeTrack(t.id)); toast.success("New project"); }}>New Project</Item>
          <Item shortcut="⌘O" onClick={onImport}>Open / Import…</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item shortcut="⌘S" onClick={() => toast.success("Project autosaved")}>Save</Item>
          <Item onClick={onExport}>Export Mix as WAV…</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item onClick={() => toast("Bounce coming soon")}>Bounce Project…</Item>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit */}
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClass}>Edit</DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[240px]">
          <Item shortcut="⌘Z" disabled>Undo</Item>
          <Item shortcut="⇧⌘Z" disabled>Redo</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item shortcut="⌘X" disabled={!selectedClipId} onClick={() => selectedClipId && (cutClip(selectedClipId), toast.success("Cut"))}>Cut</Item>
          <Item shortcut="⌘C" disabled={!selectedClipId} onClick={() => selectedClipId && (copyClip(selectedClipId), toast.success("Copied"))}>Copy</Item>
          <Item shortcut="⌘V" onClick={() => {
            const st = useDawStore.getState();
            const tid = st.clips.find(c => c.id === selectedClipId)?.trackId ?? st.tracks[0]?.id;
            if (tid) pasteClipAt(tid, st.transport.position);
          }}>Paste at Playhead</Item>
          <Item shortcut="⌘D" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}>Duplicate</Item>
          <Item shortcut="Del" disabled={!selectedClipId} onClick={() => selectedClipId && removeClip(selectedClipId)}>Delete</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item onClick={() => selectedClipId && splitClipAt(selectedClipId, transport.position)} disabled={!selectedClipId}>Split at Playhead</Item>
          <Item onClick={() => setTransport({ loopEnabled: !transport.loopEnabled })}>Toggle Loop ({transport.loopEnabled ? "On" : "Off"})</Item>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Track */}
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClass}>Track</DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[240px]">
          <Item shortcut="⌥⌘A" onClick={onAddAudio}>New Audio Track</Item>
          <Item shortcut="⌥⌘S" onClick={onAddInstrument}>New Instrument Track</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item disabled={!selectedTrackId} onClick={() => selectedTrackId && removeTrack(selectedTrackId)} shortcut="⌘⌫">Delete Selected Track</Item>
          <Item onClick={() => {
            const st = useDawStore.getState();
            st.tracks.forEach(t => { if (!st.clips.some(c => c.trackId === t.id)) removeTrack(t.id); });
            toast.success("Removed unused tracks");
          }}>Delete Unused Tracks</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item onClick={() => setView("mixer")}>Open Mixer</Item>
          <Item onClick={() => setView("arrange")}>Open Arrange</Item>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Transport */}
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClass}>Transport</DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
          <Item shortcut="Space" onClick={onPlay}>Play / Pause</Item>
          <Item shortcut="⇧Space" onClick={onStop}>Stop</Item>
          <Item shortcut="Enter" onClick={onRewind}>Return to Start</Item>
          <Item shortcut="R" onClick={onRecord}>Record</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item onClick={() => setTransport({ metronome: !transport.metronome })}>Metronome ({transport.metronome ? "On" : "Off"})</Item>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help */}
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClass}>Help</DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[260px]">
          <DropdownMenuLabel className="text-[10px] text-neutral-500 uppercase tracking-wider">Keyboard Shortcuts</DropdownMenuLabel>
          <Item shortcut="Space">Play / Pause</Item>
          <Item shortcut="⇧Space">Stop</Item>
          <Item shortcut="Enter">Return to Start</Item>
          <Item shortcut="R">Record</Item>
          <Item shortcut="⌘C / X / V">Copy / Cut / Paste</Item>
          <Item shortcut="⌘D">Duplicate Clip</Item>
          <Item shortcut="Del">Delete Clip</Item>
          <DropdownMenuSeparator className="bg-neutral-800" />
          <Item onClick={() => toast("W.Studio DAW · v1.0")}>About W.Studio</Item>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />
      <div className="text-[10px] text-neutral-500 tracking-wider pr-2">
        {tracks.length} tracks · {clips.length} clips
      </div>
    </div>
  );
}
