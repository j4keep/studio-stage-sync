import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, GripVertical, ImagePlus, Loader2, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  AC_TYPES,
  CONDITIONS,
  FIVE_UNDER_MAX,
  FIVE_UNDER_MIN,
  HEATING_TYPES,
  HOME_AMENITIES,
  HOME_DEAL_TYPES,
  HOME_LISTING_TYPES,
  LAUNDRY_TYPES,
  LEASE_TERMS,
  LISTING_TYPES,
  MARKETPLACE_CATEGORIES,
  PARKING_TYPES,
  PROPERTY_TYPES,
  VEHICLE_KINDS,
  VEHICLE_LISTING_TYPES,
  type ListingType,
} from "@/lib/marketplace";
import {
  compressImage,
  createMarketplaceListing,
  getMarketplaceListing,
  updateMarketplaceListing,
  uploadListingImage,
  type ListingInput,
  type VehicleDetails,
} from "@/lib/marketplace-api";

const MAX_PHOTOS = 20;
const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) || u.startsWith("blob:video");

type DraftMedia = { url: string; local?: boolean; video?: boolean };

type HomeDetails = {
  deal: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: string;
  laundry: string;
  parking: string;
  ac: string;
  heating: string;
  lease_term: string;
  available_date: string;
  pets_allowed: boolean;
  address_private: boolean;
  amenities: string[];
};

const EMPTY_HOME: HomeDetails = {
  deal: "For rent",
  property_type: "",
  bedrooms: "",
  bathrooms: "",
  square_feet: "",
  laundry: "",
  parking: "",
  ac: "",
  heating: "",
  lease_term: "",
  available_date: "",
  pets_allowed: false,
  address_private: true,
  amenities: [],
};

export default function MarketplaceCreatePage() {
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(editId);
  const nav = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  /** Field keys highlighted red when Continue is pressed without required values */
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const requestedType = searchParams.get("type");
  const startsAsFiveUnder = !editId && requestedType === "five_under";
  const [listingType, setListingType] = useState<ListingType | string>(startsAsFiveUnder ? "five_under" : "item");
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [storeHasAddress, setStoreHasAddress] = useState(true);

  // Sellers need a pickup address for automatic per-mile delivery pricing.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void getMarketplaceProfile(user.id)
      .then((p) => {
        if (alive) setStoreHasAddress(Boolean(p?.store_address || (p?.store_lat != null && p?.store_lng != null)));
      })
      .catch(() => alive && setStoreHasAddress(true));
    return () => {
      alive = false;
    };
  }, [user]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("for-sale");
  const [condition, setCondition] = useState<string>("Good");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [firmPrice, setFirmPrice] = useState(false);
  const [openOffers, setOpenOffers] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [shipping, setShipping] = useState(false);
  const [pickup, setPickup] = useState(true);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [tags, setTags] = useState("");

  const [vehicleKind, setVehicleKind] = useState<string>(VEHICLE_KINDS[0]);
  const [home, setHome] = useState<HomeDetails>(EMPTY_HOME);

  useEffect(() => {
    if (!startsAsFiveUnder) return;
    setListingType("five_under");
    setCategory("for-sale");
    setStep(2);
  }, [startsAsFiveUnder]);

  const [veh, setVeh] = useState<VehicleDetails>({
    year: null,
    make: "",
    model: "",
    mileage: null,
    vin: "",
    transmission: "",
    fuel_type: "",
    title_status: "",
    body_style: "",
    dealer: false,
  });

  useEffect(() => {
    if (!editId || !user) return;
    void (async () => {
      try {
        const row = await getMarketplaceListing(editId, user.id);
        if (!row || row.seller_id !== user.id) {
          toast.error("Listing not found");
          nav("/marketplace");
          return;
        }
        // Legacy ids collapse into the new flows
        const legacy = String(row.listing_type);
        setListingType(
          VEHICLE_LISTING_TYPES.has(legacy) ? "automotive" : HOME_LISTING_TYPES.has(legacy) ? "home" : legacy,
        );
        setTitle(row.title);
        setDescription(row.description);
        setCategory(row.category);
        setCondition(row.condition || "Good");
        setBrand(row.brand || "");
        setModel(row.model || "");
        setColor(row.color || "");
        setPrice(row.price != null ? String(row.price) : "");
        setQuantity(String(row.quantity ?? 1));
        setFirmPrice(row.firm_price);
        setOpenOffers(row.open_to_offers);
        setDelivery(row.delivery);
        setDeliveryFee(row.delivery_fee ? String(row.delivery_fee) : "");
        setShipping(row.shipping);
        setPickup(row.local_pickup);
        setCity(row.city || "");
        setState(row.state || "");
        setZip(row.zip || "");
        setTags((row.tags || []).join(", "));
        const attrs = (row.attributes || {}) as Record<string, any>;
        if (attrs.vehicle_kind) setVehicleKind(String(attrs.vehicle_kind));
        if (attrs.home) setHome({ ...EMPTY_HOME, ...attrs.home });
        const urls = row.media?.length ? row.media.map((m) => m.url) : row.cover_url ? [row.cover_url] : [];
        setMedia(urls.map((url) => ({ url })));
        if (row.vehicle) setVeh(row.vehicle);
        setStep(2);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load listing");
      }
    })();
  }, [editId, user, nav]);

  const isVehicle = listingType === "automotive";
  const isHome = listingType === "home";
  const isFiveUnder = listingType === "five_under";
  const isRent = isHome && home.deal === "For rent";

  const photoLimit = isFiveUnder ? 5 : MAX_PHOTOS;

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const remaining = photoLimit - media.length;
    if (remaining <= 0) {
      toast.error(`You can add up to ${photoLimit} photos`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);

    for (const file of list) {
      const localUrl = URL.createObjectURL(file);
      setMedia((m) => [...m, { url: localUrl, local: true }]);
      try {
        setUploadPct(0);
        const compressed = await compressImage(file);
        const url = await uploadListingImage(user.id, compressed, (p) => setUploadPct(Math.round(p)));
        setMedia((m) => m.map((item) => (item.url === localUrl ? { url } : item)));
        URL.revokeObjectURL(localUrl);
      } catch (e: any) {
        setMedia((m) => m.filter((item) => item.url !== localUrl));
        URL.revokeObjectURL(localUrl);
        toast.error(e?.message || "Upload failed — try another photo");
      } finally {
        setUploadPct(null);
      }
    }
  };

  /** One short video is allowed, and it counts as one of the media slots. */
  const onPickVideo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !user) return;
    if (media.some((m) => m.video || isVideoUrl(m.url))) {
      toast.error("You can add one video per item");
      return;
    }
    if (media.length >= photoLimit) {
      toast.error(`You can add up to ${photoLimit} photos or videos`);
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      toast.error("Keep videos under 60MB");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setMedia((m) => [...m, { url: localUrl, local: true, video: true }]);
    try {
      setUploadPct(0);
      const url = await uploadListingImage(user.id, file, (p) => setUploadPct(Math.round(p)));
      setMedia((m) => m.map((item) => (item.url === localUrl ? { url, video: true } : item)));
      URL.revokeObjectURL(localUrl);
    } catch (e: any) {
      setMedia((m) => m.filter((item) => item.url !== localUrl));
      URL.revokeObjectURL(localUrl);
      toast.error(e?.message || "Video upload failed");
    } finally {
      setUploadPct(null);
    }
  };

  const moveMedia = (from: number, to: number) => {
    setMedia((arr) => {
      const next = [...arr];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const buildInput = (status: "draft" | "active"): ListingInput => ({
    listing_type: listingType,
    title,
    description,
    category: isFiveUnder
      ? "for-sale"
      : listingType === "free"
        ? "free"
        : isHome
          ? "rentals"
          : isVehicle
            ? "vehicles"
            : category,
    condition: isHome ? null : condition,
    brand: isHome || isVehicle ? null : brand || null,
    model: isHome || isVehicle ? null : model || null,
    color: isHome || isVehicle ? null : color || null,
    quantity: isFiveUnder ? Number(quantity) : 1,
    price: listingType === "free" ? 0 : price ? Number(price) : null,
    firm_price: firmPrice,
    open_to_offers: isFiveUnder ? false : openOffers,
    delivery,
    delivery_fee: delivery ? Number(deliveryFee || 0) : 0,
    shipping: isHome ? false : shipping,
    local_pickup: isHome ? false : pickup,
    city: city || null,
    state: state || null,
    zip: zip || null,
    location_approx: [city, state].filter(Boolean).join(", ") || null,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    status,
    mediaUrls: media.map((m) => m.url),
    cover_url: media[0]?.url || null,
    attributes: isHome
      ? { home }
      : isVehicle
        ? { vehicle_kind: vehicleKind }
        : isFiveUnder
          ? { five_under: true }
          : {},
    vehicle: isVehicle
      ? {
          ...veh,
          body_style: veh.body_style || vehicleKind,
          year: veh.year ? Number(veh.year) : null,
          mileage: veh.mileage != null ? Number(veh.mileage) : null,
        }
      : null,
  });

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const markErrors = (keys: string[], message: string) => {
    const map: Record<string, boolean> = {};
    for (const k of keys) map[k] = true;
    setFieldErrors(map);
    toast.error(message);
  };

  const priceProblem = () => {
    if (listingType === "free") return null;
    const n = Number(price);
    if (!price || Number.isNaN(n) || n < 0) return "Enter a price";
    if (isFiveUnder && (n < FIVE_UNDER_MIN || n > FIVE_UNDER_MAX)) {
      return `$1–$5 Finds must be priced between $${FIVE_UNDER_MIN} and $${FIVE_UNDER_MAX}`;
    }
    return null;
  };

  const detailProblems = () => {
    const missing: string[] = [];
    if (!title.trim()) missing.push("title");
    if (priceProblem()) missing.push("price");
    if (isFiveUnder && (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1)) missing.push("quantity");
    if (isVehicle) {
      if (!veh.year) missing.push("veh_year");
      if (!(veh.make || "").trim()) missing.push("veh_make");
      if (!(veh.model || "").trim()) missing.push("veh_model");
    }
    if (isHome) {
      if (!home.property_type) missing.push("home_property_type");
      if (!home.bedrooms) missing.push("home_bedrooms");
      if (!home.bathrooms) missing.push("home_bathrooms");
    }
    return missing;
  };

  const detailMessage = (missing: string[]) => {
    if (missing.includes("title")) return "Add a title";
    if (missing.includes("price")) return priceProblem() || "Enter a price";
    if (missing.includes("quantity")) return "How many do you have in stock?";
    if (missing.some((m) => m.startsWith("home_"))) return "Property type, bedrooms and bathrooms are required";
    return "Year, make, and model are required for vehicles";
  };

  /** Per-step gates so Continue / Preview never skip empty required fields. */
  const goNextFromStep = (from: number) => {
    if (from === 2) {
      if (!media.length) {
        markErrors(["photos"], "Add at least one photo");
        return;
      }
      if (media.some((m) => m.local)) {
        toast.error("Wait for photos to finish uploading");
        return;
      }
      setFieldErrors({});
      setStep(3);
      return;
    }
    if (from === 3) {
      const missing = detailProblems();
      if (missing.length) {
        markErrors(missing, detailMessage(missing));
        return;
      }
      setFieldErrors({});
      setStep(4);
      return;
    }
    if (from === 4) {
      if (!city.trim()) {
        markErrors(["city"], "Add a city");
        return;
      }
      setFieldErrors({});
      setStep(5);
    }
  };

  const validate = () => {
    const missing = detailProblems();
    if (!media.length) missing.push("photos");
    if (media.some((m) => m.local)) return "Wait for photos to finish uploading";
    if (!city.trim()) missing.push("city");
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((k) => [k, true])));
      if (missing.includes("photos")) return "Add at least one photo";
      if (missing.includes("city")) return "Add a city";
      return detailMessage(missing);
    }
    setFieldErrors({});
    return null;
  };

  const publish = async (asDraft: boolean) => {
    if (!user) return toast.error("Sign in to list");
    const err = asDraft ? null : validate();
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const input = buildInput(asDraft ? "draft" : "active");
      if (isEdit && editId) {
        await updateMarketplaceListing(editId, user.id, input);
        toast.success(asDraft ? "Draft saved" : "Listing updated");
        nav(`/marketplace/listing/${editId}`);
      } else {
        const row = await createMarketplaceListing(user.id, input);
        toast.success(asDraft ? "Draft saved" : "Listing published");
        nav(`/marketplace/listing/${row.id}`);
      }
    } catch (e: any) {
      const msg = e?.message || "Could not save listing";
      if (/marketplace_profiles|schema cache|does not exist/i.test(msg)) {
        toast.error("Run the marketplace SQL migration in Supabase, then try again.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = useMemo(
    () => ["", "What are you listing?", "Photos", "Details", "Location", "Preview"][step],
    [step],
  );

  const typeEmoji: Record<string, string> = {
    item: "✨",
    automotive: "🚗",
    home: "🏠",
    five_under: "🖐",
    free: "🎁",
  };

  const typeHint: Record<string, string> = {
    item: "Anything you're selling",
    automotive: "Cars, trucks, motorcycles, boats, RVs",
    home: "Home or space for rent or for sale",
    five_under: "Everything $1 to $5, with inventory & cart",
    free: "Give it away",
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
        <p className="font-black">Sign in to sell</p>
        <button type="button" onClick={() => nav("/auth")} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-28 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.18),_transparent_65%)]"
      />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : nav(-1))}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {isEdit ? "Edit listing" : "New listing"} · {step}/5
            </p>
            <h1 className="text-base font-black">{stepTitle}</h1>
          </div>
          <button type="button" onClick={() => nav("/marketplace")} className="rounded-2xl bg-muted p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </header>

      <div className="relative px-4 pt-4">
        {step === 1 && (
          <div className="space-y-2.5">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setListingType(t.id);
                  if (t.id === "free") setCategory("free");
                  if (t.id === "home") setCategory("rentals");
                  if (t.id === "automotive") setCategory("vehicles");
                  if (t.id === "five_under") setCategory("for-sale");
                  setStep(2);
                }}
                className={`flex w-full items-center gap-3 rounded-[1.35rem] border p-4 text-left transition active:scale-[0.99] ${
                  listingType === t.id
                    ? "border-primary bg-primary/10 shadow-[0_12px_30px_-18px_hsl(var(--primary))]"
                    : "border-border/80 bg-card/90"
                }`}
              >
                <span className="text-2xl">{typeEmoji[t.id] || "✨"}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-black leading-snug">{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{typeHint[t.id]}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Up to {photoLimit} photos or videos ({media.length}/{photoLimit} added) — one video allowed. First item is
              the cover, and buyers swipe through the rest.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed py-8 ${
                  fieldErrors.photos
                    ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/40"
                    : "border-border bg-muted/50"
                }`}
              >
                <ImagePlus className={`h-7 w-7 ${fieldErrors.photos ? "text-red-500" : "text-primary"}`} />
                <span className={`text-[13px] font-bold ${fieldErrors.photos ? "text-red-500" : ""}`}>
                  Upload photos
                </span>
                <span className="text-[10.5px] text-muted-foreground">From your library</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    clearFieldError("photos");
                    void onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 py-8">
                <Camera className="h-7 w-7 text-primary" />
                <span className="text-[13px] font-bold">Take a photo</span>
                <span className="text-[10.5px] text-muted-foreground">Use your camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    clearFieldError("photos");
                    void onPickFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 py-4">
                <Video className="h-6 w-6 text-primary" />
                <span className="text-[13px] font-bold">Add a video</span>
                <span className="text-[10.5px] text-muted-foreground">One per item · under 60MB</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    clearFieldError("photos");
                    void onPickVideo(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {fieldErrors.photos && <p className="text-[12px] font-bold text-red-500">Add at least one photo</p>}

            {uploadPct != null && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {media.map((m, i) => (
                <div key={m.url + i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  {m.video || isVideoUrl(m.url) ? (
                    <video src={m.url} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {(m.video || isVideoUrl(m.url)) && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Video
                    </span>
                  )}
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                      Cover
                    </span>
                  )}
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => moveMedia(i, i - 1)}
                        className="rounded bg-black/50 p-1 text-white"
                        aria-label="Move earlier"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                      className="rounded bg-black/50 p-1 text-white"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => goNextFromStep(2)}
              className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {isFiveUnder && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-[12px] font-semibold">
                🖐 $1–$5 Finds · price must be ${FIVE_UNDER_MIN}–${FIVE_UNDER_MAX} and you set the inventory count.
              </div>
            )}
            <Field
              label="Title"
              value={title}
              onChange={(v) => {
                clearFieldError("title");
                setTitle(v);
              }}
              placeholder={isHome ? "e.g. 2 bed apartment in Hollywood" : "What are you selling?"}
              error={fieldErrors.title}
            />
            <div>
              <label className="text-xs font-bold">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
                placeholder={
                  isHome ? "Neighborhood, what's included, rules…" : "Condition, details, reason for selling…"
                }
              />
            </div>

            {!isVehicle && !isHome && listingType !== "free" && !isFiveUnder && (
              <div>
                <label className="text-xs font-bold">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
                >
                  {MARKETPLACE_CATEGORIES.filter((c) => !["vehicles", "free", "rentals"].includes(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isHome && (
              <div>
                <label className="text-xs font-bold">Condition</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        condition === c ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isVehicle && !isHome && (
              <>
                <Field label="Brand" value={brand} onChange={setBrand} optional />
                <Field label="Model" value={model} onChange={setModel} optional />
                <Field label="Color" value={color} onChange={setColor} optional />
              </>
            )}

            {isFiveUnder && (
              <Field
                label="Inventory (how many you have)"
                value={quantity}
                onChange={(v) => {
                  clearFieldError("quantity");
                  setQuantity(v.replace(/[^0-9]/g, ""));
                }}
                type="number"
                min={1}
                step={1}
                error={fieldErrors.quantity}
                placeholder="e.g. 20"
              />
            )}

            {isVehicle && (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-black uppercase text-primary">Automotive details</p>
                <Select
                  label="Vehicle type"
                  value={vehicleKind}
                  onChange={setVehicleKind}
                  options={[...VEHICLE_KINDS]}
                />
                <Field
                  label="Year"
                  value={veh.year != null ? String(veh.year) : ""}
                  onChange={(v) => {
                    clearFieldError("veh_year");
                    setVeh((x) => ({ ...x, year: v ? Number(v) : null }));
                  }}
                  type="number"
                  error={fieldErrors.veh_year}
                />
                <Field
                  label="Make"
                  value={veh.make || ""}
                  onChange={(v) => {
                    clearFieldError("veh_make");
                    setVeh((x) => ({ ...x, make: v }));
                  }}
                  error={fieldErrors.veh_make}
                />
                <Field
                  label="Model"
                  value={veh.model || ""}
                  onChange={(v) => {
                    clearFieldError("veh_model");
                    setVeh((x) => ({ ...x, model: v }));
                  }}
                  error={fieldErrors.veh_model}
                />
                <Field label="Trim" value={veh.trim || ""} onChange={(v) => setVeh((x) => ({ ...x, trim: v }))} optional />
                <Field
                  label="Mileage / Hours"
                  value={veh.mileage != null ? String(veh.mileage) : ""}
                  onChange={(v) => setVeh((x) => ({ ...x, mileage: v ? Number(v) : null }))}
                  type="number"
                  optional
                />
                <Field label="Exterior color" value={veh.exterior_color || ""} onChange={(v) => setVeh((x) => ({ ...x, exterior_color: v }))} optional />
                <Field label="VIN / HIN" value={veh.vin || ""} onChange={(v) => setVeh((x) => ({ ...x, vin: v }))} optional />
                <Field
                  label="Transmission"
                  value={veh.transmission || ""}
                  onChange={(v) => setVeh((x) => ({ ...x, transmission: v }))}
                  optional
                />
                <Field
                  label="Fuel type"
                  value={veh.fuel_type || ""}
                  onChange={(v) => setVeh((x) => ({ ...x, fuel_type: v }))}
                  optional
                />
                <Field
                  label="Title status"
                  value={veh.title_status || ""}
                  onChange={(v) => setVeh((x) => ({ ...x, title_status: v }))}
                  optional
                />
                {(vehicleKind === "Boat" || vehicleKind === "Trailer") && (
                  <Field
                    label="Length (ft)"
                    value={veh.length_ft != null ? String(veh.length_ft) : ""}
                    onChange={(v) => setVeh((x) => ({ ...x, length_ft: v ? Number(v) : null }))}
                    type="number"
                    optional
                  />
                )}
                {vehicleKind === "RV / Camper" && (
                  <Field
                    label="Sleeping capacity"
                    value={veh.sleeping_capacity != null ? String(veh.sleeping_capacity) : ""}
                    onChange={(v) => setVeh((x) => ({ ...x, sleeping_capacity: v ? Number(v) : null }))}
                    type="number"
                    optional
                  />
                )}
              </div>
            )}

            {isHome && (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-black uppercase text-primary">Home or space details</p>
                <div className="flex gap-2">
                  {HOME_DEAL_TYPES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setHome((h) => ({ ...h, deal: d }))}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold ${
                        home.deal === d ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <Select
                  label="Property type"
                  value={home.property_type}
                  onChange={(v) => {
                    clearFieldError("home_property_type");
                    setHome((h) => ({ ...h, property_type: v }));
                  }}
                  options={[...PROPERTY_TYPES]}
                  error={fieldErrors.home_property_type}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Bedrooms"
                    value={home.bedrooms}
                    onChange={(v) => {
                      clearFieldError("home_bedrooms");
                      setHome((h) => ({ ...h, bedrooms: v.replace(/[^0-9]/g, "") }));
                    }}
                    type="number"
                    error={fieldErrors.home_bedrooms}
                  />
                  <Field
                    label="Bathrooms"
                    value={home.bathrooms}
                    onChange={(v) => {
                      clearFieldError("home_bathrooms");
                      setHome((h) => ({ ...h, bathrooms: v.replace(/[^0-9.]/g, "") }));
                    }}
                    error={fieldErrors.home_bathrooms}
                  />
                </div>
                <Field
                  label="Square feet"
                  value={home.square_feet}
                  onChange={(v) => setHome((h) => ({ ...h, square_feet: v.replace(/[^0-9]/g, "") }))}
                  type="number"
                  optional
                />
                <Select label="Laundry type" value={home.laundry} onChange={(v) => setHome((h) => ({ ...h, laundry: v }))} options={[...LAUNDRY_TYPES]} optional />
                <Select label="Parking type" value={home.parking} onChange={(v) => setHome((h) => ({ ...h, parking: v }))} options={[...PARKING_TYPES]} optional />
                <Select label="Air conditioning" value={home.ac} onChange={(v) => setHome((h) => ({ ...h, ac: v }))} options={[...AC_TYPES]} optional />
                <Select label="Heating type" value={home.heating} onChange={(v) => setHome((h) => ({ ...h, heating: v }))} options={[...HEATING_TYPES]} optional />
                {isRent && (
                  <>
                    <Select label="Lease term" value={home.lease_term} onChange={(v) => setHome((h) => ({ ...h, lease_term: v }))} options={[...LEASE_TERMS]} optional />
                    <Field
                      label="Available date"
                      value={home.available_date}
                      onChange={(v) => setHome((h) => ({ ...h, available_date: v }))}
                      type="date"
                      optional
                    />
                  </>
                )}
                <div>
                  <label className="text-xs font-bold">
                    Amenities <span className="font-normal text-muted-foreground">· optional</span>
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {HOME_AMENITIES.map((a) => {
                      const on = home.amenities.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() =>
                            setHome((h) => ({
                              ...h,
                              amenities: on ? h.amenities.filter((x) => x !== a) : [...h.amenities, a],
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            on ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted"
                          }`}
                        >
                          {on ? "✓" : "+"} {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Toggle label="Pets allowed" value={home.pets_allowed} onChange={(v) => setHome((h) => ({ ...h, pets_allowed: v }))} />
                <Toggle
                  label="Keep exact address private"
                  value={home.address_private}
                  onChange={(v) => setHome((h) => ({ ...h, address_private: v }))}
                />
              </div>
            )}

            {listingType !== "free" && (
              <div>
                <Field
                  label={isHome ? (isRent ? "Rent per month ($)" : "Asking price ($)") : "Price ($)"}
                  value={price}
                  onChange={(v) => {
                    setPrice(v);
                    const n = Number(v);
                    if (isFiveUnder && v && (n < FIVE_UNDER_MIN || n > FIVE_UNDER_MAX)) {
                      setFieldErrors((prev) => ({ ...prev, price: true }));
                    } else clearFieldError("price");
                  }}
                  type="number"
                  min={isFiveUnder ? FIVE_UNDER_MIN : 0}
                  max={isFiveUnder ? FIVE_UNDER_MAX : undefined}
                  step="0.01"
                  error={fieldErrors.price}
                />
                {isFiveUnder && price && (Number(price) < FIVE_UNDER_MIN || Number(price) > FIVE_UNDER_MAX) && (
                  <p role="alert" className="mt-1.5 text-xs font-bold text-red-500">
                    Price must be $1 to $5. Items over $5 cannot be published here.
                  </p>
                )}
              </div>
            )}
            {!isFiveUnder && <Toggle label="Firm price" value={firmPrice} onChange={setFirmPrice} />}
            {!isFiveUnder && <Toggle label="Open to offers" value={openOffers} onChange={setOpenOffers} />}
            {!isHome && <Toggle label="Local pickup" value={pickup} onChange={setPickup} />}
            <Toggle label={isHome ? "Tours available" : "Delivery available"} value={delivery} onChange={setDelivery} />
            {delivery && !isHome && (
              <>
                <Field
                  label={isFiveUnder ? "Delivery rate you charge ($ per mile)" : "Delivery fee you charge ($)"}
                  value={deliveryFee}
                  onChange={(v) => setDeliveryFee(v.replace(/[^0-9.]/g, ""))}
                  type="number"
                  min={0}
                  step={0.5}
                  optional
                  placeholder={
                    isFiveUnder ? "e.g. 1 — $1 for every mile" : "e.g. 3 — leave blank for free delivery"
                  }
                />
                <p className="-mt-1 text-[11px] text-muted-foreground">
                  {isFiveUnder
                    ? "This is a per-mile rate, not a flat fee. We use your store address and the buyer's saved location to price delivery automatically."
                    : "Buyers see this fee when they pick delivery at checkout."}
                </p>
                {isFiveUnder && !storeHasAddress && (
                  <button
                    type="button"
                    onClick={() => nav("/marketplace/store-dashboard")}
                    className="-mt-1 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-[11.5px] font-semibold text-amber-700"
                  >
                    Add your store pickup address in My store so delivery prices calculate automatically. Tap to set it.
                  </button>
                )}
              </>

            )}
            {!isHome && <Toggle label="Shipping available" value={shipping} onChange={setShipping} />}
            <Field label="Tags (comma-separated)" value={tags} onChange={setTags} optional />
            <button
              type="button"
              onClick={() => goNextFromStep(3)}
              className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground"
            >
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isHome && home.address_private
                ? "Only the approximate area shows publicly. Share the exact address in chat."
                : "Private sellers show an approximate area only. Exact meetup details stay in chat."}
            </p>
            <Field
              label="City"
              value={city}
              onChange={(v) => {
                clearFieldError("city");
                setCity(v);
              }}
              error={fieldErrors.city}
            />
            <Field label="State" value={state} onChange={setState} />
            <Field label="ZIP" value={zip} onChange={setZip} optional />
            <div className="rounded-2xl border border-border bg-muted/60 p-4 text-center text-xs text-muted-foreground">
              Map preview · approximate neighborhood
              <div className="mt-2 flex h-32 items-center justify-center rounded-xl bg-muted text-2xl">🗺</div>
              <p className="mt-2 font-semibold text-foreground">{[city, state].filter(Boolean).join(", ") || "Add city"}</p>
            </div>
            <button
              type="button"
              onClick={() => goNextFromStep(4)}
              className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground"
            >
              Preview
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_20px_50px_-28px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-[16/11] bg-gradient-to-br from-primary/25 via-muted to-background">
                {media[0] ? (
                  <img src={media[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl opacity-50">✦</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                    {[city, state].filter(Boolean).join(", ") || "Location TBD"}
                  </p>
                  <p className="mt-1 text-xl font-black leading-tight">{title || "Untitled listing"}</p>
                </div>
                <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-black text-foreground shadow-sm">
                  {listingType === "free" ? "Free" : `$${Number(price || 0).toLocaleString()}`}
                  {isHome && isRent ? "/mo" : ""}
                </span>
              </div>
              {isHome && (
                <p className="px-4 pt-3 text-[12px] font-semibold text-muted-foreground">
                  {[home.deal, home.property_type, home.bedrooms && `${home.bedrooms} bd`, home.bathrooms && `${home.bathrooms} ba`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {isFiveUnder && (
                <p className="px-4 pt-3 text-[12px] font-semibold text-primary">
                  $1–$5 Find · {Number(quantity) || 1} in stock
                </p>
              )}
              {description ? (
                <p className="line-clamp-3 px-4 py-3 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish(false)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground shadow-[0_14px_30px_-12px_hsl(var(--primary))] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Publish"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void publish(true)}
              className="w-full text-center text-sm font-bold text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
            >
              Save as draft instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
  optional,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number | string;
  optional?: boolean;
  error?: boolean;
}) {
  return (
    <div>
      <label className={`text-xs font-bold ${error ? "text-red-500" : ""}`}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> · optional</span> : null}
        {error ? <span className="font-semibold text-red-500"> · required</span> : null}
      </label>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error || undefined}
        className={`mt-1 h-11 w-full rounded-xl border bg-muted px-3 text-sm outline-none focus:ring-2 ${
          error
            ? "border-red-500 ring-2 ring-red-500/40 focus:ring-red-500/50"
            : "border-border focus:ring-primary/30"
        }`}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  optional,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optional?: boolean;
  error?: boolean;
}) {
  return (
    <div>
      <label className={`text-xs font-bold ${error ? "text-red-500" : ""}`}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> · optional</span> : null}
        {error ? <span className="font-semibold text-red-500"> · required</span> : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 h-11 w-full rounded-xl border bg-muted px-3 text-sm outline-none focus:ring-2 ${
          error ? "border-red-500 ring-2 ring-red-500/40" : "border-border focus:ring-primary/30"
        }`}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold"
    >
      {label}
      <span className={`h-6 w-10 rounded-full p-0.5 transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
