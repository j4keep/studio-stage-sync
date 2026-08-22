const KEY = "yaj.games.sugarrush.sfx.muted";
const MUSIC_KEY = "yaj.games.sugarrush.music.volume";
const SFX_KEY = "yaj.games.sugarrush.sfx.volume";

type SfxName = "swap" | "pop" | "drop" | "special" | "invalid" | "shuffle" | "cascade";

const SFX_FILES: Record<SfxName, string> = {
  swap: "/audio/sugar-rush/swap.wav",
  pop: "/audio/sugar-rush/pop.wav",
  drop: "/audio/sugar-rush/drop.wav",
  special: "/audio/sugar-rush/special.wav",
  invalid: "/audio/sugar-rush/invalid.wav",
  shuffle: "/audio/sugar-rush/shuffle.wav",
  cascade: "/audio/sugar-rush/cascade.wav",
};

const savedNumber = (key: string, fallback: number) => {
  if (typeof localStorage === "undefined") return fallback;
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};

class SugarRushSfx {
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;
  musicVolume = savedNumber(MUSIC_KEY, 0.32);
  sfxVolume = savedNumber(SFX_KEY, 0.82);
  private sounds = new Map<SfxName, HTMLAudioElement>();
  private music: HTMLAudioElement | null = null;
  private primed = false;

  private getSound(name: SfxName) {
    let audio = this.sounds.get(name);
    if (!audio) {
      audio = new Audio(SFX_FILES[name]);
      audio.preload = "auto";
      this.sounds.set(name, audio);
    }
    return audio;
  }

  private getMusic() {
    if (!this.music) {
      this.music = new Audio("/audio/sugar-rush/music-loop.wav");
      this.music.loop = true;
      this.music.preload = "auto";
      this.music.volume = this.musicVolume;
    }
    return this.music;
  }

  async prime() {
    if (typeof window === "undefined") return;
    try {
      const music = this.getMusic();
      music.volume = 0;
      music.muted = false;
      await music.play();
      music.pause();
      music.currentTime = 0;
      music.volume = this.musicVolume;
      music.muted = this.muted;
      this.primed = true;
    } catch {
      this.primed = false;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch { /* ignore */ }
    for (const audio of this.sounds.values()) audio.muted = muted;
    if (this.music) {
      this.music.muted = muted;
      if (!muted && this.primed) void this.music.play().catch(() => undefined);
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    try { localStorage.setItem(MUSIC_KEY, String(this.musicVolume)); } catch { /* ignore */ }
    if (this.music) this.music.volume = this.musicVolume;
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    try { localStorage.setItem(SFX_KEY, String(this.sfxVolume)); } catch { /* ignore */ }
  }

  async startMusic() {
    if (this.muted || this.musicVolume <= 0 || typeof window === "undefined") return;
    const music = this.getMusic();
    music.muted = false;
    music.volume = this.musicVolume;
    try { await music.play(); this.primed = true; } catch { /* iOS waits for a user gesture; intro pointer-down retries */ }
  }

  stopMusic() {
    if (!this.music) return;
    this.music.pause();
    this.music.currentTime = 0;
  }

  private play(name: SfxName, volume = 0.7, rate = 1) {
    if (this.muted || this.sfxVolume <= 0 || typeof window === "undefined") return;
    const base = this.getSound(name);
    const audio = base.cloneNode(true) as HTMLAudioElement;
    audio.volume = Math.min(1, volume * this.sfxVolume);
    audio.playbackRate = rate;
    void audio.play().catch(() => undefined);
  }

  swap() { this.play("swap", 0.55, 1); }
  invalid() { this.play("invalid", 0.48, 1); }
  pop(cascadeDepth = 1) { this.play("pop", 0.72, 1 + Math.min(5, cascadeDepth - 1) * 0.055); }
  drop(strength = 1) { this.play("drop", Math.min(0.72, 0.32 + strength * 0.09), 0.96 + Math.random() * 0.08); }
  special() { this.play("special", 0.86, 1); }
  cascade(depth = 2) { this.play("cascade", 0.64, 0.98 + Math.min(depth, 5) * 0.04); }
  shuffle() { this.play("shuffle", 0.62, 1); }
  buzzer() { this.play("invalid", 0.65, 0.72); }
  win() { this.play("cascade", 0.9, 1.22); }
  lose() { this.play("invalid", 0.7, 0.65); }
}

export const sugarRushSfx = new SugarRushSfx();
