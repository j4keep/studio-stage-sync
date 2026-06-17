#!/usr/bin/env bash
# Build the WStudio.driver bundle (macOS).
# Requires: Xcode command-line tools, CoreAudio.framework headers.

set -euo pipefail
cd "$(dirname "$0")"

OUT="build/WStudio.driver"
rm -rf build && mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"

cp Info.plist "$OUT/Contents/Info.plist"

clang++ -std=c++17 -arch arm64 -arch x86_64 -bundle -O2 \
  -Wno-deprecated-declarations \
  -framework CoreFoundation -framework CoreAudio \
  -o "$OUT/Contents/MacOS/WStudio" \
  src/WStudioPlugIn.cpp

echo
echo "Built $OUT"
echo "Install with:"
echo "  sudo cp -R $OUT /Library/Audio/Plug-Ins/HAL/"
echo "  sudo xattr -dr com.apple.quarantine /Library/Audio/Plug-Ins/HAL/WStudio.driver"
echo "  sudo killall coreaudiod"
