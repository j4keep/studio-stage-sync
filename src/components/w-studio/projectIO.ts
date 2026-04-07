import { createLibrarySound, type LibrarySoundId } from './audio';
import { REMOTE_LIBRARY_FLAT } from './remoteLibrary';
import type { SessionRole, StudioProjectMeta } from './studioSession';
import {
  clipTrimEnd,
  clipTrimStart,
  clipVisibleDuration,
  createDefaultFxInsertSlots,
  defaultChannelModeForKind,
  studioTrackTypeFromKind,
  type BusId,
  type ClipSourceMeta,
  type EffectPresetId,
  type EqPresetId,
  type FxInsertSlot,
  type MidiNote,
  type SpacePresetId,
  type StudioTrackType,
  type Track,
  type TrackKind,
} from './types';

export const PROJECT_FILE_VERSION = 1 as const;

export type SerializedClipV1 = {
  id: string;
  startTime: number;
  durationSec: number;
  source: ClipSourceMeta;
  /** Seconds into decoded buffer; omit means 0 */
  trimStartSec?: number;
  /** Seconds into decoded buffer; omit means full buffer duration */
  trimEndSec?: number;
  clipGain?: number;
};

export type SerializedTrackV1 = {
  id: string;
  name: string;
  color: string;
  kind: TrackKind;
  studioTrackType?: StudioTrackType;
  fxInserts?: FxInsertSlot[];
  inputDeviceId?: string;
  inputMonitoring?: boolean;
  channelMode?: TrackChannelMode;
  inputSource: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eqPreset: EqPresetId;
  effectPreset: EffectPresetId;
  spacePreset: SpacePresetId;
  outputBus?: BusId;
  sendReverb?: number;
  clips: SerializedClipV1[];
  midiNotes: MidiNote[];
};

export type SerializedProjectV1 = {
  version: typeof PROJECT_FILE_VERSION;
  tempo: number;
  beatsPerBar: number;
  tracks: SerializedTrackV1[];
  projectMeta?: StudioProjectMeta;
  sessionRole?: SessionRole;
  artistSessionLimited?: boolean;
};

export type ProjectSerializeEnvelope = {
  projectMeta?: StudioProjectMeta;
  sessionRole?: SessionRole;
  artistSessionLimited?: boolean;
};

export function serializeProject(
  tracks: Track[],
  tempo: number,
  beatsPerBar: number,
  envelope?: ProjectSerializeEnvelope,
): string {
  const data: SerializedProjectV1 = {
    version: PROJECT_FILE_VERSION,
    tempo,
    beatsPerBar,
    ...(envelope?.projectMeta ? { projectMeta: envelope.projectMeta } : {}),
    ...(envelope?.sessionRole != null ? { sessionRole: envelope.sessionRole } : {}),
    ...(envelope?.artistSessionLimited != null
      ? { artistSessionLimited: envelope.artistSessionLimited }
      : {}),
    tracks: tracks.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      kind: t.kind,
      studioTrackType: t.studioTrackType,
      fxInserts: t.fxInserts.map((s) => ({ ...s })),
      inputDeviceId: t.inputDeviceId || undefined,
      inputMonitoring: t.inputMonitoring,
      channelMode: t.channelMode,
      inputSource: t.inputSource,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      eqPreset: t.eqPreset,
      effectPreset: t.effectPreset,
      spacePreset: t.spacePreset,
      outputBus: t.outputBus,
      sendReverb: t.sendReverb,
      clips: t.clips
        .filter((c): c is typeof c & { sourceMeta: ClipSourceMeta } => Boolean(c.sourceMeta))
        .map((c) => ({
          id: c.id,
          startTime: c.startTime,
          durationSec: clipVisibleDuration(c),
          trimStartSec: clipTrimStart(c),
          trimEndSec: clipTrimEnd(c),
          clipGain: c.clipGain,
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
      studioTrackType: st.studioTrackType ?? studioTrackTypeFromKind(st.kind),
      fxInserts:
        st.fxInserts && st.fxInserts.length > 0
          ? st.fxInserts.map((s) => ({ ...s }))
          : createDefaultFxInsertSlots(),
      inputDeviceId: st.inputDeviceId,
      inputMonitoring: st.inputMonitoring ?? false,
      channelMode: st.channelMode ?? defaultChannelModeForKind(st.kind),
      inputSource: st.inputSource,
      recordArm: false,
      volume: st.volume,
      pan: st.pan,
      muted: st.muted,
      solo: st.solo,
      eqPreset: st.eqPreset,
      effectPreset: st.effectPreset,
      spacePreset: st.spacePreset,
      outputBus: st.outputBus ?? 'master',
      sendReverb: st.sendReverb ?? 0.18,
      clips: [],
      midiNotes: st.midiNotes.map((m) => ({ ...m })),
    };
    for (const sc of st.clips) {
      try {
        if (sc.source.type === 'library') {
          const buf = createLibrarySound(ctx, sc.source.soundId as LibrarySoundId);
          const t0 = sc.trimStartSec ?? 0;
          const t1 = sc.trimEndSec ?? buf.duration;
          tr.clips.push({
            id: sc.id,
            startTime: sc.startTime,
            buffer: buf,
            trimStart: t0,
            trimEnd: Math.min(buf.duration, t1),
            clipGain: sc.clipGain,
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
          const t0 = sc.trimStartSec ?? 0;
          const t1 = sc.trimEndSec ?? buf.duration;
          tr.clips.push({
            id: sc.id,
            startTime: sc.startTime,
            buffer: buf,
            trimStart: t0,
            trimEnd: Math.min(buf.duration, t1),
            clipGain: sc.clipGain,
            sourceMeta: { type: 'remote', remoteId: remoteSource.remoteId },
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
