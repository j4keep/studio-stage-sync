import atchupLogo from "@/assets/atchup-logo-transparent.png";
import { useNavigate } from "react-router-dom";
import { Users, Heart, Shield, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

const CIRCLE_AGE_KEY = "atchup_circle_age_ok";

const CircleHomePage = () => {
  const navigate = useNavigate();
  const [ageOk, setAgeOk] = useState<boolean | null>(null);

  useEffect(() => {
    setAgeOk(localStorage.getItem(CIRCLE_AGE_KEY) === "true");
  }, []);

  if (ageOk === null) return null;

  if (!ageOk) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center glow-primary mb-6">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Are you 18 or over?</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The Catch Up Circle (savings rotations, fundraisers, and payouts) is only available to users aged 18 and older.
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => {
              localStorage.setItem(CIRCLE_AGE_KEY, "true");
              setAgeOk(true);
            }}
            className="w-full py-3.5 rounded-full gradient-primary text-primary-foreground font-display font-bold"
          >
            Yes, I'm 18 or over
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3.5 rounded-full bg-card border border-border text-foreground font-display font-bold"
          >
            No, take me back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center mb-8">
        <img src={atchupLogo} alt="Atchup" className="w-40 h-auto mb-3" />
        <p className="text-sm text-muted-foreground italic">Catch up with your greatness</p>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-6 mb-6 text-center">
        <Users className="w-10 h-10 text-primary mx-auto mb-3" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Catch Up Circle</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Save together. Fund each other. Build with your community.
        </p>
        <button
          onClick={() => navigate("/circle/create")}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
        >
          Create a Circle <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate("/circle/join")}
          className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between text-left"
        >
          <Users className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Join a Circle</div>
            <div className="text-[11px] text-muted-foreground">Enter a host code</div>
          </div>
        </button>
        <button
          onClick={() => navigate("/circle/fundraisers")}
          className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between text-left"
        >
          <Heart className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Fundraisers</div>
            <div className="text-[11px] text-muted-foreground">Support a cause</div>
          </div>
        </button>
      </div>

      <div className="rounded-2xl bg-muted/30 border border-border p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">18+ only · Coming online</p>
          <p className="text-xs text-muted-foreground">
            The full Catch Up Circle is being wired in (savings rotations, host codes, fundraisers, ID verification, payouts). Available only to users 18 and over.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CircleHomePage;
