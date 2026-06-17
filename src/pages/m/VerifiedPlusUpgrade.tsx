import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Star, Check, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const VerifiedPlusUpgrade = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAlreadySubscribed, setIsAlreadySubscribed] = useState(false);
  const [isPaymentPaused, setIsPaymentPaused] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const benefits = [
    { icon: Star, text: "Gold Verified+ badge on your profile" },
    { icon: Check, text: "Create & donate to fundraising campaigns" },
    { icon: Check, text: "Up to 5 active savings circles" },
    { icon: Check, text: "Up to 100 members per circle" },
    { icon: Check, text: "Profile visibility boost" },
    { icon: Check, text: "Early access to new features" },
  ];

  useEffect(() => {
    // Check URL params for success/cancel
    if (searchParams.get("success") === "true") {
      handleSuccessfulPayment();
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Subscription canceled. You can try again anytime.");
    }
    
    checkSubscriptionStatus();
  }, [searchParams]);

  const checkSubscriptionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCheckingStatus(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-verified-plus", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!error && data) {
        if (data.subscribed) {
          setIsAlreadySubscribed(true);
          setIsPaymentPaused(false);
        } else if (data.payment_status === "past_due") {
          setIsPaymentPaused(true);
          setIsAlreadySubscribed(false);
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSuccessfulPayment = async () => {
    // Verify with Stripe that payment went through
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.functions.invoke("check-verified-plus", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!error && data?.subscribed) {
      // Create success notification
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.functions.invoke("create-notification", {
          body: {
            user_id: user.id,
            title: "Welcome to Verified+ ⭐",
            message: "Your premium membership is now active!",
            type: "success",
          },
        });
      }
      setShowSuccess(true);
      setIsAlreadySubscribed(true);
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to subscribe");
        navigate("/welcome");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-verified-plus-checkout", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Checkout invoke error:", error);
        toast.error("Failed to start checkout. Please try again.");
        setIsProcessing(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setIsProcessing(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("No checkout URL received. Please try again.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in first");
        navigate("/welcome");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || data?.error) {
        toast.error("Failed to open payment portal. Please try again.");
        setIsProcessing(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not open payment portal.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open payment portal.");
      setIsProcessing(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 text-white">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/m/profile')}
            className="shrink-0 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">
            {isPaymentPaused ? "Payment Update Required" : isAlreadySubscribed ? "Verified+ Active" : "Upgrade to Verified+"}
          </h1>
        </div>

        {/* Star Badge */}
        <div className="flex justify-center py-6">
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 blur-xl rounded-full" />
            <div className="relative bg-gradient-to-br from-yellow-300 to-amber-400 rounded-full p-8 shadow-2xl">
              <Star className="h-16 w-16 text-white fill-white" />
            </div>
          </div>
        </div>

        <div className="text-center pb-6">
          <h2 className="text-2xl font-bold mb-2">Verified+</h2>
          <p className="text-white/90 text-sm">
            {isAlreadySubscribed ? "You're a premium member!" : "Premium trusted membership"}
          </p>
        </div>
      </div>

      {/* Benefits */}
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          <h3 className="font-semibold text-lg">Premium Benefits</h3>
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <benefit.icon className="h-5 w-5 text-yellow-500" />
                </div>
                <p className="text-sm">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/20 p-6 text-center">
          <div className="text-4xl font-bold mb-1">$10</div>
          <div className="text-muted-foreground text-sm mb-4">/month</div>
          <p className="text-xs text-muted-foreground">
            Auto-renews. Cancel anytime from your profile.
          </p>
        </div>

        {/* Payment Paused Banner */}
        {isPaymentPaused && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangle className="h-5 w-5" />
              Payment Failed — Features Paused
            </div>
            <p className="text-sm text-muted-foreground">
              Your card was declined or expired. Update your payment method to restore all Verified+ benefits.
            </p>
            <Button
              onClick={handleManageSubscription}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white h-12 text-base font-semibold"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Opening payment portal...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Update Payment Method
                </>
              )}
            </Button>
          </div>
        )}

        {/* Subscribe Button */}
        {isAlreadySubscribed ? (
          <div className="space-y-2">
            <Button
              onClick={() => navigate("/m/profile")}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white h-12 text-base font-semibold shadow-lg"
              size="lg"
            >
              <Check className="mr-2 h-5 w-5" />
              Already Subscribed
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Manage your subscription from your profile settings
            </p>
          </div>
        ) : !isPaymentPaused ? (
          <Button
            onClick={handleSubscribe}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white h-12 text-base font-semibold shadow-lg"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              "Subscribe for $10/month"
            )}
          </Button>
        ) : null}

        {/* Terms */}
        {!isAlreadySubscribed && (
          <p className="text-xs text-center text-muted-foreground px-4">
            By subscribing, you agree to Atchup's{" "}
            <button
              onClick={() => navigate("/m/terms-conditions")}
              className="text-primary underline"
            >
              Terms & Conditions
            </button>{" "}
            and{" "}
            <button
              onClick={() => navigate("/m/privacy-policy")}
              className="text-primary underline"
            >
              Privacy Policy
            </button>
            . Subscriptions auto-renew unless canceled 24 hours before the renewal date.
          </p>
        )}
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full p-4">
                <Star className="h-12 w-12 text-white fill-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              Welcome to Verified+ ⭐
            </DialogTitle>
            <DialogDescription className="text-center">
              Your premium membership is now active! Enjoy all the benefits of being a Verified+ member.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setShowSuccess(false);
              navigate("/m/profile");
            }}
            className="w-full"
          >
            Go to Profile
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerifiedPlusUpgrade;
