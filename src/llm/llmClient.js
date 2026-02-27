/**
 * llmClient — adapter router for the LLM layer.
 *
 * Usage:
 *   import { streamChat } from '../llm/llmClient';
 *   await streamChat({ contact, settings, messages, imageDataUrl, onToken, onDone, onError });
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
 * @param {object}   opts.contact        full contact row from IndexedDB (has llmConfig)
 * @param {object}   opts.settings       global settings map from Zustand store
 * @param {Array}    opts.messages       [{role, content}, ...] conversation history
 * @param {string}   [opts.imageDataUrl] optional image as a data URL for vision models
 * @param {function} opts.onToken        called with each text chunk (string)
 * @param {function} opts.onDone         called with full accumulated text when done
 * @param {function} opts.onError        called with an Error on failure
 */
export async function streamChat({ contact, settings, messages, imageDataUrl, onToken, onDone, onError }) {
    const llm = contact?.llmConfig ?? {};
    const endpointType = llm.endpointType || 'local';

    // Merge: contact-level values take priority; fall back to global settings
    const baseUrl = llm.baseUrl || settings?.baseUrl || '';
    const model = llm.model || settings?.model || '';
    const apiKey = llm.apiKey || settings?.apiKey || '';

    // Build the system message if the contact has a system instruction
    const systemInstruction = contact?.systemInstruction?.trim();

    // ── Vision payload: wrap last user message in multipart content ──────────
    // Strip imageRef from each message (DB rows may include it); keep only role + content
    let processedMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    if (imageDataUrl) {
        // Find the index of the most-recent user message
        const lastUserIdx = processedMessages.reduceRight(
            (found, m, i) => (found === -1 && m.role === 'user' ? i : found),
            -1,
        );
        if (lastUserIdx !== -1) {
            const textContent = processedMessages[lastUserIdx].content;
            processedMessages[lastUserIdx] = {
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageDataUrl, detail: 'auto' } },
                    { type: 'text', text: textContent },
                ],
            };
        }
    }

    const fullMessages = systemInstruction
        ? [{ role: 'system', content: systemInstruction }, ...processedMessages]
        : processedMessages;

    const adapterOpts = {
        baseUrl,
        model,
        apiKey,
        messages: fullMessages,
        temperature: Number(llm.temperature ?? settings?.temperature ?? 0.7),
        maxTokens: llm.maxTokens || settings?.maxTokens || undefined,
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
