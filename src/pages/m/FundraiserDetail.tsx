import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Heart, Share2, Clock, Users, DollarSign, MessageCircle, Star, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BottomTabBar from "@/components/BottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { hasActiveVerifiedPlusSubscription } from "@/lib/verifiedPlus";

interface Campaign {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
  cover_image: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

interface Donation {
  id: string;
  amount: number;
  message: string | null;
  anonymous: boolean;
  created_at: string;
  donor?: { name: string; photo_url: string | null };
}

export default function FundraiserDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [creator, setCreator] = useState<{ name: string; photo_url: string | null } | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState("10");
  const [donationMessage, setDonationMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [showSubscriptionGate, setShowSubscriptionGate] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);

  const presets = [5, 10, 25, 50, 100];

  useEffect(() => {
    loadCampaign();
    checkSubscription();
    
    // Check if just donated
    if (searchParams.get("donated") === "true") {
      toast.success("Thank you for your donation!");
    }
  }, [id, searchParams]);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subscribed = await hasActiveVerifiedPlusSubscription(user.id);
      setHasSubscription(subscribed);

      if (!subscribed) {
        setHasPaymentMethod(false);
        return;
      }

      // Also check payment method
      const { data: paymentData } = await supabase.functions.invoke("check-payment-method");
      setHasPaymentMethod(paymentData?.hasPaymentMethod ?? false);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const handleDonateClick = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setShowSubscriptionGate(true);
      return;
    }

    const subscribed = await hasActiveVerifiedPlusSubscription(user.id);
    setHasSubscription(subscribed);

    if (!subscribed) {
      setShowSubscriptionGate(true);
      return;
    }

    if (!hasPaymentMethod) {
      setShowPaymentGate(true);
      return;
    }

    setDonateOpen(true);
  };

  const handleAddPaymentMethod = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error opening payment portal:", error);
      toast.error("Failed to open payment settings");
    }
  };

  const loadCampaign = async () => {
    if (!id) return;

    const { data: campaignData, error } = await supabase
      .from("fundraiser_campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !campaignData) {
      toast.error("Campaign not found");
      navigate("/m/fundraisers");
      return;
    }

    setCampaign(campaignData);

    // Load creator info
    const { data: userData } = await supabase
      .from("users")
      .select("name, photo_url")
      .eq("id", campaignData.user_id)
      .single();

    if (userData) {
      setCreator(userData);
    }

    // Load donations
    const { data: donationsData } = await supabase
      .from("fundraiser_donations")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (donationsData) {
      // Fetch donor info for non-anonymous donations
      const nonAnonDonorIds = donationsData
        .filter(d => !d.anonymous)
        .map(d => d.donor_user_id);

      let donorsMap = new Map();
      if (nonAnonDonorIds.length > 0) {
        const { data: donorsData } = await supabase
          .from("users")
          .select("id, name, photo_url")
          .in("id", nonAnonDonorIds);

        donorsMap = new Map(donorsData?.map(d => [d.id, d]) || []);
      }

      setDonations(
        donationsData.map(d => ({
          ...d,
          donor: d.anonymous ? null : donorsMap.get(d.donor_user_id)
        }))
      );
    }

    setLoading(false);
  };

  const handleDonate = async () => {
    const amount = parseFloat(donationAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Amount must be at least $1");
      return;
    }

    try {
      setProcessing(true);
      
      const { data, error } = await supabase.functions.invoke("create-fundraiser-donation", {
        body: {
          amount: Math.round(amount * 100),
          campaignId: campaign?.id,
          campaignTitle: campaign?.title,
          message: donationMessage,
          anonymous,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        setDonateOpen(false);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to process donation";
      const normalizedMessage = errorMessage.toLowerCase();

      if (
        normalizedMessage.includes("verified+") ||
        normalizedMessage.includes("subscription") ||
        normalizedMessage.includes("row-level security")
      ) {
        setShowSubscriptionGate(true);
      } else {
        toast.error("Failed to process donation: " + errorMessage);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: campaign?.title,
        text: campaign?.description,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const daysLeft = campaign.expires_at 
    ? Math.max(0, differenceInDays(new Date(campaign.expires_at), new Date()))
    : null;
  const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);
  const donorsCount = donations.length;

  return (
    <div className="min-h-screen bg-black pb-24">
      <main className="mx-auto max-w-md">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-purple-500/30">
          <button onClick={() => navigate(-1)} className="p-2 text-white">
            <ChevronLeft size={24} />
          </button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="text-white">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Cover Image */}
        {campaign.cover_image ? (
          <img 
            src={campaign.cover_image} 
            alt={campaign.title}
            className="w-full h-56 object-cover"
          />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-purple-600/30 to-pink-500/30 flex items-center justify-center">
            <Heart className="w-16 h-16 text-purple-400" />
          </div>
        )}

        <div className="px-4 py-6 space-y-6">
          {/* Category & Status */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-purple-500/50 text-purple-300">
              {campaign.category}
            </Badge>
            {daysLeft !== null && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {daysLeft} days left
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>

          {/* Creator */}
          {creator && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/30 overflow-hidden">
                {creator.photo_url ? (
                  <img src={creator.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-semibold">
                    {creator.name?.[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-medium">{creator.name}</p>
                <p className="text-sm text-gray-400">Organizer</p>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="bg-gray-900/50 border border-purple-500/30 rounded-xl p-4 space-y-3">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between items-baseline">
              <div>
                <span className="text-2xl font-bold text-purple-400">
                  ${campaign.raised_amount.toLocaleString()}
                </span>
                <span className="text-gray-400 ml-2">
                  raised of ${campaign.goal_amount.toLocaleString()}
                </span>
              </div>
              <span className="text-sm text-gray-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {donorsCount} donors
              </span>
              {daysLeft !== null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {daysLeft} days to go
                </span>
              )}
            </div>
          </div>

          {/* Donate Button */}
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg"
            onClick={handleDonateClick}
          >
            <Heart className="w-5 h-5 mr-2" />
            Donate Now
          </Button>

          {/* Description */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">About this campaign</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{campaign.description}</p>
          </div>

          {/* Recent Donations */}
          {donations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Recent Donations
              </h2>
              <div className="space-y-3">
                {donations.map(donation => (
                  <div key={donation.id} className="bg-gray-900/50 border border-purple-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-600/30 overflow-hidden">
                          {donation.donor?.photo_url ? (
                            <img src={donation.donor.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-sm">
                              {donation.anonymous ? "?" : donation.donor?.name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                        <span className="text-white font-medium">
                          {donation.anonymous ? "Anonymous" : donation.donor?.name || "Someone"}
                        </span>
                      </div>
                      <span className="text-purple-400 font-semibold">
                        ${donation.amount}
                      </span>
                    </div>
                    {donation.message && (
                      <p className="text-gray-400 text-sm">{donation.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(donation.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Donate Modal */}
      <Dialog open={donateOpen} onOpenChange={setDonateOpen}>
        <DialogContent className="w-full max-w-sm bg-gray-900 border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Heart className="h-5 w-5 text-pink-500" />
              Support this Campaign
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Your donation helps {creator?.name || "the organizer"} reach their goal
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Preset Amounts */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Select amount:</label>
              <div className="grid grid-cols-5 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset}
                    variant={donationAmount === preset.toString() ? "default" : "outline"}
                    onClick={() => setDonationAmount(preset.toString())}
                    className={donationAmount === preset.toString() 
                      ? "bg-purple-600 hover:bg-purple-700" 
                      : "border-purple-500/30 text-white"
                    }
                  >
                    ${preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Custom amount:</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-white">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  className="flex-1 bg-gray-800 border-purple-500/30 text-white"
                />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Leave a message (optional):</label>
              <Textarea
                placeholder="Share some words of encouragement..."
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
                className="bg-gray-800 border-purple-500/30 text-white"
                maxLength={200}
              />
            </div>

            {/* Anonymous */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="anonymous" 
                checked={anonymous}
                onCheckedChange={(checked) => setAnonymous(checked === true)}
              />
              <label htmlFor="anonymous" className="text-sm text-gray-300 cursor-pointer">
                Make my donation anonymous
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setDonateOpen(false)} 
                className="flex-1 border-purple-500/30 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDonate}
                disabled={processing}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {processing ? "Processing..." : `Donate $${donationAmount}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Gate Dialog */}
      <Dialog open={showSubscriptionGate} onOpenChange={setShowSubscriptionGate}>
        <DialogContent className="w-full max-w-sm bg-gray-900 border-purple-500/30">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full p-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-white">Verified+ Required</DialogTitle>
            <DialogDescription className="text-center space-y-4 text-gray-400">
              <p>Upgrade to Verified+ to donate to fundraising campaigns.</p>
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold flex items-center gap-2 text-white">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Verified+ benefits:
                </p>
                <ul className="space-y-1 text-gray-400">
                  <li>• Create fundraising campaigns</li>
                  <li>• Donate to campaigns</li>
                  <li>• Up to 5 active savings circles</li>
                  <li>• Gold Verified+ badge</li>
                  <li>• Priority features & visibility</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              onClick={() => {
                setShowSubscriptionGate(false);
                navigate("/m/verified-plus-upgrade");
              }}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            >
              Upgrade to Verified+
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSubscriptionGate(false)}
              className="w-full text-gray-400"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Gate Dialog */}
      <Dialog open={showPaymentGate} onOpenChange={setShowPaymentGate}>
        <DialogContent className="w-full max-w-sm bg-gray-900 border-purple-500/30">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full p-4">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-white">Payment Method Required</DialogTitle>
            <DialogDescription className="text-center space-y-4 text-gray-400">
              <p>You need a payment method on file to donate to campaigns.</p>
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold flex items-center gap-2 text-white">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Why is this required?
                </p>
                <ul className="space-y-1 text-gray-400">
                  <li>• Process donations securely</li>
                  <li>• Receive payouts for your campaigns</li>
                  <li>• Manage subscription billing</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              onClick={handleAddPaymentMethod}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              Add Payment Method
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowPaymentGate(false)}
              className="w-full text-gray-400"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomTabBar />
    </div>
  );
}
