import { useNavigate } from "react-router-dom";
import { Radio, Mic2, Eye } from "lucide-react";

export default function StartPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl text-center space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full studio-card-inset text-xs uppercase tracking-widest text-[hsl(var(--studio-blue))] mb-6">
            <span className="studio-status-dot live" /> V2 Prototype
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            W<span className="text-[hsl(var(--studio-blue))]">.</span>STUDIO
          </h1>
          <p className="mt-3 text-[hsl(var(--studio-text-dim))] text-sm leading-relaxed">
            Your virtual recording studio. One link. One session. Real-time collaboration.
          </p>
        </div>

        <div className="studio-card p-6 space-y-3">
          <button onClick={() => navigate("/studio/create")} className="studio-btn studio-btn-primary w-full">
            <Mic2 className="w-4 h-4" /> Create Engineer Session
          </button>
          <button
            onClick={() => {
              const code = window.prompt("Enter session code or paste share link:");
              if (!code) return;
              const id = code.includes("/") ? code.split("/").pop()! : code;
              navigate(`/studio/join/${id}`);
            }}
            className="studio-btn w-full"
          >
            <Radio className="w-4 h-4" /> Join Artist Session
          </button>
          <button onClick={() => navigate("/studio/demo")} className="studio-btn w-full">
            <Eye className="w-4 h-4" /> View Demo Room
          </button>
        </div>

        <div className="text-[11px] text-[hsl(var(--studio-text-muted))]">
          Existing studio is still available at <code>/wstudio</code>.
        </div>
      </div>
    </div>
  );
}
