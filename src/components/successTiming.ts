interface TimerApi {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
}

export function scheduleSuccessAdvance(
  delay: number,
  onAdvance: () => void,
  timers: TimerApi = window,
): () => void {
  const handle = timers.setTimeout(onAdvance, delay);
  return () => timers.clearTimeout(handle);
}
