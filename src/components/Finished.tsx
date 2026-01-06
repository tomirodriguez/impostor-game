import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

interface FinishedProps {
  game: Doc<"games">;
  players: Doc<"players">[];
  me: Doc<"players">;
  isHost: boolean;
}

export default function Finished({ game, players, me, isHost }: FinishedProps) {
  const playAgain = useMutation(api.rounds.playAgain);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const impostors = players.filter((p) => p.isImpostor);
  const survivingImpostors = impostors.filter((p) => !p.isEliminated);
  const impostorsWon = survivingImpostors.length > 0;

  const handlePlayAgain = async () => {
    try {
      await playAgain({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="finished">
      <h1>Fin del Juego!</h1>

      {/* Winner announcement */}
      <div className={`winner-section ${impostorsWon ? "impostors-won" : "crew-won"}`}>
        {game.allImpostors ? (
          <>
            <h2>Todos eran impostores!</h2>
            <p>Nadie conocia la palabra secreta. Caos total!</p>
          </>
        ) : impostorsWon ? (
          <>
            <h2>Los Impostores Ganan!</h2>
            <p>
              {survivingImpostors.map((p) => p.name).join(", ")}{" "}
              {survivingImpostors.length === 1 ? "logro" : "lograron"} engañar al grupo.
            </p>
          </>
        ) : (
          <>
            <h2>El Grupo Gana!</h2>
            <p>Todos los impostores fueron descubiertos.</p>
          </>
        )}
      </div>

      {/* Reveal impostors */}
      {!game.allImpostors && (
        <div className="impostors-reveal">
          <h3>Los impostores eran:</h3>
          <ul className="impostors-list">
            {impostors.map((p) => (
              <li key={p._id} className={p.isEliminated ? "caught" : "survived"}>
                {p.name} {p.isEliminated ? "(eliminado)" : "(sobrevivio)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scoreboard */}
      <div className="scoreboard">
        <h2>Puntuaciones</h2>
        <ol className="score-list">
          {sortedPlayers.map((player, index) => (
            <li key={player._id} className="score-item">
              <span className="score-rank">#{index + 1}</span>
              <span className="score-name">
                {player.name}
                {player._id === me._id && " (Tu)"}
                {player.isImpostor && !game.allImpostors && " (Impostor)"}
              </span>
              <span className="score-points">{player.score} pts</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="finished-actions">
        {isHost ? (
          <button className="btn btn-primary btn-large" onClick={handlePlayAgain}>
            Jugar de Nuevo
          </button>
        ) : (
          <p className="waiting-text">Esperando a que el host inicie otra partida...</p>
        )}

        <button
          className="btn btn-secondary"
          onClick={() => (window.location.href = "/")}
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
