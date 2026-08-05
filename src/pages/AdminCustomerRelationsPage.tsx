import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Flag,
  Trash2,
  Shield,
} from "lucide-react";
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
  category?: string | null;
  created_at: string;
}

interface Reply {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  admin_notes?: string | null;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  open: { icon: AlertCircle, color: "text-yellow-500", label: "Open" },
  in_progress: { icon: Clock, color: "text-blue-500", label: "In Progress" },
  in_review: { icon: Clock, color: "text-blue-500", label: "In Review" },
  resolved: { icon: CheckCircle, color: "text-green-500", label: "Resolved" },
  dismissed: { icon: CheckCircle, color: "text-muted-foreground", label: "Dismissed" },
  closed: { icon: CheckCircle, color: "text-muted-foreground", label: "Closed" },
};

type Tab = "tickets" | "reports";

/**
 * Admin-only Customer Relations portal.
 * Path: /admin/customer-relations (also /admin/tickets)
 */
const AdminCustomerRelationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [modTargetType, setModTargetType] = useState<"battle" | "post">("battle");
  const [modTargetId, setModTargetId] = useState("");
  const [modBusy, setModBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(Boolean(data));
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "tickets") void fetchTickets();
    else void fetchReports();
  }, [filter, tab, isAdmin]);

  const fetchTickets = async () => {
    setLoading(true);
    const query = (supabase as any)
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query.eq("status", filter);
    const { data } = await query;
    setTickets(data || []);
    setLoading(false);
  };

  const fetchReports = async () => {
    setLoading(true);
    const query = (supabase as any)
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query.eq("status", filter === "in_progress" ? "in_review" : filter);
    const { data, error } = await query;
    if (error) {
      toast({ title: "Could not load reports", description: error.message });
      setReports([]);
    } else {
      setReports(data || []);
    }
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
    if (!replyText.trim() || !selectedTicket || !user) return;
    await (supabase as any).from("ticket_replies").insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      message: replyText.trim().slice(0, 2000),
      is_admin: true,
    });
    setReplyText("");
    fetchReplies(selectedTicket.id);
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    await (supabase as any)
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    toast({ title: `Ticket ${status}` });
    if (selectedTicket) setSelectedTicket({ ...selectedTicket, status });
    fetchTickets();
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    if (!user) return;
    await (supabase as any)
      .from("content_reports")
      .update({
        status,
        resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
        resolved_by: user.id,
      })
      .eq("id", reportId);
    toast({ title: `Report ${status}` });
    setSelectedReport((prev) => (prev ? { ...prev, status } : prev));
    fetchReports();
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setSelectedReport(null);
    fetchReplies(ticket.id);
    if (ticket.status === "open") updateTicketStatus(ticket.id, "in_progress");
  };

  const deleteTarget = async (targetType: "battle" | "post", targetId: string) => {
    if (!targetId.trim()) return;
    if (
      !window.confirm(
        `Permanently delete this ${targetType}?\n\nID: ${targetId}\n\nThis is an admin moderation action.`,
      )
    ) {
      return;
    }
    setModBusy(true);
    const table = targetType === "battle" ? "battles" : "posts";
    const { error } = await (supabase as any).from(table).delete().eq("id", targetId.trim());
    setModBusy(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message });
      return;
    }
    toast({ title: `${targetType} deleted` });
    if (selectedReport?.target_id === targetId.trim()) {
      await updateReportStatus(selectedReport.id, "resolved");
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 pt-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Admin only</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Customer Relations is only available on admin accounts.
          </p>
        </div>
      </div>
    );
  }

  if (selectedTicket) {
    const sc = statusConfig[selectedTicket.status] || statusConfig.open;
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col px-4 pb-24 pt-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedTicket(null);
              fetchTickets();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="line-clamp-1 text-sm font-bold text-foreground">{selectedTicket.subject}</h1>
            <p className="text-[9px] text-muted-foreground">
              User: {selectedTicket.user_id.slice(0, 8)}…
              {selectedTicket.category ? ` · ${selectedTicket.category}` : ""}
            </p>
          </div>
          <div className="flex gap-1.5">
            {selectedTicket.status !== "resolved" && (
              <button
                onClick={() => updateTicketStatus(selectedTicket.id, "resolved")}
                className="rounded-lg bg-green-500/10 px-2.5 py-1 text-[9px] font-bold text-green-500"
              >
                Resolve
              </button>
            )}
            {selectedTicket.status !== "closed" && (
              <button
                onClick={() => updateTicketStatus(selectedTicket.id, "closed")}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex-1 space-y-3 overflow-y-auto">
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
            <p className="mb-1 text-[10px] font-semibold text-muted-foreground">User</p>
            <p className="whitespace-pre-wrap text-xs text-foreground">{selectedTicket.message}</p>
            <p className="mt-1 text-[9px] text-muted-foreground">
              {new Date(selectedTicket.created_at).toLocaleString()}
            </p>
          </div>
          {replies.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-3 ${
                r.is_admin ? "ml-6 bg-primary/10" : "mr-6 border border-border bg-card"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                {r.is_admin ? "You (Admin)" : "User"}
              </p>
              <p className="text-xs text-foreground">{r.message}</p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {selectedTicket.status !== "closed" && (
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type admin reply..."
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none"
              maxLength={2000}
            />
            <button
              onClick={handleReply}
              className="glow-primary flex h-10 w-10 items-center justify-center rounded-xl gradient-primary"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (selectedReport) {
    const sc = statusConfig[selectedReport.status] || statusConfig.open;
    return (
      <div className="px-4 pb-24 pt-6">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedReport(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground">Content report</h1>
            <p className={`text-[10px] font-medium ${sc.color}`}>{sc.label}</p>
          </div>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-border bg-card p-4 text-xs">
          <p>
            <span className="font-semibold text-muted-foreground">Type:</span>{" "}
            {selectedReport.target_type}
          </p>
          <p className="break-all">
            <span className="font-semibold text-muted-foreground">ID:</span> {selectedReport.target_id}
          </p>
          <p>
            <span className="font-semibold text-muted-foreground">Reason:</span> {selectedReport.reason}
          </p>
          {selectedReport.details ? (
            <p>
              <span className="font-semibold text-muted-foreground">Details:</span>{" "}
              {selectedReport.details}
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            Reporter {selectedReport.reporter_id.slice(0, 8)}… ·{" "}
            {new Date(selectedReport.created_at).toLocaleString()}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={modBusy}
            onClick={() =>
              void deleteTarget(
                selectedReport.target_type === "post" ? "post" : "battle",
                selectedReport.target_id,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 py-2 text-[11px] font-bold text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete reported {selectedReport.target_type}
          </button>
          <button
            type="button"
            onClick={() => void updateReportStatus(selectedReport.id, "resolved")}
            className="rounded-xl bg-green-500/10 px-3 py-2 text-[11px] font-bold text-green-500"
          >
            Mark resolved
          </button>
          <button
            type="button"
            onClick={() => void updateReportStatus(selectedReport.id, "dismissed")}
            className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const filters =
    tab === "tickets"
      ? ["all", "open", "in_progress", "resolved", "closed"]
      : ["all", "open", "in_review", "resolved", "dismissed"];

  return (
    <div className="px-4 pb-24 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Customer Relations</h1>
          <p className="text-[10px] text-muted-foreground">Admin inbox · tickets · reports · removals</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setTab("tickets");
            setFilter("open");
          }}
          className={`rounded-xl px-3 py-2.5 text-xs font-bold ${
            tab === "tickets"
              ? "gradient-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground"
          }`}
        >
          Support tickets
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("reports");
            setFilter("open");
          }}
          className={`rounded-xl px-3 py-2.5 text-xs font-bold ${
            tab === "reports"
              ? "gradient-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground"
          }`}
        >
          Content reports
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-bold text-foreground">Quick moderation delete</p>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Paste a battle or post ID from a report/ticket to remove it as admin.
        </p>
        <div className="mb-2 flex gap-2">
          <select
            value={modTargetType}
            onChange={(e) => setModTargetType(e.target.value as "battle" | "post")}
            className="h-9 rounded-lg border border-border bg-muted px-2 text-xs"
          >
            <option value="battle">Battle</option>
            <option value="post">Post</option>
          </select>
          <input
            value={modTargetId}
            onChange={(e) => setModTargetId(e.target.value)}
            placeholder="Content UUID"
            className="h-9 flex-1 rounded-lg border border-border bg-muted px-2 text-xs"
          />
        </div>
        <button
          type="button"
          disabled={modBusy || !modTargetId.trim()}
          onClick={() => void deleteTarget(modTargetType, modTargetId)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 text-[11px] font-bold text-rose-400 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete as admin
        </button>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all ${
              filter === f
                ? "gradient-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {f === "in_progress"
              ? "In Progress"
              : f === "in_review"
                ? "In Review"
                : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tab === "tickets" ? (
        tickets.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No tickets found</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const sc = statusConfig[ticket.status] || statusConfig.open;
              const StatusIcon = sc.icon;
              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <StatusIcon className={`h-4 w-4 ${sc.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{ticket.subject}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()} · {ticket.user_id.slice(0, 8)}…
                      {ticket.category ? ` · ${ticket.category}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold ${sc.color}`}
                  >
                    {sc.label}
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : reports.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No content reports</p>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const sc = statusConfig[report.status] || statusConfig.open;
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
                  <Flag className="h-4 w-4 text-rose-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-foreground">
                    {report.target_type}: {report.reason}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(report.created_at).toLocaleDateString()} · {report.target_id.slice(0, 8)}…
                  </p>
                </div>
                <span
                  className={`rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold ${sc.color}`}
                >
                  {sc.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCustomerRelationsPage;
