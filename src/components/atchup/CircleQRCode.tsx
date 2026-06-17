import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CircleQRCodeProps {
  inviteCode: string;
  circleName: string;
}

const CircleQRCode = ({ inviteCode, circleName }: CircleQRCodeProps) => {
  const { toast } = useToast();
  
  // Create a deep link URL for the QR code
  const joinUrl = `${window.location.origin}/m/savings-circles/join?code=${inviteCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard"
    });
  };

  const shareInvite = async () => {
    const shareData = {
      title: `Join ${circleName} on Atchup`,
      text: `Hey! Join my savings circle "${circleName}" on Atchup. Use code: ${inviteCode}`,
      url: joinUrl
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({
          title: "Shared!",
          description: "Invite sent successfully"
        });
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          toast({
            title: "Share failed",
            description: "Couldn't share. Try copying the code instead.",
            variant: "destructive"
          });
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      copyCode();
      toast({
        title: "Code copied!",
        description: "Share not supported on this device. Code copied to clipboard."
      });
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById("circle-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${circleName}-qr-code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
      <h3 className="text-white font-semibold mb-4 text-center">Scan to Join</h3>
      
      <div className="flex justify-center mb-4">
        <div className="bg-white p-4 rounded-lg">
          <QRCodeSVG
            id="circle-qr-code"
            value={joinUrl}
            size={180}
            level="H"
            includeMargin={false}
          />
        </div>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm text-gray-400 mb-2">Or share the code:</p>
        <div className="bg-gray-900 px-4 py-3 rounded-lg">
          <p className="text-3xl font-mono text-purple-400 tracking-widest font-bold">
            {inviteCode}
          </p>
        </div>
      </div>

      {/* Primary share button */}
      <Button 
        onClick={shareInvite}
        className="w-full mb-3 bg-primary hover:bg-primary/90"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share with Friends & Family
      </Button>

      <div className="flex gap-2">
        <Button 
          onClick={copyCode}
          variant="outline"
          className="flex-1 border-border"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </Button>
        <Button 
          onClick={downloadQR}
          variant="outline"
          className="flex-1 border-border"
        >
          <Download className="w-4 h-4 mr-2" />
          Save QR
        </Button>
      </div>
    </div>
  );
};

export default CircleQRCode;
