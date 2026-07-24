import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { buildResume, type ResumeAiResult } from "@/lib/yaj-jobs-ai";

export default function ResumeBuilderPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { user } = useAuth();
  const [raw, setRaw] = useState("");
  const [resume, setResume] = useState<ResumeAiResult | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("resumes").select("id,structured_data")
        .eq("user_id", user.id).eq("is_default", true).maybeSingle();
      if (data) {
        setResumeId(data.id);
        setResume(data.structured_data as ResumeAiResult);
      }
    })();
  }, [user]);

  const generate = async () => {
    if (!raw.trim()) {
      toast.error("Paste some info about your experience first");
      return;
    }
    setLoading(true);
    try {
      const r = await buildResume(raw, resume ?? undefined);
      setResume(r);
      toast.success("Resume generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate resume");
    } finally {
      setLoading(false);
    }
  };

  const save = async (thenReturn = false) => {
    if (!user || !resume) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      structured_data: resume as any,
      is_default: true,
      source: "ai",
      visibility: "private",
    };
    const q = resumeId
      ? supabase.from("resumes").update(payload).eq("id", resumeId)
      : supabase.from("resumes").insert(payload).select("id").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!resumeId && data && (data as any).id) setResumeId((data as any).id);
    toast.success(thenReturn && returnTo ? "Resume saved — attaching to application" : "Resume saved");
    if (thenReturn && returnTo) {
      nav(returnTo.startsWith("/") ? returnTo : `/${returnTo}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => {
            if (returnTo && returnTo.startsWith("/")) nav(returnTo);
            else nav(-1);
          }}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-bold">YAJ AI Resume Builder</h1>
      </header>

      <div className="p-4 pb-32 space-y-4">
        <div className="rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-primary/20 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste your work history, skills, education, or a rough draft. YAJ Buddy will structure it into an ATS-friendly resume.
            {returnTo ? " Save it to attach it to your job application." : ""}
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">Your notes</span>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={7}
            placeholder={`e.g.\nI worked at ABC Coffee 2020-2023 as a shift lead — trained 5 baristas, cut waste 30%.\nBefore that freelance graphic design 2018-2020.\nSkills: Photoshop, Illustrator, POS, customer service.\nAssociates from City College 2018.`}
            className="w-full rounded-xl bg-muted border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
        </label>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Generating…" : resume ? "Regenerate with new info" : "Generate resume"}
        </button>

        {resume && (
          <div className="space-y-4 mt-4">
            <ResumeSection title="Summary">
              <p className="text-sm whitespace-pre-wrap">{resume.summary}</p>
            </ResumeSection>

            {resume.skills?.length > 0 && (
              <ResumeSection title="Skills">
                <div className="flex flex-wrap gap-2">
                  {resume.skills.map((s) => <span key={s} className="px-2 py-1 rounded-full bg-muted text-xs">{s}</span>)}
                </div>
              </ResumeSection>
            )}

            {resume.experience?.length > 0 && (
              <ResumeSection title="Experience">
                <div className="space-y-3">
                  {resume.experience.map((e, i) => (
                    <div key={i} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-bold">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.company}{e.location ? ` · ${e.location}` : ""} · {e.start} – {e.end}</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {e.bullets?.map((b, j) => <li key={j}>• {b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </ResumeSection>
            )}

            {resume.education?.length > 0 && (
              <ResumeSection title="Education">
                {resume.education.map((ed, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-semibold">{ed.degree}</span> — {ed.school} <span className="text-muted-foreground">({ed.start}–{ed.end})</span>
                  </p>
                ))}
              </ResumeSection>
            )}

            {resume.certifications?.length > 0 && (
              <ResumeSection title="Certifications">
                <ul className="text-sm space-y-1">{resume.certifications.map((c, i) => <li key={i}>• {c}</li>)}</ul>
              </ResumeSection>
            )}

            <button
              onClick={() => save(false)}
              disabled={saving}
              className="w-full h-11 rounded-full bg-foreground text-background font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save as my default resume"}
            </button>

            {returnTo && (
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="w-full h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & attach to application"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{title}</h2>
      {children}
    </div>
  );
}
