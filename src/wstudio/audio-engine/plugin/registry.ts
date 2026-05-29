/**
 * Plugin Transport selector — single source of truth.
 *
 * UI calls `getActivePluginTransport()`. Today this is always the mock.
 * When the real plugin transport ships (via Helper App or otherwise),
 * swap this function to return the real adapter — no UI changes.
 */

import { MockPluginTransport } from "./MockPluginTransport";
import type { PluginTransport } from "./types";

let _active: PluginTransport | null = null;

export function getActivePluginTransport(): PluginTransport {
  if (!_active) _active = new MockPluginTransport();
  return _active;
}

/** Test-only: replace the active plugin transport (e.g. with a fake). */
export function __setActivePluginTransport(t: PluginTransport | null) {
  _active = t;
}
