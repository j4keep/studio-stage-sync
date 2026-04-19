import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, User, Calendar, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import wheuatLogo from "@/assets/wheuat-logo.png";

type AuthView = "splash" | "welcome" | "login" | "signup" | "forgot";

const AuthPage = () => {
  const [view, setView] = useState<AuthView>("splash");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const redirectPath = searchParams.get("redirect");

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate(redirectPath || "/", { replace: true });
  }, [user, navigate, redirectPath]);

  // Splash animation → welcome
  useEffect(() => {
    if (view === "splash") {
      const timer = setTimeout(() => setView("welcome"), 2400);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Play pop sound on splash
  useEffect(() => {
    if (view === "splash") {
      const audio = new Audio("data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToAAAA/P0BAQUJDREVGRkdHR0dHRkZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIA==");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }
  }, [view]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName || !dob) {
      toast({ title: "All fields required", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName, date_of_birth: dob },
      },
    });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a confirmation link to verify your account." });
      setView("login");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Enter your email", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
      setView("login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 max-w-lg mx-auto relative overflow-hidden">
      {/* SPLASH */}
      {view === "splash" && (
        <div className="flex flex-col items-center justify-center">
          <img
            src={wheuatLogo}
            alt="WHEUAT"
            className="w-40 h-40 object-contain"
          />
          <div className="w-40 h-1 rounded-full gradient-primary mt-6" />
        </div>
      )}

      {/* WELCOME */}
      {view === "welcome" && (
        <div className="w-full flex flex-col items-center">
          <img
            src={wheuatLogo}
            alt="WHEUAT"
            className="w-24 h-24 object-contain mb-6"
          />
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Welcome to WHEUAT
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Your music. Your platform. Your future.
          </p>
          <button
            onClick={() => setView("login")}
            className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold glow-primary mb-3"
          >
            Log In
          </button>
          <button
            onClick={() => setView("signup")}
            className="w-full py-3.5 rounded-xl bg-card border border-border text-foreground text-sm font-display font-bold"
          >
            Create Account
          </button>
        </div>
      )}

      {/* LOGIN */}
      {view === "login" && (
        <div className="w-full flex flex-col">
            <button onClick={() => setView("welcome")} className="mb-6 text-muted-foreground self-start">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Welcome back</h2>
            <p className="text-sm text-muted-foreground mb-8">Sign in to your account</p>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-card border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setView("forgot")}
              className="text-xs text-primary mt-3 self-end"
            >
              Forgot password?
            </button>

            <button
              onClick={handleLogin}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold glow-primary mt-6 disabled:opacity-50"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Don't have an account?{" "}
              <button onClick={() => setView("signup")} className="text-primary font-semibold">
                Sign up
              </button>
            </p>
          </div>
      )}

      {/* SIGNUP */}
      {view === "signup" && (
        <div className="w-full flex flex-col">
            <button onClick={() => setView("welcome")} className="mb-6 text-muted-foreground self-start">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Create account</h2>
            <p className="text-sm text-muted-foreground mb-8">Join the WHEUAT community</p>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  placeholder="Date of birth"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-card border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleSignup}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold glow-primary mt-6 disabled:opacity-50"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Already have an account?{" "}
              <button onClick={() => setView("login")} className="text-primary font-semibold">
                Sign in
              </button>
            </p>
          </div>
      )}

      {/* FORGOT PASSWORD */}
      {view === "forgot" && (
        <div className="w-full flex flex-col">
            <button onClick={() => setView("login")} className="mb-6 text-muted-foreground self-start">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Reset password</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Enter your email and we'll send you a reset link
            </p>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            <button
              onClick={handleForgotPassword}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-display font-bold glow-primary mt-6 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </div>
      )}
    </div>
  );
};

export default AuthPage;
