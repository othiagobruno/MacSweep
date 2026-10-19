import { useEffect, useRef } from "react";

/**
 * Run `callback` immediately and then every `intervalMs` while `enabled`
 * and the window is visible. Calls never overlap.
 */
export function usePolling(
  callback: () => Promise<unknown> | unknown,
  intervalMs: number,
  enabled = true,
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      if (document.visibilityState === "visible") {
        try {
          await savedCallback.current();
        } catch {
          // Polling is best-effort; the next tick will retry.
        }
      }
      inFlight = false;
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && timer) {
        clearTimeout(timer);
        void tick();
      }
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
