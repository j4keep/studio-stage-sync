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

echo "Bundling .app (arm64 base) via cargo-bundle..."
( cd "$BRIDGE" && cargo bundle --release --target aarch64-apple-darwin )

APP_PATH=$(ls -d "$BRIDGE"/target/aarch64-apple-darwin/release/bundle/osx/*.app 2>/dev/null | head -1 || true)
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Bundle not found under $BRIDGE/target/aarch64-apple-darwin/release/bundle/osx/"
  exit 1
fi

BIN_NAME=$(basename "$APP_PATH" .app)
ARM_BIN="$BRIDGE/target/aarch64-apple-darwin/release/wstudio-desktop-bridge"
X86_BIN="$BRIDGE/target/x86_64-apple-darwin/release/wstudio-desktop-bridge"
APP_BIN="$APP_PATH/Contents/MacOS/$BIN_NAME"

echo "Creating universal (arm64 + x86_64) binary with lipo..."
lipo -create "$ARM_BIN" "$X86_BIN" -output "$APP_BIN"
lipo -info "$APP_BIN"

# Strip any quarantine attributes that may have crept in
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
