import { describe, expect, it } from 'vitest';
import { STAGE_ASPECT, stageDistance } from '../src/index.ts';

describe('stageDistance', () => {
  it('measures in room widths, scaling depth by the drawn aspect so wave rings are round', () => {
    expect(stageDistance({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
    expect(stageDistance({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(STAGE_ASPECT);
  });
});
