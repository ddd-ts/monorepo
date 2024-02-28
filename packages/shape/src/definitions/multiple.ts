import { shorthandToLonghand } from "../shorthandToLonghand";
import {
  Definition,
  DefinitionRuntime,
  DefinitionSerialized,
} from "./definition";
import { AnyShorthand, ShorthandToLonghand } from "./shorthands";

export type MultipleConfiguration = AnyShorthand | Definition;
export type MultipleShorthand = Array<MultipleConfiguration> & { length: 1 };
export type MultipleDefinition<C extends MultipleConfiguration = MultipleConfiguration> = Definition<
  DefinitionRuntime<ShorthandToLonghand<C>>[],
  DefinitionSerialized<ShorthandToLonghand<C>>[]
>;
export function Multiple<C extends MultipleConfiguration>(
  configuration: C
): MultipleDefinition<C> {
  const longhand = shorthandToLonghand(configuration);

  return {
    paramToRuntime: (param) => param.map((p) => longhand.paramToRuntime(p)),
    serialize: (runtime) => {
      return runtime.map(longhand.serialize);
    },
    deserialize: (serialized) => {
      return serialized.map(longhand.deserialize);
    }
  };
}
