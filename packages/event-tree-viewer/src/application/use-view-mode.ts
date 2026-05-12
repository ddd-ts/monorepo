import { useCallback, useState } from "react";

export type ViewMode = "list" | "tree";

export interface ViewModeApi {
  view: ViewMode;
  setView: (view: ViewMode) => void;
}

export function useViewMode(initial: ViewMode = "tree"): ViewModeApi {
  const [view, setView] = useState<ViewMode>(initial);
  const set = useCallback((next: ViewMode) => setView(next), []);
  return { view, setView: set };
}
