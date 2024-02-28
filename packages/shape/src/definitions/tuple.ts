import { shorthandToLonghand } from "../shorthandToLonghand";
import {
  Definition,
  DefinitionRuntime,
  DefinitionSerialized,
} from "./definition";
import { AnyShorthand, ShorthandToLonghand } from "./shorthands";

export type TupleConfiguration = (AnyShorthand | Definition)[];
export type TupleShorthand = TupleConfiguration;
export type TupleDefinition<C extends TupleConfiguration = TupleConfiguration> = Definition<
  {
    [k in keyof C]: DefinitionRuntime<ShorthandToLonghand<C[k]>>;
  },
  {
    [k in keyof C]: DefinitionSerialized<ShorthandToLonghand<C[k]>>;
  }
>;

export function Tuple<C extends TupleConfiguration>(
  ...configuration: C
): TupleDefinition<C> {
  const longhand = configuration.map(shorthandToLonghand);

  return {
    paramToRuntime: (param) => param,
    serialize: (runtime) => {
      return runtime.map((r, index) => longhand[index]!.serialize(r)) as any;
    },
    deserialize: (serialized) => {
      return serialized.map((s, index) =>
        longhand[index]!.deserialize(s)
      ) as any;
    }
  };
}
