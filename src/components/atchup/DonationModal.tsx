import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  circleName: string;
}

export const DonationModal = ({
  isOpen,
  onClose,
  recipientName,
  circleName,
}: DonationModalProps) => {
  const [amount, setAmount] = useState("5");
  const [isProcessing, setIsProcessing] = useState(false);

  const presets = [1, 3, 5, 10, 20];

  const handleDonate = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast.error("Amount must be at least $1");
      return;
    }

    setIsProcessing(true);
    try {
      const amountInCents = Math.round(parseFloat(amount) * 100);
      
      const { data, error } = await supabase.functions.invoke(
        "create-donation-checkout",
        {
          body: {
            amount: amountInCents,
            recipientName,
            circleName,
          },
        }
      );

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        onClose();
      }
    } catch (error) {
      console.error("Error creating donation:", error);
      toast.error("Failed to start donation. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            Send a Donation
          </DialogTitle>
          <DialogDescription>
            Tip {recipientName} for being part of {circleName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick amounts:</label>
            <div className="grid grid-cols-5 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset.toString() ? "default" : "outline"}
                  onClick={() => setAmount(preset.toString())}
                  className="text-sm"
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Custom amount:
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleDonate}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? "Processing..." : `Donate $${amount}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
