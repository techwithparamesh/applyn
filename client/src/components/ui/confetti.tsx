import React, { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
  speedX: number;
  speedY: number;
  type: "square" | "circle" | "triangle";
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
  pieces?: number;
}

const COLORS = [
  "#00E5FF", // cyan
  "#A855F7", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#3B82F6", // blue
  "#EC4899", // pink
  "#FBBF24", // yellow
];

export function Confetti({ active, duration = 3000, pieces = 100 }: ConfettiProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    setIsVisible(true);
    const newConfetti: ConfettiPiece[] = [];

    for (let i = 0; i < pieces; i++) {
      newConfetti.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
        speedX: (Math.random() - 0.5) * 3,
        speedY: 2 + Math.random() * 3,
        type: ["square", "circle", "triangle"][Math.floor(Math.random() * 3)] as any,
      });
    }

    setConfetti(newConfetti);

    const timeout = setTimeout(() => {
      setIsVisible(false);
      setConfetti([]);
    }, duration);

    return () => clearTimeout(timeout);
  }, [active, pieces, duration]);

  if (!isVisible || confetti.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          {piece.type === "square" && (
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: piece.color }}
            />
          )}
          {piece.type === "circle" && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: piece.color }}
            />
          )}
          {piece.type === "triangle" && (
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: `10px solid ${piece.color}`,
              }}
            />
          )}
        </div>
      ))}

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

// Success celebration component with confetti + message
interface SuccessCelebrationProps {
  show: boolean;
  title?: string;
  message?: string;
  onComplete?: () => void;
}

export function SuccessCelebration({ 
  show, 
  title = "🎉 Success!", 
  message = "Your app has been created",
  onComplete 
}: SuccessCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3500);
      return () => clearTimeout(timeout);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <>
      <Confetti active={show} pieces={150} duration={3500} />
      <div className="fixed inset-0 z-[99] flex items-center justify-center pointer-events-none">
        <div className="animate-in zoom-in-95 fade-in duration-300 text-center">
          <div className="text-6xl mb-4 animate-bounce">{title.includes("🎉") ? "🎉" : "✨"}</div>
          <h2 className="text-3xl font-bold text-white mb-2">{title.replace(/🎉|✨/g, "").trim() || "Success!"}</h2>
          <p className="text-lg text-muted-foreground">{message}</p>
        </div>
      </div>
    </>
  );
}
