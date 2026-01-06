import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "../hooks/useSessionId";
import Lobby from "../components/Lobby";
import WordReveal from "../components/WordReveal";
import ClueRound from "../components/ClueRound";
import Voting from "../components/Voting";
import Results from "../components/Results";
import Finished from "../components/Finished";

function JoinForm({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useSessionId();
  const joinGame = useMutation(api.players.join);

  const handleJoin = async () => {
    if (!name.trim()) {
      setError("Ingresa tu nombre");
      return;
    }
    if (!sessionId) return;

    setLoading(true);
    setError("");
    try {
      await joinGame({
        code: code.toLowerCase(),
        name: name.trim(),
        sessionId,
      });
      onJoined();
    } catch (err: any) {
      setError(err.message || "Error al unirse");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoin();
    }
  };

  return (
    <div className="home">
      <div className="home-content">
        <h1 className="title">Unirse a Partida</h1>
        <p className="subtitle">Codigo: {code.toUpperCase()}</p>

        <div className="form">
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input"
            maxLength={20}
            autoFocus
          />

          {error && <p className="error">{error}</p>}

          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={loading || !sessionId}
          >
            {loading ? "Cargando..." : "Unirse"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = useSessionId();
  const [joinKey, setJoinKey] = useState(0);

  const game = useQuery(api.games.getByCode, code ? { code } : "skip");
  const players = useQuery(
    api.players.getByGame,
    game ? { gameId: game._id } : "skip"
  );
  const me = useQuery(
    api.players.getMe,
    game && sessionId ? { gameId: game._id, sessionId } : "skip"
  );

  if (!sessionId) {
    return (
      <div className="loading">
        <p>Cargando...</p>
      </div>
    );
  }

  if (game === undefined || players === undefined) {
    return (
      <div className="loading">
        <p>Cargando partida...</p>
      </div>
    );
  }

  if (game === null) {
    return (
      <div className="error-page">
        <h2>Partida no encontrada</h2>
        <p>El codigo "{code}" no existe.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
    );
  }

  // Verificar si el usuario fue kickeado
  const kickedKey = `kicked-${code}`;
  const kickedList: string[] = JSON.parse(localStorage.getItem(kickedKey) || "[]");
  const wasKicked = kickedList.includes(sessionId);

  // Si el usuario no está en la partida, mostrar formulario para unirse
  if (!me) {
    // Mostrar mensaje si fue kickeado
    if (wasKicked) {
      const handleClearKicked = () => {
        const newList = kickedList.filter(id => id !== sessionId);
        if (newList.length > 0) {
          localStorage.setItem(kickedKey, JSON.stringify(newList));
        } else {
          localStorage.removeItem(kickedKey);
        }
        setJoinKey(k => k + 1);
      };

      return (
        <div className="error-page">
          <h2>Has sido expulsado</h2>
          <p>El host te ha removido de esta partida.</p>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={() => navigate("/")}>
              Volver al inicio
            </button>
            {game.status === "lobby" && (
              <button className="btn btn-secondary" onClick={handleClearKicked}>
                Intentar unirse de nuevo
              </button>
            )}
          </div>
        </div>
      );
    }

    // Solo permitir unirse si el juego está en lobby
    if (game.status !== "lobby") {
      return (
        <div className="error-page">
          <h2>Partida en curso</h2>
          <p>Esta partida ya ha comenzado y no puedes unirte.</p>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Volver al inicio
          </button>
        </div>
      );
    }

    return (
      <JoinForm 
        key={joinKey}
        code={code!} 
        onJoined={() => setJoinKey(k => k + 1)} 
      />
    );
  }

  const isHost = game.hostId === me._id;

  const renderGameContent = () => {
    switch (game.status) {
      case "lobby":
        return (
          <Lobby
            game={game}
            players={players}
            me={me}
            isHost={isHost}
          />
        );
      case "reveal":
        return (
          <WordReveal
            game={game}
            me={me}
            isHost={isHost}
          />
        );
      case "clues":
        return (
          <ClueRound
            game={game}
            players={players}
            me={me}
          />
        );
      case "voting":
        return (
          <Voting
            game={game}
            players={players}
            me={me}
          />
        );
      case "results":
        return (
          <Results
            game={game}
            players={players}
            me={me}
            isHost={isHost}
          />
        );
      case "finished":
        return (
          <Finished
            game={game}
            players={players}
            me={me}
            isHost={isHost}
          />
        );
      default:
        return <p>Estado desconocido</p>;
    }
  };

  return (
    <div className="game">
      {renderGameContent()}
    </div>
  );
}
