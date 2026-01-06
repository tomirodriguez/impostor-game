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

  const getPlayerName = (playerId: string | undefined) => {
    if (!playerId) return "Abstencion";
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

  const eliminatedPlayers = results.eliminatedPlayers.filter(Boolean);
  const hasEliminated = eliminatedPlayers.length > 0;
  const multipleEliminated = eliminatedPlayers.length > 1;

  // Determinar si los eliminados son impostores
  const allImpostors = eliminatedPlayers.every((p) => p?.isImpostor);
  const allInnocents = eliminatedPlayers.every((p) => !p?.isImpostor);

  return (
    <div className="results">
      <h1>Resultados</h1>
      <p className="round-number">
        Ronda {results.currentRound}
        {results.maxRounds ? ` de ${results.maxRounds}` : ""}
      </p>

      {/* Elimination result */}
      <div className="elimination-section">
        {results.wasSkipped ? (
          <div className="result-card tie">
            <h2>Sin eliminacion!</h2>
            <p>La mayoria se abstuvo de votar. Nadie fue eliminado.</p>
          </div>
        ) : results.isTie && !hasEliminated ? (
          <div className="result-card tie">
            <h2>Empate!</h2>
            <p>
              {results.tieBreaker === "none"
                ? "No hubo consenso. Nadie fue eliminado."
                : "Hubo empate en la votacion."}
            </p>
          </div>
        ) : hasEliminated ? (
          <div
            className={`result-card ${allImpostors ? "impostor-caught" : "innocent-eliminated"}`}
          >
            <h2>
              {multipleEliminated
                ? `${eliminatedPlayers.map((p) => p?.name).join(" y ")} fueron eliminados!`
                : `${eliminatedPlayers[0]?.name} fue eliminado!`}
            </h2>
            {multipleEliminated ? (
              <>
                {allImpostors ? (
                  <>
                    <p className="reveal-role">Todos eran IMPOSTORES!</p>
                    <p className="result-message">El grupo acerto!</p>
                  </>
                ) : allInnocents ? (
                  <>
                    <p className="reveal-role">Todos eran INOCENTES!</p>
                    <p className="result-message">Los impostores siguen entre nosotros...</p>
                  </>
                ) : (
                  <>
                    <p className="reveal-role">Habia de todo...</p>
                    <p className="result-message">Algunos impostores cayeron, pero tambien inocentes.</p>
                  </>
                )}
              </>
            ) : eliminatedPlayers[0]?.isImpostor ? (
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

            {results.isTie && results.tieBreaker === "random" && (
              <p className="tie-info">
                (Seleccionado al azar por empate)
              </p>
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
                <span className="vote-count">
                  {count as number} voto{(count as number) !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          {results.skipVotes > 0 && (
            <div className="vote-count-item vote-skip-result">
              <span className="vote-target">Abstenciones</span>
              <span className="vote-count">{results.skipVotes}</span>
            </div>
          )}
        </div>

        {votes && votes.length > 0 && (
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
