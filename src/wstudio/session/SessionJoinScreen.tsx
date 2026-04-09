import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "./SessionContext";
import { WSTUDIO_QUICK_JOIN, generateMockSessionId } from "./demoConfig";
import { quickSessionExists, registerQuickSession } from "./quickSessionRegistry";

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const { joinAsArtist, joinAsEngineer } = useSession();
  const [sessionIdInput, setSessionIdInput] = useState("");

  const trimmedInput = sessionIdInput.trim();
  const joinHint = useMemo(() => {
    if (!WSTUDIO_QUICK_JOIN) return null;
    if (!trimmedInput) {
      return { label: "New session", detail: "A new session ID will be created when you join." };
    }
    if (quickSessionExists(trimmedInput)) {
      return { label: "Join existing", detail: "This ID is already registered — you’ll join the same room (e.g. second tab)." };
    }
    return { label: "Create new", detail: "This ID isn’t in use yet — a new session will be created with it." };
  }, [trimmedInput]);

  const resolveQuickSessionId = (): string => {
    if (!trimmedInput) {
      const id = generateMockSessionId();
      registerQuickSession(id);
      return id;
    }
    const id = trimmedInput;
    if (!quickSessionExists(id)) {
      registerQuickSession(id);
    }
    return id;
  };

  const handleQuickJoin = (role: "artist" | "engineer") => {
    if (!WSTUDIO_QUICK_JOIN) {
      if (role === "artist") joinAsArtist();
      else joinAsEngineer();
      navigate("/wstudio/session/live");
      return;
    }
    const id = resolveQuickSessionId();
    if (role === "artist") joinAsArtist(id);
    else joinAsEngineer(id);
    navigate("/wstudio/session/live");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#111113] px-4 py-10 text-zinc-100">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-white">
            W.<span className="text-white">STUDIO</span>
          </span>
          <span className="text-sm font-light tracking-wide text-zinc-500">RECEIVE</span>
        </div>
        {WSTUDIO_QUICK_JOIN ? (
          <span className="rounded border border-amber-900/40 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
            Quick join — testing only
          </span>
        ) : null}
      </div>

      {WSTUDIO_QUICK_JOIN ? (
        <div className="flex w-full max-w-md flex-col gap-3">
          <label htmlFor="quick-session-id" className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Session ID
          </label>
          <input
            id="quick-session-id"
            type="text"
            autoComplete="off"
            placeholder='e.g. test-room-1 — leave empty for auto-generated ID'
            value={sessionIdInput}
            onChange={(e) => setSessionIdInput(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-zinc-600 focus:border-zinc-500"
          />
          {joinHint ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
              <span className="font-semibold text-zinc-300">{joinHint.label}</span>
              <span className="mt-1 block text-zinc-500">{joinHint.detail}</span>
            </div>
          ) : null}
          <p className="text-[11px] leading-relaxed text-zinc-600">
            No booking required. Use the same Session ID in two browser tabs to pair engineer and artist for WebRTC tests.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Select your role to join the session</p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => handleQuickJoin("engineer")}
          className="rounded border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Join as Engineer
        </button>
        <button
          type="button"
          onClick={() => handleQuickJoin("artist")}
          className="rounded border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Join as Artist
        </button>
      </div>
    </div>
  );
}
