import { supabase } from "@/integrations/supabase/client";

export type GigAiResult = {
  title: string;
  description: string;
  category: string;
  tools: string[];
  estimated_hours: number;
  budget_min: number;
  budget_max: number;
  urgency: "today" | "this_week" | "flexible";
  tips: string;
};

export type ResumeAiResult = {
  summary: string;
  skills: string[];
  experience: { title: string; company: string; location?: string; start: string; end: string; bullets: string[] }[];
  education: { school: string; degree: string; start: string; end: string }[];
  certifications: string[];
  links: string[];
};

async function callAi<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("yaj-jobs-ai", { body: payload });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).result as T;
}

/** Convert File → base64 data URL (for photo attachments). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function analyzeGigPhotos(images: string[], notes?: string) {
  return callAi<GigAiResult>({ mode: "gig_assistant", images, notes });
}

export async function buildResume(raw: string, existing?: Partial<ResumeAiResult>) {
  return callAi<ResumeAiResult>({ mode: "resume_builder", raw, existing });
}

export async function generateCoverLetter(job: any, resume?: any, notes?: string) {
  const res = await callAi<{ cover_letter: string }>({ mode: "cover_letter", job, resume, notes });
  return res.cover_letter;
}
