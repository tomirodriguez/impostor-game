import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "../hooks/useSessionId";
import InstallPWAButton from "../components/InstallPWAButton";

export default function Home() {
  const navigate = useNavigate();
  const sessionId = useSessionId();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createGame = useMutation(api.games.create);
  const joinGame = useMutation(api.players.join);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Ingresa tu nombre");
      return;
    }
    if (!sessionId) return;

    setLoading(true);
    setError("");
    try {
      const result = await createGame({
        hostName: name.trim(),
        sessionId,
      });
      navigate(`/game/${result.code}`);
    } catch (err: any) {
      setError(err.message || "Error al crear partida");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) {
      setError("Ingresa tu nombre");
      return;
    }
    if (!joinCode.trim()) {
      setError("Ingresa el codigo de la partida");
      return;
    }
    if (!sessionId) return;

    setLoading(true);
    setError("");
    try {
      await joinGame({
        code: joinCode.trim().toLowerCase(),
        name: name.trim(),
        sessionId,
      });
      navigate(`/game/${joinCode.trim().toLowerCase()}`);
    } catch (err: any) {
      setError(err.message || "Error al unirse");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "menu") {
    return (
      <div className="home">
        <div className="home-content">
          <h1 className="title">El Impostor</h1>
          <p className="subtitle">Juego de deduccion social</p>

          <InstallPWAButton />

          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={() => setMode("create")}>
              Crear Partida
            </button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>
              Unirse a Partida
            </button>
            <button
              className="btn btn-offline"
              onClick={() => navigate("/local")}
            >
              Jugar Offline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-content">
        <button className="btn-back" onClick={() => setMode("menu")}>
          ← Volver
        </button>

        <h1 className="title">{mode === "create" ? "Crear Partida" : "Unirse a Partida"}</h1>

        <div className="form">
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (mode === "create") {
                  handleCreate();
                } else if (joinCode.trim()) {
                  handleJoin();
                }
              }
            }}
            className="input"
            maxLength={20}
            autoFocus
          />

          {mode === "join" && (
            <input
              type="text"
              placeholder="Codigo de partida"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJoin();
                }
              }}
              className="input"
              maxLength={6}
            />
          )}

          {error && <p className="error">{error}</p>}

          <button
            className="btn btn-primary"
            onClick={mode === "create" ? handleCreate : handleJoin}
            disabled={loading || !sessionId}
          >
            {loading ? "Cargando..." : mode === "create" ? "Crear" : "Unirse"}
          </button>
        </div>
      </div>
    </div>
  );
}
