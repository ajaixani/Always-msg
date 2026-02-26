/**
 * perlin.js — tiny dependency-free 1D Perlin-style noise.
 *
 * Uses a permutation table and cubic interpolation for smooth,
 * pseudo-random output. Returns values in roughly [-1, 1].
 *
 * Usage:
 *   import { noise1d } from './perlin.js';
 *   const hueShift = noise1d(time * 0.3) * 40;
 */

// Build a fixed permutation table (256 entries, doubled for wrapping)
const PERM = new Uint8Array(512);
(function buildPerm() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Shuffle with a seeded LCG so noise is deterministic
    let seed = 42;
    for (let i = 255; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        const j = ((seed >>> 24) * (i + 1)) >>> 8;
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

// Gradient values for 1D (just ±1)
function grad(hash, x) {
    return (hash & 1) === 0 ? x : -x;
}

// Cubic Hermite fade: 6t^5 - 15t^4 + 10t^3
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
    return a + t * (b - a);
}

/**
 * 1D Perlin noise.
 * @param {number} x — input coordinate
 * @returns {number} in approximately [-1, 1]
 */
export function noise1d(x) {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    const u = fade(xf);
    return lerp(
        grad(PERM[xi], xf),
        grad(PERM[xi + 1], xf - 1),
        u,
    );
}
