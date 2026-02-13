import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, Upload, Users, Key, Lock, ChevronRight, Plus, CheckCircle, Download, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import legalDoc1 from "@/assets/legal-doc-1.jpg";
import legalDoc2 from "@/assets/legal-doc-2.jpg";
import legalDoc3 from "@/assets/legal-doc-3.jpg";
import legalDoc4 from "@/assets/legal-doc-4.jpg";

const documents = [
  { name: "Master Recording Agreement", date: "Jan 15, 2026", type: "Contract", signed: true, image: legalDoc1 },
  { name: "Publishing Rights — Midnight Flow", date: "Dec 3, 2025", type: "License", signed: true, image: legalDoc2 },
  { name: "Studio Session Release Form", date: "Nov 20, 2025", type: "Release", signed: false, image: legalDoc3 },
  { name: "Radio Streaming Agreement", date: "Oct 8, 2025", type: "Agreement", signed: true, image: legalDoc4 },
];

const LegalVaultPage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground">Legal Vault</h1>
          <p className="text-[10px] text-muted-foreground">PRO Feature · Secure Document Storage</p>
        </div>
        <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center glow-primary">
          <Shield className="w-4 h-4 text-primary-foreground" />
        </div>
      </div>

      {/* Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-xl bg-primary/5 border border-primary/20 mb-5"
      >
        <h2 className="text-base font-display font-bold text-foreground mb-1">Welcome to Your Vault</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Store and manage your legal documents securely. Contracts, licenses, and agreements — all protected and accessible only to you.
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Documents", value: "4", icon: FileText },
          { label: "Signed", value: "3", icon: CheckCircle },
          { label: "Pending", value: "1", icon: Lock },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload Button */}
      <button className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold flex items-center justify-center gap-2 mb-5 hover:bg-primary/5 transition-all">
        <Plus className="w-4 h-4" /> Upload Document
      </button>

      {/* Documents Grid */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Documents</h3>
        <div className="grid grid-cols-2 gap-3">
          {documents.map((doc, i) => (
            <motion.button
              key={doc.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-xl border border-border hover:border-primary/50 transition-all"
            >
              {/* Document Preview Image */}
              <div className="relative w-full h-48 overflow-hidden bg-card">
                <img
                  src={doc.image}
                  alt={doc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {doc.signed ? (
                    <div className="bg-green-500/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <CheckCircle className="w-3 h-3 text-white inline mr-1" />
                      <span className="text-[10px] font-semibold text-white">Signed</span>
                    </div>
                  ) : (
                    <div className="bg-yellow-500/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="text-[10px] font-semibold text-white">Pending</span>
                    </div>
                  )}
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-semibold text-white truncate">{doc.name}</p>
                  <p className="text-[10px] text-white/70 mt-0.5">{doc.type} · {doc.date}</p>
                </div>
              </div>

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button className="p-2 rounded-lg bg-primary/90 backdrop-blur-sm hover:bg-primary transition-colors">
                  <Eye className="w-4 h-4 text-primary-foreground" />
                </button>
                <button className="p-2 rounded-lg bg-primary/90 backdrop-blur-sm hover:bg-primary transition-colors">
                  <Download className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Setup Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vault Setup</h3>
        <div className="flex flex-col gap-2">
          {[
            { icon: Key, label: "Add Guardians", desc: "Back up your Vault and assets", done: false },
            { icon: Users, label: "Set Up Inheritance", desc: "Designate a Guardian beneficiary", done: false },
            { icon: Lock, label: "Two-Factor Authentication", desc: "Extra security for your vault", done: true },
          ].map((item) => (
            <button
              key={item.label}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              {item.done ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegalVaultPage;
