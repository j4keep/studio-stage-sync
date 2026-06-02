# W.STUDIO Virtual CoreAudio Device (Phase 1)

A user-space `AudioServerPlugIn` that registers as **"W.STUDIO Artist Input"** — a 1-input, 48kHz, 32-bit float, mono CoreAudio device that any DAW (Logic, Pro Tools, Ableton, etc.) can record from.

The driver reads audio out of POSIX shared memory `/wstudio_slot1`, written by the W.STUDIO Helper App.

```text
Engineer browser → POST /artist-audio/1 → Helper App → shm /wstudio_slot1
                                                              ↓
                                       W.STUDIO Artist Input (this driver)
                                                              ↓
                                                    Logic input bus
```

## Layout

```
wstudio-coreaudio-driver/
  Info.plist                  bundle metadata (HAL plug-in)
  src/
    WStudioPlugIn.cpp         AudioServerPlugIn entry points
    WStudioDevice.cpp         device + stream definitions
    WStudioShmReader.cpp      mmaps /wstudio_slot1
  build.sh                    builds WStudio.driver bundle
```

## Build

Phase 1 ships **unsigned** for testing:

```bash
cd native/wstudio-coreaudio-driver
./build.sh                                          # produces build/WStudio.driver
sudo cp -R build/WStudio.driver /Library/Audio/Plug-Ins/HAL/
sudo xattr -dr com.apple.quarantine /Library/Audio/Plug-Ins/HAL/WStudio.driver
sudo killall coreaudiod
```

Open System Settings → Sound → Input. You should see **W.STUDIO Artist Input**. In Logic: New Audio Track → Input: *W.STUDIO Artist Input* → arm → record.

## Status

Phase 1 scaffold. The Info.plist + bundle layout are real; the AudioServerPlugIn C++ entry points are stubs that need to be filled in on a Mac with Xcode and the CoreAudio SDK headers. The shm contract is locked (see `native/wstudio-desktop-bridge/src/shm.rs`).
