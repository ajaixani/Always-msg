import { useRef, useEffect } from 'react';
import { ttsPlayer } from '../audio/ttsPlayer';
import { noise1d } from '../audio/perlin';
import styles from './SpectrographMouth.module.css';

/**
 * SpectrographMouth — Canvas-based symmetrical mouth visualizer.
 *
 * Props:
 *   size   'small' | 'large'   — small: 320×80 (push mode), large: full-width × 240 (live mode)
 *   active boolean             — true while TTS is playing (boosts brightness)
 */

const BAR_COUNT = 32;       // frequency bars per half (64 total after mirroring)
const SMOOTHING = 0.82;     // FFT smoothing time constant
const IDLE_BREATH = 3;        // baseline bar height in px when silent
const BREATH_FREQ = 0.0015;   // idle breathing oscillation speed

// Canvas dimensions by size
const DIMENSIONS = {
    small: { w: 320, h: 80 },
    large: { w: 800, h: 240 },
};

export default function SpectrographMouth({ size = 'small', active = false }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const barsRef = useRef(new Float32Array(BAR_COUNT)); // smoothed bar heights (right half only)
    const hueRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dim = DIMENSIONS[size] ?? DIMENSIONS.small;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = dim.w * dpr;
        canvas.height = dim.h * dpr;
        canvas.style.width = dim.w + 'px';
        canvas.style.height = dim.h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const { w, h } = dim;
        const halfBars = BAR_COUNT;
        const barW = (w / 2) / halfBars;     // each bar width (right half)
        const maxH = h * 0.48;               // max bar height from centre

        let frameCount = 0;

        function draw() {
            frameCount++;
            rafRef.current = requestAnimationFrame(draw);

            // Smooth hue drift via Perlin noise
            hueRef.current = (hueRef.current + 0.08) % 360;
            const hueDrift = noise1d(frameCount * 0.012) * 35;

            // Get analyser data (if TTS is playing)
            const analyser = ttsPlayer.getAnalyser();
            let fftData = null;
            if (analyser) {
                analyser.smoothingTimeConstant = SMOOTHING;
                fftData = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(fftData);
            }

            // ── Update smoothed bars ─────────────────────────────
            const breath = IDLE_BREATH + Math.sin(frameCount * BREATH_FREQ * Math.PI * 2) * IDLE_BREATH * 0.6;
            for (let i = 0; i < halfBars; i++) {
                let target;
                if (fftData) {
                    // Map bar index to the lower frequency range (voice-forward: bins 0–64)
                    const binIndex = Math.floor((i / halfBars) * Math.min(fftData.length * 0.35, 64));
                    target = (fftData[binIndex] / 255) * maxH;
                } else {
                    // Idle breathing: staggered sine per bar
                    const phase = (i / halfBars) * Math.PI;
                    target = breath * (0.4 + 0.6 * Math.abs(Math.sin(phase + frameCount * BREATH_FREQ * Math.PI * 2)));
                }
                // Exponential smoothing per bar
                barsRef.current[i] = barsRef.current[i] * 0.6 + target * 0.4;
            }

            // ── Clear ────────────────────────────────────────────
            ctx.clearRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;

            // ── Draw bars (mirrored X and Y) ─────────────────────
            for (let i = 0; i < halfBars; i++) {
                const barH = Math.max(barsRef.current[i], 1);
                const hue = (hueRef.current + (i / halfBars) * 280 + hueDrift + 360) % 360;
                const alpha = active ? 0.92 : 0.65;
                const color = `hsla(${hue.toFixed(1)}, 90%, 62%, ${alpha})`;

                // Right half — bar i
                const xRight = cx + i * barW;
                // Left half — bar mirrored (halfBars-1-i)
                const xLeft = cx - (i + 1) * barW;

                // Draw up + down for each X position (Y mirror)
                for (const x of [xRight, xLeft]) {
                    // Top half (upward)
                    const grad = ctx.createLinearGradient(x, cy, x, cy - barH);
                    grad.addColorStop(0, color);
                    grad.addColorStop(1, `hsla(${hue.toFixed(1)}, 90%, 80%, 0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, cy - barH, barW - 1, barH);

                    // Bottom half (downward) — mirror
                    const gradB = ctx.createLinearGradient(x, cy, x, cy + barH);
                    gradB.addColorStop(0, color);
                    gradB.addColorStop(1, `hsla(${hue.toFixed(1)}, 90%, 80%, 0)`);
                    ctx.fillStyle = gradB;
                    ctx.fillRect(x, cy, barW - 1, barH);
                }
            }
        }

        draw();

        return () => {
            cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size]);

    // Update active brightness via CSS class — no need to restart loop
    const dim = DIMENSIONS[size] ?? DIMENSIONS.small;

    return (
        <div
            className={`${styles.wrapper} ${size === 'large' ? styles.large : styles.small} ${active ? styles.active : ''}`}
            aria-hidden="true"
        >
            <canvas
                ref={canvasRef}
                className={styles.canvas}
                style={{ width: dim.w, height: dim.h }}
            />
        </div>
    );
}
