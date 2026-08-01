# YAJ Wellness ambient audio

Royalty-free MP3s can be dropped here later (optional). The app ships with Mixkit CDN loops + on-device procedural noise so Sleep works without bundling large files.

Suggested layout:

```
public/audio/
  sleep/
    heavy-rain.mp3
    rain-window.mp3
  relax/
    waterfall.mp3
  meditation/
    singing-bowl.mp3
  focus/
    coffee-shop.mp3
  deep/
    brown-noise.mp3
```

Then set `source: { kind: "local", path: "/audio/sleep/heavy-rain.mp3" }` on a track in `src/lib/wellness-ambient-catalog.ts`.

Only use files you have rights to (Mixkit, Pixabay, your own recordings, etc.).
