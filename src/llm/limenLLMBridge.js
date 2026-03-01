/**
 * limenLLMBridge — implements LimenLT's LLMService interface so DreamState
 * can call the existing Always-msg summarize() client for Polaroid distillation.
 *
 * Usage:
 *   const llmService = makeLLMService(contact, settings);
 *   // Then pass to new LimenEngine(config, llmService)
 */
import { summarize } from './summarizeClient.js';

/**
 * Build a LLMService object compatible with LimenLT's DreamState.
 *
 * @param {object} contact   full contact row (for llmConfig)
 * @param {object} settings  global settings from Zustand
 * @returns {{ generateCompletion: (prompt: string) => Promise<string> }}
 */
export function makeLLMService(contact, settings) {
    return {
        generateCompletion: async (prompt) => {
            // DreamState passes the full distillation prompt as a single string.
            // We route it through the existing summarize() as a custom-prompt call.
            return summarize({
                contact,
                settings,
                messages: [{ role: 'user', content: prompt }],
                customPrompt: 'You are a cognitive memory engine. Follow the distillation instructions provided exactly.',
            });
        },
    };
}
