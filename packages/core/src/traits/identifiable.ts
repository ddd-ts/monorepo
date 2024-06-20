import { Trait } from "@ddd-ts/traits";
import type { Identifier, IIdentifiable } from "../interfaces/identifiable";

export const Identifiable = Trait((base) => {
  abstract class $Identifier extends base implements IIdentifiable {
    abstract id: Identifier;
  }

  return $Identifier;
});
