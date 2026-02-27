/**
 * summarizeClient — single-shot (non-streaming) LLM inference for summarization.
 *
 * Returns a Promise<string> with the full model output.
 * Uses the active contact's LLM config, falling back to global settings.
 */

const PROMPTS = {
    polaroid: `You are a neutral observer. In 2–4 sentences, write a brief third-person summary of the following conversation. Focus on the main topic and key outcomes. Be concise — aim for under 200 words. Write only the summary, no preamble.`,

    memory: `You are helping the user remember a past conversation. Write a first-person memory distillate. Start with who they spoke with and what it was about. Include key facts, decisions, or things learned. Aim for under 300 words. Write only the memory, no preamble.`,

    seedCrystal: `Distill the following conversation into a seed crystal of approximately 2000 characters. This will be injected as the opening context of a fresh conversation with the same AI persona. Include: the AI's established personality traits revealed in this conversation, facts the AI learned about the user, ongoing topics, and unresolved threads. Write in second person, addressed to the AI. Start with "In a previous conversation..."`,

    seedSingle: `Based on this single message, write a brief ~500 character context brief that could seed a new conversation exploring this topic further. Write in second person, addressed to the AI assistant. Start with "The user wants to explore..."`,
};

/**
 * Run a one-shot summarization inference call.
 *
 * @param {object} opts
 * @param {object}   opts.contact      full contact row (for llmConfig)
 * @param {object}   opts.settings     global settings from Zustand
 * @param {Array}    opts.messages     [{role, content}] — the slice to summarize
 * @param {string}   opts.promptKey    key into PROMPTS ('polaroid'|'memory'|'seedCrystal'|'seedSingle')
 * @param {string}   [opts.customPrompt] — override the system prompt entirely
 * @returns {Promise<string>}          the full model output
 */
export async function summarize({ contact, settings, messages, promptKey = 'polaroid', customPrompt }) {
    const llm = contact?.llmConfig ?? {};
    const endpointType = llm.endpointType || settings?.endpointType || 'local';
    const baseUrl = (llm.baseUrl || settings?.baseUrl || '').replace(/\/$/, '');
    const model = llm.model || settings?.model || '';
    const apiKey = llm.apiKey || settings?.apiKey || '';

    if (!baseUrl || !model) {
        throw new Error('No LLM endpoint or model configured. Check contact or global settings.');
    }

    const systemPrompt = customPrompt || PROMPTS[promptKey] || PROMPTS.polaroid;

    // Format conversation for summarization
    const convoText = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

    const body = {
        model,
        stream: false,
        temperature: 0.5,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: convoText },
        ],
    };

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const url = `${baseUrl}/chat/completions`;
    let response;
    try {
        response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
        throw new Error(`Network error: ${err.message}`);
    }

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const errBody = await response.json();
            detail = errBody?.error?.message || detail;
        } catch { /* ignore */ }
        throw new Error(`LLM error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Empty response from LLM');
    return text.trim();
}

export { PROMPTS };
