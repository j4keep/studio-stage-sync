import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import atchupLogo from "@/assets/atchup-logo-transparent.png";

type Tab = "signup" | "signin";

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

const AuthPage = () => {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgot, setForgot] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const redirectPath = searchParams.get("redirect");

  useEffect(() => {
    if (user) navigate(redirectPath || "/", { replace: true });
  }, [user, navigate, redirectPath]);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

  const handleSignin = async () => {
    if (!email || !password) {
      toast({ title: "Missing info", description: "Enter your email and password.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
  };

  const handleSignup = async () => {
    if (!fullName || !username || !email || !password) {
      toast({ title: "All fields required", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    if (!USERNAME_RE.test(username)) {
      toast({ title: "Invalid username", description: "Use 3–24 letters, numbers, or _.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Please agree", description: "You must accept the Terms & Privacy Policy.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName, username },
      },
    });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a confirmation link." });
      setTab("signin");
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast({ title: "Enter your email", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setIsSubmitting(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Email sent", description: "Check your inbox for a reset link." });
      setForgot(false);
    }
  };

  if (splash) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <img src={atchupLogo} alt="Atchup" className="w-44 h-auto object-contain" />
        <div className="w-32 h-1 rounded-full gradient-primary mt-6" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-xl border border-border p-6 sm:p-8">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center mb-6">
          <img src={atchupLogo} alt="Atchup" className="w-28 h-auto object-contain mb-2" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground text-center leading-tight">
            Catch up with your greatness.
          </h1>
        </div>

        {forgot ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-display font-bold text-foreground">Reset password</h2>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background border-border"
            />
            <button
              onClick={handleForgot}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full gradient-primary text-primary-foreground font-display font-bold disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
            <button onClick={() => setForgot(false)} className="text-sm text-primary">
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex bg-muted rounded-full p-1 mb-6">
              <button
                onClick={() => setTab("signup")}
                className={`flex-1 py-2.5 rounded-full text-sm font-display font-bold transition-all ${
                  tab === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sign up
              </button>
              <button
                onClick={() => setTab("signin")}
                className={`flex-1 py-2.5 rounded-full text-sm font-display font-bold transition-all ${
                  tab === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sign in
              </button>
            </div>

            {tab === "signup" ? (
              <div className="flex flex-col gap-4">
                <Field label="Full name">
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-full bg-background border-border h-12 px-4" />
                </Field>
                <Field label="Username (letters, numbers, _ )" hint="Unique. Shown publicly.">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    className="rounded-full bg-background border-border h-12 px-4"
                  />
                </Field>
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-full bg-background border-border h-12 px-4" />
                </Field>
                <Field label="Password" hint="8+ characters">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-full bg-background border-border h-12 px-4 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                <label className="flex items-start gap-3 cursor-pointer mt-1">
                  <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} className="mt-0.5" />
                  <span className="text-sm text-foreground leading-snug">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary underline">Terms & Conditions</Link>{" "}
                    and{" "}
                    <Link to="/terms#privacy" className="text-primary underline">Privacy Policy</Link>
                  </span>
                </label>

                <button
                  onClick={handleSignup}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full gradient-primary text-primary-foreground font-display font-bold disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? "Creating account..." : "Create account"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-full bg-background border-border h-12 px-4" />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-full bg-background border-border h-12 px-4 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                <button onClick={() => setForgot(true)} className="text-xs text-primary self-end">
                  Forgot password?
                </button>

                <button
                  onClick={handleSignin}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full gradient-primary text-primary-foreground font-display font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-foreground">{label}</label>
    {children}
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </div>
);

export default AuthPage;
