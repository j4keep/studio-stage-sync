import { useNavigate } from "react-router-dom";
import { useSession } from "./SessionContext";

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const { joinAsArtist, joinAsEngineer } = useSession();

  const handleJoin = (role: "artist" | "engineer") => {
    if (role === "artist") joinAsArtist();
    else joinAsEngineer();
    navigate("/wstudio/session/live");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#111113] text-zinc-100">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-black tracking-tight text-white">
          W.<span className="text-white">STUDIO</span>
        </span>
        <span className="text-sm font-light tracking-wide text-zinc-500">RECEIVE</span>
      </div>
      <p className="text-sm text-zinc-500">Select your role to join the session</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleJoin("engineer")}
          className="rounded border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Join as Engineer
        </button>
        <button
          onClick={() => handleJoin("artist")}
          className="rounded border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Join as Artist
        </button>
      </div>
    </div>
  );
}
