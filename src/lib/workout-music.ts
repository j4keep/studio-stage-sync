/**
 * Workout music for the Wellness → Move coach.
 *
 * Users build a playlist in Radio (any songs they like) and mark it as their
 * workout playlist. The Move coach can then play that playlist on shuffle and
 * automatically DUCK the music volume while the coach is talking, restoring it
 * once the voice line finishes.
 */

export type WorkoutTrack = {
  id: string;
  title: string;
  artist: string;
  image?: string;
  audioUrl?: string;
};

const PLAYLIST_KEY = "yaj.workout.playlistId.v1";
const VOLUME_KEY = "yaj.workout.volume.v1";
export const WORKOUT_PLAYLIST_EVENT = "yaj-workout-playlist-changed";

export function getWorkoutPlaylistId(): string | null {
  try {
    return localStorage.getItem(PLAYLIST_KEY);
  } catch {
    return null;
  }
}

export function setWorkoutPlaylistId(id: string | null) {
  try {
    if (id) localStorage.setItem(PLAYLIST_KEY, id);
    else localStorage.removeItem(PLAYLIST_KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(WORKOUT_PLAYLIST_EVENT));
}

export function isWorkoutPlaylist(id: string) {
  return getWorkoutPlaylistId() === id;
}

export function getWorkoutVolume(): number {
  try {
    const raw = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  } catch {
    /* ignore */
  }
  return 0.65;
}

export function setWorkoutVolume(v: number) {
  const clamped = Math.min(1, Math.max(0.05, v));
  try {
    localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    /* ignore */
  }
  workoutMusic.applyVolume();
}

/** Volume multiplier applied while the coach voice is speaking (gentle dim, never silence). */
const DUCK_FACTOR = 0.3;


export type WorkoutMusicState = {
  playing: boolean;
  ducked: boolean;
  track: WorkoutTrack | null;
  queueLength: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class WorkoutMusicEngine {
  private audio: HTMLAudioElement | null = null;
  private queue: WorkoutTrack[] = [];
  private index = 0;
  private duckDepth = 0;
  private listeners = new Set<(s: WorkoutMusicState) => void>();
  private ramp: number | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      const a = new Audio();
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      a.setAttribute("playsinline", "true");
      a.addEventListener("ended", () => void this.next());
      a.addEventListener("error", () => void this.next());
      this.audio = a;
    }
    this.ensureGraph();
    return this.audio;
  }

  /**
   * iOS Safari ignores HTMLAudioElement.volume, so route playback through a
   * Web Audio gain node — that is the only reliable way to duck on mobile.
   */
  private ensureGraph() {
    if (this.gain || !this.audio) return;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = this.ctx ?? new Ctor();
      this.ctx = ctx;
      const src = ctx.createMediaElementSource(this.audio);
      const gain = ctx.createGain();
      gain.gain.value = getWorkoutVolume();
      src.connect(gain);
      gain.connect(ctx.destination);
      this.gain = gain;
    } catch {
      /* fall back to element volume */
    }
  }

  private resumeCtx() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }


  get state(): WorkoutMusicState {
    return {
      playing: Boolean(this.audio && !this.audio.paused && this.queue.length > 0),
      ducked: this.duckDepth > 0,
      track: this.queue[this.index] ?? null,
      queueLength: this.queue.length,
    };
  }

  subscribe(cb: (s: WorkoutMusicState) => void) {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    const s = this.state;
    this.listeners.forEach((cb) => cb(s));
  }

  /** Replace the queue with playable tracks (shuffled by default). */
  setQueue(tracks: WorkoutTrack[], opts: { shuffle?: boolean } = {}) {
    const playable = tracks.filter((t) => Boolean(t.audioUrl));
    this.queue = opts.shuffle === false ? playable : shuffle(playable);
    this.index = 0;
    this.emit();
  }

  applyVolume() {
    if (!this.audio && !this.gain) return;
    const base = getWorkoutVolume();
    this.rampTo(this.duckDepth > 0 ? base * DUCK_FACTOR : base);
  }

  private rampTo(target: number) {
    const clamped = Math.min(1, Math.max(0, target));
    if (this.ramp) window.clearInterval(this.ramp);
    this.ramp = null;
    // Web Audio path: smooth, and actually works on iOS.
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      const g = this.gain.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(clamped, now + 0.25);
      } catch {
        g.value = clamped;
      }
      if (this.audio) this.audio.volume = 1;
      return;
    }
    const audio = this.audio;
    if (!audio) return;
    const step = () => {
      const diff = clamped - audio.volume;
      if (Math.abs(diff) < 0.02) {
        audio.volume = clamped;
        if (this.ramp) window.clearInterval(this.ramp);
        this.ramp = null;
        return;
      }
      audio.volume = Math.min(1, Math.max(0, audio.volume + diff * 0.35));
    };
    this.ramp = window.setInterval(step, 40);
    step();
  }

  async play() {
    if (this.queue.length === 0) return;
    const audio = this.ensureAudio();
    const track = this.queue[this.index];
    if (!track?.audioUrl) return;
    if (audio.src !== track.audioUrl) {
      audio.src = track.audioUrl;
      if (!this.gain) audio.volume = 0;
    }
    this.resumeCtx();
    try {
      await audio.play();
    } catch {
      /* autoplay blocked until a user gesture */
    }
    this.applyVolume();
    this.emit();
  }


  pause() {
    this.audio?.pause();
    this.emit();
  }

  async toggle() {
    if (this.state.playing) this.pause();
    else await this.play();
  }

  /** Advance to the next song, looping the shuffled queue. */
  async next() {
    if (this.queue.length === 0) return;
    this.index = (this.index + 1) % this.queue.length;
    const audio = this.ensureAudio();
    const track = this.queue[this.index];
    audio.src = track?.audioUrl || "";
    if (!this.gain) audio.volume = 0;
    this.resumeCtx();

    try {
      await audio.play();
    } catch {
      /* ignore */
    }
    this.applyVolume();
    this.emit();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }
    this.duckDepth = 0;
    this.emit();
  }

  /** Lower the music while the coach speaks. Nestable. */
  duck() {
    this.duckDepth += 1;
    this.applyVolume();
    if (this.duckDepth === 1) this.emit();
  }

  /** Restore music volume after the coach line ends. */
  unduck() {
    this.duckDepth = Math.max(0, this.duckDepth - 1);
    this.applyVolume();
    if (this.duckDepth === 0) this.emit();
  }
}

export const workoutMusic = new WorkoutMusicEngine();
