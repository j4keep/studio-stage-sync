import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Paperclip, Image, X, Plus, MessageCircle, MoreHorizontal, Video, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isBlockedBetween, blockUser } from "@/lib/blocks";
import { getOrCreateConversation } from "@/lib/messaging";
import { resolveMarketplaceChatPeers } from "@/lib/marketplace-api";
import { fetchRatingsByUserIds, type DisplayRating } from "@/lib/ratings";
import UserRatingStars from "@/components/UserRatingStars";
import MarketplaceMoreOptionsSheet, {
  type MoreOptionsPeerRole,
} from "@/components/marketplace/MarketplaceMoreOptionsSheet";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";
import { toast as sonnerToast } from "sonner";
import { encodeCallInvite, parseCallInvite, callInviteLabel, type MessageCallKind } from "@/lib/message-call";


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
  hideOtherYajPage?: boolean;
  openBusinessProfile?: boolean;
  openMarketplaceProfile?: boolean;
  /** Persisted origin from conversations.context */
  context?: string | null;
  /** Marketplace: whether the other person is seller or buyer in this thread */
  marketplacePeerRole?: "seller" | "buyer";
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

type MessagesNavState = {
  conversationId?: string;
  startWithUserId?: string;
  startWithProfile?: Profile;
  hideOtherYajPage?: boolean;
  hideMyYajPage?: boolean;
  gigId?: string;
  gigTitle?: string;
  /** Exact message the sender wrote (helper's own intro) — sent instead of a canned line. */
  introMessage?: string;
  /** Open the other person's Local Help business profile from the chat header. */
  openBusinessProfile?: boolean;
  /** Open the other person's Marketplace profile from the chat header. */
  openMarketplaceProfile?: boolean;
  /** Other party role in Marketplace chat (seller | buyer). */
  marketplacePeerRole?: "seller" | "buyer";
} | null;

const MessagesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideOtherYajPage, setHideOtherYajPage] = useState(false);
  const [openMarketplaceProfile, setOpenMarketplaceProfile] = useState(false);
  const [marketplacePeerRole, setMarketplacePeerRole] = useState<"seller" | "buyer">("seller");
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [peerRatings, setPeerRatings] = useState<Record<string, DisplayRating>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoStartKeyRef = useRef<string | null>(null);

  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (!participants || participants.length === 0) return [];

      const convIds = participants.map((p) => p.conversation_id);
      let convs: { id: string; updated_at: string; context?: string | null }[] | null = null;
      {
        const withCtx = await (supabase as any)
          .from("conversations")
          .select("id, updated_at, context")
          .in("id", convIds)
          .order("updated_at", { ascending: false });
        if (withCtx.error && /context/i.test(withCtx.error.message || "")) {
          const fallback = await supabase
            .from("conversations")
            .select("id, updated_at")
            .in("id", convIds)
            .order("updated_at", { ascending: false });
          convs = fallback.data;
        } else {
          if (withCtx.error) throw withCtx.error;
          convs = withCtx.data;
        }
      }
      if (!convs) return [];

      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      const otherUserIds = (allParticipants || [])
        .filter((p) => p.user_id !== user.id)
        .map((p) => p.user_id);

      const profileMap: Record<string, Profile> = {};
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", otherUserIds);
        (profiles || []).forEach((p) => {
          profileMap[p.user_id] = p;
        });
      }

      const results: Conversation[] = [];
      for (const conv of convs) {
        const otherParticipant = (allParticipants || []).find(
          (p) => p.conversation_id === conv.id && p.user_id !== user.id,
        );
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const ctx = (conv as { context?: string | null }).context ?? null;
        results.push({
          id: conv.id,
          updated_at: conv.updated_at,
          other_user: otherParticipant ? profileMap[otherParticipant.user_id] || null : null,
          last_message: lastMsg?.content || "No messages yet",
          context: ctx,
          openMarketplaceProfile: ctx === "marketplace",
          openBusinessProfile: ctx === "local_help",
          hideOtherYajPage: ctx === "marketplace" || ctx === "local_help",
        });
      }

      // Stamp Marketplace flags even when conversations.context is missing / not migrated yet
      try {
        const peerMeta = await resolveMarketplaceChatPeers(user.id, otherUserIds);
        for (const row of results) {
          const otherId = row.other_user?.user_id;
          if (!otherId) continue;
          const meta = peerMeta[otherId];
          if (!meta && row.context !== "marketplace") continue;
          row.openMarketplaceProfile = true;
          row.context = row.context || "marketplace";
          row.hideOtherYajPage = true;
          if (meta?.peerRole) row.marketplacePeerRole = meta.peerRole;
          else if (!row.marketplacePeerRole) row.marketplacePeerRole = "seller";
        }
      } catch {
        /* best-effort */
      }

      return results;
    },
    enabled: !!user,
    staleTime: 10_000,
  });

  useEffect(() => {
    const ids = conversations.map((c) => c.other_user?.user_id).filter(Boolean) as string[];
    if (!ids.length) {
      setPeerRatings({});
      return;
    }
    let alive = true;
    void fetchRatingsByUserIds(ids).then((map) => {
      if (alive) setPeerRatings(map);
    });
    return () => {
      alive = false;
    };
  }, [conversations]);

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

  useEffect(() => {
    if (!user || !activeConversation?.id) return;
    void (async () => {
      await Promise.all([
        (supabase as any)
          .from("messages")
          .update({ read: true })
          .eq("conversation_id", activeConversation.id)
          .neq("sender_id", user.id)
          .eq("read", false),
        (supabase as any)
          .from("notifications")
          .update({ is_read: true, read: true })
          .eq("user_id", user.id)
          .eq("reference_type", "message")
          .eq("reference_id", activeConversation.id)
          .eq("is_read", false),
      ]);
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
    })();
  }, [activeConversation?.id, queryClient, user?.id]);

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

  useEffect(() => {
    if (!activeConversation) return;
    const channel = supabase
      .channel(`messages-${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeConversation) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 150);
      return () => window.clearTimeout(t);
    }
  }, [activeConversation?.id]);

  const startCall = async (kind: MessageCallKind) => {
    if (!activeConversation || !user) return;
    const otherId = activeConversation.other_user?.user_id;
    if (otherId && (await isBlockedBetween(user.id, otherId))) {
      toast({
        title: "Can't call this user",
        description: "You're blocked from each other on YAJ.",
        variant: "destructive",
      });
      return;
    }
    await supabase.from("messages").insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: encodeCallInvite(kind, activeConversation.id),
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversation.id);
    queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate(`/call/${activeConversation.id}?kind=${kind}`);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConversation || !user || sending) return;
    const otherId = activeConversation.other_user?.user_id;
    if (otherId && (await isBlockedBetween(user.id, otherId))) {
      toast({
        title: "Can't message this user",
        description: "You're blocked from each other on YAJ.",
        variant: "destructive",
      });
      return;
    }
    const text = messageText.trim();
    setMessageText("");
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content: text,
      });
      if (error) {
        setMessageText(text);
        toast({ title: error.message || "Message failed", variant: "destructive" });
        return;
      }
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversation.id);
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !user) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content: null,
        file_url: dataUrl,
        file_name: file.name,
        file_type: file.type,
      });
      if (error) {
        toast({ title: error.message || "Upload failed", variant: "destructive" });
        return;
      }
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversation.id);
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversation.id] });
      toast({ title: "File sent" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startConversation = async (
    otherUser: Profile,
    opts?: {
      hideOtherYajPage?: boolean;
      introGigTitle?: string;
      introMessage?: string;
      openBusinessProfile?: boolean;
      openMarketplaceProfile?: boolean;
      marketplacePeerRole?: "seller" | "buyer";
    },
  ) => {
    if (!user) return;
    if (await isBlockedBetween(user.id, otherUser.user_id)) {
      toast({
        title: "Can't message this user",
        description: "You're blocked from each other on YAJ.",
        variant: "destructive",
      });
      return;
    }
    const peerRole = opts?.marketplacePeerRole || "seller";
    const existing = conversations.find((c) => c.other_user?.user_id === otherUser.user_id);
    if (existing) {
      if (opts?.introMessage?.trim()) {
        await supabase.from("messages").insert({
          conversation_id: existing.id,
          sender_id: user.id,
          content: opts.introMessage.trim(),
        });
        queryClient.invalidateQueries({ queryKey: ["messages", existing.id] });
      }
      if (opts?.openMarketplaceProfile) {
        try {
          await getOrCreateConversation(user.id, otherUser.user_id, { context: "marketplace" });
        } catch {
          /* ignore stamp failures (column may not exist yet) */
        }
      }
      setActiveConversation({
        ...existing,
        hideOtherYajPage: opts?.hideOtherYajPage || existing.hideOtherYajPage,
        openBusinessProfile: opts?.openBusinessProfile || existing.openBusinessProfile,
        openMarketplaceProfile: opts?.openMarketplaceProfile || existing.openMarketplaceProfile || existing.context === "marketplace",
        context: opts?.openMarketplaceProfile ? "marketplace" : existing.context,
        marketplacePeerRole: opts?.marketplacePeerRole || existing.marketplacePeerRole || peerRole,
      });
      setHideOtherYajPage(Boolean(opts?.hideOtherYajPage || existing.hideOtherYajPage));
      setOpenMarketplaceProfile(
        Boolean(opts?.openMarketplaceProfile || existing.openMarketplaceProfile || existing.context === "marketplace"),
      );
      setMarketplacePeerRole(opts?.marketplacePeerRole || existing.marketplacePeerRole || peerRole);
      setShowNewChat(false);
      setSearchQuery("");
      return;
    }

    let convId: string;
    try {
      convId = await getOrCreateConversation(user.id, otherUser.user_id, {
        context: opts?.openMarketplaceProfile ? "marketplace" : opts?.openBusinessProfile ? "local_help" : null,
      });
    } catch (e: any) {
      toast({ title: e?.message || "Could not start chat", variant: "destructive" });
      return;
    }
    const conv = { id: convId };

    const intro =
      opts?.introMessage?.trim() ||
      (opts?.introGigTitle ? `Hi — I'm interested in your gig: ${opts.introGigTitle}` : "");
    if (intro) {
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: intro,
      });
    }


    const newConv: Conversation = {
      id: conv.id,
      updated_at: new Date().toISOString(),
      other_user: otherUser,
      last_message: intro || "No messages yet",
      hideOtherYajPage: opts?.hideOtherYajPage,
      openBusinessProfile: opts?.openBusinessProfile,
      openMarketplaceProfile: opts?.openMarketplaceProfile,
      context: opts?.openMarketplaceProfile ? "marketplace" : opts?.openBusinessProfile ? "local_help" : null,
      marketplacePeerRole: opts?.marketplacePeerRole || peerRole,
    };
    setHideOtherYajPage(Boolean(opts?.hideOtherYajPage));
    setOpenMarketplaceProfile(Boolean(opts?.openMarketplaceProfile));
    setMarketplacePeerRole(opts?.marketplacePeerRole || peerRole);
    setActiveConversation(newConv);
    setShowNewChat(false);
    setSearchQuery("");
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  useEffect(() => {
    if (!user || convLoading) return;
    const state = (location.state || null) as MessagesNavState;
    const autoStartKey = state?.conversationId
      ? `conversation:${state.conversationId}`
      : state?.startWithUserId
        ? `user:${state.startWithUserId}:${state.introMessage || ""}:${state.gigTitle || ""}`
        : "";
    if (!autoStartKey) {
      autoStartKeyRef.current = null;
      return;
    }
    if (autoStartKeyRef.current === autoStartKey) return;
    if (state?.conversationId) {
      const existing = conversations.find((c) => c.id === state.conversationId);
      if (!existing) return;
      autoStartKeyRef.current = autoStartKey;
      setActiveConversation(existing);
      setHideOtherYajPage(
        Boolean(existing.hideOtherYajPage || existing.context === "marketplace" || existing.context === "local_help"),
      );
      setOpenMarketplaceProfile(
        Boolean(existing.openMarketplaceProfile || existing.context === "marketplace"),
      );
      setMarketplacePeerRole(existing.marketplacePeerRole || "seller");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (!state?.startWithUserId) return;
    autoStartKeyRef.current = autoStartKey;
    const profile =
      state.startWithProfile ||
      ({
        user_id: state.startWithUserId,
        display_name: "User",
        avatar_url: null,
      } satisfies Profile);

    void (async () => {
      let resolved = profile;
      if (!state.startWithProfile) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .eq("user_id", state.startWithUserId!)
          .maybeSingle();
        if (data) resolved = data;
      }
      await startConversation(resolved, {
        hideOtherYajPage: state.hideOtherYajPage,
        introGigTitle: state.gigTitle,
        introMessage: state.introMessage,
        openBusinessProfile: state.openBusinessProfile,
        openMarketplaceProfile: state.openMarketplaceProfile,
        marketplacePeerRole: state.marketplacePeerRole,
      });
      navigate(location.pathname, { replace: true, state: null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.state, conversations, convLoading]);

  // Active chat — fixed shell so composer stays visible above bottom nav
  if (activeConversation) {
    const isMarketplaceChat = Boolean(
      openMarketplaceProfile ||
        activeConversation.openMarketplaceProfile ||
        activeConversation.context === "marketplace",
    );
    const moreOptionsRole: MoreOptionsPeerRole = isMarketplaceChat
      ? activeConversation.marketplacePeerRole || marketplacePeerRole || "seller"
      : "user";

    return (
      <div className="fixed inset-x-0 bottom-0 top-0 z-[80] mx-auto flex h-[100dvh] w-full max-w-lg flex-col bg-background lg:static lg:z-auto lg:mx-0 lg:h-[calc(100dvh-3.5rem)] lg:max-w-none">
        <div className="sticky top-0 z-[82] flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">

          <button
            type="button"
            onClick={() => setActiveConversation(null)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back to chats"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            disabled={
              (!activeConversation.openBusinessProfile &&
                !activeConversation.openMarketplaceProfile &&
                !openMarketplaceProfile &&
                (hideOtherYajPage || activeConversation.hideOtherYajPage)) ||
              !activeConversation.other_user?.user_id
            }
            onClick={() => {
              const id = activeConversation.other_user?.user_id;
              if (!id) return;
              if (activeConversation.openBusinessProfile) {
                navigate(`/local-help/pro/${id}`);
                return;
              }
              if (openMarketplaceProfile || activeConversation.openMarketplaceProfile) {
                navigate(`/marketplace/profile/${id}`);
                return;
              }
              if (hideOtherYajPage || activeConversation.hideOtherYajPage) return;
              navigate(`/artist/${id}`);
            }}
          >
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {activeConversation.other_user?.avatar_url ? (
                <img src={activeConversation.other_user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/20 text-sm font-bold text-primary">
                  {activeConversation.other_user?.display_name?.[0] || "?"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeConversation.other_user?.display_name || "User"}
              </p>
              {activeConversation.other_user?.user_id && (
                <UserRatingStars
                  rating={peerRatings[activeConversation.other_user.user_id]}
                  variant="compact"
                  className="mt-0.5"
                />
              )}
              {activeConversation.openBusinessProfile ? (
                <p className="text-[10px] text-muted-foreground">Tap to view business profile</p>
              ) : openMarketplaceProfile || activeConversation.openMarketplaceProfile ? (
                <p className="text-[10px] text-muted-foreground">Tap to view Marketplace profile</p>
              ) : (
                (hideOtherYajPage || activeConversation.hideOtherYajPage) && (
                  <p className="text-[10px] text-muted-foreground">Name &amp; photo only</p>
                )
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => void startCall("audio")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-label="Audio call"
            title="Audio call"
          >
            <Phone className="h-4 w-4 text-foreground" />
          </button>
          <button
            type="button"
            onClick={() => void startCall("video")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-label="Video call"
            title="Video call"
          >
            <Video className="h-4 w-4 text-foreground" />
          </button>
          {activeConversation.other_user?.user_id && (
            <button
              type="button"
              onClick={() => setMoreOptionsOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
              aria-label="More options"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4 text-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveConversation(null)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            aria-label="Close chat"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>


        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const callInvite = parseCallInvite(msg.content);
            if (callInvite) {
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] rounded-2xl border border-border bg-card px-3 py-2.5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {callInvite.kind === "audio" ? <Phone className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                      {callInviteLabel(callInvite.kind, isMine)}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/call/${callInvite.conversationId}?kind=${callInvite.kind}`)}
                      className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Join call
                    </button>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isMine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"
                  }`}
                >
                  {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
                  {msg.file_url && msg.file_type?.startsWith("image/") && (
                    <img src={msg.file_url} alt={msg.file_name || "image"} className="mt-1 max-w-full rounded-lg" />
                  )}
                  {msg.file_url && !msg.file_type?.startsWith("image/") && (
                    <a href={msg.file_url} download={msg.file_name} className="text-xs underline">
                      {msg.file_name || "Download file"}
                    </a>
                  )}
                  <p className={`mt-1 text-[9px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="relative z-[81] shrink-0 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card">
              <Image className="h-4 w-4 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message…"
              className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        <MarketplaceMoreOptionsSheet
          open={moreOptionsOpen}
          onClose={() => setMoreOptionsOpen(false)}
          peerRole={moreOptionsRole}
          peerName={activeConversation.other_user?.display_name || ""}
          onViewProfile={() => {
            const id = activeConversation.other_user?.user_id;
            if (!id) return;
            if (isMarketplaceChat) {
              navigate(`/marketplace/profile/${id}`);
              return;
            }
            if (activeConversation.openBusinessProfile) {
              navigate(`/local-help/pro/${id}`);
              return;
            }
            navigate(`/artist/${id}`);
          }}
          onReport={() => {
            const label =
              moreOptionsRole === "seller"
                ? "seller"
                : moreOptionsRole === "buyer"
                  ? "buyer"
                  : "user";
            if (
              window.confirm(
                moreOptionsRole === "user"
                  ? "Report this user? We'll review their activity for policy issues."
                  : `Report this ${label}? We'll review their Marketplace activity for policy issues.`,
              )
            ) {
              sonnerToast.success("Report submitted — thanks for helping keep YAJ safe");
            }
          }}
          onBlock={() => setBlockOpen(true)}
        />

        <BlockConfirmDialog
          open={blockOpen}
          onClose={() => setBlockOpen(false)}
          name={activeConversation.other_user?.display_name || "this user"}
          loading={blockBusy}
          onConfirm={() => {
            void (async () => {
              if (!user || !activeConversation.other_user?.user_id) return;
              setBlockBusy(true);
              try {
                await blockUser(user.id, activeConversation.other_user.user_id);
                sonnerToast.success("Blocked across YAJ — manage anytime in Settings → Blocking");
                setBlockOpen(false);
                setMoreOptionsOpen(false);
                setActiveConversation(null);
                navigate("/settings/blocking");
              } catch (e: any) {
                sonnerToast.error(e?.message || "Could not block");
              } finally {
                setBlockBusy(false);
              }
            })();
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="flex-1 font-display text-xl font-bold text-foreground">Messages</h1>
        <button
          type="button"
          onClick={() => setShowNewChat(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10"
        >
          <Plus className="h-4 w-4 text-primary" />
        </button>
      </div>

      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a user…"
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  setShowNewChat(false);
                  setSearchQuery("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {searchResults.map((u) => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => void startConversation(u)}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
              >
                <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/20 text-sm font-bold text-primary">
                      {u.display_name?.[0] || "?"}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{u.display_name || "User"}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {convLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-16 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No conversations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Tap + to start a new chat</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setActiveConversation(conv);
                setHideOtherYajPage(Boolean(conv.hideOtherYajPage || conv.context === "marketplace" || conv.context === "local_help"));
                setOpenMarketplaceProfile(Boolean(conv.openMarketplaceProfile || conv.context === "marketplace"));
                setMarketplacePeerRole(conv.marketplacePeerRole || "seller");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-card"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                {conv.other_user?.avatar_url ? (
                  <img src={conv.other_user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/20 font-bold text-primary">
                    {conv.other_user?.display_name?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {conv.other_user?.display_name || "User"}
                </p>
                {conv.other_user?.user_id && (
                  <UserRatingStars
                    rating={peerRatings[conv.other_user.user_id]}
                    variant="compact"
                    className="mt-0.5"
                  />
                )}
                <p className="truncate text-xs text-muted-foreground">{conv.last_message}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
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
