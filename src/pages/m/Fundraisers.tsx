import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Search, Heart, Target, Clock, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import BottomTabBar from "@/components/BottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "emergency", label: "Emergency" },
  { value: "medical", label: "Medical" },
  { value: "education", label: "Education" },
  { value: "business", label: "Business" },
  { value: "community", label: "Community" },
  { value: "personal", label: "Personal" },
];

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
  user?: { name: string; photo_url: string | null };
}

export default function Fundraisers() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [selectedCategory]);

  useEffect(() => {
    loadMyCampaigns();
  }, []);

  const loadCampaigns = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
    }

    let query = supabase
      .from("fundraiser_campaigns")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (selectedCategory !== "all") {
      query = query.eq("category", selectedCategory);
    }

    const { data: campaignsData } = await query;

    if (campaignsData) {
      // Fetch user info for each campaign
      const userIds = [...new Set(campaignsData.map(c => c.user_id))];
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, photo_url")
          .in("id", userIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        
        const enrichedCampaigns = campaignsData.map(c => ({
          ...c,
          user: usersMap.get(c.user_id)
        }));

        setCampaigns(enrichedCampaigns);
      } else {
        setCampaigns([]);
      }
    }

    setLoading(false);
  };

  const loadMyCampaigns = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    setCurrentUserId(session.user.id);

    // Load ALL user's campaigns (active, completed, cancelled)
    const { data: myCampaignsData } = await supabase
      .from("fundraiser_campaigns")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (myCampaignsData) {
      const { data: userData } = await supabase
        .from("users")
        .select("id, name, photo_url")
        .eq("id", session.user.id)
        .single();

      const enriched = myCampaignsData.map(c => ({
        ...c,
        user: userData || undefined
      }));

      setMyCampaigns(enriched);
    }
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = differenceInDays(new Date(expiresAt), new Date());
    return days > 0 ? days : 0;
  };

  const getProgress = (raised: number, goal: number) => {
    return Math.min((raised / goal) * 100, 100);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      // Delete donations first (foreign key constraint)
      const { error: donationsError } = await supabase
        .from("fundraiser_donations")
        .delete()
        .eq("campaign_id", campaignId);
      
      if (donationsError) {
        console.error("Error deleting donations:", donationsError);
      }
      
      // Delete the campaign
      const { error } = await supabase
        .from("fundraiser_campaigns")
        .delete()
        .eq("id", campaignId)
        .eq("user_id", currentUserId);

      if (error) throw error;

      toast.success("Campaign deleted permanently");
      
      // Remove from both local states immediately
      setMyCampaigns(prev => prev.filter(c => c.id !== campaignId));
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      
      // Force refresh to ensure consistency
      await loadCampaigns();
    } catch (error: any) {
      toast.error("Failed to delete campaign: " + error.message);
    }
  };

  const CampaignCard = ({ campaign, showDelete = false }: { campaign: Campaign; showDelete?: boolean }) => {
    const daysLeft = getDaysLeft(campaign.expires_at);
    const progress = getProgress(campaign.raised_amount, campaign.goal_amount);

    return (
      <div 
        onClick={() => navigate(`/m/fundraiser/${campaign.id}`)}
        className="bg-gray-900/50 border border-purple-500/30 rounded-xl overflow-hidden cursor-pointer hover:border-purple-500/50 transition-colors relative"
      >
        {campaign.cover_image ? (
          <img 
            src={campaign.cover_image} 
            alt={campaign.title}
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-purple-600/30 to-pink-500/30 flex items-center justify-center">
            <Heart className="w-12 h-12 text-purple-400" />
          </div>
        )}
        
        {/* Status Badge for non-active campaigns */}
        {campaign.status !== "active" && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-gray-800/80 text-gray-300"
          >
            {campaign.status}
          </Badge>
        )}
        
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-300">
              {campaign.category}
            </Badge>
            {daysLeft !== null && campaign.status === "active" && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysLeft} days left
              </span>
            )}
          </div>
          
          <h3 className="font-semibold text-white mb-2 line-clamp-2">{campaign.title}</h3>
          
          <p className="text-sm text-gray-400 mb-3 line-clamp-2">{campaign.description}</p>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-purple-400 font-semibold">
                ${campaign.raised_amount.toLocaleString()}
              </span>
              <span className="text-gray-400">
                of ${campaign.goal_amount.toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-500/20">
            {campaign.user && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-600/30 overflow-hidden">
                  {campaign.user.photo_url ? (
                    <img src={campaign.user.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white">
                      {campaign.user.name?.[0]}
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-400">{campaign.user.name}</span>
              </div>
            )}
            
            {showDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => e.stopPropagation()}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900 border-purple-500/30">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Permanently Delete Campaign?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This will permanently delete "{campaign.title}" and all associated donations from the platform. 
                      No one will be able to view this campaign anymore. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-purple-500/30 text-white">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <main className="mx-auto max-w-md">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-purple-500/30">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 text-white">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-white">Fundraisers</h1>
          </div>
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => navigate("/m/fundraiser/create")}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-900/50 border-purple-500/30 text-white"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className={selectedCategory === cat.value 
                  ? "bg-purple-600 hover:bg-purple-700 whitespace-nowrap" 
                  : "border-purple-500/30 text-gray-300 whitespace-nowrap"
                }
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="discover" className="w-full">
            <TabsList className="w-full bg-gray-900/50 border border-purple-500/30">
              <TabsTrigger value="discover" className="flex-1 data-[state=active]:bg-purple-600">
                <Users className="w-4 h-4 mr-1" />
                Discover
              </TabsTrigger>
              <TabsTrigger value="my" className="flex-1 data-[state=active]:bg-purple-600">
                <Target className="w-4 h-4 mr-1" />
                My Campaigns
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="mt-4">
              {filteredCampaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-purple-500/50 mx-auto mb-3" />
                  <p className="text-gray-400">No campaigns found</p>
                  <p className="text-sm text-gray-500 mt-1">Be the first to start a fundraiser!</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredCampaigns.map(campaign => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="my" className="mt-4">
              {!currentUserId ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Sign in to see your campaigns</p>
                </div>
              ) : myCampaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 text-purple-500/50 mx-auto mb-3" />
                  <p className="text-gray-400">You haven't created any campaigns</p>
                  <Button 
                    className="mt-4 bg-purple-600 hover:bg-purple-700"
                    onClick={() => navigate("/m/fundraiser/create")}
                  >
                    Create Your First Campaign
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {myCampaigns.map(campaign => (
                    <CampaignCard key={campaign.id} campaign={campaign} showDelete />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
