import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, CheckCircle, ImagePlus, X, AlertTriangle } from "lucide-react";

const CATEGORIES = [
  { value: "general", label: "General Question" },
  { value: "complaint", label: "Complaint" },
  { value: "savings_circle", label: "Savings Circle Issue" },
  { value: "payment", label: "Payment Problem" },
  { value: "account", label: "Account Issue" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "other", label: "Other" },
];

const MAX_TICKETS = 10;
const MAX_IMAGES = 3;

interface Props {
  onTicketCreated?: () => void;
}

export default function SupportTicketForm({ onTicketCreated }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    subject: "",
    category: "general",
    message: "",
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > MAX_IMAGES) {
      toast({
        title: "Too many images",
        description: `You can only attach up to ${MAX_IMAGES} images.`,
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: `${file.name} is not an image.`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setImages(prev => [...prev, ...validFiles]);
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.subject.trim() || !form.message.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Not logged in",
          description: "Please log in to submit a support ticket.",
          variant: "destructive",
        });
        return;
      }

      // Check ticket count and delete oldest if at limit
      const { data: existingTickets, error: countError } = await supabase
        .from("support_tickets")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (countError) throw countError;

      // If at max tickets, delete the oldest one
      if (existingTickets && existingTickets.length >= MAX_TICKETS) {
        const oldestTicket = existingTickets[0];
        await supabase
          .from("support_tickets")
          .delete()
          .eq("id", oldestTicket.id);
        
        toast({
          title: "Oldest ticket replaced",
          description: "You've reached the 10-ticket limit. Your oldest ticket was removed.",
        });
      }

      // Get user profile info
      const { data: profile } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", user.id)
        .single();

      // Upload images if any
      const uploadedImageUrls: string[] = [];
      
      for (const image of images) {
        const fileName = `${user.id}/${Date.now()}-${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(fileName, image);

        if (uploadError) {
          console.error("Image upload error:", uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("support-attachments")
          .getPublicUrl(fileName);

        uploadedImageUrls.push(fileName);
      }

      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_name: profile?.name || "Unknown",
        subject: form.subject.trim(),
        category: form.category,
        message: form.message.trim(),
        images: uploadedImageUrls,
      });

      if (error) throw error;

      // Try to send email notification (don't fail if it doesn't work)
      try {
        await supabase.functions.invoke("support-ticket-notification", {
          body: {
            subject: form.subject,
            category: form.category,
            message: form.message,
            user_name: profile?.name,
            user_email: profile?.email || user.email,
            has_images: uploadedImageUrls.length > 0,
          },
        });
      } catch (emailError) {
        console.log("Email notification skipped:", emailError);
      }

      // Notify admins about the new ticket
      try {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "New Support Ticket",
              message: `${profile?.name || "A user"} submitted: "${form.subject.substring(0, 50)}${form.subject.length > 50 ? '...' : ''}"`,
              type: "support_ticket",
              link: "/m/support-admin",
              read: false,
            });
          }
        }
      } catch (adminNotifyError) {
        console.log("Admin notification skipped:", adminNotifyError);
      }

      setSubmitted(true);
      onTicketCreated?.();
      toast({
        title: "Ticket submitted!",
        description: "We'll respond within 24-48 hours.",
      });
    } catch (error: any) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="card-elevated bg-white/95 backdrop-blur-sm p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Message Sent!</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Thank you for contacting us. We'll review your message and respond within 24-48 hours.
        </p>
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setForm({ subject: "", category: "general", message: "" });
              setImages([]);
              setImagePreviews([]);
            }}
          >
            Send Another
          </Button>
          <Button onClick={() => navigate("/m/profile")}>
            Back to Profile
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-elevated bg-white/95 backdrop-blur-sm p-6">
      <h2 className="text-xl font-semibold mb-2">Contact Support</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Send us a message and we'll get back within 24–48 hours.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          You can have up to {MAX_TICKETS} tickets on file. After that, the oldest ticket will be automatically replaced.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={form.category}
            onValueChange={(value) => setForm({ ...form, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            placeholder="Brief summary of your issue"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message *</Label>
          <Textarea
            id="message"
            placeholder="Describe your issue in detail..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={5}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {form.message.length}/2000
          </p>
        </div>

        {/* Image Upload Section */}
        <div className="space-y-2">
          <Label>Attach Images (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview}
                  alt={`Attachment ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs mt-1">Add</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground">
            Max {MAX_IMAGES} images, 5MB each. JPG, PNG, or GIF.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
