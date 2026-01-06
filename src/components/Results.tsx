import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

interface ResultsProps {
  game: Doc<"games">;
  players: Doc<"players">[];
  me: Doc<"players">;
  isHost: boolean;
}

export default function Results({ game, players, me, isHost }: ResultsProps) {
  const results = useQuery(api.rounds.getRoundResults, { gameId: game._id });
  const votes = useQuery(api.rounds.getVotes, {
    gameId: game._id,
    round: game.currentRound,
  });
  const nextRound = useMutation(api.rounds.nextRound);

  const getPlayerName = (playerId: string) => {
    const player = players.find((p) => p._id === playerId);
    return player?.name || "Desconocido";
  };

  const handleNextRound = async () => {
    try {
      await nextRound({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (!results) {
    return (
      <div className="results">
        <p>Cargando resultados...</p>
      </div>
    );
  }

  return (
    <div className="results">
      <h1>Resultados</h1>
      <p className="round-number">Ronda {game.currentRound}</p>

      {/* Elimination result */}
      <div className="elimination-section">
        {results.isTie ? (
          <div className="result-card tie">
            <h2>Empate!</h2>
            <p>No hubo consenso. Nadie fue eliminado.</p>
          </div>
        ) : results.eliminatedPlayer ? (
          <div
            className={`result-card ${results.eliminatedPlayer.isImpostor ? "impostor-caught" : "innocent-eliminated"}`}
          >
            <h2>{results.eliminatedPlayer.name} fue eliminado!</h2>
            {results.eliminatedPlayer.isImpostor ? (
              <>
                <p className="reveal-role">Era un IMPOSTOR!</p>
                <p className="result-message">El grupo acerto!</p>
              </>
            ) : (
              <>
                <p className="reveal-role">Era INOCENTE!</p>
                <p className="result-message">Los impostores siguen entre nosotros...</p>
              </>
            )}
          </div>
        ) : (
          <div className="result-card">
            <p>No hubo eliminacion.</p>
          </div>
        )}
      </div>

      {/* Vote breakdown */}
      <div className="votes-section">
        <h2>Votos</h2>
        <div className="vote-breakdown">
          {Object.entries(results.voteCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([playerId, count]) => (
              <div key={playerId} className="vote-count-item">
                <span className="vote-target">{getPlayerName(playerId)}</span>
                <span className="vote-count">{count as number} voto{(count as number) !== 1 ? "s" : ""}</span>
              </div>
            ))}
        </div>

        {votes && (
          <details className="vote-details">
            <summary>Ver quien voto a quien</summary>
            <ul className="vote-list">
              {votes.map((vote) => (
                <li key={vote._id}>
                  {getPlayerName(vote.voterId)} → {getPlayerName(vote.targetId)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Secret word reveal */}
      <div className="word-reveal-section">
        <h2>La palabra secreta era:</h2>
        <p className="revealed-word">{results.secretWord}</p>
      </div>

      {/* Next round button */}
      {isHost && (
        <button className="btn btn-primary btn-large" onClick={handleNextRound}>
          Continuar
        </button>
      )}

      {!isHost && <p className="waiting-text">Esperando a que el host continue...</p>}
    </div>
  );
}
