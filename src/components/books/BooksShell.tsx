import type { CSSProperties, ReactNode } from "react";

/** Fixed professional (or playful kids) palette — ignores global YAJ theme tokens. */
export default function BooksShell({
  children,
  variant = "regular",
  className = "",
}: {
  children: ReactNode;
  variant?: "regular" | "kids";
  className?: string;
}) {
  const kids = variant === "kids";
  const style = (
    kids
      ? {
          "--books-bg": "#FFF9F0",
          "--books-surface": "#FFFFFF",
          "--books-ink": "#1F2937",
          "--books-muted": "#6B7280",
          "--books-line": "#FDE68A",
          "--books-accent": "#F97316",
          "--books-accent-ink": "#FFFFFF",
          "--books-soft": "#FFEDD5",
          background: "var(--books-bg)",
          color: "var(--books-ink)",
          fontFamily: '"Nunito", "Trebuchet MS", "Segoe UI", sans-serif',
        }
      : {
          "--books-bg": "#F7F8FA",
          "--books-surface": "#FFFFFF",
          "--books-ink": "#111827",
          "--books-muted": "#6B7280",
          "--books-line": "#E5E7EB",
          "--books-accent": "#1D4ED8",
          "--books-accent-ink": "#FFFFFF",
          "--books-soft": "#EFF6FF",
          background: "var(--books-bg)",
          color: "var(--books-ink)",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }
  ) as CSSProperties;

  return (
    <div className={`min-h-[100dvh] pb-24 ${className}`} style={style}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Nunito:wght@500;700;800&family=Source+Sans+3:wght@400;600;700&display=swap');
      `}</style>
      {children}
    </div>
  );
}
