/**
 * limenSensors — SensePlugin implementations to register on every LimenEngine.
 *
 * Sensors run before each buildContext() call and inject live data into the
 * system prompt via <sense type="...">...</sense> XML blocks.
 *
 * Current sensors:
 *   clock    — wall-clock ISO timestamp (CRITICAL)
 *   stamina  — current fatigue narrative (HIGH)
 */

/**
 * Register standard sensors on a LimenEngine instance.
 * @param {import('limenlt').LimenEngine} engine
 */
export function registerSensors(engine) {
    engine.registerSense(clockSense);
}

// ── Sense: Wall clock ─────────────────────────────────────────────────────────

const clockSense = {
    id: 'clock',
    name: 'Wall Clock',
    priority: 'CRITICAL',
    poll: async () => new Date().toISOString(),
    calculateTokenCost: (reading) => Math.ceil(reading.length / 4),
};
