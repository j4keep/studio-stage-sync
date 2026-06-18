import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Mic } from "lucide-react";

/**
 * Magic-link guest landing page. ProtectedRoutes already enforces auth,
 * so by the time the user lands here they are signed in to WHEUAT. We
 * confirm the join, then drop them into the live podcast studio with the
 * session code in the URL.
 */
export default function PodcastJoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !code) return;
    try { sessionStorage.setItem("wheuat:podcast:joinCode", code); } catch {}
  }, [user, code]);

  const enter = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch { /* user can grant later from the sidebar */ }
    navigate(`/tv/podcast?session=${encodeURIComponent(code || "")}`);
  };

  return (
    <div className="min-h-screen bg-black text-white grid place-items-center px-6">
      <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-cyan-500/15 grid place-items-center mx-auto mb-3">
          <Mic className="w-6 h-6 text-cyan-300" />
        </div>
        <h1 className="text-lg font-semibold mb-1">Join the podcast</h1>
        <p className="text-[12px] text-neutral-400 mb-1">Session code</p>
        <div className="text-[20px] font-mono tracking-widest text-cyan-300 mb-4">{code}</div>
        <p className="text-[12px] text-neutral-500 mb-5">
          You're signed in as <span className="text-neutral-200">{user?.email || "guest"}</span>.
          We'll ask for camera and mic access before you enter the room.
        </p>
        <button
          onClick={enter}
          className="w-full h-10 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
        >
          Join session
        </button>
        <button
          onClick={() => navigate("/tv")}
          className="w-full h-9 mt-2 rounded-lg text-xs text-neutral-400 hover:text-neutral-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
