/**
 * audioScriptGenerator.ts — AI prompt + pipeline for generating TTS-optimized scripts
 *
 * Pass 121. Used by:
 * 1. Nightly cron job pre-generating scripts for learning content
 * 2. On-demand generator when user clicks "Listen" on content without a script
 * 3. Personalization flow when user requests "make it simpler" etc.
 */

export const AUDIO_SCRIPT_SYSTEM_PROMPT = `You are generating a spoken audio script for a financial education platform.
The listener is a financial professional studying for licensing exams and professional certifications while commuting, exercising, or doing other hands-free activities.

Transform the following written content into a natural, spoken-word script optimized for audio delivery. Apply these rules:

1. RESTRUCTURE for spoken flow — break complex sentences into shorter ones.
2. EXPAND acronyms on first use: "IUL — that's Indexed Universal Life"
3. VERBALIZE formulas: "Future Value equals Present Value, times the quantity one plus the interest rate, raised to the power of n."
4. ADD signposts: "Here's the key point...", "Moving on...", "To summarize..."
5. ADD strategic pauses using [pause] markers where the listener needs a moment to absorb.
6. KEEP the meaning EXACTLY the same — never add information, only restructure for listening.
7. TARGET length: the spoken version should be 10-20% longer than the written version.

Output ONLY the spoken script, nothing else.`;

export const PERSONALIZATION_SYSTEM_PROMPT = `You are personalizing an audio script for a specific user's preferences.

The user has requested the following adjustment: "{instruction}"

Their preferences:
- Expand acronyms: {expandAcronyms}
- Simplify language: {simplifyLanguage}
- Include examples: {includeExamples}
- Verbosity: {verbosityLevel} (concise = key facts only, standard = full explanation, detailed = with context)

Take the existing audio script and adjust it according to the user's request and preferences.
Maintain accuracy. Output ONLY the adjusted script, nothing else.`;

const CONTENT_PREFIXES: Record<string, string> = {
  learning_definition: "This is a financial term definition:",
  learning_chapter: "This is a chapter from a financial training module:",
  learning_formula: "This is a financial formula and its explanation:",
  quiz_question: "This is a quiz question with answer options:",
  case_study: "This is a financial case study scenario:",
  market_summary: "This is a market data summary:",
  recommendation: "This is a financial recommendation:",
  page_narration: "This is a page summary for audio narration:",
  chat_response: "This is an AI response to a financial question:",
};

export async function generateAudioScript(
  contentText: string,
  contentType: string,
  callLLM: (prompt: string, systemPrompt: string) => Promise<string>,
): Promise<string> {
  const contextPrefix = CONTENT_PREFIXES[contentType] || "This is content to be read aloud:";
  const prompt = `${contextPrefix}\n\n${contentText}`;
  return callLLM(prompt, AUDIO_SCRIPT_SYSTEM_PROMPT);
}

export async function personalizeAudioScript(
  existingScript: string,
  userInstruction: string,
  userPrefs: { expandAcronyms: boolean; simplifyLanguage: boolean; includeExamples: boolean; verbosityLevel: string },
  callLLM: (prompt: string, systemPrompt: string) => Promise<string>,
): Promise<string> {
  const systemPrompt = PERSONALIZATION_SYSTEM_PROMPT
    .replace("{instruction}", userInstruction)
    .replace("{expandAcronyms}", String(userPrefs.expandAcronyms))
    .replace("{simplifyLanguage}", String(userPrefs.simplifyLanguage))
    .replace("{includeExamples}", String(userPrefs.includeExamples))
    .replace("{verbosityLevel}", userPrefs.verbosityLevel);

  return callLLM(`Existing script:\n\n${existingScript}`, systemPrompt);
}
