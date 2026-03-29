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

function SessionWaveformThumb({ name, idx }: { name: string; idx: number }) {
  const colors = ["#63b3ed", "#b794f4", "#4fd1c5", "#f59e0b"];
  const color = colors[idx % colors.length];
  return (
    <div className="w-full h-full flex items-center px-1 gap-[0.5px]">
      {Array.from({ length: 40 }, (_, i) => {
        const h = 15 + ((name.charCodeAt(i % name.length) * 17 + i * 31) % 55);
        return (
          <div key={i} className="flex-1" style={{
            height: `${h}%`, background: color, opacity: 0.6, borderRadius: 1
          }} />
        );
      })}
    </div>
  );
}

export default function HomeScreen({ sessions, exports, loading, onOpenSession, onDeleteSession, onNewSong }: HomeScreenProps) {
  const [tab, setTab] = useState<"drafts" | "exports">("drafts");
  const currentSession = sessions[0] || null;
  const otherSessions = sessions.slice(1);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="p-1" onClick={() => toast({ title: "Menu" })}>
          <Menu className="w-6 h-6 text-[#ccc]" />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight">Recording Studio</h1>
      </div>

      {/* Current Session */}
      {currentSession && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Current Session</p>
          <button
            onClick={() => onOpenSession(currentSession)}
            className="w-full rounded-xl overflow-hidden border border-[#333] active:scale-[0.98] transition-transform"
            style={{ background: "#1e1e2e" }}
          >
            <div className="flex items-center gap-3 p-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#333]"
                style={{ background: "#151525" }}>
                <SessionWaveformThumb name={currentSession.name} idx={0} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white">{currentSession.name}</p>
                <p className="text-[11px] text-[#888]">Created {timeAgo(currentSession.created_at)} ago</p>
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

        {!loading && otherSessions.length === 0 && sessions.length <= 1 && (
          <div className="text-center py-6">
            <Music className="w-8 h-8 mx-auto mb-2 text-[#444]" />
            <p className="text-sm text-[#666]">No other sessions yet</p>
          </div>
        )}

        {otherSessions.map((session, idx) => (
          <div key={session.id} className="flex items-center gap-3 group">
            <button
              onClick={() => onOpenSession(session)}
              className="flex-1 flex items-center gap-3 p-2 rounded-xl active:scale-[0.98] transition-transform"
              style={{ background: "#1a1a2e" }}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#333]"
                style={{ background: "#151525" }}>
                <SessionWaveformThumb name={session.name} idx={idx + 1} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">{session.name}</p>
              </div>
              <span className="text-xs text-[#63b3ed] font-semibold">{timeAgo(session.created_at)}</span>
            </button>
            <button
              onClick={() => onDeleteSession(session.id)}
              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4 text-[#666]" />
            </button>
          </div>
        ))}
      </div>

      {/* Drafts / Exports tabs */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setTab("drafts")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === "drafts" ? "bg-[#2a2a3e] text-white border border-[#444]" : "text-[#666] border border-transparent"
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => setTab("exports")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            tab === "exports" ? "bg-[#2a2a3e] text-white border border-[#444]" : "text-[#666] border border-transparent"
          }`}
        >
          Exports
        </button>
      </div>

      {tab === "exports" && exports.length > 0 && (
        <div className="space-y-2">
          {exports.map((exp: any) => (
            <div key={exp.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: "#1a1a2e" }}>
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
