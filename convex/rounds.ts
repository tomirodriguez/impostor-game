import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { words } from "./words";
import type { Id } from "./_generated/dataModel";

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const startGame = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can start game");
    if (game.status !== "lobby") throw new Error("Game already started");

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    if (players.length < 3) throw new Error("Need at least 3 players");

    // Select random word from category
    const categoryWords = words[game.category as keyof typeof words] || words.animales;
    const randomWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];
    const secretWord = randomWord.word;
    const tabooWords = randomWord.taboo;

    // Assign impostors
    const playerIds = players.map((p) => p._id);
    const shuffledIds = shuffle(playerIds);

    let impostorCount = game.impostorCount;
    if (game.allImpostors) {
      impostorCount = players.length; // Everyone is an impostor!
    } else {
      // Cap impostor count at players - 1 (need at least 1 non-impostor)
      impostorCount = Math.min(impostorCount, players.length - 1);
    }

    const impostorIds = new Set(shuffledIds.slice(0, impostorCount));

    // Update all players
    for (const player of players) {
      await ctx.db.patch(player._id, {
        isImpostor: impostorIds.has(player._id),
        isEliminated: false,
      });
    }

    // Determinar orden de turnos según el modo
    let turnOrder: typeof playerIds;
    if (game.turnMode === "fixed") {
      // Ordenar por joinedAt para turnos fijos
      turnOrder = players
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => p._id);
    } else {
      // Modo aleatorio: mezclar
      turnOrder = shuffle(playerIds);
    }

    // Update game state
    await ctx.db.patch(args.gameId, {
      status: "reveal",
      currentRound: 1,
      secretWord,
      tabooWords,
      turnOrder,
      currentTurnIndex: 0,
      turnStartedAt: undefined, // Se establecerá cuando empiece la fase de clues
    });
  },
});

export const readyForClues = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can advance");
    if (game.status !== "reveal") throw new Error("Not in reveal phase");

    await ctx.db.patch(args.gameId, {
      status: "clues",
      // Iniciar timer si está configurado
      turnStartedAt: game.turnTimeLimit ? Date.now() : undefined,
    });
  },
});

// Marca el turno como completado sin escribir pista (para modo presencial)
export const markTurnDone = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "clues") throw new Error("Not in clues phase");

    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.isEliminated) throw new Error("Eliminated players cannot give clues");

    if (!game.turnOrder || game.currentTurnIndex === undefined) {
      throw new Error("Turn order not set");
    }

    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const activeIds = activePlayers.map((p) => p._id);
    const activeTurnOrder = game.turnOrder.filter((id) => activeIds.includes(id));

    if (activeTurnOrder[game.currentTurnIndex] !== args.playerId) {
      throw new Error("Not your turn");
    }

    // Check if already marked done this round
    const existingClue = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .filter((q) => q.eq(q.field("playerId"), args.playerId))
      .first();

    if (existingClue) throw new Error("Already marked done this round");

    // Save a placeholder clue to track turn completion
    await ctx.db.insert("clues", {
      gameId: args.gameId,
      round: game.currentRound,
      playerId: args.playerId,
      clue: "✓",
      order: game.currentTurnIndex,
    });

    // Advance turn (but don't auto-move to voting, host controls that)
    const nextTurnIndex = game.currentTurnIndex + 1;
    if (nextTurnIndex < activeTurnOrder.length) {
      await ctx.db.patch(args.gameId, {
        currentTurnIndex: nextTurnIndex,
        // Reiniciar timer para el siguiente turno
        turnStartedAt: game.turnTimeLimit ? Date.now() : undefined,
      });
    }
  },
});

// El host inicia la votación manualmente (para modo presencial)
export const startVoting = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can start voting");
    if (game.status !== "clues") throw new Error("Not in clues phase");

    await ctx.db.patch(args.gameId, { status: "voting", currentTurnIndex: 0 });
  },
});

// Helper para normalizar letras (quitar acentos)
function normalizeChar(char: string): string {
  return char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

export const submitClue = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    clue: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "clues") throw new Error("Not in clues phase");

    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.isEliminated) throw new Error("Eliminated players cannot give clues");

    // Check if it's this player's turn
    if (!game.turnOrder || game.currentTurnIndex === undefined) {
      throw new Error("Turn order not set");
    }

    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const activeIds = activePlayers.map((p) => p._id);
    const activeTurnOrder = game.turnOrder.filter((id) => activeIds.includes(id));

    if (activeTurnOrder[game.currentTurnIndex] !== args.playerId) {
      throw new Error("Not your turn");
    }

    // Check if already gave clue this round
    const existingClues = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    const existingClue = existingClues.find((c) => c.playerId === args.playerId);
    if (existingClue) throw new Error("Already gave clue this round");

    const clueText = args.clue.trim();

    // Validar pistas encadenadas si está habilitado
    if (game.chainedClues && existingClues.length > 0) {
      // Obtener la última pista dada (por orden)
      const sortedClues = existingClues.sort((a, b) => b.order - a.order);
      const lastClue = sortedClues[0];
      if (lastClue && lastClue.clue && lastClue.clue !== "✓" && lastClue.clue !== "⏱️ Tiempo agotado") {
        const lastChar = lastClue.clue.slice(-1);
        const firstChar = clueText.charAt(0);
        if (normalizeChar(firstChar) !== normalizeChar(lastChar)) {
          throw new Error(`La pista debe empezar con "${lastChar.toUpperCase()}"`);
        }
      }
    }

    // Save clue
    await ctx.db.insert("clues", {
      gameId: args.gameId,
      round: game.currentRound,
      playerId: args.playerId,
      clue: clueText,
      order: game.currentTurnIndex,
    });

    // Advance turn or move to voting (only auto-move if requireClueText is true)
    const nextTurnIndex = game.currentTurnIndex + 1;
    if (nextTurnIndex >= activeTurnOrder.length) {
      // All players gave clues
      if (game.requireClueText) {
        // Auto-move to voting when text clues are required
        await ctx.db.patch(args.gameId, {
          status: "voting",
          currentTurnIndex: 0,
          turnStartedAt: undefined,
        });
      }
      // If !requireClueText, host decides when to start voting
    } else {
      await ctx.db.patch(args.gameId, {
        currentTurnIndex: nextTurnIndex,
        // Reiniciar timer para el siguiente turno
        turnStartedAt: game.turnTimeLimit ? Date.now() : undefined,
      });
    }
  },
});

export const getClues = query({
  args: {
    gameId: v.id("games"),
    round: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", args.round)
      )
      .collect();
  },
});

export const getCurrentTurnPlayer = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || !game.turnOrder || game.currentTurnIndex === undefined) return null;

    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const activeIds = activePlayers.map((p) => p._id);
    const activeTurnOrder = game.turnOrder.filter((id) => activeIds.includes(id));

    if (game.currentTurnIndex >= activeTurnOrder.length) return null;

    const playerId = activeTurnOrder[game.currentTurnIndex];
    return await ctx.db.get(playerId);
  },
});

// Query para obtener la letra requerida para pistas encadenadas
export const getRequiredLetter = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || !game.chainedClues) return null;

    const clues = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    if (clues.length === 0) return null;

    // Obtener la última pista dada (por orden)
    const sortedClues = clues.sort((a, b) => b.order - a.order);
    const lastClue = sortedClues[0];

    if (!lastClue || !lastClue.clue || lastClue.clue === "✓" || lastClue.clue === "⏱️ Tiempo agotado") {
      return null;
    }

    return lastClue.clue.slice(-1).toUpperCase();
  },
});

// Mutation para cuando expira el tiempo del turno
export const timeoutTurn = mutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "clues") throw new Error("Not in clues phase");
    if (!game.turnTimeLimit) throw new Error("No time limit configured");

    if (!game.turnOrder || game.currentTurnIndex === undefined) {
      throw new Error("Turn order not set");
    }

    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const activeIds = activePlayers.map((p) => p._id);
    const activeTurnOrder = game.turnOrder.filter((id) => activeIds.includes(id));

    if (game.currentTurnIndex >= activeTurnOrder.length) {
      throw new Error("No current turn");
    }

    const currentPlayerId = activeTurnOrder[game.currentTurnIndex];

    // Verificar si ya dio pista este jugador
    const existingClue = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .filter((q) => q.eq(q.field("playerId"), currentPlayerId))
      .first();

    if (existingClue) {
      // Ya dio pista, no hacer nada
      return;
    }

    // Guardar pista como timeout
    await ctx.db.insert("clues", {
      gameId: args.gameId,
      round: game.currentRound,
      playerId: currentPlayerId,
      clue: "⏱️ Tiempo agotado",
      order: game.currentTurnIndex,
    });

    // Avanzar al siguiente turno
    const nextTurnIndex = game.currentTurnIndex + 1;
    if (nextTurnIndex >= activeTurnOrder.length) {
      // Todos dieron pista
      if (game.requireClueText) {
        await ctx.db.patch(args.gameId, {
          status: "voting",
          currentTurnIndex: 0,
          turnStartedAt: undefined,
        });
      }
    } else {
      await ctx.db.patch(args.gameId, {
        currentTurnIndex: nextTurnIndex,
        turnStartedAt: Date.now(),
      });
    }
  },
});

export const submitVote = mutation({
  args: {
    gameId: v.id("games"),
    voterId: v.id("players"),
    targetId: v.optional(v.id("players")), // undefined = skip vote
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "voting") throw new Error("Not in voting phase");

    const voter = await ctx.db.get(args.voterId);
    if (!voter) throw new Error("Voter not found");
    if (voter.isEliminated) throw new Error("Eliminated players cannot vote");

    // Validar skip vote solo si está habilitado
    if (args.targetId === undefined && !game.allowSkipVote) {
      throw new Error("Skip vote is not allowed");
    }

    // Validar target si no es skip
    if (args.targetId !== undefined) {
      const target = await ctx.db.get(args.targetId);
      if (!target) throw new Error("Target not found");
      if (target.isEliminated) throw new Error("Cannot vote for eliminated player");
    }

    // Check if already voted
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_voter", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound).eq("voterId", args.voterId)
      )
      .first();

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, { targetId: args.targetId });
    } else {
      // Create new vote
      await ctx.db.insert("votes", {
        gameId: args.gameId,
        round: game.currentRound,
        voterId: args.voterId,
        targetId: args.targetId,
      });
    }

    // Check if all active players voted
    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    if (votes.length >= activePlayers.length) {
      // All voted, calculate results
      await ctx.db.patch(args.gameId, { status: "results" });
    }
  },
});

export const getVotes = query({
  args: {
    gameId: v.id("games"),
    round: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return [];

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", args.round)
      )
      .collect();

    // En resultados o finalizado, siempre mostrar votos completos
    if (game.status === "results" || game.status === "finished") {
      return votes;
    }

    // En votación:
    if (game.status === "voting") {
      // Si es votación secreta, no mostrar los votos (el contador se calcula en el frontend)
      if (game.secretVoting) {
        return [];
      }
      // Si es votación pública, mostrar votos en tiempo real
      return votes;
    }

    return [];
  },
});

// Query para obtener el contador de votos (para votación secreta)
export const getVoteCount = query({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return { count: 0, total: 0 };

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    const activePlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    return {
      count: votes.length,
      total: activePlayers.length,
    };
  },
});

export const getRoundResults = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || (game.status !== "results" && game.status !== "finished")) return null;

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    // Count votes (incluyendo skip como "skip")
    const voteCounts: Record<string, number> = {};
    let skipVotes = 0;

    for (const vote of votes) {
      if (vote.targetId) {
        voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
      } else {
        skipVotes++;
      }
    }

    // Find players with most votes
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

    // Determinar resultado según skipVotes y tiebreaker
    let eliminatedIds: string[] = [];
    let isTie = playersWithMaxVotes.length > 1;
    let wasSkipped = false;

    // Si skip tiene más votos que cualquier jugador, nadie es eliminado
    if (skipVotes > maxVotes) {
      wasSkipped = true;
      eliminatedIds = [];
    } else if (isTie) {
      // Hay empate, aplicar tiebreaker
      const tieBreaker = game.tieBreaker || "none";
      switch (tieBreaker) {
        case "none":
          eliminatedIds = [];
          break;
        case "all":
          eliminatedIds = playersWithMaxVotes;
          break;
        case "random":
          // Para la query solo mostramos que habrá uno aleatorio
          // La selección real se hace en nextRound
          eliminatedIds = playersWithMaxVotes;
          break;
      }
    } else if (playersWithMaxVotes.length === 1) {
      eliminatedIds = playersWithMaxVotes;
    }

    // Obtener datos de jugadores eliminados
    const eliminatedPlayers = await Promise.all(
      eliminatedIds.map((id) => ctx.db.get(id as Id<"players">))
    );

    return {
      voteCounts,
      skipVotes,
      eliminatedPlayers: eliminatedPlayers.filter(Boolean),
      isTie,
      wasSkipped,
      tieBreaker: game.tieBreaker || "none",
      secretWord: game.secretWord,
      maxRounds: game.maxRounds,
      currentRound: game.currentRound,
    };
  },
});

export const nextRound = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can advance");
    if (game.status !== "results") throw new Error("Not in results phase");

    // Get results and eliminate player(s)
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    const voteCounts: Record<string, number> = {};
    let skipVotes = 0;

    for (const vote of votes) {
      if (vote.targetId) {
        voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
      } else {
        skipVotes++;
      }
    }

    // Find players with most votes
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

    // Determinar quién es eliminado según skipVotes y tiebreaker
    let eliminatedIds: string[] = [];
    const isTie = playersWithMaxVotes.length > 1;

    // Si skip tiene más votos que cualquier jugador, nadie es eliminado
    if (skipVotes > maxVotes) {
      eliminatedIds = [];
    } else if (isTie) {
      // Hay empate, aplicar tiebreaker
      const tieBreaker = game.tieBreaker || "none";
      switch (tieBreaker) {
        case "none":
          eliminatedIds = [];
          break;
        case "all":
          eliminatedIds = playersWithMaxVotes;
          break;
        case "random":
          // Seleccionar uno al azar
          const randomIndex = Math.floor(Math.random() * playersWithMaxVotes.length);
          eliminatedIds = [playersWithMaxVotes[randomIndex]];
          break;
      }
    } else if (playersWithMaxVotes.length === 1) {
      eliminatedIds = playersWithMaxVotes;
    }

    // Eliminar jugador(es) y actualizar scores
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const eliminatedId of eliminatedIds) {
      const eliminated = await ctx.db.get(eliminatedId as Id<"players">);
      if (eliminated) {
        await ctx.db.patch(eliminated._id, { isEliminated: true });

        if (eliminated.isImpostor) {
          // Impostor caught! Non-impostors who voted correctly get +10
          for (const vote of votes) {
            if (vote.targetId === eliminatedId) {
              const voter = players.find((p) => p._id === vote.voterId);
              if (voter && !voter.isImpostor) {
                await ctx.db.patch(voter._id, { score: voter.score + 10 });
              }
            }
          }
          // All non-eliminated non-impostors get +5
          for (const player of players) {
            if (!player.isImpostor && !player.isEliminated && player._id !== eliminated._id) {
              await ctx.db.patch(player._id, { score: player.score + 5 });
            }
          }
        } else {
          // Innocent eliminated! Surviving impostors get +15
          const impostors = players.filter((p) => p.isImpostor && !p.isEliminated);
          for (const impostor of impostors) {
            await ctx.db.patch(impostor._id, { score: impostor.score + 15 });
          }
        }
      }
    }

    // Check win conditions
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isEliminated"), false))
      .collect();

    const remainingImpostors = remainingPlayers.filter((p) => p.isImpostor);
    const remainingInnocents = remainingPlayers.filter((p) => !p.isImpostor);

    // Game ends if:
    // - No impostors left (citizens win)
    // - Impostors >= innocents (impostor wins)
    // - Max rounds reached (impostor wins)
    const nextRoundNumber = game.currentRound + 1;
    const maxRoundsReached = game.maxRounds && nextRoundNumber > game.maxRounds;

    if (remainingImpostors.length === 0) {
      // Citizens win
      await ctx.db.patch(args.gameId, { status: "finished" });
    } else if (remainingImpostors.length >= remainingInnocents.length) {
      // Impostor wins by outnumbering
      await ctx.db.patch(args.gameId, { status: "finished" });
    } else if (maxRoundsReached) {
      // Impostor wins by surviving all rounds
      // Bonus para impostores que sobrevivieron
      for (const impostor of remainingImpostors) {
        await ctx.db.patch(impostor._id, { score: impostor.score + 20 });
      }
      await ctx.db.patch(args.gameId, { status: "finished" });
    } else {
      // New round: determine turn order, optionally new word
      let secretWord = game.secretWord;
      let tabooWords = game.tabooWords;
      if (game.changeWordEachRound) {
        const categoryWords = words[game.category as keyof typeof words] || words.animales;
        const randomWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];
        secretWord = randomWord.word;
        tabooWords = randomWord.taboo;
      }

      let turnOrder: Id<"players">[];
      if (game.turnMode === "fixed") {
        // Modo fijo: rotar el orden (el primero pasa al final)
        const sortedByJoin = remainingPlayers
          .sort((a, b) => a.joinedAt - b.joinedAt)
          .map((p) => p._id);
        // Rotar según la ronda actual (cada ronda avanza uno en el ciclo)
        const rotateBy = game.currentRound % sortedByJoin.length;
        turnOrder = [...sortedByJoin.slice(rotateBy), ...sortedByJoin.slice(0, rotateBy)];
      } else {
        // Modo aleatorio: mezclar
        turnOrder = shuffle(remainingPlayers.map((p) => p._id));
      }

      await ctx.db.patch(args.gameId, {
        status: "reveal",
        currentRound: nextRoundNumber,
        secretWord,
        tabooWords,
        turnOrder,
        currentTurnIndex: 0,
        turnStartedAt: undefined,
      });
    }
  },
});

export const playAgain = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can restart");
    if (game.status !== "finished") throw new Error("Game not finished");

    // Reset all players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const player of players) {
      await ctx.db.patch(player._id, {
        isImpostor: false,
        isEliminated: false,
      });
    }

    // Delete old clues and votes
    const clues = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const clue of clues) {
      await ctx.db.delete(clue._id);
    }

    const allVotes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) => q.eq("gameId", args.gameId))
      .collect();

    for (const vote of allVotes) {
      await ctx.db.delete(vote._id);
    }

    // Reset game
    await ctx.db.patch(args.gameId, {
      status: "lobby",
      currentRound: 0,
      secretWord: undefined,
      turnOrder: undefined,
      currentTurnIndex: undefined,
    });
  },
});
