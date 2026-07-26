import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { jobNotificationsEnabled } from "@/pages/JobPreferencesPage";

const isJobNotification = (n: any) =>
  n?.type === "job" ||
  n?.type === "job_application" ||
  n?.reference_type === "job" ||
  n?.reference_type === "job_application";

const NotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const notificationsEnabled = localStorage.getItem("wheuat_notifications") !== "false";
  const showJobNotifs = jobNotificationsEnabled();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id, showJobNotifs],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data || [];
      if (showJobNotifs) return rows;
      return rows.filter((n: any) => !isJobNotification(n));
    },
    enabled: !!user && notificationsEnabled,
  });

  const unreadCount = notifications.filter((n: any) => !(n.is_read || n.read)).length;

  // Realtime
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient, notificationsEnabled]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await (supabase as any)
        .from("notifications")
        .update({ is_read: true, read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const handleNotificationClick = async (notification: any) => {
    if (user && !(notification.is_read || notification.read)) {
      await (supabase as any)
        .from("notifications")
        .update({ is_read: true, read: true })
        .eq("id", notification.id)
        .eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
    if (notification.reference_type === "battle") navigate("/battles");
    else if (notification.reference_type === "message") {
      if (notification.reference_id) navigate("/messages", { state: { conversationId: notification.reference_id } });
      else navigate("/messages");
    }
    else if (notification.reference_type === "purchase") navigate("/earnings");
    else if (notification.reference_type === "post") navigate("/feed");
    else if (notification.reference_type === "booking") navigate("/bookings");
    else if (notification.reference_type === "ticket") navigate("/help");
    else if (notification.reference_type === "follow") navigate(`/artist/${notification.reference_id}`);
    else if (notification.reference_type === "studio") navigate("/my-studios");
    else if (notification.reference_type === "session_verify") navigate("/bookings");
    else if (notification.reference_type === "gig" || notification.type === "gig") {
      if (notification.reference_id) navigate(`/gigs/${notification.reference_id}`);
      else navigate("/my-gigs");
    }
    else if (notification.reference_type === "job_application" || notification.reference_type === "job" || notification.type === "job" || notification.type === "job_application") {
      if (notification.title === "Job removed" || String(notification.title || "").toLowerCase().includes("interview") || !notification.reference_id) {
        navigate("/my-jobs");
      } else {
        navigate(`/jobs/${notification.reference_id}`);
      }
    }
    setOpen(false);
  };

  if (!notificationsEnabled) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Bell className="w-4 h-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border pr-12">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-display">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead.mutate()} className="text-xs text-primary font-semibold">
                Mark all read
              </button>
            )}
          </div>
        </SheetHeader>
        <div className="overflow-y-auto max-h-[80vh]">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n: any) => (
              <button
                key={n.id}
                onClick={() => void handleNotificationClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                  !(n.is_read || n.read) ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isJobNotification(n) && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                          Jobs
                        </span>
                      )}
                      <p className={`text-sm font-semibold truncate ${!(n.is_read || n.read) ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!(n.is_read || n.read) && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBell;
