import { describe, expect, it, vi } from 'vitest';
import {
  GenerationTokenController,
  guardGeneration,
} from './useGenerationToken';

const firstScope = {
  activityId: 'counting',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

describe('generation tokens', () => {
  it('rejects callbacks from replaced rounds and steps', () => {
    const controller = new GenerationTokenController();
    const stale = controller.issue(firstScope);
    const current = controller.issue({ ...firstScope, stepId: 'step-2' });

    expect(controller.isCurrent(stale)).toBe(false);
    expect(controller.isCurrent(current)).toBe(true);
    expect(controller.runIfCurrent(stale, () => 'stale')).toBeUndefined();
    expect(controller.runIfCurrent(current, () => 'current')).toBe('current');
  });

  it('invalidates timers, media, image, animation, and microphone callbacks uniformly', () => {
    const controller = new GenerationTokenController();
    const token = controller.issue(firstScope);
    const callback = vi.fn((kind: string) => kind);
    const guarded = guardGeneration(controller, token, callback);

    expect(guarded('timer')).toBe('timer');
    controller.invalidate();
    expect(guarded('audio')).toBeUndefined();
    expect(guarded('image')).toBeUndefined();
    expect(guarded('animation')).toBeUndefined();
    expect(guarded('microphone')).toBeUndefined();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('can suspend and resume the same mounted token without reviving an invalidated token', () => {
    const controller = new GenerationTokenController();
    const token = controller.issue(firstScope);

    controller.suspend(token);
    expect(controller.isCurrent(token)).toBe(false);
    controller.resume(token);
    expect(controller.isCurrent(token)).toBe(true);

    controller.invalidate();
    controller.resume(token);
    expect(controller.isCurrent(token)).toBe(false);
  });
});
