import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

interface VotingProps {
  game: Doc<"games">;
  players: Doc<"players">[];
  me: Doc<"players">;
}

export default function Voting({ game, players, me }: VotingProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Id<"players"> | "skip" | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const clues = useQuery(api.rounds.getClues, {
    gameId: game._id,
    round: game.currentRound,
  });

  const votes = useQuery(api.rounds.getVotes, {
    gameId: game._id,
    round: game.currentRound,
  });

  const voteCount = useQuery(api.rounds.getVoteCount, {
    gameId: game._id,
  });

  const submitVote = useMutation(api.rounds.submitVote);

  const activePlayers = players.filter((p) => !p.isEliminated);
  const votablePlayers = activePlayers.filter((p) => p._id !== me._id);

  const isSecretVoting = game.secretVoting ?? false;
  const allowSkipVote = game.allowSkipVote ?? false;

  const getClueByPlayer = (playerId: string) => {
    return clues?.find((c) => c.playerId === playerId)?.clue || "-";
  };

  // Contar votos por jugador (para votación pública)
  const getVoteCountForPlayer = (playerId: string) => {
    if (isSecretVoting || !votes) return 0;
    return votes.filter((v) => v.targetId === playerId).length;
  };

  const getSkipVoteCount = () => {
    if (isSecretVoting || !votes) return 0;
    return votes.filter((v) => !v.targetId).length;
  };

  // Obtener quienes votaron por un jugador (para votación pública)
  const getVotersForPlayer = (playerId: string | null) => {
    if (isSecretVoting || !votes) return [];
    const targetVotes = votes.filter((v) =>
      playerId === null ? !v.targetId : v.targetId === playerId
    );
    return targetVotes.map((v) => {
      const voter = players.find((p) => p._id === v.voterId);
      return voter?.name || "?";
    });
  };

  const handleVote = async () => {
    if (!selectedPlayer) {
      setError("Selecciona a quien votar");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitVote({
        gameId: game._id,
        voterId: me._id,
        targetId: selectedPlayer === "skip" ? undefined : selectedPlayer,
      });
      setHasVoted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (me.isEliminated) {
    return (
      <div className="voting">
        <h1>Votacion</h1>
        <p className="eliminated-text">Fuiste eliminado. Solo puedes observar.</p>

        <div className="clues-summary">
          <h2>Resumen de pistas</h2>
          <ul className="clues-list">
            {activePlayers.map((player) => (
              <li key={player._id} className="clue-item">
                <span className="clue-player">{player.name}:</span>
                <span className="clue-text">{getClueByPlayer(player._id)}</span>
              </li>
            ))}
          </ul>
        </div>

        {isSecretVoting ? (
          <p className="waiting-text">
            Votacion secreta: {voteCount?.count || 0} de {voteCount?.total || 0} han votado
          </p>
        ) : (
          <p className="waiting-text">Esperando a que todos voten...</p>
        )}
      </div>
    );
  }

  return (
    <div className="voting">
      <h1>Votacion</h1>
      <p className="round-number">Ronda {game.currentRound}{game.maxRounds ? ` de ${game.maxRounds}` : ""}</p>

      <div className="clues-summary">
        <h2>Resumen de pistas</h2>
        <ul className="clues-list">
          {activePlayers.map((player) => (
            <li key={player._id} className="clue-item">
              <span className="clue-player">
                {player.name}
                {player._id === me._id && " (Tu)"}:
              </span>
              <span className="clue-text">{getClueByPlayer(player._id)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Contador de votos para votación secreta */}
      {isSecretVoting && (
        <div className="vote-counter">
          <p>{voteCount?.count || 0} de {voteCount?.total || 0} han votado</p>
        </div>
      )}

      {!hasVoted ? (
        <>
          <div className="vote-section">
            <h2>Quien crees que es el impostor?</h2>
            <div className="vote-options">
              {votablePlayers.map((player) => {
                const playerVotes = getVoteCountForPlayer(player._id);
                const voters = getVotersForPlayer(player._id);
                return (
                  <button
                    key={player._id}
                    className={`vote-option ${selectedPlayer === player._id ? "selected" : ""}`}
                    onClick={() => setSelectedPlayer(player._id)}
                  >
                    <span className="vote-name">{player.name}</span>
                    <span className="vote-clue">"{getClueByPlayer(player._id)}"</span>
                    {!isSecretVoting && playerVotes > 0 && (
                      <span className="vote-count-badge">
                        {playerVotes} voto{playerVotes > 1 ? "s" : ""}: {voters.join(", ")}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Opcion Abstenerse */}
              {allowSkipVote && (
                <button
                  className={`vote-option vote-skip ${selectedPlayer === "skip" ? "selected" : ""}`}
                  onClick={() => setSelectedPlayer("skip")}
                >
                  <span className="vote-name">No votar</span>
                  <span className="vote-clue">Abstenerse esta ronda</span>
                  {!isSecretVoting && getSkipVoteCount() > 0 && (
                    <span className="vote-count-badge">
                      {getSkipVoteCount()} voto{getSkipVoteCount() > 1 ? "s" : ""}: {getVotersForPlayer(null).join(", ")}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            className="btn btn-primary btn-large"
            onClick={handleVote}
            disabled={!selectedPlayer || submitting}
          >
            {submitting ? "Votando..." : "Confirmar Voto"}
          </button>
        </>
      ) : (
        <div className="voted-message">
          <p className="success-text">Tu voto ha sido registrado!</p>
          {isSecretVoting ? (
            <p className="waiting-text">
              Esperando a los demas... ({voteCount?.count || 0}/{voteCount?.total || 0})
            </p>
          ) : (
            <p className="waiting-text">Esperando a que todos voten...</p>
          )}
        </div>
      )}
    </div>
  );
}
