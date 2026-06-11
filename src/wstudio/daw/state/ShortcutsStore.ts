import { create } from "zustand";

export type ShortcutActionId =
  | "play" | "stop" | "record" | "rewind" | "forward5" | "back5" | "loop"
  | "export" | "undo" | "redo"
  | "copy" | "cut" | "paste" | "duplicate" | "deleteClip"
  | "toggleKeyboard" | "toggleTheme"
  | "toolPointer" | "toolPencil" | "toolEraser" | "toolScissors"
  | "viewEdit" | "viewMixer"
  | "openShortcuts";

export interface ShortcutAction {
  id: ShortcutActionId;
  label: string;
  group: "Transport" | "Editing" | "Tools" | "View" | "Other";
  defaultCombo: string;
}

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: "play",            label: "Play / Pause",                 group: "Transport", defaultCombo: "Space" },
  { id: "stop",            label: "Stop",                         group: "Transport", defaultCombo: "Shift+Space" },
  { id: "record",          label: "Record on armed track",        group: "Transport", defaultCombo: "R" },
  { id: "rewind",          label: "Return to start",              group: "Transport", defaultCombo: "Enter" },
  { id: "forward5",        label: "Forward 5 seconds",            group: "Transport", defaultCombo: "ArrowRight" },
  { id: "back5",           label: "Back 5 seconds",               group: "Transport", defaultCombo: "ArrowLeft" },
  { id: "loop",            label: "Cycle / Loop",                 group: "Transport", defaultCombo: "C" },
  { id: "export",          label: "Export / bounce to WAV",       group: "Transport", defaultCombo: "Mod+E" },

  { id: "undo",            label: "Undo",                         group: "Editing",   defaultCombo: "Mod+Z" },
  { id: "redo",            label: "Redo",                         group: "Editing",   defaultCombo: "Mod+Shift+Z" },
  { id: "copy",            label: "Copy clip",                    group: "Editing",   defaultCombo: "Mod+C" },
  { id: "cut",             label: "Cut clip",                     group: "Editing",   defaultCombo: "Mod+X" },
  { id: "paste",           label: "Paste clip",                   group: "Editing",   defaultCombo: "Mod+V" },
  { id: "duplicate",       label: "Duplicate clip",               group: "Editing",   defaultCombo: "Mod+D" },
  { id: "deleteClip",      label: "Delete clip",                  group: "Editing",   defaultCombo: "Delete" },

  { id: "toolPointer",     label: "Tool: Pointer",                group: "Tools",     defaultCombo: "V" },
  { id: "toolPencil",      label: "Tool: Pencil",                 group: "Tools",     defaultCombo: "B" },
  { id: "toolEraser",      label: "Tool: Eraser",                 group: "Tools",     defaultCombo: "E" },
  { id: "toolScissors",    label: "Tool: Scissors",               group: "Tools",     defaultCombo: "S" },

  { id: "viewEdit",        label: "View: Edit",                   group: "View",      defaultCombo: "X" },
  { id: "viewMixer",       label: "View: Mixer",                  group: "View",      defaultCombo: "M" },
  { id: "toggleKeyboard",  label: "Toggle on-screen keyboard",    group: "View",      defaultCombo: "K" },
  { id: "toggleTheme",     label: "Toggle light/dark mode",       group: "View",      defaultCombo: "Shift+D" },

  { id: "openShortcuts",   label: "Open shortcut cheat sheet",    group: "Other",     defaultCombo: "Shift+/" },
];

const LS_KEY = "wstudio:daw:shortcuts:v1";

function loadBindings(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
function persist(bindings: Record<string, string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(bindings)); } catch {}
}

function defaults(): Record<ShortcutActionId, string> {
  const out = {} as Record<ShortcutActionId, string>;
  for (const a of SHORTCUT_ACTIONS) out[a.id] = a.defaultCombo;
  return out;
}

interface ShortcutsState {
  bindings: Record<ShortcutActionId, string>;
  setBinding: (id: ShortcutActionId, combo: string) => void;
  clearBinding: (id: ShortcutActionId) => void;
  resetAll: () => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  bindings: { ...defaults(), ...(loadBindings() as Record<ShortcutActionId, string>) },
  setBinding: (id, combo) => {
    const next = { ...get().bindings, [id]: combo };
    set({ bindings: next }); persist(next);
  },
  clearBinding: (id) => {
    const next = { ...get().bindings, [id]: "" };
    set({ bindings: next }); persist(next);
  },
  resetAll: () => {
    const d = defaults();
    set({ bindings: d }); persist(d);
  },
}));

/** Serialize a KeyboardEvent into a canonical combo string. Returns null for modifier-only presses. */
export function comboFromEvent(ev: KeyboardEvent): string | null {
  const k = ev.key;
  if (k === "Shift" || k === "Control" || k === "Meta" || k === "Alt") return null;
  const parts: string[] = [];
  if (ev.metaKey || ev.ctrlKey) parts.push("Mod");
  if (ev.shiftKey) parts.push("Shift");
  if (ev.altKey) parts.push("Alt");
  let key = k;
  if (k === " ") key = "Space";
  else if (k.length === 1) key = k.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Pretty-print a combo for display. */
export function formatCombo(combo: string): string {
  if (!combo) return "—";
  return combo
    .split("+")
    .map(p => {
      if (p === "Mod") return isMac ? "⌘" : "Ctrl";
      if (p === "Shift") return "⇧";
      if (p === "Alt") return isMac ? "⌥" : "Alt";
      if (p === "ArrowLeft") return "←";
      if (p === "ArrowRight") return "→";
      if (p === "ArrowUp") return "↑";
      if (p === "ArrowDown") return "↓";
      return p;
    })
    .join(isMac ? "" : "+");
}

/** Match an event to an action id from the current bindings. */
export function matchAction(ev: KeyboardEvent, bindings: Record<string, string>): ShortcutActionId | null {
  const c = comboFromEvent(ev);
  if (!c) return null;
  for (const [id, combo] of Object.entries(bindings)) {
    if (combo && combo === c) return id as ShortcutActionId;
  }
  return null;
}

/** Convenience hook: get formatted current shortcut for an action. */
export function useShortcutLabel(id: ShortcutActionId): string {
  const combo = useShortcutsStore(s => s.bindings[id]);
  return formatCombo(combo);
}
