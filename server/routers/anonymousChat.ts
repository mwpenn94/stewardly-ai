import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
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
 * - No memory/style personalization
 * - Max 5 conversations, 10 messages each (enforced client-side)
 * - After 3 messages, prompt to create account
 */
export const anonymousChatRouter = router({
  send: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).min(1).max(20),
      focus: z.enum(["general", "financial", "study"]).default("general"),
    }))
    .mutation(async ({ input }) => {
      const { messages, focus } = input;

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

      const llmMessages = [
        { role: "system" as const, content: systemPrompt + anonRestrictions },
        ...messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const content = response.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

      return { content };
    }),
});
