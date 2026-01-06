import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { categories } from "../../convex/words";
import AdvancedSettings from "./AdvancedSettings";

interface LobbyProps {
  game: Doc<"games">;
  players: Doc<"players">[];
  me: Doc<"players">;
  isHost: boolean;
}

export default function Lobby({ game, players, me, isHost }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [advancedError, setAdvancedError] = useState("");

  const updateSettings = useMutation(api.games.updateSettings);
  const startGame = useMutation(api.rounds.startGame);
  const leaveGame = useMutation(api.players.leave);
  const kickPlayer = useMutation(api.players.kick);

  const shareUrl = `${window.location.origin}/game/${game.code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "El Impostor",
          text: "Unete a mi partida!",
          url: shareUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleUpdateCategory = async (category: string) => {
    try {
      await updateSettings({
        gameId: game._id,
        playerId: me._id,
        category,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateImpostorCount = async (count: number) => {
    try {
      await updateSettings({
        gameId: game._id,
        playerId: me._id,
        impostorCount: count,
        allImpostors: false,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStart = async () => {
    setError("");
    try {
      await startGame({
        gameId: game._id,
        playerId: me._id,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGame({
        gameId: game._id,
        sessionId: me.sessionId,
      });
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleKick = async (targetPlayerId: typeof me._id) => {
    try {
      const result = await kickPlayer({
        gameId: game._id,
        hostPlayerId: me._id,
        targetPlayerId,
      });
      // Guardar en localStorage para mostrar mensaje al kickeado
      if (result?.kickedSessionId) {
        const kickedKey = `kicked-${game.code}`;
        const kickedList = JSON.parse(localStorage.getItem(kickedKey) || "[]");
        kickedList.push(result.kickedSessionId);
        localStorage.setItem(kickedKey, JSON.stringify(kickedList));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdvancedUpdate = async (settings: Record<string, any>) => {
    setAdvancedError("");
    try {
      await updateSettings({
        gameId: game._id,
        playerId: me._id,
        ...settings,
      });
    } catch (err: any) {
      setAdvancedError(err.message);
    }
  };

  const maxImpostors = Math.max(1, players.length - 1);

  return (
    <div className="lobby">
      <div className="lobby-header">
        <h1>Sala de Espera</h1>
        <div className="game-code">
          <span className="code-label">Codigo:</span>
          <span className="code-value">{game.code.toUpperCase()}</span>
        </div>
      </div>

      <div className="share-section">
        <button className="btn btn-share" onClick={handleShare}>
          {copied ? "Copiado!" : "Compartir Link"}
        </button>
      </div>

      <div className="players-section">
        <h2>Jugadores ({players.length}/20)</h2>
        <ul className="players-list">
          {players
            .sort((a, b) => a.joinedAt - b.joinedAt)
            .map((player) => (
              <li key={player._id} className="player-item">
                <span className="player-name">
                  {player.name}
                  {player._id === game.hostId && " (Host)"}
                  {player._id === me._id && " (Tu)"}
                </span>
                <div className="player-actions">
                  {player.score > 0 && (
                    <span className="player-score">{player.score} pts</span>
                  )}
                  {isHost && player._id !== me._id && (
                    <button
                      className="btn-kick"
                      onClick={() => handleKick(player._id)}
                      title="Expulsar jugador"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </div>

      {isHost && (
        <div className="settings-section">
          <h2>Configuracion</h2>

          {/* Configuracion Basica */}
          <div className="setting">
            <label>Categoria</label>
            <select
              value={game.category}
              onChange={(e) => handleUpdateCategory(e.target.value)}
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
            <div className="impostor-controls">
              <select
                value={game.impostorCount}
                onChange={(e) => handleUpdateImpostorCount(parseInt(e.target.value))}
                className="select"
                disabled={game.allImpostors}
              >
                {Array.from({ length: maxImpostors }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} impostor{n > 1 ? "es" : ""}
                  </option>
                ))}
              </select>
              {game.allImpostors && (
                <span className="setting-hint">Modo "todos impostores" activo</span>
              )}
            </div>
          </div>

          <div className="setting">
            <label>Limite de rondas</label>
            <select
              value={game.maxRounds ?? 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                handleAdvancedUpdate({ maxRounds: val });
              }}
              className="select"
            >
              <option value={2}>2 rondas</option>
              <option value={3}>3 rondas</option>
              <option value={4}>4 rondas</option>
              <option value={5}>5 rondas</option>
              <option value={0}>Sin limite</option>
            </select>
            <p className="setting-hint">
              {game.maxRounds
                ? `Si el impostor sobrevive ${game.maxRounds} rondas, gana`
                : "El juego continua hasta que el impostor sea eliminado"}
            </p>
          </div>

          {/* Configuracion Avanzada */}
          <AdvancedSettings
            game={game}
            onUpdate={handleAdvancedUpdate}
            error={advancedError}
          />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="lobby-actions">
        {isHost ? (
          <button
            className="btn btn-primary btn-large"
            onClick={handleStart}
            disabled={players.length < 3}
          >
            {players.length < 3
              ? `Esperando jugadores (${players.length}/3)`
              : "Iniciar Partida"}
          </button>
        ) : (
          <p className="waiting-text">Esperando a que el host inicie la partida...</p>
        )}

        <button className="btn btn-danger" onClick={handleLeave}>
          {isHost ? "Cerrar Sala" : "Abandonar"}
        </button>
      </div>
    </div>
  );
}
