import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Droplets, LayoutDashboard, Moon, X } from "lucide-react";
import {
  DEFAULT_HEALTH_PROFILE,
  getTodayProgress,
  loadWellnessState,
  logWaterCup,
  updateWellnessProfile,
  WELLNESS_SKIN_TONES,
  WELLNESS_UPDATED_EVENT,
  type WellnessFigure,
  type WellnessHealthProfile,
  type WellnessSkinTone,
  type WellnessState,
} from "@/lib/wellness";

type Props = {
  open: boolean;
  onClose: () => void;
  onStateChange?: (state: WellnessState) => void;
};

/**
 * Save / edit health basics, water logging, bedtime reminder prefs.
 * Portaled above BottomNav so Save is never covered by the tab bar.
 */
export default function WellnessDashboardSheet({ open, onClose, onStateChange }: Props) {
  const [state, setState] = useState<WellnessState>(() => loadWellnessState());
  const profile = state.profile || DEFAULT_HEALTH_PROFILE;
  const today = getTodayProgress(state);

  const [figure, setFigure] = useState<WellnessFigure>(profile.figure);
  const [skinTone, setSkinTone] = useState<WellnessSkinTone>(profile.skinTone || "medium");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [weight, setWeight] = useState(profile.weightLbs ? String(profile.weightLbs) : "");
  const [bedtime, setBedtime] = useState(profile.bedtime || "22:30");
  const [waterGoal, setWaterGoal] = useState(String(profile.waterGoalCups || 8));
  const [notifyWater, setNotifyWater] = useState(profile.notifyWater);
  const [notifyBedtime, setNotifyBedtime] = useState(profile.notifyBedtime);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = loadWellnessState();
    setState(s);
    const p = s.profile || DEFAULT_HEALTH_PROFILE;
    setFigure(p.figure);
    setSkinTone(p.skinTone || "medium");
    setAge(p.age ? String(p.age) : "");
    setWeight(p.weightLbs ? String(p.weightLbs) : "");
    setBedtime(p.bedtime || "22:30");
    setWaterGoal(String(p.waterGoalCups || 8));
    setNotifyWater(p.notifyWater);
    setNotifyBedtime(p.notifyBedtime);
  }, [open]);

  useEffect(() => {
    const refresh = () => setState(loadWellnessState());
    window.addEventListener(WELLNESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(WELLNESS_UPDATED_EVENT, refresh);
  }, []);

  if (!open) return null;

  const save = (extra?: Partial<WellnessHealthProfile>) => {
    const next = updateWellnessProfile({
      figure,
      skinTone,
      age: age ? Number(age) : undefined,
      weightLbs: weight ? Number(weight) : undefined,
      bedtime,
      waterGoalCups: Math.max(1, Number(waterGoal) || 8),
      notifyWater,
      notifyBedtime,
      ...extra,
      onboarded: true,
    });
    setState({ ...next });
    onStateChange?.(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  };

  const cups = today.waterCups || 0;
  const goal = profile.waterGoalCups || 8;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40 backdrop-blur-[2px]">
      <button type="button" className="min-h-0 flex-1" aria-label="Dismiss" onClick={onClose} />
      <div className="flex max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-t-[1.75rem] bg-[#f3f7f5] shadow-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-900">Wellness dashboard</h2>
                <p className="text-[11px] text-stone-500">Save goals, water, bedtime & profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Close dashboard"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <section className="mb-4 rounded-2xl border border-stone-200/80 bg-white p-4">
            <div className="flex items-center gap-2 text-teal-800">
              <Droplets className="h-4 w-4" />
              <p className="text-sm font-black">Water today</p>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {cups} of {goal} cups
              {notifyWater ? " · reminder on" : ""}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = logWaterCup(-1);
                  setState({ ...next });
                  onStateChange?.(next);
                }}
                className="h-10 flex-1 rounded-full border border-stone-200 text-sm font-bold"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = logWaterCup(1);
                  setState({ ...next });
                  onStateChange?.(next);
                }}
                className="h-10 flex-[2] rounded-full bg-teal-600 text-sm font-black text-white"
              >
                + Log a cup
              </button>
            </div>
          </section>

          <section className="mb-4 space-y-3 rounded-2xl border border-stone-200/80 bg-white p-4">
            <p className="text-sm font-black text-stone-900">Profile</p>
            <p className="text-xs text-stone-500">
              Helps personalize coaching tips and goals. You can change this anytime.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "woman" as const, label: "Woman" },
                  { id: "man" as const, label: "Man" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFigure(opt.id)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold ${
                    figure === opt.id
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-stone-200 bg-stone-50 text-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-600">Coach skin tone</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WELLNESS_SKIN_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setSkinTone(tone.id)}
                    aria-label={tone.label}
                    title={tone.label}
                    className={`h-9 w-9 rounded-full border-2 ${
                      skinTone === tone.id
                        ? "border-teal-600 ring-2 ring-teal-200"
                        : "border-white shadow-sm"
                    }`}
                    style={{ backgroundColor: tone.swatch }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-stone-400">
                Matches your YAJ Wellness Coach across every Move session.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-stone-600">
                Age
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="—"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-teal-500"
                />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Weight (lbs)
                <input
                  type="number"
                  min={60}
                  max={500}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="—"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-teal-500"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-stone-600">
              Daily water goal (cups)
              <input
                type="number"
                min={1}
                max={20}
                value={waterGoal}
                onChange={(e) => setWaterGoal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-teal-500"
              />
            </label>
          </section>

          <section className="mb-2 space-y-3 rounded-2xl border border-stone-200/80 bg-white p-4">
            <div className="flex items-center gap-2 text-indigo-900">
              <Moon className="h-4 w-4" />
              <p className="text-sm font-black">Bedtime</p>
            </div>
            <label className="block text-xs font-semibold text-stone-600">
              Target bedtime
              <input
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-teal-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-700">
              <span className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-stone-400" />
                Bedtime reminder
              </span>
              <input
                type="checkbox"
                checked={notifyBedtime}
                onChange={(e) => setNotifyBedtime(e.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-700">
              <span className="flex items-center gap-2">
                <Droplets className="h-3.5 w-3.5 text-stone-400" />
                Water reminders
              </span>
              <input
                type="checkbox"
                checked={notifyWater}
                onChange={(e) => setNotifyWater(e.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-stone-500">
              Reminder flags are saved on this device for now. Push notifications can plug in later.
            </p>
          </section>
        </div>

        {/* Sticky Save — clear of BottomNav + home indicator */}
        <div className="shrink-0 border-t border-stone-200/80 bg-[#f3f7f5] px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => save()}
            className="mb-1 h-12 w-full rounded-full bg-teal-700 text-sm font-black text-white shadow-md"
          >
            {savedFlash ? "Saved ✓" : "Save dashboard"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
