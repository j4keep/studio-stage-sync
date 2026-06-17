import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Search, UserPlus, Ban, Tag, Camera, Mic, Image, Plus, Users, Loader2 } from "lucide-react";
import EmojiPicker from "@/components/EmojiPicker";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import BottomTabBar from "@/components/BottomTabBar";
import NotificationBell from "@/components/NotificationBell";
import { z } from "zod";
import { toast } from "sonner";
import { useMessageSound } from "@/hooks/useMessageSound";

interface User {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  privacy_show_email?: boolean;
}

interface Thread {
  id: string;
  participant_ids: string[];
  last_message_at: string;
  created_at: string;
  circle_id?: string | null;
  is_group?: boolean;
  group_name?: string | null;
}

interface Message {
  id: string;
  thread_id: string | null;
  sender_id: string;
  receiver_id: string | null;
  content: string;
  created_at: string;
  read: boolean;
  circle_id?: string | null;
}

interface CircleInfo {
  id: string;
  name: string;
  current_members: number;
}

interface ThreadWithUser {
  thread: Thread;
  otherUser: User | null;
  lastMessage: Message | null;
  unreadCount: number;
  circleInfo?: CircleInfo | null;
  membersList?: User[];
}

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadWithUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [userCircles, setUserCircles] = useState<CircleInfo[]>([]);
  const [showCircleSelector, setShowCircleSelector] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Initialize message sound hook
  useMessageSound(currentUser?.id || null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const userId = searchParams.get('user');
      const circleId = searchParams.get('circle');
      if (circleId) {
        openOrCreateCircleThread(circleId);
      } else if (userId) {
        openOrCreateThread(userId);
      } else {
        loadThreads();
        loadUserCircles();
      }
    }
  }, [currentUser, searchParams]);

  useEffect(() => {
    if (selectedThread && currentUser) {
      loadMessages();
      
      // Set up realtime subscription for messages
      const channel = supabase
        .channel(`messages:${selectedThread.thread.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${selectedThread.thread.id}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as Message;
              // Only add if not from current user (they already see it optimistically)
              if (newMessage.sender_id !== currentUser.id) {
                setMessages(prev => [...prev, newMessage]);
              }
              // Mark as read if receiver (for direct messages)
              if (newMessage.receiver_id === currentUser.id && !selectedThread.thread.is_group) {
                supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('id', newMessage.id)
                  .then(() => {});
              }
            } else if (payload.eventType === 'DELETE') {
              setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedThread, currentUser]);

  const loadUserCircles = async () => {
    if (!currentUser) return;

    const { data: memberships } = await supabase
      .from('savings_circle_members')
      .select('circle_id')
      .eq('user_id', currentUser.id);

    if (!memberships || memberships.length === 0) return;

    const circleIds = memberships.map(m => m.circle_id);
    const { data: circles } = await supabase
      .from('savings_circles')
      .select('id, name, current_members')
      .in('id', circleIds)
      .in('status', ['active', 'forming']);

    if (circles) {
      setUserCircles(circles);
    }
  };

  const openOrCreateCircleThread = async (circleId: string) => {
    if (!currentUser) return;

    // Check if user is a member of this circle
    const { data: membership } = await supabase
      .from('savings_circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!membership) {
      toast.error("You're not a member of this circle");
      return;
    }

    // Get circle info
    const { data: circleInfo } = await supabase
      .from('savings_circles')
      .select('id, name, current_members')
      .eq('id', circleId)
      .single();

    if (!circleInfo) {
      toast.error("Circle not found");
      return;
    }

    // Find or create group thread for this circle
    const { data: existingThread } = await supabase
      .from('threads')
      .select('*')
      .eq('circle_id', circleId)
      .eq('is_group', true)
      .maybeSingle();

    let thread: Thread;
    if (existingThread) {
      thread = existingThread;
    } else {
      // Get all circle members
      const { data: members } = await supabase
        .from('savings_circle_members')
        .select('user_id')
        .eq('circle_id', circleId);

      const memberIds = members?.map(m => m.user_id) || [currentUser.id];

      const { data: newThread, error } = await supabase
        .from('threads')
        .insert({
          participant_ids: memberIds,
          circle_id: circleId,
          is_group: true,
          group_name: circleInfo.name
        })
        .select()
        .single();

      if (error || !newThread) {
        toast.error("Failed to create group chat");
        return;
      }
      thread = newThread;
    }

    // Get circle members for display
    const { data: memberUsers } = await supabase
      .from('savings_circle_members')
      .select('user_id')
      .eq('circle_id', circleId);

    const memberIds = memberUsers?.map(m => m.user_id) || [];
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, photo_url, privacy_show_email')
      .in('id', memberIds);

    setSelectedThread({
      thread,
      otherUser: null,
      lastMessage: null,
      unreadCount: 0,
      circleInfo,
      membersList: users || []
    });
  };

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/welcome');
      return;
    }

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (data) setCurrentUser(data);
  };

  const openOrCreateThread = async (userId: string) => {
    if (!currentUser) return;

    // Check if blocked
    const { data: blocked } = await supabase.rpc('is_blocked', { 
      user_a: currentUser.id, 
      user_b: userId 
    });

    if (blocked) {
      toast.error("Cannot message this user");
      return;
    }

    // Find or create thread
    const { data: existingThread } = await supabase
      .from('threads')
      .select('*')
      .contains('participant_ids', [currentUser.id, userId])
      .maybeSingle();

    let thread: Thread;
    if (existingThread) {
      thread = existingThread;
    } else {
      const { data: newThread, error } = await supabase
        .from('threads')
        .insert({
          participant_ids: [currentUser.id, userId]
        })
        .select()
        .single();

      if (error || !newThread) {
        toast.error("Failed to create conversation");
        return;
      }
      thread = newThread;
    }

    // Get other user
    const { data: otherUser } = await supabase
      .from('users')
      .select('id, name, email, photo_url, privacy_show_email')
      .eq('id', userId)
      .single();

    if (otherUser) {
      setSelectedThread({ 
        thread, 
        otherUser, 
        lastMessage: null, 
        unreadCount: 0 
      });
    }
  };

  const loadThreads = async () => {
    if (!currentUser) return;
    setIsLoadingThreads(true);

    try {
      // Get all threads for current user
      const { data: userThreads } = await supabase
        .from('threads')
        .select('*')
        .contains('participant_ids', [currentUser.id])
        .order('last_message_at', { ascending: false });

      if (!userThreads) {
        setIsLoadingThreads(false);
        return;
      }

      // Separate group and direct threads
      const groupThreads = userThreads.filter(t => t.is_group && t.circle_id);
      const directThreads = userThreads.filter(t => !t.is_group);

      // Get other users from threads
      const otherUserIds = directThreads.map(thread => 
        thread.participant_ids.find((id: string) => id !== currentUser.id)
      ).filter(Boolean);

      // Get circle info for group threads
      const circleIds = groupThreads.map(t => t.circle_id).filter(Boolean);

      // Run all queries in parallel for better performance
      const [usersResult, circlesResult, messagesResult] = await Promise.all([
        otherUserIds.length > 0 
          ? supabase.from('users').select('id, name, email, photo_url, privacy_show_email').in('id', otherUserIds)
          : { data: [] },
        circleIds.length > 0 
          ? supabase.from('savings_circles').select('id, name, current_members').in('id', circleIds)
          : { data: [] },
        supabase.from('messages').select('*').in('thread_id', userThreads.map(t => t.id)).order('created_at', { ascending: false }).limit(100)
      ]);

      const users = usersResult.data;
      const circles = circlesResult.data;
      const allMessages = messagesResult.data;

      const threadsWithUsers: ThreadWithUser[] = userThreads.map(thread => {
        const threadMessages = allMessages?.filter(m => m.thread_id === thread.id) || [];
        const lastMessage = threadMessages[0] || null;

        if (thread.is_group && thread.circle_id) {
          const circleInfo = circles?.find(c => c.id === thread.circle_id);
          return {
            thread,
            otherUser: null,
            lastMessage,
            unreadCount: 0,
            circleInfo
          };
        } else {
          const otherUserId = thread.participant_ids.find((id: string) => id !== currentUser.id);
          const otherUser = users?.find(u => u.id === otherUserId);
          const unreadCount = threadMessages.filter(
            m => m.receiver_id === currentUser.id && !m.read
          ).length;

          return {
            thread,
            otherUser: otherUser || null,
            lastMessage,
            unreadCount
          };
        }
      }).filter(t => t.otherUser || t.circleInfo);

      setThreads(threadsWithUsers);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadMessages = async () => {
    if (!currentUser || !selectedThread) return;
    setIsLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', selectedThread.thread.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      if (data) {
        setMessages(data);
        
        // Mark messages as read (non-blocking)
        const unreadIds = data
          .filter(m => m.receiver_id === currentUser.id && !m.read)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          supabase
            .from('messages')
            .update({ read: true })
            .in('id', unreadIds)
            .then(() => {});
        }
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const messageSchema = z.object({
    content: z.string()
      .trim()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message too long (max 2000 characters)')
  });

  const sendMessage = async () => {
    if (!currentUser || !selectedThread) return;
    
    const hasText = messageText.trim().length > 0;
    const hasImages = pendingImages.length > 0;
    
    if (!hasText && !hasImages) return;

    // Validate message content if there's text
    if (hasText) {
      const validation = messageSchema.safeParse({ content: messageText });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    const messageContent = hasText ? messageText.trim() : (hasImages ? '📷 Image' : '');
    const imagesToSend = [...pendingImages];
    
    setMessageText('');
    setPendingImages([]);

    const isGroupChat = selectedThread.thread.is_group;
    
    const messagePayload: any = {
      thread_id: selectedThread.thread.id,
      sender_id: currentUser.id,
      content: messageContent,
      images: imagesToSend.length > 0 ? imagesToSend : null
    };

    if (isGroupChat && selectedThread.thread.circle_id) {
      messagePayload.circle_id = selectedThread.thread.circle_id;
      messagePayload.receiver_id = null;
    } else if (selectedThread.otherUser) {
      messagePayload.receiver_id = selectedThread.otherUser.id;
    }

    const { data, error } = await supabase.from('messages').insert(messagePayload).select().single();

    if (error || !data) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setMessageText(messageContent);
      setPendingImages(imagesToSend);
      return;
    }

    // Optimistically add message to sender's view
    setMessages(prev => [...prev, data]);

    // Update thread timestamp
    await supabase
      .from('threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', selectedThread.thread.id);

    // Send notification (only for direct messages)
    if (!isGroupChat && selectedThread.otherUser) {
      const notificationMessage = imagesToSend.length > 0 
        ? '📷 Sent you an image' 
        : (messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent);
      
      supabase.functions.invoke('create-notification', {
        body: {
          user_id: selectedThread.otherUser.id,
          title: `New message from ${currentUser.name}`,
          message: notificationMessage,
          type: 'info'
        }
      }).catch(err => console.error('Failed to create notification:', err));
    }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      toast.error('Failed to delete message');
    } else {
      toast.success('Message deleted');
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || !currentUser) return;

    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('name', `%${query}%`)
      .neq('id', currentUser.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const handleUserSelect = async (userId: string) => {
    setNewMessageOpen(false);
    setUserSearch("");
    setSearchResults([]);
    await openOrCreateThread(userId);
  };

  const blockUser = async () => {
    if (!currentUser || !selectedThread) return;

    const { error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: currentUser.id,
        blocked_id: selectedThread.otherUser.id
      });

    if (error) {
      toast.error("Failed to block user");
    } else {
      toast.success("User blocked");
      setShowBlockDialog(false);
      setSelectedThread(null);
      loadThreads();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredThreads = threads.filter(t =>
    (t.otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.circleInfo?.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Separate group and direct threads for display
  const groupChats = filteredThreads.filter(t => t.thread.is_group);
  const directChats = filteredThreads.filter(t => !t.thread.is_group);

  if (selectedThread) {
    const isGroupChat = selectedThread.thread.is_group;
    const chatName = isGroupChat 
      ? selectedThread.circleInfo?.name || selectedThread.thread.group_name || 'Group Chat'
      : selectedThread.otherUser?.name || 'Unknown';
    const memberCount = selectedThread.membersList?.length || selectedThread.circleInfo?.current_members || 0;

    return (
      <div className="min-h-screen bg-[hsl(240,10%,4%)] pb-20">
        {/* Header */}
        <div className="bg-[hsl(240,10%,6%)]/90 backdrop-blur-sm border-b border-[hsl(247,30%,25%)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <button onClick={() => setSelectedThread(null)}>
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              {isGroupChat ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(247,100%,65%)] to-[hsl(280,100%,60%)] flex items-center justify-center border-2 border-[hsl(247,100%,65%)]/50">
                  <Users className="w-5 h-5 text-white" />
                </div>
              ) : (
                <Avatar className="w-10 h-10 border-2 border-[hsl(247,100%,65%)]/50">
                  <AvatarImage src={selectedThread.otherUser?.photo_url || undefined} alt={chatName} />
                  <AvatarFallback className="bg-[hsl(247,100%,65%)] text-white font-bold">
                    {getInitials(chatName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-white">{chatName}</h1>
                {isGroupChat ? (
                  <p className="text-xs text-[hsl(240,5%,65%)]">{memberCount} members</p>
                ) : (
                  selectedThread.otherUser?.privacy_show_email && (
                    <p className="text-xs text-[hsl(240,5%,65%)]">{selectedThread.otherUser.email}</p>
                  )
                )}
              </div>
            </div>
            {!isGroupChat && (
              <button 
                onClick={() => setShowBlockDialog(true)}
                className="hover:opacity-70 transition-opacity"
                title="Block User"
              >
                <Ban className="w-6 h-6 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[hsl(240,10%,4%)]" style={{ height: 'calc(100vh - 200px)' }}>
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-[hsl(247,100%,65%)] animate-spin" />
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isSent = msg.sender_id === currentUser?.id;
                const showDate = index === 0 || 
                  new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                
                // For group chats, find sender info
                const senderInfo = isGroupChat 
                  ? selectedThread.membersList?.find(u => u.id === msg.sender_id)
                  : selectedThread.otherUser;
                
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs text-[hsl(240,5%,65%)] px-3 py-1 rounded-full bg-[hsl(240,10%,15%)]">
                          {new Date(msg.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          }).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}>
                      {!isSent && (
                        <Avatar className="w-8 h-8 mr-2 flex-shrink-0 border border-[hsl(247,30%,25%)]">
                          <AvatarImage src={senderInfo?.photo_url || undefined} />
                          <AvatarFallback className="text-xs bg-[hsl(247,100%,65%)] text-white">
                            {getInitials(senderInfo?.name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isSent 
                          ? 'bg-[hsl(247,100%,65%)] text-white rounded-br-sm shadow-[0_0_10px_rgba(91,76,255,0.3)]' 
                          : 'bg-[hsl(240,10%,15%)] text-white rounded-bl-sm border border-[hsl(247,30%,25%)]'
                      }`}>
                        {isGroupChat && !isSent && senderInfo && (
                          <p className="text-xs font-medium text-[hsl(247,100%,75%)] mb-1">{senderInfo.name}</p>
                        )}
                        {/* Display images if present */}
                        {(msg as any).images && (msg as any).images.length > 0 && (
                          <div className={`grid gap-1 mb-2 ${(msg as any).images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {(msg as any).images.map((imgUrl: string, imgIndex: number) => (
                              <img 
                                key={imgIndex}
                                src={imgUrl} 
                                alt="Shared image" 
                                className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(imgUrl, '_blank')}
                              />
                            ))}
                          </div>
                        )}
                        {msg.content && msg.content !== '📷 Image' && (
                          <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={`text-[10px] ${isSent ? 'text-white/70' : 'text-[hsl(240,5%,65%)]'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                          {isSent && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-white/70 hover:text-white transition-opacity"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="fixed bottom-20 left-0 right-0 bg-[hsl(240,10%,6%)]/95 backdrop-blur-sm border-t border-[hsl(247,30%,25%)] p-3 z-10">
          {/* Pending Image Preview */}
          {pendingImages.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto max-w-4xl mx-auto">
              {pendingImages.map((img, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img src={img} alt="Pending" className="w-16 h-16 object-cover rounded-lg border border-[hsl(247,30%,25%)]" />
                  <button
                    onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !currentUser) return;
              
              setIsUploadingImage(true);
              try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
                
                const { data, error } = await supabase.storage
                  .from('message-images')
                  .upload(fileName, file);
                
                if (error) throw error;
                
                const { data: { publicUrl } } = supabase.storage
                  .from('message-images')
                  .getPublicUrl(data.path);
                
                setPendingImages(prev => [...prev, publicUrl]);
                toast.success("Image uploaded!");
              } catch (error) {
                console.error('Upload error:', error);
                toast.error("Failed to upload image");
              } finally {
                setIsUploadingImage(false);
                e.target.value = '';
              }
            }}
          />
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="p-2 rounded-full hover:bg-[hsl(247,100%,65%)]/20 transition-colors flex-shrink-0 disabled:opacity-50"
              title="Upload Photo"
            >
              {isUploadingImage ? (
                <Loader2 className="w-5 h-5 text-[hsl(247,100%,65%)] animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-[hsl(247,100%,65%)]" />
              )}
            </button>
            <div className="flex-1 flex items-center gap-2 bg-[hsl(240,10%,15%)] border border-[hsl(247,30%,25%)] rounded-full px-4 py-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Message..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-white placeholder:text-[hsl(240,5%,50%)]"
              />
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                      toast.error("Voice recognition not supported in this browser");
                      return;
                    }
                    if (isRecording) {
                      toast.info("Already listening...");
                      return;
                    }
                    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.continuous = false;
                    recognition.interimResults = true;
                    recognition.lang = 'en-US';
                    
                    recognition.onstart = () => {
                      setIsRecording(true);
                      toast.info("🎤 Listening... Speak now");
                    };
                    
                    recognition.onresult = (event: any) => {
                      const transcript = Array.from(event.results)
                        .map((result: any) => result[0].transcript)
                        .join('');
                      setMessageText(prev => prev + transcript);
                    };
                    
                    recognition.onend = () => {
                      setIsRecording(false);
                      toast.success("Voice captured!");
                    };
                    
                    recognition.onerror = (event: any) => {
                      setIsRecording(false);
                      if (event.error === 'no-speech') {
                        toast.error("No speech detected. Try again.");
                      } else if (event.error === 'not-allowed') {
                        toast.error("Microphone access denied. Please enable it in settings.");
                      } else {
                        toast.error("Voice recognition error");
                      }
                    };
                    
                    recognition.start();
                  }}
                  className={`p-1 hover:opacity-70 transition-opacity ${isRecording ? 'text-red-500 animate-pulse' : ''}`}
                  title="Voice Input"
                >
                  <Mic className={`w-5 h-5 ${isRecording ? 'text-red-500' : 'text-white'}`} />
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="p-1 hover:opacity-70 transition-opacity disabled:opacity-50"
                  title="Upload Image"
                >
                  <Image className="w-5 h-5 text-white" />
                </button>
                <EmojiPicker onEmojiSelect={(emoji) => setMessageText(prev => prev + emoji)} />
              </div>
            </div>
            <Button 
              onClick={sendMessage} 
              size="icon" 
              disabled={(!messageText.trim() && pendingImages.length === 0)}
              className="bg-[hsl(247,100%,65%)] hover:bg-[hsl(247,100%,55%)] text-white rounded-full flex-shrink-0 shadow-[0_0_10px_rgba(91,76,255,0.3)] disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <AlertDialogContent className="bg-[hsl(240,10%,10%)] border-[hsl(247,30%,25%)]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Block User</AlertDialogTitle>
              <AlertDialogDescription className="text-[hsl(240,5%,65%)]">
                Are you sure you want to block {selectedThread.otherUser?.name}? They won't be able to message you.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[hsl(240,10%,15%)] border-[hsl(247,30%,25%)] text-white hover:bg-[hsl(240,10%,20%)]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={blockUser} className="bg-[hsl(247,100%,65%)] hover:bg-[hsl(247,100%,55%)]">Block</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(240,10%,4%)] pb-20">
      {/* Header */}
      <div className="bg-[hsl(240,10%,6%)]/90 backdrop-blur-sm border-b border-[hsl(247,30%,25%)] p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}>
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Messages</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={newMessageOpen} onOpenChange={setNewMessageOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-full hover:bg-[hsl(247,100%,65%)]/20 transition-colors">
                  <UserPlus className="w-6 h-6 text-white" />
                </button>
              </SheetTrigger>
              <SheetContent className="bg-[hsl(240,10%,8%)] border-[hsl(247,30%,25%)]">
                <SheetHeader>
                  <SheetTitle className="text-white">New Message</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <Input
                    placeholder="Search people..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    className="bg-[hsl(240,10%,15%)] border-[hsl(247,30%,25%)] text-white placeholder:text-[hsl(240,5%,50%)]"
                  />
                  <div className="space-y-2">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-[hsl(247,100%,65%)]/20 rounded-lg transition-colors"
                      >
                        <Avatar className="border border-[hsl(247,30%,25%)]">
                          <AvatarImage src={user.photo_url || undefined} alt={user.name} />
                          <AvatarFallback className="bg-[hsl(247,100%,65%)] text-white">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-sm text-[hsl(240,5%,65%)]">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <NotificationBell />
          </div>
        </div>

        {/* Circle Group Chats Section */}
        {userCircles.length > 0 && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setShowCircleSelector(!showCircleSelector)}
              className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-[hsl(247,100%,65%)]/20 to-[hsl(280,100%,60%)]/20 border border-[hsl(247,100%,65%)]/30 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(247,100%,65%)] to-[hsl(280,100%,60%)] flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">Circle Group Chats</p>
                  <p className="text-xs text-[hsl(240,5%,65%)]">{userCircles.length} circle{userCircles.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <ArrowLeft className={`w-5 h-5 text-white transition-transform ${showCircleSelector ? 'rotate-90' : '-rotate-90'}`} />
            </button>
            
            {showCircleSelector && (
              <div className="mt-2 space-y-2">
                {userCircles.map(circle => {
                  const existingThread = groupChats.find(t => t.thread.circle_id === circle.id);
                  return (
                    <button
                      key={circle.id}
                      onClick={() => openOrCreateCircleThread(circle.id)}
                      className="w-full flex items-center gap-3 p-3 bg-[hsl(240,10%,8%)] border border-[hsl(247,30%,25%)] rounded-xl hover:bg-[hsl(247,100%,65%)]/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(247,100%,65%)] to-[hsl(280,100%,60%)] flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-white">{circle.name}</p>
                        <p className="text-xs text-[hsl(240,5%,65%)]">{circle.current_members} members</p>
                      </div>
                      {existingThread?.lastMessage && (
                        <span className="text-xs text-[hsl(240,5%,65%)]">
                          {formatTime(existingThread.lastMessage.created_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[hsl(240,5%,50%)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-10 bg-[hsl(240,10%,15%)] border-[hsl(247,30%,25%)] text-white placeholder:text-[hsl(240,5%,50%)]"
          />
        </div>
      </div>

      {/* Threads List */}
      <div className="p-4 space-y-2">
        {isLoadingThreads ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-[hsl(247,100%,65%)] animate-spin" />
          </div>
        ) : (
          <>
        {/* Group Chats with recent messages */}
        {groupChats.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-[hsl(240,5%,65%)] uppercase tracking-wider mb-2 px-1">Circle Chats</h3>
            {groupChats.map(({ thread, circleInfo, lastMessage }) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThread({ thread, otherUser: null, lastMessage, unreadCount: 0, circleInfo })}
                className="w-full bg-[hsl(240,10%,8%)] border border-[hsl(247,30%,25%)] rounded-xl p-4 flex items-center gap-3 hover:bg-[hsl(247,100%,65%)]/10 hover:border-[hsl(247,100%,65%)]/30 transition-colors shadow-[0_0_15px_rgba(91,76,255,0.1)] mb-2"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(247,100%,65%)] to-[hsl(280,100%,60%)] flex items-center justify-center flex-shrink-0 border-2 border-[hsl(247,100%,65%)]/50">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{circleInfo?.name || thread.group_name}</h3>
                    {lastMessage && (
                      <span className="text-xs text-[hsl(240,5%,65%)]">{formatTime(lastMessage.created_at)}</span>
                    )}
                  </div>
                  {lastMessage && (
                    <p className="text-sm text-[hsl(240,5%,65%)] truncate">{lastMessage.content}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Direct Messages */}
        {directChats.length > 0 && (
          <div>
            {groupChats.length > 0 && (
              <h3 className="text-xs font-semibold text-[hsl(240,5%,65%)] uppercase tracking-wider mb-2 px-1">Direct Messages</h3>
            )}
            {directChats.map(({ thread, otherUser, lastMessage, unreadCount }) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThread({ thread, otherUser, lastMessage, unreadCount })}
                className="w-full bg-[hsl(240,10%,8%)] border border-[hsl(247,30%,25%)] rounded-xl p-4 flex items-center gap-3 hover:bg-[hsl(247,100%,65%)]/10 hover:border-[hsl(247,100%,65%)]/30 transition-colors shadow-[0_0_15px_rgba(91,76,255,0.1)] mb-2"
              >
                <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-[hsl(247,100%,65%)]/50">
                  <AvatarImage src={otherUser?.photo_url || undefined} alt={otherUser?.name} />
                  <AvatarFallback className="bg-[hsl(247,100%,65%)] text-white font-bold">
                    {getInitials(otherUser?.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{otherUser?.name}</h3>
                    {lastMessage && (
                      <span className="text-xs text-[hsl(240,5%,65%)]">{formatTime(lastMessage.created_at)}</span>
                    )}
                  </div>
                  {lastMessage && (
                    <p className="text-sm text-[hsl(240,5%,65%)] truncate">{lastMessage.content}</p>
                  )}
                </div>
                {unreadCount > 0 && (
                  <div className="w-6 h-6 rounded-full bg-[hsl(247,100%,65%)] text-white flex items-center justify-center text-xs font-bold shadow-[0_0_10px_rgba(91,76,255,0.5)]">
                    {unreadCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {filteredThreads.length === 0 && userCircles.length === 0 && !isLoadingThreads && (
          <div className="text-center text-[hsl(240,5%,65%)] py-8">
            No conversations yet. Click + to start a new message.
          </div>
        )}
          </>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
};

export default Messages;