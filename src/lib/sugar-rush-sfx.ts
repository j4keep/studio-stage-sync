const KEY = "yaj.games.sugarrush.sfx.muted";

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

class SugarRushSfx {
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;
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
      this.music.volume = 0.24;
    }
    return this.music;
  }

  async prime() {
    if (typeof window === "undefined") return;
    try {
      const music = this.getMusic();
      music.muted = true;
      await music.play();
      music.pause();
      music.currentTime = 0;
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

  async startMusic() {
    if (this.muted || typeof window === "undefined") return;
    const music = this.getMusic();
    music.muted = false;
    music.volume = 0.24;
    try { await music.play(); } catch { /* iOS waits for a user gesture; prime() handles that */ }
  }

  stopMusic() {
    if (!this.music) return;
    this.music.pause();
    this.music.currentTime = 0;
  }

  private play(name: SfxName, volume = 0.7, rate = 1) {
    if (this.muted || typeof window === "undefined") return;
    const base = this.getSound(name);
    const audio = base.cloneNode(true) as HTMLAudioElement;
    audio.volume = volume;
    audio.playbackRate = rate;
    void audio.play().catch(() => undefined);
  }

  swap() { this.play("swap", 0.45, 1); }
  invalid() { this.play("invalid", 0.42, 1); }
  pop(cascadeDepth = 1) { this.play("pop", 0.62, 1 + Math.min(5, cascadeDepth - 1) * 0.055); }
  drop(strength = 1) { this.play("drop", Math.min(0.62, 0.28 + strength * 0.08), 0.96 + Math.random() * 0.08); }
  special() { this.play("special", 0.72, 1); }
  cascade(depth = 2) { this.play("cascade", 0.5, 0.98 + Math.min(depth, 5) * 0.04); }
  shuffle() { this.play("shuffle", 0.55, 1); }

  buzzer() { this.play("invalid", 0.55, 0.72); }
  win() { this.play("cascade", 0.75, 1.22); }
  lose() { this.play("invalid", 0.58, 0.65); }
}

export const sugarRushSfx = new SugarRushSfx();
