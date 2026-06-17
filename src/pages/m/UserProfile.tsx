 import { useState, useEffect } from 'react';
 import { useNavigate, useParams } from 'react-router-dom';
 import { ChevronLeft } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { supabase } from '@/integrations/supabase/client';
 import VerifiedBadge from '@/components/VerifiedBadge';
 import ReputationScore from '@/components/ReputationScore';
 import FollowersModal from '@/components/FollowersModal';
 import { useFollow, useFollowerCounts } from '@/hooks/useFollow';
 import BottomTabBar from '@/components/BottomTabBar';
 
 export default function UserProfile() {
   const navigate = useNavigate();
   const { userId } = useParams<{ userId: string }>();
   const [userData, setUserData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [circlesCount, setCirclesCount] = useState(0);
   const [completedCircles, setCompletedCircles] = useState(0);
   const [showFollowers, setShowFollowers] = useState(false);
   const [followersTab, setFollowersTab] = useState<'followers' | 'following'>('followers');
   
   const { isFollowing, toggleFollow, loading: followLoading, isOwnProfile } = useFollow(userId || null);
   const { followersCount, followingCount } = useFollowerCounts(userId || null);
 
   useEffect(() => {
     if (userId) {
       loadProfile();
     }
   }, [userId]);
 
   const loadProfile = async () => {
     if (!userId) return;
     
     // Check if this is the current user's own profile
     const { data: { user } } = await supabase.auth.getUser();
     if (user?.id === userId) {
       // Redirect to own profile page
       navigate('/m/profile');
       return;
     }
     
     const { data: userData } = await supabase
       .from('users')
       .select('*')
       .eq('id', userId)
       .single();
     
     if (userData) {
       setUserData(userData);
       
       // Load circles stats
       const { data: memberData } = await supabase
         .from('savings_circle_members')
         .select('circle_id, has_received_pot')
         .eq('user_id', userId);
       
       if (memberData) {
         setCirclesCount(memberData.length);
         setCompletedCircles(memberData.filter(m => m.has_received_pot).length);
       }
     }
     
     setLoading(false);
   };
 
   const openFollowers = (tab: 'followers' | 'following') => {
     setFollowersTab(tab);
     setShowFollowers(true);
   };
 
   if (loading) {
     return (
       <div className="min-h-screen bg-black flex items-center justify-center">
         <div className="text-white">Loading...</div>
       </div>
     );
   }
 
   if (!userData) {
     return (
       <div className="min-h-screen bg-black flex items-center justify-center">
         <div className="text-white">User not found</div>
       </div>
     );
   }
 
   const getInitials = (name: string) => {
     return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
   };
 
   return (
     <div className="min-h-screen bg-black pb-20">
       {/* Header */}
       <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 py-3 flex items-center border-b border-purple-500/30">
         <button onClick={() => navigate(-1)} className="p-2 text-white">
           <ChevronLeft size={24} />
         </button>
         <h1 className="text-xl font-bold text-white ml-2">{userData.name}</h1>
       </div>
 
       <div className="px-4 py-8">
         {/* Profile Picture */}
         <div className="flex flex-col items-center mb-6">
           <div className="w-32 h-32 rounded-full border-4 border-purple-500/50 bg-gray-900 overflow-hidden mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
             {userData.photo_url ? (
               <img src={userData.photo_url} alt={userData.name} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-500 text-white text-3xl font-bold">
                 {getInitials(userData.name || '')}
               </div>
             )}
           </div>
 
           {/* Name and Badge */}
           <div className="flex items-center gap-2 mb-1">
             <h2 className="text-2xl font-bold text-white">{userData.name}</h2>
             <VerifiedBadge userId={userId!} size="md" />
           </div>
           
           {/* Tagline */}
           {userData.tagline && (
             <p className="text-purple-400 text-sm font-medium mb-1">{userData.tagline}</p>
           )}
           
           <p className="text-gray-400 text-sm text-center">{userData.bio || 'Savings Circle member'}</p>
           
           {/* Follow Button */}
           {!isOwnProfile && (
             <Button
               onClick={toggleFollow}
               disabled={followLoading}
               className={`mt-4 px-8 ${isFollowing ? 'bg-transparent border border-purple-500 text-purple-400 hover:bg-purple-500/10' : 'bg-purple-600 hover:bg-purple-700'}`}
             >
               {isFollowing ? 'Following' : 'Follow'}
             </Button>
           )}
         </div>
 
         {/* Stats Row */}
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
 
         {/* Reputation */}
         <div className="mb-6">
           <ReputationScore userId={userId!} />
         </div>
       </div>
 
       <FollowersModal
         open={showFollowers}
         onOpenChange={setShowFollowers}
         userId={userId!}
         initialTab={followersTab}
       />
 
       <BottomTabBar />
     </div>
   );
 }