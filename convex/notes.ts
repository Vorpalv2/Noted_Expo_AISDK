import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("You must be signed in to access notes.");
  return userId;
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ? await ctx.db.get(userId) : null;
  },
});

export const setTheme = mutation({
  args: { theme: v.union(v.literal("light"), v.literal("dark")) },
  handler: async (ctx, { theme }) => {
    const userId = await requireUser(ctx);
    await ctx.db.patch(userId, { theme });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("notes")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("notes", { ...args, ownerId, pinned: false, createdAt: now, updatedAt: now });
  },
});

export const initializeUserNotes = mutation({
  args: {
    notes: v.array(v.object({
      title: v.string(),
      body: v.string(),
      pinned: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })),
  },
  handler: async (ctx, { notes }) => {
    const ownerId = await requireUser(ctx);
    const alreadyHasNotes = await ctx.db.query("notes")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
      .first();
    if (alreadyHasNotes) return { imported: 0, claimed: 0 };

    // Existing cloud notes were created before accounts were enabled. Attach
    // those orphaned notes to the first account that completes setup.
    const unownedNotes = await ctx.db.query("notes")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", undefined))
      .collect();
    if (unownedNotes.length > 0) {
      for (const note of unownedNotes) await ctx.db.patch(note._id, { ownerId });
      return { imported: 0, claimed: unownedNotes.length };
    }

    for (const note of notes) await ctx.db.insert("notes", { ...note, ownerId });
    return { imported: notes.length, claimed: 0 };
  },
});

export const update = mutation({
  args: { id: v.id("notes"), title: v.string(), body: v.string() },
  handler: async (ctx, { id, ...fields }) => {
    const ownerId = await requireUser(ctx);
    const note = await ctx.db.get(id);
    if (!note || note.ownerId !== ownerId) throw new Error("Note not found.");
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const togglePin = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const ownerId = await requireUser(ctx);
    const note = await ctx.db.get(id);
    if (!note || note.ownerId !== ownerId) throw new Error("Note not found.");
    await ctx.db.patch(id, { pinned: !note.pinned, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const ownerId = await requireUser(ctx);
    const note = await ctx.db.get(id);
    if (!note || note.ownerId !== ownerId) throw new Error("Note not found.");
    await ctx.db.delete(id);
  },
});
