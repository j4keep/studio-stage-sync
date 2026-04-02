import { useCallback, useMemo, useRef } from 'react';
import { useDaw } from './DawContext';

const PX_PER_BEAT = 26;
const SNAP = 0.25;
const PITCH_LOW = 52;
const PITCH_HIGH = 88;
const ROW_H = 10;

type PianoRollProps = {
  trackId: string | null;
  playheadSec: number;
  tempo: number;
};

export function PianoRoll({ trackId, playheadSec, tempo }: PianoRollProps) {
  const daw = useDaw();
  const scrollRef = useRef<HTMLDivElement>(null);
  const tr = trackId ? daw.tracks.find((t) => t.id === trackId) : null;

  const totalBeats = useMemo(() => {
    const spb = 60 / Math.max(40, tempo);
    let maxB = 32;
    for (const t of daw.tracks) {
      for (const n of t.midiNotes) maxB = Math.max(maxB, n.startBeats + n.durationBeats + 4);
    }
    const fromTime = (playheadSec / spb) * 1;
    maxB = Math.max(maxB, fromTime + 16);
    return Math.ceil(maxB);
  }, [daw.tracks, playheadSec, tempo]);

  const gridW = totalBeats * PX_PER_BEAT;
  const gridH = (PITCH_HIGH - PITCH_LOW + 1) * ROW_H;

  const addAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!trackId || !tr) return;
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft - 44;
      const y = clientY - rect.top + el.scrollTop;
      if (x < 0) return;
      const rawBeat = x / PX_PER_BEAT;
      const beat = SNAP * Math.round(rawBeat / SNAP);
      const pitch = PITCH_HIGH - Math.floor(y / ROW_H);
      if (pitch < PITCH_LOW || pitch > PITCH_HIGH) return;
      daw.addMidiNote(trackId, {
        pitch,
        startBeats: Math.max(0, beat),
        durationBeats: 0.5,
        velocity: 0.88,
      });
    },
    [daw, trackId, tr],
  );

  if (!trackId || !tr) {
    return (
      <p className="px-4 py-6 text-[12px] text-[#a0a0a0]">
        Select a track to edit MIDI in the piano roll. Click the grid to add notes (1/16 snap). Double-click a note to
        delete.
      </p>
    );
  }

  const playheadPx = (playheadSec / (60 / tempo)) * PX_PER_BEAT;

  return (
    <div className="flex min-h-[200px] min-w-0 flex-1 flex-col border-t border-[#2c2c2c] bg-[#3a3a3a]">
      <div className="flex items-center gap-2 border-b border-[#2c2c2c] px-2 py-1 text-[10px] text-[#a8a8a8]">
        <span className="font-medium text-[#ececec]">{tr.name}</span>
        <span>·</span>
        <span>Snap 1/16</span>
        <span>·</span>
        <span>{tr.midiNotes.length} notes</span>
      </div>
      <div
        ref={scrollRef}
        className="min-h-[200px] flex-1 overflow-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-midi-note]')) return;
          addAt(e.clientX, e.clientY);
        }}
      >
        <div className="relative" style={{ width: gridW + 48, minHeight: gridH }}>
          <div
            className="absolute left-0 top-0 flex flex-col border-r border-[#2c2c2c] bg-[#353535]"
            style={{ width: 44, height: gridH }}
          >
            {Array.from({ length: PITCH_HIGH - PITCH_LOW + 1 }, (_, i) => PITCH_HIGH - i).map((p) => (
              <div
                key={p}
                className="flex shrink-0 items-center justify-end border-b border-[#2a2a2a] pr-1 font-mono text-[8px] text-[#888]"
                style={{ height: ROW_H }}
              >
                {p % 12 === 0 ? p : ''}
              </div>
            ))}
          </div>
          <div className="absolute top-0 cursor-crosshair" style={{ left: 44, width: gridW, height: gridH }}>
            {Array.from({ length: Math.ceil(totalBeats) + 1 }).map((_, b) => (
              <div
                key={b}
                className="pointer-events-none absolute top-0 border-l border-[#333]"
                style={{ left: b * PX_PER_BEAT, height: gridH }}
              />
            ))}
            {Array.from({ length: PITCH_HIGH - PITCH_LOW + 1 }).map((_, i) => (
              <div
                key={i}
                className="pointer-events-none absolute left-0 border-t border-[#333]"
                style={{ top: i * ROW_H, width: gridW, height: ROW_H }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 w-px bg-[#4d9fff]/90"
              style={{ left: playheadPx, height: gridH, zIndex: 5 }}
            />
            {tr.midiNotes.map((n) => {
              const top = (PITCH_HIGH - n.pitch) * ROW_H;
              const h = Math.max(ROW_H - 1, ROW_H - 2);
              const w = Math.max(6, n.durationBeats * PX_PER_BEAT - 1);
              const left = n.startBeats * PX_PER_BEAT;
              return (
                <button
                  key={n.id}
                  type="button"
                  data-midi-note
                  className="absolute rounded-sm border border-white/20 hover:brightness-110"
                  style={{
                    left,
                    top: top + 1,
                    width: w,
                    height: h,
                    backgroundColor: `${tr.color}cc`,
                    zIndex: 2,
                  }}
                  title={`MIDI ${n.pitch} · ${n.durationBeats} beats`}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    daw.removeMidiNote(trackId, n.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
