import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type ServiceRow = {
  id: string;
  title: string;
  description: string | null;
  phone: string | null;
  media_url: string | null;
  created_at: string;
  user_id: string;
};

/** Explore → Services: flyer-style business ads with phone + info. */
export default function ServicesPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("service_listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      setRows([]);
    } else {
      setRows((data as ServiceRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!user) {
      toast.error("Sign in to post a service");
      return;
    }
    if (!title.trim()) {
      toast.error("Add a service title");
      return;
    }
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `services/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (upErr) throw upErr;
        mediaUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await (supabase as any).from("service_listings").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        phone: phone.trim() || null,
        media_url: mediaUrl,
      });
      if (error) throw error;
      toast.success("Service posted");
      setTitle("");
      setDescription("");
      setPhone("");
      setFile(null);
      setShowForm(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not post service");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/explore")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Advertise your craft</p>
            <h1 className="text-lg font-black tracking-tight">Services</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Post
          </button>
        </div>
      </header>

      {showForm ? (
        <div className="space-y-3 border-b border-border px-4 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Service title (e.g. Tax Prep)"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What people should know"
            rows={3}
            className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-muted text-xs font-semibold text-muted-foreground">
            {file ? file.name : "Upload flyer / photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            disabled={posting}
            onClick={() => void publish()}
            className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {posting ? "Posting…" : "Publish service"}
          </button>
        </div>
      ) : null}

      <section className="space-y-3 px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No services yet. Post a flyer to get found on Happening.
          </p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => nav(`/services/${row.id}`)}
              className="w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
            >
              {row.media_url ? (
                <img src={row.media_url} alt="" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-muted text-sm text-muted-foreground">
                  Service flyer
                </div>
              )}
              <div className="space-y-1 px-3 py-2.5">
                <p className="font-bold">{row.title}</p>
                {row.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
                ) : null}
                {row.phone ? (
                  <p className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <Phone className="h-3 w-3" />
                    {row.phone}
                  </p>
                ) : null}
              </div>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
