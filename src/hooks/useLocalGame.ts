import { useState, useCallback } from "react";
import { words, categories } from "../../convex/words";

export interface LocalPlayer {
  id: string;
  name: string;
  isImpostor: boolean;
  isEliminated: boolean;
  hasSeenRole: boolean;
}

export interface LocalVote {
  round: number;
  voterId: string;
  targetId: string | null; // null = skip
}

export interface LocalGameSettings {
  category: string;
  impostorCount: number;
  maxRounds?: number;
  allowSkipVote: boolean;
  tieBreaker: "none" | "all" | "random";
}

export interface LocalGame {
  id: string;
  players: LocalPlayer[];
  secretWord: string;
  settings: LocalGameSettings;
  currentRound: number;
  phase: "setup" | "reveal" | "clues" | "voting" | "results" | "finished";
  currentRevealIndex: number;
  currentTurnIndex: number;
  votes: LocalVote[];
  turnOrder: string[];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const STORAGE_KEY = "impostor-local-game";

export function useLocalGame() {
  const [game, setGame] = useState<LocalGame | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const saveGame = useCallback((newGame: LocalGame | null) => {
    setGame(newGame);
    if (newGame) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newGame));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const createGame = useCallback(
    (playerNames: string[], settings: LocalGameSettings) => {
      // Validar
      if (playerNames.length < 3) {
        throw new Error("Se necesitan al menos 3 jugadores");
      }

      // Crear jugadores
      const players: LocalPlayer[] = playerNames.map((name) => ({
        id: generateId(),
        name,
        isImpostor: false,
        isEliminated: false,
        hasSeenRole: false,
      }));

      // Asignar impostores
      const shuffledPlayers = shuffle(players);
      const impostorCount = Math.min(settings.impostorCount, players.length - 1);
      for (let i = 0; i < impostorCount; i++) {
        shuffledPlayers[i].isImpostor = true;
      }

      // Elegir palabra secreta
      const categoryWords = words[settings.category as keyof typeof words] || words.animales;
      const randomWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];
      const secretWord = randomWord.word;

      // Crear orden de turnos aleatorio
      const turnOrder = shuffle(players.map((p) => p.id));

      const newGame: LocalGame = {
        id: generateId(),
        players,
        secretWord,
        settings,
        currentRound: 1,
        phase: "reveal",
        currentRevealIndex: 0,
        currentTurnIndex: 0,
        votes: [],
        turnOrder,
      };

      saveGame(newGame);
      return newGame;
    },
    [saveGame]
  );

  const markRoleSeen = useCallback(
    (playerId: string) => {
      if (!game) return;

      const newGame = {
        ...game,
        players: game.players.map((p) =>
          p.id === playerId ? { ...p, hasSeenRole: true } : p
        ),
        currentRevealIndex: game.currentRevealIndex + 1,
      };

      // Si todos vieron su rol, pasar a fase de pistas
      const activePlayers = newGame.players.filter((p) => !p.isEliminated);
      if (newGame.currentRevealIndex >= activePlayers.length) {
        newGame.phase = "clues";
        newGame.currentTurnIndex = 0;
      }

      saveGame(newGame);
    },
    [game, saveGame]
  );

  const nextTurn = useCallback(() => {
    if (!game) return;

    const activePlayers = game.players.filter((p) => !p.isEliminated);
    const activeTurnOrder = game.turnOrder.filter((id) =>
      activePlayers.some((p) => p.id === id)
    );

    const nextIndex = game.currentTurnIndex + 1;

    if (nextIndex >= activeTurnOrder.length) {
      // Todos dieron pista, pasar a votacion
      saveGame({
        ...game,
        phase: "voting",
        currentTurnIndex: 0,
      });
    } else {
      saveGame({
        ...game,
        currentTurnIndex: nextIndex,
      });
    }
  }, [game, saveGame]);

  const startVoting = useCallback(() => {
    if (!game) return;
    saveGame({
      ...game,
      phase: "voting",
    });
  }, [game, saveGame]);

  const submitVote = useCallback(
    (voterId: string, targetId: string | null) => {
      if (!game) return;

      // Actualizar o agregar voto
      const existingVoteIndex = game.votes.findIndex(
        (v) => v.round === game.currentRound && v.voterId === voterId
      );

      let newVotes: LocalVote[];
      if (existingVoteIndex >= 0) {
        newVotes = [...game.votes];
        newVotes[existingVoteIndex] = {
          round: game.currentRound,
          voterId,
          targetId,
        };
      } else {
        newVotes = [
          ...game.votes,
          { round: game.currentRound, voterId, targetId },
        ];
      }

      // Verificar si todos votaron
      const activePlayers = game.players.filter((p) => !p.isEliminated);
      const roundVotes = newVotes.filter((v) => v.round === game.currentRound);

      let newPhase = game.phase;
      if (roundVotes.length >= activePlayers.length) {
        newPhase = "results";
      }

      saveGame({
        ...game,
        votes: newVotes,
        phase: newPhase,
      });
    },
    [game, saveGame]
  );

  // Submit all votes at once (for local mode where all votes are collected together)
  const submitAllVotes = useCallback(
    (allVotes: Record<string, string | null>) => {
      if (!game) return;

      const newVotes: LocalVote[] = [
        ...game.votes.filter((v) => v.round !== game.currentRound),
        ...Object.entries(allVotes).map(([voterId, targetId]) => ({
          round: game.currentRound,
          voterId,
          targetId,
        })),
      ];

      saveGame({
        ...game,
        votes: newVotes,
        phase: "results",
      });
    },
    [game, saveGame]
  );

  const getVoteResults = useCallback(() => {
    if (!game) return null;

    const roundVotes = game.votes.filter((v) => v.round === game.currentRound);

    // Contar votos
    const voteCounts: Record<string, number> = {};
    let skipVotes = 0;

    for (const vote of roundVotes) {
      if (vote.targetId) {
        voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
      } else {
        skipVotes++;
      }
    }

    // Encontrar maximo
    let maxVotes = 0;
    const playersWithMaxVotes: string[] = [];

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        playersWithMaxVotes.length = 0;
        playersWithMaxVotes.push(playerId);
      } else if (count === maxVotes) {
        playersWithMaxVotes.push(playerId);
      }
    }

    // Determinar eliminados
    let eliminatedIds: string[] = [];
    const isTie = playersWithMaxVotes.length > 1;
    const wasSkipped = skipVotes > maxVotes;

    if (wasSkipped) {
      eliminatedIds = [];
    } else if (isTie) {
      switch (game.settings.tieBreaker) {
        case "none":
          eliminatedIds = [];
          break;
        case "all":
          eliminatedIds = playersWithMaxVotes;
          break;
        case "random":
          const randomIndex = Math.floor(Math.random() * playersWithMaxVotes.length);
          eliminatedIds = [playersWithMaxVotes[randomIndex]];
          break;
      }
    } else if (playersWithMaxVotes.length === 1) {
      eliminatedIds = playersWithMaxVotes;
    }

    return {
      voteCounts,
      skipVotes,
      eliminatedIds,
      isTie,
      wasSkipped,
      roundVotes,
    };
  }, [game]);

  const nextRound = useCallback(() => {
    if (!game) return;

    const results = getVoteResults();
    if (!results) return;

    // Eliminar jugadores
    let newPlayers = game.players.map((p) =>
      results.eliminatedIds.includes(p.id) ? { ...p, isEliminated: true } : p
    );

    // Verificar condiciones de victoria
    const remainingPlayers = newPlayers.filter((p) => !p.isEliminated);
    const remainingImpostors = remainingPlayers.filter((p) => p.isImpostor);
    const remainingInnocents = remainingPlayers.filter((p) => !p.isImpostor);

    const nextRoundNumber = game.currentRound + 1;
    const maxRoundsReached = game.settings.maxRounds && nextRoundNumber > game.settings.maxRounds;

    // Determinar si el juego termina
    const gameEnds =
      remainingImpostors.length === 0 ||
      remainingImpostors.length >= remainingInnocents.length ||
      maxRoundsReached;

    if (gameEnds) {
      saveGame({
        ...game,
        players: newPlayers,
        phase: "finished",
      });
    } else {
      // Nueva palabra secreta
      const categoryWords =
        words[game.settings.category as keyof typeof words] || words.animales;
      const randomWord =
        categoryWords[Math.floor(Math.random() * categoryWords.length)];
      const secretWord = randomWord.word;

      // Nuevo orden de turnos
      const turnOrder = shuffle(remainingPlayers.map((p) => p.id));

      // Resetear hasSeenRole para la nueva ronda
      newPlayers = newPlayers.map((p) => ({
        ...p,
        hasSeenRole: p.isEliminated ? p.hasSeenRole : false,
      }));

      saveGame({
        ...game,
        players: newPlayers,
        secretWord,
        currentRound: nextRoundNumber,
        phase: "reveal",
        currentRevealIndex: 0,
        currentTurnIndex: 0,
        turnOrder,
      });
    }
  }, [game, getVoteResults, saveGame]);

  const resetGame = useCallback(() => {
    saveGame(null);
  }, [saveGame]);

  return {
    game,
    categories,
    createGame,
    markRoleSeen,
    nextTurn,
    startVoting,
    submitVote,
    submitAllVotes,
    getVoteResults,
    nextRound,
    resetGame,
  };
}
