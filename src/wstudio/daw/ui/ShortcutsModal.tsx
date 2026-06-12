import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Keyboard, RotateCcw, X, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  SHORTCUT_ACTIONS,
  useShortcutsStore,
  comboFromEvent,
  formatCombo,
  actionLabel,
  type ShortcutAction,
  type ShortcutActionId,
} from "../state/ShortcutsStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PendingConflict {
  targetId: ShortcutActionId;
  combo: string;
  conflictingId: ShortcutActionId;
}

export function ShortcutsModal({ open, onClose }: Props) {
  const bindings = useShortcutsStore(s => s.bindings);
  const setBinding = useShortcutsStore(s => s.setBinding);
  const clearBinding = useShortcutsStore(s => s.clearBinding);
  const resetAll = useShortcutsStore(s => s.resetAll);
  const replaceAll = useShortcutsStore(s => s.replaceAll);
  const hydrateFromProfile = useShortcutsStore(s => s.hydrateFromProfile);

  const [query, setQuery] = useState("");
  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);
  const [conflict, setConflict] = useState<PendingConflict | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate from user profile when modal opens
  useEffect(() => {
    if (open) void hydrateFromProfile();
  }, [open, hydrateFromProfile]);

  // Group filtered actions
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = SHORTCUT_ACTIONS.filter(a => {
      if (!q) return true;
      const combo = formatCombo(bindings[a.id] ?? "").toLowerCase();
      return a.label.toLowerCase().includes(q)
        || a.group.toLowerCase().includes(q)
        || combo.includes(q)
        || (bindings[a.id] ?? "").toLowerCase().includes(q);
    });
    const map = new Map<string, ShortcutAction[]>();
    for (const a of filtered) {
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    }
    return Array.from(map.entries());
  }, [query, bindings]);

  // Capture key while recording
  useEffect(() => {
    if (!recordingId) return;
    const handler = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.key === "Escape") { setRecordingId(null); return; }
      const combo = comboFromEvent(ev);
      if (!combo) return; // modifier-only, wait for real key

      // Conflict detection
      const existing = Object.entries(bindings).find(
        ([id, c]) => c === combo && id !== recordingId,
      );
      if (existing) {
        setConflict({
          targetId: recordingId,
          combo,
          conflictingId: existing[0] as ShortcutActionId,
        });
        setRecordingId(null);
        return;
      }

      setBinding(recordingId, combo);
      setRecordingId(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId, bindings, setBinding]);

  function confirmReassign() {
    if (!conflict) return;
    clearBinding(conflict.conflictingId);
    setBinding(conflict.targetId, conflict.combo);
    toast.success(`Reassigned ${formatCombo(conflict.combo)} to "${actionLabel(conflict.targetId)}".`);
    setConflict(null);
  }

  function handleExport() {
    const payload = JSON.stringify({ version: 1, bindings }, null, 2);
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wstudio-shortcuts.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      navigator.clipboard?.writeText(payload).catch(() => {});
      toast.success("Shortcuts exported (file downloaded & copied to clipboard).");
    } catch {
      toast.error("Export failed.");
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const next = parsed?.bindings ?? parsed;
        if (!next || typeof next !== "object") throw new Error("Invalid file");
        replaceAll(next);
        toast.success("Shortcuts imported.");
      } catch {
        toast.error("Could not import: invalid JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImportPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast.error("Clipboard is empty."); return; }
      const parsed = JSON.parse(text);
      const next = parsed?.bindings ?? parsed;
      if (!next || typeof next !== "object") throw new Error("Invalid");
      replaceAll(next);
      toast.success("Shortcuts imported from clipboard.");
    } catch {
      toast.error("Clipboard does not contain valid shortcut JSON.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Click a shortcut to record a new key combo. Press Esc while recording to cancel.
              Your bindings sync to your profile when signed in.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 pb-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands or keys…"
                className="h-9 pl-8 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}
              className="h-9 border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              title="Download as JSON & copy to clipboard">
              <Download className="w-3.5 h-3.5 mr-1" /> Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
              className="h-9 border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              title="Import shortcuts from a JSON file">
              <Upload className="w-3.5 h-3.5 mr-1" /> Import file
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleImportPaste}
              className="h-9 border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              title="Paste shortcut JSON from clipboard">
              Paste
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { resetAll(); toast.success("Shortcuts reset to defaults."); }}
              className="h-9 border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              title="Reset all shortcuts to factory defaults">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
            {groups.length === 0 && (
              <div className="text-center text-neutral-500 py-8 text-sm">No commands match "{query}".</div>
            )}
            {groups.map(([group, actions]) => (
              <div key={group}>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5 px-1">{group}</div>
                <div className="rounded-md border border-neutral-800 divide-y divide-neutral-800/80">
                  {actions.map(a => {
                    const combo = bindings[a.id] ?? "";
                    const isRecording = recordingId === a.id;
                    return (
                      <div key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-900/60">
                        <div className="flex-1 text-sm text-neutral-200">{a.label}</div>
                        <button
                          type="button"
                          onClick={() => setRecordingId(isRecording ? null : a.id)}
                          className={`min-w-[110px] h-8 px-3 rounded-md border text-xs font-mono tracking-wider transition ${
                            isRecording
                              ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200 animate-pulse"
                              : "bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-cyan-500/40 hover:text-cyan-200"
                          }`}
                          title={isRecording ? "Press a key combo… (Esc to cancel)" : "Click to record a new shortcut"}
                        >
                          {isRecording ? "Press key…" : (combo ? formatCombo(combo) : "Unassigned")}
                        </button>
                        {combo && !isRecording && (
                          <button
                            type="button"
                            onClick={() => clearBinding(a.id)}
                            className="h-8 w-8 grid place-items-center rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-900"
                            title={`Clear shortcut for "${a.label}"`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!conflict} onOpenChange={(o) => { if (!o) setConflict(null); }}>
        <AlertDialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Shortcut already in use</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              {conflict && (
                <>
                  <span className="font-mono text-cyan-300">{formatCombo(conflict.combo)}</span> is
                  currently assigned to{" "}
                  <span className="font-medium text-neutral-200">"{actionLabel(conflict.conflictingId)}"</span>.
                  Reassign it to <span className="font-medium text-neutral-200">"{actionLabel(conflict.targetId)}"</span>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
              onClick={() => setConflict(null)}
            >Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cyan-500 text-neutral-950 hover:bg-cyan-400"
              onClick={confirmReassign}
            >Reassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
