import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import SubscriptionPausedCard from "@/components/atchup/SubscriptionPausedCard";

interface VerifiedPlusGateProps {
  children: React.ReactNode;
  feature: string;
  onAccessGranted?: () => void;
}

const VerifiedPlusGate = ({ children, feature, onAccessGranted }: VerifiedPlusGateProps) => {
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [showPausedCard, setShowPausedCard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-verified-plus", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!error && data) {
        if (data.subscribed) {
          setHasAccess(true);
          setIsPaused(false);
          if (onAccessGranted) onAccessGranted();
        } else if (data.payment_status === "past_due") {
          setHasAccess(false);
          setIsPaused(true);
        } else {
          setHasAccess(false);
          setIsPaused(false);
        }
      }
    } catch (error) {
      console.error("Error checking Verified+ access:", error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!hasAccess) {
      if (isPaused) {
        setShowPausedCard(true);
      } else {
        setShowGate(true);
      }
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <div onClick={handleClick}>
        {children}
      </div>

      <SubscriptionPausedCard
        open={showPausedCard}
        onClose={() => setShowPausedCard(false)}
      />

      <Dialog open={showGate} onOpenChange={setShowGate}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full p-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center">Verified+ Required</DialogTitle>
            <DialogDescription className="text-center space-y-4">
              <p>Upgrade to Verified+ to unlock {feature}.</p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Verified+ benefits:
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Create & donate to fundraisers</li>
                  <li>• Gold Verified+ badge</li>
                  <li>• Up to 5 active savings circles</li>
                  <li>• Up to 100 members per circle</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              onClick={() => {
                setShowGate(false);
                navigate("/m/verified-plus-upgrade");
              }}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            >
              Upgrade to Verified+
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowGate(false)}
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerifiedPlusGate;
