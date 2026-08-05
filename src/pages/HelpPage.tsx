import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Phone, Mail, MessageCircle, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HelpPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(Boolean(data));
    });
  }, [user]);

  const helpItems = [
    {
      icon: MessageCircle,
      label: "Help Desk",
      description: "Submit a support ticket or ask a question",
      action: () => navigate("/helpdesk"),
    },
    {
      icon: FileText,
      label: "Terms of Use",
      description: "Read our terms and conditions",
      action: () => navigate("/terms"),
    },
    {
      icon: Phone,
      label: "Call Support",
      description: "954-607",
      action: () => window.open("tel:954607", "_self"),
    },
    {
      icon: Mail,
      label: "Email Support",
      description: "Get help via email",
      action: () => {},
    },
  ];

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Help & Support</h1>
      </div>

      {isAdmin ? (
        <button
          type="button"
          onClick={() => navigate("/admin/customer-relations")}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-left transition-all hover:border-primary/50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
            <Headphones className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Customer Relations
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                Admin
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Tickets, content reports, delete battles/posts
            </span>
          </div>
        </button>
      ) : null}

      <div className="flex flex-col gap-2">
        {helpItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground block">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HelpPage;
