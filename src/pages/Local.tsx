import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalGame } from "../hooks/useLocalGame";
import type { LocalGameSettings } from "../hooks/useLocalGame";

export default function Local() {
  const navigate = useNavigate();
  const {
    game,
    categories,
    createGame,
    markRoleSeen,
    nextTurn,
    startVoting,
    submitAllVotes,
    getVoteResults,
    nextRound,
    resetGame,
  } = useLocalGame();

  // Setup state
  const [playerNames, setPlayerNames] = useState<string[]>(["", "", ""]);
  const [settings, setSettings] = useState<LocalGameSettings>({
    category: "animales",
    impostorCount: 1,
    maxRounds: 2,
    allowSkipVote: false,
    tieBreaker: "none",
  });
  const [error, setError] = useState("");

  // Reveal state
  const [showingRole, setShowingRole] = useState(false);

  // Voting state
  const [votes, setVotes] = useState<Record<string, string | null>>({});

  const handleAddPlayer = () => {
    if (playerNames.length < 10) {
      setPlayerNames([...playerNames, ""]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (playerNames.length > 3) {
      setPlayerNames(playerNames.filter((_, i) => i !== index));
    }
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleStartGame = () => {
    const validNames = playerNames.filter((n) => n.trim());
    if (validNames.length < 3) {
      setError("Se necesitan al menos 3 jugadores");
      return;
    }

    const uniqueNames = new Set(validNames.map((n) => n.toLowerCase().trim()));
    if (uniqueNames.size !== validNames.length) {
      setError("Los nombres deben ser unicos");
      return;
    }

    try {
      createGame(validNames, settings);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVoteChange = (voterId: string, targetId: string | null) => {
    setVotes({ ...votes, [voterId]: targetId });
  };

  const handleSubmitAllVotes = () => {
    if (!game) return;

    const activePlayers = game.players.filter((p) => !p.isEliminated);

    // Verificar que todos hayan votado
    const allVoted = activePlayers.every(
      (p) => votes[p.id] !== undefined
    );

    if (!allVoted) {
      setError("Todos los jugadores deben votar");
      return;
    }

    // Enviar todos los votos de una vez
    submitAllVotes(votes);
    setVotes({});
    setError("");
  };

  const handleExitGame = () => {
    if (confirm("¿Seguro que quieres salir? Se perdera el progreso.")) {
      resetGame();
      navigate("/");
    }
  };

  const handleNextRound = () => {
    nextRound();
    setVotes({});
    setShowingRole(false);
  };

  const handlePlayAgain = () => {
    resetGame();
    setPlayerNames(["", "", ""]);
    setVotes({});
    setShowingRole(false);
  };

  // ============ SETUP PHASE ============
  if (!game || game.phase === "setup") {
    return (
      <div className="local-game">
        <button className="btn-back" onClick={() => navigate("/")}>
          ← Volver
        </button>

        <h1>Partida Local</h1>
        <p className="subtitle">Juega sin internet, pasando el celular</p>

        <div className="local-settings">
          <div className="setting">
            <label>Categoria</label>
            <select
              value={settings.category}
              onChange={(e) => setSettings({ ...settings, category: e.target.value })}
              className="select"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="setting">
            <label>Impostores</label>
            <select
              value={settings.impostorCount}
              onChange={(e) =>
                setSettings({ ...settings, impostorCount: parseInt(e.target.value) })
              }
              className="select"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} impostor{n > 1 ? "es" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="setting">
            <label>Limite de rondas</label>
            <select
              value={settings.maxRounds || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSettings({ ...settings, maxRounds: val === 0 ? undefined : val });
              }}
              className="select"
            >
              <option value={0}>Sin limite</option>
              <option value={2}>2 rondas</option>
              <option value={3}>3 rondas</option>
              <option value={4}>4 rondas</option>
              <option value={5}>5 rondas</option>
            </select>
          </div>

          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={settings.allowSkipVote}
                onChange={(e) =>
                  setSettings({ ...settings, allowSkipVote: e.target.checked })
                }
              />
              <span>Permitir abstenerse</span>
            </label>
          </div>

          <div className="setting">
            <label>En caso de empate</label>
            <select
              value={settings.tieBreaker}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  tieBreaker: e.target.value as "none" | "all" | "random",
                })
              }
              className="select"
            >
              <option value="none">No eliminar a nadie</option>
              <option value="all">Eliminar a todos los empatados</option>
              <option value="random">Eliminar uno al azar</option>
            </select>
          </div>
        </div>

        <div className="local-players">
          <h2>Jugadores</h2>
          {playerNames.map((name, index) => (
            <div key={index} className="player-input-row">
              <input
                type="text"
                placeholder={`Jugador ${index + 1}`}
                value={name}
                onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                className="input"
                maxLength={20}
              />
              {playerNames.length > 3 && (
                <button
                  className="btn-remove"
                  onClick={() => handleRemovePlayer(index)}
                >
                  X
                </button>
              )}
            </div>
          ))}

          {playerNames.length < 10 && (
            <button className="btn btn-secondary" onClick={handleAddPlayer}>
              + Agregar jugador
            </button>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-large" onClick={handleStartGame}>
          Comenzar Partida
        </button>
      </div>
    );
  }

  // ============ REVEAL PHASE ============
  if (game.phase === "reveal") {
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const currentPlayer = activePlayers[game.currentRevealIndex];

    if (!currentPlayer) {
      return <div className="loading">Cargando...</div>;
    }

    if (!showingRole) {
      return (
        <div className="local-game local-reveal">
          <button className="btn-back" onClick={handleExitGame}>
            ← Salir
          </button>
          <h1>Pasale el celular a:</h1>
          <p className="reveal-name">{currentPlayer.name}</p>
          <p className="reveal-hint">(Los demas no deben mirar)</p>

          <button
            className="btn btn-reveal"
            onClick={() => setShowingRole(true)}
          >
            Estoy listo, ver mi rol
          </button>
        </div>
      );
    }

    return (
      <div className="local-game local-reveal">
        <h1>{currentPlayer.name}</h1>

        <div className="reveal-card">
          <div className="role-content">
            <span className={`role-badge ${currentPlayer.isImpostor ? "impostor" : "normal"}`}>
              {currentPlayer.isImpostor ? "IMPOSTOR" : "CIUDADANO"}
            </span>

            {currentPlayer.isImpostor ? (
              <p className="role-description">
                No conoces la palabra secreta. Descubrila escuchando las pistas!
              </p>
            ) : (
              <>
                <p className="secret-word-label">La palabra secreta es:</p>
                <p className="secret-word">{game.secretWord}</p>
              </>
            )}
          </div>
        </div>

        <button
          className="btn btn-primary btn-large"
          onClick={() => {
            markRoleSeen(currentPlayer.id);
            setShowingRole(false);
          }}
        >
          Entendido, pasar al siguiente
        </button>
      </div>
    );
  }

  // ============ CLUES PHASE ============
  if (game.phase === "clues") {
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const activeTurnOrder = game.turnOrder.filter((id) =>
      activePlayers.some((p) => p.id === id)
    );
    const currentPlayerId = activeTurnOrder[game.currentTurnIndex];
    const currentPlayer = activePlayers.find((p) => p.id === currentPlayerId);

    return (
      <div className="local-game local-clues">
        <button className="btn-back" onClick={handleExitGame}>
          ← Salir
        </button>
        <h1>Ronda de Pistas</h1>
        <p className="round-number">
          Ronda {game.currentRound}
          {game.settings.maxRounds ? ` de ${game.settings.maxRounds}` : ""}
        </p>

        <div className="turn-indicator">
          <p>Turno de:</p>
          <p className="current-player-name">{currentPlayer?.name}</p>
        </div>

        <p className="clue-instruction">
          {currentPlayer?.name}, da tu pista EN VOZ ALTA
        </p>

        <div className="turn-order-section">
          <h3>Orden de turnos</h3>
          <ol className="turn-order-list">
            {activeTurnOrder.map((playerId, index) => {
              const player = game.players.find((p) => p.id === playerId);
              const isDone = index < game.currentTurnIndex;
              const isCurrent = index === game.currentTurnIndex;
              return (
                <li
                  key={playerId}
                  className={`turn-order-item ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}
                >
                  {player?.name}
                  {isDone && " (hecho)"}
                  {isCurrent && " <-"}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="clue-actions">
          <button className="btn btn-primary" onClick={nextTurn}>
            Siguiente turno
          </button>

          <button className="btn btn-secondary" onClick={startVoting}>
            Ir a Votacion
          </button>
        </div>
      </div>
    );
  }

  // ============ VOTING PHASE ============
  if (game.phase === "voting") {
    const activePlayers = game.players.filter((p) => !p.isEliminated);

    return (
      <div className="local-game local-voting">
        <button className="btn-back" onClick={handleExitGame}>
          ← Salir
        </button>
        <h1>Votacion</h1>
        <p className="round-number">Ronda {game.currentRound}</p>

        <p className="voting-instruction">
          Pregunta a cada jugador a quien vota y marcalo:
        </p>

        <div className="voting-grid">
          {activePlayers.map((voter) => (
            <div key={voter.id} className="voter-section">
              <h3>{voter.name} vota a:</h3>
              <div className="vote-options-local">
                {activePlayers
                  .filter((p) => p.id !== voter.id)
                  .map((target) => (
                    <label key={target.id} className="vote-radio">
                      <input
                        type="radio"
                        name={`vote-${voter.id}`}
                        checked={votes[voter.id] === target.id}
                        onChange={() => handleVoteChange(voter.id, target.id)}
                      />
                      <span>{target.name}</span>
                    </label>
                  ))}
                {game.settings.allowSkipVote && (
                  <label className="vote-radio vote-skip">
                    <input
                      type="radio"
                      name={`vote-${voter.id}`}
                      checked={votes[voter.id] === null}
                      onChange={() => handleVoteChange(voter.id, null)}
                    />
                    <span>No votar</span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-large" onClick={handleSubmitAllVotes}>
          Ver Resultados
        </button>
      </div>
    );
  }

  // ============ RESULTS PHASE ============
  if (game.phase === "results") {
    const results = getVoteResults();
    if (!results) return null;

    const eliminatedPlayers = results.eliminatedIds
      .map((id) => game.players.find((p) => p.id === id))
      .filter(Boolean);

    const allImpostors = eliminatedPlayers.every((p) => p?.isImpostor);

    return (
      <div className="local-game local-results">
        <button className="btn-back" onClick={handleExitGame}>
          ← Salir
        </button>
        <h1>Resultados</h1>
        <p className="round-number">Ronda {game.currentRound}</p>

        <div className="elimination-section">
          {results.wasSkipped ? (
            <div className="result-card tie">
              <h2>Sin eliminacion!</h2>
              <p>La mayoria se abstuvo de votar.</p>
            </div>
          ) : results.isTie && eliminatedPlayers.length === 0 ? (
            <div className="result-card tie">
              <h2>Empate!</h2>
              <p>Nadie fue eliminado.</p>
            </div>
          ) : eliminatedPlayers.length > 0 ? (
            <div className={`result-card ${allImpostors ? "impostor-caught" : "innocent-eliminated"}`}>
              <h2>
                {eliminatedPlayers.map((p) => p?.name).join(" y ")}{" "}
                {eliminatedPlayers.length > 1 ? "fueron eliminados!" : "fue eliminado!"}
              </h2>
              <p className="reveal-role">
                {eliminatedPlayers.length > 1
                  ? allImpostors
                    ? "Todos eran IMPOSTORES!"
                    : "Algunos eran inocentes..."
                  : eliminatedPlayers[0]?.isImpostor
                  ? "Era un IMPOSTOR!"
                  : "Era INOCENTE!"}
              </p>
            </div>
          ) : (
            <div className="result-card">
              <p>Nadie fue eliminado.</p>
            </div>
          )}
        </div>

        <div className="votes-section">
          <h2>Votos</h2>
          <div className="vote-breakdown">
            {Object.entries(results.voteCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, count]) => {
                const player = game.players.find((p) => p.id === playerId);
                return (
                  <div key={playerId} className="vote-count-item">
                    <span className="vote-target">{player?.name}</span>
                    <span className="vote-count">{count} voto{count !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            {results.skipVotes > 0 && (
              <div className="vote-count-item">
                <span className="vote-target">Abstenciones</span>
                <span className="vote-count">{results.skipVotes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="word-reveal-section">
          <h2>La palabra secreta era:</h2>
          <p className="revealed-word">{game.secretWord}</p>
        </div>

        <button className="btn btn-primary btn-large" onClick={handleNextRound}>
          Continuar
        </button>
      </div>
    );
  }

  // ============ FINISHED PHASE ============
  if (game.phase === "finished") {
    const remainingImpostors = game.players.filter(
      (p) => p.isImpostor && !p.isEliminated
    );
    const impostorsWon = remainingImpostors.length > 0;

    return (
      <div className="local-game local-finished">
        <h1>Fin del Juego</h1>

        <div className={`winner-section ${impostorsWon ? "impostors-won" : "crew-won"}`}>
          <h2>{impostorsWon ? "Los Impostores Ganan!" : "Los Ciudadanos Ganan!"}</h2>
          <p>
            {impostorsWon
              ? "Los impostores lograron sobrevivir."
              : "Todos los impostores fueron eliminados."}
          </p>
        </div>

        <div className="impostors-reveal">
          <h3>Los impostores eran:</h3>
          <ul className="impostors-list">
            {game.players
              .filter((p) => p.isImpostor)
              .map((p) => (
                <li key={p.id} className={p.isEliminated ? "caught" : "survived"}>
                  {p.name} {p.isEliminated ? "(eliminado)" : "(sobrevivio)"}
                </li>
              ))}
          </ul>
        </div>

        <div className="word-reveal-section">
          <h2>La palabra secreta era:</h2>
          <p className="revealed-word">{game.secretWord}</p>
        </div>

        <div className="finished-actions">
          <button className="btn btn-primary btn-large" onClick={handlePlayAgain}>
            Jugar de Nuevo
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>
            Volver al Menu
          </button>
        </div>
      </div>
    );
  }

  return null;
}
