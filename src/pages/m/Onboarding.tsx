import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, TrendingUp, ArrowRight, Check } from "lucide-react";

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen onboarding
    const checkOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/welcome');
        return;
      }

      const hasSeenOnboarding = localStorage.getItem(`onboarding_seen_${user.id}`);
      if (hasSeenOnboarding) {
        navigate('/m/savings-circles');
      }
    };

    checkOnboarding();
  }, [navigate]);

  const steps = [
    {
      icon: Users,
      title: "Welcome to Savings Circles",
      description: "Join trusted groups of friends, family, or community members to save money together. Each member contributes regularly, and one person receives the full pot each round.",
      highlight: "Build wealth together"
    },
    {
      icon: Shield,
      title: "Trust & Reputation",
      description: "Your reliability score tracks your payment history. Members who consistently contribute on time build trust and unlock access to larger circles.",
      highlight: "Your reputation matters"
    },
    {
      icon: TrendingUp,
      title: "Grow Your Savings",
      description: "Whether you're saving for a big purchase, building an emergency fund, or helping others achieve their goals—Savings Circles make it social and accountable.",
      highlight: "Achieve your goals faster"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`onboarding_seen_${user.id}`, 'true');
    }
    navigate('/m/savings-circles');
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex flex-col">
      {/* Skip button */}
      <div className="p-4 flex justify-end">
        <button 
          onClick={completeOnboarding}
          className="text-purple-300 hover:text-white text-sm font-medium transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mb-8 animate-pulse">
          <Icon className="w-12 h-12 text-purple-300" />
        </div>

        {/* Highlight Badge */}
        <div className="bg-purple-500/30 text-purple-200 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          {currentStepData.highlight}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white text-center mb-4">
          {currentStepData.title}
        </h1>

        {/* Description */}
        <p className="text-purple-200 text-center text-lg leading-relaxed max-w-sm mb-12">
          {currentStepData.description}
        </p>

        {/* Progress Dots */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'w-8 bg-purple-400' 
                  : index < currentStep 
                    ? 'bg-purple-400' 
                    : 'bg-purple-700'
              }`}
            />
          ))}
        </div>

        {/* Continue Button */}
        <Button 
          onClick={handleNext}
          size="lg"
          className="w-full max-w-sm bg-purple-500 hover:bg-purple-600 text-white h-14 text-lg font-semibold"
        >
          {currentStep < steps.length - 1 ? (
            <>
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            <>
              Get Started
              <Check className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
