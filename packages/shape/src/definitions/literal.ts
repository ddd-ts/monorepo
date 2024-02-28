import { Definition } from "./definition";

export type Literals = [
  [typeof String, string],
  [typeof Number, number],
  [typeof Boolean, boolean],
  [typeof Date, Date]
];
export type LiteralInput = Literals[number][0];
export type LiteralPrimitive = Literals[number][1];

export type LiteralRuntime<L extends LiteralInput> = Extract<
  Literals[number],
  [L, unknown]
>[1];

export type LiteralShorthand = LiteralInput;
export type LiteralConfiguration = LiteralInput | LiteralShorthand;
export type LiteralDefinition<C extends LiteralConfiguration = LiteralConfiguration> = Definition<
  LiteralRuntime<C>,
  LiteralRuntime<C>
>;
export function Literal<C extends LiteralConfiguration>(
  configuration: C
): LiteralDefinition<C> {
  return {
    paramToRuntime: (param) => param,
    serialize: (runtime) => runtime,
    deserialize: (serialized) => serialized
  };
}
