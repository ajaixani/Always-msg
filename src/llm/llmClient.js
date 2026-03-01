/**
 * llmClient — adapter router for the LLM layer.
 *
 * Exports:
 *   streamChat({ contact, settings, messages, imageDataUrl, onToken, onDone, onError })
 *     Standard adapter — uses contact.systemInstruction directly.
 *
 *   streamChatWithLimen({ contact, settings, userText, history, imageDataUrl, ... })
 *     LimenLT-powered — compiles Bootsector + Senses + Polaroids system prompt,
 *     logs turns into LimenLT, triggers sleep at 0% stamina, and fires the
 *     background compression cycle after each round-trip.
 */

import { streamChat as openaiStreamChat } from './openaiAdapter.js';
import { streamChat as lettaStreamChat } from './lettaAdapter.js';
import { streamChat as localStreamChat } from './localAdapter.js';
import { getEngineForContact } from './limenRegistry.js';
import { evaluateAndCompress } from './limenCompressor.js';
import db from '../db/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Standard (non-Limen) stream
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// LimenLT-powered stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream a chat completion powered by LimenLT cognitive memory.
 *
 * Differences from streamChat:
 *  - Takes userText (string) + history array instead of a pre-built messages array
 *  - Calls engine.buildContext() to compile Bootsector + Senses + Polaroid system prompt
 *  - Prepends memory.systemInstruction as a second system block (mutable lore)
 *  - Logs user + assistant turns into LimenLT after the round-trip
 *  - Triggers engine.sleep() automatically when stamina hits 0
 *  - Fires background compression cycle (fire-and-forget) after onDone
 *
 * Message ordering passed to LLM:
 *   1. system: LimenLT compiled context (Bootsector + Senses + Polaroids)
 *   2. system: memory.systemInstruction (compressed mutable lore block)
 *   3. ... prior conversation history ...
 *   4. user:   current user message (last item in history)
 *
 * @param {object}   opts.contact           full contact row
 * @param {object}   opts.settings          global settings from Zustand
 * @param {string}   opts.userText          the user's message text
 * @param {Array}    opts.history           [{role,content}] — full context window incl. current user msg
 * @param {string}   [opts.imageDataUrl]    optional image data URL
 * @param {function} opts.onToken
 * @param {function} opts.onDone
 * @param {function} opts.onError
 * @param {function} [opts.onStaminaChange] called with stamina number (0–100) after each turn
 */
export async function streamChatWithLimen({
    contact, settings, userText, history, imageDataUrl,
    onToken, onDone, onError, onStaminaChange,
}) {
    const llm = contact?.llmConfig ?? {};
    const endpointType = llm.endpointType || 'local';
    const baseUrl = llm.baseUrl || settings?.baseUrl || '';
    const model = llm.model || settings?.model || '';
    const apiKey = llm.apiKey || settings?.apiKey || '';

    try {
        // 1. Get engine and log the user turn
        const engine = await getEngineForContact(contact, settings);
        await engine.addInteraction('user', userText);

        // 2. Compile LimenLT system prompt (Bootsector + Senses + Polaroids)
        const limenContext = await engine.buildContext();

        // 3. Build message array in strict order
        const systemMessages = [{ role: 'system', content: limenContext }];
        const loreBlock = contact.memory?.systemInstruction?.trim();
        if (loreBlock) {
            systemMessages.push({ role: 'system', content: loreBlock });
        }

        // Strip imageRef/system from history; keep only role+content
        let historyMessages = (history ?? [])
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role, content: m.content }));

        // Vision: wrap last user message in multipart if image provided
        if (imageDataUrl && historyMessages.length > 0) {
            const lastUserIdx = historyMessages.reduceRight(
                (found, m, i) => (found === -1 && m.role === 'user' ? i : found), -1,
            );
            if (lastUserIdx !== -1) {
                const textContent = historyMessages[lastUserIdx].content;
                historyMessages[lastUserIdx] = {
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: imageDataUrl, detail: 'auto' } },
                        { type: 'text', text: textContent },
                    ],
                };
            }
        }

        const fullMessages = [...systemMessages, ...historyMessages];

        const adapterOpts = {
            baseUrl,
            model,
            apiKey,
            messages: fullMessages,
            temperature: Number(llm.temperature ?? settings?.temperature ?? 0.7),
            maxTokens: llm.maxTokens || settings?.maxTokens || undefined,
            onToken,
            onDone: async (fullText) => {
                // Log the assistant turn
                await engine.addInteraction('assistant', fullText ?? '');

                // Report stamina
                const stamina = engine.getStamina();
                onStaminaChange?.(stamina);

                // Auto-sleep at 0% stamina
                if (stamina <= 0) {
                    console.log('[Limen] Stamina exhausted — triggering sleep cycle');
                    _triggerSleep(engine, contact).catch((e) =>
                        console.warn('[Limen] Sleep failed:', e.message),
                    );
                }

                // Caller's onDone first
                onDone?.(fullText);

                // Fire-and-forget compression check with latest contact data
                const freshContact = await db.contacts.get(contact.id).catch(() => contact);
                evaluateAndCompress(freshContact ?? contact, settings).catch(() => { });
            },
            onError,
        };

        switch (endpointType) {
            case 'openai': return openaiStreamChat(adapterOpts);
            case 'letta': return lettaStreamChat({ ...adapterOpts, agentId: model });
            case 'local':
            default: return localStreamChat(adapterOpts);
        }

    } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
    }
}

// ── Sleep helper ─────────────────────────────────────────────────────────────

async function _triggerSleep(engine, contact) {
    const sessionWeather = {
        fiveWs: {
            who: [contact.name ?? 'user'],
            what: ['conversation'],
            where: ['Always-msg'],
            when: new Date().toISOString().slice(0, 7),
            why: ['communication'],
        },
        senses: { sight: [], sound: [], smell: [], touch: [], taste: [] },
        vibe: 'conversational',
    };
    await engine.sleep(sessionWeather);
    console.log(`[Limen] Sleep cycle complete for contact ${contact.id}`);
}
