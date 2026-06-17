import { useNavigate } from "react-router-dom";
import { Star, Lock, Trophy, AlertTriangle, CreditCard, BadgeCheck, Users, Sparkles, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CircleLimitGateProps {
  open: boolean;
  onClose: () => void;
  reason: "max_circles" | "must_upgrade" | "max_members" | "payment_paused";
  completedCount?: number;
}

const pausedFeatures = [
  { icon: BadgeCheck, text: "Gold Verified+ badge on your profile" },
  { icon: Star, text: "Create & donate to fundraising campaigns" },
  { icon: Users, text: "Up to 5 active savings circles" },
  { icon: Users, text: "Up to 100 members per circle" },
  { icon: Sparkles, text: "Profile visibility boost" },
  { icon: Shield, text: "Early access to new features" },
];

const CircleLimitGate = ({ open, onClose, reason, completedCount = 0 }: CircleLimitGateProps) => {
  const navigate = useNavigate();

  if (reason === "payment_paused") {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-card border-destructive/30">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-full p-4">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center">
              Verified+ Paused — Payment Required
            </DialogTitle>
            <DialogDescription className="text-center space-y-4">
              <p>Your payment method failed or needs updating. Your Verified+ benefits are paused until payment is resolved.</p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive flex items-center justify-center gap-2 font-medium">
                  <CreditCard className="h-4 w-4" />
                  Update your payment to restore access
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Features paused:
                </p>
                <ul className="space-y-2">
                  {pausedFeatures.map((feature, i) => (
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
  }

  const getContent = () => {
    switch (reason) {
      case "must_upgrade":
        return {
          icon: Trophy,
          title: "You've Grown! Time to Upgrade",
          description: `Congratulations! You've successfully completed ${completedCount} savings circles. To continue creating circles, upgrade to Verified+.`,
          highlight: "Your track record shows you're a trusted member!",
        };
      case "max_circles":
        return {
          icon: Lock,
          title: "Circle Limit Reached",
          description: "Free accounts can only participate in 1 circle at a time (create or join). Upgrade to Verified+ for $10/month to participate in up to 5 circles.",
          highlight: "Unlock more with Verified+",
        };
      case "max_members":
        return {
          icon: Lock,
          title: "Member Limit",
          description: "Free circles are limited to 10 members. Upgrade to Verified+ for up to 100 members per circle.",
          highlight: "Grow your circles with Verified+",
        };
      default:
        return {
          icon: Lock,
          title: "Upgrade Required",
          description: "This feature requires a Verified+ subscription.",
          highlight: "",
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full p-4">
              <Icon className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center">{content.title}</DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p>{content.description}</p>
            {content.highlight && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-primary flex items-center justify-center gap-2">
                  <Star className="h-4 w-4" />
                  {content.highlight}
                </p>
              </div>
            )}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
              <p className="font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Verified+ Benefits:
              </p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Create up to 5 circles at once</li>
                <li>• Up to 100 members per circle</li>
                <li>• Gold Verified+ badge</li>
                <li>• Priority matching & visibility</li>
                <li>• Join Verified-only circles</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          <Button
            onClick={() => {
              onClose();
              navigate("/m/verified-plus-upgrade");
            }}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
          >
            Upgrade to Verified+ - $10/mo
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-muted-foreground"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CircleLimitGate;
