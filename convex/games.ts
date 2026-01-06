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

    await ctx.db.patch(args.gameId, updates);
  },
});
