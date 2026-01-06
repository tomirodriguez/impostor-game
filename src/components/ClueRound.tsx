import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

interface ClueRoundProps {
  game: Doc<"games">;
  players: Doc<"players">[];
  me: Doc<"players">;
}

export default function ClueRound({ game, players, me }: ClueRoundProps) {
  const [clue, setClue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clues = useQuery(api.rounds.getClues, {
    gameId: game._id,
    round: game.currentRound,
  });

  const currentTurnPlayer = useQuery(api.rounds.getCurrentTurnPlayer, {
    gameId: game._id,
  });

  const submitClue = useMutation(api.rounds.submitClue);

  const activePlayers = players.filter((p) => !p.isEliminated);
  const isMyTurn = currentTurnPlayer?._id === me._id;
  const hasGivenClue = clues?.some((c) => c.playerId === me._id);

  const handleSubmit = async () => {
    if (!clue.trim()) {
      setError("Escribe una pista");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitClue({
        gameId: game._id,
        playerId: me._id,
        clue: clue.trim(),
      });
      setClue("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find((p) => p._id === playerId);
    return player?.name || "Desconocido";
  };

  return (
    <div className="clue-round">
      <h1>Ronda de Pistas</h1>
      <p className="round-number">Ronda {game.currentRound}</p>

      {/* Current turn indicator */}
      <div className="turn-indicator">
        {currentTurnPlayer ? (
          isMyTurn ? (
            <span className="your-turn">Es tu turno!</span>
          ) : (
            <span>Turno de: {currentTurnPlayer.name}</span>
          )
        ) : (
          <span>Todos han dado su pista</span>
        )}
      </div>

      {/* Clues given so far */}
      <div className="clues-section">
        <h2>Pistas ({clues?.length || 0}/{activePlayers.length})</h2>
        {clues && clues.length > 0 ? (
          <ul className="clues-list">
            {clues
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <li key={c._id} className="clue-item">
                  <span className="clue-player">{getPlayerName(c.playerId)}:</span>
                  <span className="clue-text">{c.clue}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="no-clues">Todavia no hay pistas</p>
        )}
      </div>

      {/* Input for submitting clue */}
      {isMyTurn && !hasGivenClue && !me.isEliminated && (
        <div className="clue-input-section">
          <input
            type="text"
            placeholder="Escribe tu pista (una palabra)"
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            className="input"
            maxLength={30}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
          {error && <p className="error">{error}</p>}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Enviando..." : "Dar Pista"}
          </button>
        </div>
      )}

      {hasGivenClue && (
        <p className="info-text">Ya diste tu pista. Esperando a los demas...</p>
      )}

      {!isMyTurn && !hasGivenClue && !me.isEliminated && (
        <p className="waiting-text">Espera tu turno...</p>
      )}

      {me.isEliminated && (
        <p className="eliminated-text">Fuiste eliminado. Solo puedes observar.</p>
      )}

      {/* Turn order */}
      <div className="turn-order-section">
        <h3>Orden de turnos</h3>
        <ol className="turn-order-list">
          {game.turnOrder
            ?.filter((id) => activePlayers.some((p) => p._id === id))
            .map((playerId) => {
              const player = players.find((p) => p._id === playerId);
              const hasGiven = clues?.some((c) => c.playerId === playerId);
              const isCurrent = currentTurnPlayer?._id === playerId;
              return (
                <li
                  key={playerId}
                  className={`turn-order-item ${hasGiven ? "done" : ""} ${isCurrent ? "current" : ""}`}
                >
                  {player?.name || "?"}
                  {hasGiven && " ✓"}
                  {isCurrent && " ←"}
                  {playerId === me._id && " (Tu)"}
                </li>
              );
            })}
        </ol>
      </div>
    </div>
  );
}
