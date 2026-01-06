import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

interface WordRevealProps {
  game: Doc<"games">;
  me: Doc<"players">;
  isHost: boolean;
}

export default function WordReveal({ game, me, isHost }: WordRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");

  const role = useQuery(api.players.getMyRole, {
    gameId: game._id,
    sessionId: me.sessionId,
  });

  const readyForClues = useMutation(api.rounds.readyForClues);

  const handleReady = async () => {
    setError("");
    try {
      await readyForClues({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!role) {
    return (
      <div className="word-reveal">
        <p>Cargando tu rol...</p>
      </div>
    );
  }

  return (
    <div className="word-reveal">
      <h1>Ronda {game.currentRound}</h1>

      <div className="reveal-card">
        {!revealed ? (
          <button className="btn btn-reveal" onClick={() => setRevealed(true)}>
            Toca para ver tu rol
          </button>
        ) : (
          <div className="role-content">
            {role.isImpostor ? (
              <>
                <div className="role-badge impostor">IMPOSTOR</div>
                <p className="role-description">
                  No conoces la palabra secreta. Escucha las pistas de los demas e intenta
                  pasar desapercibido.
                </p>
              </>
            ) : (
              <>
                <div className="role-badge normal">JUGADOR</div>
                <p className="secret-word-label">Tu palabra secreta es:</p>
                <p className="secret-word">{role.secretWord}</p>
                <p className="role-description">
                  Da pistas sutiles para demostrar que conoces la palabra, pero no seas
                  demasiado obvio.
                </p>
              </>
            )}
            <button className="btn btn-hide" onClick={() => setRevealed(false)}>
              Ocultar
            </button>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {isHost && (
        <div className="host-actions">
          <p className="info-text">
            Asegurate de que todos hayan visto su rol antes de continuar.
          </p>
          <button className="btn btn-primary btn-large" onClick={handleReady}>
            Comenzar Ronda de Pistas
          </button>
        </div>
      )}

      {!isHost && (
        <p className="waiting-text">Esperando a que el host inicie la ronda de pistas...</p>
      )}
    </div>
  );
}
