import { useEffect, useState, useRef, useCallback } from "react";

interface TurnTimerProps {
  timeLimit: number; // segundos
  startedAt: number; // timestamp
  onTimeout: () => void;
  isMyTurn: boolean;
}

export default function TurnTimer({ timeLimit, startedAt, onTimeout, isMyTurn }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Mantener referencia actualizada de onTimeout
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const handleTimeout = useCallback(() => {
    if (!hasTimedOut) {
      setHasTimedOut(true);
      onTimeoutRef.current();
    }
  }, [hasTimedOut]);

  useEffect(() => {
    // Calcular tiempo restante basado en timestamp del servidor
    const calculateTimeLeft = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      return Math.ceil(remaining);
    };

    // Reset estado cuando cambia el turno
    setHasTimedOut(false);
    setTimeLeft(calculateTimeLeft());

    // Actualizar cada 100ms para mayor precision
    intervalRef.current = window.setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0 && isMyTurn) {
        handleTimeout();
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLimit, startedAt, isMyTurn, handleTimeout]);

  // Calcular porcentaje para el circulo
  const percentage = (timeLeft / timeLimit) * 100;

  // Determinar color segun tiempo restante
  let colorClass = "timer-green";
  if (timeLeft <= 3) {
    colorClass = "timer-red";
  } else if (timeLeft <= 5) {
    colorClass = "timer-yellow";
  }

  // Calcular stroke-dasharray para el circulo SVG
  const circumference = 2 * Math.PI * 45; // radio = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`turn-timer ${colorClass} ${timeLeft <= 3 ? "timer-pulse" : ""}`}>
      <svg className="timer-circle" viewBox="0 0 100 100">
        {/* Fondo del circulo */}
        <circle
          className="timer-bg"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
        />
        {/* Circulo de progreso */}
        <circle
          className="timer-progress"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="timer-text">
        <span className="timer-seconds">{timeLeft}</span>
        <span className="timer-label">seg</span>
      </div>
    </div>
  );
}
