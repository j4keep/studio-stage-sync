/**
 * Virtual input labels for engineer-side DAW routing (native bridge / virtual device targets).
 * Browser MVP exposes parallel MediaStreams; a desktop helper can map these to CoreAudio / WASAPI devices.
 */
export const WSTUDIO_DAW_VOCAL_IN_1 = "W.Studio Vocal In 1";
export const WSTUDIO_DAW_VOCAL_IN_2 = "W.Studio Vocal In 2";
export const WSTUDIO_DAW_RETURN = "W.Studio DAW Return";

/** Human-readable routing roles for documentation and bridge UI. */
export const WSTUDIO_AUDIO_BUS_ROLES = {
  /** Remote artist performance mic — dedicated DAW record path (not monitor-gain dependent). */
  artistVocalDaw: "artist_vocal_daw",
  /** Session monitor / call path (video element, headphone fader, etc.). */
  sessionMonitor: "session_monitor",
  /** Engineer talkback / duplex send (local graph). */
  engineerTalkbackSend: "engineer_talkback_send",
  /** Screen-share system audio when enabled (future separate capture). */
  screenShareSystem: "screen_share_system",
  /** DAW playback return — engineer captures DAW output and sends to artist for monitoring. */
  dawReturn: "daw_return",
} as const;
