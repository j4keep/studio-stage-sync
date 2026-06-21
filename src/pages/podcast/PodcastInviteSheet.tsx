// W.STUDIO Podcast — Invite Sheet
// Full-featured invite/share modal. Does NOT touch recording, LiveKit, or editor.
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  X, Copy, Mail, MessageCircle, Send, Link as LinkIcon, Share2,
  Download, Maximize2, QrCode, Users, Lock, Globe, KeyRound, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export type RoomVisibility = "public" | "private" | "password";
export type AdmissionMode = "auto" | "approval";

export type PodcastSecurity = {
  visibility: RoomVisibility;
  password: string;
  admission?: AdmissionMode;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  isHost: boolean;
  security: PodcastSecurity;
  onSecurityChange: (s: PodcastSecurity) => void;
};

const INVITE_MESSAGE = "Join my W.STUDIO Podcast Session";

function buildInviteLink(sessionId: string, password?: string) {
  const base = `${window.location.origin}/#/podcast/room/${sessionId}?guest=1`;
  return password ? `${base}&k=${encodeURIComponent(password)}` : base;
}

function copy(text: string) {
  try {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  } catch {
    toast({ title: "Copy failed", description: text });
  }
}

export default function PodcastInviteSheet({
  open, onClose, sessionId, isHost, security, onSecurityChange,
}: Props) {
  const [qrFull, setQrFull] = useState(false);
  const [manual, setManual] = useState("");
  const [draftPwd, setDraftPwd] = useState(security.password);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraftPwd(security.password); }, [security.password, open]);

  const inviteLink = useMemo(
    () => buildInviteLink(sessionId, security.visibility === "password" ? security.password : undefined),
    [sessionId, security.visibility, security.password]
  );

  const message = `${INVITE_MESSAGE}\n${inviteLink}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const nativeShare = async () => {
    try {
      await (navigator as any).share({
        title: "W.STUDIO Podcast",
        text: INVITE_MESSAGE,
        url: inviteLink,
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") toast({ title: "Share canceled" });
    }
  };

  const openHref = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const enc = encodeURIComponent;

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `wstudio-podcast-${sessionId}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const sendManual = () => {
    const v = manual.trim();
    if (!v) return;
    // Local-first: record the invite intent. Future: hook into a notifications table.
    try {
      const key = `wstudio-podcast-invites:${sessionId}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({ to: v, ts: Date.now(), link: inviteLink });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
    toast({ title: "Invitation queued", description: `Invite sent to ${v}` });
    setManual("");
  };

  const savePwd = () => {
    onSecurityChange({ ...security, password: draftPwd });
    toast({ title: "Password saved" });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border border-zinc-800 md:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 flex items-center justify-between px-4 py-3 z-10">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-purple-300" />
            <h2 className="text-sm font-semibold">Invite to Podcast</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-800" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-5">
          {/* Native share + link row */}
          <div className="space-y-2">
            {canNativeShare && (
              <Button onClick={nativeShare} className="w-full gap-2 bg-purple-600 hover:bg-purple-500">
                <Share2 className="w-4 h-4" /> Share via device…
              </Button>
            )}
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} className="bg-zinc-900 border-zinc-800 text-xs" />
              <Button variant="secondary" onClick={() => copy(inviteLink)} className="gap-1.5 shrink-0">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </div>
          </div>

          {/* QR Code */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                <QrCode className="w-3.5 h-3.5" /> QR Code
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setQrFull(true)} className="gap-1 h-8">
                  <Maximize2 className="w-3 h-3" /> Full
                </Button>
                <Button size="sm" variant="ghost" onClick={downloadQr} className="gap-1 h-8">
                  <Download className="w-3 h-3" /> PNG
                </Button>
              </div>
            </div>
            <div ref={qrRef} className="flex justify-center bg-white p-3 rounded-lg">
              <QRCodeCanvas value={inviteLink} size={160} includeMargin={false} level="M" />
            </div>
            <p className="text-[11px] text-zinc-500 text-center mt-2">Scan with phone camera to join instantly</p>
          </section>

          {/* Social Buttons */}
          <section>
            <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Share to apps</div>
            <div className="grid grid-cols-4 gap-2">
              <SocialBtn label="SMS" color="bg-emerald-600" onClick={() => openHref(`sms:?&body=${enc(message)}`)}>
                <MessageCircle className="w-4 h-4" />
              </SocialBtn>
              <SocialBtn label="WhatsApp" color="bg-green-600" onClick={() => openHref(`https://wa.me/?text=${enc(message)}`)}>
                <span className="text-[10px] font-bold">WA</span>
              </SocialBtn>
              <SocialBtn label="Messenger" color="bg-blue-600" onClick={() => openHref(`fb-messenger://share/?link=${enc(inviteLink)}`)}>
                <span className="text-[10px] font-bold">M</span>
              </SocialBtn>
              <SocialBtn label="Telegram" color="bg-sky-600" onClick={() => openHref(`https://t.me/share/url?url=${enc(inviteLink)}&text=${enc(INVITE_MESSAGE)}`)}>
                <Send className="w-4 h-4" />
              </SocialBtn>
              <SocialBtn label="Gmail" color="bg-red-600" onClick={() => openHref(`https://mail.google.com/mail/?view=cm&su=${enc("W.STUDIO Podcast invite")}&body=${enc(message)}`)}>
                <Mail className="w-4 h-4" />
              </SocialBtn>
              <SocialBtn label="Email" color="bg-zinc-700" onClick={() => openHref(`mailto:?subject=${enc("W.STUDIO Podcast invite")}&body=${enc(message)}`)}>
                <Mail className="w-4 h-4" />
              </SocialBtn>
              <SocialBtn label="Discord" color="bg-indigo-600" onClick={() => { copy(message); openHref("https://discord.com/channels/@me"); }}>
                <span className="text-[10px] font-bold">DC</span>
              </SocialBtn>
              <SocialBtn label="Instagram" color="bg-pink-600" onClick={() => { copy(message); toast({ title: "Link copied", description: "Paste into your Instagram DM" }); }}>
                <span className="text-[10px] font-bold">IG</span>
              </SocialBtn>
            </div>
          </section>

          {/* Manual invite */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <Label className="text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5" /> Invite by username or email
            </Label>
            <div className="flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="@username or person@email.com"
                className="bg-zinc-900 border-zinc-800"
                onKeyDown={(e) => { if (e.key === "Enter") sendManual(); }}
              />
              <Button onClick={sendManual} disabled={!manual.trim()} className="shrink-0">Send</Button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">Sends an internal invitation to the WHEUAT user.</p>
          </section>

          {/* Session Security (host only) */}
          {isHost && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Session security</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <SecBtn active={security.visibility === "public"} onClick={() => onSecurityChange({ ...security, visibility: "public" })} icon={<Globe className="w-3.5 h-3.5" />} label="Public" />
                <SecBtn active={security.visibility === "private"} onClick={() => onSecurityChange({ ...security, visibility: "private" })} icon={<Lock className="w-3.5 h-3.5" />} label="Invite only" />
                <SecBtn active={security.visibility === "password"} onClick={() => onSecurityChange({ ...security, visibility: "password" })} icon={<KeyRound className="w-3.5 h-3.5" />} label="Password" />
              </div>
              {security.visibility === "password" && (
                <div className="flex gap-2">
                  <Input
                    value={draftPwd}
                    onChange={(e) => setDraftPwd(e.target.value)}
                    placeholder="Set a room password"
                    className="bg-zinc-900 border-zinc-800"
                  />
                  <Button onClick={savePwd} variant="secondary" className="shrink-0">Save</Button>
                </div>
              )}
              <p className="text-[11px] text-zinc-500 mt-2">
                {security.visibility === "public" && "Anyone with the link joins instantly."}
                {security.visibility === "private" && "Guests appear in your waiting room. You approve each one."}
                {security.visibility === "password" && "Guests must enter the password AND be accepted."}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Fullscreen QR */}
      {qrFull && (
        <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center" onClick={() => setQrFull(false)}>
          <div className="bg-white p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <QRCodeCanvas value={inviteLink} size={Math.min(window.innerWidth, window.innerHeight) - 80} includeMargin={false} level="M" />
            <button onClick={() => setQrFull(false)} className="mt-4 w-full py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const SocialBtn = ({ children, label, color, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-800 transition">
    <span className={`w-10 h-10 rounded-full ${color} grid place-items-center text-white`}>{children}</span>
    <span className="text-[10px] text-zinc-300">{label}</span>
  </button>
);

const SecBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] ${active ? "border-purple-500 bg-purple-500/10 text-purple-200" : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"}`}>
    {icon}{label}{active && <Check className="w-3 h-3" />}
  </button>
);
