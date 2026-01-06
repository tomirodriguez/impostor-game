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
  const [selectedPlayer, setSelectedPlayer] = useState<Id<"players"> | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const clues = useQuery(api.rounds.getClues, {
    gameId: game._id,
    round: game.currentRound,
  });

  const submitVote = useMutation(api.rounds.submitVote);

  const activePlayers = players.filter((p) => !p.isEliminated);
  const votablePlayers = activePlayers.filter((p) => p._id !== me._id);

  const getClueByPlayer = (playerId: string) => {
    return clues?.find((c) => c.playerId === playerId)?.clue || "-";
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
        targetId: selectedPlayer,
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

        <p className="waiting-text">Esperando a que todos voten...</p>
      </div>
    );
  }

  return (
    <div className="voting">
      <h1>Votacion</h1>
      <p className="round-number">Ronda {game.currentRound}</p>

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

      {!hasVoted ? (
        <>
          <div className="vote-section">
            <h2>Quien crees que es el impostor?</h2>
            <div className="vote-options">
              {votablePlayers.map((player) => (
                <button
                  key={player._id}
                  className={`vote-option ${selectedPlayer === player._id ? "selected" : ""}`}
                  onClick={() => setSelectedPlayer(player._id)}
                >
                  <span className="vote-name">{player.name}</span>
                  <span className="vote-clue">"{getClueByPlayer(player._id)}"</span>
                </button>
              ))}
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
          <p className="waiting-text">Esperando a que todos voten...</p>
        </div>
      )}
    </div>
  );
}
