import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Upload, Camera, DollarSign, Calendar, Tag, Star, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { hasActiveVerifiedPlusSubscription } from "@/lib/verifiedPlus";

const CATEGORIES = [
  { value: "emergency", label: "Emergency", icon: "🚨" },
  { value: "medical", label: "Medical", icon: "🏥" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "business", label: "Business", icon: "💼" },
  { value: "community", label: "Community", icon: "🤝" },
  { value: "personal", label: "Personal", icon: "💫" },
  { value: "other", label: "Other", icon: "✨" },
];

export default function CreateFundraiser() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    goalAmount: "",
    expiresIn: "30", // days
    coverImage: null as string | null,
  });

  const [showPaymentGate, setShowPaymentGate] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCheckingAccess(false);
        setShowGate(true);
        return;
      }

      // Check active Verified+ subscription
      const hasSubscription = await hasActiveVerifiedPlusSubscription(user.id);

      if (!hasSubscription) {
        setShowGate(true);
        setCheckingAccess(false);
        return;
      }

      // Check payment method on file
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        "check-payment-method"
      );

      if (paymentError || !paymentData?.hasPaymentMethod) {
        setShowPaymentGate(true);
        setCheckingAccess(false);
        return;
      }

      setHasAccess(true);
    } catch (error) {
      console.error("Error checking access:", error);
      setShowGate(true);
    } finally {
      setCheckingAccess(false);
    }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `fundraiser-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("post-media")
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("post-media")
        .getPublicUrl(data.path);

      setFormData(prev => ({ ...prev, coverImage: publicUrl }));
      toast.success("Image uploaded!");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.category || !formData.goalAmount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const goalAmount = parseFloat(formData.goalAmount);
    if (isNaN(goalAmount) || goalAmount < 10) {
      toast.error("Goal amount must be at least $10");
      return;
    }

    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to create a campaign");
        navigate("/welcome");
        return;
      }

      const expiresAt = formData.expiresIn 
        ? addDays(new Date(), parseInt(formData.expiresIn)).toISOString()
        : null;

      const { data, error } = await supabase
        .from("fundraiser_campaigns")
        .insert({
          user_id: session.user.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          goal_amount: goalAmount,
          cover_image: formData.coverImage,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;

      // Notify followers about new campaign
      notifyFollowers(session.user.id, data.id, formData.title);

      toast.success("Campaign created successfully!");
      navigate(`/m/fundraiser/${data.id}`);
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to create campaign";
      const normalizedMessage = errorMessage.toLowerCase();

      if (
        normalizedMessage.includes("verified+") ||
        normalizedMessage.includes("row-level security")
      ) {
        setShowGate(true);
      } else {
        toast.error("Failed to create campaign: " + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const notifyFollowers = async (creatorId: string, campaignId: string, campaignTitle: string) => {
    try {
      // Get creator's name
      const { data: creatorData } = await supabase
        .from("users")
        .select("name")
        .eq("id", creatorId)
        .single();

      const creatorName = creatorData?.name || "Someone you follow";

      // Get all followers
      const { data: followers } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("following_id", creatorId);

      if (!followers || followers.length === 0) return;

      // Create notifications for each follower with link
      const notifications = followers.map(f => ({
        user_id: f.follower_id,
        title: "New Fundraiser",
        message: `${creatorName} started a new campaign: "${campaignTitle}"`,
        type: "fundraiser_donation",
        link: `/m/fundraiser/${campaignId}`,
      }));

      await supabase.from("notifications").insert(notifications);
    } catch (error) {
      console.error("Failed to notify followers:", error);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Subscription Gate Dialog */}
      <Dialog open={showGate} onOpenChange={(open) => {
        if (!open) navigate(-1);
        setShowGate(open);
      }}>
        <DialogContent className="bg-gray-900 border-purple-500/30">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full p-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-white">Verified+ Required</DialogTitle>
            <DialogDescription className="text-center space-y-4 text-gray-400">
              <p>Upgrade to Verified+ to create fundraising campaigns.</p>
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
                setShowGate(false);
                navigate("/m/verified-plus-upgrade");
              }}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            >
              Upgrade to Verified+
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="w-full text-gray-400"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Gate Dialog */}
      <Dialog open={showPaymentGate} onOpenChange={(open) => {
        if (!open) navigate(-1);
        setShowPaymentGate(open);
      }}>
        <DialogContent className="bg-gray-900 border-purple-500/30">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full p-4">
                <CreditCard className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-white">Payment Method Required</DialogTitle>
            <DialogDescription className="text-center space-y-4 text-gray-400">
              <p>You need a payment method on file to create fundraising campaigns.</p>
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold flex items-center gap-2 text-white">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Why is this required?
                </p>
                <ul className="space-y-1 text-gray-400">
                  <li>• Receive donations directly to your account</li>
                  <li>• Process payouts securely</li>
                  <li>• Manage subscription billing</li>
                  <li>• Enable seamless transactions</li>
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
              onClick={() => navigate(-1)}
              className="w-full text-gray-400"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {hasAccess && !showPaymentGate && (
      <main className="mx-auto max-w-md">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center gap-2 border-b border-purple-500/30">
          <button onClick={() => navigate(-1)} className="p-2 text-white">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Create Fundraiser</h1>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {/* Cover Image */}
          <div className="space-y-2">
            <Label className="text-gray-300">Cover Image</Label>
            <div 
              className="relative w-full h-48 rounded-xl border-2 border-dashed border-purple-500/30 bg-gray-900/50 overflow-hidden cursor-pointer hover:border-purple-500/50 transition-colors"
            >
              {formData.coverImage ? (
                <img 
                  src={formData.coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm">Add a cover image</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white">Uploading...</span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-300">Campaign Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Help me with medical expenses"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-gray-900/50 border-purple-500/30 text-white"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300">Description *</Label>
            <Textarea
              id="description"
              placeholder="Tell your story and explain why you need support..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-gray-900/50 border-purple-500/30 text-white min-h-[120px]"
              maxLength={2000}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-gray-300">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="bg-gray-900/50 border-purple-500/30 text-white">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Goal Amount */}
          <div className="space-y-2">
            <Label htmlFor="goal" className="text-gray-300">Goal Amount *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="goal"
                type="number"
                placeholder="1000"
                value={formData.goalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, goalAmount: e.target.value }))}
                className="pl-10 bg-gray-900/50 border-purple-500/30 text-white"
                min="10"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-gray-300">Campaign Duration</Label>
            <Select
              defaultValue="30"
              value={formData.expiresIn}
              onValueChange={(value) => setFormData(prev => ({ ...prev, expiresIn: value }))}
            >
              <SelectTrigger className="bg-gray-900/50 border-purple-500/30 text-white">
                <SelectValue placeholder="30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            {formData.expiresIn && (
              <p className="text-sm text-gray-400">
                Campaign ends: {format(addDays(new Date(), parseInt(formData.expiresIn)), "MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6"
          >
            {loading ? "Creating..." : "Launch Campaign"}
          </Button>

          <p className="text-center text-sm text-gray-500">
            By creating a campaign, you agree to our Terms of Service
          </p>
        </form>
      </main>
      )}
    </div>
  );
}
