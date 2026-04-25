# WStudioPlugin (JUCE / Xcode)

Fresh **Audio Unit + VST3** plugin scaffold. The web app in the repo root does not build this — use **Projucer** and **Xcode** on a Mac.

**Architecture note:** An AU insert **cannot** act as a **Logic/macOS audio input** like BlackHole. The intended product uses **W.STUDIO Desktop Bridge + virtual input** for recording; **this AU is primarily a control / metering surface** (see [`ARCHITECTURE.md`](./ARCHITECTURE.md)). Experimental WebSocket PCM into the AU is controlled by **`WSTUDIO_AU_ENABLE_NETWORK_BRIDGE`** in **Projucer → Configurations** (and in Xcode **Preprocessor Macros** after Save). Default is **`0`** in both Debug and Release. Engineers keep **their existing interface** (any vendor); an **Aggregate Device** can add **W.STUDIO Artist Input** alongside those inputs.

## Checklist: is the tree set up right?

| Requirement | Expected location |
|-------------|-------------------|
| **JUCE modules** | `native/wstudio-plugin/JUCE/modules/` (clone the [JUCE](https://github.com/juce-framework/JUCE) repo into `JUCE` next to this README). |
| **Plugin source** | `WStudioPlugin/Source/*.cpp` — this is what you edit for UI/audio. |
| **Projucer project** | Only open **`WStudioPlugin/WStudioPlugin.jucer`**. |
| **After Save** | Projucer must create **`WStudioPlugin/Builds/MacOSX/`** and **`WStudioPlugin/JuceLibraryCode/`** next to that `.jucer`. If those folders never appear, Xcode has nothing valid to build here. |

The `.jucer` module paths are **`../JUCE/modules`** relative to the folder that contains **`WStudioPlugin.jucer`**, which resolves to **`native/wstudio-plugin/JUCE/modules`**. If JUCE is somewhere else on your Mac, use **Projucer → File → Global Paths** and point modules at your `JUCE/modules`, then **Save** again.

**JUCE 8 / Projucer 8:** `juce_audio_processors` depends on **`juce_audio_processors_headless`**. That module must appear in the project or Projucer will refuse to save with “missing module dependencies.” This repo’s `.jucer` includes it.

## One-time setup

1. Clone JUCE into `native/wstudio-plugin/JUCE` (or set Global Paths to your existing `JUCE/modules`).
2. Open **`WStudioPlugin/WStudioPlugin.jucer`** in **Projucer** (not any other `.jucer`).
3. Confirm **File → Global Paths** → **JUCE modules** resolves (no red missing modules in the Projucer module list).
4. Click **Save** — Projucer generates **`Builds/MacOSX/`** and **`JuceLibraryCode/`** beside that `.jucer`.

## Build

**Fast path (from repo root):** quit Logic, then run **`npm run wstudio:plugin:au`** (or `bash scripts/build-wstudio-au.sh`). That cleans this project’s local `build/` + `DerivedDataLocal`, compiles the AU with **`-derivedDataPath`** inside the repo (avoids broken `~/Library/Developer/Xcode/DerivedData` issues), and copies **`WStudioPlugin.component`** into **`~/Library/Audio/Plug-Ins/Components/`**.

**After Projucer Save:** if Xcode fails at **PhaseScriptExecution**, **Sandbox: ditto … deny file-read-data**, or **Plugin Copy Step**, run **`npm run wstudio:plugin:fix-xcode-scripts`** — it restores `set -eo pipefail` in Run Scripts and turns off **User Script Sandboxing** (Xcode otherwise blocks `ditto` into `~/Library/Audio/Plug-Ins/`).

### Where is `WStudioPlugin.component`? (do not use DerivedData for this)

JUCE puts the real bundle under **`Builds/MacOSX/build/Debug/`** or **`.../build/Release/`**. Xcode also creates **`DerivedDataLocal/`** with lots of **`Intermediates`** / **`.build`** folders; **`DerivedDataLocal/Build/Products` is usually empty** here, which is confusing.

After each successful **WStudioPlugin - AU** build, the project also mirrors the AU to a short path next to the Xcode project:

- **Debug:** `WStudioPlugin/Builds/MacOSX/BuiltPlugin/Debug/WStudioPlugin.component`
- **Release:** `WStudioPlugin/Builds/MacOSX/BuiltPlugin/Release/WStudioPlugin.component`

Open that folder in Finder: same place as **`WStudioPlugin.xcodeproj`**, then **`BuiltPlugin`**, then **`Debug`** or **`Release`**.

### Xcode (manual)

1. Open **`WStudioPlugin/Builds/MacOSX/WStudioPlugin.xcodeproj`** in Xcode.
2. Scheme **WStudioPlugin - AU** (or VST3), **Product → Build**.
3. If **Clean** complains about deleting `build/`: quit Logic, then in Terminal run  
   `rm -rf WStudioPlugin/Builds/MacOSX/build`   and build again.

## Standalone distribution (AU / VST3)

- Build the **Release** scheme, then copy the `.component` and/or `.vst3` from `Builds/MacOSX/build/Release/` (exact path depends on Xcode settings).
- **Code signing & notarization** are required for Gatekeeper on macOS when giving installers to customers; use your Apple Developer Program workflow (not covered here).
- **Session cloud URL:** the default Supabase `session-lookup` endpoint is compiled in. For your own backend, add to **Xcode → Target → Build Settings → Other C Flags** (or Projucer exporter flags):

  `-DWSTUDIO_SESSION_LOOKUP_URL=\"https://your-project.supabase.co/functions/v1/session-lookup\"`

  (Escape quotes as your build system requires.) The value must be the full function URL with no trailing slash.

## Layout

```
native/wstudio-plugin/
├── JUCE/                    ← clone JUCE here (gitignored; required to build)
├── README.md
└── WStudioPlugin/
    ├── WStudioPlugin.jucer   ← open THIS in Projucer
    ├── Source/               ← editor + processor source
    ├── Builds/               ← generated by Projucer Save (gitignored)
    └── JuceLibraryCode/      ← generated by Projucer Save (gitignored)
```
