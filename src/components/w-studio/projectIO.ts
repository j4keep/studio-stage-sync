import { createLibrarySound, type LibrarySoundId } from './audio';
import { REMOTE_LIBRARY_FLAT } from './remoteLibrary';
import type {
  ClipSourceMeta,
  EffectPresetId,
  EqPresetId,
  MidiNote,
  SpacePresetId,
  Track,
  TrackKind,
} from './types';

export const PROJECT_FILE_VERSION = 1 as const;

export type SerializedClipV1 = {
  id: string;
  startTime: number;
  durationSec: number;
  source: ClipSourceMeta;
};

export type SerializedTrackV1 = {
  id: string;
  name: string;
  color: string;
  kind: TrackKind;
  inputSource: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eqPreset: EqPresetId;
  effectPreset: EffectPresetId;
  spacePreset: SpacePresetId;
  clips: SerializedClipV1[];
  midiNotes: MidiNote[];
};

export type SerializedProjectV1 = {
  version: typeof PROJECT_FILE_VERSION;
  tempo: number;
  beatsPerBar: number;
  tracks: SerializedTrackV1[];
};

export function serializeProject(tracks: Track[], tempo: number, beatsPerBar: number): string {
  const data: SerializedProjectV1 = {
    version: PROJECT_FILE_VERSION,
    tempo,
    beatsPerBar,
    tracks: tracks.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      kind: t.kind,
      inputSource: t.inputSource,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      eqPreset: t.eqPreset,
      effectPreset: t.effectPreset,
      spacePreset: t.spacePreset,
      clips: t.clips
        .filter((c): c is typeof c & { sourceMeta: ClipSourceMeta } => Boolean(c.sourceMeta))
        .map((c) => ({
          id: c.id,
          startTime: c.startTime,
          durationSec: c.buffer.duration,
          source: c.sourceMeta,
        })),
      midiNotes: t.midiNotes.map((m) => ({ ...m })),
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJSON(str: string): SerializedProjectV1 | null {
  try {
    const o = JSON.parse(str) as unknown;
    if (!o || typeof o !== 'object') return null;
    const v = o as { version?: number; tracks?: unknown };
    if (v.version !== PROJECT_FILE_VERSION || !Array.isArray(v.tracks)) return null;
    return o as SerializedProjectV1;
  } catch {
    return null;
  }
}

export async function hydrateProject(data: SerializedProjectV1, ctx: AudioContext): Promise<Track[]> {
  const out: Track[] = [];
  for (const st of data.tracks) {
    const tr: Track = {
      id: st.id,
      name: st.name,
      color: st.color,
      kind: st.kind,
      inputSource: st.inputSource,
      recordArm: false,
      volume: st.volume,
      pan: st.pan,
      muted: st.muted,
      solo: st.solo,
      eqPreset: st.eqPreset,
      effectPreset: st.effectPreset,
      spacePreset: st.spacePreset,
      clips: [],
      midiNotes: st.midiNotes.map((m) => ({ ...m })),
    };
    for (const sc of st.clips) {
      try {
        if (sc.source.type === 'library') {
          const buf = createLibrarySound(ctx, sc.source.soundId as LibrarySoundId);
          tr.clips.push({
            id: sc.id,
            startTime: sc.startTime,
            buffer: buf,
            sourceMeta: sc.source,
          });
        } else if (sc.source.type === 'remote') {
          const remoteSource = sc.source as { type: 'remote'; remoteId: string };
          const item = REMOTE_LIBRARY_FLAT.find((x) => x.id === remoteSource.remoteId);
          if (!item) continue;
          const res = await fetch(item.url, { mode: 'cors' });
          if (!res.ok) continue;
          const ab = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab.slice(0));
          tr.clips.push({
            id: sc.id,
            startTime: sc.startTime,
            buffer: buf,
            sourceMeta: { type: 'remote', remoteId: sc.source.remoteId },
          });
        }
      } catch {
        /* skip broken clip */
      }
    }
    out.push(tr);
  }
  return out;
}
