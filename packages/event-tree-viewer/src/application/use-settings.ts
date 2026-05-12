import { useCallback, useState } from "react";

export interface Settings {
  hideDomainPrefix: boolean;
}

export interface SettingsApi {
  settings: Settings;
  toggle: (key: keyof Settings) => void;
}

const DEFAULTS: Settings = {
  hideDomainPrefix: true,
};

export function useSettings(initial: Partial<Settings> = {}): SettingsApi {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, ...initial });

  const toggle = useCallback((key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return { settings, toggle };
}
