import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, AlertCircle, CreditCard, CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SavingsCircleAgreementDialog from "@/components/SavingsCircleAgreementDialog";
import CircleLimitGate from "@/components/CircleLimitGate";
import { useCircleLimits, FREE_MAX_MEMBERS } from "@/hooks/useCircleLimits";
import { autoFollowCircleMembers } from "@/hooks/useFollow";
import PaymentMethodSelector, { AllowedPaymentMethodsSelector, PAYMENT_METHODS } from "@/components/PaymentMethodSelector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const CreateCircle = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const limits = useCircleLimits();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdCircleId, setCreatedCircleId] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [showAgreement, setShowAgreement] = useState(true); // Always show on load
  const [hasAccepted, setHasAccepted] = useState(false);
  const [showLimitGate, setShowLimitGate] = useState(false);
  const [limitReason, setLimitReason] = useState<"max_circles" | "must_upgrade" | "max_members" | "payment_paused">("max_circles");
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>([]); // Empty = any
  
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    frequency: "monthly",
    maxMembers: "10",
    requiresVerifiedPlus: false
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    checkAuth();
  }, []);

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
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
    setShowPaymentMethodSelector(false);
  };

  const handlePaymentMethodCancel = () => {
    // User cancelled payment method selection, go back
    navigate('/m/savings-circles');
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate) {
      toast({ title: "Start Date Required", description: "Please select a start date for your circle.", variant: "destructive" });
      return;
    }
    
    // Check if payment is paused
    if (limits.isPaymentPaused) {
      setLimitReason("payment_paused");
      setShowLimitGate(true);
      return;
    }

    // Check limits before proceeding
    if (limits.mustUpgrade) {
      setLimitReason("must_upgrade");
      setShowLimitGate(true);
      return;
    }

    if (!limits.canCreateCircle) {
      setLimitReason("max_circles");
      setShowLimitGate(true);
      return;
    }

    // Check member count limit for free users
    const requestedMembers = parseInt(formData.maxMembers);
    if (!limits.isVerifiedPlus && requestedMembers > FREE_MAX_MEMBERS) {
      setLimitReason("max_members");
      setShowLimitGate(true);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      // Double-check limits on server side
      const { count: activeCount } = await supabase
        .from('savings_circles')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .neq('status', 'completed');

      if ((activeCount || 0) >= limits.maxCirclesAllowed) {
        toast({
          title: "Cannot Create Circle",
          description: `You've reached your limit of ${limits.maxCirclesAllowed} active circle(s). Complete or delete an existing circle first.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', user.id)
        .single();

      // Generate a reliable 8-character invite code
      const generateInviteCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };
      const inviteCode = generateInviteCode();

      // Create circle
      const { data: circle, error: circleError } = await supabase
        .from('savings_circles')
        .insert({
          owner_id: user.id,
          name: formData.name,
          amount_per_period: parseFloat(formData.amount),
          frequency: formData.frequency,
          max_members: parseInt(formData.maxMembers),
          start_date: startDate.toISOString().split('T')[0],
          current_members: 1,
          status: 'forming',
          invite_code: inviteCode,
          requires_verified_plus: formData.requiresVerifiedPlus,
          allowed_payment_methods: allowedPaymentMethods.length > 0 ? allowedPaymentMethods : null
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // Add owner as first member with payment method
      const { error: memberError } = await supabase
        .from('savings_circle_members')
        .insert({
          circle_id: circle.id,
          user_id: user.id,
          display_name: userData?.name || userData?.email || 'You',
          position: 1,
          payment_method: selectedPaymentMethod
        });

      if (memberError) throw memberError;

      // Create periods
      const maxMembers = parseInt(formData.maxMembers);
      const periodsStartDate = new Date(startDate);
      const periods = [];
      
      for (let i = 1; i <= maxMembers; i++) {
        const dueDate = new Date(periodsStartDate);
        
        if (formData.frequency === 'daily') {
          dueDate.setDate(dueDate.getDate() + (i - 1));
        } else if (formData.frequency === 'weekly') {
          dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
        } else if (formData.frequency === 'biweekly') {
          dueDate.setDate(dueDate.getDate() + (i - 1) * 14);
        } else {
          dueDate.setMonth(dueDate.getMonth() + (i - 1));
        }

        periods.push({
          circle_id: circle.id,
          period_number: i,
          due_date: dueDate.toISOString(),
          status: i === 1 ? 'upcoming' : 'upcoming'
        });
      }

      const { error: periodsError } = await supabase
        .from('savings_circle_periods')
        .insert(periods);

      if (periodsError) throw periodsError;

      // Auto-follow will be triggered when other members join
      // For now, just set up the circle

      setCreatedCircleId(circle.id);
      setCreatedInviteCode(circle.invite_code);
      setShowSuccessModal(true);

    } catch (error: any) {
      const errorMessage = error?.message || "Unable to create circle";
      const normalizedMessage = errorMessage.toLowerCase();

      if (normalizedMessage.includes("limited to 5 members")) {
        setLimitReason("max_members");
        setShowLimitGate(true);
      } else if (
        normalizedMessage.includes("only have 1 active circle") ||
        normalizedMessage.includes("up to 5 active circles")
      ) {
        setLimitReason("max_circles");
        setShowLimitGate(true);
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdInviteCode);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard"
    });
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate('/m/savings-circles')} className="p-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Create Circle</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Circle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-white">Circle Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Holiday 2025 Circle"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="amount" className="text-white">Amount per Period</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="100.00"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div>
                <Label htmlFor="frequency" className="text-white">Frequency</Label>
                <Select 
                  value={formData.frequency} 
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="maxMembers" className="text-white">
                  Number of Members ({limits.isVerifiedPlus ? "2+" : "2-" + FREE_MAX_MEMBERS})
                </Label>
                <Input
                  id="maxMembers"
                  type="number"
                  min="2"
                  max={limits.isVerifiedPlus ? 999 : FREE_MAX_MEMBERS}
                  value={formData.maxMembers}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!limits.isVerifiedPlus && val > FREE_MAX_MEMBERS) {
                      setLimitReason("max_members");
                      setShowLimitGate(true);
                      setFormData({ ...formData, maxMembers: String(FREE_MAX_MEMBERS) });
                      return;
                    }
                    setFormData({ ...formData, maxMembers: e.target.value });
                  }}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
                {!limits.isVerifiedPlus && (
                  <button
                    type="button"
                    onClick={() => navigate('/m/verified-plus-upgrade')}
                    className="text-xs text-yellow-500 mt-1 flex items-center gap-1 hover:text-yellow-400 transition-colors"
                  >
                    <Star className="h-3 w-3" />
                    Upgrade to Verified+ for up to 100 members →
                  </button>
                )}
              </div>

              <div>
                <Label className="text-white mb-2 block">Start Date</Label>
                <p className="text-xs text-gray-400 mb-2">
                  Choose a future date to give members time to join before the circle begins.
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-gray-800 border-gray-700",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => date < addDays(new Date(), 1)}
                      initialFocus
                      className="p-3 pointer-events-auto bg-gray-900 text-white rounded-md"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/20">
                <div className="flex-1">
                  <Label htmlFor="verifiedPlus" className="text-white font-semibold">
                    Verified+ Members Only ⭐
                  </Label>
                  <p className="text-xs text-gray-400 mt-1">
                    Only users with Verified+ membership can join
                  </p>
                </div>
                <Switch
                  id="verifiedPlus"
                  checked={formData.requiresVerifiedPlus}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresVerifiedPlus: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Allowed Payment Methods Section */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-400" />
                Allowed Payment Methods
              </CardTitle>
              <p className="text-sm text-gray-400">
                Choose which payment methods members can use. You can select multiple options or leave as "Any" to allow all.
              </p>
            </CardHeader>
            <CardContent>
              <AllowedPaymentMethodsSelector
                selectedMethods={allowedPaymentMethods}
                onChange={setAllowedPaymentMethods}
              />
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? "Creating..." : "Create Circle"}
          </Button>
        </form>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Circle Created!</DialogTitle>
            <DialogDescription className="text-gray-400">
              Share this code with your group to let them join
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-xs text-gray-400 mb-1">Circle Code</p>
            <p className="text-4xl font-mono font-bold text-purple-400 tracking-widest">{createdInviteCode}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={copyCode} variant="outline" className="flex-1">
              Copy Code
            </Button>
            <Button 
              onClick={() => navigate(`/m/savings-circles/${createdCircleId}`)}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Go to Circle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SavingsCircleAgreementDialog 
        open={showAgreement} 
        onAccept={handleAcceptTerms}
        onClose={() => navigate('/m/savings-circles')}
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

export default CreateCircle;
