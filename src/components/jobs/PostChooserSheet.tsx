import { X, Briefcase, Wrench } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onPickJob: () => void;
  onPickGig: () => void;
};

export default function PostChooserSheet({ open, onClose, onPickJob, onPickGig }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">What are you posting?</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onPickJob}
            className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-left active:scale-95 transition">
            <Briefcase className="w-6 h-6 mb-2" />
            <p className="text-sm font-bold">Job</p>
            <p className="text-[11px] opacity-90 mt-0.5">Full-time, contract, internship</p>
          </button>
          <button onClick={onPickGig}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white text-left active:scale-95 transition">
            <Wrench className="w-6 h-6 mb-2" />
            <p className="text-sm font-bold">Gig</p>
            <p className="text-[11px] opacity-90 mt-0.5">One-off task or service</p>
          </button>
        </div>
      </div>
    </div>
  );
}
