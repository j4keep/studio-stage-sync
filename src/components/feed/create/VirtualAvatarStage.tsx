import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { loadFaceLandmarker } from "@/hooks/useFaceFilters";

export type VirtualAvatarId = "nova" | "pulse" | "muse" | "astro" | "zen" | "profile";

type AvatarSpec = {
  id: VirtualAvatarId;
  label: string;
  skin: string;
  hair: string;
  shirt: string;
  accent: string;
  robot?: boolean;
};

export const VIRTUAL_AVATARS: AvatarSpec[] = [
  { id: "nova", label: "Nova", skin: "#8d5524", hair: "#171717", shirt: "#7c3aed", accent: "#d946ef" },
  { id: "pulse", label: "Pulse", skin: "#5b3427", hair: "#111827", shirt: "#0891b2", accent: "#22d3ee" },
  { id: "muse", label: "Muse", skin: "#f1c27d", hair: "#6b3f2d", shirt: "#e11d48", accent: "#fb923c" },
  { id: "astro", label: "Astro", skin: "#94a3b8", hair: "#334155", shirt: "#475569", accent: "#cbd5e1", robot: true },
  { id: "zen", label: "Zen", skin: "#3b241c", hair: "#09090b", shirt: "#059669", accent: "#2dd4bf" },
  { id: "profile", label: "You", skin: "#a47149", hair: "#18181b", shirt: "#6d28d9", accent: "#a78bfa" },
];

type Motion = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  mouth: number;
  blinkL: number;
  blinkR: number;
};

const DEFAULT_MOTION: Motion = {
  x: 0,
  y: 0,
  rotate: 0,
  scale: 1,
  mouth: 0,
  blinkL: 0,
  blinkR: 0,
};

interface Props {
  videoTrack?: MediaStreamTrack | null;
  displayName: string;
  profileAvatarUrl?: string;
  selectedId: VirtualAvatarId;
  onSelectedIdChange?: (id: VirtualAvatarId) => void;
  showPicker?: boolean;
}

function eyeBlinkAmount(lm: { x: number; y: number }[], top: number, bottom: number, outer: number, inner: number) {
  const vertical = Math.abs(lm[top].y - lm[bottom].y);
  const horizontal = Math.max(0.001, Math.abs(lm[outer].x - lm[inner].x));
  const openness = vertical / horizontal;
  return Math.max(0, Math.min(1, (0.14 - openness) / 0.08));
}

function AvatarBody({ avatar, motion }: { avatar: AvatarSpec; motion: Motion }) {
  const eyeScaleL = Math.max(0.08, 1 - motion.blinkL * 0.92);
  const eyeScaleR = Math.max(0.08, 1 - motion.blinkR * 0.92);
  const mouthHeight = 5 + motion.mouth * 19;
  const armSwing = Math.max(-8, Math.min(8, motion.x * 0.08));

  return (
    <div className="relative h-[360px] w-[220px] select-none" aria-hidden>
      <div
        className="absolute left-1/2 top-0 z-20 h-[118px] w-[102px] -translate-x-1/2 rounded-[46%_46%_43%_43%] border border-black/10 shadow-xl"
        style={{ background: avatar.robot ? "#cbd5e1" : avatar.skin }}
      >
        <div
          className="absolute -left-1 -right-1 -top-1 h-[42px] rounded-[50%_50%_34%_34%]"
          style={{ background: avatar.hair }}
        />
        {avatar.robot && <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,.9)]" />}
        <div className="absolute left-[21px] top-[51px] h-[13px] w-[19px] rounded-full bg-white shadow-inner" style={{ transform: `scaleY(${eyeScaleL})` }}>
          <span className="absolute left-[7px] top-[4px] h-[6px] w-[6px] rounded-full bg-zinc-900" />
        </div>
        <div className="absolute right-[21px] top-[51px] h-[13px] w-[19px] rounded-full bg-white shadow-inner" style={{ transform: `scaleY(${eyeScaleR})` }}>
          <span className="absolute left-[6px] top-[4px] h-[6px] w-[6px] rounded-full bg-zinc-900" />
        </div>
        <div className="absolute left-1/2 top-[68px] h-[13px] w-[7px] -translate-x-1/2 rounded-full bg-black/10" />
        <div
          className="absolute left-1/2 top-[87px] w-[30px] -translate-x-1/2 rounded-[45%] border border-black/20 bg-[#351c1c] transition-[height] duration-75"
          style={{ height: mouthHeight }}
        >
          {motion.mouth > 0.2 && <div className="absolute inset-x-1 top-0 h-[3px] rounded-b bg-white/85" />}
        </div>
      </div>

      <div
        className="absolute left-1/2 top-[105px] z-10 h-[165px] w-[150px] -translate-x-1/2 rounded-[38%_38%_24%_24%] border border-white/15 shadow-2xl"
        style={{ background: `linear-gradient(145deg, ${avatar.accent}, ${avatar.shirt} 48%, #111827)` }}
      >
        <div className="absolute left-1/2 top-9 -translate-x-1/2 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-white/90">YAJ</div>
      </div>

      <div
        className="absolute left-[12px] top-[120px] h-[150px] w-[36px] origin-top rounded-full border border-black/10 shadow-lg"
        style={{ background: avatar.robot ? "#94a3b8" : avatar.skin, transform: `rotate(${13 + armSwing}deg)` }}
      />
      <div
        className="absolute right-[12px] top-[120px] h-[150px] w-[36px] origin-top rounded-full border border-black/10 shadow-lg"
        style={{ background: avatar.robot ? "#94a3b8" : avatar.skin, transform: `rotate(${-13 + armSwing}deg)` }}
      />

      <div className="absolute left-[48px] top-[250px] h-[105px] w-[52px] rounded-[22px_22px_12px_12px] bg-zinc-800 shadow-xl" />
      <div className="absolute right-[48px] top-[250px] h-[105px] w-[52px] rounded-[22px_22px_12px_12px] bg-zinc-800 shadow-xl" />
      <div className="absolute bottom-0 left-[38px] h-[22px] w-[72px] rounded-[16px_18px_6px_6px] bg-zinc-950" />
      <div className="absolute bottom-0 right-[38px] h-[22px] w-[72px] rounded-[18px_16px_6px_6px] bg-zinc-950" />
    </div>
  );
}

export default function VirtualAvatarStage({
  videoTrack,
  displayName,
  profileAvatarUrl,
  selectedId,
  onSelectedIdChange,
  showPicker = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const [motion, setMotion] = useState<Motion>(DEFAULT_MOTION);
  const [tracking, setTracking] = useState(false);

  const avatar = useMemo(
    () => VIRTUAL_AVATARS.find((item) => item.id === selectedId) ?? VIRTUAL_AVATARS[0],
    [selectedId],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoTrack) return;
    video.srcObject = new MediaStream([videoTrack]);
    void video.play().catch(() => {});
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [videoTrack]);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video || !videoTrack) {
      setTracking(false);
      setMotion(DEFAULT_MOTION);
      return;
    }

    void (async () => {
      try {
        const landmarker = await loadFaceLandmarker();
        if (cancelled) return;
        setTracking(true);

        const tick = () => {
          if (cancelled) return;
          const now = performance.now();
          if (video.readyState >= 2 && now - lastDetectRef.current > 40) {
            lastDetectRef.current = now;
            try {
              const result = landmarker.detectForVideo(video, now);
              const lm = result?.faceLandmarks?.[0];
              if (lm?.length > 386) {
                const leftEye = lm[33];
                const rightEye = lm[263];
                const nose = lm[1];
                const chin = lm[152];
                const forehead = lm[10];
                const mouthTop = lm[13];
                const mouthBottom = lm[14];
                const eyeDx = rightEye.x - leftEye.x;
                const eyeDy = rightEye.y - leftEye.y;
                const eyeDist = Math.max(0.001, Math.hypot(eyeDx, eyeDy));
                const faceHeight = Math.max(0.001, Math.abs(chin.y - forehead.y));
                const mouthOpen = Math.min(1, Math.max(0, Math.abs(mouthBottom.y - mouthTop.y) / faceHeight * 7.5));
                const blinkL = eyeBlinkAmount(lm, 159, 145, 33, 133);
                const blinkR = eyeBlinkAmount(lm, 386, 374, 263, 362);

                setMotion((prev) => ({
                  x: prev.x * 0.7 + (0.5 - nose.x) * 120 * 0.3,
                  y: prev.y * 0.72 + (nose.y - 0.47) * 95 * 0.28,
                  rotate: prev.rotate * 0.7 + (Math.atan2(eyeDy, eyeDx) * 180 / Math.PI) * 0.3,
                  scale: prev.scale * 0.76 + Math.min(1.12, Math.max(0.9, eyeDist / 0.27)) * 0.24,
                  mouth: prev.mouth * 0.52 + mouthOpen * 0.48,
                  blinkL: prev.blinkL * 0.45 + blinkL * 0.55,
                  blinkR: prev.blinkR * 0.45 + blinkR * 0.55,
                }));
              }
            } catch {
              // Ignore a bad frame and keep tracking.
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setTracking(false);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [videoTrack]);

  return (
    <div className="absolute inset-0 z-[8] overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.52),rgba(28,15,52,0.94)_48%,#030303_100%)] text-white">
      <video ref={videoRef} playsInline muted className="pointer-events-none absolute h-px w-px opacity-0" />

      <div className="absolute inset-x-0 top-[9%] flex flex-col items-center px-6 text-center">
        <div
          className="relative h-[330px] w-[220px] origin-center"
          style={{
            transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotate * 0.55}deg) scale(${motion.scale})`,
            transition: "transform 45ms linear",
          }}
        >
          <div className="absolute inset-x-5 top-5 bottom-6 rounded-[45%] bg-violet-500/25 blur-3xl" />
          <AvatarBody avatar={avatar} motion={motion} />
        </div>

        <p className="-mt-1 text-[20px] font-black tracking-tight">{displayName}</p>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white/75 backdrop-blur-md">
          <Sparkles className="h-3 w-3" />
          {tracking ? "Face + mouth tracking active" : "Position your face in the camera"}
        </div>
      </div>

      {showPicker && (
        <div className="absolute inset-x-0 top-[55%] z-10 px-4">
          <div className="mx-auto max-w-[21rem] rounded-[22px] border border-white/15 bg-black/65 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[12px] font-black">Choose avatar</p>
              <p className="text-[9.5px] font-medium text-white/50">Face · eyes · mouth</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {VIRTUAL_AVATARS.map((item) => {
                const selected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectedIdChange?.(item.id)}
                    className={`relative flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition active:scale-95 ${
                      selected ? "border-white bg-white/20 ring-2 ring-white/70" : "border-white/10 bg-white/5"
                    }`}
                    aria-label={`Use ${item.label} avatar`}
                  >
                    {item.id === "profile" && profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="relative h-12 w-9">
                        <span className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full" style={{ background: item.robot ? "#cbd5e1" : item.skin }} />
                        <span className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-t-[45%]" style={{ background: item.shirt }} />
                      </div>
                    )}
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
