import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft, Settings } from 'lucide-react';
import BottomTabBar from '@/components/atchup/BottomTabBar';
import MessagesIcon from '@/components/atchup/MessagesIcon';
import NotificationBell from '@/components/atchup/NotificationBell';
import VerifiedBadge from '@/components/atchup/VerifiedBadge';
import ReputationScore from '@/components/atchup/ReputationScore';
import FollowersModal from '@/components/atchup/FollowersModal';
import { useFollowerCounts } from '@/hooks/useFollow';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [profileUploading, setProfileUploading] = useState(false);
  const [circlesCount, setCirclesCount] = useState(0);
  const [completedCircles, setCompletedCircles] = useState(0);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followersTab, setFollowersTab] = useState<'followers' | 'following'>('followers');
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { followersCount, followingCount } = useFollowerCounts(currentUserId);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/welcome');
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (user) {
      setCurrentUserId(user.id);
      setUserData(user);

      // Load circles stats
      const { data: memberData } = await supabase
        .from('savings_circle_members')
        .select('circle_id, has_received_pot')
        .eq('user_id', user.id);

      if (memberData) {
        setCirclesCount(memberData.length);
        setCompletedCircles(memberData.filter(m => m.has_received_pot).length);
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!roleData);
    }

    setLoading(false);
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    try {
      setProfileUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserId}-profile-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-media')
        .getPublicUrl(data.path);

      const { error: updateError } = await supabase
        .from('users')
        .update({ photo_url: publicUrl })
        .eq('id', currentUserId);

      if (updateError) throw updateError;

      setUserData({ ...userData, photo_url: publicUrl });
      toast({ title: "Profile photo updated!" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setProfileUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(240,10%,4%)] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const openFollowers = (tab: 'followers' | 'following') => {
    setFollowersTab(tab);
    setShowFollowers(true);
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      <main className="mx-auto max-w-md">
        {/* Header Bar */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-purple-500/30">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 text-white">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-white">Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <MessagesIcon />
            <NotificationBell />
          </div>
        </div>

        {/* Profile Section - Centered */}
        <div className="px-4 py-8">
          {/* Centered Profile Picture */}
          <div className="flex flex-col items-center mb-6">
            <div 
              className="relative w-32 h-32 rounded-full border-4 border-purple-500/50 bg-gray-900 overflow-hidden cursor-pointer group mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
              onClick={() => userData?.photo_url && window.open(userData.photo_url, '_blank')}
            >
              {userData?.photo_url ? (
                <img 
                  src={userData.photo_url} 
                  alt={userData.name} 
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-500 text-white text-3xl font-bold">
                  {getInitials(userData?.name || '')}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-full" />
              <label 
                className="absolute bottom-0 right-0 bg-purple-600 hover:bg-purple-700 rounded-full p-2 cursor-pointer z-10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Camera size={16} className="text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleProfilePhotoUpload}
                  disabled={profileUploading}
                />
              </label>
            </div>

            {/* Name and Verified Badge */}
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-white">{userData?.name}</h2>
              {currentUserId && <VerifiedBadge userId={currentUserId} size="md" />}
            </div>
            {/* Tagline */}
            {userData?.tagline && (
              <p className="text-purple-400 text-sm font-medium mb-1">{userData.tagline}</p>
            )}
            <p className="text-gray-400 text-sm text-center">{userData?.bio || 'Savings Circle member'}</p>
          </div>

          {/* Circle Stats */}
          <div className="flex justify-center gap-8 mb-6">
            <button onClick={() => openFollowers('followers')} className="text-center">
              <div className="text-2xl font-bold text-purple-500">{followersCount}</div>
              <div className="text-gray-400 text-sm">Followers</div>
            </button>
            <button onClick={() => openFollowers('following')} className="text-center">
              <div className="text-2xl font-bold text-purple-500">{followingCount}</div>
              <div className="text-gray-400 text-sm">Following</div>
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">{circlesCount}</div>
              <div className="text-gray-400 text-sm">Circles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">{completedCircles}</div>
              <div className="text-gray-400 text-sm">Completed</div>
            </div>
          </div>

          {/* Reputation Score */}
          {currentUserId && (
            <div className="mb-6">
              <ReputationScore userId={currentUserId} />
            </div>
          )}

          {/* Settings Button */}
          <div className="mb-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings & Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 z-50 bg-gray-900 border-purple-500/30">
                <DropdownMenuItem onClick={() => navigate('/m/edit-profile')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings/account')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/m/verified-plus-upgrade')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Upgrade to Verified+
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/id-verification')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  ID verification
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/help')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Help
                 </DropdownMenuItem>
                 {isAdmin && (
                   <DropdownMenuItem onClick={() => navigate('/m/support-admin')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                     👨‍💼 Admin Dashboard
                   </DropdownMenuItem>
                 )}
                 <DropdownMenuItem onClick={() => navigate('/m/privacy-policy')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Privacy policy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/m/terms-conditions')} className="text-white hover:bg-purple-600/20 focus:bg-purple-600/20">
                  Terms & Conditions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-900/50 border border-purple-500/30 rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-white">Quick Actions</h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start bg-transparent border-purple-500/30 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
                onClick={() => navigate('/m/fundraisers')}
              >
                💝 Fundraisers & Donations
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start bg-transparent border-purple-500/30 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
                onClick={() => navigate('/m/savings-circles')}
              >
                View My Circles
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start bg-transparent border-purple-500/30 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
                onClick={() => navigate('/m/savings-circles/create')}
              >
                Create New Circle
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start bg-transparent border-purple-500/30 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
                onClick={() => navigate('/m/savings-circles/join')}
              >
                Join a Circle
              </Button>
            </div>
          </div>
        </div>
      </main>

      {currentUserId && (
        <FollowersModal
          open={showFollowers}
          onOpenChange={setShowFollowers}
          userId={currentUserId}
          initialTab={followersTab}
        />
      )}

      <BottomTabBar />
    </div>
  );
}
