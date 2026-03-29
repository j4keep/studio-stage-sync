import { useState } from "react";
import { Menu, MoreHorizontal, X, Music, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SessionRecord {
  id: string;
  name: string;
  beat_url: string | null;
  beat_name: string | null;
  cover_url: string | null;
  is_draft: boolean;
  created_at: string;
  takesCount?: number;
}

interface HomeScreenProps {
  sessions: SessionRecord[];
  exports: any[];
  loading: boolean;
  onOpenSession: (session: SessionRecord) => void;
  onDeleteSession: (id: string) => void;
  onNewSong: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/* Colored waveform bar visualization for session thumbnails */
function SessionWaveformThumb({ name, idx, small }: { name: string; idx: number; small?: boolean }) {
  const colors = ["#63b3ed", "#b794f4", "#4fd1c5", "#f59e0b"];
  const color = colors[idx % colors.length];
  const count = small ? 50 : 60;
  return (
    <div className="w-full h-full flex items-end px-1 gap-[0.5px]">
      {Array.from({ length: count }, (_, i) => {
        const h = 10 + ((name.charCodeAt(i % name.length) * 17 + i * 31) % 65);
        return (
          <div key={i} className="flex-1" style={{
            height: `${h}%`, background: color, opacity: 0.7, borderRadius: 1
          }} />
        );
      })}
    </div>
  );
}

/* Inline waveform that spans across the session row */
function InlineWaveform({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center h-5 gap-[0.3px] flex-1">
      {Array.from({ length: 80 }, (_, i) => {
        const h = 15 + ((name.charCodeAt(i % name.length) * 13 + i * 29) % 70);
        return (
          <div key={i} className="flex-1" style={{
            height: `${h}%`, background: color, opacity: 0.6, borderRadius: 0.5, minWidth: 1
          }} />
        );
      })}
    </div>
  );
}

export default function HomeScreen({ sessions, exports, loading, onOpenSession, onDeleteSession, onNewSong }: HomeScreenProps) {
  const [tab, setTab] = useState<"drafts" | "exports">("drafts");
  const currentSession = sessions[0] || null;
  const otherSessions = sessions.slice(0);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const getCoverUrl = (key: string) => `${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="p-1" onClick={() => toast({ title: "Menu" })}>
          <Menu className="w-6 h-6 text-[#ccc]" />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight">Recording Studio</h1>
      </div>

      {/* Current Session - hero card */}
      {currentSession && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Current Session</p>
          <button
            onClick={() => onOpenSession(currentSession)}
            className="w-full rounded-2xl overflow-hidden border border-[#333] active:scale-[0.98] transition-transform"
            style={{ background: "#1e1e2e" }}
          >
            <div className="flex items-center gap-3 p-3">
              {/* Cover art thumbnail */}
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#333]"
                style={{ background: "#151525" }}>
                {currentSession.cover_url ? (
                  <img src={getCoverUrl(currentSession.cover_url)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <SessionWaveformThumb name={currentSession.name} idx={0} />
                )}
              </div>
              <div className="flex-1 text-left space-y-1">
                <p className="text-sm font-bold text-white">{currentSession.name}</p>
                <p className="text-[11px] text-[#888]">Created {timeAgo(currentSession.created_at)} ago</p>
                {/* Progress bar */}
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#333" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, (currentSession.takesCount || 0) * 25 + 20)}%`,
                    background: "linear-gradient(90deg, #63b3ed, #3b82f6)"
                  }} />
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); toast({ title: "Options" }); }}
                className="p-1">
                <MoreHorizontal className="w-5 h-5 text-[#666]" />
              </button>
            </div>
          </button>
        </div>
      )}

      {/* My Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">My Sessions</h2>
          <button onClick={() => toast({ title: "Close" })}>
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        {/* New Song button */}
        <button
          onClick={onNewSong}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[#444] active:scale-[0.98] transition-transform"
          style={{ background: "#1a1a2e" }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#2a2a3e" }}>
            <Plus className="w-5 h-5 text-[#63b3ed]" />
          </div>
          <span className="text-sm font-semibold text-[#ccc]">New Song</span>
        </button>

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#63b3ed] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && otherSessions.length === 0 && (
          <div className="text-center py-6">
            <Music className="w-8 h-8 mx-auto mb-2 text-[#444]" />
            <p className="text-sm text-[#666]">No sessions yet</p>
          </div>
        )}

        {/* Session rows with cover + inline waveform */}
        {otherSessions.map((session, idx) => {
          const waveColors = ["#63b3ed", "#22c55e", "#b794f4", "#f59e0b"];
          const waveColor = waveColors[idx % waveColors.length];
          return (
            <div key={session.id} className="flex items-center gap-3 group">
              <button
                onClick={() => onOpenSession(session)}
                className="flex-1 flex items-center gap-3 p-2.5 rounded-xl active:scale-[0.98] transition-transform border border-[#333]"
                style={{ background: "#1a1a2e" }}
              >
                {/* Cover art */}
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#333]"
                  style={{ background: "#151525" }}>
                  {session.cover_url ? (
                    <img src={getCoverUrl(session.cover_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SessionWaveformThumb name={session.name} idx={idx + 1} small />
                  )}
                </div>
                {/* Name + waveform */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate">{session.name}</p>
                    <span className="text-xs font-semibold shrink-0 ml-2" style={{ color: waveColor }}>
                      {timeAgo(session.created_at)}
                    </span>
                  </div>
                  <InlineWaveform name={session.name} color={waveColor} />
                </div>
              </button>
              <button
                onClick={() => onDeleteSession(session.id)}
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Drafts / Exports tabs */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setTab("drafts")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === "drafts" ? "bg-[#2a2a3e] text-white border border-[#444]" : "text-[#666] border border-[#333]"
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => setTab("exports")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === "exports" ? "bg-[#2a2a3e] text-white border border-[#444]" : "text-[#666] border border-[#333]"
          }`}
        >
          Exports
        </button>
      </div>

      {tab === "exports" && exports.length > 0 && (
        <div className="space-y-2">
          {exports.map((exp: any) => (
            <div key={exp.id} className="flex items-center gap-3 p-2 rounded-xl border border-[#333]" style={{ background: "#1a1a2e" }}>
              <Music className="w-4 h-4 text-[#63b3ed]" />
              <span className="text-sm text-[#ccc] flex-1 truncate">{exp.title}</span>
              <span className="text-[10px] text-[#666]">{timeAgo(exp.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
