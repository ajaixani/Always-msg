/**
 * localAdapter — thin wrapper for local Ollama / LM Studio endpoints.
 *
 * Both Ollama (with /v1 suffix) and LM Studio expose an OpenAI-compatible
 * API, so we just forward to the openaiAdapter with sensible defaults.
 */

import { streamChat as openaiStreamChat } from './openaiAdapter.js';

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

/**
 * Stream a chat completion from a local endpoint.
 * Accepts the same options as openaiAdapter.streamChat.
 * @param {object} opts — same shape as openaiAdapter.streamChat
 */
export async function streamChat(opts) {
    return openaiStreamChat({
        ...opts,
        baseUrl: opts.baseUrl || DEFAULT_LOCAL_BASE_URL,
        // Local endpoints rarely need an API key; pass 'ollama' as a placeholder
        // so the Authorization header is set (some builds require it)
        apiKey: opts.apiKey || 'ollama',
    });
}
