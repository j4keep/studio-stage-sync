import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

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

function loadLocal(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
function persistLocal(bindings: Record<string, string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(bindings)); } catch {}
}

async function persistRemote(bindings: Record<string, string>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ daw_shortcuts: bindings } as any).eq("user_id", user.id);
  } catch {}
}

function defaults(): Record<ShortcutActionId, string> {
  const out = {} as Record<ShortcutActionId, string>;
  for (const a of SHORTCUT_ACTIONS) out[a.id] = a.defaultCombo;
  return out;
}

interface ShortcutsState {
  bindings: Record<ShortcutActionId, string>;
  hydrated: boolean;
  setBinding: (id: ShortcutActionId, combo: string) => void;
  clearBinding: (id: ShortcutActionId) => void;
  resetAll: () => void;
  /** Replace all bindings (used by import). Merges with defaults to keep unknown ids safe. */
  replaceAll: (next: Partial<Record<ShortcutActionId, string>>) => void;
  /** Fetch bindings from the user profile and merge into local state. */
  hydrateFromProfile: () => Promise<void>;
}

function commit(next: Record<ShortcutActionId, string>) {
  persistLocal(next);
  void persistRemote(next);
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  bindings: { ...defaults(), ...(loadLocal() as Record<ShortcutActionId, string>) },
  hydrated: false,
  setBinding: (id, combo) => {
    const next = { ...get().bindings, [id]: combo };
    set({ bindings: next }); commit(next);
  },
  clearBinding: (id) => {
    const next = { ...get().bindings, [id]: "" };
    set({ bindings: next }); commit(next);
  },
  resetAll: () => {
    const d = defaults();
    set({ bindings: d }); commit(d);
  },
  replaceAll: (next) => {
    const merged = { ...defaults(), ...next } as Record<ShortcutActionId, string>;
    set({ bindings: merged }); commit(merged);
  },
  hydrateFromProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ hydrated: true }); return; }
      const { data } = await supabase.from("profiles").select("daw_shortcuts").eq("user_id", user.id).maybeSingle();
      const remote = (data as any)?.daw_shortcuts as Record<string, string> | null | undefined;
      if (remote && typeof remote === "object") {
        const merged = { ...defaults(), ...remote } as Record<ShortcutActionId, string>;
        set({ bindings: merged, hydrated: true });
        persistLocal(merged);
        return;
      }
    } catch {}
    set({ hydrated: true });
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

/** Get the label for an action id. */
export function actionLabel(id: ShortcutActionId): string {
  return SHORTCUT_ACTIONS.find(a => a.id === id)?.label ?? id;
}
