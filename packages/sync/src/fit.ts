export interface Point {
  x: number;
  y: number;
}

export interface Line {
  /** y at x = x0 */
  intercept: number;
  /** dy/dx */
  slope: number;
  /** reference x the intercept is expressed at (keeps numbers small) */
  x0: number;
  /** RMS of residuals of the points kept in the fit */
  residual: number;
}

export function evalLine(line: Line, x: number): number {
  return line.intercept + line.slope * (x - line.x0);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function leastSquares(points: readonly Point[], x0: number): Line {
  const n = points.length;
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x - x0; sy += p.y; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - x0 - mx;
    sxx += dx * dx;
    sxy += dx * (p.y - my);
  }
  const slope = sxx > 1e-9 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  let ss = 0;
  for (const p of points) {
    const r = p.y - (intercept + slope * (p.x - x0));
    ss += r * r;
  }
  return { intercept, slope, x0, residual: Math.sqrt(ss / n) };
}

/**
 * Least-squares line with one round of outlier rejection (residuals beyond
 * 3x the median absolute residual are dropped and the line refit).
 * With fewer than 2 points, or no x spread, returns a flat line at the median.
 */
export function robustLinearFit(points: readonly Point[], x0 = points.at(-1)?.x ?? 0): Line {
  if (points.length < 2) {
    return { intercept: points[0]?.y ?? 0, slope: 0, x0, residual: 0 };
  }
  const first = leastSquares(points, x0);
  const abs = points.map((p) => Math.abs(p.y - evalLine(first, p.x)));
  const mad = median(abs);
  const kept = points.filter((_, i) => abs[i]! <= Math.max(3 * mad, 1e-6));
  return kept.length >= 2 && kept.length < points.length ? leastSquares(kept, x0) : first;
}

export interface WeightedPoint extends Point {
  w: number;
}

/**
 * Weighted least-squares line. Slope is only fitted when the weighted points
 * span at least `minSpan` in x (otherwise noise dominates the slope and gets
 * amplified by extrapolation), and is clamped to ±maxSlope.
 */
export function weightedLinearFit(
  points: readonly WeightedPoint[],
  x0: number,
  { minSpan = 0, maxSlope = Infinity }: { minSpan?: number; maxSlope?: number } = {},
): Line {
  let sw = 0, sx = 0, sy = 0;
  let lo = Infinity, hi = -Infinity;
  for (const p of points) {
    if (p.w <= 0) continue;
    sw += p.w;
    sx += p.w * (p.x - x0);
    sy += p.w * p.y;
    lo = Math.min(lo, p.x);
    hi = Math.max(hi, p.x);
  }
  if (sw === 0) return { intercept: 0, slope: 0, x0, residual: 0 };
  const mx = sx / sw, my = sy / sw;
  let slope = 0;
  if (hi - lo >= minSpan) {
    let sxx = 0, sxy = 0;
    for (const p of points) {
      const dx = p.x - x0 - mx;
      sxx += p.w * dx * dx;
      sxy += p.w * dx * (p.y - my);
    }
    slope = sxx > 1e-9 ? Math.max(-maxSlope, Math.min(maxSlope, sxy / sxx)) : 0;
  }
  const intercept = my - slope * mx;
  let ss = 0;
  for (const p of points) {
    const r = p.y - (intercept + slope * (p.x - x0));
    ss += p.w * r * r;
  }
  return { intercept, slope, x0, residual: Math.sqrt(ss / sw) };
}
