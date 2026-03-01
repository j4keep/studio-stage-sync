import { useState, useEffect } from "react";
import { ArrowLeft, Send, Clock, CheckCircle, AlertCircle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface Reply {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  open: { icon: AlertCircle, color: "text-yellow-500", label: "Open" },
  in_progress: { icon: Clock, color: "text-blue-500", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "text-green-500", label: "Resolved" },
  closed: { icon: CheckCircle, color: "text-muted-foreground", label: "Closed" },
};

const AdminTicketsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    setLoading(true);
    const query = (supabase as any).from("support_tickets").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query.eq("status", filter);
    const { data } = await query;
    setTickets(data || []);
    setLoading(false);
  };

  const fetchReplies = async (ticketId: string) => {
    const { data } = await (supabase as any)
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setReplies(data || []);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    await (supabase as any).from("ticket_replies").insert({
      ticket_id: selectedTicket.id,
      user_id: user!.id,
      message: replyText.trim().slice(0, 2000),
      is_admin: true,
    });
    setReplyText("");
    fetchReplies(selectedTicket.id);
  };

  const updateStatus = async (ticketId: string, status: string) => {
    await (supabase as any).from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
    toast({ title: `Ticket ${status}` });
    if (selectedTicket) setSelectedTicket({ ...selectedTicket, status });
    fetchTickets();
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchReplies(ticket.id);
    if (ticket.status === "open") updateStatus(ticket.id, "in_progress");
  };

  // Ticket detail
  if (selectedTicket) {
    const sc = statusConfig[selectedTicket.status] || statusConfig.open;
    const StatusIcon = sc.icon;
    return (
      <div className="px-4 pt-6 pb-24 flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setSelectedTicket(null); fetchTickets(); }} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground line-clamp-1">{selectedTicket.subject}</h1>
            <p className="text-[9px] text-muted-foreground">User: {selectedTicket.user_id.slice(0, 8)}...</p>
          </div>
          <div className="flex gap-1.5">
            {selectedTicket.status !== "resolved" && (
              <button onClick={() => updateStatus(selectedTicket.id, "resolved")} className="px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500 text-[9px] font-bold">
                Resolve
              </button>
            )}
            {selectedTicket.status !== "closed" && (
              <button onClick={() => updateStatus(selectedTicket.id, "closed")} className="px-2.5 py-1 rounded-lg bg-card border border-border text-muted-foreground text-[9px] font-bold">
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-3">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">User</p>
            <p className="text-xs text-foreground">{selectedTicket.message}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{new Date(selectedTicket.created_at).toLocaleString()}</p>
          </div>

          {replies.map((r) => (
            <div key={r.id} className={`p-3 rounded-xl ${r.is_admin ? "bg-primary/10 ml-6 mr-0" : "bg-card border border-border ml-0 mr-6"}`}>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{r.is_admin ? "You (Admin)" : "User"}</p>
              <p className="text-xs text-foreground">{r.message}</p>
              <p className="text-[9px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {selectedTicket.status !== "closed" && (
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type admin reply..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
              maxLength={2000}
            />
            <button onClick={handleReply} className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-primary">
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const filters = ["all", "open", "in_progress", "resolved", "closed"];

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Support Tickets</h1>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
              filter === f ? "gradient-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No tickets found</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            return (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{ticket.subject}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString()} · {ticket.user_id.slice(0, 8)}...
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sc.color} bg-card border border-border`}>{sc.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminTicketsPage;
