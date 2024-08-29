import { Shape, type DictShorthand, type Shorthand } from "@ddd-ts/shape";
import { Trait } from "@ddd-ts/traits";

export const Shaped = <S extends DictShorthand>(shape: S) =>
  Trait((base) => Shape(shape, base));
