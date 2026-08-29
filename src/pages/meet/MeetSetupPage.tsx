import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import {
  MEET_LOOKING_OPTIONS,
  MEET_PROMPT_OPTIONS,
  getMeetProfile,
  meetAgeGate,
  upsertMeetProfile,
  type MeetProfile,
} from "@/lib/meet";

function MeetSetupInner() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState(MEET_LOOKING_OPTIONS[1]);
  const [city, setCity] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [promptQuestion, setPromptQuestion] = useState(MEET_PROMPT_OPTIONS[0]);
  const [promptAnswer, setPromptAnswer] = useState("");
  const [openToInterview, setOpenToInterview] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const maxAdultBirthYear = new Date().getFullYear() - 18;
  const ageGate = useMemo(() => {
    if (!birthYear.trim()) {
      return meetAgeGate(null);
    }
    return meetAgeGate(Number(birthYear));
  }, [birthYear]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    void getMeetProfile(user.id)
      .then((p) => {
        if (!p) {
          const metaName =
            (user.user_metadata as any)?.display_name ||
            (user.user_metadata as any)?.full_name ||
            user.email?.split("@")[0] ||
            "";
          setDisplayName(metaName);
          return;
        }
        applyProfile(p);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const applyProfile = (p: MeetProfile) => {
    setDisplayName(p.display_name);
    setHeadline(p.headline || "");
    setBio(p.bio || "");
    setBirthYear(p.birth_year ? String(p.birth_year) : "");
    setGender(p.gender || "");
    setLookingFor(p.looking_for || MEET_LOOKING_OPTIONS[1]);
    setCity(p.city || "");
    setPhotoUrl(p.photo_urls[0] || "");
    setInterests(p.interests || []);
    setPromptQuestion(p.prompt_question || MEET_PROMPT_OPTIONS[0]);
    setPromptAnswer(p.prompt_answer || "");
    setOpenToInterview(p.open_to_interview);
    setIsVisible(p.is_visible);
  };

  const addInterest = () => {
    const tag = interestInput.trim();
    if (!tag) return;
    if (interests.includes(tag)) {
      setInterestInput("");
      return;
    }
    setInterests((prev) => [...prev, tag].slice(0, 12));
    setInterestInput("");
  };

  const canSave = Boolean(displayName.trim()) && ageGate.ok;

  const save = async () => {
    if (!user?.id) return;
    if (!displayName.trim()) {
      toast({ title: "Name required", description: "Add a display name for your Meet profile.", variant: "destructive" });
      return;
    }
    if (!ageGate.ok) {
      toast({
        title: "Age restricted",
        description: ageGate.error || "You must be 18 or older to continue.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await upsertMeetProfile(user.id, {
        display_name: displayName.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        birth_year: Math.floor(Number(birthYear)),
        gender: gender.trim() || null,
        looking_for: lookingFor,
        city: city.trim() || null,
        photo_urls: photoUrl.trim() ? [photoUrl.trim()] : [],
        interests,
        prompt_question: promptQuestion,
        prompt_answer: promptAnswer.trim() || null,
        open_to_interview: openToInterview,
        is_visible: isVisible,
      });
      toast({ title: "Profile saved", description: `You're on Meet on YAJ · age ${ageGate.age}` });
      nav("/meet");
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/meet")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <MeetBrandMark />
          <h1 className="text-lg font-black">Your Meet profile</h1>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="First name or nickname"
          />
        </Field>
        <Field label="Headline">
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="input"
            placeholder="One line that feels like you"
            maxLength={80}
          />
        </Field>
        <Field label="About">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input min-h-[96px] resize-none"
            placeholder="What should people know before they ask to interview you?"
            maxLength={500}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Birth year (required)">
            <input
              type="number"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              className="input"
              placeholder={`e.g. ${maxAdultBirthYear}`}
              min={1900}
              max={maxAdultBirthYear}
              required
              aria-required="true"
            />
            {ageGate.ok && ageGate.age != null ? (
              <p className="mt-1 text-[11px] font-semibold text-primary">
                Your profile will show: age {ageGate.age}
              </p>
            ) : birthYear.trim() ? (
              <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-destructive">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {ageGate.error}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Required. Must be 18+. Age appears on your Meet profile.
              </p>
            )}
          </Field>
          <Field label="Gender">
            <input
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="input"
              placeholder="Optional"
            />
          </Field>
        </div>

        {!ageGate.ok && (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-[12px] text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Meet on YAJ is restricted to ages 18 and older. Enter a valid birth year to continue — you
              can’t save a dating profile if you’re under 18.
            </p>
          </div>
        )}
        <Field label="Looking for">
          <div className="flex flex-wrap gap-2">
            {MEET_LOOKING_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setLookingFor(opt)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  lookingFor === opt ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>
        <Field label="City">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input"
            placeholder="Miami, FL"
          />
        </Field>
        <Field label="Photo URL">
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="input"
            placeholder="https://… (upload coming soon)"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Paste a photo link for now — in-app upload lands in a later pass.
          </p>
        </Field>
        <Field label="Interests">
          <div className="flex gap-2">
            <input
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
              className="input flex-1"
              placeholder="Music, food, hiking…"
            />
            <button
              type="button"
              onClick={addInterest}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interests.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setInterests((prev) => prev.filter((t) => t !== tag))}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold"
              >
                {tag} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Prompt">
          <select
            value={promptQuestion}
            onChange={(e) => setPromptQuestion(e.target.value)}
            className="input"
          >
            {MEET_PROMPT_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <textarea
            value={promptAnswer}
            onChange={(e) => setPromptAnswer(e.target.value)}
            className="input mt-2 min-h-[72px] resize-none"
            placeholder="Your answer"
            maxLength={240}
          />
        </Field>

        <ToggleRow
          label="Open to interview requests"
          description="People can ask for a short chat / interview before messaging."
          checked={openToInterview}
          onChange={setOpenToInterview}
        />
        <ToggleRow
          label="Show my profile in the scroll"
          description="Turn off to hide without deleting."
          checked={isVisible}
          onChange={setIsVisible}
        />

        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => void save()}
          className="w-full rounded-2xl gradient-primary py-3.5 text-sm font-black text-primary-foreground disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : !ageGate.ok
              ? "Enter a valid 18+ birth year to continue"
              : "Save Meet profile"}
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          padding: 0.65rem 0.85rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left"
    >
      <div className="flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function MeetSetupPage() {
  return (
    <MeetAdultGate>
      <MeetSetupInner />
    </MeetAdultGate>
  );
}
