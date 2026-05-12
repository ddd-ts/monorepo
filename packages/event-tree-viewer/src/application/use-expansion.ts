import { useCallback, useState } from "react";

export interface ExpansionApi {
  isExpanded: (path: string) => boolean;
  toggle: (path: string) => void;
}

export function useExpansion(): ExpansionApi {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const isExpanded = useCallback((path: string) => !collapsed.has(path), [collapsed]);

  const toggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return { isExpanded, toggle };
}
