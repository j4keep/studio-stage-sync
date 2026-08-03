/** Web screen capture (getDisplayMedia) support — effectively desktop-only today. */

export function canBrowserScreenShare(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

export function screenShareUnsupportedReason(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  if (isIOS) {
    return "Screen share isn’t available on iPhone/iPad. Open this battle on a computer (Chrome, Edge, or desktop Safari) to share your screen.";
  }
  if (isAndroid) {
    return "Screen share isn’t reliable on phone browsers. Open this battle on a computer (Chrome or Edge) to share your screen.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Screen share needs a secure (HTTPS) page.";
  }
  return "Screen share isn’t supported in this browser. Use desktop Chrome, Edge, or Safari.";
}
