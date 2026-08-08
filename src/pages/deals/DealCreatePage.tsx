import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEAL_CATEGORIES,
  DEAL_PUBLISHING_POLICY_PATH,
  DEAL_TYPES,
  REDEMPTION_TYPES,
  formatDiscountBadge,
} from "@/lib/deals";
import {
  addDealImage,
  createDealDraft,
  getDeal,
  listMyBusinesses,
  submitDeal,
  updateDeal,
  uploadDealImage,
  resolveDealMediaUrl,
  type DealBusiness,
} from "@/lib/deals-api";
import { normalizeDealFlyer } from "@/lib/deal-flyer";
import { toast } from "sonner";

export default function DealCreatePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const [businesses, setBusinesses] = useState<DealBusiness[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [step, setStep] = useState<"form" | "preview">("form");
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingCover, setExistingCover] = useState<string | null>(null);


  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(DEAL_CATEGORIES[0].id);
  const [description, setDescription] = useState("");
  const [dealType, setDealType] = useState<string>(DEAL_TYPES[0].id);
  const [regularPrice, setRegularPrice] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 16);
  });
  const [redemptionType, setRedemptionType] = useState<string>(REDEMPTION_TYPES[0].id);
  const [promoCode, setPromoCode] = useState("");
  const [totalLimit, setTotalLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [locationType, setLocationType] = useState("in_store");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hollywood");
  const [state, setState] = useState("FL");
  const [postal, setPostal] = useState("");
  const [terms, setTerms] = useState("");
  const [minimumPurchase, setMinimumPurchase] = useState("");
  const [ageRestriction, setAgeRestriction] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const list = await listMyBusinesses(user.id);
        if (!list.length) {
          toast.message("Register as a business to post deals");
          nav("/deals/become-business", { replace: true });
          return;
        }
        setBusinesses(list);
        setBusinessId((prev) => prev || list[0].id);

      } catch (e: any) {
        toast.error(e?.message || "Could not load business");
      }
    })();
  }, [user, nav]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(existingCover ? resolveDealMediaUrl(existingCover) : null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, existingCover]);

  // Edit mode: prefill every field from the existing deal card.
  useEffect(() => {
    if (!editId) return;
    void (async () => {
      try {
        const d = await getDeal(editId);
        if (!d) {
          toast.error("Deal not found");
          return;
        }
        setBusinessId(d.business_id);
        setTitle(d.title);
        setCategory(d.category);
        setDescription(d.description || "");
        setDealType(d.deal_type);
        setRegularPrice(d.regular_price != null ? String(d.regular_price) : "");
        setDealPrice(d.deal_price != null ? String(d.deal_price) : "");
        setDiscountValue(d.discount_value != null ? String(d.discount_value) : "");
        setStartsAt(new Date(d.starts_at).toISOString().slice(0, 16));
        setExpiresAt(new Date(d.expires_at).toISOString().slice(0, 16));
        setRedemptionType(d.redemption_type);
        setPromoCode(d.promo_code || "");
        setTotalLimit(d.total_claim_limit != null ? String(d.total_claim_limit) : "");
        setPerUserLimit(String(d.per_user_limit ?? 1));
        setLocationType(d.location_type || "in_store");
        setAddress(d.address || "");
        setCity(d.city || "");
        setState(d.state || "");
        setPostal(d.postal_code || "");
        setTerms(d.terms || "");
        setMinimumPurchase(d.minimum_purchase != null ? String(d.minimum_purchase) : "");
        setAgeRestriction(d.age_restriction != null ? String(d.age_restriction) : "");
        setExternalUrl(d.external_url || "");
        setExistingCover(d.cover_url || null);
      } catch (e: any) {
        toast.error(e?.message || "Could not load deal");
      }
    })();
  }, [editId]);


  const selectedBiz = businesses.find((b) => b.id === businessId);
  // Launch model: verification is optional. Only admin-blocked businesses are gated.
  const canPublish = !(selectedBiz?.posting_suspended || selectedBiz?.verification_status === "suspended" || selectedBiz?.verification_status === "rejected");

  const badge = useMemo(
    () =>
      formatDiscountBadge({
        deal_type: dealType,
        discount_value: discountValue ? Number(discountValue) : null,
        regular_price: regularPrice ? Number(regularPrice) : null,
        deal_price: dealPrice ? Number(dealPrice) : null,
      }),
    [dealType, discountValue, regularPrice, dealPrice],
  );

  const validate = () => {
    if (!user) {
      toast.error("Sign in required");
      return false;
    }
    if (!businessId) {
      toast.error("Select a business");
      return false;
    }
    if (!title.trim() || !description.trim() || !category) {
      toast.error("Title, category, and description are required");
      return false;
    }
    if (!expiresAt || new Date(expiresAt) <= new Date(startsAt)) {
      toast.error("Expiration must be after start date");
      return false;
    }
    if (regularPrice && dealPrice && Number(dealPrice) > Number(regularPrice)) {
      toast.error("Deal price cannot exceed regular price");
      return false;
    }
    if (locationType !== "online" && !city.trim() && !address.trim()) {
      toast.error("Add a business location or choose Online");
      return false;
    }
    if ((redemptionType === "promo_code" || redemptionType === "barcode") && !promoCode.trim()) {
      toast.error("Enter a promo/barcode code or leave blank to auto-generate at claim");
    }
    return true;
  };

  const publish = async () => {
    if (!validate() || !user) return;
    if (!canPublish) {
      toast.error("Deal posting is suspended for this business — contact support");
      return;
    }
    setSubmitting(true);
    try {
      let coverUrl: string | null = null;
      if (file) coverUrl = await uploadDealImage(user.id, await normalizeDealFlyer(file));

      if (editId) {
        await updateDeal(editId, businessId, {
          title: title.trim(),
          category,
          description: description.trim(),
          deal_type: dealType,
          regular_price: regularPrice ? Number(regularPrice) : null,
          deal_price: dealPrice ? Number(dealPrice) : null,
          discount_value: discountValue ? Number(discountValue) : null,
          discount_badge: badge,
          starts_at: new Date(startsAt).toISOString(),
          expires_at: new Date(expiresAt).toISOString(),
          redemption_type: redemptionType,
          promo_code: promoCode || null,
          total_claim_limit: totalLimit ? Number(totalLimit) : null,
          per_user_limit: perUserLimit ? Number(perUserLimit) : 1,
          location_type: locationType,
          address: locationType === "online" ? null : address,
          city: locationType === "online" ? null : city,
          state: locationType === "online" ? null : state,
          postal_code: locationType === "online" ? null : postal,
          terms: terms || null,
          minimum_purchase: minimumPurchase ? Number(minimumPurchase) : null,
          age_restriction: ageRestriction ? Number(ageRestriction) : null,
          external_url: externalUrl || null,
          ...(coverUrl ? { cover_url: coverUrl } : {}),
        });
        if (coverUrl) await addDealImage(editId, coverUrl, true);
        toast.success("Deal updated");
        nav("/deals/business");
        return;
      }



      const draft = await createDealDraft({
        businessId,
        creatorId: user.id,
        title,
        category,
        description,
        dealType,
        regularPrice: regularPrice ? Number(regularPrice) : null,
        dealPrice: dealPrice ? Number(dealPrice) : null,
        discountValue: discountValue ? Number(discountValue) : null,
        discountBadge: badge,
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        redemptionType,
        promoCode: promoCode || null,
        totalClaimLimit: totalLimit ? Number(totalLimit) : null,
        perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
        locationType,
        address: locationType === "online" ? null : address,
        city: locationType === "online" ? null : city,
        state: locationType === "online" ? null : state,
        postalCode: locationType === "online" ? null : postal,
        terms,
        minimumPurchase: minimumPurchase ? Number(minimumPurchase) : null,
        ageRestriction: ageRestriction ? Number(ageRestriction) : null,
        externalUrl: externalUrl || null,
        coverUrl,
      });

      if (coverUrl) await addDealImage(draft.id, coverUrl, true);

      const submitted = await submitDeal(draft.id);
      if (submitted.status === "pending_review") {
        toast.success("Submitted for review");
      } else if (submitted.status === "active") {
        toast.success("Deal is live");
      } else {
        toast.success(`Deal saved as ${submitted.status}`);
      }
      nav("/deals/business");
    } catch (e: any) {
      toast.error(e?.message || "Could not publish deal");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Sign in to create deals</p>
        <button type="button" onClick={() => nav("/auth")} className="mt-4 text-sm font-semibold text-orange-600">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => (step === "preview" ? setStep("form") : nav("/deals/business"))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">
          {step === "preview" ? "Preview" : editId ? "Edit deal" : "Create deal"}
        </h1>

      </header>

      {!canPublish ? (
        <div className="mx-3 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-semibold">Deal posting suspended</p>
          <p className="mt-1 text-xs text-muted-foreground">
            An admin has paused publishing for this business. You can still draft — contact support to restore posting.
          </p>
        </div>
      ) : null}

      {step === "form" ? (
        <form
          className="space-y-3 px-3 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (validate()) setStep("preview");
          }}
        >
          <Field label="Business">
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="input"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.is_verified ? "✓ Verified" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DEAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[96px]" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </Field>
          <Field label="Deal type">
            <select className="input" value={dealType} onChange={(e) => setDealType(e.target.value)}>
              {DEAL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Regular $">
              <input className="input" type="number" min="0" step="0.01" value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} />
            </Field>
            <Field label="Deal $">
              <input className="input" type="number" min="0" step="0.01" value={dealPrice} onChange={(e) => setDealPrice(e.target.value)} />
            </Field>
            <Field label="Discount">
              <input className="input" type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            </Field>
          </div>
          <Field label="Your flyer image">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="mt-1 text-[11px] font-normal text-muted-foreground">
              Upload your own flyer — it’s auto-fitted to the deal card frame (16:10) so it always looks right.
            </p>
            {previewUrl ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-border">
                <img src={previewUrl} alt="" className="aspect-[16/10] w-full object-cover" />
              </div>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts">
              <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Expires">
              <input className="input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Redemption method">
            <select className="input" value={redemptionType} onChange={(e) => setRedemptionType(e.target.value)}>
              {REDEMPTION_TYPES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Promo / barcode code">
            <input className="input" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Optional — auto-generated if blank" />
          </Field>
          {redemptionType === "external_website" ? (
            <Field label="External URL">
              <input className="input" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Total claim limit">
              <input className="input" type="number" min="1" value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} />
            </Field>
            <Field label="Per-user limit">
              <input className="input" type="number" min="1" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} />
            </Field>
          </div>
          <Field label="Location">
            <select className="input" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
              <option value="in_store">In store</option>
              <option value="online">Online</option>
              <option value="both">Both</option>
            </select>
          </Field>
          {locationType !== "online" ? (
            <>
              <Field label="Business address (public)">
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Verified business or public meeting location" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="City"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                <Field label="State"><input className="input" value={state} onChange={(e) => setState(e.target.value)} /></Field>
                <Field label="ZIP"><input className="input" value={postal} onChange={(e) => setPostal(e.target.value)} /></Field>
              </div>
            </>
          ) : null}
          <Field label="Terms & exclusions">
            <textarea className="input min-h-[80px]" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Minimum purchase">
              <input className="input" type="number" min="0" step="0.01" value={minimumPurchase} onChange={(e) => setMinimumPurchase(e.target.value)} />
            </Field>
            <Field label="Age restriction">
              <input className="input" type="number" min="0" value={ageRestriction} onChange={(e) => setAgeRestriction(e.target.value)} />
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            By publishing you agree to the{" "}
            <Link to={DEAL_PUBLISHING_POLICY_PATH} className="font-semibold text-orange-600 underline">
              Deals publishing policy
            </Link>
            . Prohibited offers are blocked or sent to review.
          </p>

          <button type="submit" className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white">
            Preview deal
          </button>
        </form>
      ) : (
        <div className="space-y-4 px-3 py-4">
          <div className="overflow-hidden rounded-2xl border border-border">
            {previewUrl ? <img src={previewUrl} alt="" className="aspect-[16/10] w-full object-cover" /> : (
              <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-orange-400 to-amber-500 text-2xl font-black text-white">
                {badge}
              </div>
            )}
            <div className="space-y-1 p-3">
              <p className="text-xs font-bold text-orange-600">{badge}</p>
              <h2 className="text-lg font-black">{title}</h2>
              <p className="text-sm text-muted-foreground">{selectedBiz?.name}</p>
              <p className="text-sm whitespace-pre-wrap">{description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(startsAt).toLocaleString()} → {new Date(expiresAt).toLocaleString()}
              </p>
              <p className="text-xs">Redemption: {REDEMPTION_TYPES.find((r) => r.id === redemptionType)?.label}</p>
              {terms ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{terms}</p> : null}
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={publish}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white disabled:opacity-50"
          >
            {submitting ? "Publishing…" : canPublish ? "Publish deal" : "Submit for review"}
          </button>
        </div>
      )}

      <style>{`
        .input { width: 100%; height: 2.5rem; border-radius: 0.75rem; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)); padding: 0 0.75rem; font-size: 0.875rem; }
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
