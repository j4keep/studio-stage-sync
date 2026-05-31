import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStudio, SessionType } from "../state/StudioContext";
import { Copy, Check, ArrowRight, Share2 } from "lucide-react";
import ShareSessionSheet from "../components/ShareSessionSheet";

const TYPES: SessionType[] = ["Vocal Recording", "Mix Review", "Podcast", "Songwriting", "Voiceover"];

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const { createSession, session } = useStudio();
  const [name, setName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [type, setType] = useState<SessionType>("Vocal Recording");
  const [engineerName, setEngineerName] = useState("Engineer");
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const shareUrl = session ? `${window.location.origin}/#/studio/join/${session.id}` : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createSession({ name: name.trim(), artistName: artistName.trim() || "Artist", type, engineerName });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        <button onClick={() => navigate("/studio")} className="text-xs text-[hsl(var(--studio-text-muted))] hover:text-[hsl(var(--studio-blue))]">
          ← Back
        </button>
        <h1 className="text-2xl font-bold">Create Engineer Session</h1>

        {!session ? (
          <form onSubmit={submit} className="studio-card p-5 space-y-4">
            <Field label="Session name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="studio-input" placeholder="Vocal session — Sasha" required />
            </Field>
            <Field label="Artist name">
              <input value={artistName} onChange={(e) => setArtistName(e.target.value)} className="studio-input" placeholder="Sasha" />
            </Field>
            <Field label="Engineer name">
              <input value={engineerName} onChange={(e) => setEngineerName(e.target.value)} className="studio-input" />
            </Field>
            <Field label="Session type">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`studio-btn justify-center text-xs ${type === t ? "studio-glow-blue" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <button className="studio-btn studio-btn-primary w-full">Create Session</button>
          </form>
        ) : (
          <div className="studio-card p-5 space-y-4">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Session Code</div>
              <div className="text-4xl font-mono tracking-[0.3em] text-[hsl(var(--studio-blue))] mt-1">{session.code}</div>
            </div>
            <Field label="Share link with artist">
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className="studio-input flex-1 font-mono text-xs" />
                <button type="button" onClick={copy} className="studio-btn">
                  {copied ? <Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <button onClick={() => navigate(`/studio/engineer/${session.id}`)} className="studio-btn studio-btn-primary w-full">
              Enter Control Room <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <style>{`
        [data-studio-app="true"] .studio-input {
          background: hsl(var(--studio-bg) / 0.6);
          border: 1px solid hsl(var(--studio-border-soft));
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          color: hsl(var(--studio-text));
          width: 100%;
          outline: none;
          transition: border-color 160ms;
        }
        [data-studio-app="true"] .studio-input:focus { border-color: hsl(var(--studio-blue)); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-1.5">{label}</div>
      {children}
    </label>
  );
}
