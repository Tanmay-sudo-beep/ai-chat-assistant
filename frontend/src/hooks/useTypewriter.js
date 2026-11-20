import { useCallback, useEffect, useMemo, useRef } from 'react';

const TICK_MS = 15;

/**
 * Character-by-character reveal of streamed text.
 * Network chunks are queued and released a few characters per tick.
 * When the queue is long it speeds up, so the UI never lags far behind.
 */
export function useTypewriter(onAppend) {
  const pendingRef = useRef('');
  const timerRef = useRef(null);
  const drainResolveRef = useRef(null);
  const onAppendRef = useRef(onAppend);
  onAppendRef.current = onAppend;

  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const resolveDrain = () => {
    drainResolveRef.current?.();
    drainResolveRef.current = null;
  };

  const tick = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) {
      stopTimer();
      resolveDrain();
      return;
    }
    let n = Math.max(1, Math.ceil(pending.length / 40));
    const code = pending.charCodeAt(n - 1);
    if (code >= 0xd800 && code <= 0xdbff) n += 1; // don't split emoji / surrogate pairs
    pendingRef.current = pending.slice(n);
    onAppendRef.current(pending.slice(0, n));
  }, []);

  /** Queue streamed text. */
  const push = useCallback(
    (text) => {
      pendingRef.current += text;
      if (!timerRef.current) timerRef.current = setInterval(tick, TICK_MS);
    },
    [tick]
  );

  /** Resolves once everything queued has been displayed. */
  const drain = useCallback(
    () =>
      new Promise((resolve) => {
        if (!pendingRef.current && !timerRef.current) return resolve();
        drainResolveRef.current = resolve;
      }),
    []
  );

  /** Show all remaining text immediately (used on Stop). */
  const flush = useCallback(() => {
    const rest = pendingRef.current;
    pendingRef.current = '';
    stopTimer();
    if (rest) onAppendRef.current(rest);
    resolveDrain();
  }, []);

  /** Discard queued text (used when switching chats mid-stream). */
  const reset = useCallback(() => {
    pendingRef.current = '';
    stopTimer();
    resolveDrain();
  }, []);

  useEffect(() => () => stopTimer(), []);

  return useMemo(() => ({ push, drain, flush, reset }), [push, drain, flush, reset]);
}
