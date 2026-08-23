import { RotateCcw } from "lucide-react";

type Props = {
  checkpoint: number;
  onRetry: () => void;
  onGiveUp: () => void;
};

/**
 * Lightweight caught-state scene. This deliberately uses CSS shapes instead of another
 * WebGL canvas so the lose overlay stays reliable on mobile Safari while still feeling
 * like a real animated game moment.
 */
export default function SugarRushCaughtScene({ checkpoint, onRetry, onGiveUp }: Props) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#100817]/88 px-4 py-5 backdrop-blur-[5px]">
      <div className="sr-dentist-card relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-b from-[#4b2776] via-[#30184f] to-[#1b102c] px-5 pb-6 pt-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.6)]">
        <div className="pointer-events-none absolute -left-10 top-8 h-28 w-28 rounded-full bg-fuchsia-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-20 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />

        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.26em] text-pink-200/75">Candy City Dental Emergency</div>

        <div className="sr-dentist-scene relative mx-auto h-[230px] w-full max-w-[430px] overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_12%,rgba(255,226,148,.18),transparent_32%),linear-gradient(180deg,#21122f_0%,#160d22_100%)]">
          {/* exam lamp */}
          <div className="sr-exam-lamp absolute left-1/2 top-3 -translate-x-1/2">
            <div className="mx-auto h-8 w-3 rounded-full bg-zinc-400" />
            <div className="relative -mt-1 h-9 w-20 rounded-[55%_55%_45%_45%] border-2 border-zinc-300/70 bg-zinc-700 shadow-[0_8px_28px_rgba(255,241,180,.32)]">
              <div className="absolute inset-x-2 bottom-1 h-3 rounded-full bg-yellow-100/80 blur-[1px]" />
            </div>
            <div className="sr-lamp-beam pointer-events-none absolute left-1/2 top-10 h-28 w-28 -translate-x-1/2 bg-[conic-gradient(from_170deg_at_50%_0%,transparent_0deg,rgba(255,245,187,.14)_22deg,rgba(255,245,187,.04)_46deg,transparent_70deg)]" />
          </div>

          {/* dentist chair */}
          <div className="sr-dentist-chair absolute bottom-[22px] left-[42px] h-[112px] w-[224px] origin-bottom-left -rotate-[5deg]">
            <div className="absolute bottom-2 left-5 h-[62px] w-[170px] rounded-[28px_40px_24px_26px] border-2 border-cyan-100/20 bg-gradient-to-r from-[#4b91a8] to-[#72c2c5] shadow-[0_14px_30px_rgba(0,0,0,.3)]" />
            <div className="absolute -top-16 left-2 h-[92px] w-[82px] -rotate-[17deg] rounded-[28px] border-2 border-cyan-100/20 bg-gradient-to-b from-[#63b3c1] to-[#377d99]" />
            <div className="absolute bottom-0 left-[116px] h-8 w-9 rounded-b-xl bg-zinc-500" />
            <div className="absolute -bottom-3 left-[96px] h-4 w-56 -translate-x-1/2 rounded-full bg-zinc-700/80" />
          </div>

          {/* player in chair - blocky YAJ silhouette */}
          <div className="sr-patient absolute bottom-[62px] left-[103px] h-[112px] w-[118px] -rotate-[8deg]">
            <div className="absolute left-[42px] top-0 h-[40px] w-[40px] rounded-[12px] border border-white/15 bg-[#9f6d4a] shadow-lg">
              <span className="absolute left-[8px] top-[14px] h-[4px] w-[5px] rounded-full bg-black/75" />
              <span className="absolute right-[8px] top-[14px] h-[4px] w-[5px] rounded-full bg-black/75" />
              <span className="absolute bottom-[7px] left-1/2 h-[5px] w-[14px] -translate-x-1/2 rounded-b-full border-b-2 border-white/85" />
            </div>
            <div className="absolute left-[28px] top-[39px] h-[46px] w-[66px] rounded-[10px] bg-[#5b8cff] shadow-lg" />
            <div className="absolute left-[11px] top-[43px] h-[18px] w-[42px] -rotate-[22deg] rounded-md bg-[#9f6d4a]" />
            <div className="absolute right-[0px] top-[46px] h-[18px] w-[43px] rotate-[22deg] rounded-md bg-[#9f6d4a]" />
            <div className="absolute bottom-[6px] left-[35px] h-[34px] w-[18px] rounded-md bg-[#273a73]" />
            <div className="absolute bottom-[2px] right-[29px] h-[35px] w-[18px] rounded-md bg-[#273a73]" />
            <div className="sr-tooth-sparkle absolute left-[75px] top-[20px] text-lg">✦</div>
          </div>

          {/* Dr Cavity */}
          <div className="sr-cavity-dentist absolute bottom-[27px] right-[36px] h-[168px] w-[108px]">
            <div className="absolute left-[31px] top-0 h-[48px] w-[46px] rounded-[14px] bg-[#d38b67] shadow-lg">
              <span className="absolute left-[8px] top-[16px] h-[5px] w-[6px] rounded-full bg-black" />
              <span className="absolute right-[8px] top-[16px] h-[5px] w-[6px] rounded-full bg-black" />
              <span className="absolute bottom-[8px] left-1/2 h-[4px] w-[18px] -translate-x-1/2 rounded-full bg-white" />
            </div>
            <div className="absolute left-[20px] top-[45px] h-[86px] w-[70px] rounded-[14px_14px_18px_18px] border border-white/30 bg-white shadow-[0_10px_24px_rgba(0,0,0,.32)]">
              <div className="absolute left-1/2 top-2 h-9 w-[2px] -translate-x-1/2 bg-sky-300" />
              <div className="absolute left-[15px] top-[34px] h-5 w-5 rounded-full border-2 border-rose-400" />
              <div className="absolute right-[13px] top-[34px] h-5 w-5 rounded-full border-2 border-rose-400" />
            </div>
            <div className="sr-dentist-arm absolute -left-[33px] top-[62px] h-[18px] w-[74px] origin-right rotate-[20deg] rounded-md bg-white">
              <div className="absolute -left-[15px] top-[4px] h-[8px] w-[21px] rounded-full bg-[#d38b67]" />
              <div className="absolute -left-[34px] top-[6px] h-[3px] w-[24px] rounded-full bg-zinc-300" />
              <div className="absolute -left-[38px] top-[2px] h-[11px] w-[11px] rounded-full border-2 border-zinc-300" />
            </div>
            <div className="absolute bottom-0 left-[28px] h-[40px] w-[18px] rounded-b-lg bg-zinc-700" />
            <div className="absolute bottom-0 right-[26px] h-[40px] w-[18px] rounded-b-lg bg-zinc-700" />
          </div>

          <div className="sr-dental-bubble absolute right-5 top-5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/80 backdrop-blur-sm">
            Open wide… 🦷
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-black uppercase tracking-[0.08em] text-pink-200">Dr. Cavity caught you!</h2>
        <p className="mx-auto mt-1 max-w-[360px] text-xs leading-relaxed text-white/65">
          You're in the dentist chair. Retry from checkpoint {checkpoint || 0} before Dr. Cavity finishes the cleaning.
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-7 py-3 text-sm font-black text-white shadow-[0_12px_32px_rgba(168,85,247,.35)] active:scale-[.98]"
        >
          <RotateCcw className="h-4 w-4" /> Retry from checkpoint
        </button>
        <div>
          <button type="button" onClick={onGiveUp} className="mt-4 text-xs font-bold text-white/55 underline underline-offset-4">
            End run and see my score
          </button>
        </div>
      </div>
    </div>
  );
}
