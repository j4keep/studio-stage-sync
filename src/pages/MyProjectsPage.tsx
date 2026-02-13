import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FolderHeart, Plus, Trash2, Users, Clock, Gift, ImagePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import artist1 from "@/assets/artist-1.jpg";
import artist5 from "@/assets/artist-5.jpg";

const categoryOptions = [
  "Album", "Single", "EP", "Music Video", "Tour", "Merch",
  "Studio Time", "Mixing", "Mastering", "Marketing", "Equipment", "Collaboration",
];

const initialProjects = [
  {
    id: "1", title: "Debut Album Fund", description: "Help fund the production and mastering of my first album.", goal: 5000, raised: 3200, backers: 42, deadline: "Apr 10, 2026", img: artist5, categories: ["Album", "Mastering"],
    tiers: ["$10 — Digital Download", "$50 — Signed CD", "$200 — Studio Visit"],
  },
  {
    id: "2", title: "Music Video Production", description: "Shooting a cinematic music video in downtown Atlanta.", goal: 8000, raised: 5600, backers: 67, deadline: "Mar 25, 2026", img: artist1, categories: ["Music Video"],
    tiers: ["$5 — Behind the Scenes", "$50 — Credits Feature", "$200 — Premiere Invite"],
  },
];

type Project = typeof initialProjects[0];

const ProjectCard = ({ project, onRemove }: { project: Project; onRemove: (id: string) => void }) => {
  const progress = (project.raised / project.goal) * 100;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-border overflow-hidden group"
    >
      <div className="relative w-full h-36">
        <img src={project.img} alt={project.title} className="w-full h-full object-cover" />
        <button onClick={() => onRemove(project.id)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-display font-bold text-foreground">{project.title}</h3>
        {project.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {project.categories.map(c => (
              <span key={c} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{c}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{project.description}</p>

        <div className="mt-3 mb-2">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full gradient-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs font-semibold text-foreground">${project.raised.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">${project.goal.toLocaleString()} goal</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><Users className="w-3 h-3" />{project.backers} backers</div>
          <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{project.deadline}</div>
        </div>

        {project.tiers.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Gift className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold text-foreground">Reward Tiers</span>
            </div>
            {project.tiers.map(t => (
              <span key={t} className="block text-[10px] text-muted-foreground pl-4">• {t}</span>
            ))}
          </div>
        )}

        <button className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary hover:opacity-90 transition-opacity">
          Contribute
        </button>
      </div>
    </motion.div>
  );
};

const MyProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newTiers, setNewTiers] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : prev.length < 3 ? [...prev, cat] : prev
    );
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast({ title: "Missing title", description: "Please enter a project title", variant: "destructive" });
      return;
    }
    if (!coverPreview) {
      toast({ title: "Cover required", description: "Please upload a cover image for your project", variant: "destructive" });
      return;
    }
    if (selectedCategories.length === 0) {
      toast({ title: "Category required", description: "Select at least one category", variant: "destructive" });
      return;
    }
    const tiers = newTiers.split("\n").map(t => t.trim()).filter(Boolean);
    const newProject: Project = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim() || "No description provided.",
      goal: parseInt(newGoal) || 1000,
      raised: 0,
      backers: 0,
      deadline: newDeadline.trim() || "TBD",
      img: coverPreview,
      categories: selectedCategories,
      tiers,
    };
    setProjects(prev => [newProject, ...prev]);
    setNewTitle(""); setNewDesc(""); setNewGoal(""); setNewDeadline(""); setNewTiers("");
    setSelectedCategories([]); setCoverPreview(null); setShowCreate(false);
    toast({ title: "Project created!", description: `"${newProject.title}" is now live` });
  };

  const removeProject = (id: string) => setProjects(prev => prev.filter(p => p.id !== id));

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Projects</h1>
          <p className="text-[10px] text-muted-foreground">{projects.length} active projects</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          <p className="text-sm font-semibold text-foreground mb-3">New Project</p>
          <div className="flex flex-col gap-3">
            {/* Cover Image */}
            <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverSelect} />
            <button onClick={() => coverInputRef.current?.click()}
              className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary/40 transition-colors"
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload cover image *</span>
                </>
              )}
            </button>

            <input placeholder="Project title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <textarea placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none" />

            {/* Categories */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Select 1–3 categories *</p>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map(cat => (
                  <button key={cat} onClick={() => toggleCategory(cat)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${selectedCategories.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/40"}`}
                  >{cat}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input placeholder="Goal ($)" type="number" value={newGoal} onChange={e => setNewGoal(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
              <input placeholder="Deadline" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            <textarea placeholder="Reward tiers (one per line, e.g. $10 — Digital Download)" value={newTiers} onChange={e => setNewTiers(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none" />

            <button onClick={handleCreate} className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Create Project</button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-4">
        {projects.map((p, i) => (
          <ProjectCard key={p.id} project={p} onRemove={removeProject} />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="py-12 text-center">
          <FolderHeart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-primary font-semibold">Create your first project →</button>
        </div>
      )}
    </div>
  );
};

export default MyProjectsPage;
