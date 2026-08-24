import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Circle, deleteCircle, getCircle, updateCircle, uploadCircleImage } from "@/lib/circles";
import CircleCoverCreator from "@/components/circle/CircleCoverCreator";

export default function CircleSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [circle, setCircle] = useState<Circle | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingCover, setEditingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    void getCircle(id).then((c) => {
      setCircle(c);
      if (c) {
        setName(c.name);
        setDescription(c.description || "");
        setWelcomeMessage(c.welcome_message || "");
      }
    });
  }, [id]);

  if (circle === undefined) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!circle || !user?.id || user.id !== circle.owner_id) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">You can't manage settings for this Circle.</p>
        <button type="button" onClick={() => navigate("/circle")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to My Circle
        </button>
      </div>
    );
  }

  const patch = async (field: string, fn: () => Promise<Circle>) => {
    setSavingField(field);
    try {
      const updated = await fn();
      setCircle(updated);
    } catch (e: any) {
      toast({ title: "Couldn't save that change", description: e.message, variant: "destructive" });
    } finally {
      setSavingField(null);
    }
  };

  const pickAvatar = async (file: File) => {
    setSavingField("avatar");
    try {
      const url = await uploadCircleImage(user.id, file, "avatar");
      const updated = await updateCircle(circle.id, { avatarUrl: url });
      setCircle(updated);
    } catch (e: any) {
      toast({ title: "Couldn't save that photo", description: e.message, variant: "destructive" });
    } finally {
      setSavingField(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${circle.name}"? This can't be undone — members will lose access immediately.`)) return;
    setDeleting(true);
    try {
      await deleteCircle(circle.id);
      navigate("/circle", { replace: true });
    } catch (e: any) {
      toast({ title: "Couldn't delete this Circle", description: e.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  if (editingCover) {
    return (
      <CircleCoverCreator
        userId={user.id}
        circleName={circle.name}
        fullScreen
        onSkip={() => setEditingCover(false)}
        onSaved={(url) => {
          setEditingCover(false);
          void patch("cover", () => updateCircle(circle.id, { coverUrl: url }));
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-black">Circle Settings</h1>
      </div>

      <div className="space-y-6 px-4 py-5">
        <Section title="Circle photo">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
              {circle.avatar_url && <img src={circle.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])} />
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={savingField === "avatar"}
                className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2 text-[12px] font-bold"
              >
                {savingField === "avatar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Change profile photo
              </button>
              <button
                type="button"
                onClick={() => setEditingCover(true)}
                className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2 text-[12px] font-bold"
              >
                Change cover
              </button>
            </div>
          </div>
        </Section>

        <Section title="Circle info">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== circle.name && patch("name", () => updateCircle(circle.id, { name }))}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] outline-none"
            />
          </Field>
          {!circle.is_personal && (
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => description !== (circle.description || "") && patch("description", () => updateCircle(circle.id, { description }))}
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] outline-none"
              />
            </Field>
          )}
          <Field label="Welcome message" hint="Shown to people before they're approved to join.">
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              onBlur={() => welcomeMessage !== (circle.welcome_message || "") && patch("welcome", () => updateCircle(circle.id, { welcomeMessage }))}
              rows={2}
              placeholder="Request to join to see everything in here."
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] outline-none"
            />
          </Field>
        </Section>

        <Section title="Privacy & discovery" hint="Change your mind any time — this updates who can see and join, immediately.">
          <Toggle
            label="Private"
            hint="Only approved members can see posts and videos."
            value={circle.is_private}
            saving={savingField === "private"}
            onChange={(v) => patch("private", () => updateCircle(circle.id, { isPrivate: v }))}
          />
          <Toggle
            label="Discoverable"
            hint="Show this Circle in search and Discover."
            value={circle.is_discoverable}
            saving={savingField === "discoverable"}
            onChange={(v) => patch("discoverable", () => updateCircle(circle.id, { isDiscoverable: v }))}
          />
          <Toggle
            label="Automatically accept join requests"
            hint={circle.requires_approval ? "Off — you review and approve each request yourself." : "On — anyone who asks to join gets in immediately."}
            value={!circle.requires_approval}
            saving={savingField === "approval"}
            onChange={(v) => patch("approval", () => updateCircle(circle.id, { requiresApproval: !v }))}
          />
          {!circle.is_personal && (
            <>
              <Toggle
                label="Members can post"
                value={circle.member_posting_allowed}
                saving={savingField === "posting"}
                onChange={(v) => patch("posting", () => updateCircle(circle.id, { memberPostingAllowed: v }))}
              />
              <Toggle
                label="Members can comment"
                value={circle.member_comments_allowed}
                saving={savingField === "comments"}
                onChange={(v) => patch("comments", () => updateCircle(circle.id, { memberCommentsAllowed: v }))}
              />
              <Toggle
                label="Members can invite others"
                value={circle.member_invites_allowed}
                saving={savingField === "invites"}
                onChange={(v) => patch("invites", () => updateCircle(circle.id, { memberInvitesAllowed: v }))}
              />
            </>
          )}
        </Section>

        <Section title="Notifications">
          <Toggle
            label="New join requests"
            value={circle.notify_new_requests}
            saving={savingField === "notify_req"}
            onChange={(v) => patch("notify_req", () => updateCircle(circle.id, { notifyNewRequests: v }))}
          />
          <Toggle
            label="New members"
            value={circle.notify_new_members}
            saving={savingField === "notify_mem"}
            onChange={(v) => patch("notify_mem", () => updateCircle(circle.id, { notifyNewMembers: v }))}
          />
        </Section>

        {!circle.is_personal && (
          <Section title="Danger zone">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 py-2.5 text-[12.5px] font-bold text-destructive disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete this Circle
            </button>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-black">{title}</h2>
      {hint && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>}
      <div className="mt-2.5 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-bold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  saving,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  saving?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={saving}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${value ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
