import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import {
  canClaimDeal,
  computeSavings,
  formatDiscountBadge,
  formatMoney,
  getCategoryLabel,
  mapsUrl,
  redemptionCta,
  remainingClaims,
  statusBadges,
} from "@/lib/deals";
import { useCountdownLabel } from "@/hooks/use-countdown-label";
import VerifiedBusinessBadge from "@/components/deals/VerifiedBusinessBadge";
import {
  claimDeal,
  dealClaimBlockedReason,
  dealCoverUrl,
  getDeal,
  listDealReviews,
  listMyClaims,
  markDealUsed,
  reportDeal,
  resolveDealMediaUrl,
  submitDealReview,
  toggleSaveDeal,
  type Deal,
  type DealClaim,
  type DealReview,
} from "@/lib/deals-api";
import { DEAL_REPORT_REASONS } from "@/lib/deals";
import { toast } from "sonner";

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<DealClaim | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [reviews, setReviews] = useState<DealReview[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string>(DEAL_REPORT_REASONS[0].id);
  const [reportDetails, setReportDetails] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    offerMatched: 5,
    redemptionEasy: 5,
    staffHonored: 5,
    overall: 5,
    body: "",
  });
  const countdown = useCountdownLabel(deal?.expires_at);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await getDeal(id, user?.id);
      setDeal(d);
      if (d) {
        setReviews(await listDealReviews(d.id));
      }
      if (user && d) {
        const claims = await listMyClaims(user.id);
        const mine = claims.find((c) => c.deal_id === d.id && c.status !== "cancelled") || null;
        setClaim(mine);
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not load deal");
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = useMemo(() => {
    if (!deal) return [] as string[];
    const fromGallery = (deal.deal_images || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => resolveDealMediaUrl(i.url))
      .filter(Boolean) as string[];
    const cover = dealCoverUrl(deal);
    const all = cover ? [cover, ...fromGallery.filter((u) => u !== cover)] : fromGallery;
    return all.length ? all : [""];
  }, [deal]);

  const blocked = deal ? dealClaimBlockedReason(deal) : "Deal not found";
  const redeemable = !!deal && canClaimDeal(deal) && !claim;

  const primaryAction = async () => {
    if (!deal) return;
    if (!user) {
      toast.error("Sign in to claim deals");
      nav("/auth");
      return;
    }
    if (claim) {
      // Already claimed — show redemption UI (already on page)
      return;
    }
    if (!redeemable) {
      toast.error(blocked || "Not available");
      return;
    }

    const type = deal.redemption_type;
    if (type === "external_website" && deal.external_url) {
      window.open(deal.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (type === "call" && deal.deal_businesses?.phone) {
      window.location.href = `tel:${deal.deal_businesses.phone}`;
      return;
    }
    if (type === "directions") {
      const url = mapsUrl(deal);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    setClaiming(true);
    try {
      const c = await claimDeal(deal.id);
      setClaim(c);
      toast.success("Deal claimed — find it in My Deals");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const onSave = async () => {
    if (!user || !deal) return toast.error("Sign in to save deals");
    const next = !deal.saved;
    setDeal({ ...deal, saved: next });
    try {
      await toggleSaveDeal(user.id, deal.id, next);
    } catch {
      setDeal({ ...deal, saved: !next });
    }
  };

  const onShare = async () => {
    if (!deal) return;
    const url = `${window.location.origin}${window.location.pathname}#/deals/${deal.id}`;
    try {
      if (navigator.share) await navigator.share({ title: deal.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const openMaps = () => {
    if (!deal) return;
    const url = mapsUrl({
      address: deal.address,
      city: deal.city,
      state: deal.state,
      postal_code: deal.postal_code,
      latitude: deal.latitude,
      longitude: deal.longitude,
      label: deal.map_label || deal.deal_businesses?.name,
    });
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error("No map location available");
  };

  const submitReport = async () => {
    if (!user || !deal) return toast.error("Sign in to report");
    try {
      await reportDeal(deal.id, user.id, reportReason, reportDetails);
      toast.success("Report submitted");
      setShowReport(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not report");
    }
  };

  const submitReview = async () => {
    if (!user || !deal || !claim) return;
    if (claim.status !== "claimed" && claim.status !== "used") {
      toast.error("Claim or use this deal before reviewing");
      return;
    }
    try {
      await submitDealReview({
        dealId: deal.id,
        businessId: deal.business_id,
        userId: user.id,
        claimId: claim.id,
        ...{
          offerMatched: reviewForm.offerMatched,
          redemptionEasy: reviewForm.redemptionEasy,
          staffHonored: reviewForm.staffHonored,
          overall: reviewForm.overall,
          body: reviewForm.body,
        },
      });
      toast.success("Review posted");
      setShowReview(false);
      setReviews(await listDealReviews(deal.id));
    } catch (e: any) {
      toast.error(e?.message || "Could not post review");
    }
  };

  const markUsed = async () => {
    if (!claim) return;
    try {
      const updated = await markDealUsed(claim.id);
      setClaim(updated);
      toast.success("Marked as used — rate this business?");
      setShowReview(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not mark as used");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Deal not found</p>
        <button type="button" onClick={() => nav("/deals")} className="mt-4 text-sm font-semibold text-orange-600">
          Back to Deals
        </button>
      </div>
    );
  }

  const biz = deal.deal_businesses;
  const savings = computeSavings(deal.regular_price, deal.deal_price);
  const badges = statusBadges(deal);
  const cta = claim ? "View redemption" : redemptionCta(deal.redemption_type);
  const remaining = remainingClaims(deal);

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 truncate text-sm font-bold">Deal</h1>
        <button type="button" onClick={onSave} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Save">
          <Bookmark className={`h-4 w-4 ${deal.saved ? "fill-foreground" : ""}`} />
        </button>
        <button type="button" onClick={onShare} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Share">
          <Share2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setShowReport(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Report">
          <Flag className="h-4 w-4" />
        </button>
      </header>

      <div className="relative aspect-[16/10] bg-muted">
        {images[imgIdx] ? (
          <img src={images[imgIdx]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-amber-500 text-white">
            <span className="text-3xl font-black">{formatDiscountBadge(deal)}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-1 text-xs font-black text-white">
          {formatDiscountBadge(deal)}
        </span>
        {images.length > 1 ? (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`h-1.5 rounded-full ${i === imgIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-4 pt-4">
        <div>
          <div className="mb-1 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {b}
              </span>
            ))}
          </div>
          <h2 className="text-xl font-black leading-tight">{deal.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <span className="font-semibold">{biz?.name}</span>
            {biz?.is_verified ? <VerifiedBusinessBadge /> : null}
            {biz && biz.review_count > 0 ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {Number(biz.avg_rating).toFixed(1)} ({biz.review_count})
              </span>
            ) : null}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{deal.description}</p>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Regular</p>
            <p className="text-sm font-bold line-through opacity-60">
              {formatMoney(deal.regular_price, deal.currency) || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Deal</p>
            <p className="text-sm font-black text-orange-600">
              {formatMoney(deal.deal_price, deal.currency) || formatDiscountBadge(deal)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">You save</p>
            <p className="text-sm font-bold">{formatMoney(savings, deal.currency) || "—"}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <Row icon={Clock} label="Valid" value={countdown} />
          <Row icon={MapPin} label="Category" value={getCategoryLabel(deal.category)} />
          {remaining != null ? <Row icon={Star} label="Remaining" value={`${remaining} claims left`} /> : null}
          {deal.minimum_purchase != null ? (
            <Row icon={Star} label="Minimum" value={formatMoney(deal.minimum_purchase) || ""} />
          ) : null}
        </div>

        {deal.terms ? (
          <div>
            <h3 className="text-sm font-bold">Terms & restrictions</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{deal.terms}</p>
          </div>
        ) : null}

        {(deal.address || deal.city || deal.location_type === "online") && (
          <div>
            <h3 className="text-sm font-bold">Location</h3>
            {deal.location_type === "online" ? (
              <p className="mt-1 text-sm text-muted-foreground">Online offer</p>
            ) : (
              <button type="button" onClick={openMaps} className="mt-1 text-left text-sm font-medium text-orange-600 underline-offset-2 hover:underline">
                {[deal.map_label || biz?.name, deal.address, deal.city, deal.state, deal.postal_code]
                  .filter(Boolean)
                  .join(" · ")}
              </button>
            )}
            {deal.latitude != null && deal.longitude != null ? (
              <button
                type="button"
                onClick={openMaps}
                className="mt-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-xs font-semibold text-muted-foreground"
              >
                <MapPin className="mr-1 h-4 w-4" /> Open in Maps
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {biz?.phone ? (
            <a href={`tel:${biz.phone}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          ) : null}
          {biz?.website ? (
            <a href={biz.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          ) : null}
          {biz?.hours_json && Object.keys(biz.hours_json).length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" /> Hours listed
            </span>
          ) : null}
        </div>

        {claim ? (
          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Your claim · {claim.status}</p>
            {claim.redemption_code ? (
              <p className="mt-2 font-mono text-2xl font-black tracking-widest">{claim.redemption_code}</p>
            ) : null}
            {claim.qr_payload && (deal.redemption_type === "qr_code" || deal.redemption_type === "show_screen") ? (
              <div className="mt-3 flex justify-center rounded-xl bg-white p-3">
                <QRCodeSVG value={claim.qr_payload} size={160} />
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Expires {claim.expires_at ? new Date(claim.expires_at).toLocaleString() : "with deal"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{deal.terms}</p>
            <div className="mt-3 flex gap-2">
              {claim.status === "claimed" ? (
                <button
                  type="button"
                  onClick={markUsed}
                  className="rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
                >
                  Mark as Used
                </button>
              ) : null}
              <button type="button" onClick={openMaps} className="rounded-full bg-muted px-4 py-2 text-xs font-bold">
                Get Directions
              </button>
              {(claim.status === "claimed" || claim.status === "used") && (
                <button type="button" onClick={() => setShowReview(true)} className="rounded-full bg-muted px-4 py-2 text-xs font-bold">
                  Review
                </button>
              )}
            </div>
          </div>
        ) : null}

        {reviews.length ? (
          <div>
            <h3 className="mb-2 text-sm font-bold">Reviews</h3>
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">Overall {r.overall}/5</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Matched {r.offer_matched} · Easy {r.redemption_easy} · Staff {r.staff_honored}
                  </p>
                  {r.body ? <p className="mt-1 text-sm">{r.body}</p> : null}
                  {r.business_response ? (
                    <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs">
                      <span className="font-semibold">Business: </span>
                      {r.business_response}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {blocked && !claim ? (
          <p className="mb-2 text-center text-xs font-semibold text-destructive">{blocked}</p>
        ) : null}
        <button
          type="button"
          disabled={!!blocked && !claim || claiming}
          onClick={primaryAction}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white disabled:opacity-40"
        >
          {claiming ? "Claiming…" : cta}
          {deal.redemption_type === "external_website" ? <ExternalLink className="h-4 w-4" /> : null}
        </button>
      </div>

      {showReport ? (
        <Modal title="Report deal" onClose={() => setShowReport(false)}>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="mb-2 h-10 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          >
            {DEAL_REPORT_REASONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Details (optional)"
            className="mb-3 h-24 w-full rounded-xl border border-border bg-muted p-3 text-sm"
          />
          <button type="button" onClick={submitReport} className="w-full rounded-xl bg-foreground py-2.5 text-sm font-bold text-background">
            Submit report
          </button>
        </Modal>
      ) : null}

      {showReview ? (
        <Modal title="Rate this business" onClose={() => setShowReview(false)}>
          {(
            [
              ["staffHonored", "Was the deal honored?"],
              ["redemptionEasy", "Would you return?"],
              ["offerMatched", "Was the description accurate?"],
              ["overall", "Overall experience"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mb-2 block text-xs font-semibold">
              {label}: {(reviewForm as any)[key]}
              <input
                type="range"
                min={1}
                max={5}
                value={(reviewForm as any)[key]}
                onChange={(e) => setReviewForm({ ...reviewForm, [key]: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </label>
          ))}
          <textarea
            value={reviewForm.body}
            onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
            placeholder="Optional comments"
            className="mb-3 h-20 w-full rounded-xl border border-border bg-muted p-3 text-sm"
          />
          <button type="button" onClick={submitReview} className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-sm font-bold text-white">
            Post review
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-orange-500" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-t-2xl bg-background p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
