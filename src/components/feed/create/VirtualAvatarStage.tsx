import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { loadFaceLandmarker } from "@/hooks/useFaceFilters";

export type VirtualAvatarId = "nova" | "pulse" | "muse" | "astro" | "zen" | "profile";

export const VIRTUAL_AVATARS: { id: VirtualAvatarId; label: string; emoji: string; bg: string }[] = [
  { id: "nova", label: "Nova", emoji: "🧑🏽‍🚀", bg: "from-violet-500 to-fuchsia-700" },
  { id: "pulse", label: "Pulse", emoji: "🧑🏾‍🎤", bg: "from-cyan-500 to-blue-700" },
  { id: "muse", label: "Muse", emoji: "🧑🏻‍🎨", bg: "from-rose-500 to-orange-600" },
  { id: "astro", label: "Astro", emoji: "🤖", bg: "from-slate-400 to-slate-700" },
  { id: "zen", label: "Zen", emoji: "🧑🏿‍💻", bg: "from-emerald-500 to-teal-700" },
  { id: "profile", label: "You", emoji: "🙂", bg: "from-purple-500 to-indigo-700" },
];

type Motion = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  mouth: number;
};

const DEFAULT_MOTION: Motion = { x: 0, y: 0, rotate: 0, scale: 1, mouth: 0 };

interface Props {
  videoTrack?: MediaStreamTrack | null;
  displayName: string;
  profileAvatarUrl?: string;
  selectedId: VirtualAvatarId;
  onSelectedIdChange?: (id: VirtualAvatarId) => void;
  showPicker?: boolean;
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
          if (video.readyState >= 2 && now - lastDetectRef.current > 45) {
            lastDetectRef.current = now;
            try {
              const result = landmarker.detectForVideo(video, now);
              const lm = result?.faceLandmarks?.[0];
              if (lm?.length > 291) {
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
                const mouthOpen = Math.min(1, Math.max(0, Math.abs(mouthBottom.y - mouthTop.y) / faceHeight * 7));

                setMotion((prev) => ({
                  x: prev.x * 0.72 + (0.5 - nose.x) * 92 * 0.28,
                  y: prev.y * 0.72 + (nose.y - 0.48) * 82 * 0.28,
                  rotate: prev.rotate * 0.7 + (Math.atan2(eyeDy, eyeDx) * 180 / Math.PI) * 0.3,
                  scale: prev.scale * 0.75 + Math.min(1.18, Math.max(0.88, eyeDist / 0.27)) * 0.25,
                  mouth: prev.mouth * 0.6 + mouthOpen * 0.4,
                }));
              }
            } catch {
              // A single bad frame should not stop the avatar.
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

  const isProfile = selectedId === "profile" && !!profileAvatarUrl;

  const picker = pickerOpen && typeof document !== "undefined"
    ? createPortal(
        <div className="fixed inset-0 z-[250] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setPickerOpen(false)}>
          <div
            className="w-full rounded-t-[28px] border-t border-white/15 bg-zinc-950 px-4 pb-[calc(max(env(safe-area-inset-bottom),1rem)+1rem)] pt-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[17px] font-black tracking-tight">Choose your avatar</p>
                <p className="mt-0.5 text-[11px] font-medium text-white/50">Pick a look for your Virtual Live.</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Close avatar picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {VIRTUAL_AVATARS.map((item) => {
                const selected = item.id === selectedId;
                const profileThumb = item.id === "profile" && profileAvatarUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectedIdChange?.(item.id);
                      setPickerOpen(false);
                    }}
                    className={`relative flex min-h-[112px] flex-col items-center justify-center overflow-hidden rounded-2xl border px-2 py-3 transition active:scale-[0.98] ${
                      selected ? "border-white bg-white/15 ring-2 ring-white/70" : "border-white/10 bg-white/[0.055]"
                    }`}
                    aria-label={`Use ${item.label} avatar`}
                  >
                    <div className={`mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${item.bg}`}>
                      {profileThumb ? (
                        <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl" aria-hidden>{item.emoji}</span>
                      )}
                    </div>
                    <span className="text-[12px] font-black">{item.label}</span>
                    {selected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="absolute inset-0 z-[8] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.42),rgba(9,9,11,0.95)_58%,#000_100%)] text-white">
      <video ref={videoRef} playsInline muted className="pointer-events-none absolute h-px w-px opacity-0" />

      <div className="absolute inset-x-0 top-[11%] flex flex-col items-center px-6 text-center">
        <div
          className="relative flex h-[19rem] w-[13rem] items-center justify-center"
          style={{
            transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotate}deg) scale(${motion.scale})`,
            transition: "transform 55ms linear",
          }}
        >
          <div className={`absolute inset-5 rounded-[35%] bg-gradient-to-br ${avatar.bg} opacity-35 blur-3xl`} />
          <div className="relative flex h-[18rem] w-[12rem] flex-col items-center">
            <div className="relative z-20 mt-1 h-[5.7rem] w-[5.7rem] rounded-[44%] bg-[#9f6228] shadow-lg">
              <div className="absolute left-1/2 top-0 h-5 w-[5.3rem] -translate-x-1/2 rounded-[55%] bg-zinc-900" />
              <div className="absolute left-[1.25rem] top-[2.2rem] h-3 w-3 rounded-full bg-white">
                <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-zinc-950" />
              </div>
              <div className="absolute right-[1.25rem] top-[2.2rem] h-3 w-3 rounded-full bg-white">
                <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-zinc-950" />
              </div>
              <div className="absolute left-1/2 top-[3.35rem] h-3 w-[0.45rem] -translate-x-1/2 rounded-full bg-[#8a501f]" />
              <div
                className="absolute left-1/2 top-[4.25rem] -translate-x-1/2 rounded-full bg-zinc-900 transition-[height,width] duration-75"
                style={{ width: `${1.35 + motion.mouth * 0.55}rem`, height: `${0.18 + motion.mouth * 0.7}rem` }}
              />
            </div>
            <div className={`relative z-10 -mt-1 h-[8.7rem] w-[7.8rem] rounded-[38%] border border-white/15 bg-gradient-to-br ${avatar.bg} shadow-2xl`}>
              <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/20 px-3 py-1 text-[10px] font-black tracking-[0.16em]">YAJ</div>
            </div>
            <div className="absolute left-[0.85rem] top-[6.5rem] h-[8rem] w-[1.8rem] rotate-[8deg] rounded-full bg-[#9f6228]" />
            <div className="absolute right-[0.85rem] top-[6.5rem] h-[8rem] w-[1.8rem] -rotate-[8deg] rounded-full bg-[#9f6228]" />
            <div className="absolute bottom-0 left-[3.35rem] h-[6.8rem] w-[2.3rem] rounded-b-[1rem] bg-zinc-800" />
            <div className="absolute bottom-0 right-[3.35rem] h-[6.8rem] w-[2.3rem] rounded-b-[1rem] bg-zinc-800" />
          </div>
        </div>

        <p className="-mt-2 text-[20px] font-black tracking-tight">{displayName}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur-md">
          <Sparkles className="h-3 w-3" />
          {tracking ? "Face tracking active" : "Avatar preview"}
        </div>

        {showPicker && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-3 flex min-w-[12rem] items-center justify-between gap-3 rounded-full border border-white/15 bg-black/45 px-4 py-2.5 text-left shadow-lg backdrop-blur-md active:scale-[0.98]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatar.bg} text-lg`}>
                {isProfile && profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <span aria-hidden>{avatar.emoji}</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-medium text-white/45">Avatar</span>
                <span className="block truncate text-[12px] font-black">{avatar.label}</span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
          </button>
        )}
      </div>

      {picker}
    </div>
  );
}
