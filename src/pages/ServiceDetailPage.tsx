import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ServiceRow = {
  id: string;
  title: string;
  description: string | null;
  phone: string | null;
  media_url: string | null;
};

export default function ServiceDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [row, setRow] = useState<ServiceRow | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("service_listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setRow((data as ServiceRow) || null);
    })();
  }, [id]);

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading service…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/services")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="truncate text-base font-black">{row.title}</h1>
      </header>
      {row.media_url ? (
        <img src={row.media_url} alt="" className="max-h-[70vh] w-full object-contain bg-black" />
      ) : null}
      <div className="space-y-3 px-4 py-4">
        {row.description ? <p className="text-sm leading-relaxed">{row.description}</p> : null}
        {row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            <Phone className="h-4 w-4" />
            Call {row.phone}
          </a>
        ) : null}
      </div>
    </div>
  );
}
