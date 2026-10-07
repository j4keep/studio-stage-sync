import { Trophy } from "lucide-react";

export default function BoxingRoundCard({
  round,
  maxRounds,
  show,
}: {
  round: number;
  maxRounds: number;
  show: boolean;
}) {
  if (!show) return null;

  const finalRound = round >= maxRounds;

  return (
    <div className="pointer-events-none absolute inset-0 z-[55] overflow-hidden bg-black/25">
      <style>{`
        @keyframes yaj-ringwalk {
          0% { transform: translate3d(-42vw, 3%, 0) scale(.92); opacity: 0; }
          12% { opacity: 1; }
          42%, 62% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(42vw, 3%, 0) scale(.92); opacity: 0; }
        }
        @keyframes yaj-step-left {
          0%,100% { transform: rotate(8deg); }
          50% { transform: rotate(-10deg); }
        }
        @keyframes yaj-step-right {
          0%,100% { transform: rotate(-8deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes yaj-card-bob {
          0%,100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-5px) rotate(1deg); }
        }
        .yaj-ringwalker { animation: yaj-ringwalk 4.6s ease-in-out both; }
        .yaj-ring-leg-left { transform-origin: 50% 0%; animation: yaj-step-left .55s ease-in-out infinite; }
        .yaj-ring-leg-right { transform-origin: 50% 0%; animation: yaj-step-right .55s ease-in-out infinite; }
        .yaj-round-card { animation: yaj-card-bob .8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .yaj-ringwalker, .yaj-ring-leg-left, .yaj-ring-leg-right, .yaj-round-card { animation: none !important; }
        }
      `}</style>

      <div className="yaj-ringwalker absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-[86%] min-h-[240px] w-[210px] flex-col items-center justify-end">
          <div className="yaj-round-card absolute top-0 z-20 w-[190px] rounded-[22px] border-4 border-amber-200 bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-400 px-4 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-black/55">
              <Trophy className="h-3.5 w-3.5" /> YAJ Boxing
            </div>
            <p className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#17111f] drop-shadow-sm">
              {finalRound ? "FINAL" : "ROUND"}
            </p>
            <p className="mt-1 text-[42px] font-black leading-none text-[#6d28d9] drop-shadow-sm">
              {round}
            </p>
          </div>

          {/* Stylized 3-D ring-card attendant built from layered gradients so it stays lightweight. */}
          <div className="relative mb-3 mt-[94px] h-[210px] w-[104px]">
            <div className="absolute left-1/2 top-0 h-[58px] w-[58px] -translate-x-1/2 rounded-full border border-white/30 bg-[radial-gradient(circle_at_35%_30%,#ffe6d3_0%,#eeb58e_58%,#a96043_100%)] shadow-[0_8px_20px_rgba(0,0,0,.45)]" />
            <div className="absolute left-1/2 top-[-6px] h-[34px] w-[64px] -translate-x-1/2 rounded-t-[38px] rounded-b-[20px] bg-[linear-gradient(135deg,#241612,#684132_55%,#1c1110)] shadow-md" />
            <div className="absolute left-[37px] top-[22px] h-[5px] w-[5px] rounded-full bg-[#171717]" />
            <div className="absolute right-[37px] top-[22px] h-[5px] w-[5px] rounded-full bg-[#171717]" />
            <div className="absolute left-1/2 top-[38px] h-[4px] w-[16px] -translate-x-1/2 rounded-full bg-[#a44856]" />

            <div className="absolute left-1/2 top-[52px] h-[92px] w-[68px] -translate-x-1/2 rounded-[30px_30px_20px_20px] border border-white/20 bg-[linear-gradient(145deg,#7c3aed_0%,#a855f7_40%,#4c1d95_100%)] shadow-[inset_-10px_-12px_18px_rgba(0,0,0,.18),0_14px_28px_rgba(0,0,0,.4)]" />
            <div className="absolute left-[7px] top-[62px] h-[84px] w-[18px] rotate-[10deg] rounded-full bg-[linear-gradient(90deg,#d58f68,#ffd8bc_55%,#b96f50)] shadow-md" />
            <div className="absolute right-[7px] top-[62px] h-[84px] w-[18px] -rotate-[10deg] rounded-full bg-[linear-gradient(90deg,#b96f50,#ffd8bc_55%,#d58f68)] shadow-md" />

            <div className="yaj-ring-leg-left absolute left-[25px] top-[134px] h-[74px] w-[21px] rounded-b-[12px] bg-[linear-gradient(90deg,#b76d4c,#ffd6ba_58%,#b76d4c)] shadow-md" />
            <div className="yaj-ring-leg-right absolute right-[25px] top-[134px] h-[74px] w-[21px] rounded-b-[12px] bg-[linear-gradient(90deg,#b76d4c,#ffd6ba_58%,#b76d4c)] shadow-md" />
            <div className="absolute bottom-[-2px] left-[16px] h-[16px] w-[36px] rounded-[60%_20%_25%_30%] bg-[#16131d] shadow-lg" />
            <div className="absolute bottom-[-2px] right-[16px] h-[16px] w-[36px] rounded-[20%_60%_30%_25%] bg-[#16131d] shadow-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
