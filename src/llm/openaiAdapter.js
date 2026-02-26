/**
 * openaiAdapter — streaming chat completions for OpenAI-compatible endpoints.
 *
 * Uses the Fetch API + ReadableStream to consume SSE (Server-Sent Events).
 * Works with OpenAI, Together AI, OpenRouter, and Ollama (in OpenAI-compat mode).
 */

/**
 * Stream a chat completion.
 *
 * @param {object} opts
 * @param {string}   opts.baseUrl          — e.g. "https://api.openai.com/v1"
 * @param {string}   opts.model            — e.g. "gpt-4o"
 * @param {string}   [opts.apiKey]         — Bearer token (may be empty for local)
 * @param {Array}    opts.messages         — [{role, content}, ...]
 * @param {function} opts.onToken          — called with each text chunk (string)
 * @param {function} opts.onDone           — called with full accumulated text when stream ends
 * @param {function} opts.onError          — called with an Error on failure
 */
export async function streamChat({ baseUrl, model, apiKey, messages, onToken, onDone, onError }) {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                messages,
                stream: true,
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
            detail = errBody?.error?.message || detail;
        } catch {
            // ignore
        }
        onError(new Error(`LLM error ${response.status}: ${detail}`));
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split on newlines — each SSE event ends with "\n\n"
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep any incomplete line in the buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') continue;

                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    continue;
                }

                const delta = parsed?.choices?.[0]?.delta?.content;
                if (delta) {
                    accumulated += delta;
                    onToken(delta);
                }
            }
        }
    } catch (err) {
        onError(new Error(`Stream read error: ${err.message}`));
        return;
    }

    onDone(accumulated);
}
