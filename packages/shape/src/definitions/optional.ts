import { shorthandToLonghand } from "../shorthandToLonghand";
import {
  Definition,
  DefinitionRuntime,
  DefinitionSerialized,
} from "./definition";
import { AnyShorthand, ShorthandToLonghand } from "./shorthands";

export type OptionalConfiguration = AnyShorthand | Definition;
export type OptionalDefinition<C extends OptionalConfiguration = OptionalConfiguration> = Definition<
  DefinitionRuntime<ShorthandToLonghand<C>> | undefined,
  DefinitionSerialized<ShorthandToLonghand<C>> | undefined
> & { optional: true };

export function Optional<C extends OptionalConfiguration>(
  configuration: Exclude<C, { optional: true }>
): OptionalDefinition<C> {
  const longhand = shorthandToLonghand(configuration);

  return {
    optional: true,
    paramToRuntime: (param) =>
      param ? longhand.paramToRuntime(param) : undefined,
    serialize: (runtime) => {
      return runtime ? longhand.serialize(runtime) : undefined;
    },
    deserialize: (serialized) => {
      return serialized ? longhand.deserialize(serialized) : undefined;
    }
  };
}
