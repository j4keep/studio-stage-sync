import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FolderHeart, Plus, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import artist1 from "@/assets/artist-1.jpg";
import artist5 from "@/assets/artist-5.jpg";

const initialProjects = [
  { id: "1", title: "Debut Album Fund", goal: 5000, raised: 3200, backers: 42, daysLeft: 18, img: artist5 },
  { id: "2", title: "Music Video Production", goal: 8000, raised: 5600, backers: 67, daysLeft: 9, img: artist1 },
];

const MyProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);

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
            <input placeholder="Project title" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            <textarea placeholder="Description" rows={2} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none" />
            <div className="flex gap-2">
              <input placeholder="Goal ($)" type="number" className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
              <input placeholder="Days" type="number" className="w-20 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <button className="w-full py-2.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Create Project</button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        {projects.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{p.backers} backers · {p.daysLeft} days left</span>
                </div>
              </div>
              <button onClick={() => removeProject(p.id)}
                className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
              <div className="h-full rounded-full gradient-primary" style={{ width: `${(p.raised / p.goal) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>${p.raised.toLocaleString()} raised</span>
              <span className="text-primary font-medium">{Math.round((p.raised / p.goal) * 100)}%</span>
              <span>${p.goal.toLocaleString()} goal</span>
            </div>
          </motion.div>
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
