import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Star, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SavingsCircleAgreementDialog from "@/components/atchup/SavingsCircleAgreementDialog";
import MemberReputationPreview from "@/components/atchup/MemberReputationPreview";
import CircleLimitGate from "@/components/atchup/CircleLimitGate";
import { useCircleLimits } from "@/hooks/useCircleLimits";
import { autoFollowCircleMembers } from "@/hooks/useFollow";
import PaymentMethodSelector, { PAYMENT_METHODS } from "@/components/atchup/PaymentMethodSelector";

interface CirclePreview {
  id: string;
  name: string;
  amount_per_period: number;
  frequency: string;
  max_members: number;
  current_members: number;
  status: string;
  owner_id: string;
  requires_verified_plus: boolean;
  allowed_payment_methods: string[] | null;
}

interface OwnerInfo {
  id: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
}

const JoinCircle = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const limits = useCircleLimits();
  const [code, setCode] = useState(searchParams.get('code') || "");
  const [circle, setCircle] = useState<CirclePreview | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showAgreement, setShowAgreement] = useState(true); // Always show on load
  const [hasAccepted, setHasAccepted] = useState(false);
  const [showLimitGate, setShowLimitGate] = useState(false);
  const [limitReason, setLimitReason] = useState<"max_circles" | "must_upgrade" | "max_members">("must_upgrade");
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [readyToJoin, setReadyToJoin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-check if code is in URL and user has accepted terms
  useEffect(() => {
    if (code && code.length === 8 && hasAccepted && !circle) {
      checkCircle();
    }
  }, [hasAccepted]);

  // When circle is found and payment method is selected, set ready to join
  useEffect(() => {
    if (circle && selectedPaymentMethod) {
      setReadyToJoin(true);
    }
  }, [circle, selectedPaymentMethod]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/welcome');
      return;
    }
  };

  const handleAcceptTerms = () => {
    setShowAgreement(false);
    setHasAccepted(true);
    // If we don't have a circle yet, user will enter code first
    // If we have a circle (from URL code), show payment method selector
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
    setShowPaymentMethodSelector(false);
  };

  const handlePaymentMethodCancel = () => {
    // User cancelled payment method selection, go back
    navigate('/m/savings-circles');
  };

  // Show payment method selector when circle is found but no payment method selected
  const promptPaymentMethodSelection = () => {
    setShowPaymentMethodSelector(true);
  };

  const checkCircle = async () => {
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode) {
      toast({
        title: "Error",
        description: "Please enter a circle code",
        variant: "destructive"
      });
      return;
    }

    // Code should be 8 characters
    if (trimmedCode.length !== 8) {
      toast({
        title: "Invalid code format",
        description: `Code should be 8 characters (currently ${trimmedCode.length})`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Looking for circle with code:', trimmedCode);
      
      const { data, error } = await supabase
        .from('savings_circles')
        .select('*')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

      console.log('Query result:', { data, error });

      if (error) {
        console.error('Database error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        setCircle(null);
        return;
      }

      if (!data) {
        toast({
          title: "Circle not found",
          description: "Please check the code and try again. Make sure you copied the entire code.",
          variant: "destructive"
        });
        setCircle(null);
        setOwnerInfo(null);
        return;
      }

      setCircle(data);

      // Fetch owner info
      const { data: owner } = await supabase
        .from('users')
        .select('id, name, tagline, avatar_url')
        .eq('id', data.owner_id)
        .single();
      
      setOwnerInfo(owner);

      // Show payment method selector after circle is found
      if (!selectedPaymentMethod) {
        setShowPaymentMethodSelector(true);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const notifyCircleMembers = async (circleId: string, newMemberUserId: string, newMemberName: string, circleName: string) => {
    try {
      // Get all existing members except the new member
      const { data: members } = await supabase
        .from('savings_circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .neq('user_id', newMemberUserId);

      if (!members || members.length === 0) return;

      // Create notifications for each member with link to circle
      const notifications = members.map(m => ({
        user_id: m.user_id,
        title: "New Member Joined",
        message: `${newMemberName} just joined "${circleName}"`,
        type: "member_joined",
        link: `/m/savings-circles/${circleId}`,
      }));

      await supabase.from("notifications").insert(notifications);
    } catch (error) {
      console.error("Failed to notify circle members:", error);
    }
  };

  const joinCircle = async () => {
    if (!circle) return;

    // Check if must upgrade after 2 completed circles
    if (limits.mustUpgrade) {
      setLimitReason("must_upgrade");
      setShowLimitGate(true);
      return;
    }

    // Check if free user has reached their 1 circle limit (create OR join)
    if (!limits.canJoinCircle) {
      setLimitReason("max_circles");
      setShowLimitGate(true);
      return;
    }

    // Check if circle requires Verified+ and user doesn't have it
    if (circle.requires_verified_plus && !limits.isVerifiedPlus) {
      toast({
        title: "Verified+ Required",
        description: "This circle requires Verified+ membership to join.",
        variant: "destructive",
      });
      setShowLimitGate(true);
      setLimitReason("must_upgrade");
      return;
    }

    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('savings_circle_members')
        .select('id')
        .eq('circle_id', circle.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast({
          title: "Already a member",
          description: "You're already part of this circle",
          variant: "destructive"
        });
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user.id)
        .single();

      const nextPosition = circle.current_members + 1;

      // Add member with payment method
      const { error: memberError } = await supabase
        .from('savings_circle_members')
        .insert({
          circle_id: circle.id,
          user_id: user.id,
          display_name: userData?.name || userData?.email || 'Member',
          position: nextPosition,
          payment_method: selectedPaymentMethod
        });

      if (memberError) throw memberError;

      // Update circle
      const isFull = nextPosition === circle.max_members;
      const { error: updateError } = await supabase
        .from('savings_circles')
        .update({
          current_members: nextPosition,
          status: isFull ? 'active' : 'forming'
        })
        .eq('id', circle.id);

      if (updateError) throw updateError;

      // If circle is now active, update first period
      if (isFull) {
        await supabase
          .from('savings_circle_periods')
          .update({ status: 'current' })
          .eq('circle_id', circle.id)
          .eq('period_number', 1);
      }

      // Auto-follow all circle members
      await autoFollowCircleMembers(circle.id, user.id);

      // Notify circle owner and other members that someone joined
      await notifyCircleMembers(circle.id, user.id, userData?.name || 'A new member', circle.name);

      toast({
        title: "Success!",
        description: "You've joined the circle"
      });

      navigate(`/m/savings-circles/${circle.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setJoining(false);
    }
  };

  const canJoin = circle && circle.status === 'forming' && circle.current_members < circle.max_members && selectedPaymentMethod;

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate('/m/savings-circles')} className="p-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Join a Circle</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Enter Circle Code</CardTitle>
            <CardDescription className="text-gray-400">
              Ask the circle creator for the invite code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code" className="text-white">Invite Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                className="bg-gray-800 border-gray-700 text-white font-mono text-2xl text-center tracking-widest"
                maxLength={8}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Enter the 8-character invite code ({code.length}/8)
              </p>
            </div>
            <Button 
              onClick={checkCircle}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? "Checking..." : "Check Circle"}
            </Button>
          </CardContent>
        </Card>

        {circle && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white text-xl mb-2">{circle.name}</CardTitle>
                  <CardDescription className="text-gray-400">
                    ${circle.amount_per_period} • {circle.frequency}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={
                    circle.status === 'forming' 
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : circle.status === 'active'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-gray-500/10 text-gray-500'
                  }>
                    {circle.status.charAt(0).toUpperCase() + circle.status.slice(1)}
                  </Badge>
                  {circle.requires_verified_plus && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Verified+ Only
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Members</span>
                <span className="text-white font-medium">
                  {circle.current_members} of {circle.max_members}
                </span>
              </div>

              {/* Owner Reputation Preview */}
              {ownerInfo && (
                <div>
                  <p className="text-sm text-gray-400 mb-3">Circle Organizer:</p>
                  <div 
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800/70 transition-colors"
                    onClick={() => navigate(`/m/user/${ownerInfo.id}`)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {ownerInfo.avatar_url ? (
                        <img 
                          src={ownerInfo.avatar_url} 
                          alt={ownerInfo.name || 'Organizer'} 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {(ownerInfo.name || 'O')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-medium">{ownerInfo.name || 'Organizer'}</p>
                        {ownerInfo.tagline && (
                          <p className="text-sm text-gray-400">{ownerInfo.tagline}</p>
                        )}
                      </div>
                      <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180" />
                    </div>
                    <MemberReputationPreview 
                      userId={ownerInfo.id} 
                      displayName={ownerInfo.name || 'Organizer'} 
                    />
                    <p className="text-xs text-purple-400 mt-3 text-center">Tap to view full profile</p>
                  </div>
                </div>
              )}

              {/* Show allowed payment methods if restricted */}
              {circle.allowed_payment_methods && circle.allowed_payment_methods.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-sm text-purple-400 flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Accepted Payment Methods:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {circle.allowed_payment_methods.map((methodId) => {
                      const method = PAYMENT_METHODS.find(m => m.id === methodId);
                      return method ? (
                        <span key={methodId} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                          {method.icon}
                          {method.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {circle.requires_verified_plus && !limits.isVerifiedPlus && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-500 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    This circle requires Verified+ membership
                  </p>
                </div>
              )}

              {circle.status !== 'forming' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-500">
                    This circle is already {circle.status}. You can't join at this time.
                  </p>
                </div>
              )}

              {circle.current_members >= circle.max_members && circle.status === 'forming' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-red-500">
                    This circle is full.
                  </p>
                </div>
              )}

              {/* Show selected payment method or prompt to select */}
              {selectedPaymentMethod ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-500 flex items-center gap-2">
                    ✓ Payment method: {PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)?.label}
                    <button 
                      onClick={() => setShowPaymentMethodSelector(true)}
                      className="text-purple-400 underline ml-2"
                    >
                      Change
                    </button>
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => setShowPaymentMethodSelector(true)}
                  variant="outline"
                  className="w-full mb-4 border-purple-500 text-purple-400 hover:bg-purple-500/10"
                >
                  Select Payment Method First
                </Button>
              )}

              <Button 
                onClick={joinCircle}
                disabled={!canJoin || joining || (circle.requires_verified_plus && !limits.isVerifiedPlus)}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {joining ? "Joining..." : selectedPaymentMethod ? "Join Circle" : "Select Payment Method to Join"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <SavingsCircleAgreementDialog 
        open={showAgreement} 
        onAccept={handleAcceptTerms}
        onClose={() => navigate('/m/savings-circles')}
      />

      <PaymentMethodSelector
        open={showPaymentMethodSelector}
        onSelect={handlePaymentMethodSelect}
        onCancel={handlePaymentMethodCancel}
        title="Select Your Payment Method"
        description={
          circle?.allowed_payment_methods && circle.allowed_payment_methods.length > 0
            ? "This circle only accepts specific payment methods. Choose from the allowed options."
            : "Choose how you'll send/receive payments in this circle. This will be visible to other members."
        }
        allowedMethods={circle?.allowed_payment_methods}
      />

      <CircleLimitGate
        open={showLimitGate}
        onClose={() => setShowLimitGate(false)}
        reason={limitReason}
        completedCount={limits.completedCirclesCount}
      />
    </div>
  );
};

export default JoinCircle;
