import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const KEY = "atchup_circle_age_ok";

const AgeGate = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(localStorage.getItem(KEY) === "true");
  }, []);

  if (ok === null) return null;

  if (!ok) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Are you 18 or over?</h1>
            <p className="text-sm text-muted-foreground">
              Atchup savings circles and fundraisers are only available to adults 18+.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full h-11"
              onClick={() => {
                localStorage.setItem(KEY, "true");
                setOk(true);
              }}
            >
              Yes, I'm 18 or over
            </Button>
            <Button variant="ghost" className="w-full h-11" onClick={() => navigate("/")}>
              No, take me back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AgeGate;
