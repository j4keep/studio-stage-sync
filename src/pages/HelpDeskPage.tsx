import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Send, Clock, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Ticket {
  id: string;
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

const HelpDeskPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    const { data } = await (supabase as any)
      .from("support_tickets")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
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

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return;
    const { error } = await (supabase as any).from("support_tickets").insert({
      user_id: user!.id,
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 2000),
    });
    if (error) {
      toast({ title: "Error", description: "Failed to create ticket" });
      return;
    }
    toast({ title: "Ticket created!", description: "We'll get back to you soon." });
    setSubject("");
    setMessage("");
    setShowCreate(false);
    fetchTickets();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    await (supabase as any).from("ticket_replies").insert({
      ticket_id: selectedTicket.id,
      user_id: user!.id,
      message: replyText.trim().slice(0, 2000),
      is_admin: false,
    });
    setReplyText("");
    fetchReplies(selectedTicket.id);
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchReplies(ticket.id);
  };

  // Ticket detail view
  if (selectedTicket) {
    const sc = statusConfig[selectedTicket.status] || statusConfig.open;
    const StatusIcon = sc.icon;
    return (
      <div className="px-4 pt-6 pb-24 flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedTicket(null)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground line-clamp-1">{selectedTicket.subject}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusIcon className={`w-3 h-3 ${sc.color}`} />
              <span className={`text-[10px] font-medium ${sc.color}`}>{sc.label}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-3">
          {/* Original message */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-foreground">{selectedTicket.message}</p>
            <p className="text-[9px] text-muted-foreground mt-1">{new Date(selectedTicket.created_at).toLocaleDateString()}</p>
          </div>

          {replies.map((r) => (
            <div key={r.id} className={`p-3 rounded-xl ${r.is_admin ? "bg-card border border-border ml-0 mr-6" : "bg-primary/10 ml-6 mr-0"}`}>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{r.is_admin ? "Support Team" : "You"}</p>
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
              placeholder="Type a reply..."
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

  // Create ticket form
  if (showCreate) {
    return (
      <div className="px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-display font-bold text-foreground">New Ticket</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
              maxLength={200}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 resize-none"
              maxLength={2000}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!subject.trim() || !message.trim()}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary disabled:opacity-50"
          >
            Submit Ticket
          </button>
        </div>
      </div>
    );
  }

  // Ticket list
  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground flex-1">Help Desk</h1>
        <button onClick={() => setShowCreate(true)} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center glow-primary">
          <Plus className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tickets yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary">
            Create Your First Ticket
          </button>
        </div>
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
                  <p className="text-[10px] text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString()}</p>
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

export default HelpDeskPage;
