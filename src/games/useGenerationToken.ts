import { useEffect, useRef } from 'react';
import {
  communicationScopeKey,
  type CommunicationGameScope,
} from '../domain/communicationGame';

export interface GenerationToken {
  readonly generation: number;
  readonly scope: CommunicationGameScope;
}

export class GenerationTokenController {
  private generation = 0;
  private currentToken: GenerationToken | null = null;

  issue(scope: CommunicationGameScope): GenerationToken {
    this.generation += 1;
    this.currentToken = {
      generation: this.generation,
      scope: { ...scope },
    };
    return this.currentToken;
  }

  invalidate(): void {
    this.generation += 1;
    this.currentToken = null;
  }

  suspend(token: GenerationToken): void {
    if (this.currentToken === token) {
      this.currentToken = null;
    }
  }

  resume(token: GenerationToken): void {
    if (this.currentToken === null && token.generation === this.generation) {
      this.currentToken = token;
    }
  }

  isCurrent(token: GenerationToken): boolean {
    return (
      this.currentToken === token
      && token.generation === this.generation
      && communicationScopeKey(token.scope) === communicationScopeKey(this.currentToken.scope)
    );
  }

  runIfCurrent<Result>(
    token: GenerationToken,
    callback: () => Result,
  ): Result | undefined {
    return this.isCurrent(token) ? callback() : undefined;
  }
}

export interface GenerationTokenHandle {
  token: GenerationToken;
  isCurrent: (token: GenerationToken) => boolean;
  invalidate: () => void;
}

export function useGenerationToken(scope: CommunicationGameScope): GenerationTokenHandle {
  const controllerRef = useRef<GenerationTokenController | null>(null);
  const tokenRef = useRef<{ key: string; token: GenerationToken } | null>(null);
  controllerRef.current ??= new GenerationTokenController();

  const key = communicationScopeKey(scope);
  if (tokenRef.current?.key !== key) {
    tokenRef.current = {
      key,
      token: controllerRef.current.issue(scope),
    };
  }

  useEffect(() => {
    const controller = controllerRef.current;
    const token = tokenRef.current?.token;
    // StrictMode replays effect setup. Suspending keeps cleanup immediate while
    // allowing that replay to restore the same token identity.
    if (token) {
      controller?.resume(token);
    }
    return () => {
      const current = tokenRef.current?.token;
      if (current) {
        controller?.suspend(current);
      }
    };
  }, []);

  const controller = controllerRef.current;
  return {
    token: tokenRef.current.token,
    isCurrent: (token) => controller.isCurrent(token),
    invalidate: () => controller.invalidate(),
  };
}

export function guardGeneration<Arguments extends readonly unknown[], Result>(
  controller: GenerationTokenController,
  token: GenerationToken,
  callback: (...args: Arguments) => Result,
): (...args: Arguments) => Result | undefined {
  return (...args) => controller.isCurrent(token) ? callback(...args) : undefined;
}
