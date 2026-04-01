import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { contextualLLM } from "../shared/intelligence/sovereignWiring"
import { contextualLLM } from "../services/contextualLLM";
import { buildSystemPrompt } from "../prompts";
import type { FocusMode, AdvisoryMode } from "@shared/types";

/**
 * Anonymous chat router — allows unauthenticated users to chat
 * with limited functionality (general education only, no persistence on server).
 * 
 * Tier 0 restrictions:
 * - General education only (no personalized financial advice)
 * - No document uploads
 * - No suitability assessment
 * - No memory/style personalization (but supports localStorage-based guest preferences)
 * - Max 5 conversations, 10 messages each (enforced client-side)
 * - After 3 messages, prompt to create account
 */

const guestPreferencesSchema = z.object({
  responseDepth: z.enum(["brief", "balanced", "detailed"]).default("balanced"),
  tone: z.enum(["professional", "friendly", "casual"]).default("friendly"),
  focusAreas: z.array(z.string()).default(["general"]),
  languageStyle: z.enum(["simple", "standard", "technical"]).default("standard"),
  includeExamples: z.boolean().default(true),
  responseFormat: z.enum(["conversational", "structured", "bullet-points"]).default("conversational"),
}).optional();

export const anonymousChatRouter = router({
  send: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).min(1).max(20),
      focus: z.enum(["general", "financial", "study"]).default("general"),
      guestPreferences: guestPreferencesSchema,
    }))
    .mutation(async ({ input }) => {
      const { messages, focus, guestPreferences } = input;

      // Build a restricted system prompt for anonymous users
      const systemPrompt = buildSystemPrompt({
        userName: "Guest",
        mode: "client" as AdvisoryMode,
        focus: focus as FocusMode,
        focusModes: [focus],
        userRole: "user",
        styleProfile: null,
        ragContext: undefined,
        memories: undefined,
        suitabilityCompleted: false,
        productContext: undefined,
      });

      // Add anonymous-specific restrictions
      const anonRestrictions = `\n\n<anonymous_mode>
This user is browsing anonymously (not signed in). Important restrictions:
- Provide GENERAL EDUCATION only — no personalized financial advice
- Do NOT ask for personal financial details (income, assets, etc.)
- If the user asks for personalized advice, gently suggest creating a free account
- Keep responses helpful but general
- After a few exchanges, naturally mention that signing up unlocks personalized features
- You may discuss financial concepts, explain products generally, and answer educational questions
</anonymous_mode>`;

      // Apply guest preferences if provided
      let preferencesFragment = "";
      if (guestPreferences) {
        const parts: string[] = [];
        parts.push(`Response depth: ${guestPreferences.responseDepth} (brief = concise 1-2 sentences, balanced = moderate detail, detailed = thorough explanations)`);
        parts.push(`Tone: ${guestPreferences.tone}`);
        parts.push(`Language style: ${guestPreferences.languageStyle} (simple = avoid jargon, standard = normal, technical = use precise terminology)`);
        parts.push(`Include examples: ${guestPreferences.includeExamples ? "yes, include practical examples" : "no, skip examples"}`);
        parts.push(`Response format: ${guestPreferences.responseFormat} (conversational = natural flow, structured = headers/sections, bullet-points = lists)`);
        if (guestPreferences.focusAreas.length > 0 && guestPreferences.focusAreas[0] !== "general") {
          parts.push(`Guest's areas of interest: ${guestPreferences.focusAreas.join(", ")}`);
        }
        preferencesFragment = `\n\n<guest_preferences>
The guest has set the following preferences for how they'd like responses formatted. Honor these preferences:
${parts.join("\n")}
</guest_preferences>`;
      }

      const llmMessages = [
        { role: "system" as const, content: systemPrompt + anonRestrictions + preferencesFragment },
        ...messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await contextualLLM({ userId: 0, contextType: "anonymous", messages: llmMessages });
      const content = response.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

      return { content };
    }),
});
