import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  CIRCLE_TYPE_META,
  CircleType,
  PostVisibility,
  createCircle,
  uploadCircleImage,
} from "@/lib/circles";

const STEP_TITLES = ["", "Basics", "Privacy", "Permissions", "Review"];
const CATEGORIES = ["Social", "Sports", "Music", "Food", "Tech", "Outdoors", "Family", "Other"];

export default function CircleCreatePage() {
  const { type } = useParams<{ type: string }>();
  const circleType = (type as CircleType) || "custom";
  const meta = CIRCLE_TYPE_META[circleType] ?? CIRCLE_TYPE_META.custom;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [isPrivate, setIsPrivate] = useState(circleType === "private");
  const [isDiscoverable, setIsDiscoverable] = useState(circleType !== "private");
  const [requiresApproval, setRequiresApproval] = useState(circleType === "private");

  const [memberPostingAllowed, setMemberPostingAllowed] = useState(true);
  const [memberCommentsAllowed, setMemberCommentsAllowed] = useState(true);
  const [memberInvitesAllowed, setMemberInvitesAllowed] = useState(false);
  const [defaultPostVisibility, setDefaultPostVisibility] = useState<PostVisibility>("circle_members");

  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("4.99");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const isCreator = circleType === "creator";

  const stepTitle = useMemo(() => STEP_TITLES[step], [step]);

  const back = () => (step > 1 ? setStep((s) => s - 1) : navigate(-1));

  const goStep2 = () => {
    if (!name.trim()) {
      toast({ title: "Give your Circle a name first", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleUpload = async (file: File, kind: "avatar" | "cover") => {
    if (!user?.id) return;
    setUploading(kind);
    try {
      const url = await uploadCircleImage(user.id, file, kind);
      if (kind === "avatar") setAvatarUrl(url);
      else setCoverUrl(url);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const circle = await createCircle({
        ownerId: user.id,
        type: circleType,
        name,
        description,
        category: category || undefined,
        city: city || undefined,
        avatarUrl: avatarUrl || undefined,
        coverUrl: coverUrl || undefined,
        isPrivate,
        isDiscoverable,
        requiresApproval,
        isPaid: isCreator ? isPaid : false,
        priceCents: isCreator && isPaid ? Math.round(parseFloat(price || "0") * 100) : undefined,
        welcomeMessage: welcomeMessage || undefined,
        defaultPostVisibility,
        memberPostingAllowed,
        memberCommentsAllowed,
        memberInvitesAllowed,
      });
      toast({ title: `${circle.name} is live` });
      navigate(`/circle/c/${circle.id}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Could not create your Circle", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={back} className="p-2 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {meta.emoji} {meta.label} · {step}/4
            </p>
            <h1 className="text-base font-black">{stepTitle}</h1>
          </div>
        </div>
        <div className="mt-2.5 flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="px-4 pt-5">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "avatar")} />
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-muted"
              >
                {uploading === "avatar" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div>
                <p className="text-[12.5px] font-bold">Profile image</p>
                <p className="text-[11px] text-muted-foreground">Optional — tap to add</p>
              </div>
            </div>

            <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "cover")} />
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted"
            >
              {uploading === "cover" ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[12.5px] font-semibold text-muted-foreground">Add a cover image</span>
              )}
            </button>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Circle name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. "${meta.label}"`}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3.5 text-[14px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What's this Circle about?"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3 text-[13px] outline-none"
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3.5 text-[13px] outline-none"
                />
              </div>
            </div>

            <button type="button" onClick={goStep2} className="mt-2 w-full rounded-full bg-primary py-3 text-[13.5px] font-black text-primary-foreground">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <ToggleRow label="Private Circle" sub="Only approved members can see posts and videos" value={isPrivate} onChange={setIsPrivate} />
            <ToggleRow label="Discoverable" sub="Show up in Discover and search" value={isDiscoverable} onChange={setIsDiscoverable} />
            <ToggleRow label="Approval required to join" sub="You review every join request before they can see the Circle" value={requiresApproval} onChange={setRequiresApproval} />
            <button type="button" onClick={() => setStep(3)} className="mt-2 w-full rounded-full bg-primary py-3 text-[13.5px] font-black text-primary-foreground">
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <ToggleRow label="Members can post" sub="Otherwise only you can post" value={memberPostingAllowed} onChange={setMemberPostingAllowed} />
            <ToggleRow label="Members can comment" value={memberCommentsAllowed} onChange={setMemberCommentsAllowed} />
            <ToggleRow label="Members can invite others" value={memberInvitesAllowed} onChange={setMemberInvitesAllowed} />

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Default post visibility</label>
              <select
                value={defaultPostVisibility}
                onChange={(e) => setDefaultPostVisibility(e.target.value as PostVisibility)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3 text-[13px] outline-none"
              >
                <option value="everyone">Everyone</option>
                <option value="circle_members">Circle Members</option>
                {isCreator && <option value="paid_members">Paid Members</option>}
                <option value="selected_members">Selected Members</option>
                <option value="only_me">Only Me</option>
              </select>
            </div>

            {isCreator && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                <ToggleRow label="Paid Circle" sub="Charge a monthly subscription for full access" value={isPaid} onChange={setIsPaid} />
                {isPaid && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Monthly price (USD)</label>
                      <input
                        type="number"
                        min="0.99"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3.5 text-[14px] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Welcome message for new subscribers</label>
                      <textarea
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13.5px] outline-none"
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Payment processing isn't connected yet — this sets your price, but the Subscribe
                      button will show "coming soon" until that's wired up. No one will be charged.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button type="button" onClick={() => setStep(4)} className="mt-2 w-full rounded-full bg-primary py-3 text-[13.5px] font-black text-primary-foreground">
              Review
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex h-28 items-center justify-center bg-muted">
                {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl">{meta.emoji}</span>}
              </div>
              <div className="p-3.5">
                <p className="text-[14px] font-black">{name || "Untitled Circle"}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{description || "No description"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] font-bold text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{isPrivate ? "Private" : "Public"}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{isDiscoverable ? "Discoverable" : "Hidden"}</span>
                  {requiresApproval && <span className="rounded-full bg-muted px-2 py-0.5">Approval required</span>}
                  {isCreator && isPaid && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-700">${price}/mo</span>}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-[13.5px] font-black text-primary-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Circle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3 text-left"
    >
      <span>
        <span className="block text-[13px] font-bold">{label}</span>
        {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${value ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
