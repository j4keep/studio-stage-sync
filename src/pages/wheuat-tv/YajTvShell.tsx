import { ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Search, Bookmark, Home, User, Upload, ArrowLeft } from "lucide-react";
import { YajTvCategoryModal } from "./YajTvCategoryModal";
import { CATEGORY_LABELS, type CategorySelection } from "./yajTvMeta";

type ShellProps = {
  children: ReactNode;
  /** Shown under "YAJ.TV" as a tappable category pill. Omit to hide it. */
  category?: CategorySelection;
  onCategoryChange?: (c: CategorySelection) => void;
  /** Replace the default "YAJ.TV" header with a back button + custom title (detail/search/etc). */
  headerTitle?: string;
  showBack?: boolean;
};

const TABS = [
  { path: "/tv", label: "Home", Icon: Home },
  { path: "/tv/search", label: "Search", Icon: Search },
  { path: "/tv/list", label: "My List", Icon: Bookmark },
  { path: "/profile", label: "Profile", Icon: User },
];

export function YajTvShell({ children, category, onCategoryChange, headerTitle, showBack }: ShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <header className="shrink-0 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        {headerTitle ? (
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h1 className="truncate text-lg font-bold">{headerTitle}</h1>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-black tracking-tight text-white">
              YAJ<span className="text-primary">.TV</span>
            </h1>
            <button
              onClick={() => navigate("/tv/manage")}
              aria-label="Creator studio"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:scale-95"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        )}

        {category && onCategoryChange && (
          <button
            onClick={() => setModalOpen(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-white/90 active:scale-95"
          >
            {CATEGORY_LABELS[category]}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
        {children}
      </main>

      <nav
        aria-label="YAJ.TV"
        className="fixed inset-x-0 bottom-0 z-[65] border-t border-white/10 bg-black/95 backdrop-blur-xl safe-area-bottom"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {TABS.map((tab) => {
            const active =
              tab.path === "/tv" ? location.pathname === "/tv" : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 ${
                  active ? "text-white" : "text-white/45"
                }`}
              >
                <tab.Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {category && onCategoryChange && (
        <YajTvCategoryModal
          open={modalOpen}
          current={category}
          onSelect={onCategoryChange}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
