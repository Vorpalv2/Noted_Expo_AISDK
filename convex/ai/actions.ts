"use node";

import { generateText } from "ai";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { buildNotePrompt, type NoteAIAction } from "./prompts";

const MODEL = "openai/gpt-4.1-nano";
const MAX_NOTE_LENGTH = 30_000;

export const assist = action({
  args: {
    action: v.union(v.literal("summarize"), v.literal("improve"), v.literal("title"), v.literal("tasks")),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("AUTH_REQUIRED");
    if (!process.env.AI_GATEWAY_API_KEY) throw new Error("AI_SETUP_REQUIRED");
    if (args.title.length > 300 || args.body.length > MAX_NOTE_LENGTH) throw new Error("NOTE_TOO_LONG");

    try {
      const { text } = await generateText({
        model: MODEL,
        system: "You are the private writing assistant inside Noted, a personal notes app. Return only the requested result. Keep factual claims grounded in the supplied note.",
        prompt: buildNotePrompt(args.action as NoteAIAction, args.title, args.body),
        maxOutputTokens: 900,
        maxRetries: 0,
        timeout: 45_000,
      });
      const result = text.trim();
      if (!result) throw new Error("EMPTY_RESPONSE");
      return result;
    } catch {
      throw new Error("AI_UNAVAILABLE");
    }
  },
});
