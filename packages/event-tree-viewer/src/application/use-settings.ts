import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type FontSize = "sm" | "md" | "lg";
export type Theme = "light" | "auto" | "dark";

export interface Settings {
  hideDomainPrefix: boolean;
  fontSize: FontSize;
  theme: Theme;
}

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export interface SettingsApi {
  settings: Settings;
  toggle: (key: BoolKey) => void;
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
}

const DEFAULTS: Settings = {
  hideDomainPrefix: true,
  fontSize: "md",
  theme: "auto",
};

export function useSettings(initial: Partial<Settings> = {}): SettingsApi {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, ...initial });
  const prefersDark = usePrefersDark();

  useEffect(() => {
    const root = document.documentElement;
    const dark = settings.theme === "dark" || (settings.theme === "auto" && prefersDark);
    root.classList.add("theme-switching");
    root.classList.toggle("dark", dark);
    const id = requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });
    return () => cancelAnimationFrame(id);
  }, [settings.theme, prefersDark]);

  const toggle = useCallback((key: BoolKey) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setSettings((prev) => ({ ...prev, fontSize }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  return useMemo(
    () => ({ settings, toggle, setFontSize, setTheme }),
    [settings, toggle, setFontSize, setTheme],
  );
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribePrefersDark,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

function subscribePrefersDark(onChange: () => void): () => void {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
