/**
 * lettaAdapter — LETTA REST client.
 *
 * LETTA (formerly MemGPT) uses a stateful agent model where memory is managed
 * server-side. We POST the user message to the agent and wait for a full reply;
 * there is no SSE stream, so we simulate streaming by emitting the full text at once.
 *
 * LETTA API reference: https://docs.letta.com/api-reference
 */

/**
 * Send a message to a LETTA agent and emit the response.
 *
 * @param {object} opts
 * @param {string}   opts.baseUrl   — e.g. "http://localhost:8283"
 * @param {string}   opts.agentId   — LETTA agent ID (stored in contact llmConfig.model field)
 * @param {string}   [opts.apiKey]
 * @param {Array}    opts.messages  — we use only the last user message (LETTA is stateful)
 * @param {function} opts.onToken
 * @param {function} opts.onDone
 * @param {function} opts.onError
 */
export async function streamChat({ baseUrl, agentId, apiKey, messages, onToken, onDone, onError }) {
    // Extract the most recent user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
        onError(new Error('No user message to send to LETTA'));
        return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/agents/${agentId}/messages`;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                messages: [{ role: 'user', content: lastUserMsg.content }],
            }),
        });
    } catch (err) {
        onError(new Error(`Network error: ${err.message}`));
        return;
    }

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const errBody = await response.json();
            detail = errBody?.detail || errBody?.message || detail;
        } catch {
            // ignore
        }
        onError(new Error(`LETTA error ${response.status}: ${detail}`));
        return;
    }

    let data;
    try {
        data = await response.json();
    } catch (err) {
        onError(new Error(`Invalid JSON from LETTA: ${err.message}`));
        return;
    }

    // LETTA returns an array of message objects; find the assistant send_message call
    const assistantMessages = (data.messages || []).filter(
        (m) => m.message_type === 'function_return' || m.role === 'assistant',
    );

    // Prefer the content of a "send_message" tool call, or fall back to raw content
    let text = '';
    for (const msg of data.messages || []) {
        if (msg.message_type === 'tool_call' && msg.tool_call?.name === 'send_message') {
            try {
                const args = JSON.parse(msg.tool_call.arguments);
                text = args.message || '';
            } catch {
                // ignore
            }
            break;
        }
        if (msg.role === 'assistant' && msg.content) {
            text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        }
    }

    if (!text && assistantMessages.length > 0) {
        const m = assistantMessages[assistantMessages.length - 1];
        text = m.content || JSON.stringify(m);
    }

    if (!text) text = '(No response from LETTA agent)';

    onToken(text);
    onDone(text);
}
