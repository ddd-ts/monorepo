import { useCallback, useState } from "react";

export interface RevealApi {
  isRevealed: (path: string) => boolean;
  toggle: (path: string) => void;
}

export function useReveal(): RevealApi {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());

  const isRevealed = useCallback((path: string) => revealed.has(path), [revealed]);

  const toggle = useCallback((path: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return { isRevealed, toggle };
}
