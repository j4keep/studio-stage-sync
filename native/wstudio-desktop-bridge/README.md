# W.STUDIO Desktop Bridge

Small **Rust** app: listens on **`ws://127.0.0.1:48001`** (override with `VITE_WSTUDIO_DESKTOP_BRIDGE_PORT` in the web app, or pass a port as the first CLI arg). The **engineer** web session sends the same **float32 stereo interleaved** PCM as the legacy AU bridge; this process plays it to the **macOS default output device**.

## Why there is no folder named “Rust” (and no `.app` inside GitHub)

- **Rust** is the **programming language**, not a folder in your project. You know a project uses Rust when you see:
  - **`Cargo.toml`** — build config (like `package.json` for Node).
  - **`src/main.rs`** — source code (`.rs` = **R**u**s**t).
- You install the Rust **compiler and tools once on your Mac** from [rustup.rs](https://rustup.rs/). After that, Terminal understands `cargo`. Nothing in the repo needs to be named “Rust.”
- **Lovable** deploys your **website** (e.g. `studio-stage-sync.lovable.app`). It does **not** compile native Mac apps. A **`.app` / `.dmg`** is built **on a Mac** (or by **GitHub Actions**) from this folder, then you drag it to Applications—same idea as shipping any Mac program that is not only a website.

## Prerequisites

- [Rust](https://rustup.rs/) (`cargo` on your PATH)
- Optional: a **virtual loopback** or **W.STUDIO aggregate** routing so your DAW can record the same signal the bridge plays to **Sound → Output**.

## Run from Terminal (dev)

From the **repo root**:

```bash
npm run wstudio:bridge
```

Or:

```bash
cargo run --manifest-path native/wstudio-desktop-bridge/Cargo.toml
```

Custom port (must match the web env):

```bash
cargo run --manifest-path native/wstudio-desktop-bridge/Cargo.toml -- 48002
```

Leave the terminal open. In the web app (engineer, `http://localhost:8080` or your dev URL):

1. Join the session (same code as artist).
2. Under **W.STUDIO BRIDGE**, output should default to **W.STUDIO Desktop Bridge** on localhost.
3. Confirm **REMOTE IN** is **live**, then you should see levels in your DAW when the routed input is armed on a track.

## Installable Mac app (.app + .dmg)

This is a **real** macOS application bundle (icon, name in Finder), not “only a README.”

**One-time:** install [Rust](https://rustup.rs), then:

```bash
cargo install cargo-bundle
```

**Build** (from repo root):

```bash
cd /Users/you/Desktop/studio-stage-sync   # your path
npm run wstudio:bridge:app
```

Outputs:

- **`native/wstudio-desktop-bridge/target/release/bundle/osx/W.STUDIO Bridge.app`**
- **`dist-bridge/WSTUDIO-Bridge-mac.dmg`** (drag the app to Applications)

**Icon:** uses `src/assets/wheuat-logo.png` if present, else the doc reference PNG. Override:

```bash
WSTUDIO_BRIDGE_ICON=/path/to/your/1024.png npm run wstudio:bridge:app
```

**Gatekeeper (first launch):** Apple blocks apps that are not signed with an Apple Developer ID. **Right‑click** the app → **Open** → click **Open** in the dialog. That tells macOS you trust this app once.

**`xattr -cr`:** Clears the “downloaded from internet” quarantine flag. Use it if macOS says the app is damaged or still won’t open:

```bash
xattr -cr "/Applications/W.STUDIO Bridge.app"
```

**Dock icon only bounces:** the process exits right away. The two usual causes:

1. **Port 48001 in use** — another W.STUDIO Bridge is running, or you still have `npm run wstudio:bridge` open in Terminal. Quit those, then launch the app again. Check with: `lsof -nP -iTCP:48001 -sTCP:LISTEN`
2. **CoreAudio won’t open the default output** — pick **System Settings → Sound → Output** and choose built-in speakers or headphones once, then try the bridge again.

A **dialog** should explain which case it is. If you don’t see it, open **`/tmp/wstudio-bridge.log`** in TextEdit (Finder → Go → Go to Folder → `/tmp`). Newer builds also log there when launched from Finder.

To see errors in Terminal, run the binary directly:

```bash
"/Users/you/Desktop/studio-stage-sync/native/wstudio-desktop-bridge/target/release/bundle/osx/W.STUDIO Bridge.app/Contents/MacOS/wstudio-desktop-bridge"
```

**Lovable / GitHub:** this repo does not auto-upload a binary. After `npm run wstudio:bridge:app`, upload **`dist-bridge/WSTUDIO-Bridge-mac.dmg`** as a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) asset so others can download it.

## Web app env

- `VITE_WSTUDIO_DESKTOP_BRIDGE_PORT` — default **48001** if unset.

## Milestones (roadmap)

| Milestone | Scope |
|-----------|--------|
| **1 (this)** | WebSocket → default audio output; manual loopback / aggregate routing. |
| **2** | Dedicated **W.STUDIO Artist Input** device + installer. |
| **3** | Session pairing, reconnect UI, device picker in the app. |
| **4** | AU plugin = controls / meters only; optional IPC with this app. |
