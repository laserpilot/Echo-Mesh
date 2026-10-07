import { evalLine, robustLinearFit, type Line, type Point } from './fit.ts';

/**
 * Maps the page clock (performance.now, ms) to the AudioContext clock (seconds)
 * so an event planned at a page-clock instant can be scheduled with
 * sample accuracy.
 *
 * Samples come from AudioContext.getOutputTimestamp(), which pairs the
 * context time of the sample *currently leaving the speaker* with the page
 * time it leaves. Scheduling at the mapped time therefore targets the moment
 * sound actually exits (minus any latency the OS doesn't report, e.g.
 * Bluetooth — that's what the per-device trim is for).
 *
 * The two clocks run off different oscillators and drift a little, and the
 * timestamps are quantized to render callbacks, so we fit a line over a
 * sliding window instead of trusting any single reading.
 */
export class AudioClockMap {
  #points: Point[] = [];
  #line: Line | null = null;

  constructor(private readonly windowSize = 64) {}

  /** contextTime in seconds, performanceTime in ms */
  add(contextTime: number, performanceTime: number): void {
    if (!(contextTime > 0) || !(performanceTime > 0)) return; // context not running yet
    this.#points.push({ x: performanceTime, y: contextTime * 1000 - performanceTime });
    if (this.#points.length > this.windowSize) this.#points.shift();
    this.#line = robustLinearFit(this.#points);
  }

  get ready(): boolean {
    return this.#points.length >= 4;
  }

  /** page time (ms) → context time (s) */
  toContext(performanceTime: number): number {
    const offset = this.#line ? evalLine(this.#line, performanceTime) : 0;
    return (performanceTime + offset) / 1000;
  }

  /** context time (s) → page time (ms) */
  toPage(contextTime: number): number {
    // Offset changes by ppm, so one fixed-point step is plenty.
    const guess = contextTime * 1000 - (this.#line?.intercept ?? 0);
    return contextTime * 1000 - (this.#line ? evalLine(this.#line, guess) : 0);
  }

  /** jitter of the readings after fitting, ms */
  get residual(): number {
    return this.#line?.residual ?? NaN;
  }

  /** audio clock rate vs page clock, ppm */
  get driftPpm(): number {
    return (this.#line?.slope ?? 0) * 1e6;
  }
}
