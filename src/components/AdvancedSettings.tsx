import { useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";

interface AdvancedSettingsProps {
  game: Doc<"games">;
  onUpdate: (settings: Record<string, any>) => Promise<void>;
  error: string;
}

export default function AdvancedSettings({ game, onUpdate, error }: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (field: string, currentValue: boolean | undefined) => {
    onUpdate({ [field]: !currentValue });
  };

  const handleSelect = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="advanced-settings">
      <button
        className="btn btn-secondary advanced-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {isExpanded ? "▼" : "▶"} Configuracion Avanzada
      </button>

      {isExpanded && (
        <div className="advanced-settings-content">
          {/* Mostrar categoria a jugadores */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.showCategory ?? false}
                onChange={() => handleToggle("showCategory", game.showCategory)}
              />
              <span>Mostrar categoria a los jugadores</span>
            </label>
          </div>

          {/* Escribir pistas en la app */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.requireClueText ?? false}
                onChange={() => handleToggle("requireClueText", game.requireClueText)}
              />
              <span>Escribir pistas en la app</span>
            </label>
            <p className="setting-hint">Si esta desactivado, solo se muestra el orden de turnos</p>
          </div>

          {/* Orden de turnos */}
          <div className="setting">
            <label>Orden de turnos</label>
            <select
              value={game.turnMode ?? "random"}
              onChange={(e) => handleSelect("turnMode", e.target.value)}
              className="select"
            >
              <option value="random">Aleatorio (se mezcla cada partida)</option>
              <option value="fixed">Fijo (rota en cada ronda)</option>
            </select>
          </div>

          {/* Tiempo por turno */}
          <div className="setting">
            <label>Tiempo por turno (Modo Speed)</label>
            <select
              value={game.turnTimeLimit ?? 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                handleSelect("turnTimeLimit", val === 0 ? undefined : val);
              }}
              className="select"
            >
              <option value={0}>Sin limite</option>
              <option value={10}>10 segundos</option>
              <option value={15}>15 segundos</option>
              <option value={20}>20 segundos</option>
              <option value={30}>30 segundos</option>
            </select>
            <p className="setting-hint">
              {game.turnTimeLimit
                ? `Cada jugador tiene ${game.turnTimeLimit}s para dar su pista`
                : "Sin limite de tiempo para dar pistas"}
            </p>
          </div>

          {/* Votacion secreta */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.secretVoting ?? false}
                onChange={() => handleToggle("secretVoting", game.secretVoting)}
              />
              <span>Votacion secreta</span>
            </label>
            <p className="setting-hint">
              {game.secretVoting
                ? "Los votos se revelan cuando todos hayan votado"
                : "Los votos se muestran en tiempo real"}
            </p>
          </div>

          {/* Permitir Skip */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.allowSkipVote ?? false}
                onChange={() => handleToggle("allowSkipVote", game.allowSkipVote)}
              />
              <span>Permitir abstenerse</span>
            </label>
            <p className="setting-hint">
              Si la mayoria se abstiene, nadie es eliminado en esa ronda
            </p>
          </div>

          {/* Regla de empate */}
          <div className="setting">
            <label>En caso de empate</label>
            <select
              value={game.tieBreaker ?? "none"}
              onChange={(e) => handleSelect("tieBreaker", e.target.value)}
              className="select"
            >
              <option value="none">No eliminar a nadie</option>
              <option value="all">Eliminar a todos los empatados</option>
              <option value="random">Eliminar uno al azar</option>
            </select>
          </div>

          {/* Pistas encadenadas */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.chainedClues ?? false}
                onChange={() => handleToggle("chainedClues", game.chainedClues)}
              />
              <span>Pistas encadenadas</span>
            </label>
            <p className="setting-hint">
              Cada pista debe empezar con la ultima letra de la anterior
            </p>
          </div>

          {/* Todos son impostores */}
          <div className="setting checkbox-setting">
            <label>
              <input
                type="checkbox"
                checked={game.allImpostors ?? false}
                onChange={() => handleToggle("allImpostors", game.allImpostors)}
              />
              <span>Todos son impostores (modo broma)</span>
            </label>
            <p className="setting-hint">
              Todos los jugadores reciben la palabra del impostor
            </p>
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
