/**
 * ttsPreprocessor.js — Cleans LLM output before sending to TTS.
 *
 * Only text sent to the audio engine is affected.
 * Chat bubble display always shows the original, unmodified text.
 *
 * Usage:
 *   import { cleanTextForTTS } from './ttsPreprocessor.js';
 *   const cleaned = cleanTextForTTS(rawText, settings);
 */

/**
 * Default filter configuration — used when a key is absent from settings.
 * Key names are prefixed with `tts_` to avoid collision with other setting keys.
 */
export const TTS_FILTER_DEFAULTS = {
    tts_remove_special_char: true,   // strip emojis
    tts_ignore_brackets: true,       // strip [bracket content]
    tts_ignore_parentheses: true,    // strip (parenthetical content)
    tts_ignore_asterisks: false,     // strip *asterisk content*
    tts_ignore_angle_brackets: true, // strip <angle bracket content>
};

/**
 * Strip LLM stage-direction noise from `text` based on the user's filter settings.
 *
 * @param {string} text     — raw LLM output string
 * @param {object} settings — flat settings map from Zustand / IndexedDB
 * @returns {string}        — cleaned text safe for TTS
 */
export function cleanTextForTTS(text, settings = {}) {
    if (!text) return '';

    let out = text;

    const get = (key) =>
        key in settings ? settings[key] : TTS_FILTER_DEFAULTS[key];

    // Strip (parenthetical stage directions)
    if (get('tts_ignore_parentheses')) {
        out = out.replace(/\([^)]*\)/g, '');
    }

    // Strip [bracketed notes]
    if (get('tts_ignore_brackets')) {
        out = out.replace(/\[[^\]]*\]/g, '');
    }

    // Strip *action emotes*
    if (get('tts_ignore_asterisks')) {
        out = out.replace(/\*[^*]*\*/g, '');
    }

    // Strip <HTML-like / angle-bracket tags>
    if (get('tts_ignore_angle_brackets')) {
        out = out.replace(/<[^>]*>/g, '');
    }

    // Strip common Unicode emoji ranges
    if (get('tts_remove_special_char')) {
        out = out.replace(
            /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
            '',
        );
    }

    // Collapse multiple spaces and trim
    return out.replace(/\s{2,}/g, ' ').trim();
}
