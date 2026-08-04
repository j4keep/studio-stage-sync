/**
 * Singleton live-debate recorder that survives feed ↔ battle page navigation.
 * Challenger starts once when the debate goes live; flush runs when it ends.
 */

import {
  startBattleLiveRecorder,
  type BattleLiveRecorder,
  type BattleLiveRecorderSources,
} from "@/lib/battle-live-record";
import { persistLiveBattleReplay } from "@/lib/persist-live-battle-replay";

type BattleLike = {
  id: string;
  challenger_id?: string | null;
  battle_background?: string | null;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  challenger_cover_url?: string | null;
  opponent_cover_url?: string | null;
};

type Session = {
  battleId: string;
  userId: string;
  recorder: BattleLiveRecorder;
  battle: BattleLike;
  localUrl: string | null;
  remoteUrl: string | null;
  /** True while MediaRecorder is still capturing frames. */
  capturing: boolean;
  saving: boolean;
  failed: boolean;
};

let session: Session | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeLiveRecordSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveRecordSessionSnapshot() {
  if (!session) {
    return {
      battleId: null as string | null,
      recording: false,
      saving: false,
      failed: false,
      localUrl: null as string | null,
      remoteUrl: null as string | null,
    };
  }
  return {
    battleId: session.battleId,
    recording: session.capturing,
    saving: session.saving,
    failed: session.failed,
    localUrl: session.localUrl,
    remoteUrl: session.remoteUrl,
  };
}

function applySources(
  recorder: BattleLiveRecorder,
  opts: {
    getLeftStream?: () => MediaStream | null;
    getRightStream?: () => MediaStream | null;
    getLeftVideo: () => HTMLVideoElement | null;
    getRightVideo: () => HTMLVideoElement | null;
    leftAudio?: MediaStream | null;
    rightAudio?: MediaStream | null;
  },
) {
  const sources: BattleLiveRecorderSources = {
    getLeftStream: opts.getLeftStream,
    getRightStream: opts.getRightStream,
    getLeftVideo: opts.getLeftVideo,
    getRightVideo: opts.getRightVideo,
    leftAudio: opts.leftAudio,
    rightAudio: opts.rightAudio,
  };
  recorder.setSources(sources);
}

export function ensureLiveBattleRecording(opts: {
  battle: BattleLike;
  userId: string;
  getLeftStream?: () => MediaStream | null;
  getRightStream?: () => MediaStream | null;
  getLeftVideo: () => HTMLVideoElement | null;
  getRightVideo: () => HTMLVideoElement | null;
  leftAudio?: MediaStream | null;
  rightAudio?: MediaStream | null;
  leftLabel?: string | null;
  rightLabel?: string | null;
}): boolean {
  if (!opts.userId || opts.userId !== opts.battle.challenger_id) return false;

  // Same debate already recording — rebind sinks to the NEW stage's streams/refs.
  // Without this, prep→Posts navigation left the recorder reading dead video refs
  // and baking cover photos for the entire replay.
  if (session?.battleId === opts.battle.id) {
    session.battle = opts.battle;
    if (session.capturing) {
      applySources(session.recorder, opts);
    }
    return true;
  }

  // Different battle — drop prior session without upload.
  if (session) {
    void session.recorder.stop().catch(() => null);
    if (session.localUrl) URL.revokeObjectURL(session.localUrl);
    session = null;
  }

  const recorder = startBattleLiveRecorder({
    getLeftStream: opts.getLeftStream,
    getRightStream: opts.getRightStream,
    getLeftVideo: opts.getLeftVideo,
    getRightVideo: opts.getRightVideo,
    leftCoverUrl: opts.battle.challenger_cover_url,
    rightCoverUrl: opts.battle.opponent_cover_url,
    leftLabel: opts.leftLabel,
    rightLabel: opts.rightLabel,
    leftAudio: opts.leftAudio,
    rightAudio: opts.rightAudio,
  });
  if (!recorder) return false;

  session = {
    battleId: opts.battle.id,
    userId: opts.userId,
    recorder,
    battle: opts.battle,
    localUrl: null,
    remoteUrl: null,
    capturing: true,
    saving: false,
    failed: false,
  };
  emit();
  return true;
}

export function isLiveBattleRecording(battleId: string): boolean {
  return !!session && session.battleId === battleId && session.capturing;
}

/** Stop recorder, play local blob immediately, upload in background. */
export async function flushLiveBattleRecording(battleId: string): Promise<string | null> {
  if (!session || session.battleId !== battleId) return session?.remoteUrl || session?.localUrl || null;
  if (session.remoteUrl) return session.remoteUrl;
  if (session.saving) return session.localUrl;

  session.saving = true;
  session.capturing = false;
  session.failed = false;
  emit();

  const active = session;
  try {
    const blob = await active.recorder.stop();
    if (!blob?.size) {
      active.failed = true;
      active.saving = false;
      session = null;
      emit();
      return null;
    }

    if (active.localUrl) URL.revokeObjectURL(active.localUrl);
    const objectUrl = URL.createObjectURL(blob);
    active.localUrl = objectUrl;
    emit();

    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const url = await persistLiveBattleReplay({
          battle: active.battle,
          userId: active.userId,
          blob,
        });
        if (url) {
          active.remoteUrl = url;
          active.saving = false;
          emit();
          // Keep session until consumers pick up remote URL, then clear.
          window.setTimeout(() => {
            if (session === active) {
              if (active.localUrl) URL.revokeObjectURL(active.localUrl);
              session = null;
              emit();
            }
          }, 15_000);
          return url;
        }
      } catch (err) {
        lastErr = err;
        await new Promise((r) => window.setTimeout(r, 1200 * (attempt + 1)));
      }
    }
    active.failed = true;
    active.saving = false;
    emit();
    if (lastErr) console.warn("[live-replay] upload failed", lastErr);
    return active.localUrl;
  } catch {
    active.failed = true;
    active.saving = false;
    session = null;
    emit();
    return null;
  }
}
