 import { useState, useEffect } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { supabase } from '@/integrations/supabase/client';
 import { useFollow } from '@/hooks/useFollow';
 import VerifiedBadge from '@/components/VerifiedBadge';
 import { useNavigate } from 'react-router-dom';
 
 interface FollowerUser {
   id: string;
   name: string;
   photo_url: string | null;
   tagline: string | null;
 }
 
 interface FollowersModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   userId: string;
   initialTab?: 'followers' | 'following';
 }
 
 function FollowButton({ userId }: { userId: string }) {
   const { isFollowing, toggleFollow, loading, isOwnProfile } = useFollow(userId);
   
   if (isOwnProfile) return null;
   
   return (
     <Button
       size="sm"
       variant={isFollowing ? "outline" : "default"}
       onClick={toggleFollow}
       disabled={loading}
       className={isFollowing ? "border-purple-500/50 text-purple-400" : "bg-purple-600 hover:bg-purple-700"}
     >
       {isFollowing ? 'Following' : 'Follow'}
     </Button>
   );
 }
 
 function UserRow({ user, onClose }: { user: FollowerUser; onClose: () => void }) {
   const navigate = useNavigate();
   
   const handleClick = () => {
     onClose();
     navigate(`/m/user/${user.id}`);
   };
   
   return (
     <div className="flex items-center justify-between py-3 px-2 hover:bg-gray-800/50 rounded-lg transition-colors">
       <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={handleClick}>
         {user.photo_url ? (
           <img src={user.photo_url} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
         ) : (
           <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold">
             {user.name?.charAt(0).toUpperCase() || 'U'}
           </div>
         )}
         <div>
           <div className="flex items-center gap-1.5">
             <span className="font-medium text-white">{user.name}</span>
             <VerifiedBadge userId={user.id} size="sm" />
           </div>
           {user.tagline && (
             <p className="text-xs text-gray-400">{user.tagline}</p>
           )}
         </div>
       </div>
       <FollowButton userId={user.id} />
     </div>
   );
 }
 
 export default function FollowersModal({ open, onOpenChange, userId, initialTab = 'followers' }: FollowersModalProps) {
   const [followers, setFollowers] = useState<FollowerUser[]>([]);
   const [following, setFollowing] = useState<FollowerUser[]>([]);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     if (open && userId) {
       loadData();
     }
   }, [open, userId]);
 
   const loadData = async () => {
     setLoading(true);
     
     // Get followers (people who follow this user)
     const { data: followersData } = await supabase
       .from('followers')
       .select('follower_id')
       .eq('following_id', userId);
     
     if (followersData && followersData.length > 0) {
       const followerIds = followersData.map(f => f.follower_id);
       const { data: followerUsers } = await supabase
         .from('users')
         .select('id, name, photo_url, tagline')
         .in('id', followerIds);
       setFollowers(followerUsers || []);
     } else {
       setFollowers([]);
     }
     
     // Get following (people this user follows)
     const { data: followingData } = await supabase
       .from('followers')
       .select('following_id')
       .eq('follower_id', userId);
     
     if (followingData && followingData.length > 0) {
       const followingIds = followingData.map(f => f.following_id);
       const { data: followingUsers } = await supabase
         .from('users')
         .select('id, name, photo_url, tagline')
         .in('id', followingIds);
       setFollowing(followingUsers || []);
     } else {
       setFollowing([]);
     }
     
     setLoading(false);
   };
 
   const handleClose = () => onOpenChange(false);
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
         <DialogHeader>
           <DialogTitle className="text-white text-center">Connections</DialogTitle>
         </DialogHeader>
         
         <Tabs defaultValue={initialTab} className="w-full">
           <TabsList className="grid w-full grid-cols-2 bg-gray-800">
             <TabsTrigger value="followers" className="data-[state=active]:bg-purple-600">
               Followers ({followers.length})
             </TabsTrigger>
             <TabsTrigger value="following" className="data-[state=active]:bg-purple-600">
               Following ({following.length})
             </TabsTrigger>
           </TabsList>
           
           <TabsContent value="followers" className="mt-4">
             <ScrollArea className="h-[300px]">
               {loading ? (
                 <div className="text-center text-gray-400 py-8">Loading...</div>
               ) : followers.length === 0 ? (
                 <div className="text-center text-gray-400 py-8">No followers yet</div>
               ) : (
                 <div className="space-y-1">
                   {followers.map(user => (
                     <UserRow key={user.id} user={user} onClose={handleClose} />
                   ))}
                 </div>
               )}
             </ScrollArea>
           </TabsContent>
           
           <TabsContent value="following" className="mt-4">
             <ScrollArea className="h-[300px]">
               {loading ? (
                 <div className="text-center text-gray-400 py-8">Loading...</div>
               ) : following.length === 0 ? (
                 <div className="text-center text-gray-400 py-8">Not following anyone yet</div>
               ) : (
                 <div className="space-y-1">
                   {following.map(user => (
                     <UserRow key={user.id} user={user} onClose={handleClose} />
                   ))}
                 </div>
               )}
             </ScrollArea>
           </TabsContent>
         </Tabs>
       </DialogContent>
     </Dialog>
   );
 }