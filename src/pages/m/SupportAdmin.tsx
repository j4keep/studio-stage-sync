import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Send, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-500",
  in_progress: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-gray-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  complaint: "Complaint",
  savings_circle: "Savings Circle",
  payment: "Payment",
  account: "Account",
  bug: "Bug Report",
  feature: "Feature Request",
  other: "Other",
};

export default function SupportAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/welcome");
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this page.",
          variant: "destructive",
        });
        navigate("/m/profile");
        return;
      }

      setIsAdmin(true);
      await loadTickets();
    } catch (error) {
      console.error("Error checking admin:", error);
      navigate("/m/profile");
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as SupportTicket[]) || []);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Error",
        description: "Failed to load support tickets.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!selectedTicket || !response.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Only update response fields - status is managed separately via dropdown
      const { error } = await supabase
        .from("support_tickets")
        .update({
          admin_response: response.trim(),
          responded_at: new Date().toISOString(),
          responded_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Create notification for the user
      await supabase.functions.invoke("create-notification", {
        body: {
          user_id: selectedTicket.user_id,
          title: "Support Response",
          message: `We've responded to your ticket: "${selectedTicket.subject}"`,
          type: "support",
          link: "/help",
        },
      });

      toast({
        title: "Response sent!",
        description: "The user will be notified.",
      });

      setSelectedTicket(null);
      setResponse("");
      await loadTickets();
    } catch (error: any) {
      console.error("Error responding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send response.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;
      await loadTickets();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === "all") return true;
    return t.status === filter;
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white">Support Admin</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadTickets}
            className="text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {["all", "open", "in_progress", "resolved", "closed"].map((status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(status)}
              className={filter !== status ? "bg-white/10 border-white/20 text-white" : ""}
            >
              {status === "all" ? "All" : status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
              {status !== "all" && (
                <span className="ml-1 text-xs">
                  ({tickets.filter(t => t.status === status).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-3 bg-yellow-500/20 border-yellow-500/30">
            <div className="text-2xl font-bold text-yellow-400">
              {tickets.filter(t => t.status === "open").length}
            </div>
            <div className="text-xs text-yellow-200">Open</div>
          </Card>
          <Card className="p-3 bg-blue-500/20 border-blue-500/30">
            <div className="text-2xl font-bold text-blue-400">
              {tickets.filter(t => t.status === "in_progress").length}
            </div>
            <div className="text-xs text-blue-200">In Progress</div>
          </Card>
          <Card className="p-3 bg-green-500/20 border-green-500/30">
            <div className="text-2xl font-bold text-green-400">
              {tickets.filter(t => t.status === "resolved").length}
            </div>
            <div className="text-xs text-green-200">Resolved</div>
          </Card>
        </div>

        {/* Ticket List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card className="p-8 text-center bg-white/95">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">No tickets found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="p-4 bg-white/95 cursor-pointer hover:bg-white transition-colors"
                onClick={() => {
                  setSelectedTicket(ticket);
                  setResponse(ticket.admin_response || "");
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${STATUS_COLORS[ticket.status]} text-white text-xs`}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[ticket.category] || ticket.category}
                      </Badge>
                    </div>
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {ticket.user_name} • {ticket.user_email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  {ticket.status === "open" && (
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Ticket Info */}
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLORS[selectedTicket.status]} text-white`}>
                    {selectedTicket.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p><strong>From:</strong> {selectedTicket.user_name} ({selectedTicket.user_email})</p>
                  <p><strong>Date:</strong> {format(new Date(selectedTicket.created_at), "PPpp")}</p>
                </div>

                {/* User Message */}
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">User Message:</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>

                {/* Previous Response */}
                {selectedTicket.admin_response && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm font-medium mb-1 text-green-700">Your Response:</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                    {selectedTicket.responded_at && (
                      <p className="text-xs text-green-600 mt-2">
                        Sent {format(new Date(selectedTicket.responded_at), "PPp")}
                      </p>
                    )}
                  </div>
                )}

                {/* Response Form */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(val) => updateStatus(selectedTicket.id, val)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    placeholder="Type your response..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                  />

                  <Button
                    className="w-full"
                    onClick={handleRespond}
                    disabled={submitting || !response.trim()}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Response
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
