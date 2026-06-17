#!/usr/bin/env bash
# Projucer "Save" can reset Xcode settings that break local builds:
# - Run Scripts use `set -u` → codesign fails when entitlementsArg is unset
# - ENABLE_USER_SCRIPT_SANDBOXING = YES → ditto/codesign in Plugin Copy Step hits Sandbox: deny file-read-data
# Re-run after Projucer Save if you see PhaseScriptExecution or Sandbox: ditto errors.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBX="$REPO_ROOT/native/wstudio-plugin/WStudioPlugin/Builds/MacOSX/WStudioPlugin.xcodeproj/project.pbxproj"
if [[ ! -f "$PBX" ]]; then
  echo "Missing: $PBX"
  exit 1
fi
if grep -q 'set -euo pipefail' "$PBX"; then
  sed -i '' 's/set -euo pipefail/set -eo pipefail/g' "$PBX"
  echo "Patched $PBX (set -eo pipefail in Run Script phases)."
else
  echo "No set -euo pipefail found — already patched or Projucer format changed."
fi
if grep -q 'ENABLE_USER_SCRIPT_SANDBOXING = YES' "$PBX"; then
  sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES/ENABLE_USER_SCRIPT_SANDBOXING = NO/g' "$PBX"
  echo "Patched $PBX (disabled User Script Sandboxing for Plugin Copy / ditto)."
else
  echo "User Script Sandboxing already off or key missing."
fi
