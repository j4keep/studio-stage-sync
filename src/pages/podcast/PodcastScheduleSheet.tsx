// W.STUDIO Podcast — Schedule session modal.
// Local-only. Stores into PodcastSessionStore. Does NOT touch LiveKit/recording.

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Lock, Globe, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  PodcastSessionStore,
  type PodcastVisibility,
  type ScheduledPodcastSession,
} from "./podcastSessionStore";

type Props = {
  open: boolean;
  onClose: () => void;
  hostId: string | null;
  hostName: string;
  /** Optional existing session to edit. */
  editing?: ScheduledPodcastSession | null;
  /** Called with the newly created/updated session. */
  onSaved?: (s: ScheduledPodcastSession) => void;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const todayDateStr = (d = new Date(Date.now() + 30 * 60_000)) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const nowTimeStr = (d = new Date(Date.now() + 30 * 60_000)) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function PodcastScheduleSheet({ open, onClose, hostId, hostName, editing, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayDateStr());
  const [time, setTime] = useState(nowTimeStr());
  const [duration, setDuration] = useState<number>(60);
  const [visibility, setVisibility] = useState<PodcastVisibility>("public");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const d = new Date(editing.scheduledAt);
      setTitle(editing.title);
      setDescription(editing.description);
      setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setDuration(editing.durationMin);
      setVisibility(editing.visibility);
      setPassword(editing.password || "");
    } else {
      setTitle("");
      setDescription("");
      setDate(todayDateStr());
      setTime(nowTimeStr());
      setDuration(60);
      setVisibility("public");
      setPassword("");
    }
  }, [open, editing]);

  const scheduledAt = useMemo(() => {
    const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
    const [h, mi] = time.split(":").map((n) => parseInt(n, 10));
    if (!y || !mo || !d || isNaN(h) || isNaN(mi)) return NaN;
    return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
  }, [date, time]);

  const valid =
    title.trim().length > 0 &&
    !isNaN(scheduledAt) &&
    duration >= 5 &&
    (visibility !== "password" || password.trim().length >= 3);

  const save = () => {
    if (!valid) {
      toast({ title: "Missing info", description: "Title, date, time, and a 3+ char password if password-protected." });
      return;
    }
    if (editing) {
      PodcastSessionStore.update(editing.id, {
        title: title.trim(),
        description,
        scheduledAt,
        durationMin: duration,
        visibility,
        password: visibility === "password" ? password : undefined,
      });
      const updated = PodcastSessionStore.get(editing.id)!;
      toast({ title: "Session updated" });
      onSaved?.(updated);
    } else {
      const created = PodcastSessionStore.create({
        title: title.trim(),
        description,
        hostId,
        hostName,
        scheduledAt,
        durationMin: duration,
        visibility,
        password: visibility === "password" ? password : undefined,
      });
      toast({ title: "Podcast scheduled", description: new Date(scheduledAt).toLocaleString() });
      onSaved?.(created);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur grid place-items-center p-3">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <div className="text-xs uppercase tracking-wider text-purple-300">W.Studio Podcast</div>
            <h2 className="text-lg font-semibold">{editing ? "Edit session" : "Schedule a session"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-800" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Podcast title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Studio Talk Ep. 12" />
          </Field>
          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-purple-500"
              placeholder="What's this episode about?"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" icon={<CalendarDays className="w-3.5 h-3.5" />}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Start time" icon={<Clock className="w-3.5 h-3.5" />}>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>

          <Field label="Expected duration">
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    duration === m
                      ? "bg-purple-500/20 border-purple-500 text-purple-200"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ""}`}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Privacy">
            <div className="grid grid-cols-3 gap-2">
              <PrivacyTile active={visibility === "public"} onClick={() => setVisibility("public")} icon={<Globe className="w-4 h-4" />} title="Public" />
              <PrivacyTile active={visibility === "invite"} onClick={() => setVisibility("invite")} icon={<UserPlus className="w-4 h-4" />} title="Invite only" />
              <PrivacyTile active={visibility === "password"} onClick={() => setVisibility("password")} icon={<Lock className="w-4 h-4" />} title="Password" />
            </div>
            {visibility === "password" && (
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Room password (min 3 chars)"
                className="mt-2"
              />
            )}
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!valid} className="bg-purple-600 hover:bg-purple-500">
            {editing ? "Save changes" : "Schedule session"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

const Field = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-400">
      {icon}{label}
    </span>
    {children}
  </label>
);

const PrivacyTile = ({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 py-3 rounded-lg border text-xs ${
      active
        ? "bg-purple-500/15 border-purple-500 text-purple-200"
        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100"
    }`}
  >
    {icon}
    {title}
  </button>
);
