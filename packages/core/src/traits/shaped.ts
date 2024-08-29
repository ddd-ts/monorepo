import { Shape, type DictShorthand, type Shorthand } from "@ddd-ts/shape";
import { Derive, Trait } from "@ddd-ts/traits";
import { Named } from "./named";

export const Shaped = <S extends DictShorthand>(shape: S) =>
  Trait((base) => Shape(shape, base));

export const NamedShaped = <const Name extends string, S extends DictShorthand>(
  name: Name,
  shape: S,
) => Trait((base) => Derive(Named(name), Shaped({ ...shape, name })));
