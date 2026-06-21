import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Star, Trash2, Edit3, Mail, Phone, Building2, UserPlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Contact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  fav?: boolean;
  createdAt: number;
};

const KEY = "wstudio-podcast-contacts";

const load = (): Contact[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const save = (list: Contact[]) => localStorage.setItem(KEY, JSON.stringify(list));

const PodcastContactsPage = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<Contact[]>(load);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => save(list), [list]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    let xs = list;
    if (n) xs = xs.filter((c) => [c.name, c.email, c.phone, c.company].some((v) => v?.toLowerCase().includes(n)));
    return xs.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || a.name.localeCompare(b.name));
  }, [list, q]);

  const upsert = (c: Contact) => {
    setList((xs) => {
      const i = xs.findIndex((x) => x.id === c.id);
      if (i < 0) return [c, ...xs];
      const next = [...xs]; next[i] = c; return next;
    });
  };
  const remove = (id: string) => {
    if (!confirm("Delete this contact?")) return;
    setList((xs) => xs.filter((x) => x.id !== id));
  };
  const toggleFav = (id: string) => setList((xs) => xs.map((x) => x.id === id ? { ...x, fav: !x.fav } : x));

  const sendInvite = async (c: Contact) => {
    const link = `${window.location.origin}/#/tv/podcast`;
    const msg = `Join my W.STUDIO Podcast Session: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "W.STUDIO Podcast", text: msg, url: link }); return; } catch {}
    }
    if (c.email) { window.open(`mailto:${c.email}?subject=${encodeURIComponent("Join my podcast")}&body=${encodeURIComponent(msg)}`); return; }
    if (c.phone) { window.open(`sms:${c.phone}?body=${encodeURIComponent(msg)}`); return; }
    await navigator.clipboard.writeText(link);
    toast({ title: "Invite link copied" });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WHEUAT Studio</div>
            <h1 className="truncate text-2xl font-bold">People · Contacts</h1>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" />Add contact
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone, or company"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <UserPlus className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">No contacts yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add people you want to invite to podcasts and reach faster.</p>
            <Button className="mt-4" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="mr-1 h-4 w-4" />Add your first contact</Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <article key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-purple-500 grid place-items-center text-base font-bold text-primary-foreground">
                    {c.name[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      <button onClick={() => toggleFav(c.id)} title="Favorite" className="text-muted-foreground hover:text-amber-400">
                        <Star className={`h-4 w-4 ${c.fav ? "fill-amber-400 text-amber-400" : ""}`} />
                      </button>
                    </div>
                    {c.company && <p className="truncate text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" />{c.company}</p>}
                    {c.email && <p className="truncate text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{c.email}</p>}
                    {c.phone && <p className="truncate text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button size="sm" onClick={() => sendInvite(c)} className="gap-1"><Send className="h-3.5 w-3.5" />Invite</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(c); setShowForm(true); }} className="gap-1"><Edit3 className="h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(c.id)} className="gap-1"><Trash2 className="h-3.5 w-3.5" />Delete</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <ContactForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(c) => { upsert(c); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

const ContactForm = ({ initial, onClose, onSave }: { initial: Contact | null; onClose: () => void; onSave: (c: Contact) => void }) => {
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [company, setCompany] = useState(initial?.company || "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Name required" }); return; }
    onSave({
      id: initial?.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      fav: initial?.fav || false,
      createdAt: initial?.createdAt || Date.now(),
    });
  };
  return (
    <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">{initial ? "Edit contact" : "Add contact"}</h2>
        <div><label className="text-xs text-muted-foreground">Name *</label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Phone</label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Company</label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" className="flex-1">{initial ? "Save" : "Add"}</Button>
        </div>
      </form>
    </div>
  );
};

export default PodcastContactsPage;
