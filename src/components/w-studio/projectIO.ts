/**
 * Project serialization / deserialization for DAW sessions.
 * Saves track layout, settings, clip metadata (library/remote refs), and MIDI notes.
 * Audio buffers from recordings are NOT saved (only library/remote refs are restorable).
 */

import { createLibrarySound, type LibrarySoundId } from './audio';
import { REMOTE_LIBRARY_FLAT } from './remoteLibrary';
import {
  newTrack,
  type Clip,
  type ClipSourceMeta,
  type EffectPresetId,
  type EqPresetId,
  type MidiNote,
  type SpacePresetId,
  type Track,
  type TrackKind,
} from './types';

export const PROJECT_FILE_VERSION = 1;

type SerializedClip = {
  id: string;
  startTime: number;
  durationSec: number;
  sourceMeta?: ClipSourceMeta;
};

type SerializedTrack = {
  id: string;
  name: string;
  color: string;
  kind: TrackKind;
  inputSource: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  recordArm: boolean;
  eqPreset: EqPresetId;
  effectPreset: EffectPresetId;
  spacePreset: SpacePresetId;
  clips: SerializedClip[];
  midiNotes: MidiNote[];
};

export type SerializedProjectV1 = {
  version: number;
  tempo: number;
  beatsPerBar: number;
  tracks: SerializedTrack[];
};

export function serializeProject(
  tracks: Track[],
  tempo: number,
  beatsPerBar: number,
): string {
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
      recordArm: t.recordArm,
      eqPreset: t.eqPreset,
      effectPreset: t.effectPreset,
      spacePreset: t.spacePreset,
      clips: t.clips.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        durationSec: c.buffer.duration,
        sourceMeta: c.sourceMeta,
      })),
      midiNotes: t.midiNotes,
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function parseProjectJSON(json: string): SerializedProjectV1 | null {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    if (data.version !== PROJECT_FILE_VERSION) return null;
    if (!Array.isArray(data.tracks)) return null;
    return data as SerializedProjectV1;
  } catch {
    return null;
  }
}

export async function hydrateProject(
  data: SerializedProjectV1,
  ctx: AudioContext,
): Promise<Track[]> {
  const result: Track[] = [];

  for (let i = 0; i < data.tracks.length; i++) {
    const st = data.tracks[i];
    const track = newTrack(st.name, i, st.kind);
    track.id = st.id;
    track.color = st.color;
    track.inputSource = st.inputSource;
    track.volume = st.volume;
    track.pan = st.pan;
    track.muted = st.muted;
    track.solo = st.solo;
    track.recordArm = st.recordArm;
    track.eqPreset = st.eqPreset;
    track.effectPreset = st.effectPreset;
    track.spacePreset = st.spacePreset;
    track.midiNotes = st.midiNotes ?? [];

    const clips: Clip[] = [];
    for (const sc of st.clips) {
      let buffer: AudioBuffer | null = null;

      if (sc.sourceMeta?.type === 'library') {
        try {
          buffer = createLibrarySound(ctx, sc.sourceMeta.soundId as LibrarySoundId);
        } catch {
          /* skip unresolvable */
        }
      } else if (sc.sourceMeta?.type === 'remote') {
        const item = REMOTE_LIBRARY_FLAT.find((x) => x.id === sc.sourceMeta!.remoteId);
        if (item) {
          try {
            const res = await fetch(item.url, { mode: 'cors' });
            if (res.ok) {
              const ab = await res.arrayBuffer();
              buffer = await ctx.decodeAudioData(ab.slice(0));
            }
          } catch {
            /* skip */
          }
        }
      }

      if (buffer) {
        clips.push({
          id: sc.id,
          startTime: sc.startTime,
          buffer,
          sourceMeta: sc.sourceMeta,
        });
      }
    }

    track.clips = clips;
    result.push(track);
  }

  return result;
}
