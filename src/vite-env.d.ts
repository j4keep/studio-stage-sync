/// <reference types="vite/client" />

interface AudioSession {
  type: "auto" | "playback" | "play-and-record" | "ambient" | "transient" | "transient-solo";
}

interface Navigator {
  audioSession?: AudioSession;
}
