import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MapPin, MessageCircle, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import {
  ageFromBirthYear,
  getInterviewBetween,
  getMeetProfile,
  requestInterview,
  type MeetInterviewRequest,
  type MeetProfile,
} from "@/lib/meet";
import { getOrCreateConversation } from "@/lib/messaging";

function MeetProfileInner() {
  const { userId } = useParams<{ userId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<MeetProfile | null | undefined>(undefined);
  const [existing, setExisting] = useState<MeetInterviewRequest | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!userId) return;
    void getMeetProfile(userId).then((p) => {
      setProfile(p);
      setPhotoIndex(0);
    });
  }, [userId]);

  useEffect(() => {
    if (!user?.id || !userId || user.id === userId) return;
    void getInterviewBetween(user.id, userId).then(setExisting);
  }, [user?.id, userId]);

  if (profile === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Profile not found</p>
        <button
          type="button"
          onClick={() => nav("/meet")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Back to Meet
        </button>
      </div>
    );
  }

  const age = ageFromBirthYear(profile.birth_year);
  const photos = profile.photo_urls || [];
  const photo = photos[photoIndex] || photos[0];
  const isSelf = user?.id === profile.user_id;
  const ageOk = age != null && age >= 18;

  if (!ageOk && !isSelf) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">This profile isn’t available</p>
        <p className="text-sm text-muted-foreground">Meet on YAJ only shows adults 18+.</p>
        <button
          type="button"
          onClick={() => nav("/meet")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Back to Meet
        </button>
      </div>
    );
  }

  const askInterview = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      const req = await requestInterview({
        fromUserId: user.id,
        toUserId: profile.user_id,
        message,
      });
      setExisting(req);
      toast({ title: "Interview requested", description: "They’ll see it in their Meet inbox." });
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const messageAfterAccept = async () => {
    if (!user?.id) return;
    try {
      const convId = await getOrCreateConversation(user.id, profile.user_id, { context: "dating" });
      nav("/messages", { state: { openConversationId: convId } });
    } catch (e: any) {
      toast({ title: "Couldn't open chat", description: e?.message, variant: "destructive" });
    }
  };

  const cyclePhoto = (dir: 1 | -1) => {
    if (photos.length <= 1) return;
    setPhotoIndex((i) => (i + dir + photos.length) % photos.length);
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <div className="relative aspect-[4/5] w-full bg-muted">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UserRound className="h-16 w-16 opacity-30" />
          </div>
        )}

        {/* Tap zones to flip through photos */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute inset-y-0 left-0 w-1/3"
              onClick={() => cyclePhoto(-1)}
            />
            <button
              type="button"
              aria-label="Next photo"
              className="absolute inset-y-0 right-0 w-1/3"
              onClick={() => cyclePhoto(1)}
            />
            <div className="absolute left-3 right-3 top-[max(env(safe-area-inset-top),0.75rem)] flex gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`h-0.5 flex-1 rounded-full ${i === photoIndex ? "bg-white" : "bg-white/35"}`}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => nav(-1)}
          className="absolute left-3 top-[max(env(safe-area-inset-top),2.25rem)] rounded-full bg-black/50 p-2 text-white backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-20 text-white">
          <MeetBrandMark className="mb-1 text-white/90 [&_span]:text-white/90" />
          <h1 className="text-2xl font-black">
            {profile.display_name}
            {age != null ? <span className="font-semibold opacity-90">, {age}</span> : null}
          </h1>
          {profile.headline && <p className="text-sm text-white/90">{profile.headline}</p>}
        </div>
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 scrollbar-none">
          {photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setPhotoIndex(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${
                i === photoIndex ? "ring-primary" : "ring-transparent"
              }`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          {profile.city && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1">
              <MapPin className="h-3 w-3" /> {profile.city}
            </span>
          )}
          {profile.looking_for && (
            <span className="rounded-full bg-secondary px-2.5 py-1">{profile.looking_for}</span>
          )}
          {profile.gender && <span className="rounded-full bg-secondary px-2.5 py-1">{profile.gender}</span>}
        </div>

        {profile.bio && (
          <section>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">About</h2>
            <p className="text-sm leading-relaxed text-foreground">{profile.bio}</p>
          </section>
        )}

        {profile.prompt_question && profile.prompt_answer && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {profile.prompt_question}
            </p>
            <p className="mt-1 text-sm font-medium">{profile.prompt_answer}</p>
          </section>
        )}

        {profile.interests.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Interests</h2>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {isSelf ? (
          <button
            type="button"
            onClick={() => nav("/meet/setup")}
            className="w-full rounded-2xl border border-border py-3 text-sm font-bold"
          >
            Edit my profile
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold">Ask to be interviewed</p>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Send a short request. If they accept, you can start a private Meet chat.
            </p>
            {existing ? (
              <div className="space-y-2">
                <p className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold capitalize">
                  Status: {existing.status}
                </p>
                {existing.status === "accepted" && (
                  <button
                    type="button"
                    onClick={() => void messageAfterAccept()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary py-3 text-sm font-black text-primary-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> Open chat
                  </button>
                )}
              </div>
            ) : profile.open_to_interview ? (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey — I'd love a quick interview to see if we vibe…"
                  className="min-h-[80px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  maxLength={280}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void askInterview()}
                  className="w-full rounded-2xl gradient-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send interview request"}
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">This person isn’t taking interview requests right now.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeetProfilePage() {
  return (
    <MeetAdultGate>
      <MeetProfileInner />
    </MeetAdultGate>
  );
}
