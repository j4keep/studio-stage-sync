import { useNavigate } from "react-router-dom";
import { AlertTriangle, Star, CreditCard, MessageCircle, Users, Shield, Sparkles, BadgeCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SubscriptionPausedCardProps {
  open: boolean;
  onClose: () => void;
}

const restrictedFeatures = [
  { icon: BadgeCheck, text: "Gold Verified+ badge on your profile" },
  { icon: Star, text: "Create & donate to fundraising campaigns" },
  { icon: Users, text: "Up to 5 active savings circles" },
  { icon: Users, text: "Up to 100 members per circle" },
  { icon: Sparkles, text: "Profile visibility boost" },
  { icon: Shield, text: "Early access to new features" },
];

const SubscriptionPausedCard = ({ open, onClose }: SubscriptionPausedCardProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-destructive/30">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-full p-4">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-lg">
            Verified+ Paused — Payment Required
          </DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p className="text-sm">
              Your payment method failed or needs updating. Your Verified+ benefits are paused until payment is resolved.
            </p>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive flex items-center justify-center gap-2 font-medium">
                <CreditCard className="h-4 w-4" />
                Update your payment to restore access
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Features paused until payment is updated:
              </p>
              <ul className="space-y-2">
                {restrictedFeatures.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <feature.icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <span className="line-through">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Button
            onClick={() => {
              onClose();
              navigate("/m/verified-plus-upgrade");
            }}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Update Payment Method
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-muted-foreground"
          >
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPausedCard;
