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
    const secretWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];

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

    // Shuffle turn order
    const turnOrder = shuffle(playerIds);

    // Update game state
    await ctx.db.patch(args.gameId, {
      status: "reveal",
      currentRound: 1,
      secretWord,
      turnOrder,
      currentTurnIndex: 0,
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

    await ctx.db.patch(args.gameId, { status: "clues" });
  },
});

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
    const existingClue = await ctx.db
      .query("clues")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .filter((q) => q.eq(q.field("playerId"), args.playerId))
      .first();

    if (existingClue) throw new Error("Already gave clue this round");

    // Save clue
    await ctx.db.insert("clues", {
      gameId: args.gameId,
      round: game.currentRound,
      playerId: args.playerId,
      clue: args.clue.trim(),
      order: game.currentTurnIndex,
    });

    // Advance turn or move to voting
    const nextTurnIndex = game.currentTurnIndex + 1;
    if (nextTurnIndex >= activeTurnOrder.length) {
      // All players gave clues, move to voting
      await ctx.db.patch(args.gameId, { status: "voting", currentTurnIndex: 0 });
    } else {
      await ctx.db.patch(args.gameId, { currentTurnIndex: nextTurnIndex });
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

export const submitVote = mutation({
  args: {
    gameId: v.id("games"),
    voterId: v.id("players"),
    targetId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "voting") throw new Error("Not in voting phase");

    const voter = await ctx.db.get(args.voterId);
    if (!voter) throw new Error("Voter not found");
    if (voter.isEliminated) throw new Error("Eliminated players cannot vote");

    const target = await ctx.db.get(args.targetId);
    if (!target) throw new Error("Target not found");
    if (target.isEliminated) throw new Error("Cannot vote for eliminated player");

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

    // Only show votes when in results phase or finished
    if (game.status !== "results" && game.status !== "finished") {
      return [];
    }

    return await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", args.round)
      )
      .collect();
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

    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const vote of votes) {
      voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
    }

    // Find player with most votes
    let maxVotes = 0;
    let eliminatedId: string | null = null;
    let isTie = false;

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    // If tie, no one is eliminated
    if (isTie) eliminatedId = null;

    const eliminatedPlayer = eliminatedId
      ? await ctx.db.get(eliminatedId as Id<"players">)
      : null;

    return {
      voteCounts,
      eliminatedPlayer,
      isTie,
      secretWord: game.secretWord,
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

    // Get results and eliminate player
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_and_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.currentRound)
      )
      .collect();

    const voteCounts: Record<string, number> = {};
    for (const vote of votes) {
      voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let eliminatedId: string | null = null;
    let isTie = false;

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    if (!isTie && eliminatedId) {
      const eliminated = await ctx.db.get(eliminatedId as Id<"players">);
      if (eliminated) {
        await ctx.db.patch(eliminated._id, { isEliminated: true });

        // Update scores
        const players = await ctx.db
          .query("players")
          .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
          .collect();

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

    // Game ends if: no impostors left OR impostors >= innocents
    if (remainingImpostors.length === 0 || remainingImpostors.length >= remainingInnocents.length) {
      await ctx.db.patch(args.gameId, { status: "finished" });
    } else {
      // New round: new word, shuffle turn order
      const categoryWords = words[game.category as keyof typeof words] || words.animales;
      const secretWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];
      const turnOrder = shuffle(remainingPlayers.map((p) => p._id));

      await ctx.db.patch(args.gameId, {
        status: "reveal",
        currentRound: game.currentRound + 1,
        secretWord,
        turnOrder,
        currentTurnIndex: 0,
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
