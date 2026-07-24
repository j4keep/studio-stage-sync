import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs";

const JOB_NOTIF_KEY = "yaj_job_notifications";

export function jobNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(JOB_NOTIF_KEY) !== "false";
  } catch {
    return true;
  }
}

export default function JobPreferencesPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [prefsId, setPrefsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [titles, setTitles] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [empTypes, setEmpTypes] = useState<string[]>([]);
  const [expLevel, setExpLevel] = useState<string>("");
  const [salary, setSalary] = useState<string>("");
  const [remoteOk, setRemoteOk] = useState(true);
  const [hybridOk, setHybridOk] = useState(true);
  const [onsiteOk, setOnsiteOk] = useState(true);
  const [notifyFrequency, setNotifyFrequency] = useState<string>("weekly");
  const [jobNotifs, setJobNotifs] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setJobNotifs(jobNotificationsEnabled());
      const { data } = await supabase.from("job_preferences").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setPrefsId(data.id);
        setTitles(data.titles || []);
        setCategories(data.categories || []);
        setLocations(data.locations || []);
        setKeywords(data.alert_keywords || []);
        setEmpTypes(data.employment_types || []);
        setExpLevel(data.experience_level || "");
        setSalary(data.salary_expect ? String(data.salary_expect) : "");
        setRemoteOk(data.remote_ok ?? true);
        setHybridOk(data.hybrid_ok ?? true);
        setOnsiteOk(data.onsite_ok ?? true);
        const freq = data.notify_frequency || "weekly";
        setNotifyFrequency(freq === "off" ? "weekly" : freq);
        if (freq === "off") setJobNotifs(false);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      localStorage.setItem(JOB_NOTIF_KEY, String(jobNotifs));
    } catch {
      /* ignore */
    }
    const payload = {
      user_id: user.id,
      titles, categories, locations, alert_keywords: keywords,
      employment_types: empTypes,
      experience_level: expLevel || null,
      salary_expect: salary ? Number(salary) : null,
      remote_ok: remoteOk, hybrid_ok: hybridOk, onsite_ok: onsiteOk,
      notify_frequency: jobNotifs ? notifyFrequency : "off",
    };
    const q = prefsId
      ? supabase.from("job_preferences").update(payload).eq("id", prefsId)
      : supabase.from("job_preferences").insert(payload).select("id").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!prefsId && data && (data as any).id) setPrefsId((data as any).id);
    toast.success("Preferences saved");
    nav(-1);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-2 px-3 py-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-bold flex-1">Job Preferences</h1>
      </header>

      <div className="p-4 pb-32 space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold">Job notifications</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Get updates in your notification bell when an employer changes your application status or sends an interview invite.
          </p>
          <button
            type="button"
            onClick={() => setJobNotifs((v) => !v)}
            className={`w-full h-11 rounded-xl border text-sm font-bold inline-flex items-center justify-between px-3 ${
              jobNotifs ? "bg-primary/10 border-primary/40 text-foreground" : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <span>Application update notifications</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${jobNotifs ? "bg-primary text-primary-foreground" : "bg-background"}`}>
              {jobNotifs ? "On" : "Off"}
            </span>
          </button>

          {jobNotifs && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Alert frequency (new matches)</span>
              <select value={notifyFrequency} onChange={(e) => setNotifyFrequency(e.target.value)}
                className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none">
                <option value="realtime">Real-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          )}
        </div>

        <ChipInput label="Desired titles" values={titles} onChange={setTitles} placeholder="e.g. Barista, Designer" />
        <ChipInput label="Categories" values={categories} onChange={setCategories} placeholder="e.g. creative, handyman" />
        <ChipInput label="Locations" values={locations} onChange={setLocations} placeholder="e.g. Atlanta, Remote" />
        <ChipInput label="Alert keywords" values={keywords} onChange={setKeywords} placeholder="e.g. audio, mixing, weekends" />

        <div>
          <span className="text-xs font-semibold text-muted-foreground mb-2 block">Employment types</span>
          <div className="flex flex-wrap gap-2">
            {EMPLOYMENT_TYPES.map((t) => {
              const on = empTypes.includes(t.id);
              return (
                <button key={t.id} onClick={() => setEmpTypes((p) => on ? p.filter((x) => x !== t.id) : [...p, t.id])}
                  className={`px-3 h-8 rounded-full text-xs font-semibold border ${on ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground mb-2 block">Experience level</span>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_LEVELS.map((l) => (
              <button key={l.id} onClick={() => setExpLevel(expLevel === l.id ? "" : l.id)}
                className={`px-3 h-8 rounded-full text-xs font-semibold border ${expLevel === l.id ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">Minimum expected salary ($)</span>
          <input inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value)}
            placeholder="45000" className="w-full h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none" />
        </label>

        <div>
          <span className="text-xs font-semibold text-muted-foreground mb-2 block">Work mode</span>
          <div className="flex flex-wrap gap-2">
            <Toggle label="Remote OK" on={remoteOk} onChange={setRemoteOk} />
            <Toggle label="Hybrid OK" on={hybridOk} onChange={setHybridOk} />
            <Toggle label="On-site OK" on={onsiteOk} onChange={setOnsiteOk} />
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`px-3 h-8 rounded-full text-xs font-semibold border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
      {label}
    </button>
  );
}

function ChipInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setText("");
  };
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 h-11 rounded-xl bg-muted border border-border px-3 text-sm outline-none"
        />
        <button onClick={add} className="h-11 px-4 rounded-xl bg-foreground text-background text-xs font-bold">Add</button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
