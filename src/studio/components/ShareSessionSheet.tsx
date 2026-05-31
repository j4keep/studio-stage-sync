import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Mail, MessageSquare, Share2, X, QrCode } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  code: string;
  sessionName?: string;
}

export default function ShareSessionSheet({ open, onClose, shareUrl, code, sessionName }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  if (!open) return null;

  const subject = `Join my W.STUDIO session${sessionName ? `: ${sessionName}` : ""}`;
  const body = `Join my recording session on W.STUDIO.\n\nSession code: ${code}\nLink: ${shareUrl}`;

  const doCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: subject, text: body, url: shareUrl });
      } catch {}
    } else {
      doCopy(shareUrl, "native");
    }
  };

  const options: Array<{ key: string; label: string; icon: React.ReactNode; onClick: () => void }> = [
    {
      key: "qr",
      label: "QR Code",
      icon: <QrCode className="w-5 h-5" />,
      onClick: () => setShowQr((v) => !v),
    },
    {
      key: "sms",
      label: "Text / SMS",
      icon: <MessageSquare className="w-5 h-5" />,
      onClick: () => {
        window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
      },
    },
    {
      key: "email",
      label: "Email",
      icon: <Mail className="w-5 h-5" />,
      onClick: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      },
    },
    {
      key: "native",
      label: typeof navigator !== "undefined" && (navigator as any).share ? "Share…" : "Copy Link",
      icon: <Share2 className="w-5 h-5" />,
      onClick: nativeShare,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="studio-card w-full sm:max-w-md p-5 space-y-5 rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Share Session</h2>
          <button onClick={onClose} className="studio-btn !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Session Code</div>
          <div className="text-3xl font-mono tracking-[0.3em] text-[hsl(var(--studio-blue))] mt-1">{code}</div>
        </div>

        {showQr && (
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl">
            <QRCodeSVG value={shareUrl} size={180} level="M" includeMargin={false} />
            <div className="text-[10px] text-black/60">Scan to join</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={o.onClick}
              className="studio-btn justify-start gap-2"
            >
              {o.icon}
              <span className="text-sm">{o.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Link</div>
          <div className="flex gap-2">
            <input readOnly value={shareUrl} className="studio-input flex-1 font-mono text-xs" />
            <button onClick={() => doCopy(shareUrl, "link")} className="studio-btn">
              {copied === "link" ? <Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={code} className="studio-input flex-1 font-mono text-xs" />
            <button onClick={() => doCopy(code, "code")} className="studio-btn">
              {copied === "code" ? <Check className="w-4 h-4 text-[hsl(var(--studio-green))]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
