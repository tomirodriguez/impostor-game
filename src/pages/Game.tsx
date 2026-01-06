import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSessionId } from "../hooks/useSessionId";
import Lobby from "../components/Lobby";
import WordReveal from "../components/WordReveal";
import ClueRound from "../components/ClueRound";
import Voting from "../components/Voting";
import Results from "../components/Results";
import Finished from "../components/Finished";

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = useSessionId();

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

  if (!me) {
    return (
      <div className="error-page">
        <h2>No estas en esta partida</h2>
        <p>Parece que no te has unido a esta partida.</p>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
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
