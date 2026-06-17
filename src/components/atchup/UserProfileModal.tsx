import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  streak_count: number;
}

const UserProfileModal = ({ userId, isOpen, onClose }: UserProfileModalProps) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
      getCurrentUser();
    }
  }, [isOpen, userId]);

  const getCurrentUser = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'emma@demo.com')
      .single();
    
    if (userData) {
      setCurrentUserId(userData.id);
      checkIfFollowing(userData.id);
    }
  };

  const loadProfile = async () => {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (user) {
      setProfile(user);
      
      // Get follower count
      const { count: followers } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      
      setFollowerCount(followers || 0);
      
      // Get following count
      const { count: following } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      
      setFollowingCount(following || 0);
    }
  };

  const checkIfFollowing = async (currentId: string) => {
    const { data } = await supabase
      .from('followers')
      .select('*')
      .eq('follower_id', currentId)
      .eq('following_id', userId)
      .single();
    
    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!currentUserId) return;

    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId);
      
      setIsFollowing(false);
      setFollowerCount(prev => prev - 1);
    } else {
      await supabase
        .from('followers')
        .insert({
          follower_id: currentUserId,
          following_id: userId
        });
      
      setIsFollowing(true);
      setFollowerCount(prev => prev + 1);
    }
  };

  const handleMessage = () => {
    navigate(`/m/messages?user=${userId}`);
    onClose();
  };

  if (!profile) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-magenta to-brand-purple flex items-center justify-center text-white text-2xl font-bold">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(profile.name)
            )}
          </div>

          {/* Name */}
          <h2 className="text-2xl font-bold">{profile.name}</h2>

          {/* Stats */}
          <div className="flex gap-8 py-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{followerCount}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{followingCount}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{profile.streak_count}</div>
              <div className="text-sm text-muted-foreground">Day Streak</div>
            </div>
          </div>

          {/* Action Buttons */}
          {currentUserId !== userId && (
            <div className="flex gap-2 w-full">
              <Button
                onClick={toggleFollow}
                variant={isFollowing ? "outline" : "default"}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                onClick={handleMessage}
                variant="outline"
                className="flex-1"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
