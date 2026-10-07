import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
  }).index("email", ["email"]),
  notes: defineTable({
    title: v.string(),
    body: v.string(),
    pinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ownerId: v.optional(v.id("users")),
  })
    .index("by_updated", ["updatedAt"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
});
