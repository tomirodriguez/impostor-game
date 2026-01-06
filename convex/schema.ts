import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    hostId: v.optional(v.id("players")),
    status: v.union(
      v.literal("lobby"),
      v.literal("reveal"),
      v.literal("clues"),
      v.literal("voting"),
      v.literal("results"),
      v.literal("finished")
    ),
    category: v.string(),
    impostorCount: v.number(),
    allImpostors: v.boolean(),
    requireClueText: v.optional(v.boolean()), // Si true, los jugadores deben escribir su pista (default: false)
    showCategory: v.optional(v.boolean()), // Si true, muestra la categoría a los jugadores (default: false)
    turnMode: v.optional(v.union(v.literal("random"), v.literal("fixed"))), // "random" mezcla cada partida, "fixed" rota ordenadamente

    // Nuevas configuraciones Fase 1
    maxRounds: v.optional(v.number()), // undefined = sin límite
    turnTimeLimit: v.optional(v.number()), // segundos por turno, undefined = sin límite
    turnStartedAt: v.optional(v.number()), // timestamp de cuando empezó el turno actual
    secretVoting: v.optional(v.boolean()), // Si true, los votos son secretos hasta que todos voten
    allowSkipVote: v.optional(v.boolean()), // Si true, permite votar "saltar"
    tieBreaker: v.optional(v.union(
      v.literal("none"),    // no eliminar a nadie (default)
      v.literal("all"),     // eliminar a todos los empatados
      v.literal("random")   // eliminar uno aleatorio
    )),
    chainedClues: v.optional(v.boolean()), // Si true, pistas deben empezar con la última letra de la anterior

    currentRound: v.number(),
    secretWord: v.optional(v.string()),
    turnOrder: v.optional(v.array(v.id("players"))),
    currentTurnIndex: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  players: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    sessionId: v.string(),
    isImpostor: v.boolean(),
    isEliminated: v.boolean(),
    score: v.number(),
    joinedAt: v.number(),
  })
    .index("by_game", ["gameId"])
    .index("by_session", ["sessionId"])
    .index("by_game_and_session", ["gameId", "sessionId"]),

  clues: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    playerId: v.id("players"),
    clue: v.string(),
    order: v.number(),
  })
    .index("by_game_and_round", ["gameId", "round"]),

  votes: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    voterId: v.id("players"),
    targetId: v.optional(v.id("players")), // undefined = skip vote
  })
    .index("by_game_and_round", ["gameId", "round"])
    .index("by_voter", ["gameId", "round", "voterId"]),
});
