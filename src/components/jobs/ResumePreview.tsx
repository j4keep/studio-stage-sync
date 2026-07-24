import type { ResumeAiResult } from "@/lib/yaj-jobs-ai";

/** Read-only structured résumé for employers reviewing applications. */
export default function ResumePreview({ data, className = "" }: { data: any; className?: string }) {
  if (!data || typeof data !== "object") return null;
  const resume = data as ResumeAiResult;
  const hasContent =
    resume.summary ||
    (resume.skills && resume.skills.length > 0) ||
    (resume.experience && resume.experience.length > 0) ||
    (resume.education && resume.education.length > 0) ||
    (resume.certifications && resume.certifications.length > 0);

  if (!hasContent) return null;

  return (
    <div className={`rounded-xl border border-border bg-background p-3 space-y-3 ${className}`}>
      {resume.summary && (
        <Block title="Summary">
          <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">{resume.summary}</p>
        </Block>
      )}
      {resume.skills && resume.skills.length > 0 && (
        <Block title="Skills">
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-semibold">{s}</span>
            ))}
          </div>
        </Block>
      )}
      {resume.experience && resume.experience.length > 0 && (
        <Block title="Experience">
          <div className="space-y-2">
            {resume.experience.map((e, i) => (
              <div key={i} className="rounded-lg border border-border p-2">
                <p className="text-xs font-bold text-foreground">{e.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {e.company}
                  {e.location ? ` · ${e.location}` : ""} · {e.start} – {e.end}
                </p>
                {e.bullets?.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-foreground/90">
                    {e.bullets.map((b, j) => (
                      <li key={j}>• {b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}
      {resume.education && resume.education.length > 0 && (
        <Block title="Education">
          {resume.education.map((ed, i) => (
            <p key={i} className="text-[11px]">
              <span className="font-semibold text-foreground">{ed.degree}</span> — {ed.school}{" "}
              <span className="text-muted-foreground">
                ({ed.start}–{ed.end})
              </span>
            </p>
          ))}
        </Block>
      )}
      {resume.certifications && resume.certifications.length > 0 && (
        <Block title="Certifications">
          <ul className="text-[11px] space-y-0.5">
            {resume.certifications.map((c, i) => (
              <li key={i}>• {c}</li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {children}
    </div>
  );
}
