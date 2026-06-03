#!/usr/bin/env bash
# Build a real macOS .app (and optional .dmg) for W.STUDIO Desktop Bridge.
# Prerequisites: Rust (rustup.rs), Xcode CLI tools (sips), and once: cargo install cargo-bundle
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE="$ROOT/native/wstudio-desktop-bridge"
OUT_DMG_DIR="$ROOT/dist-bridge"

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust is not installed. Install from https://rustup.rs then re-run this script."
  exit 1
fi

if ! cargo bundle --help >/dev/null 2>&1; then
  echo "Installing cargo-bundle (one-time)..."
  cargo install cargo-bundle
fi

mkdir -p "$BRIDGE/icons"

# Prefer product logo; fall back to repo doc image; you can set WSTUDIO_BRIDGE_ICON=/path/to.png
SRC_ICON="${WSTUDIO_BRIDGE_ICON:-}"
if [[ -z "$SRC_ICON" || ! -f "$SRC_ICON" ]]; then
  SRC_ICON="$ROOT/src/assets/wheuat-logo.png"
fi
if [[ ! -f "$SRC_ICON" ]]; then
  SRC_ICON="$ROOT/docs/wstudio-live-session-ui-reference-2026-04-20.png"
fi
if [[ ! -f "$SRC_ICON" ]]; then
  echo "No PNG found for the app icon. Set WSTUDIO_BRIDGE_ICON=/path/to/1024.png or add src/assets/wheuat-logo.png"
  exit 1
fi

echo "Using icon source: $SRC_ICON"
sips -z 32 32 "$SRC_ICON" --out "$BRIDGE/icons/32x32.png" >/dev/null
sips -z 128 128 "$SRC_ICON" --out "$BRIDGE/icons/128x128.png" >/dev/null
sips -z 256 256 "$SRC_ICON" --out "$BRIDGE/icons/128x128@2x.png" >/dev/null

echo "Ensuring both Rust targets are installed (arm64 + x86_64)..."
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null

echo "Building release binaries for both architectures..."
( cd "$BRIDGE" && cargo build --release --target aarch64-apple-darwin )
( cd "$BRIDGE" && cargo build --release --target x86_64-apple-darwin )

ARM_BIN="$BRIDGE/target/aarch64-apple-darwin/release/wstudio-desktop-bridge"
X86_BIN="$BRIDGE/target/x86_64-apple-darwin/release/wstudio-desktop-bridge"

echo "Verifying thin release binary architectures before bundling..."
test -x "$ARM_BIN"
test -x "$X86_BIN"
lipo "$ARM_BIN" -verify_arch arm64
lipo "$X86_BIN" -verify_arch x86_64

echo "Bundling .app (arm64 base) via cargo-bundle..."
rm -rf "$BRIDGE/target/aarch64-apple-darwin/release/bundle/osx"
( cd "$BRIDGE" && cargo bundle --release --target aarch64-apple-darwin )

APP_PATH=$(ls -d "$BRIDGE"/target/aarch64-apple-darwin/release/bundle/osx/*.app 2>/dev/null | head -1 || true)
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Bundle not found under $BRIDGE/target/aarch64-apple-darwin/release/bundle/osx/"
  exit 1
fi

# Resolve the real CFBundleExecutable from Info.plist (cargo-bundle uses the
# cargo target name, not the .app folder name) and write the universal binary
# to THAT exact path. Otherwise macOS sees a mismatched/duplicate executable
# and refuses to launch with "incorrect executable format".
CFBE="wstudio-desktop-bridge"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable $CFBE" "$APP_PATH/Contents/Info.plist"
APP_BIN="$APP_PATH/Contents/MacOS/$CFBE"
echo "CFBundleExecutable = $CFBE"
echo "Target binary path = $APP_BIN"

# Remove every executable cargo-bundle or prior runs may have left behind so the
# bundle contains exactly ONE executable matching Info.plist.
find "$APP_PATH/Contents/MacOS" -mindepth 1 -maxdepth 1 -print -delete || true

echo "Creating universal (arm64 + x86_64) binary with lipo..."
lipo -create "$ARM_BIN" "$X86_BIN" -output "$APP_BIN"
chmod +x "$APP_BIN"

echo "Verifying final app bundle executable mapping + universal architecture..."
[[ "$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "$APP_PATH/Contents/Info.plist")" == "$CFBE" ]]
[[ -x "$APP_BIN" ]]
# `lipo -verify_arch` syntax is: lipo <file> -verify_arch <arch> [<arch> ...]
# (the file MUST come before the flag, otherwise lipo prints its usage banner
# and exits 1 — which is exactly what was failing the build at line 453).
lipo "$APP_BIN" -verify_arch arm64
lipo "$APP_BIN" -verify_arch x86_64
lipo -info "$APP_BIN"
# Sanity: -info output must mention both architectures.
lipo -info "$APP_BIN" | grep -q "x86_64"
lipo -info "$APP_BIN" | grep -q "arm64"
MACOS_COUNT=$(find "$APP_PATH/Contents/MacOS" -mindepth 1 -maxdepth 1 -type f | wc -l | tr -d ' ')
[[ "$MACOS_COUNT" == "1" ]]
ls -la "$APP_PATH/Contents/MacOS"

# Re-sign ad-hoc so macOS accepts the modified bundle, then strip quarantine.
codesign --force --deep --sign - "$APP_PATH" || true
xattr -cr "$APP_PATH" || true

echo ""
echo "✓ Application bundle:"
echo "  $APP_PATH"
echo ""
echo "First open on Mac: right-click → Open (Gatekeeper), or: xattr -cr \"$APP_PATH\""
echo ""

mkdir -p "$OUT_DMG_DIR"
DMG="$OUT_DMG_DIR/WSTUDIO-Bridge-mac.dmg"
APP_NAME=$(basename "$APP_PATH")
rm -f "$DMG"
hdiutil create -volname "W.STUDIO Bridge" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG" >/dev/null
echo "✓ Disk image (double-click to mount, drag app to Applications):"
echo "  $DMG"
