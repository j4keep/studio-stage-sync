import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Send, Paperclip, Image, X, Plus, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  updated_at: string;
  other_user: Profile | null;
  last_message?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
}

const MessagesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (!participants || participants.length === 0) return [];

      const convIds = participants.map(p => p.conversation_id);
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, updated_at")
        .in("id", convIds)
        .order("updated_at", { ascending: false });
      if (!convs) return [];

      // Get other participants
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      const otherUserIds = (allParticipants || [])
        .filter(p => p.user_id !== user.id)
        .map(p => p.user_id);

      let profileMap: Record<string, Profile> = {};
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", otherUserIds);
        (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
      }

      // Get last messages
      const results: Conversation[] = [];
      for (const conv of convs) {
        const otherParticipant = (allParticipants || []).find(p => p.conversation_id === conv.id && p.user_id !== user.id);
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        results.push({
          id: conv.id,
          updated_at: conv.updated_at,
          other_user: otherParticipant ? profileMap[otherParticipant.user_id] || null : null,
          last_message: lastMsg?.content || "No messages yet",
        });
      }
      return results;
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  // Fetch messages for active conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", activeConversation?.id],
    queryFn: async () => {
      if (!activeConversation) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
    enabled: !!activeConversation,
    refetchInterval: 3000,
  });

  // Search users for new chat
  const { data: searchResults = [] } = useQuery({
    queryKey: ["search-users", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", `%${searchQuery}%`)
        .neq("user_id", user?.id || "")
        .limit(10);
      return (data || []) as Profile[];
    },
    enabled: showNewChat && searchQuery.length > 1,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!activeConversation) return;
    const channel = supabase
      .channel(`messages-${activeConversation.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversation.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConversation || !user) return;
    const text = messageText.trim();
    setMessageText("");
    await supabase.from("messages").insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: text,
    });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConversation.id);
    queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !user) return;

    // Convert to base64 data URL for now (small files)
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content: null,
        file_url: dataUrl,
        file_name: file.name,
        file_type: file.type,
      });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConversation.id);
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
    };
    reader.readAsDataURL(file);
    toast({ title: "File sent" });
  };

  const startConversation = async (otherUser: Profile) => {
    if (!user) return;
    // Check if conversation already exists
    const existing = conversations.find(c => c.other_user?.user_id === otherUser.user_id);
    if (existing) {
      setActiveConversation(existing);
      setShowNewChat(false);
      setSearchQuery("");
      return;
    }

    // Create new conversation
    const { data: conv } = await supabase.from("conversations").insert({}).select("id").single();
    if (!conv) return;

    await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: otherUser.user_id },
    ]);

    const newConv: Conversation = {
      id: conv.id,
      updated_at: new Date().toISOString(),
      other_user: otherUser,
      last_message: "No messages yet",
    };
    setActiveConversation(newConv);
    setShowNewChat(false);
    setSearchQuery("");
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  // Conversation view
  if (activeConversation) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => setActiveConversation(null)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="w-9 h-9 rounded-full bg-muted overflow-hidden">
            {activeConversation.other_user?.avatar_url ? (
              <img src={activeConversation.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {activeConversation.other_user?.display_name?.[0] || "?"}
              </div>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{activeConversation.other_user?.display_name || "User"}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                  {msg.content && <p className="text-sm">{msg.content}</p>}
                  {msg.file_url && msg.file_type?.startsWith("image/") && (
                    <img src={msg.file_url} alt={msg.file_name || "image"} className="max-w-full rounded-lg mt-1" />
                  )}
                  {msg.file_url && !msg.file_type?.startsWith("image/") && (
                    <a href={msg.file_url} download={msg.file_name} className="text-xs underline">{msg.file_name || "Download file"}</a>
                  )}
                  <p className={`text-[9px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <label className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          <label className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer">
            <Image className="w-4 h-4 text-muted-foreground" />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 rounded-full bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={sendMessage} disabled={!messageText.trim()} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center disabled:opacity-50">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // Conversation list
  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-display font-bold text-foreground">Messages</h1>
        <button onClick={() => setShowNewChat(true)} className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* New chat search */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a user…"
                className="flex-1 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={() => { setShowNewChat(false); setSearchQuery(""); }} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {searchResults.map((u) => (
              <button
                key={u.user_id}
                onClick={() => startConversation(u)}
                className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-muted overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{u.display_name?.[0] || "?"}</div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{u.display_name || "User"}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations */}
      {convLoading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-16 text-center">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap + to start a new chat</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-card transition-colors w-full text-left"
            >
              <div className="w-11 h-11 rounded-full bg-muted overflow-hidden shrink-0">
                {conv.other_user?.avatar_url ? (
                  <img src={conv.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold">{conv.other_user?.display_name?.[0] || "?"}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{conv.other_user?.display_name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(conv.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
