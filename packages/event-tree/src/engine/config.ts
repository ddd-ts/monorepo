import { loadConfig } from "c12";
import { createDefaultEngine, Engine } from "./engine";

export interface EventTreeConfig {
  /**
   * A fully custom engine. When provided, defaults are not applied and `setup`
   * is ignored — the engine is used as-is.
   */
  engine?: Engine;
  /**
   * Hook to extend the default engine with extra parsers/scanners.
   * Ignored when `engine` is provided.
   */
  setup?: (engine: Engine) => void | Promise<void>;
}

export function defineConfig(config: EventTreeConfig): EventTreeConfig {
  return config;
}

/**
 * Loads the user's event-tree config (if any) and returns an Engine.
 *
 * Looks for `.config/ddd-ts/event-tree.{ts,js,mjs,cjs,json,…}` relative to
 * `cwd`. The `.config/ddd-ts/` folder is the shared home for all ddd-ts tool
 * configs.
 *
 * If no config is found, the default engine is returned.
 */
export async function loadEngine(cwd: string = process.cwd()): Promise<Engine> {
  const { config } = await loadConfig<EventTreeConfig>({
    cwd,
    configFile: ".config/ddd-ts/event-tree",
    rcFile: false,
  });
  if (config?.engine) {
    return config.engine;
  }
  const engine = createDefaultEngine();
  if (config?.setup) {
    await config.setup(engine);
  }
  return engine;
}
