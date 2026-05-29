/**
 * Plugin Transport public entry point.
 *
 * Import from here:
 *   import { getActivePluginTransport, type PluginTransport } from "@/wstudio/audio-engine/plugin";
 *
 * Note: `./PluginConnection` is a separate legacy hook used by the existing
 * /wstudio production UI and is intentionally NOT re-exported here to keep
 * the new contract surface clean.
 */
export * from "./types";
export { MockPluginTransport } from "./MockPluginTransport";
export { getActivePluginTransport, __setActivePluginTransport } from "./registry";
