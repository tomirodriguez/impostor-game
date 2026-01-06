import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.toLowerCase()))
      .first();

    if (!game) throw new Error("Game not found");
    if (game.status !== "lobby") throw new Error("Game already started");

    // Check if player already in game
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_game_and_session", (q) =>
        q.eq("gameId", game._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (existingPlayer) {
      return { gameId: game._id, playerId: existingPlayer._id };
    }

    // Check player limit (max 20)
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    if (players.length >= 20) throw new Error("Game is full (max 20 players)");

    // Create new player
    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      name: args.name,
      sessionId: args.sessionId,
      isImpostor: false,
      isEliminated: false,
      score: 0,
      joinedAt: Date.now(),
    });

    return { gameId: game._id, playerId };
  },
});

export const getByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

export const getMe = query({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_game_and_session", (q) =>
        q.eq("gameId", args.gameId).eq("sessionId", args.sessionId)
      )
      .first();
  },
});

export const getMyRole = query({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const player = await ctx.db
      .query("players")
      .withIndex("by_game_and_session", (q) =>
        q.eq("gameId", args.gameId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) return null;

    return {
      isImpostor: player.isImpostor,
      secretWord: player.isImpostor ? null : game.secretWord,
    };
  },
});

export const leave = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_and_session", (q) =>
        q.eq("gameId", args.gameId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!player) return;

    const game = await ctx.db.get(args.gameId);
    if (!game) return;

    // If host leaves and game is in lobby, delete the game
    if (game.hostId === player._id && game.status === "lobby") {
      // Delete all players
      const players = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
        .collect();

      for (const p of players) {
        await ctx.db.delete(p._id);
      }

      await ctx.db.delete(args.gameId);
    } else {
      // Just remove the player
      await ctx.db.delete(player._id);
    }
  },
});


export const kick = mutation({
  args: {
    gameId: v.id("games"),
    hostPlayerId: v.id("players"),
    targetPlayerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Partida no encontrada");
    }

    // Verificar que quien kickea es el host
    if (game.hostId !== args.hostPlayerId) {
      throw new Error("Solo el host puede expulsar jugadores");
    }

    // No puede kickearse a sí mismo
    if (args.hostPlayerId === args.targetPlayerId) {
      throw new Error("No puedes expulsarte a ti mismo");
    }

    // Solo permitir kick en lobby
    if (game.status !== "lobby") {
      throw new Error("Solo puedes expulsar jugadores en la sala de espera");
    }

    const targetPlayer = await ctx.db.get(args.targetPlayerId);
    if (!targetPlayer || targetPlayer.gameId !== args.gameId) {
      throw new Error("Jugador no encontrado en esta partida");
    }

    // Eliminar el jugador
    await ctx.db.delete(args.targetPlayerId);

    return { kickedSessionId: targetPlayer.sessionId };
  },
});
