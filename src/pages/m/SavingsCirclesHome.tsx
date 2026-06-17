import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Key } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SavingsCircleAgreementDialog from "@/components/atchup/SavingsCircleAgreementDialog";
import BottomTabBar from "@/components/atchup/BottomTabBar";
import NotificationBell from "@/components/atchup/NotificationBell";

interface Circle {
  id: string;
  name: string;
  amount_per_period: number;
  frequency: string;
  max_members: number;
  current_members: number;
  status: string;
  current_period: number;
}

interface Member {
  position: number;
  has_received_pot: boolean;
}

const SavingsCirclesHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [userPositions, setUserPositions] = useState<Record<string, Member>>({});
  const [loading, setLoading] = useState(true);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showAgreement, setShowAgreement] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    checkTermsAcceptance();
  }, []);

  const checkTermsAcceptance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('savings_circle_terms_acceptance')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setHasAccepted(true);
        fetchUserCircles();
      } else {
        setShowAgreement(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking terms:', error);
      setShowAgreement(true);
      setLoading(false);
    }
  };

  const handleAcceptTerms = () => {
    setShowAgreement(false);
    setHasAccepted(true);
    fetchUserCircles();
  };

  const fetchUserCircles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get circles where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('savings_circle_members')
        .select('circle_id, position, has_received_pot')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const circleIds = memberData.map(m => m.circle_id);
        
        // Get circle details
        const { data: circleData, error: circleError } = await supabase
          .from('savings_circles')
          .select('*')
          .in('id', circleIds);

        if (circleError) throw circleError;

        setCircles(circleData || []);
        
        // Map user positions
        const positions: Record<string, Member> = {};
        memberData.forEach(m => {
          positions[m.circle_id] = {
            position: m.position,
            has_received_pot: m.has_received_pot
          };
        });
        setUserPositions(positions);

        // Calculate progress based on payments
        await calculateProgress(circleData || [], circleIds);
      } else {
        setProgressPercentage(0);
      }
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

  const calculateProgress = async (circleData: Circle[], circleIds: string[]) => {
    try {
      let totalMembers = 0;
      let totalPaid = 0;

      for (const circle of circleData) {
        // Get all members for this circle
        const { data: members } = await supabase
          .from('savings_circle_members')
          .select('id')
          .eq('circle_id', circle.id);

        if (members) {
          const memberCount = members.length;
          totalMembers += memberCount;

          // Get payments for current period
          const { data: payments } = await supabase
            .from('savings_circle_payments')
            .select('paid')
            .eq('circle_id', circle.id)
            .eq('period_number', circle.current_period)
            .eq('paid', true);

          totalPaid += payments?.length || 0;
        }
      }

      // Calculate percentage
      const percentage = totalMembers > 0 ? Math.round((totalPaid / totalMembers) * 100) : 0;
      setProgressPercentage(percentage);
    } catch (error) {
      console.error('Error calculating progress:', error);
      setProgressPercentage(0);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'forming': return 'bg-yellow-500/10 text-yellow-500';
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'completed': return 'bg-gray-500/10 text-gray-500';
      default: return 'bg-blue-500/10 text-blue-500';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-purple-500/30">
        <div className="flex items-center justify-between p-4">
          <div className="w-10" />
          <h1 className="text-xl font-bold text-white">Savings Circles</h1>
          <NotificationBell />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Progress Ring */}
        <Card className="bg-black/60 backdrop-blur-sm border-purple-500/30 overflow-hidden relative">
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-blue-600/20 animate-pulse" />
          
          <CardContent className="p-8 flex flex-col items-center relative z-10">
            <div className="relative w-40 h-40 mb-6">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
              
              {/* SVG Progress Ring */}
              <svg className="w-full h-full transform -rotate-90 relative z-10">
                {/* Background circle */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-gray-800/50"
                />
                {/* Progress circle with gradient */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${progressPercentage * 2 * Math.PI * 70 / 100} ${2 * Math.PI * 70}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))' }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Center content with animation */}
              <div className="absolute inset-0 flex flex-col items-center justify-center animate-scale-in">
                <span className="text-4xl font-bold text-white drop-shadow-lg">{progressPercentage}%</span>
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 animate-fade-in">Savings Progress</h3>
            <p className="text-sm text-gray-400 animate-fade-in">Community savings activity</p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/m/savings-circles/create')}
            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Circle
          </Button>
          <Button 
            onClick={() => navigate('/m/savings-circles/join')}
            variant="outline"
            className="w-full h-14 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
          >
            <Key className="w-5 h-5 mr-2" />
            Join with Code
          </Button>
        </div>

        {/* User's Circles */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Your Circles</h2>
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading...</p>
          ) : circles.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">You haven't joined any circles yet</p>
                <p className="text-sm text-gray-500 mt-2">Create or join a circle to start saving together</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {circles.map((circle) => {
                const userMember = userPositions[circle.id];
                const isUserTurn = userMember && userMember.position === circle.current_period;
                
                return (
                  <Card 
                    key={circle.id}
                    onClick={() => navigate(`/m/savings-circles/${circle.id}`)}
                    className="bg-gray-900/50 border-gray-800 hover:border-purple-500/50 cursor-pointer transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-lg mb-2">{circle.name}</CardTitle>
                          <CardDescription className="text-gray-400">
                            ${circle.amount_per_period} • {circle.frequency} • {circle.max_members} members
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(circle.status)}>
                          {getStatusText(circle.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {userMember && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            {isUserTurn 
                              ? `Your turn: Period ${circle.current_period}` 
                              : `You receive in Period ${userMember.position}`}
                          </span>
                          {isUserTurn && (
                            <Badge className="bg-purple-500/10 text-purple-400">
                              ✨ Your Turn
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SavingsCircleAgreementDialog 
        open={showAgreement} 
        onAccept={handleAcceptTerms} 
      />
      
      <BottomTabBar />
    </div>
  );
};

export default SavingsCirclesHome;
