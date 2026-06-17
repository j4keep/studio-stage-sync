import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Users, DollarSign, MessageSquare, Trophy, Heart, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import CircleCompletionCelebration from "./CircleCompletionCelebration";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  link: string | null;
};

// Only show notifications related to Savings Circles, Fundraisers, and Support
const ALLOWED_NOTIFICATION_TYPES = [
  "payment_received",
  "member_joined", 
  "circle_completed",
  "payment_reminder",
  "direct_message",
  "donation_received",
  "fundraiser_donation",
  "info",
  "success",
  "support",
  "support_ticket"
];

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [completedCircleName, setCompletedCircleName] = useState("");

  useEffect(() => {
    loadNotifications();
    const cleanup = subscribeToNotifications();
    return cleanup;
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .in("type", ALLOWED_NOTIFICATION_TYPES)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error loading notifications:", error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.read).length || 0);
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          loadNotifications();
          // Check if it's a circle completion notification
          const newNotification = payload.new as Notification;
          if (newNotification?.type === "circle_completed") {
            // Extract circle name from message or use default
            const circleName = newNotification.message.match(/["']([^"']+)["']/)?.[1] || "Your Circle";
            setCompletedCircleName(circleName);
            setCelebrationOpen(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNotificationClick = (notification: Notification) => {
    // Close popover immediately
    setIsOpen(false);
    
    // Mark as read in background (don't await)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      
      if (!notification.read) {
        supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notification.id)
          .eq("user_id", user.id)
          .then(() => {
            setNotifications(prev =>
              prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
          });
      }
    });

    // Navigate immediately if there's a link
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment_received":
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case "member_joined":
        return <Users className="w-4 h-4 text-blue-500" />;
      case "circle_completed":
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case "direct_message":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case "donation_received":
      case "fundraiser_donation":
        return <Heart className="w-4 h-4 text-pink-500" />;
      case "payment_reminder":
        return <DollarSign className="w-4 h-4 text-orange-500" />;
      case "support":
      case "support_ticket":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="relative p-2 rounded-full hover:bg-white/20 transition-colors">
            <Bell size={24} className="text-white" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full text-xs flex items-center justify-center font-bold text-white px-1"
                style={{ backgroundColor: 'hsl(var(--destructive))' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNotificationClick(notification);
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full p-4 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
                      !notification.read ? 'bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: 'hsl(var(--brand-purple))' }}
                              />
                            )}
                            {notification.link && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line">
                          {notification.message}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <CircleCompletionCelebration
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        circleName={completedCircleName}
      />
    </>
  );
};

export default NotificationBell;