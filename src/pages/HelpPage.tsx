import { ArrowLeft, FileText, Phone, Mail, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HelpPage = () => {
  const navigate = useNavigate();

  const helpItems = [
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
    {
      icon: MessageCircle,
      label: "FAQ",
      description: "Frequently asked questions",
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
