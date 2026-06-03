#!/usr/bin/env bash
# Build the unified W.STUDIO Helper installer .pkg.
# Bundles: WStudioHelper.app (menubar) + WStudio.driver (virtual CoreAudio).
#
# Phase 1: UNSIGNED. Users will need:
#   sudo xattr -dr com.apple.quarantine "/Applications/W.STUDIO Helper.app"
#   sudo xattr -dr com.apple.quarantine /Library/Audio/Plug-Ins/HAL/WStudio.driver
# until we add Developer ID signing + notarization.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/build/pkg-stage"
OUT="$ROOT/build/WStudioHelper-unsigned.pkg"

rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/Applications" "$STAGE/Library/Audio/Plug-Ins/HAL"

echo "==> Building helper menubar app"
bash "$ROOT/scripts/build-wstudio-bridge-app.sh"
APP_PATH=$(ls -d "$ROOT/native/wstudio-desktop-bridge"/target/aarch64-apple-darwin/release/bundle/osx/*.app 2>/dev/null | head -1 || true)
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Helper .app bundle was not produced."
  exit 1
fi
cp -R "$APP_PATH" "$STAGE/Applications/W.STUDIO Helper.app"
HELPER_BIN="$STAGE/Applications/W.STUDIO Helper.app/Contents/MacOS/wstudio-desktop-bridge"
lipo -verify_arch arm64 x86_64 "$HELPER_BIN"

echo "==> Building CoreAudio driver"
(cd "$ROOT/native/wstudio-coreaudio-driver" && ./build.sh)
cp -R "$ROOT/native/wstudio-coreaudio-driver/build/WStudio.driver" \
      "$STAGE/Library/Audio/Plug-Ins/HAL/WStudio.driver"

echo "==> Writing LaunchAgent + postinstall"
SCRIPTS="$ROOT/build/pkg-scripts"
rm -rf "$SCRIPTS" && mkdir -p "$SCRIPTS"
cat > "$SCRIPTS/postinstall" <<'EOF'
#!/bin/bash
set -e
# Reload CoreAudio so the driver appears in the device list.
killall coreaudiod 2>/dev/null || true
# Install LaunchAgent so the helper starts at login.
PLIST="$HOME/Library/LaunchAgents/com.wheuat.wstudio.helper.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.wheuat.wstudio.helper</string>
  <key>ProgramArguments</key>
  <array><string>/Applications/W.STUDIO Helper.app/Contents/MacOS/wstudio-desktop-bridge</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
exit 0
EOF
chmod +x "$SCRIPTS/postinstall"

echo "==> pkgbuild"
pkgbuild --root "$STAGE" \
  --identifier com.wheuat.wstudio.installer \
  --version 0.2.0 \
  --scripts "$SCRIPTS" \
  --install-location / \
  "$OUT"

echo
echo "Built $OUT"
echo "Install: sudo installer -pkg $OUT -target /"
