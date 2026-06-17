import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  userId: string;
  size?: "sm" | "md" | "lg";
}

type VerificationTier = "none" | "trustworthy" | "premium";

const VerifiedBadge = ({ userId, size = "md" }: VerifiedBadgeProps) => {
  const [tier, setTier] = useState<VerificationTier>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVerificationStatus();
  }, [userId]);

  const loadVerificationStatus = async () => {
    try {
      // Check for active subscription
      const { data: subscription, error } = await supabase
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking subscription:", error);
      }

      if (!subscription) {
        setTier("none");
        setLoading(false);
        return;
      }

      // Check for payment method on file
      const { data: userData } = await supabase
        .from("users")
        .select("has_payment_method")
        .eq("id", userId)
        .single();

      // Premium = subscription + payment method
      // Trustworthy = subscription only (no payment method yet)
      if (userData?.has_payment_method === true) {
        setTier("premium");
      } else {
        setTier("trustworthy");
      }
    } catch (error) {
      console.error("Error loading verification status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || tier === "none") return null;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  // Blue for premium (subscription + payment method)
  // Gray/silver for trustworthy (subscription only)
  const badgeStyles = tier === "premium" 
    ? "bg-blue-500" 
    : "bg-gray-400";

  const tooltipText = tier === "premium"
    ? "Verified+ Premium Member"
    : "Verified+ Subscriber";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center justify-center rounded-full ${badgeStyles} p-0.5`}>
            <Check className={`${iconSizeClasses[size]} text-white stroke-[3]`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerifiedBadge;
