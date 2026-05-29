/**
 * Helper Transport selector — single source of truth.
 *
 * UI calls `getActiveHelperTransport()`; the returned object implements
 * the `HelperTransport` contract. Today we always return a singleton
 * MockHelperTransport. When the real Helper App ships, swap this function
 * to return the native adapter (or read a feature flag) — no UI changes.
 *
 * LocalhostBridgeAdapter remains available for HQ audio transport
 * (`getActiveTransport()` in ../index.ts) as a temporary compatibility
 * path. It is intentionally NOT exposed through the Helper contract.
 */

import { MockHelperTransport } from "./MockHelperTransport";
import type { HelperTransport } from "./types";

let _active: HelperTransport | null = null;

export function getActiveHelperTransport(): HelperTransport {
  if (!_active) _active = new MockHelperTransport();
  return _active;
}

/** Test-only: replace the active transport (e.g. with a fake). */
export function __setActiveHelperTransport(t: HelperTransport | null) {
  _active = t;
}
