// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useGenerationToken,
  type GenerationTokenHandle,
} from './useGenerationToken';

const scope = {
  activityId: 'phone',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

describe('useGenerationToken', () => {
  let container: HTMLDivElement;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  it('remains current after the StrictMode setup cycle and suspends on unmount', async () => {
    let handle: GenerationTokenHandle | null = null;
    function Harness() {
      handle = useGenerationToken(scope);
      return null;
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      );
    });

    const mountedHandle = handle as GenerationTokenHandle | null;
    expect(mountedHandle).not.toBeNull();
    expect(mountedHandle!.isCurrent(mountedHandle!.token)).toBe(true);

    await act(async () => root.unmount());
    expect(mountedHandle!.isCurrent(mountedHandle!.token)).toBe(false);
  });
});
