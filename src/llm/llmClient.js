/**
 * llmClient — adapter router for the LLM layer.
 *
 * Usage:
 *   import { streamChat } from '../llm/llmClient';
 *   await streamChat({ contact, settings, messages, onToken, onDone, onError });
 *
 * The client merges per-contact config with global settings (contact wins),
 * picks the correct adapter, and delegates.
 */

import { streamChat as openaiStreamChat } from './openaiAdapter.js';
import { streamChat as lettaStreamChat } from './lettaAdapter.js';
import { streamChat as localStreamChat } from './localAdapter.js';

/**
 * Stream a chat completion using the appropriate adapter for the contact.
 *
 * @param {object} opts
 * @param {object}   opts.contact   — full contact row from IndexedDB (has llmConfig)
 * @param {object}   opts.settings  — global settings map from Zustand store
 * @param {Array}    opts.messages  — [{role:'user'|'assistant'|'system', content:string}, ...]
 * @param {function} opts.onToken   — (chunk: string) => void  [called per token/chunk]
 * @param {function} opts.onDone    — (fullText: string) => void  [called on completion]
 * @param {function} opts.onError   — (error: Error) => void  [called on failure]
 */
export async function streamChat({ contact, settings, messages, onToken, onDone, onError }) {
    const llm = contact?.llmConfig ?? {};
    const endpointType = llm.endpointType || 'local';

    // Merge: contact-level values take priority; fall back to global settings
    const baseUrl = llm.baseUrl || settings?.baseUrl || '';
    const model = llm.model || settings?.model || '';
    const apiKey = llm.apiKey || settings?.apiKey || '';

    // Build the system message if the contact has a system instruction
    const systemInstruction = contact?.systemInstruction?.trim();
    const fullMessages = systemInstruction
        ? [{ role: 'system', content: systemInstruction }, ...messages]
        : messages;

    const adapterOpts = {
        baseUrl,
        model,
        apiKey,
        messages: fullMessages,
        onToken,
        onDone,
        onError,
    };

    switch (endpointType) {
        case 'openai':
            return openaiStreamChat(adapterOpts);

        case 'letta':
            // For LETTA, the "model" field in llmConfig holds the agent ID
            return lettaStreamChat({ ...adapterOpts, agentId: model });

        case 'local':
        default:
            return localStreamChat(adapterOpts);
    }
}
