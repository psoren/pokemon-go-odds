import { useEffect, useState } from 'react';

/**
 * useState backed by localStorage. Reads once on mount; writes on every change.
 * Falls back silently to in-memory state if storage is unavailable (private
 * browsing, blocked cookies) — persistence is a nicety, not a requirement.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return { ...(initial as object), ...JSON.parse(raw) } as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep going with in-memory state */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
