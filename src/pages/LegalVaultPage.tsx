import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Shield, FileText, Upload, Lock, ChevronRight, Plus, CheckCircle, Download, Trash2, Loader2, File, Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Built-in template documents artists can download
const TEMPLATES = [
  {
    id: "song-split",
    title: "Song Split Agreement",
    category: "Split Sheet",
    description: "Define ownership percentages and royalty splits between collaborators on a song.",
    content: `SONG SPLIT AGREEMENT

Date: _______________

Song Title: _______________

This Agreement is entered into by and between the following parties ("Collaborators") regarding the ownership and distribution of royalties for the above-referenced song.

COLLABORATOR INFORMATION:

1. Name: _________________________
   Role: (Writer / Producer / Artist)
   Ownership %: _______%
   PRO Affiliation: _______________
   IPI/CAE #: _______________

2. Name: _________________________
   Role: (Writer / Producer / Artist)
   Ownership %: _______%
   PRO Affiliation: _______________
   IPI/CAE #: _______________

3. Name: _________________________
   Role: (Writer / Producer / Artist)
   Ownership %: _______%
   PRO Affiliation: _______________
   IPI/CAE #: _______________

TOTAL OWNERSHIP: Must equal 100%

TERMS:

1. OWNERSHIP: Each Collaborator shall own the percentage of the Composition as indicated above.

2. ROYALTIES: All royalties, advances, and income derived from the Composition shall be distributed in accordance with the ownership percentages stated herein.

3. CREDIT: Each Collaborator shall receive appropriate credit on all releases of the Composition.

4. DECISIONS: All major decisions regarding the Composition (licensing, sampling, etc.) shall require mutual written consent of all Collaborators.

5. BINDING: This Agreement shall be binding upon and inure to the benefit of the parties and their respective heirs, executors, and assigns.

SIGNATURES:

Collaborator 1: _________________________ Date: __________
Collaborator 2: _________________________ Date: __________
Collaborator 3: _________________________ Date: __________`,
  },
  {
    id: "radio-streaming",
    title: "Radio Streaming Agreement",
    category: "License",
    description: "Agreement for streaming your music on WHEUAT Radio and similar platforms.",
    content: `RADIO STREAMING AGREEMENT

Date: _______________

This Radio Streaming Agreement ("Agreement") is entered into between:

ARTIST/RIGHTS HOLDER ("Licensor"):
Name: _________________________
Address: _________________________
Email: _________________________

PLATFORM ("Licensee"):
WHEUAT Radio / Platform Name: _________________________

GRANT OF LICENSE:

1. The Licensor hereby grants the Licensee a non-exclusive license to stream the following recordings ("Works") on the Licensee's radio platform:

   Track 1: _________________________
   Track 2: _________________________
   Track 3: _________________________
   (Attach additional sheet if necessary)

2. LICENSE TERM: This license shall be effective from __________ to __________ and shall automatically renew unless terminated by either party with 30 days written notice.

3. TERRITORY: Worldwide / Specified Region: _________________________

COMPENSATION:

4. The Licensee shall pay the Licensor:
   [ ] Per-stream rate of $__________
   [ ] Flat monthly fee of $__________
   [ ] Revenue share of __________% of advertising income attributable to the Works

5. Payments shall be made on a monthly basis within 15 days of the end of each calendar month.

RIGHTS & RESTRICTIONS:

6. The Licensee shall not sublicense, sell, or distribute downloads of the Works.
7. The Licensor retains all ownership rights to the Works.
8. The Licensee shall provide play count reports monthly.

TERMINATION:

9. Either party may terminate this Agreement with 30 days written notice.
10. Upon termination, the Licensee shall cease all streaming of the Works within 48 hours.

SIGNATURES:

Licensor: _________________________ Date: __________
Licensee: _________________________ Date: __________`,
  },
  {
    id: "beat-lease",
    title: "Beat Lease Agreement",
    category: "License",
    description: "Standard non-exclusive beat lease terms for producers selling instrumentals.",
    content: `BEAT LEASE AGREEMENT (NON-EXCLUSIVE)

Date: _______________

This Beat Lease Agreement ("Agreement") is made between:

PRODUCER ("Licensor"):
Name: _________________________
Email: _________________________

ARTIST ("Licensee"):
Name: _________________________
Email: _________________________

BEAT INFORMATION:
Beat Title: _________________________
BPM: __________ Key: __________

LICENSE GRANT:

1. The Licensor grants the Licensee a NON-EXCLUSIVE license to use the Beat for the purpose of recording, performing, and distributing one (1) new song ("New Song").

PERMITTED USES:

2. The Licensee may:
   - Distribute up to __________ copies (downloads/streams combined)
   - Perform the New Song at live shows
   - Release the New Song on streaming platforms (Spotify, Apple Music, etc.)
   - Upload to YouTube, SoundCloud, and social media
   - Use for non-commercial music videos

RESTRICTIONS:

3. The Licensee may NOT:
   - Resell, transfer, or sublicense the Beat
   - Claim ownership of the Beat itself
   - Register the Beat with a PRO without the Licensor's information
   - Use the Beat in more than one (1) song

COMPENSATION:

4. The Licensee shall pay a one-time fee of $__________ for this license.
5. No royalties are owed to the Licensor from the New Song.

CREDIT:

6. The Licensee shall credit the Licensor as "Produced by __________" on all releases.

TERM:

7. This license is valid for __________ year(s) from the date of purchase.
8. The Licensor may sell the Beat exclusively to another party, at which point the Licensee will have 60 days to complete any pending releases.

SIGNATURES:

Licensor (Producer): _________________________ Date: __________
Licensee (Artist): _________________________ Date: __________`,
  },
  {
    id: "studio-session",
    title: "Studio Session Release Form",
    category: "Release",
    description: "Release form for studio sessions covering recording rights and liabilities.",
    content: `STUDIO SESSION RELEASE FORM

Date: _______________

STUDIO INFORMATION:
Studio Name: _________________________
Address: _________________________
Engineer on Duty: _________________________

CLIENT INFORMATION:
Name: _________________________
Artist/Band Name: _________________________
Phone: _________________________
Email: _________________________

SESSION DETAILS:
Session Date: _________________________
Start Time: __________ End Time: __________
Total Hours: __________
Hourly Rate: $__________
Total Amount: $__________

TERMS AND CONDITIONS:

1. PAYMENT: Full payment is due at the end of the session unless prior arrangements have been made. A deposit of $__________ is required to secure the booking.

2. CANCELLATION: Sessions cancelled less than 24 hours in advance will be charged 50% of the booking fee. No-shows will be charged the full amount.

3. RECORDINGS: All recordings made during the session are the property of the Client. The Studio retains no ownership rights to the recorded material.

4. EQUIPMENT: The Client agrees to use all studio equipment responsibly. Any damage caused by the Client or their guests will be charged at replacement cost.

5. LIABILITY: The Studio is not responsible for loss or damage to personal equipment brought into the studio by the Client.

6. CONDUCT: No illegal substances are permitted on the premises. The Studio reserves the right to end any session if this policy is violated.

7. GUESTS: A maximum of __________ guests are allowed in the studio during the session. All guests must be approved by studio management.

8. FILES: Session files will be stored for 30 days after the session date. After this period, files may be deleted. The Client is responsible for backing up their own files.

ACKNOWLEDGMENT:
By signing below, I agree to the terms and conditions outlined above.

Client Signature: _________________________ Date: __________
Studio Representative: _________________________ Date: __________`,
  },
];

const LegalVaultPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [viewingDocName, setViewingDocName] = useState<string>("");
  const [loadingView, setLoadingView] = useState(false);

  // Fetch user's uploaded documents
  const { data: userDocs, isLoading } = useQuery({
    queryKey: ["legal-documents", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("legal_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  // Upload document
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const key = `legal/${user.id}/${Date.now()}-${file.name}`;

      // Upload to R2
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "x-upload-key": key,
            "x-upload-content-type": file.type,
          },
          body: file,
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Save metadata
      const { error } = await supabase.from("legal_documents").insert({
        user_id: user.id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        file_url: key,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        is_template: false,
        category: "contract",
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      toast.success("Document uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Download template as .txt
  const downloadTemplate = (template: typeof TEMPLATES[0]) => {
    const blob = new Blob([template.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded "${template.title}"`);
  };

  // View user document from R2
  const viewUserDoc = async (doc: any) => {
    setLoadingView(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(doc.file_url)}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error("Failed to load document");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setViewingDocUrl(url);
      setViewingDocName(doc.file_name || doc.title);
    } catch {
      toast.error("Failed to load document for viewing");
    } finally {
      setLoadingView(false);
    }
  };

  // Download user document from R2
  const downloadUserDoc = async (doc: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(doc.file_url)}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download document");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-xl bg-primary/5 border border-primary/20 mb-5"
      >
        <h2 className="text-base font-display font-bold text-foreground mb-1">Your Document Hub</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload contracts, download ready-made templates, and manage all your legal documents in one secure place. Send agreements to collaborators with ease.
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Templates", value: TEMPLATES.length.toString(), icon: FileText },
          { label: "My Docs", value: (userDocs?.length || 0).toString(), icon: File },
          { label: "Secure", value: "✓", icon: Lock },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold flex items-center justify-center gap-2 mb-5 hover:bg-primary/5 transition-all disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" /> Upload Document
          </>
        )}
      </button>

      {/* Template Documents */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ready-Made Templates</h3>
        <div className="flex flex-col gap-2">
          {TEMPLATES.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                <p className="text-[10px] text-muted-foreground">{t.category} · {t.description.slice(0, 50)}...</p>
              </div>
              <button
                onClick={() => setViewingTemplate(t)}
                className="p-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors shrink-0"
                title="View"
              >
                <Eye className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={() => downloadTemplate(t)}
                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                title="Download"
              >
                <Download className="w-4 h-4 text-primary" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* User Documents */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Documents</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (userDocs || []).length === 0 ? (
          <div className="text-center py-10 bg-card rounded-xl border border-border">
            <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Upload contracts, agreements, and other legal docs</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {userDocs!.map((doc: any) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <File className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.file_type?.split("/").pop()?.toUpperCase() || "FILE"} · {formatFileSize(doc.file_size || 0)} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => viewUserDoc(doc)}
                  disabled={loadingView}
                  className="p-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors shrink-0"
                  title="View"
                >
                  <Eye className="w-4 h-4 text-foreground" />
                </button>
                <button
                  onClick={() => downloadUserDoc(doc)}
                  className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-primary" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Template Viewer Overlay */}
      <AnimatePresence>
        {viewingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-display font-bold text-foreground truncate">{viewingTemplate.title}</h2>
                <p className="text-[10px] text-muted-foreground">{viewingTemplate.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadTemplate(viewingTemplate)}
                  className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <Download className="w-4 h-4 text-primary" />
                </button>
                <button
                  onClick={() => setViewingTemplate(null)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{viewingTemplate.content}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Document Viewer Overlay */}
      <AnimatePresence>
        {viewingDocUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-display font-bold text-foreground truncate flex-1">{viewingDocName}</h2>
              <button
                onClick={() => { URL.revokeObjectURL(viewingDocUrl); setViewingDocUrl(null); }}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe src={viewingDocUrl} className="w-full h-full min-h-[80vh]" title={viewingDocName} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingView && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};

export default LegalVaultPage;
