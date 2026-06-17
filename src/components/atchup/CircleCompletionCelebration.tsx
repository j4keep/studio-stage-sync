import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CircleCompletionCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  circleName: string;
}

const CircleCompletionCelebration = ({ isOpen, onClose, circleName }: CircleCompletionCelebrationProps) => {
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; colorClass: string }>>([]);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Generate confetti pieces with design token colors
      const colorClasses = ['bg-primary', 'bg-secondary', 'bg-green-500', 'bg-yellow-500', 'bg-blue-500'];
      const pieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        colorClass: colorClasses[Math.floor(Math.random() * colorClasses.length)]
      }));
      setConfetti(pieces);
      setSpinning(true);

      // Stop spinning after animation
      const timer = setTimeout(() => setSpinning(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-background via-background to-primary/10 border-primary/30 overflow-hidden">
        {/* Confetti */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confetti.map((piece) => (
            <div
              key={piece.id}
              className={`absolute w-3 h-3 animate-confetti-fall ${piece.colorClass}`}
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-8 text-center">
          {/* Spinning Circle */}
          <div 
            className={`relative w-32 h-32 mb-6 ${spinning ? 'animate-celebration-spin' : ''}`}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <linearGradient id="celebration-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="50%" stopColor="hsl(var(--secondary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#celebration-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="url(#celebration-gradient)"
                opacity="0.2"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">🎉</span>
            </div>
          </div>

          {/* Message */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Congratulations! 🎊
          </h2>
          <p className="text-lg text-primary mb-2">
            Your circle was completed!
          </p>
          <p className="text-muted-foreground mb-6">
            <span className="font-semibold text-foreground">{circleName}</span> has successfully finished all rotations.
          </p>

          <Button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
          >
            Awesome! 🙌
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CircleCompletionCelebration;