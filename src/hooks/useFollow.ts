 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export function useFollow(targetUserId: string | null) {
   const { toast } = useToast();
   const [isFollowing, setIsFollowing] = useState(false);
   const [loading, setLoading] = useState(false);
   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 
   useEffect(() => {
     const checkFollowStatus = async () => {
       if (!targetUserId) return;
       
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;
       
       setCurrentUserId(user.id);
       
       // Don't check if viewing own profile
       if (user.id === targetUserId) return;
       
       const { data } = await supabase
         .from('followers')
         .select('id')
         .eq('follower_id', user.id)
         .eq('following_id', targetUserId)
         .maybeSingle();
       
       setIsFollowing(!!data);
     };
     
     checkFollowStatus();
   }, [targetUserId]);
 
   const toggleFollow = useCallback(async () => {
     if (!targetUserId || !currentUserId || loading) return;
     
     setLoading(true);
     try {
       if (isFollowing) {
         // Unfollow
         const { error } = await supabase
           .from('followers')
           .delete()
           .eq('follower_id', currentUserId)
           .eq('following_id', targetUserId);
         
         if (error) throw error;
         setIsFollowing(false);
         toast({ title: 'Unfollowed' });
       } else {
         // Follow
         const { error } = await supabase
           .from('followers')
           .insert({
             follower_id: currentUserId,
             following_id: targetUserId
           });
         
         if (error) throw error;
         setIsFollowing(true);
         toast({ title: 'Following!' });
       }
     } catch (error: any) {
       toast({ 
         title: 'Error', 
         description: error.message, 
         variant: 'destructive' 
       });
     } finally {
       setLoading(false);
     }
   }, [targetUserId, currentUserId, isFollowing, loading, toast]);
 
   return { isFollowing, toggleFollow, loading, isOwnProfile: currentUserId === targetUserId };
 }
 
 export function useFollowerCounts(userId: string | null) {
   const [followersCount, setFollowersCount] = useState(0);
   const [followingCount, setFollowingCount] = useState(0);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     const fetchCounts = async () => {
       if (!userId) return;
       
       setLoading(true);
       
       const [followersResult, followingResult] = await Promise.all([
         supabase
           .from('followers')
           .select('id', { count: 'exact', head: true })
           .eq('following_id', userId),
         supabase
           .from('followers')
           .select('id', { count: 'exact', head: true })
           .eq('follower_id', userId)
       ]);
       
       setFollowersCount(followersResult.count || 0);
       setFollowingCount(followingResult.count || 0);
       setLoading(false);
     };
     
     fetchCounts();
   }, [userId]);
 
   return { followersCount, followingCount, loading };
 }
 
 // Auto-follow all circle members when joining
 export async function autoFollowCircleMembers(circleId: string, userId: string) {
   try {
     // Get all members of the circle
     const { data: members, error: membersError } = await supabase
       .from('savings_circle_members')
       .select('user_id')
       .eq('circle_id', circleId)
       .neq('user_id', userId);
     
     if (membersError || !members) return;
     
     // Check existing follows to avoid duplicates
     const { data: existingFollows } = await supabase
       .from('followers')
       .select('following_id')
       .eq('follower_id', userId);
     
     const existingSet = new Set(existingFollows?.map(f => f.following_id) || []);
     
     // Create follow relationships for members not already followed
     const newFollows = members
       .filter(m => !existingSet.has(m.user_id))
       .map(m => ({
         follower_id: userId,
         following_id: m.user_id
       }));
     
     if (newFollows.length > 0) {
       await supabase.from('followers').insert(newFollows);
     }
     
     // Also make other members follow the new user
     const reverseFollows = members
       .map(m => ({
         follower_id: m.user_id,
         following_id: userId
       }));
     
     // Batch insert (ignore duplicates with onConflict)
     if (reverseFollows.length > 0) {
       for (const follow of reverseFollows) {
         await supabase
           .from('followers')
           .upsert(follow, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
       }
     }
   } catch (error) {
     console.error('Error auto-following circle members:', error);
   }
 }