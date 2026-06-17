/**
 * Helper Transport selector — single source of truth.
 *
 * Default: HttpHelperTransport polling http://127.0.0.1:48000.
 * Tests can swap in a Mock or fake via __setActiveHelperTransport.
 */

import { HttpHelperTransport } from "./HttpHelperTransport";
import type { HelperTransport } from "./types";

let _active: HelperTransport | null = null;

export function getActiveHelperTransport(): HelperTransport {
  if (!_active) _active = new HttpHelperTransport();
  return _active;
}

export function __setActiveHelperTransport(t: HelperTransport | null) {
  _active = t;
}
