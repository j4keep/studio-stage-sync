import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Circle as CircleIcon, Trash2, Gift, Heart, Star, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CircleQRCode from "@/components/atchup/CircleQRCode";
import MemberReputationPreview from "@/components/atchup/MemberReputationPreview";
import { DonationModal } from "@/components/atchup/DonationModal";
import { getPaymentMethodIcon, getPaymentMethodLabel } from "@/components/atchup/PaymentMethodSelector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WheelMember {
  name: string;
  initials: string;
  position: number;
  hasReceived: boolean;
}

interface SavingsCircleWheelProps {
  circleName: string;
  amountLabel: string;
  status: string;
  yourTurnLabel: string;
  totalPeriods: number;
  currentPeriod: number;
  completedPeriods: number;
  members: WheelMember[];
}

const SavingsCircleWheel = ({
  circleName,
  amountLabel,
  status,
  yourTurnLabel,
  totalPeriods,
  currentPeriod,
  completedPeriods,
  members
}: SavingsCircleWheelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const wheelHtml = `
      <div id="circle-wheel-card" style="max-width:360px;margin:0 auto 16px;font-family:-apple-system,system-ui,Segoe UI,Roboto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div id="sc-circle-name" style="font-size:16px;font-weight:600;color:#fff;">Savings Circle</div>
            <div id="sc-circle-sub" style="font-size:12px;opacity:.7;color:#fff;">$100 • Monthly • 10 members</div>
          </div>
          <div style="font-size:11px;opacity:.7;text-align:right;color:#fff;">
            <div id="sc-circle-status">Active</div>
            <div id="sc-circle-turn" style="font-weight:500;">Your turn: Period 1</div>
          </div>
        </div>

        <div style="position:relative;width:260px;height:260px;margin:0 auto;">
          <svg id="sc-wheel-svg" width="260" height="260" viewBox="0 0 260 260">
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
              </linearGradient>
            </defs>
            <circle cx="130" cy="130" r="100" stroke="#1a1a2e" stroke-width="14" fill="none" />
            <circle id="sc-wheel-progress" cx="130" cy="130" r="100"
                    stroke="url(#progress-gradient)" stroke-width="14" fill="none"
                    stroke-linecap="round" transform="rotate(-90 130 130)"/>
          </svg>

          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
            <div id="sc-center-label" style="font-size:12px;opacity:.7;color:#fff;">Circle progress</div>
            <div id="sc-center-percent" style="font-size:28px;font-weight:700;line-height:1.1;color:#fff;">0%</div>
            <div id="sc-center-sub" style="font-size:12px;opacity:.7;color:#fff;">0 of 0 periods</div>
          </div>

          <div id="sc-member-dots" style="position:absolute;inset:0;pointer-events:none;"></div>
        </div>

        <div style="margin-top:10px;font-size:12px;opacity:.7;text-align:center;color:#fff;">
          Each dot is a member's turn in this circle. The highlighted one is the current period.
        </div>
      </div>
    `;

    containerRef.current.innerHTML = wheelHtml;

    const wheelScript = () => {
      const progressCircle = containerRef.current?.querySelector('#sc-wheel-progress') as SVGCircleElement;
      const centerPercent = containerRef.current?.querySelector('#sc-center-percent') as HTMLElement;
      const centerLabel = containerRef.current?.querySelector('#sc-center-label') as HTMLElement;
      const centerSub = containerRef.current?.querySelector('#sc-center-sub') as HTMLElement;
      const circleNameEl = containerRef.current?.querySelector('#sc-circle-name') as HTMLElement;
      const circleSubEl = containerRef.current?.querySelector('#sc-circle-sub') as HTMLElement;
      const circleStatus = containerRef.current?.querySelector('#sc-circle-status') as HTMLElement;
      const circleTurn = containerRef.current?.querySelector('#sc-circle-turn') as HTMLElement;
      const dotsContainer = containerRef.current?.querySelector('#sc-member-dots') as HTMLElement;

      if (!progressCircle || !centerPercent || !centerLabel || !centerSub || 
          !circleNameEl || !circleSubEl || !circleStatus || !circleTurn || !dotsContainer) return;

      const animateProgress = (el: SVGCircleElement, circumference: number, toOffset: number, duration = 500) => {
        const startOffset = parseFloat(el.getAttribute('data-offset') || String(circumference));
        const start = performance.now();
        
        const frame = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          const val = startOffset + (toOffset - startOffset) * p;
          el.style.strokeDasharray = circumference + " " + circumference;
          el.style.strokeDashoffset = String(val);
          el.setAttribute('data-offset', val.toFixed(2));
          if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      };

      const renderWheel = () => {
        const r = 100;
        const C = 2 * Math.PI * r;
        const percent = totalPeriods > 0 ? (completedPeriods / totalPeriods) * 100 : 0;
        const offset = C * (1 - percent / 100);

        if (!progressCircle.getAttribute('data-init')) {
          progressCircle.style.strokeDasharray = C + " " + C;
          progressCircle.style.strokeDashoffset = String(C);
          progressCircle.setAttribute('data-offset', String(C));
          progressCircle.setAttribute('data-init', '1');
        }

        animateProgress(progressCircle, C, offset);

        centerPercent.textContent = Math.round(percent) + "%";
        centerLabel.textContent = "Circle progress";
        centerSub.textContent = (completedPeriods || 0) + " of " + (totalPeriods || 0) + " periods";

        circleNameEl.textContent = circleName;
        circleSubEl.textContent = amountLabel;
        circleStatus.textContent = status;
        circleTurn.textContent = yourTurnLabel;

        dotsContainer.innerHTML = "";
        const n = members.length || 1;
        const centerX = 130;
        const centerY = 130;
        const radius = 118;

        members.forEach((m, idx) => {
          const angle = (2 * Math.PI * idx / n) - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          const isCurrent = (currentPeriod === m.position);
          const hasReceived = !!m.hasReceived;

          const dot = document.createElement('div');
          dot.style.position = "absolute";
          dot.style.width = "32px";
          dot.style.height = "32px";
          dot.style.borderRadius = "50%";
          dot.style.left = (x - 16) + "px";
          dot.style.top = (y - 16) + "px";
          dot.style.display = "flex";
          dot.style.alignItems = "center";
          dot.style.justifyContent = "center";
          dot.style.fontSize = "12px";
          dot.style.fontWeight = "700";
          dot.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
          dot.style.pointerEvents = "none";

          let bg = "#1a1a2e";
          let color = "#ffffff";
          if (isCurrent) {
            bg = "linear-gradient(135deg,#7c3aed,#ec4899)";
            color = "#ffffff";
          } else if (hasReceived) {
            bg = "#10b981";
            color = "#ffffff";
          }

          dot.style.background = bg;
          dot.style.color = color;
          dot.textContent = m.initials;
          dotsContainer.appendChild(dot);
        });
      };

      renderWheel();
    };

    wheelScript();
  }, [circleName, amountLabel, status, yourTurnLabel, totalPeriods, currentPeriod, completedPeriods, members]);

  return <div ref={containerRef} />;
};


interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  amount_per_period: number;
  frequency: string;
  max_members: number;
  current_members: number;
  status: string;
  current_period: number;
}

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  position: number;
  has_received_pot: boolean;
  payment_method: string | null;
}

interface MemberWithUser extends Member {
  userId: string;
}

interface Payment {
  member_id: string;
  paid: boolean;
}

interface Period {
  id: string;
  period_number: number;
  due_date: string;
  status: string;
}

const CircleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [payments, setPayments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
   const [donationDialogOpen, setDonationDialogOpen] = useState(false);
   const [donationReason, setDonationReason] = useState("");
   const [donating, setDonating] = useState(false);
   const [selectedDonationRecipient, setSelectedDonationRecipient] = useState<Member | null>(null);
   const [tipModalOpen, setTipModalOpen] = useState(false);
   const [selectedTipMember, setSelectedTipMember] = useState<Member | null>(null);

  useEffect(() => {
    fetchCircleData();
  }, [id]);

  const fetchCircleData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch circle
      const { data: circleData, error: circleError } = await supabase
        .from('savings_circles')
        .select('*')
        .eq('id', id)
        .single();

      if (circleError) throw circleError;
      setCircle(circleData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('savings_circle_members')
        .select('*')
        .eq('circle_id', id)
        .order('position');

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch periods with due dates
      const { data: periodsData, error: periodsError } = await supabase
        .from('savings_circle_periods')
        .select('id, period_number, due_date, status')
        .eq('circle_id', id)
        .order('period_number');

      if (periodsError) throw periodsError;
      setPeriods(periodsData || []);

      // Fetch payments for current period
      const { data: paymentsData } = await supabase
        .from('savings_circle_payments')
        .select('member_id, paid')
        .eq('circle_id', id)
        .eq('period_number', circleData.current_period);

      const paymentsMap: Record<string, boolean> = {};
      paymentsData?.forEach(p => {
        paymentsMap[p.member_id] = p.paid;
      });
      setPayments(paymentsMap);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePayment = async (memberUserId: string, memberDisplayName: string, currentValue: boolean) => {
    if (!circle) return;

    try {
      const newValue = !currentValue;

      const { error } = await supabase
        .from('savings_circle_payments')
        .upsert({
          circle_id: circle.id,
          period_number: circle.current_period,
          member_id: memberUserId, // Use user_id, not member.id
          paid: newValue,
          paid_at: newValue ? new Date().toISOString() : null
        });

      if (error) throw error;

      setPayments(prev => ({ ...prev, [memberUserId]: newValue }));

      // If marking as paid, notify the payout recipient
      if (newValue) {
        const payoutMember = members.find(m => m.position === circle.current_period);
        
        if (payoutMember && payoutMember.user_id !== memberUserId) {
          await supabase.from("notifications").insert({
            user_id: payoutMember.user_id,
            title: "Payment Received",
            message: `${memberDisplayName} marked their payment as complete for "${circle.name}"`,
            type: "payment_received",
            link: `/m/savings-circles/${circle.id}`,
          });
        }
      }

      toast({
        title: newValue ? "Marked as paid" : "Marked as unpaid"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const completePeriod = async () => {
    if (!circle) return;

    try {
      const payoutMember = members.find(m => m.position === circle.current_period);
      if (!payoutMember) return;

      // Update period status
      await supabase
        .from('savings_circle_periods')
        .update({ status: 'completed' })
        .eq('circle_id', circle.id)
        .eq('period_number', circle.current_period);

      // Mark member as received
      await supabase
        .from('savings_circle_members')
        .update({ has_received_pot: true })
        .eq('id', payoutMember.id);

      const isCircleComplete = circle.current_period >= circle.max_members;

      // Move to next period if not last
      if (!isCircleComplete) {
        await supabase
          .from('savings_circles')
          .update({ current_period: circle.current_period + 1 })
          .eq('id', circle.id);
      } else {
        await supabase
          .from('savings_circles')
          .update({ status: 'completed' })
          .eq('id', circle.id);

        // Notify all members that circle is complete
        const notifications = members.map(m => ({
          user_id: m.user_id,
          title: "Circle Completed! 🎉",
          message: `"${circle.name}" has been successfully completed! Everyone has received their payout.`,
          type: "circle_completed",
          link: `/m/savings-circles/${circle.id}`,
        }));

        await supabase.from("notifications").insert(notifications);
      }

      toast({
        title: "Period completed",
        description: "Payout marked as complete"
      });

      fetchCircleData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const donatePayout = async () => {
    if (!circle || !currentUserId || !selectedDonationRecipient) return;

    const currentUserMember = members.find(m => m.user_id === currentUserId);
    if (!currentUserMember) return;

    setDonating(true);
    try {
      // Record the donation
      const { error: donationError } = await supabase
        .from('savings_circle_donations')
        .insert({
          circle_id: circle.id,
          donor_member_id: currentUserMember.id,
          recipient_member_id: selectedDonationRecipient.id,
          period_number: circle.current_period,
          amount: circle.amount_per_period * members.length,
          reason: donationReason || null
        });

      if (donationError) throw donationError;

      // Swap positions between donor and recipient
      const { error: swapError1 } = await supabase
        .from('savings_circle_members')
        .update({ position: selectedDonationRecipient.position })
        .eq('id', currentUserMember.id);

      if (swapError1) throw swapError1;

      const { error: swapError2 } = await supabase
        .from('savings_circle_members')
        .update({ position: currentUserMember.position })
        .eq('id', currentUserMember.id === selectedDonationRecipient.id ? currentUserMember.id : selectedDonationRecipient.id);

      if (swapError2) throw swapError2;

      toast({
        title: "Payout donated!",
        description: `Your payout has been passed to ${selectedDonationRecipient.display_name}`
      });

      setDonationDialogOpen(false);
      setDonationReason("");
      setSelectedDonationRecipient(null);
      fetchCircleData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDonating(false);
    }
  };

  const copyInviteCode = () => {
    if (!circle) return;
    navigator.clipboard.writeText(circle.invite_code || circle.id);
    toast({
      title: "Copied!",
      description: "Invite code copied to clipboard"
    });
  };

  const deleteCircle = async () => {
    if (!circle || !id) return;

    try {
      // Delete members
      await supabase
        .from('savings_circle_members')
        .delete()
        .eq('circle_id', id);

      // Delete periods
      await supabase
        .from('savings_circle_periods')
        .delete()
        .eq('circle_id', id);

      // Delete payments
      await supabase
        .from('savings_circle_payments')
        .delete()
        .eq('circle_id', id);

      // Delete circle
      const { error } = await supabase
        .from('savings_circles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Circle deleted",
        description: "Your savings circle has been deleted"
      });

      navigate('/m/savings-circles');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading || !circle) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const currentUserMember = members.find(m => m.user_id === currentUserId);
  const isOwner = circle.owner_id === currentUserId;
  const canDelete = isOwner && circle.current_members === 1;
  const isUserTurn = currentUserMember?.position === circle.current_period;
  const payoutMember = members.find(m => m.position === circle.current_period);
  const allPaid = members.every(m => payments[m.user_id] === true);
  const completedPeriods = circle.current_period - 1;

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate('/m/savings-circles')} className="p-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Savings Circle</h1>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-2">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Circle?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    This will permanently delete your savings circle. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteCircle} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!canDelete && <div className="w-10" />}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Summary Row */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{circle.name}</h2>
                <p className="text-sm text-gray-400">
                  ${circle.amount_per_period} • {circle.frequency} • {circle.max_members} members
                </p>
              </div>
              <div className="text-right">
                <Badge className={
                  circle.status === 'forming' ? 'bg-yellow-500/10 text-yellow-500' :
                  circle.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  'bg-gray-500/10 text-gray-500'
                }>
                  {circle.status.charAt(0).toUpperCase() + circle.status.slice(1)}
                </Badge>
                {currentUserMember && (
                  <p className="text-xs text-gray-400 mt-2">
                    {isUserTurn ? `Your turn: Period ${circle.current_period}` : `You receive in Period ${currentUserMember.position}`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invite Code Card with QR */}
        {isOwner && (
          <CircleQRCode 
            inviteCode={circle.invite_code || circle.id}
            circleName={circle.name}
          />
        )}

        {/* Animated Radial Wheel */}
        <SavingsCircleWheel
          circleName={circle.name}
          amountLabel={`$${circle.amount_per_period} • ${circle.frequency} • ${circle.max_members} members`}
          status={circle.status.charAt(0).toUpperCase() + circle.status.slice(1)}
          yourTurnLabel={currentUserMember && isUserTurn ? `Your turn: Period ${circle.current_period}` : currentUserMember ? `You receive in Period ${currentUserMember.position}` : `Period ${circle.current_period}`}
          totalPeriods={circle.max_members}
          currentPeriod={circle.current_period}
          completedPeriods={completedPeriods}
          members={members.map(m => ({
            name: m.display_name,
            initials: m.display_name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase(),
            position: m.position,
            hasReceived: m.has_received_pot
          }))}
        />

        {/* Current Period / Member Payments - Show for all circle members */}
        {((circle.status === 'active' && payoutMember) || (members.length > 0)) && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  {circle.status === 'forming' ? 'Member Payments' : `Current Period: Period ${circle.current_period}`}
                </CardTitle>
                {isUserTurn && circle.status === 'active' && (
                  <Badge className="bg-purple-500/10 text-purple-400">✨ It's your turn!</Badge>
                )}
              </div>
              <div className="space-y-1">
                {circle.status === 'active' && payoutMember && (
                  <p className="text-sm text-gray-400">
                    Payout this period: {payoutMember.display_name}
                  </p>
                )}
                {circle.status === 'forming' && (
                  <p className="text-sm text-gray-400">
                    Circle is still forming - track early payments here
                  </p>
                )}
                {circle.status === 'active' && (() => {
                  const currentPeriod = periods.find(p => p.period_number === circle.current_period);
                  if (currentPeriod) {
                    const dueDate = new Date(currentPeriod.due_date);
                    return (
                      <p className="text-sm text-purple-400 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Due: {dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {members
                .filter(member => {
                  // Always exclude the payout recipient for the current period (they don't pay their own pot)
                  // This applies during both 'forming' and 'active' stages
                  return member.position !== circle.current_period;
                })
                .map(member => {
                const isPaid = payments[member.user_id] || false;
                return (
                  <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{member.display_name}</span>
                      {isPaid && (
                        <Badge className="bg-green-500/10 text-green-500 text-xs">Paid</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <Button
                          variant={isPaid ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePayment(member.user_id, member.display_name, isPaid)}
                          className={isPaid 
                            ? "bg-green-600 hover:bg-green-700 text-white" 
                            : "border-purple-500 text-purple-400 hover:bg-purple-500/10"
                          }
                        >
                          {isPaid ? "Paid ✓" : "Mark Paid"}
                        </Button>
                      ) : (
                        <Badge className={isPaid ? "bg-green-500/10 text-green-500" : "bg-gray-700 text-gray-400"}>
                          {isPaid ? "Paid" : "Pending"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Donate Payout Button - Available for any member who hasn't received yet */}
              {currentUserMember && !currentUserMember.has_received_pot && members.filter(m => m.user_id !== currentUserId && !m.has_received_pot).length > 0 && (
                <Button 
                  onClick={() => setDonationDialogOpen(true)}
                  variant="outline"
                  className="w-full mt-4 border-purple-500 text-purple-400 hover:bg-purple-500/10"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Donate My Payout
                </Button>
              )}

              {allPaid && (
                <Button 
                  onClick={completePeriod}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                >
                  Mark Period as Completed
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Members & Turn Order */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Members & Turn Order</CardTitle>
            <p className="text-sm text-gray-400">Tap a member to view their reputation</p>
          </CardHeader>
          <CardContent className="space-y-3">
             {members.map(member => (
               <div 
                 key={member.id} 
                 className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0 cursor-pointer hover:bg-gray-800/50 rounded-lg px-2 -mx-2 transition-colors"
                 onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
               >
                 <div className="flex items-center gap-3 flex-1">
                   <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-semibold">
                     {member.display_name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <p className="text-white font-medium">{member.display_name}</p>
                     <p className="text-sm text-gray-400">Turn: {member.position}</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   {/* Payment method icon */}
                   {member.payment_method && (
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 cursor-pointer">
                             {getPaymentMethodIcon(member.payment_method)}
                           </div>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Pays via: {getPaymentMethodLabel(member.payment_method)}</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                   )}
                   {/* Rate button - only show for other members, not yourself */}
                   {member.user_id !== currentUserId && (
                     <Button
                       size="sm"
                       variant="ghost"
                       onClick={(e) => {
                         e.stopPropagation();
                         navigate(`/m/rate-member?rateeId=${member.user_id}&rateeName=${encodeURIComponent(member.display_name)}&contextId=${circle.id}&circleName=${encodeURIComponent(circle.name)}`);
                       }}
                       className="text-gray-400 hover:text-yellow-400"
                       title="Rate this member"
                     >
                       <Star className="h-4 w-4" />
                     </Button>
                   )}
                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={(e) => {
                       e.stopPropagation();
                       setSelectedTipMember(member);
                       setTipModalOpen(true);
                     }}
                     className="text-gray-400 hover:text-red-400"
                   >
                     <Heart className="h-4 w-4" />
                   </Button>
                    <div className="flex flex-col items-end gap-1">
                      {member.has_received_pot && (
                        <Badge className="bg-green-500/10 text-green-500">Received</Badge>
                      )}
                      {member.position === circle.current_period && circle.status === 'active' && (() => {
                        const currentPeriod = periods.find(p => p.period_number === circle.current_period);
                        const isPastDue = currentPeriod && new Date(currentPeriod.due_date) < new Date();
                        const isPaid = payments[member.id];
                        
                        if (isPaid) {
                          return <Badge className="bg-green-500/10 text-green-500">Paid</Badge>;
                        } else if (isPastDue) {
                          return <Badge className="bg-red-500/10 text-red-500">Past Due</Badge>;
                        } else {
                          return <Badge className="bg-purple-500/10 text-purple-400">Current</Badge>;
                        }
                      })()}
                    </div>
                 </div>
               </div>
             ))}

            {/* Selected Member Reputation */}
            {selectedMember && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <MemberReputationPreview 
                  userId={selectedMember.user_id} 
                  displayName={selectedMember.display_name} 
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Timeline */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Payout Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: circle.max_members }, (_, i) => i + 1).map(periodNum => {
              const member = members.find(m => m.position === periodNum);
              const isCompleted = periodNum < circle.current_period;
              const isCurrent = periodNum === circle.current_period;
              const period = periods.find(p => p.period_number === periodNum);
              const dueDate = period ? new Date(period.due_date) : null;
              
              return (
                <div key={periodNum} className="flex items-center gap-3 py-2">
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : isCurrent ? (
                    <CircleIcon className="w-5 h-5 text-purple-500 fill-purple-500" />
                  ) : (
                    <CircleIcon className="w-5 h-5 text-gray-600" />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      Period {periodNum} – {member ? member.display_name : <span className="text-gray-500 italic">Unassigned</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400">
                        {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Upcoming'}
                      </p>
                      {dueDate && (
                        <p className="text-xs text-purple-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              All payments are made directly between members (Zelle, Cash App, bank transfer). 
              This app only tracks turn order and contributions. 
              This is a community savings tool, not gambling or a lottery.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donation Dialog */}
      <Dialog open={donationDialogOpen} onOpenChange={(open) => {
        setDonationDialogOpen(open);
        if (!open) {
          setSelectedDonationRecipient(null);
          setDonationReason("");
        }
      }}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              Donate Your Payout
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {(() => {
                const currentUserMember = members.find(m => m.user_id === currentUserId);
                const payoutAmount = (circle?.amount_per_period || 0) * members.length;
                return `Your payout of $${payoutAmount} will go to the selected member. Your positions will be swapped.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Recipient Selection */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">Select recipient:</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {members
                  .filter(m => m.user_id !== currentUserId && !m.has_received_pot)
                  .map(member => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedDonationRecipient(member)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDonationRecipient?.id === member.id
                          ? 'bg-purple-600/20 border border-purple-500'
                          : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-semibold text-sm">
                        {member.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{member.display_name}</p>
                        <p className="text-xs text-gray-400">Position: {member.position}</p>
                      </div>
                      {selectedDonationRecipient?.id === member.id && (
                        <CheckCircle className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Reason */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">Reason (optional)</label>
              <Textarea 
                placeholder="e.g., I want to help them out this month..."
                value={donationReason}
                onChange={(e) => setDonationReason(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDonationDialogOpen(false)}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={donatePayout}
              disabled={donating || !selectedDonationRecipient}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {donating ? 'Donating...' : `Donate to ${selectedDonationRecipient?.display_name || '...'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tip Member Modal */}
      {selectedTipMember && (
        <DonationModal
          isOpen={tipModalOpen}
          onClose={() => {
            setTipModalOpen(false);
            setSelectedTipMember(null);
          }}
          recipientName={selectedTipMember.display_name}
          circleName={circle?.name || "Savings Circle"}
        />
      )}
    </div>
  );
};

export default CircleDetail;
