import { useCallback, useMemo, useState } from "react";

export type FontSize = "sm" | "md" | "lg";

export interface Settings {
  hideDomainPrefix: boolean;
  fontSize: FontSize;
}

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export interface SettingsApi {
  settings: Settings;
  toggle: (key: BoolKey) => void;
  setFontSize: (size: FontSize) => void;
}

const DEFAULTS: Settings = {
  hideDomainPrefix: true,
  fontSize: "md",
};

export function useSettings(initial: Partial<Settings> = {}): SettingsApi {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, ...initial });

  const toggle = useCallback((key: BoolKey) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setSettings((prev) => ({ ...prev, fontSize }));
  }, []);

  return useMemo(
    () => ({ settings, toggle, setFontSize }),
    [settings, toggle, setFontSize],
  );
}
