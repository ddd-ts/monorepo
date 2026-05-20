import { useCallback, useMemo, useState } from "react";

export interface ExpansionApi {
  isExpanded: (path: string) => boolean;
  toggle: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

type State = { mode: "expanded" | "collapsed"; overrides: Set<string> };

const EXPANDED: State = { mode: "expanded", overrides: new Set() };
const COLLAPSED: State = { mode: "collapsed", overrides: new Set() };

export function useExpansion(): ExpansionApi {
  const [state, setState] = useState<State>(EXPANDED);

  const isExpanded = useCallback(
    (path: string) => {
      const overridden = state.overrides.has(path);
      return state.mode === "expanded" ? !overridden : overridden;
    },
    [state],
  );

  const toggle = useCallback((path: string) => {
    setState((prev) => {
      const next = new Set(prev.overrides);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { mode: prev.mode, overrides: next };
    });
  }, []);

  const expandAll = useCallback(() => setState(EXPANDED), []);
  const collapseAll = useCallback(() => setState(COLLAPSED), []);

  return useMemo(
    () => ({ isExpanded, toggle, expandAll, collapseAll }),
    [isExpanded, toggle, expandAll, collapseAll],
  );
}
