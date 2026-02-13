import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Plus, Trash2, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import album1 from "@/assets/album-1.jpg";
import album3 from "@/assets/album-3.jpg";
import album5 from "@/assets/album-5.jpg";

const initialProducts = [
  { id: "1", title: "Midnight Flow (WAV)", type: "Digital Download", price: "$2.99", sales: 34, img: album1 },
  { id: "2", title: "Rise Above (Stems)", type: "Beat Pack", price: "$14.99", sales: 12, img: album3 },
  { id: "3", title: "Full Album Bundle", type: "Album", price: "$9.99", sales: 89, img: album5 },
];

const MyStorePage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState(initialProducts);
  const [showAdd, setShowAdd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast({ title: "File selected", description: `"${file.name}" ready to attach` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {showAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          <p className="text-sm font-semibold text-foreground mb-3">Add Product</p>
          <div className="flex flex-col gap-3">
            <input placeholder="Product name" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <select className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground">
              <option>Digital Download</option>
              <option>Beat Pack</option>
              <option>Album</option>
              <option>Merchandise</option>
            </select>
            <input placeholder="Price ($)" type="number" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-lg bg-card border border-border text-xs text-muted-foreground flex items-center justify-center gap-1.5 hover:border-primary/50 transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
            <button className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">List Product</button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {products.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
          >
            <img src={p.img} alt={p.title} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
              <p className="text-[10px] text-muted-foreground">{p.type} · {p.sales} sales</p>
            </div>
            <span className="text-xs font-semibold text-primary">{p.price}</span>
            <button onClick={() => removeProduct(p.id)}
              className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </motion.div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="py-12 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No products listed yet</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-primary font-semibold">Add your first product →</button>
        </div>
      )}
    </div>
  );
};

export default MyStorePage;
