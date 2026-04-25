#!/usr/bin/env bash
# One-shot: clean local Xcode artifacts, build WStudioPlugin AU (Release), install to user Components.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOSX="$REPO_ROOT/native/wstudio-plugin/WStudioPlugin/Builds/MacOSX"
PROJECT="$MACOSX/WStudioPlugin.xcodeproj"
DERIVED="$MACOSX/DerivedDataLocal"
COMPONENT_SRC="$MACOSX/build/Release/WStudioPlugin.component"
COMPONENT_DST="$HOME/Library/Audio/Plug-Ins/Components/WStudioPlugin.component"

if [[ ! -d "$PROJECT" ]]; then
  echo "Missing Xcode project. Open WStudioPlugin.jucer in Projucer and Save to generate Builds/MacOSX."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found. Install Xcode from the Mac App Store."
  exit 1
fi

echo "→ Removing local build + DerivedData (not touching ~/Library/Developer/Xcode/DerivedData)"
rm -rf "$MACOSX/build" "$DERIVED"

echo "→ Building WStudioPlugin - AU (Release)…"
xcodebuild \
  -project "$PROJECT" \
  -scheme "WStudioPlugin - AU" \
  -configuration Release \
  -derivedDataPath "$DERIVED" \
  build

if [[ ! -d "$COMPONENT_SRC" ]]; then
  echo "Build finished but expected bundle missing: $COMPONENT_SRC"
  exit 1
fi

echo "→ Installing to $COMPONENT_DST"
rm -rf "$COMPONENT_DST"
cp -R "$COMPONENT_SRC" "$COMPONENT_DST"

echo "Done. Quit Logic if it was open, then reopen and rescan plug-ins if needed."
