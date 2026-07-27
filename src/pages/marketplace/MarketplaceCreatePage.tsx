import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  CONDITIONS,
  LISTING_TYPES,
  MARKETPLACE_CATEGORIES,
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

type DraftMedia = { url: string; local?: boolean };

export default function MarketplaceCreatePage() {
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const nav = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const [listingType, setListingType] = useState<ListingType | string>("item");
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("for-sale");
  const [condition, setCondition] = useState<string>("Good");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");
  const [firmPrice, setFirmPrice] = useState(false);
  const [openOffers, setOpenOffers] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [pickup, setPickup] = useState(true);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [tags, setTags] = useState("");

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
        setListingType(row.listing_type);
        setTitle(row.title);
        setDescription(row.description);
        setCategory(row.category);
        setCondition(row.condition || "Good");
        setBrand(row.brand || "");
        setModel(row.model || "");
        setColor(row.color || "");
        setPrice(row.price != null ? String(row.price) : "");
        setFirmPrice(row.firm_price);
        setOpenOffers(row.open_to_offers);
        setDelivery(row.delivery);
        setShipping(row.shipping);
        setPickup(row.local_pickup);
        setCity(row.city || "");
        setState(row.state || "");
        setZip(row.zip || "");
        setTags((row.tags || []).join(", "));
        const urls = row.media?.length ? row.media.map((m) => m.url) : row.cover_url ? [row.cover_url] : [];
        setMedia(urls.map((url) => ({ url })));
        if (row.vehicle) setVeh(row.vehicle);
        setStep(2);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load listing");
      }
    })();
  }, [editId, user, nav]);

  const isVehicle = VEHICLE_LISTING_TYPES.has(String(listingType));

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const remaining = MAX_PHOTOS - media.length;
    const list = Array.from(files).slice(0, remaining);
    for (const file of list) {
      try {
        setUploadPct(0);
        const compressed = await compressImage(file);
        const url = await uploadListingImage(user.id, compressed, (p) => setUploadPct(Math.round(p)));
        setMedia((m) => [...m, { url }]);
      } catch (e: any) {
        toast.error(e?.message || "Upload failed");
      } finally {
        setUploadPct(null);
      }
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
    category: listingType === "free" ? "free" : listingType === "rental" ? "rentals" : isVehicle ? "vehicles" : category,
    condition,
    brand: brand || null,
    model: model || null,
    color: color || null,
    price: listingType === "free" ? 0 : price ? Number(price) : null,
    firm_price: firmPrice,
    open_to_offers: openOffers,
    delivery,
    shipping,
    local_pickup: pickup,
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
    vehicle: isVehicle
      ? {
          ...veh,
          year: veh.year ? Number(veh.year) : null,
          mileage: veh.mileage != null ? Number(veh.mileage) : null,
        }
      : null,
  });

  const validate = () => {
    if (!title.trim()) return "Add a title";
    if (!media.length) return "Add at least one photo";
    if (listingType !== "free" && (!price || Number(price) < 0)) return "Enter a price";
    if (isVehicle) {
      if (!veh.year || !veh.make || !veh.model) return "Year, make, and model are required for vehicles";
    }
    if (!city.trim()) return "Add a city";
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
      toast.error(e?.message || "Could not save listing");
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = useMemo(
    () => ["", "Listing type", "Photos", "Details", "Location", "Preview"][step],
    [step],
  );

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
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((s) => s - 1) : nav(-1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase text-primary">
            Step {step} of 5 · {isEdit ? "Edit" : "Sell"}
          </p>
          <h1 className="text-base font-black">{stepTitle}</h1>
        </div>
        <button type="button" onClick={() => nav("/marketplace")} className="rounded-full bg-muted p-2">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="px-4 pt-4">
        {step === 1 && (
          <div className="space-y-2">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setListingType(t.id);
                  if (t.id === "free") setCategory("free");
                  if (t.id === "rental") setCategory("rentals");
                  if (VEHICLE_LISTING_TYPES.has(t.id)) setCategory("vehicles");
                  setStep(2);
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left ${
                  listingType === t.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <span className="text-sm font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Up to {MAX_PHOTOS} photos. First photo is the cover.</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 py-10">
              <ImagePlus className="h-8 w-8 text-primary" />
              <span className="text-sm font-bold">Add photos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => void onPickFiles(e.target.files)}
              />
            </label>
            {uploadPct != null && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {media.map((m, i) => (
                <div key={m.url + i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
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
              disabled={!media.length}
              onClick={() => setStep(3)}
              className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label="Title" value={title} onChange={setTitle} placeholder="What are you selling?" />
            <div>
              <label className="text-xs font-bold">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm"
                placeholder="Condition, details, reason for selling…"
              />
            </div>
            {!isVehicle && listingType !== "free" && listingType !== "rental" && (
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
            {!isVehicle && (
              <>
                <Field label="Brand" value={brand} onChange={setBrand} optional />
                <Field label="Model" value={model} onChange={setModel} optional />
                <Field label="Color" value={color} onChange={setColor} optional />
              </>
            )}
            {isVehicle && (
              <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-black uppercase text-primary">Vehicle details</p>
                <Field
                  label="Year"
                  value={veh.year != null ? String(veh.year) : ""}
                  onChange={(v) => setVeh((x) => ({ ...x, year: v ? Number(v) : null }))}
                  type="number"
                />
                <Field label="Make" value={veh.make || ""} onChange={(v) => setVeh((x) => ({ ...x, make: v }))} />
                <Field label="Model" value={veh.model || ""} onChange={(v) => setVeh((x) => ({ ...x, model: v }))} />
                <Field label="Trim" value={veh.trim || ""} onChange={(v) => setVeh((x) => ({ ...x, trim: v }))} optional />
                <Field
                  label="Mileage"
                  value={veh.mileage != null ? String(veh.mileage) : ""}
                  onChange={(v) => setVeh((x) => ({ ...x, mileage: v ? Number(v) : null }))}
                  type="number"
                />
                <Field label="VIN" value={veh.vin || ""} onChange={(v) => setVeh((x) => ({ ...x, vin: v }))} optional />
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
                {listingType === "motorcycle" && (
                  <Field
                    label="Motorcycle type"
                    value={veh.motorcycle_type || ""}
                    onChange={(v) => setVeh((x) => ({ ...x, motorcycle_type: v }))}
                    optional
                  />
                )}
                {listingType === "boat" && (
                  <>
                    <Field
                      label="Boat type"
                      value={veh.boat_type || ""}
                      onChange={(v) => setVeh((x) => ({ ...x, boat_type: v }))}
                      optional
                    />
                    <Field
                      label="Length (ft)"
                      value={veh.length_ft != null ? String(veh.length_ft) : ""}
                      onChange={(v) => setVeh((x) => ({ ...x, length_ft: v ? Number(v) : null }))}
                      type="number"
                      optional
                    />
                  </>
                )}
                {listingType === "rv" && (
                  <>
                    <Field
                      label="RV type"
                      value={veh.rv_type || ""}
                      onChange={(v) => setVeh((x) => ({ ...x, rv_type: v }))}
                      optional
                    />
                    <Field
                      label="Sleeping capacity"
                      value={veh.sleeping_capacity != null ? String(veh.sleeping_capacity) : ""}
                      onChange={(v) => setVeh((x) => ({ ...x, sleeping_capacity: v ? Number(v) : null }))}
                      type="number"
                      optional
                    />
                  </>
                )}
              </div>
            )}
            {listingType !== "free" && (
              <Field label="Price ($)" value={price} onChange={setPrice} type="number" />
            )}
            <Toggle label="Firm price" value={firmPrice} onChange={setFirmPrice} />
            <Toggle label="Open to offers" value={openOffers} onChange={setOpenOffers} />
            <Toggle label="Local pickup" value={pickup} onChange={setPickup} />
            <Toggle label="Delivery available" value={delivery} onChange={setDelivery} />
            <Toggle label="Shipping available" value={shipping} onChange={setShipping} />
            <Field label="Tags (comma-separated)" value={tags} onChange={setTags} optional />
            <button type="button" onClick={() => setStep(4)} className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground">
              Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Private sellers show an approximate area only. Exact meetup details stay in chat.
            </p>
            <Field label="City" value={city} onChange={setCity} />
            <Field label="State" value={state} onChange={setState} />
            <Field label="ZIP" value={zip} onChange={setZip} optional />
            <div className="rounded-2xl border border-border bg-muted/60 p-4 text-center text-xs text-muted-foreground">
              Map preview · approximate neighborhood
              <div className="mt-2 flex h-32 items-center justify-center rounded-xl bg-muted text-2xl">🗺</div>
              <p className="mt-2 font-semibold text-foreground">{[city, state].filter(Boolean).join(", ") || "Add city"}</p>
            </div>
            <button type="button" onClick={() => setStep(5)} className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground">
              Preview
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border">
              {media[0] && <img src={media[0].url} alt="" className="aspect-[4/3] w-full object-cover" />}
              <div className="space-y-1 p-3">
                <p className="text-xl font-black">{listingType === "free" ? "Free" : `$${Number(price || 0).toLocaleString()}`}</p>
                <p className="font-bold">{title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground">{[city, state].filter(Boolean).join(", ")}</p>
                <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish(true)}
                className="h-12 flex-1 rounded-full bg-muted text-sm font-bold disabled:opacity-60"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void publish(false)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Publish"}
              </button>
            </div>
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
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> · optional</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
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
