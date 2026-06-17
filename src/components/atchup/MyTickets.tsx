import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Clock, CheckCircle, MessageSquare, Loader2, Trash2, Download, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  images: string[] | null;
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

interface Props {
  refreshTrigger?: number;
}

export default function MyTickets({ refreshTrigger }: Props) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, [refreshTrigger]);

  const loadTickets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as Ticket[]) || []);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    setDeleting(ticketId);
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      
      // Delete associated images from storage
      if (ticket?.images && ticket.images.length > 0) {
        for (const imagePath of ticket.images) {
          await supabase.storage
            .from("support-attachments")
            .remove([imagePath]);
        }
      }

      const { error } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;

      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setSelectedTicket(null);
      toast({
        title: "Ticket deleted",
        description: "Your support ticket has been removed.",
      });
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      toast({
        title: "Error",
        description: "Failed to delete ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const downloadTicket = (ticket: Ticket) => {
    const content = `
SUPPORT TICKET
==============
Ticket ID: ${ticket.id}
Date: ${format(new Date(ticket.created_at), "PPpp")}
Category: ${CATEGORY_LABELS[ticket.category] || ticket.category}
Status: ${ticket.status.replace("_", " ").toUpperCase()}
Subject: ${ticket.subject}

YOUR MESSAGE:
${ticket.message}

${ticket.admin_response ? `
SUPPORT RESPONSE (${ticket.responded_at ? format(new Date(ticket.responded_at), "PPpp") : "N/A"}):
${ticket.admin_response}
` : "STATUS: Awaiting response"}

${ticket.images && ticket.images.length > 0 ? `
ATTACHMENTS: ${ticket.images.length} image(s) attached
` : ""}
---
Downloaded from Atchup Support
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticket.id.slice(0, 8)}-${format(new Date(ticket.created_at), "yyyy-MM-dd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Ticket downloaded",
      description: "Your ticket has been saved to your device.",
    });
  };

  const getImageUrl = (imagePath: string) => {
    const { data } = supabase.storage
      .from("support-attachments")
      .getPublicUrl(imagePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <Card className="card-elevated bg-white/95 backdrop-blur-sm p-6">
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="card-elevated bg-white/95 backdrop-blur-sm p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Your Support Tickets
          <Badge variant="outline" className="ml-auto">
            {tickets.length}/10
          </Badge>
        </h2>

        <div className="space-y-3">
          {tickets.slice(0, 5).map((ticket) => (
            <div
              key={ticket.id}
              className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedTicket(ticket)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={`${STATUS_COLORS[ticket.status]} text-white text-xs`}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    {ticket.admin_response && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        Replied
                      </Badge>
                    )}
                    {ticket.images && ticket.images.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        {ticket.images.length}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {format(new Date(ticket.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {tickets.length > 5 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing 5 of {tickets.length} tickets
          </p>
        )}
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLORS[selectedTicket.status]} text-white`}>
                    {selectedTicket.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  Submitted {format(new Date(selectedTicket.created_at), "PPpp")}
                </p>

                {/* Your Message */}
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">Your Message:</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                </div>

                {/* Attached Images */}
                {selectedTicket.images && selectedTicket.images.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Attachments:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.images.map((imagePath, index) => (
                        <a
                          key={index}
                          href={getImageUrl(imagePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={getImageUrl(imagePath)}
                            alt={`Attachment ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Response */}
                {selectedTicket.admin_response ? (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-green-700">Support Response:</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                    {selectedTicket.responded_at && (
                      <p className="text-xs text-green-600 mt-2">
                        Received {format(new Date(selectedTicket.responded_at), "PPp")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700">
                      ⏳ Awaiting response. We'll get back to you within 24-48 hours.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedTicket && downloadTicket(selectedTicket)}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting === selectedTicket?.id}
                  className="w-full sm:w-auto"
                >
                  {deleting === selectedTicket?.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this support ticket and any attached images. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => selectedTicket && deleteTicket(selectedTicket.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
