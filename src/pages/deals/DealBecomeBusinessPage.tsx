import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileUp, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEAL_CATEGORIES } from "@/lib/deals";
import {
  listBusinessDocuments,
  listMyBusinesses,
  registerDealBusiness,
  submitBusinessVerification,
  uploadBusinessDocument,
  verificationStatusLabel,
  VERIFICATION_DOC_TYPES,
  type DealBusiness,
  type DealBusinessDocument,
} from "@/lib/deals-api";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Shopper → merchant registration + verification document upload. */
export default function DealBecomeBusinessPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [existing, setExisting] = useState<DealBusiness | null>(null);
  const [docs, setDocs] = useState<DealBusinessDocument[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hollywood");
  const [state, setState] = useState("FL");
  const [postal, setPostal] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState<string>(DEAL_CATEGORIES[0].id);
  const [description, setDescription] = useState("");
  const [hoursOpen, setHoursOpen] = useState("9:00 AM");
  const [hoursClose, setHoursClose] = useState("6:00 PM");
  const [docType, setDocType] = useState<string>(VERIFICATION_DOC_TYPES[0].id);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    void (async () => {
      try {
        const list = await listMyBusinesses(user.id);
        if (list[0]) {
          const b = list[0];
          setExisting(b);
          setName(b.name || "");
          setAddress(b.address || "");
          setCity(b.city || "Hollywood");
          setState(b.state || "FL");
          setPostal(b.postal_code || "");
          setPhone(b.phone || "");
          setEmail(b.email || user.email || "");
          setWebsite(b.website || "");
          setCategory(b.category || DEAL_CATEGORIES[0].id);
          setDescription(b.description || "");
          setDocs(await listBusinessDocuments(b.id));
        }
      } catch {
        /* ignore until migration */
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) {
      toast.error("Sign in to become a business");
      nav("/auth");
      return null;
    }
    if (!name.trim() || !address.trim() || !phone.trim() || !description.trim()) {
      toast.error("Name, address, phone, and description are required");
      return null;
    }
    const hours: Record<string, string> = {};
    for (const d of DAYS) hours[d] = `${hoursOpen} – ${hoursClose}`;

    const biz = await registerDealBusiness({
      userId: user.id,
      name,
      address,
      city,
      state,
      postalCode: postal,
      phone,
      email,
      website,
      category,
      description,
      hoursJson: hours,
    });
    setExisting(biz);
    return biz;
  };

  const uploadDoc = async () => {
    if (!user) return;
    if (!docFile) {
      toast.error("Choose a document to upload");
      return;
    }
    setUploading(true);
    try {
      let biz = existing;
      if (!biz) biz = await saveProfile();
      if (!biz) return;
      await uploadBusinessDocument({
        userId: user.id,
        businessId: biz.id,
        docType,
        file: docFile,
      });
      setDocFile(null);
      setDocs(await listBusinessDocuments(biz.id));
      toast.success("Document uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!user) {
      toast.error("Sign in to become a business");
      nav("/auth");
      return;
    }
    setSubmitting(true);
    try {
      const biz = await saveProfile();
      if (!biz) return;
      if (docs.length < 1 && !docFile) {
        toast.error("Upload at least one verification document");
        return;
      }
      if (docFile) {
        await uploadBusinessDocument({
          userId: user.id,
          businessId: biz.id,
          docType,
          file: docFile,
        });
      }
      const submitted = await submitBusinessVerification(biz.id);
      setExisting(submitted);
      toast.success("Submitted — verification in review. You can keep posting deals.");
      nav("/deals/business");
    } catch (e: any) {
      toast.error(e?.message || "Could not submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const status = existing?.verification_status || "unverified";

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Business profile</h1>
      </header>

      <div className="space-y-4 px-4 py-5">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 p-4 ring-1 ring-orange-500/20">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <Store className="h-5 w-5" />
          </div>
          <h2 className="text-base font-black">Create your business profile</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Anyone can register and start publishing deals right away. Verification is optional — submit a document
            whenever you want the ✔ Verified Business badge.
          </p>
          {existing ? (
            <p className="mt-2 inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200">
              {existing.is_verified ? "✔" : "•"} {verificationStatusLabel(status)}
            </p>
          ) : null}
          {existing?.admin_request_message ? (
            <p className="mt-2 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
              Admin request: {existing.admin_request_message}
            </p>
          ) : null}
        </div>

        <Field label="Business name *">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya’s Kitchen" />
        </Field>
        <Field label="Business address *">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Verified business or public location" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field label="State"><input className="input" value={state} onChange={(e) => setState(e.target.value)} /></Field>
          <Field label="ZIP"><input className="input" value={postal} onChange={(e) => setPostal(e.target.value)} /></Field>
        </div>
        <Field label="Phone *">
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Business phone" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Website (optional)">
          <input className="input" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Category *">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {DEAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Description *">
          <textarea className="input min-h-[96px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you offer and who you serve" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Opens">
            <input className="input" value={hoursOpen} onChange={(e) => setHoursOpen(e.target.value)} />
          </Field>
          <Field label="Closes">
            <input className="input" value={hoursClose} onChange={(e) => setHoursClose(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-sm font-black">Verification document (optional)</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Only needed for the badge. Upload one proof of legitimacy — license, EIN/tax doc, utility bill, state registration, or matching
            website/social. You don’t need every document.
          </p>
          <label className="mt-3 block text-xs font-semibold">
            Document type
            <select className="input mt-1" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {VERIFICATION_DOC_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-xs font-semibold">
            <FileUp className="h-4 w-4 text-orange-600" />
            <span className="truncate">{docFile ? docFile.name : "Choose file (PDF or image)"}</span>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            disabled={uploading || !docFile}
            onClick={uploadDoc}
            className="mt-2 h-10 w-full rounded-xl border border-border text-xs font-bold disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Upload document"}
          </button>
          {docs.length ? (
            <ul className="mt-3 space-y-1.5">
              {docs.map((d) => (
                <li key={d.id} className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px]">
                  <span className="font-semibold capitalize">{d.doc_type.replace(/_/g, " ")}</span>
                  {" · "}
                  {d.file_name || "Document"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Save your profile to start posting deals immediately. If you want the badge: upload one document → admin
          reviews → Approve / Reject / Request more info. YAJ verifies business documents only, not identity.
        </p>

        <button
          type="button"
          disabled={savingProfile}
          onClick={async () => {
            setSavingProfile(true);
            try {
              const biz = await saveProfile();
              if (biz) {
                toast.success("Business saved — you can post deals now");
                nav("/deals/business");
              }
            } catch (e: any) {
              toast.error(e?.message || "Could not save business");
            } finally {
              setSavingProfile(false);
            }
          }}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white disabled:opacity-50"
        >
          {savingProfile ? "Saving…" : "Save & start posting deals"}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="h-11 w-full rounded-xl border border-border text-xs font-bold disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for Verified badge (optional)"}
        </button>
      </div>

      <style>{`
        .input { width: 100%; height: 2.75rem; border-radius: 0.75rem; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)); padding: 0 0.75rem; font-size: 0.875rem; }
        textarea.input { height: auto; padding: 0.75rem; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
