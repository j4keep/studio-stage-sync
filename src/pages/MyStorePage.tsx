import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Plus, Trash2, Upload, Image, Loader2, Edit3, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StoreProduct {
  id: string;
  title: string;
  type: string;
  price: number;
  cover_url: string | null;
  file_url: string | null;
  file_name: string | null;
  sales: number;
}

const MyStorePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("Digital Download");
  const [formPrice, setFormPrice] = useState("");
  const [formCover, setFormCover] = useState<string | null>(null);
  const [formFileUrl, setFormFileUrl] = useState<string | null>(null);
  const [formFileName, setFormFileName] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_products")
        .select("id, title, type, price, cover_url, file_url, file_name, sales")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Error loading products", description: error.message, variant: "destructive" });
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [user]);

  const compressImage = (file: File, maxSize = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Cover too large", description: "Max 10 MB", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImage(file);
      setFormCover(compressed);
    } catch {
      toast({ title: "Error processing image", variant: "destructive" });
    }
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setFormFileUrl(blobUrl);
    setFormFileName(file.name);
    toast({ title: "File attached", description: `"${file.name}" ready` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setFormTitle("");
    setFormType("Digital Download");
    setFormPrice("");
    setFormCover(null);
    setFormFileUrl(null);
    setFormFileName(null);
    setShowForm(false);
    setEditingId(null);
  };

  const openEdit = (p: StoreProduct) => {
    setEditingId(p.id);
    setFormTitle(p.title);
    setFormType(p.type);
    setFormPrice(p.price.toString());
    setFormCover(p.cover_url);
    setFormFileUrl(p.file_url);
    setFormFileName(p.file_name);
    setShowForm(true);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formTitle.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Enter a valid price", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingId) {
      // Update existing product
      const { error } = await supabase
        .from("store_products")
        .update({
          title: formTitle.trim(),
          type: formType,
          price: priceNum,
          cover_url: formCover,
          file_name: formFileName,
        })
        .eq("id", editingId);

      if (error) {
        toast({ title: "Error updating product", description: error.message, variant: "destructive" });
      } else {
        setProducts(prev =>
          prev.map(p =>
            p.id === editingId
              ? { ...p, title: formTitle.trim(), type: formType, price: priceNum, cover_url: formCover, file_name: formFileName, file_url: formFileUrl }
              : p
          )
        );
        toast({ title: "Product updated!" });
        resetForm();
      }
    } else {
      // Insert new product
      const { data, error } = await supabase
        .from("store_products")
        .insert({
          user_id: user.id,
          title: formTitle.trim(),
          type: formType,
          price: priceNum,
          cover_url: formCover,
          file_name: formFileName,
        })
        .select("id, title, type, price, cover_url, file_url, file_name, sales")
        .single();

      if (error) {
        toast({ title: "Error adding product", description: error.message, variant: "destructive" });
      } else if (data) {
        setProducts(prev => [{ ...data, file_url: formFileUrl }, ...prev]);
        toast({ title: "Product listed!" });
        resetForm();
      }
    }
    setSaving(false);
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("store_products").delete().eq("id", id);
    if (error) {
      toast({ title: "Error removing", description: error.message, variant: "destructive" });
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (editingId === id) resetForm();
    }
  };

  if (!user) {
    return (
      <div className="px-4 pt-20 text-center">
        <p className="text-muted-foreground text-sm">Please log in to manage your store.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Store</h1>
          <p className="text-[10px] text-muted-foreground">{products.length} products listed</p>
        </div>
        <button onClick={openAdd} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">{editingId ? "Edit Product" : "Add Product"}</p>
            <button onClick={resetForm} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => coverInputRef.current?.click()}
              className="w-full aspect-square max-w-[200px] mx-auto rounded-lg bg-background border border-border flex flex-col items-center justify-center gap-1.5 overflow-hidden hover:border-primary/50 transition-all"
            >
              {formCover ? (
                <img src={formCover} alt="Cover" className="w-full h-full object-contain" />
              ) : (
                <>
                  <Image className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload Cover Image</span>
                </>
              )}
            </button>

            <input
              placeholder="Product name"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground"
            />
            <select
              value={formType}
              onChange={e => setFormType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
            >
              <option>Digital Download</option>
              <option>Beat Pack</option>
              <option>Album</option>
              <option>Merchandise</option>
            </select>
            <input
              placeholder="Price ($)"
              type="number"
              min="0"
              step="0.01"
              value={formPrice}
              onChange={e => setFormPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-lg bg-card border border-border text-xs text-muted-foreground flex items-center justify-center gap-1.5 hover:border-primary/50 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              {formFileName ? formFileName : "Upload Downloadable File"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingId ? "Save Changes" : "List Product"}
            </button>
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {products.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => openEdit(p)}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group cursor-pointer"
            >
              {p.cover_url ? (
                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">{p.type} · {p.sales} sales</p>
              </div>
              <span className="text-xs font-semibold text-primary">${p.price.toFixed(2)}</span>
              <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit3 className="w-3 h-3 text-primary" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeProduct(p.id); }}
                className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="py-12 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No products listed yet</p>
          <button onClick={openAdd} className="mt-3 text-xs text-primary font-semibold">Add your first product →</button>
        </div>
      )}
    </div>
  );
};

export default MyStorePage;
