import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
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

  return (
    <div className="absolute inset-0 z-[8] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.42),rgba(9,9,11,0.95)_58%,#000_100%)] text-white">
      <video ref={videoRef} playsInline muted className="pointer-events-none absolute h-px w-px opacity-0" />

      <div className="absolute inset-x-0 top-[16%] flex flex-col items-center px-6 text-center">
        <div
          className="relative flex h-40 w-40 items-center justify-center"
          style={{
            transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotate}deg) scale(${motion.scale})`,
            transition: "transform 55ms linear",
          }}
        >
          <div className={`absolute inset-2 rounded-[42%] bg-gradient-to-br ${avatar.bg} opacity-45 blur-2xl`} />
          <div className={`relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-[42%] border border-white/25 bg-gradient-to-br ${avatar.bg} shadow-2xl`}>
            {isProfile ? (
              <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="select-none text-[72px] leading-none" aria-hidden>{avatar.emoji}</span>
            )}
            <div
              className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50"
              style={{ width: 18, height: 3 + motion.mouth * 14, opacity: motion.mouth * 0.85 }}
            />
          </div>
        </div>

        <p className="mt-4 text-[20px] font-black tracking-tight">{displayName}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-white/70 backdrop-blur-md">
          <Sparkles className="h-3 w-3" />
          {tracking ? "Face tracking active" : "Avatar preview"}
        </div>
      </div>

      {showPicker && (
        <div className="absolute inset-x-0 bottom-[33%] z-10 px-4">
          <div className="mx-auto max-w-[21rem] rounded-[22px] border border-white/12 bg-black/55 p-3 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[12px] font-black">Choose your avatar</p>
              <p className="text-[9.5px] font-medium text-white/50">Moves with your face</p>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {VIRTUAL_AVATARS.map((item) => {
                const selected = item.id === selectedId;
                const profileThumb = item.id === "profile" && profileAvatarUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectedIdChange?.(item.id)}
                    className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border transition active:scale-95 ${
                      selected ? "border-white bg-white/20 ring-2 ring-white/70" : "border-white/10 bg-white/5"
                    }`}
                    aria-label={`Use ${item.label} avatar`}
                  >
                    {profileThumb ? (
                      <img src={profileAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl" aria-hidden>{item.emoji}</span>
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
