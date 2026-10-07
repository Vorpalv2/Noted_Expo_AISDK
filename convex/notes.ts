import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notes").withIndex("by_updated").order("desc").collect();
  },
});

export const create = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("notes", { ...args, pinned: false, createdAt: now, updatedAt: now });
  },
});

export const importLocal = mutation({
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
    // Only seed an empty deployment. A second device must never duplicate or
    // overwrite notes after another client has started using the cloud list.
    const existing = await ctx.db.query("notes").first();
    if (existing) return 0;
    for (const note of notes) await ctx.db.insert("notes", note);
    return notes.length;
  },
});

export const update = mutation({
  args: { id: v.id("notes"), title: v.string(), body: v.string() },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const togglePin = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get(id);
    if (note) await ctx.db.patch(id, { pinned: !note.pinned, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => await ctx.db.delete(id),
});
