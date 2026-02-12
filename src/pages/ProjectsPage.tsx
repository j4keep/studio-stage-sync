import { motion } from "framer-motion";
import { FolderHeart, Clock, Users, Gift } from "lucide-react";

const projects = [
  {
    title: "Debut Album: 'Midnight Sessions'",
    artist: "Kaia Noir",
    description: "Help fund the production, mixing, and mastering of my first studio album featuring 12 original tracks.",
    goal: 8000,
    raised: 5600,
    deadline: "Mar 30, 2026",
    backers: 84,
    tiers: ["$10 — Digital Download", "$25 — Signed CD", "$100 — Studio Session"],
  },
  {
    title: "Music Video — 'City Lights'",
    artist: "Zephyr Cole",
    description: "Shooting a cinematic music video in downtown Atlanta. Your support covers filming crew, locations, and post-production.",
    goal: 5000,
    raised: 3200,
    deadline: "Apr 15, 2026",
    backers: 56,
    tiers: ["$5 — Behind the Scenes", "$50 — Credits Feature", "$200 — Premiere Invite"],
  },
  {
    title: "National Tour Fund",
    artist: "Luna Ray",
    description: "Taking my music on the road! 10 cities, 10 shows. Help cover travel, lodging, and venue costs.",
    goal: 15000,
    raised: 4800,
    deadline: "May 1, 2026",
    backers: 42,
    tiers: ["$15 — Tour Merch", "$75 — VIP Meet & Greet", "$500 — Private Show"],
  },
];

const ProjectCard = ({ project }: { project: typeof projects[0] }) => {
  const progress = (project.raised / project.goal) * 100;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-border p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-display font-bold text-foreground">{project.title}</h3>
          <p className="text-xs text-primary mt-0.5">by {project.artist}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{project.description}</p>

      {/* Progress */}
      <div className="mb-3">
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full gradient-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs font-semibold text-foreground">${project.raised.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">${project.goal.toLocaleString()} goal</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {project.backers} backers
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {project.deadline}
        </div>
      </div>

      {/* Reward Tiers */}
      <div className="mb-4">
        <div className="flex items-center gap-1 mb-2">
          <Gift className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground">Reward Tiers</span>
        </div>
        <div className="flex flex-col gap-1">
          {project.tiers.map((t) => (
            <span key={t} className="text-[10px] text-muted-foreground pl-4">• {t}</span>
          ))}
        </div>
      </div>

      <button className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary hover:opacity-90 transition-opacity">
        Contribute
      </button>
    </motion.div>
  );
};

const ProjectsPage = () => {
  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-6">
        <FolderHeart className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">Projects</h1>
      </div>

      <div className="flex flex-col gap-4 mb-4">
        {projects.map((p) => (
          <ProjectCard key={p.title} project={p} />
        ))}
      </div>
    </div>
  );
};

export default ProjectsPage;
