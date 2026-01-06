import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate a random 6-character code
function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const create = mutation({
  args: {
    hostName: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate unique code
    let code = generateCode();
    let existing = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    while (existing) {
      code = generateCode();
      existing = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    // Create game first without hostId
    const gameId = await ctx.db.insert("games", {
      code,
      status: "lobby",
      category: "animales",
      impostorCount: 1,
      allImpostors: false,
      requireClueText: false, // Por defecto no se requiere escribir la pista
      showCategory: false, // Por defecto no se muestra la categoría
      turnMode: "random", // Por defecto turnos aleatorios
      maxRounds: 2, // Por defecto 2 rondas
      currentRound: 0,
      createdAt: Date.now(),
    });

    // Create host player
    const playerId = await ctx.db.insert("players", {
      gameId,
      name: args.hostName,
      sessionId: args.sessionId,
      isImpostor: false,
      isEliminated: false,
      score: 0,
      joinedAt: Date.now(),
    });

    // Update game with correct hostId
    await ctx.db.patch(gameId, { hostId: playerId });

    return { gameId, playerId, code };
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.toLowerCase()))
      .first();
  },
});

export const get = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

export const updateSettings = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    category: v.optional(v.string()),
    impostorCount: v.optional(v.number()),
    allImpostors: v.optional(v.boolean()),
    requireClueText: v.optional(v.boolean()),
    showCategory: v.optional(v.boolean()),
    turnMode: v.optional(v.union(v.literal("random"), v.literal("fixed"))),
    // Nuevos campos Fase 1
    maxRounds: v.optional(v.number()),
    turnTimeLimit: v.optional(v.number()),
    secretVoting: v.optional(v.boolean()),
    allowSkipVote: v.optional(v.boolean()),
    tieBreaker: v.optional(v.union(
      v.literal("none"),
      v.literal("all"),
      v.literal("random")
    )),
    chainedClues: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.hostId !== args.playerId) throw new Error("Only host can update settings");
    if (game.status !== "lobby") throw new Error("Can only update settings in lobby");

    const updates: any = {};
    if (args.category !== undefined) updates.category = args.category;
    if (args.impostorCount !== undefined) updates.impostorCount = args.impostorCount;
    if (args.allImpostors !== undefined) updates.allImpostors = args.allImpostors;
    if (args.requireClueText !== undefined) updates.requireClueText = args.requireClueText;
    if (args.showCategory !== undefined) updates.showCategory = args.showCategory;
    if (args.turnMode !== undefined) updates.turnMode = args.turnMode;
    // Nuevos campos
    if (args.maxRounds !== undefined) updates.maxRounds = args.maxRounds;
    if (args.turnTimeLimit !== undefined) updates.turnTimeLimit = args.turnTimeLimit;
    if (args.secretVoting !== undefined) updates.secretVoting = args.secretVoting;
    if (args.allowSkipVote !== undefined) updates.allowSkipVote = args.allowSkipVote;
    if (args.tieBreaker !== undefined) updates.tieBreaker = args.tieBreaker;
    if (args.chainedClues !== undefined) updates.chainedClues = args.chainedClues;

    await ctx.db.patch(args.gameId, updates);
  },
});
