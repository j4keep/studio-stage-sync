import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStudio } from "../state/StudioContext";
import { useArtistSessionSync } from "../state/sessionSync";
import VideoTile from "../components/VideoTile";
import LevelMeter from "../components/LevelMeter";
import { ArrowRight, Check, Play, Headphones, Music2 } from "lucide-react";

type Step = "welcome" | "perms" | "headphones" | "beat" | "ready";

export default function ArtistJoinPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, createSession, setArtist, toggleCheck, setMicMuted, setCameraOn } = useStudio();
  const { update } = useArtistSessionSync(sessionId);
  const [step, setStep] = useState<Step>("welcome");
  const [permsGranted, setPermsGranted] = useState(false);

  useEffect(() => {
    if (!session && sessionId) {
      createSession({ name: "Live Session", artistName: "Artist", type: "Vocal Recording", engineerName: "Engineer" });
    }
  }, [session, sessionId, createSession]);

  const requestPerms = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      s.getTracks().forEach((t) => t.stop());
      setPermsGranted(true);
      setArtist("connected");
      toggleCheck("artistMic", true);
      update({ joinedAt: Date.now(), micLive: false, cameraOn: true });
    } catch {
      setPermsGranted(false);
    }
  };

  return (
    <div className="min-h-screen px-5 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">W<span className="text-[hsl(var(--studio-blue))]">.</span>STUDIO</h1>
          <p className="text-xs text-[hsl(var(--studio-text-muted))] mt-1">Session: {session?.name ?? "Live Session"}</p>
        </div>

        {step === "welcome" && (
          <div className="studio-card p-6 text-center space-y-4">
            <div className="text-base">Welcome to your W.STUDIO session</div>
            <div className="text-sm text-[hsl(var(--studio-text-dim))]">
              Engineer <span className="text-[hsl(var(--studio-text))] font-medium">{session?.engineerName ?? "Engineer"}</span> is waiting for you.
            </div>
            <button onClick={() => setStep("perms")} className="studio-btn studio-btn-primary w-full">
              Join Session <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "perms" && (
          <div className="studio-card p-5 space-y-4">
            <div className="text-sm font-medium">Camera & Microphone</div>
            <VideoTile name="You" isSelf cameraOn primary />
            <LevelMeter active={permsGranted} label="Mic Level" />
            {!permsGranted ? (
              <button onClick={requestPerms} className="studio-btn studio-btn-primary w-full">Allow Camera & Mic</button>
            ) : (
              <button onClick={() => setStep("headphones")} className="studio-btn studio-btn-primary w-full">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {step === "headphones" && (
          <div className="studio-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Headphones className="w-4 h-4 text-[hsl(var(--studio-blue))]" /> Headphone Check</div>
            <button className="studio-btn studio-btn-primary w-full"><Play className="w-4 h-4" /> Play Test Sound</button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="studio-btn"
                onClick={() => { toggleCheck("artistHeadphones", true); update({ headphonesOk: true }); setStep("beat"); }}
              >
                <Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> I can hear it
              </button>
              <button className="studio-btn" onClick={() => alert("Check your headphone connection.")}>
                I cannot hear it
              </button>
            </div>
          </div>
        )}

        {step === "beat" && (
          <div className="studio-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Music2 className="w-4 h-4 text-[hsl(var(--studio-blue))]" /> Beat Check</div>
            <div className="text-xs text-[hsl(var(--studio-text-dim))]">Wait for the engineer to send beat playback.</div>
            <button
              onClick={() => { toggleCheck("artistHearsBeat", true); update({ artistCanHearBeat: true }); setStep("ready"); }}
              className="studio-btn studio-btn-primary w-full"
            >
              <Check className="w-4 h-4" /> I can hear the track
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="studio-card p-5 space-y-4 text-center">
            <div className="rounded-xl p-4 studio-glow-green bg-[hsl(var(--studio-green)/0.08)] text-[hsl(var(--studio-green))] font-semibold tracking-wide">
              ALL CHECKS COMPLETE
            </div>
            <ul className="text-sm text-left space-y-1.5">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> Camera & microphone granted</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> Headphones confirmed</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> Beat playback heard</li>
            </ul>
            <button
              onClick={() => {
                setArtist("ready");
                setMicMuted(false);
                setCameraOn(true);
                update({ joinedAt: Date.now(), artistReady: true, artistCanHearBeat: true, cameraOn: true });
                navigate(`/studio/artist/${sessionId}`);
              }}
              className="studio-btn studio-btn-primary w-full"
            >
              Ready To Record <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
