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
    targetId: v.id("players"),
  })
    .index("by_game_and_round", ["gameId", "round"])
    .index("by_voter", ["gameId", "round", "voterId"]),
});
