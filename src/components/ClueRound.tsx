import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import TurnTimer from "./TurnTimer";

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

  const requiredLetter = useQuery(api.rounds.getRequiredLetter, {
    gameId: game._id,
  });

  const submitClue = useMutation(api.rounds.submitClue);
  const markTurnDone = useMutation(api.rounds.markTurnDone);
  const startVoting = useMutation(api.rounds.startVoting);
  const timeoutTurn = useMutation(api.rounds.timeoutTurn);

  const activePlayers = players.filter((p) => !p.isEliminated);
  const isMyTurn = currentTurnPlayer?._id === me._id;
  const hasGivenClue = clues?.some((c) => c.playerId === me._id);
  const isHost = game.hostId === me._id;
  const requireClueText = game.requireClueText ?? false;
  const hasTimer = game.turnTimeLimit && game.turnStartedAt;
  const chainedClues = game.chainedClues ?? false;

  const handleSubmit = async () => {
    if (requireClueText && !clue.trim()) {
      setError("Escribe una pista");
      return;
    }

    // Validar pista encadenada en frontend
    if (chainedClues && requiredLetter && clue.trim()) {
      const firstChar = clue.trim().charAt(0).toUpperCase();
      const required = requiredLetter.toUpperCase();
      // Normalizar acentos
      const normalize = (c: string) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalize(firstChar) !== normalize(required)) {
        setError(`La pista debe empezar con "${requiredLetter}"`);
        return;
      }
    }

    setSubmitting(true);
    setError("");
    try {
      await submitClue({
        gameId: game._id,
        playerId: me._id,
        clue: clue.trim() || "ok",
      });
      setClue("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDone = async () => {
    setSubmitting(true);
    setError("");
    try {
      await markTurnDone({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartVoting = async () => {
    setError("");
    try {
      await startVoting({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTimeout = async () => {
    try {
      await timeoutTurn({
        gameId: game._id,
      });
    } catch (err: any) {
      // Ignorar errores de timeout (puede que ya se haya dado la pista)
      console.log("Timeout error:", err.message);
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find((p) => p._id === playerId);
    return player?.name || "Desconocido";
  };

  const showCategory = game.showCategory ?? false;

  return (
    <div className="clue-round">
      <h1>Ronda de Pistas</h1>
      <p className="round-number">
        Ronda {game.currentRound}
        {game.maxRounds ? ` de ${game.maxRounds}` : ""}
      </p>

      {showCategory && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <span className="category-hint">
            Categoria: <strong>{game.category}</strong>
          </span>
        </div>
      )}

      {/* Timer */}
      {hasTimer && currentTurnPlayer && (
        <div className="timer-container">
          <TurnTimer
            timeLimit={game.turnTimeLimit!}
            startedAt={game.turnStartedAt!}
            onTimeout={handleTimeout}
            isMyTurn={isMyTurn}
          />
        </div>
      )}

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

      {/* Indicador de pista encadenada */}
      {chainedClues && requiredLetter && isMyTurn && !hasGivenClue && (
        <div className="chained-clue-hint">
          <p>Tu pista debe empezar con: <strong className="required-letter">{requiredLetter}</strong></p>
        </div>
      )}

      {/* Clues given so far - solo si se requiere texto */}
      {requireClueText && (
        <div className="clues-section">
          <h2>
            Pistas ({clues?.length || 0}/{activePlayers.length})
          </h2>
          {clues && clues.length > 0 ? (
            <ul className="clues-list">
              {clues
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <li key={c._id} className="clue-item">
                    <span className="clue-player">{getPlayerName(c.playerId)}:</span>
                    <span className={`clue-text ${c.clue === "Tiempo agotado" ? "timeout-clue" : ""}`}>
                      {c.clue}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="no-clues">Todavia no hay pistas</p>
          )}
        </div>
      )}

      {/* Input for submitting clue - solo si se requiere texto */}
      {requireClueText && isMyTurn && !hasGivenClue && !me.isEliminated && (
        <div className="clue-input-section">
          <input
            type="text"
            placeholder={
              chainedClues && requiredLetter
                ? `Escribe una pista que empiece con "${requiredLetter}"`
                : "Escribe tu pista (una palabra)"
            }
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

      {/* Boton para marcar turno como hecho - solo si NO se requiere texto */}
      {!requireClueText && isMyTurn && !hasGivenClue && !me.isEliminated && (
        <div className="clue-input-section">
          <p className="info-text">Da tu pista en voz alta y marca que terminaste</p>
          {chainedClues && requiredLetter && (
            <p className="chained-hint-small">
              (Tu pista debe empezar con "{requiredLetter}")
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button
            className="btn btn-primary"
            onClick={handleMarkDone}
            disabled={submitting}
          >
            {submitting ? "Marcando..." : "Listo"}
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
                  {hasGiven && " done"}
                  {isCurrent && " <-"}
                  {playerId === me._id && " (Tu)"}
                </li>
              );
            })}
        </ol>
      </div>

      {/* Boton para iniciar votacion - solo host y solo si no se requiere texto */}
      {!requireClueText && isHost && (
        <div className="host-actions">
          <button className="btn btn-primary btn-large" onClick={handleStartVoting}>
            Iniciar Votacion
          </button>
          <p className="setting-hint">Inicia la votacion cuando todos hayan dado su pista</p>
        </div>
      )}

      {error && !isMyTurn && <p className="error">{error}</p>}
    </div>
  );
}
