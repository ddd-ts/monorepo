import type { Engine } from "../engine";
import { applyCommandDefaults } from "./command";
import { applyCommandHandlerDefaults } from "./command-handler";
import { applyEsAggregateDefaults } from "./es-aggregate";
import { applyEventDefaults } from "./event";
import { applyMethodIndexDefaults } from "./method-index";
import { applyProjectionDefaults } from "./projection";
import { applySagaDefaults } from "./saga";
import { applyScannerDefaults } from "./scanner";

export function applyDefaults(engine: Engine) {
  applyEventDefaults(engine);
  applyCommandDefaults(engine);
  applySagaDefaults(engine);
  applyEsAggregateDefaults(engine);
  applyProjectionDefaults(engine);
  applyCommandHandlerDefaults(engine);
  applyMethodIndexDefaults(engine);
  applyScannerDefaults(engine);
}
